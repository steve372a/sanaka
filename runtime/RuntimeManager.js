const fs = require('fs');
const fsPromises = require('fs/promises');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const { parse: parseToml } = require('smol-toml');
const { QemuDetector } = require('./QemuDetector');
const { RuntimeRegistry } = require('./RuntimeRegistry');
const { QmpClient } = require('./QmpClient');
const {
  QemuCommandBuilder,
  deriveStableMacAddress,
  resolveBinaryKey,
  tokenizeUserArgs,
  splitAdvancedUserArgs
} = require('./QemuCommandBuilder');
const { CONTROLLED_BINDINGS, splitCustomArgs } = require('./QemuArgsSync');
const { ClipboardBridgeService } = require('./ClipboardBridgeService');
const { ClipboardBootstrapService, DEFAULT_BOOTSTRAP_PORT, normalizeMacAddress } = require('./ClipboardBootstrapService');
const { IsoImageService } = require('./IsoImageService');
const { SanakaToolsService } = require('./SanakaToolsService');
const { WebAudioBridge } = require('./WebAudioBridge');
const { QemuPathProxy } = require('./QemuPathProxy');

const MACHINE_CONFIG_FILE = 'machine.svm';
const STOP_GRACE_TIMEOUT_MS = 8000;

function machineStatusToLifecycle(status) {
  if (status === 'starting' || status === 'stopping' || status === 'resetting' || status === 'paused') {
    return status;
  }
  if (status === 'running') {
    return 'running';
  }
  return 'stopped';
}

function makeRuntimeEvent(type, payload) {
  return {
    type,
    at: new Date().toISOString(),
    ...payload
  };
}

function getQmpAddress(platform, runtimeDir, machineId) {
  if (platform === 'win32' || platform === 'darwin') {
    return {
      transport: 'tcp',
      host: '127.0.0.1',
      path: null
    };
  }
  return {
    transport: 'unix',
    path: path.join(runtimeDir, 'qmp.sock')
  };
}

function normalizeBundlePath(machinePath) {
  const absolutePath = path.resolve(machinePath);
  if (path.basename(absolutePath).toLowerCase() === MACHINE_CONFIG_FILE) {
    return {
      bundlePath: path.dirname(absolutePath),
      configPath: absolutePath
    };
  }

  return {
    bundlePath: absolutePath,
    configPath: path.join(absolutePath, MACHINE_CONFIG_FILE)
  };
}

function parseMachineConfig(content) {
  const parsed = parseToml(content);
  if (parsed.kind !== 'machine') {
    throw new Error('The selected configuration is not a machine package.');
  }
  return {
    ...parsed,
    sharing: {
      enabled: Boolean(parsed.sharing?.enabled),
      hostPath: String(parsed.sharing?.hostPath || ''),
      mode: parsed.sharing?.mode === 'readonly' ? 'readonly' : 'readwrite',
      shareName: String(parsed.sharing?.shareName || 'qemu')
    },
    integration: {
      clipboard: {
        enabled: Boolean(parsed.integration?.clipboard?.enabled),
        mode: 'text',
        autoConnect: parsed.integration?.clipboard?.autoConnect !== false
      }
    }
  };
}

function resolveDiskPath(bundlePath, disk) {
  const storageMode = disk.storage_mode || (path.isAbsolute(disk.path) ? 'external' : 'managed');
  if (storageMode === 'managed') {
    return path.resolve(bundlePath, disk.path);
  }
  return path.resolve(disk.path);
}

function resolveOptionalMachineAssetPath(bundlePath, targetPath) {
  const value = String(targetPath || '').trim();
  if (!value) {
    return '';
  }
  if (path.isAbsolute(value)) {
    return path.resolve(value);
  }
  return path.resolve(bundlePath, value);
}

async function normalizeMachinePaths(bundlePath, machine) {
  const nextMachine = {
    ...machine,
    disks: Array.isArray(machine.disks) ? [...machine.disks] : [],
    media: {
      iso: String(machine.media?.iso || ''),
      floppy: String(machine.media?.floppy || '')
    }
  };

  for (let index = 0; index < nextMachine.disks.length; index += 1) {
    const disk = nextMachine.disks[index];
    const resolvedPath = resolveDiskPath(bundlePath, disk);
    const exists = await fileExists(resolvedPath);
    if (!exists) {
      const diskLabel = disk.path || disk.id || `disk ${index + 1}`;
      throw new Error(`Disk image not found: ${diskLabel}`);
    }
    nextMachine.disks[index] = {
      ...disk,
      path: resolvedPath
    };
  }

  if (nextMachine.media.iso) {
    const resolvedIsoPath = resolveOptionalMachineAssetPath(bundlePath, nextMachine.media.iso);
    if (!(await fileExists(resolvedIsoPath))) {
      throw new Error(`Optical image not found: ${nextMachine.media.iso}`);
    }
    nextMachine.media.iso = resolvedIsoPath;
  }

  if (nextMachine.media.floppy) {
    const resolvedFloppyPath = resolveOptionalMachineAssetPath(bundlePath, nextMachine.media.floppy);
    if (!(await fileExists(resolvedFloppyPath))) {
      throw new Error(`Floppy image not found: ${nextMachine.media.floppy}`);
    }
    nextMachine.media.floppy = resolvedFloppyPath;
  }

  if (machine.advanced?.firmware?.code_path || machine.advanced?.firmware?.vars_path) {
    nextMachine.advanced = {
      ...machine.advanced,
      firmware: {
        ...machine.advanced.firmware
      }
    };

    if (nextMachine.advanced.firmware.code_path) {
      const resolvedCodePath = resolveOptionalMachineAssetPath(bundlePath, nextMachine.advanced.firmware.code_path);
      if (!(await fileExists(resolvedCodePath))) {
        throw new Error(`UEFI firmware code file was not found: ${nextMachine.advanced.firmware.code_path}`);
      }
      nextMachine.advanced.firmware.code_path = resolvedCodePath;
    }

    if (nextMachine.advanced.firmware.vars_path) {
      const resolvedVarsPath = resolveOptionalMachineAssetPath(bundlePath, nextMachine.advanced.firmware.vars_path);
      if (!(await fileExists(resolvedVarsPath))) {
        throw new Error(`UEFI firmware vars file was not found: ${nextMachine.advanced.firmware.vars_path}`);
      }
      nextMachine.advanced.firmware.vars_path = resolvedVarsPath;
    }
  }

  return nextMachine;
}

async function fileExists(filePath) {
  try {
    await fsPromises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function appendBoundedText(current, chunk, maxLength = 8192) {
  const combined = `${current}${chunk}`;
  if (combined.length <= maxLength) {
    return combined;
  }
  return combined.slice(combined.length - maxLength);
}

function appendRuntimeLogLine(logStream, message) {
  if (!logStream || typeof logStream.write !== 'function') {
    return;
  }
  const timestamp = new Date().toISOString();
  try {
    logStream.write(`[sanaka ${timestamp}] ${message}\n`);
  } catch {
    // ignore logging failures
  }
}

function shellQuote(argument) {
  const value = String(argument ?? '');
  if (value.length === 0) {
    return '""';
  }
  if (!/[^\w./:\\-]/.test(value)) {
    return value;
  }
  return `"${value.replace(/(["\\$`])/g, '\\$1')}"`;
}

function isHostForwardExtra(raw) {
  const value = String(raw || '').trim();
  return value.startsWith('hostfwd=') || value.startsWith('guestfwd=');
}

function pickPreferredStartupError({ stderr = '', error = null, exitCode = null }) {
  const normalizedStderr = String(stderr || '').trim();
  if (normalizedStderr) {
    return normalizedStderr;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  if (typeof exitCode === 'number') {
    return `QEMU exited with code ${exitCode}.`;
  }

  return 'Failed to start QEMU.';
}

async function allocatePort({ start, end }) {
  for (let port = start; port <= end; port += 1) {
    const available = await new Promise((resolve) => {
      const server = net.createServer();
      server.unref();
      server.once('error', () => resolve(false));
      server.listen(port, '127.0.0.1', () => {
        server.close(() => resolve(true));
      });
    });
    if (available) {
      return port;
    }
  }
  throw new Error(`No free port found in range ${start}-${end}.`);
}

class RuntimeManager {
  constructor(options) {
    this.app = options.app;
    this.emitEvent = options.emitEvent;
    this.platform = options.platform || process.platform;
    this.arch = options.arch || process.arch;
    this.detector = options.detector || new QemuDetector({
      platform: this.platform,
      arch: this.arch,
      resourcesPath: options.resourcesPath || process.resourcesPath
    });
    this.registry = options.registry || new RuntimeRegistry();
    this.builder = options.builder || new QemuCommandBuilder();
    this.readClipboardText = options.readClipboardText || (() => '');
    this.writeClipboardText = options.writeClipboardText || (() => undefined);
    this.isoService = options.isoService || new IsoImageService({
      platform: this.platform
    });
    this.sanakaToolsService = options.sanakaToolsService || new SanakaToolsService({
      app: this.app
    });
    this.pathProxyService = options.pathProxyService || new QemuPathProxy({
      platform: this.platform
    });
    this.clipboardBootstrapService = options.clipboardBootstrapService || new ClipboardBootstrapService({
      port: options.clipboardBootstrapPort || DEFAULT_BOOTSTRAP_PORT,
      resolveSessionByMac: (machineMac) => this.#resolveClipboardSessionByMac(machineMac),
      listSessions: () => this.#listClipboardSessions(),
      onError: (error) => {
        this.emitEvent(
          makeRuntimeEvent('runtime-warning', {
            message: error instanceof Error ? error.message : 'Clipboard bootstrap service failed.'
          })
        );
      },
      onLog: (message) => {
        this.#appendBootstrapLogs(message);
      }
    });
    this.environment = null;
  }

  async initialize() {
    await this.detectQemu();
    await this.clipboardBootstrapService.start();
  }

  async detectQemu() {
    this.environment = await this.detector.detect();
    this.emitEvent(
      makeRuntimeEvent('environment-updated', {
        environment: this.environment
      })
    );
    return this.environment;
  }

  async getRuntimeEnvironment() {
    return this.environment || this.detectQemu();
  }

  async getSharedFolderEnvironment() {
    await this.getRuntimeEnvironment();
    return {
      available: false,
      backend: 'smb',
      smbdPath: null,
      version: null,
      installHint: 'Shared folders are unavailable in this version.',
      reason: 'Shared folders are unavailable in this version.'
    };
  }

  async previewMachineCommand(machinePath) {
    const environment = await this.detectQemu();
    const { bundlePath, configPath } = normalizeBundlePath(machinePath);
    const content = await fsPromises.readFile(configPath, 'utf8');
    const machine = await normalizeMachinePaths(bundlePath, parseMachineConfig(content));

    const runtimeDir = path.join(this.app.getPath('userData'), 'runtime-preview', machine.id);
    await fsPromises.mkdir(runtimeDir, { recursive: true });
    const proxiedMachine = await this.#resolveMachineLaunchPaths(machine, runtimeDir, null);

    const qmpBase = getQmpAddress(this.platform, runtimeDir, machine.id);
    if (qmpBase.transport === 'tcp') {
      qmpBase.port = await allocatePort({ start: 47000, end: 47999 });
    }

    const port = await allocatePort({ start: 5901, end: 5999 });
    const websocketPort = await allocatePort({ start: 5700, end: 5799 });
    const displayNumber = port - 5900;

    const buildResult = this.builder.build({
      machine: proxiedMachine,
      environment,
      runtimePaths: {
        runtimeDir,
        qmp: qmpBase
      },
      displayConfig: {
        port,
        websocketPort,
        displayNumber
      },
      host: {
        platform: this.platform,
        arch: this.arch
      }
    });

    return {
      machineId: machine.id,
      bundlePath,
      configPath,
      binaryPath: buildResult.binaryPath,
      args: [...buildResult.args],
      commandLine: [buildResult.binaryPath, ...buildResult.args].map(shellQuote).join(' '),
      accelerator: buildResult.accelerator,
      display: { ...buildResult.display },
      qmp: {
        transport: qmpBase.transport,
        path: qmpBase.path || null,
        host: qmpBase.host || null,
        port: qmpBase.port || null
      },
      environment
    };
  }

  async getFullQemuCommand(machine) {
    const environment = await this.detectQemu();
    const machineId = String(machine?.id || 'preview-machine');
    const runtimeDir = path.join(this.app.getPath('userData'), 'runtime-preview', machineId);
    await fsPromises.mkdir(runtimeDir, { recursive: true });

    const proxiedMachine = await this.#resolveMachineLaunchPaths(machine, runtimeDir, null);

    const qmpBase = getQmpAddress(this.platform, runtimeDir, machineId);
    if (qmpBase.transport === 'tcp') {
      qmpBase.port = 47000;
    }

    const buildResult = this.builder.build({
      machine: proxiedMachine,
      environment,
      runtimePaths: {
        runtimeDir,
        qmp: qmpBase
      },
      displayConfig: {
        port: 5901,
        websocketPort: 5700,
        displayNumber: 1
      },
      host: {
        platform: this.platform,
        arch: this.arch
      }
    });

    return {
      args: this.#buildFullQemuCommandArgs(machine, environment, buildResult)
    };
  }

  async listRunningMachines() {
    return this.registry.values().map((record) => this.#serializeState(record));
  }

  async getMachineState(machineId) {
    return this.#serializeState(this.registry.get(machineId));
  }

  async updateSharedFolder(machinePath, config) {
    return {
      ok: false,
      error: 'Shared folders are unavailable in this version.',
      pendingRestart: false,
      state: null
    };
  }

  async updateClipboardBridge(machinePath, config) {
    const normalized = {
      enabled: Boolean(config?.enabled),
      mode: 'text',
      autoConnect: config?.autoConnect !== false
    };

    const { bundlePath, configPath } = normalizeBundlePath(machinePath);
    const content = await fsPromises.readFile(configPath, 'utf8');
    const machine = parseMachineConfig(content);
    machine.integration = {
      clipboard: normalized
    };
    await fsPromises.writeFile(configPath, this.#stringifyMachine(machine), 'utf8');

    const record = this.registry.get(machine.id);
    if (record) {
      record.machine = {
        ...record.machine,
        integration: {
          clipboard: normalized
        }
      };
      await this.#applyClipboardBridge(record, path.join(this.app.getPath('userData'), 'runtime', machine.id));
      this.registry.set(record);
      this.emitEvent(
        makeRuntimeEvent('machine-updated', {
          machineId: record.machineId,
          state: this.#serializeState(record)
        })
      );
    }

    return {
      ok: true,
      config: normalized,
      state: record ? this.#serializeState(record) : null
    };
  }

  async startMachine(machinePath) {
    const environment = await this.detectQemu();
    const { bundlePath, configPath } = normalizeBundlePath(machinePath);

    let machine;
    try {
      const content = await fsPromises.readFile(configPath, 'utf8');
      machine = await normalizeMachinePaths(bundlePath, parseMachineConfig(content));
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to load the machine configuration.',
        state: null
      };
    }

    const existing = this.registry.get(machine.id);
    if (existing && existing.status === 'stopping') {
      await this.#waitForMachineExit(machine.id, 3000);
    }

    const stoppingRecord = this.registry.get(machine.id);
    if (stoppingRecord && stoppingRecord.status === 'stopping') {
      await this.forceStopMachine(machine.id).catch(() => null);
      await this.#waitForMachineExit(machine.id, 5000);
    }

    const retryRecord = this.registry.get(machine.id);
    if (retryRecord && retryRecord.status !== 'stopped') {
      return {
        ok: true,
        alreadyRunning: true,
        state: this.#serializeState(retryRecord)
      };
    }

    const runtimeDir = path.join(this.app.getPath('userData'), 'runtime', machine.id);
    await fsPromises.mkdir(runtimeDir, { recursive: true });
    const pathProxyLogs = [];
    const proxiedMachine = await this.#resolveMachineLaunchPaths(machine, runtimeDir, (message) => {
      pathProxyLogs.push(message);
    });

    const qmpBase = getQmpAddress(this.platform, runtimeDir, machine.id);
    if (qmpBase.transport === 'tcp') {
      qmpBase.port = await allocatePort({ start: 47000, end: 47999 });
    }

    const displayBackend = 'vnc';
    const port = await allocatePort({ start: 5901, end: 5999 });
    const websocketPort = await allocatePort({ start: 5700, end: 5799 });
    const displayNumber = port - 5900;
    const logPath = path.join(runtimeDir, 'qemu.log');

    let buildResult;
    try {
      buildResult = this.builder.build({
        machine: proxiedMachine,
        environment,
        runtimePaths: {
          runtimeDir,
          qmp: qmpBase
        },
        displayConfig: {
          port,
          websocketPort,
          displayNumber
        },
        host: {
          platform: this.platform,
          arch: this.arch
        }
      });
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to build the QEMU launch command.',
        state: null
      };
    }

    const child = spawn(buildResult.binaryPath, buildResult.args, {
      cwd: bundlePath,
      env: { ...process.env }
    });

    const logStream = fs.createWriteStream(logPath, { flags: 'a' });
    appendRuntimeLogLine(logStream, `machine starting id=${machine.id}`);
    appendRuntimeLogLine(logStream, `expected machineMac=${deriveStableMacAddress(machine.id)}`);
    pathProxyLogs.forEach((message) => appendRuntimeLogLine(logStream, message));
    appendRuntimeLogLine(logStream, `qemu command=${[buildResult.binaryPath, ...buildResult.args].map(shellQuote).join(' ')}`);
    let startupStderr = '';
    child.stdout?.pipe(logStream);
    child.stderr?.pipe(logStream);
    child.stderr?.on('data', (chunk) => {
      startupStderr = appendBoundedText(startupStderr, chunk.toString('utf8'));
    });

    let resolveProcessOutcome;
    const processOutcome = new Promise((resolve) => {
      resolveProcessOutcome = resolve;
    });
    let startupCancelled = false;

    const state = {
      machineId: machine.id,
      bundlePath,
      configPath,
      pid: child.pid || -1,
      status: 'starting',
      startedAt: new Date().toISOString(),
      arch: machine.system.arch,
      displayFrontend: buildResult.display.frontend,
      displayBackend: buildResult.display.backend,
      displayPort: buildResult.display.port,
      displayWebSocketPort: buildResult.display.websocketPort,
      qmpSocketPath: qmpBase.path || null,
      qmpTcpPort: qmpBase.port || null,
      logPath,
      exitCode: null,
      lastError: null,
      machineMac: deriveStableMacAddress(machine.id),
      clipboardBridge: null
    };

    this.registry.set({
      ...state,
      process: child,
      qmpClient: null,
      clipboardBridgeService: null,
      webAudioBridge: null,
      machine,
      logStream
    });

    this.emitEvent(
      makeRuntimeEvent('machine-starting', {
        machineId: machine.id,
        state: this.#serializeState(this.registry.get(machine.id))
      })
    );

    child.once('error', (error) => {
      startupCancelled = true;
      resolveProcessOutcome?.({ kind: 'error', error });
      void this.#handleProcessExit(machine.id, null, error);
    });

    child.once('exit', (code) => {
      startupCancelled = true;
      resolveProcessOutcome?.({ kind: 'exit', code });
      void this.#handleProcessExit(machine.id, code, null);
    });

    try {
      const qmpClient = new QmpClient(
        qmpBase.transport === 'unix'
          ? { transport: 'unix', path: qmpBase.path }
          : { transport: 'tcp', host: '127.0.0.1', port: qmpBase.port }
      );
      const qmpConnectOutcome = qmpClient.connect({
        shouldContinue: () => !startupCancelled
      })
        .then(() => ({ kind: 'qmp-connected' }))
        .catch((error) => ({ kind: 'qmp-error', error }));

      const startupOutcome = await Promise.race([qmpConnectOutcome, processOutcome]);
      if (startupOutcome.kind !== 'qmp-connected') {
        qmpClient.close();
        const preferredError =
          startupOutcome.kind === 'qmp-error'
            ? pickPreferredStartupError({ stderr: startupStderr, error: startupOutcome.error })
            : pickPreferredStartupError({ stderr: startupStderr, error: startupOutcome.error, exitCode: startupOutcome.code });
        return {
          ok: false,
          error: preferredError,
          state: null
        };
      }

      qmpClient.on('event', (message) => {
        this.#handleQmpEvent(machine.id, message);
      });

      const status = await qmpClient.queryStatus();
      const record = this.registry.get(machine.id);
      if (!record) {
        throw new Error('Runtime record disappeared before QMP handshake completed.');
      }
      record.qmpClient = qmpClient;
      record.status = status?.running === false ? 'starting' : 'running';
      await this.#applyClipboardBridge(record, runtimeDir);
      await this.#applyWebAudioBridge(record, runtimeDir);
      this.registry.set(record);

      this.emitEvent(
        makeRuntimeEvent('machine-running', {
          machineId: machine.id,
          state: this.#serializeState(record)
        })
      );

      return {
        ok: true,
        alreadyRunning: false,
        state: this.#serializeState(record)
      };
    } catch (error) {
      const activeRecord = this.registry.get(machine.id);
      if (activeRecord?.process) {
        await this.forceStopMachine(machine.id);
      }
      const failedState = this.registry.get(machine.id);
      return {
        ok: false,
        error: pickPreferredStartupError({ stderr: startupStderr, error }),
        state: failedState ? this.#serializeState(failedState) : null
      };
    }
  }

  async stopMachine(machineId) {
    const record = this.registry.get(machineId);
    if (!record) {
      return { ok: false, error: 'Machine is not running.' };
    }

    record.status = 'stopping';
    this.registry.set(record);
    this.#scheduleStopEscalation(record);
    this.emitEvent(
      makeRuntimeEvent('machine-stopping', {
        machineId,
        state: this.#serializeState(record)
      })
    );

    if (record.qmpClient) {
      await record.qmpClient.systemPowerdown();
      return { ok: true, state: this.#serializeState(record) };
    }

    record.process.kill('SIGTERM');
    return { ok: true, state: this.#serializeState(record) };
  }

  async forceStopMachine(machineId) {
    const record = this.registry.get(machineId);
    if (!record) {
      return { ok: false, error: 'Machine is not running.' };
    }

    this.#clearStopEscalation(record);
    record.status = 'stopping';
    this.registry.set(record);
    this.emitEvent(
      makeRuntimeEvent('machine-stopping', {
        machineId,
        state: this.#serializeState(record)
      })
    );

    try {
      record.process.kill('SIGKILL');
    } catch {
      try {
        record.process.kill('SIGTERM');
      } catch {
        // The process may already be gone; cleanup below will settle the UI state.
      }
    }

    const exited = await this.#waitForMachineExit(machineId, 1500);
    if (!exited && this.registry.get(machineId)) {
      await this.#finalizeStoppedRecord(machineId, null, null);
    }

    return { ok: true, state: null };
  }

  async resetMachine(machineId, mode = 'hard') {
    const record = this.registry.get(machineId);
    if (!record) {
      return { ok: false, error: 'Machine is not running.' };
    }

    if (mode === 'soft') {
      const bundlePath = record.bundlePath;
      const stopped = await this.forceStopMachine(machineId);
      if (!stopped.ok) {
        return stopped;
      }
      return this.startMachine(bundlePath);
    }

    if (!record.qmpClient) {
      return { ok: false, error: 'Machine is not ready for reset yet.' };
    }

    record.status = 'resetting';
    this.registry.set(record);
    this.emitEvent(
      makeRuntimeEvent('machine-resetting', {
        machineId,
        state: this.#serializeState(record)
      })
    );

    try {
      await record.qmpClient.systemReset();
      return { ok: true, state: this.#serializeState(record) };
    } catch (error) {
      record.status = 'running';
      record.lastError = error instanceof Error ? error.message : 'Failed to reset the machine.';
      this.registry.set(record);
      return {
        ok: false,
        error: record.lastError,
        state: this.#serializeState(record)
      };
    }
  }

  async changeMedia(machineId, isoPath, drive = 'cdrom') {
    const record = this.registry.get(machineId);
    if (!record) {
      return { ok: false, error: 'Machine is not running.' };
    }

    if (!record.qmpClient || !record.machine) {
      return { ok: false, error: 'Machine is not ready for media changes yet.' };
    }

    const targetIds = await this.#resolveMediaDeviceIds(record, drive);
    if (targetIds.length === 0) {
      return { ok: false, error: `No ${drive} drive is available on this machine.` };
    }

    const runtimeDir = path.join(this.app.getPath('userData'), 'runtime', machineId);
    await fsPromises.mkdir(runtimeDir, { recursive: true });
    const resolvedMediaPath = await this.#resolveLaunchPathForQemu(isoPath, runtimeDir, `change-media-${drive}`, (message) => {
      if (record.logStream) {
        appendRuntimeLogLine(record.logStream, message);
      }
    });

    let lastError = null;
    try {
      for (const targetId of targetIds) {
        try {
          await record.qmpClient.blockdevChangeMedium({
            id: targetId,
            filename: resolvedMediaPath,
            format: path.extname(isoPath).toLowerCase() === '.iso' ? 'raw' : 'raw',
            readOnly: true
          });
          if (record.machine?.media) {
            record.machine.media.iso = isoPath;
          }
          record.lastError = null;
          this.registry.set(record);
          return { ok: true, state: this.#serializeState(record) };
        } catch (error) {
          lastError = error;
        }
      }
    } catch (error) {
      lastError = error;
    }

    record.lastError = lastError instanceof Error ? lastError.message : 'Failed to change media.';
    this.registry.set(record);
    return {
      ok: false,
      error: record.lastError,
      state: this.#serializeState(record)
    };
  }

  async mountBundledTestNetIso(machineId) {
    const candidates = [];
    if (typeof this.app?.getAppPath === 'function') {
      candidates.push(path.join(this.app.getAppPath(), 'iso', 'testnet.iso'));
    }
    if (typeof process.resourcesPath === 'string' && process.resourcesPath.length > 0) {
      candidates.push(path.join(process.resourcesPath, 'iso', 'testnet.iso'));
    }
    candidates.push(path.join(process.cwd(), 'iso', 'testnet.iso'));

    const isoPath = await this.#resolveFirstExistingPath(candidates);
    if (!isoPath) {
      return {
        ok: false,
        error: 'Bundled testnet ISO was not found: iso/testnet.iso.',
        state: this.#serializeState(this.registry.get(machineId))
      };
    }

    return this.changeMedia(machineId, isoPath, 'cdrom');
  }

  async mountSanakaToolsIso(machineId) {
    let isoPath = null;
    try {
      isoPath = await this.sanakaToolsService.ensureBundledIso();
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to prepare the Sanaka guest enhancement tools ISO.',
        state: this.#serializeState(this.registry.get(machineId))
      };
    }

    return this.changeMedia(machineId, isoPath, 'cdrom');
  }

  async mountSanakaToolsLinuxIso(machineId) {
    const candidates = [];
    if (typeof this.app?.getAppPath === 'function') {
      candidates.push(path.join(this.app.getAppPath(), 'iso', 'sanaka-tools-linux.iso'));
    }
    if (typeof process.resourcesPath === 'string' && process.resourcesPath.length > 0) {
      candidates.push(path.join(process.resourcesPath, 'iso', 'sanaka-tools-linux.iso'));
    }
    candidates.push(path.join(process.cwd(), 'iso', 'sanaka-tools-linux.iso'));

    const isoPath = await this.#resolveFirstExistingPath(candidates);
    if (!isoPath) {
      return {
        ok: false,
        error: 'Bundled Linux guest enhancement ISO was not found: iso/sanaka-tools-linux.iso.',
        state: this.#serializeState(this.registry.get(machineId))
      };
    }

    return this.changeMedia(machineId, isoPath, 'cdrom');
  }

  async dispose() {
    const active = this.registry.values();
    await Promise.all(active.map((record) => this.forceStopMachine(record.machineId).catch(() => null)));
    await this.clipboardBootstrapService.stop().catch(() => null);
  }

  handleQmpEventForTest(machineId, message) {
    this.#handleQmpEvent(machineId, message);
  }

  #handleQmpEvent(machineId, message) {
    const record = this.registry.get(machineId);
    if (!record) {
      return;
    }

    let eventType = null;
    if (message.event === 'SHUTDOWN') {
      if (record.status === 'stopping') {
        eventType = 'machine-stopping';
      }
    } else if (message.event === 'RESUME') {
      record.status = 'running';
      eventType = 'machine-running';
    } else if (message.event === 'STOP') {
      record.status = 'paused';
    } else if (message.event === 'RESET') {
      record.status = 'running';
      eventType = 'machine-running';
    }

    this.registry.set(record);
    if (eventType) {
      this.emitEvent(
        makeRuntimeEvent(eventType, {
          machineId,
          state: this.#serializeState(record)
        })
      );
    }
  }

  async #handleProcessExit(machineId, code, error) {
    await this.#finalizeStoppedRecord(machineId, code, error);
  }

  async #finalizeStoppedRecord(machineId, code, error) {
    const record = this.registry.get(machineId);
    if (!record) {
      return;
    }

    this.#clearStopEscalation(record);

    if (record.qmpClient) {
      record.qmpClient.close();
    }

    if (record.clipboardBridgeService) {
      await record.clipboardBridgeService.stop().catch(() => null);
    }

    if (record.webAudioBridge) {
      await this.#stopWebAudioCapture(record).catch(() => null);
      await record.webAudioBridge.stop().catch(() => null);
    }

    if (record.logStream) {
      const stream = record.logStream;
      await Promise.race([
        new Promise((resolve) => {
          stream.once('close', resolve);
          stream.end();
        }),
        wait(500)
      ]).catch(() => null);
    }

    record.status = 'stopped';
    record.exitCode = code;
    record.lastError = error ? error.message : null;
    record.qmpClient = null;
    record.clipboardBridgeService = null;
    record.webAudioBridge = null;
    record.clipboardBridge = null;
    record.process = null;
    record.machine = null;
    record.logStream = null;
    this.emitEvent(
      makeRuntimeEvent(error ? 'machine-error' : 'machine-stopped', {
        machineId,
        state: this.#serializeState(record),
        error: error ? error.message : null
      })
    );

    this.registry.delete(machineId);
  }

  #serializeState(record) {
    if (!record) {
      return null;
    }

    return {
      machineId: record.machineId,
      bundlePath: record.bundlePath,
      configPath: record.configPath,
      pid: record.pid,
      status: machineStatusToLifecycle(record.status),
      startedAt: record.startedAt,
      arch: record.arch,
      displayFrontend: record.displayFrontend,
      displayBackend: record.displayBackend,
      displayPort: record.displayPort,
      displayWebSocketPort: record.displayWebSocketPort,
      qmpSocketPath: record.qmpSocketPath,
      qmpTcpPort: record.qmpTcpPort,
      logPath: record.logPath,
      exitCode: record.exitCode,
      lastError: record.lastError,
      machineMac: record.machineMac || undefined,
      clipboardBridge: record.clipboardBridge || undefined
    };
  }

  async getWebAudioState(machineId) {
    const record = this.registry.get(machineId);
    if (!record || !record.webAudioBridge) {
      return null;
    }
    return record.webAudioBridge.getState();
  }

  onWebAudioChunk(machineId, handler) {
    const record = this.registry.get(machineId);
    if (!record?.webAudioBridge || typeof handler !== 'function') {
      return () => {};
    }

    const wrapped = (chunk) => {
      handler(chunk);
    };
    record.webAudioBridge.on('chunk', wrapped);
    return () => {
      record.webAudioBridge?.off('chunk', wrapped);
    };
  }

  getWebAudioHeader(machineId) {
    const record = this.registry.get(machineId);
    if (!record?.webAudioBridge) {
      return null;
    }
    return record.webAudioBridge.getStreamHeader();
  }

  async #applyClipboardBridge(record, runtimeDir) {
    await this.clipboardBootstrapService.start();
    const enabled = Boolean(record.machine?.integration?.clipboard?.enabled);
    if (!enabled) {
      if (record.clipboardBridgeService) {
        await record.clipboardBridgeService.stop().catch(() => null);
      }
      record.clipboardBridgeService = null;
      record.clipboardBridge = {
        enabled: false,
        active: false,
        connected: false,
        status: 'idle',
        textOnly: true,
        bootstrapPort: DEFAULT_BOOTSTRAP_PORT,
        machineMac: record.machineMac,
        pendingGuestConnection: false,
        guestToolInstalledKnown: false,
        lastError: null
      };
      return;
    }

    if (!record.clipboardBridgeService) {
      const listenPort = await allocatePort({ start: 48000, end: 48999 });
      const sessionId = `${record.machineId}-${Date.now().toString(36)}`;
      const service = new ClipboardBridgeService({
        machineId: record.machineId,
        machineMac: record.machineMac,
        sessionId,
        listenPort,
        bootstrapPort: DEFAULT_BOOTSTRAP_PORT,
        runtimeDir,
        readClipboardText: this.readClipboardText,
        writeClipboardText: this.writeClipboardText,
        onLog: (message) => {
          const activeRecord = this.registry.get(record.machineId);
          if (activeRecord?.logStream) {
            appendRuntimeLogLine(activeRecord.logStream, `[clipboard] ${message}`);
          }
        },
        onStateChange: (state) => {
          const activeRecord = this.registry.get(record.machineId);
          if (!activeRecord) {
            return;
          }
          activeRecord.clipboardBridge = state;
          this.registry.set(activeRecord);
          this.emitEvent(
            makeRuntimeEvent('machine-updated', {
              machineId: activeRecord.machineId,
              state: this.#serializeState(activeRecord)
            })
          );
        }
      });
      await service.start();
      record.clipboardBridgeService = service;
      record.clipboardBridge = service.getState();
      return;
    }

    record.clipboardBridge = record.clipboardBridgeService.getState();
  }

  async #applyWebAudioBridge(record, runtimeDir) {
    if (!record.qmpClient) {
      return;
    }

    const configuredAudioBackend = record.machine?.advanced?.audio_backend;
    if (configuredAudioBackend === 'none' || configuredAudioBackend === 'spice') {
      if (record.logStream) {
        appendRuntimeLogLine(
          record.logStream,
          `[web-audio] skipped: audio backend ${configuredAudioBackend} does not expose audiodev=audio0`
        );
      }
      return;
    }

    if (!record.webAudioBridge) {
      record.webAudioBridge = new WebAudioBridge({
        machineId: record.machineId,
        runtimeDir,
        log: (message) => {
          const activeRecord = this.registry.get(record.machineId);
          if (activeRecord?.logStream) {
            appendRuntimeLogLine(activeRecord.logStream, message);
          }
        }
      });
      await record.webAudioBridge.start();
    }

    try {
      if (record.logStream) {
        appendRuntimeLogLine(
          record.logStream,
          `[web-audio] enabling wavcapture on audiodev=audio0 -> ${record.webAudioBridge.captureFilePath}`
        );
      }
      await record.qmpClient.humanMonitorCommand(
        `wavcapture "${record.webAudioBridge.captureFilePath}" audio0 44100 16 2`
      );
      if (record.logStream) {
        appendRuntimeLogLine(record.logStream, '[web-audio] wavcapture enabled');
      }
    } catch (error) {
      if (record.logStream) {
        appendRuntimeLogLine(
          record.logStream,
          `[web-audio] failed to enable wavcapture: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      await record.webAudioBridge.stop().catch(() => null);
      record.webAudioBridge = null;
    }
  }

  async #stopWebAudioCapture(record) {
    if (!record?.qmpClient) {
      return;
    }

    try {
      await record.qmpClient.humanMonitorCommand('stopcapture all');
    } catch (error) {
      if (record.logStream) {
        appendRuntimeLogLine(
          record.logStream,
          `[web-audio] stopcapture failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  async #resolveMachineLaunchPaths(machine, runtimeDir, log) {
    const result = await this.pathProxyService.resolveMachinePaths({
      machine,
      runtimeDir,
      log
    });
    return result.machine || machine;
  }

  async #resolveLaunchPathForQemu(sourcePath, runtimeDir, slot, log) {
    const result = await this.pathProxyService.resolveLaunchPath({
      sourcePath,
      runtimeDir,
      slot,
      log
    });
    return result.qemuPath || sourcePath;
  }

  #buildFullQemuCommandArgs(machine, environment, buildResult) {
    const rawCustomLines = splitCustomArgs(machine?.advanced?.qemu_args || '').filter((line) => !isHostForwardExtra(line));
    const customTokenGroups = rawCustomLines.map((line, customIndex) => ({
      customIndex,
      tokens: tokenizeUserArgs(line)
    }));
    const flattenedCustomTokens = customTokenGroups.flatMap((group) =>
      group.tokens.map((token, tokenIndex) => ({
        raw: token,
        customIndex: group.customIndex,
        tokenIndex
      }))
    );

    const tokenizedCustomArgs = tokenizeUserArgs(machine?.advanced?.qemu_args || '');
    const { passthroughArgs } = splitAdvancedUserArgs(tokenizedCustomArgs);
    const customStartIndex = Math.max(0, buildResult.args.length - passthroughArgs.length);
    const items = [
      {
        id: 'binary',
        raw: buildResult.binaryPath || this.#guessQemuBinaryPath(machine, environment),
        isCustom: false,
        editable: false
      }
    ];

    let customCursor = 0;
    let generatedIndex = 0;
    while (generatedIndex < buildResult.args.length) {
      const raw = buildResult.args[generatedIndex];

      if (generatedIndex >= customStartIndex) {
        const customToken = flattenedCustomTokens[customCursor];
        items.push({
          id: `custom:${customToken?.customIndex ?? customCursor}:${customToken?.tokenIndex ?? 0}`,
          raw,
          isCustom: true,
          editable: false,
          customIndex: customToken?.customIndex ?? customCursor
        });
        customCursor += 1;
        generatedIndex += 1;
        continue;
      }

      const paired = this.#classifyGeneratedCommandPair(buildResult.args, generatedIndex);
      if (paired) {
        items.push({
          id: `generated:${generatedIndex}:flag`,
          raw: paired.flag,
          isCustom: false,
          editable: false
        });
        items.push({
          id: `generated:${generatedIndex}:value`,
          raw: paired.value,
          isCustom: false,
          editable: true,
          removable: Boolean(paired.removable),
          bindingKey: paired.bindingKey,
          editPrefix: paired.flag
        });
        generatedIndex += 2;
        continue;
      }

      const single = this.#classifyGeneratedSingleArg(buildResult.args, generatedIndex);
      if (single) {
        items.push({
          id: `generated:${generatedIndex}`,
          raw,
          isCustom: false,
          editable: Boolean(single.editable),
          removable: Boolean(single.removable),
          bindingKey: single.bindingKey,
          editPrefix: single.editPrefix
        });
        generatedIndex += 1;
        continue;
      }

      items.push({
        id: `generated:${generatedIndex}`,
        raw,
        isCustom: false,
        editable: false
      });
      generatedIndex += 1;
    }

    return items;
  }

  #classifyGeneratedCommandPair(args, index) {
    const flag = args[index];
    const value = args[index + 1];
    if (typeof value !== 'string') {
      return null;
    }

    if (flag === '-name') {
      return { flag, value, bindingKey: CONTROLLED_BINDINGS.title };
    }
    if (flag === '-machine') {
      return { flag, value, bindingKey: CONTROLLED_BINDINGS.machineType };
    }
    if (flag === '-m') {
      return { flag, value, bindingKey: CONTROLLED_BINDINGS.memory };
    }
    if (flag === '-smp') {
      return { flag, value, bindingKey: CONTROLLED_BINDINGS.cpu };
    }
    if (flag === '-accel') {
      return { flag, value, bindingKey: CONTROLLED_BINDINGS.accel };
    }
    if (flag === '-boot') {
      return { flag, value, bindingKey: CONTROLLED_BINDINGS.boot };
    }
    if (flag === '-vga') {
      return { flag, value, bindingKey: CONTROLLED_BINDINGS.gpu, removable: true };
    }
    if (flag === '-netdev' && (value.startsWith('user,') || value.startsWith('bridge,'))) {
      return { flag, value, bindingKey: CONTROLLED_BINDINGS.networkMode, removable: true };
    }
    if (flag === '-device' && value.includes('netdev=net0')) {
      return { flag, value, bindingKey: CONTROLLED_BINDINGS.networkCard, removable: true };
    }
    if (flag === '-device') {
      const device = value.split(',')[0];
      if (device === 'intel-hda' || device === 'AC97' || device === 'sb16' || device === 'virtio-sound-pci') {
        return { flag, value, bindingKey: CONTROLLED_BINDINGS.soundCard, removable: true };
      }
      if (device === 'virtio-gpu-pci' || device === 'virtio-vga') {
        return { flag, value, bindingKey: CONTROLLED_BINDINGS.gpu, removable: true };
      }
      if (device === 'usb-tablet') {
        return { flag, value, bindingKey: CONTROLLED_BINDINGS.usbTablet, removable: true };
      }
    }
    if (flag === '-usb') {
      return { flag, value, bindingKey: CONTROLLED_BINDINGS.usbTablet, removable: true };
    }

    return null;
  }

  #classifyGeneratedSingleArg(args, index) {
    const flag = args[index];

    if (flag === '-usb') {
      return {
        bindingKey: CONTROLLED_BINDINGS.usbTablet,
        removable: true,
        editable: false
      };
    }

    return null;
  }

  #guessQemuBinaryPath(machine, environment) {
    const binaryKey = resolveBinaryKey(machine?.system?.arch);
    const binaryPath = environment?.binaries?.[binaryKey]?.path;
    if (binaryPath) {
      return binaryPath;
    }
    return binaryKey ? `qemu-system-${binaryKey}` : 'qemu-system';
  }

  #resolveClipboardSessionByMac(machineMac) {
    const normalizedMac = normalizeMacAddress(machineMac);
    if (!normalizedMac) {
      return null;
    }

    for (const record of this.registry.values()) {
      if (!record?.clipboardBridgeService) {
        continue;
      }
      if (normalizeMacAddress(record.machineMac) !== normalizedMac) {
        continue;
      }

      const state = record.clipboardBridgeService.getState();
      if (!state?.enabled || !state?.active || !state?.listenPort || !state?.sessionId) {
        continue;
      }

      return {
        machineId: record.machineId,
        machineMac: normalizedMac,
        hostAddress: state.hostAddress || '10.0.2.2',
        listenPort: state.listenPort,
        sessionId: state.sessionId
      };
    }

    return null;
  }

  #listClipboardSessions() {
    return this.registry.values().map((record) => ({
      machineId: record.machineId,
      machineMac: record.machineMac || null,
      status: record.status,
      hasClipboardBridge: Boolean(record.clipboardBridgeService)
    }));
  }

  #appendBootstrapLogs(message) {
    for (const record of this.registry.values()) {
      if (!record?.logStream) {
        continue;
      }
      appendRuntimeLogLine(record.logStream, `[bootstrap] ${message}`);
    }
  }

  #stringifyMachine(machine) {
    return require('smol-toml').stringify(machine);
  }

  async #resolveMediaDeviceIds(record, drive) {
    if (drive === 'floppy') {
      return record.machine?.media?.floppy ? ['floppy-device0', 'floppy0'] : [];
    }

    const qmpClient = record.qmpClient;
    if (!qmpClient) {
      return [];
    }

    const candidates = [];
    const pushCandidate = (value) => {
      if (typeof value !== 'string' || !value.trim()) {
        return;
      }
      if (!candidates.includes(value)) {
        candidates.push(value);
      }
    };

    try {
      const devices = await qmpClient.queryBlock();
      if (Array.isArray(devices)) {
        for (const device of devices) {
          if (!device?.removable) {
            continue;
          }
          pushCandidate(device.qdev);
          pushCandidate(device.device);
          pushCandidate(device.inserted?.device);
          pushCandidate(device.inserted?.node_name);
          pushCandidate(device.inserted?.nodeName);
        }
      }
    } catch {
      // Fall back to the stable device ids assigned in the launch command.
    }

    pushCandidate('cdrom0');
    pushCandidate('cd0');
    return candidates;
  }

  async #resolveFirstExistingPath(candidates) {
    for (const candidate of candidates) {
      if (await fileExists(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  #scheduleStopEscalation(record) {
    this.#clearStopEscalation(record);
    const timer = setTimeout(() => {
      const active = this.registry.get(record.machineId);
      if (!active?.process || active.process.exitCode !== null) {
        return;
      }

      try {
        active.process.kill('SIGTERM');
      } catch {
        return;
      }

      setTimeout(() => {
        const current = this.registry.get(record.machineId);
        if (!current?.process || current.process.exitCode !== null) {
          return;
        }
        try {
          current.process.kill('SIGKILL');
        } catch {
          return;
        }
      }, 1000).unref?.();
    }, STOP_GRACE_TIMEOUT_MS);
    timer.unref?.();
    record.stopEscalationTimer = timer;
  }

  #clearStopEscalation(record) {
    if (record?.stopEscalationTimer) {
      clearTimeout(record.stopEscalationTimer);
      record.stopEscalationTimer = null;
    }
  }

  async #waitForMachineExit(machineId, timeoutMs) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      if (!this.registry.get(machineId)) {
        return true;
      }
      await wait(100);
    }
    return false;
  }
}

module.exports = {
  RuntimeManager,
  normalizeBundlePath,
  parseMachineConfig,
  allocatePort,
  pickPreferredStartupError,
  shellQuote
};
