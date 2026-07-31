import fsPromises from 'fs/promises';
import path from 'path';
import { describe, expect, it, vi } from 'vitest';
import { RuntimeManager, pickPreferredStartupError } from './RuntimeManager';

function createManager(overrides = {}) {
  const detector = {
    detect: vi.fn(async () => ({
      checkedAt: '2026-06-04T00:00:00.000Z',
      platform: 'darwin',
      arch: 'arm64',
      available: true,
      availableSystemTargets: ['x86_64'],
      accelerators: ['hvf', 'tcg'],
      installHint: '',
      binaries: {
        x86_64: { name: 'qemu-system-x86_64', found: true, path: '/opt/homebrew/bin/qemu-system-x86_64', version: '10.0.0' },
        aarch64: { name: 'qemu-system-aarch64', found: true, path: '/opt/homebrew/bin/qemu-system-aarch64', version: '10.0.0' },
        i386: { name: 'qemu-system-i386', found: true, path: '/opt/homebrew/bin/qemu-system-i386', version: '10.0.0' },
        arm: { name: 'qemu-system-arm', found: true, path: '/opt/homebrew/bin/qemu-system-arm', version: '10.0.0' },
        riscv64: { name: 'qemu-system-riscv64', found: true, path: '/opt/homebrew/bin/qemu-system-riscv64', version: '10.0.0' },
        ppc: { name: 'qemu-system-ppc', found: true, path: '/opt/homebrew/bin/qemu-system-ppc', version: '10.0.0' },
        ppc64: { name: 'qemu-system-ppc64', found: true, path: '/opt/homebrew/bin/qemu-system-ppc64', version: '10.0.0' },
        qemuImg: { name: 'qemu-img', found: true, path: '/opt/homebrew/bin/qemu-img', version: '10.0.0' }
      }
    }))
  };

  const registryState = new Map();
  const registry = {
    get: vi.fn((machineId) => registryState.get(machineId) || null),
    set: vi.fn((value) => {
      registryState.set(value.machineId, value);
      return value;
    }),
    delete: vi.fn((machineId) => registryState.delete(machineId)),
    values: vi.fn(() => Array.from(registryState.values()))
  };

  const manager = new RuntimeManager({
    app: {
      getPath: vi.fn(() => '/tmp/sanaka'),
      getAppPath: vi.fn(() => '/tmp/sanaka-app')
    },
    emitEvent: vi.fn(),
    detector,
    registry,
    builder: overrides.builder || { build: vi.fn() },
    pathProxyService: overrides.pathProxyService,
    isoService: overrides.isoService,
    sanakaToolsService: overrides.sanakaToolsService,
    clipboardBootstrapService: overrides.clipboardBootstrapService || {
      start: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined)
    },
    platform: overrides.platform || 'darwin',
    arch: overrides.arch || 'arm64'
  });

  return { manager, detector, registry, registryState };
}

describe('RuntimeManager', () => {
  it('prefers raw stderr when building the startup failure message', () => {
    expect(
      pickPreferredStartupError({
        stderr: 'qemu-system-x86_64: -accel kvm: invalid accelerator kvm\n',
        error: new Error('QMP connection timeout.')
      })
    ).toBe('qemu-system-x86_64: -accel kvm: invalid accelerator kvm');
  });

  it('returns a structured start error when the configured optical image is missing', async () => {
    const build = vi.fn(() => ({
      binaryPath: '/opt/homebrew/bin/qemu-system-x86_64',
      args: ['-machine', 'pc-q35-9.2'],
      accelerator: 'tcg',
      display: {
        frontend: 'sanaka',
        backend: 'vnc',
        port: 5901,
        websocketPort: 5700
      }
    }));
    const { manager } = createManager({ builder: { build } });

    const missingIsoPath = `/tmp/sanaka-missing-${Date.now()}.iso`;
    const readFileMock = vi.spyOn(fsPromises, 'readFile').mockResolvedValue(`
kind = "machine"
id = "vm-missing-iso"
title = "VM Missing ISO"

[system]
arch = "x86_64"
machine_type = "pc-q35-9.2"
accelerator = "tcg"
boot_order = "cdrom"
memory_mib = 2048
cpu_cores = 2
sound_card = "intel-hda"
uefi = false

[media]
iso = "${missingIsoPath}"
floppy = ""

[network]
enabled = false
mode = "user"
card = "e1000"

[display]
frontend = "sanaka"
gpu = "std"

[display.sanaka]
backend = "vnc"
scale_mode = "fit"
clipboard = true

[peripherals]
usb_tablet = true

[advanced]
audio_backend = "auto"
qemu_args = ""
`);

    const result = await manager.startMachine('/tmp/VMMissingIso.saka');

    expect(result).toEqual({
      ok: false,
      error: `Optical image not found: ${missingIsoPath}`,
      state: null
    });
    expect(build).not.toHaveBeenCalled();

    readFileMock.mockRestore();
  });

  it('serializes listRunningMachines results', async () => {
    const { manager, registryState } = createManager();
    registryState.set('vm-1', {
      machineId: 'vm-1',
      bundlePath: '/tmp/VM.saka',
      configPath: '/tmp/VM.saka/machine.svm',
      pid: 1234,
      status: 'running',
      startedAt: '2026-06-04T00:00:00.000Z',
      arch: 'x86_64',
      displayFrontend: 'sanaka',
      displayBackend: 'vnc',
      displayPort: 5901,
      displayWebSocketPort: 5700,
      qmpSocketPath: null,
      qmpTcpPort: 47001,
      logPath: '/tmp/runtime/qemu.log',
      exitCode: null,
      lastError: null,
      machineMac: '52:54:00:12:34:56',
      clipboardBridge: {
        enabled: true,
        active: true,
        connected: false,
        status: 'waiting',
        textOnly: true,
        listenPort: 48123,
        bootstrapPort: 7935,
        machineMac: '52:54:00:12:34:56',
        pendingGuestConnection: true,
        guestToolInstalledKnown: false,
        hostAddress: '10.0.2.2',
        lastError: null
      },
      process: { pid: 1234, kill: vi.fn() },
      qmpClient: { close: vi.fn() },
      machine: { id: 'vm-1' }
    });

    const result = await manager.listRunningMachines();

    expect(result).toEqual([
      {
        machineId: 'vm-1',
        bundlePath: '/tmp/VM.saka',
        configPath: '/tmp/VM.saka/machine.svm',
        pid: 1234,
        status: 'running',
        startedAt: '2026-06-04T00:00:00.000Z',
        arch: 'x86_64',
        displayFrontend: 'sanaka',
        displayBackend: 'vnc',
        displayPort: 5901,
        displayWebSocketPort: 5700,
        qmpSocketPath: null,
        qmpTcpPort: 47001,
        logPath: '/tmp/runtime/qemu.log',
        exitCode: null,
        lastError: null,
        machineMac: '52:54:00:12:34:56',
        clipboardBridge: {
          enabled: true,
          active: true,
          connected: false,
          status: 'waiting',
          textOnly: true,
          listenPort: 48123,
          bootstrapPort: 7935,
          machineMac: '52:54:00:12:34:56',
          pendingGuestConnection: true,
          guestToolInstalledKnown: false,
          hostAddress: '10.0.2.2',
          lastError: null
        }
      }
    ]);
    expect(result[0]).not.toHaveProperty('process');
    expect(result[0]).not.toHaveProperty('qmpClient');
  });

  it('previews the final qemu command without starting the machine', async () => {
    const build = vi.fn(() => ({
      binaryPath: '/opt/homebrew/bin/qemu-system-i386',
      args: ['-machine', 'pc-i440fx-9.2', '-accel', 'tcg'],
      accelerator: 'tcg',
      display: {
        frontend: 'sanaka',
        backend: 'vnc',
        port: 5901,
        websocketPort: 5700
      }
    }));
    const { manager } = createManager({ builder: { build } });

    const fsModule = await import('fs/promises');
    const readFileMock = vi.spyOn(fsModule.default || fsModule, 'readFile').mockResolvedValue(`
kind = "machine"
id = "vm-preview"
title = "VM Preview"

[system]
arch = "i386"
`);

    const result = await manager.previewMachineCommand('/tmp/VMPreview.saka');

    expect(result.binaryPath).toBe('/opt/homebrew/bin/qemu-system-i386');
    expect(result.args).toEqual(['-machine', 'pc-i440fx-9.2', '-accel', 'tcg']);
    expect(result.commandLine).toContain('/opt/homebrew/bin/qemu-system-i386');
    expect(result.accelerator).toBe('tcg');
    expect(build).toHaveBeenCalledTimes(1);

    readFileMock.mockRestore();
  });

  it('builds a full qemu command list with custom arg markers for display', async () => {
    const build = vi.fn(() => ({
      binaryPath: '/usr/bin/qemu-system-x86_64',
      args: ['-m', '2048', '-smp', '2', '-device', 'usb-kbd', '-serial', 'stdio'],
      accelerator: 'tcg',
      display: {
        frontend: 'sanaka',
        backend: 'vnc',
        port: 5901,
        websocketPort: 5700
      }
    }));
    const pathProxyService = {
      resolveMachinePaths: vi.fn(async ({ machine }) => ({ machine })),
      resolveLaunchPath: vi.fn()
    };
    const { manager } = createManager({
      builder: { build },
      pathProxyService
    });

    const machine = {
      id: 'vm-full-command',
      title: 'VM Full Command',
      system: {
        arch: 'x86_64',
        machine_type: 'pc-q35-9.2',
        accelerator: 'tcg',
        boot_order: 'disk',
        memory_mib: 2048,
        cpu_cores: 2,
        sound_card: 'intel-hda',
        uefi: false
      },
      media: { iso: '', floppy: '' },
      disks: [],
      network: { enabled: false, mode: 'user', card: 'rtl8139' },
      display: { frontend: 'sanaka', gpu: 'std', sanaka: { backend: 'vnc', scale_mode: 'fit', clipboard: true } },
      peripherals: { usb_tablet: true },
      advanced: { audio_backend: 'auto', qemu_args: '-device usb-kbd -serial stdio' }
    };

    const result = await manager.getFullQemuCommand(machine);

    expect(pathProxyService.resolveMachinePaths).toHaveBeenCalledTimes(1);
    expect(result.args).toEqual([
      { id: 'binary', raw: '/usr/bin/qemu-system-x86_64', isCustom: false, editable: false },
      { id: 'generated:0:flag', raw: '-m', isCustom: false, editable: false },
      {
        id: 'generated:0:value',
        raw: '2048',
        isCustom: false,
        editable: true,
        removable: false,
        bindingKey: 'system.memory_mib',
        editPrefix: '-m'
      },
      { id: 'generated:2:flag', raw: '-smp', isCustom: false, editable: false },
      {
        id: 'generated:2:value',
        raw: '2',
        isCustom: false,
        editable: true,
        removable: false,
        bindingKey: 'system.cpu_cores',
        editPrefix: '-smp'
      },
      { id: 'custom:0:0', raw: '-device', isCustom: true, editable: false, customIndex: 0 },
      { id: 'custom:0:1', raw: 'usb-kbd', isCustom: true, editable: false, customIndex: 0 },
      { id: 'custom:1:0', raw: '-serial', isCustom: true, editable: false, customIndex: 1 },
      { id: 'custom:1:1', raw: 'stdio', isCustom: true, editable: false, customIndex: 1 }
    ]);
  });

  it('can build a web-safe command preview without invoking the host path proxy', async () => {
    const build = vi.fn(() => ({
      binaryPath: '/usr/bin/qemu-system-x86_64',
      args: ['-drive', 'file=Disks/system.qcow2,format=qcow2'],
      accelerator: 'tcg',
      display: { frontend: 'sanaka', backend: 'vnc', port: 5901, websocketPort: 5700 }
    }));
    const pathProxyService = {
      resolveMachinePaths: vi.fn(async ({ machine }) => ({ machine })),
      resolveLaunchPath: vi.fn()
    };
    const { manager } = createManager({ builder: { build }, pathProxyService, platform: 'win32' });
    const machine = {
      id: 'vm-web-preview',
      title: 'Web Preview',
      system: { arch: 'x86_64', machine_type: 'pc', accelerator: 'tcg', boot_order: 'disk', memory_mib: 2048, cpu_cores: 2, sound_card: 'none', uefi: false },
      media: { iso: '', floppy: '' },
      disks: [{ id: 'disk-1', path: 'Disks/system.qcow2', storage_mode: 'managed', interface: 'virtio', boot: true }],
      network: { enabled: false, mode: 'user', card: 'rtl8139' },
      display: { frontend: 'sanaka', gpu: 'std', sanaka: { backend: 'vnc', scale_mode: 'fit', clipboard: true } },
      peripherals: { usb_tablet: true },
      advanced: { audio_backend: 'auto', qemu_args: '' }
    };

    await manager.getFullQemuCommand(machine, { resolvePaths: false });

    expect(pathProxyService.resolveMachinePaths).not.toHaveBeenCalled();
    expect(build).toHaveBeenCalledWith(expect.objectContaining({ machine }));
  });

  it('keeps untrusted machine ids inside the runtime preview directory', async () => {
    const build = vi.fn(() => ({
      binaryPath: '/usr/bin/qemu-system-x86_64',
      args: [],
      accelerator: 'tcg',
      display: { frontend: 'sanaka', backend: 'vnc', port: 5901, websocketPort: 5700 }
    }));
    const { manager } = createManager({ builder: { build } });
    const mkdir = vi.spyOn(fsPromises, 'mkdir').mockResolvedValue(undefined);
    const machine = {
      id: '../../../../outside',
      system: { arch: 'x86_64' },
      media: { iso: '', floppy: '' },
      disks: [],
      network: { enabled: false },
      display: { frontend: 'sanaka', gpu: 'std', sanaka: { backend: 'vnc' } },
      peripherals: {},
      advanced: { qemu_args: '' }
    };

    await manager.getFullQemuCommand(machine, { resolvePaths: false });

    const runtimeRoot = path.join('/tmp/sanaka', 'runtime-preview');
    const createdPath = mkdir.mock.calls[0][0];
    const relative = path.relative(runtimeRoot, createdPath);
    expect(relative).toMatch(/^machine-[a-f0-9]{16}$/);
    expect(relative.startsWith('..')).toBe(false);
    mkdir.mockRestore();
  });

  it('proxies machine file paths before building the preview command on Windows', async () => {
    const build = vi.fn(() => ({
      binaryPath: 'C:\\Program Files\\qemu\\qemu-system-x86_64.EXE',
      args: ['-drive', 'file=C:/Sanaka/runtime-preview/vm-preview/path-proxy/disk-0-dir/xp.qcow2,format=qcow2,id=drive0,if=none'],
      accelerator: 'tcg',
      display: {
        frontend: 'sanaka',
        backend: 'vnc',
        port: 5901,
        websocketPort: 5700
      }
    }));
    const pathProxyService = {
      resolveMachinePaths: vi.fn(async ({ machine }) => ({
        machine: {
          ...machine,
          disks: [{ ...machine.disks[0], path: 'C:/Sanaka/runtime-preview/vm-preview/path-proxy/disk-0-dir/xp.qcow2' }]
        }
      })),
      resolveLaunchPath: vi.fn()
    };
    const { manager } = createManager({
      builder: { build },
      platform: 'win32',
      arch: 'x64',
      pathProxyService
    });

    const readFileMock = vi.spyOn(fsPromises, 'readFile').mockResolvedValue(`
kind = "machine"
id = "vm-preview"
title = "VM Preview"

[system]
arch = "x86_64"
machine_type = "pc-i440fx-9.2"
accelerator = "tcg"
boot_order = "disk"
memory_mib = 2048
cpu_cores = 2
sound_card = "intel-hda"
uefi = false

[media]
iso = ""
floppy = ""

[[disks]]
id = "disk0"
path = "C:\\\\Downloads\\\\小叉屁\\\\xp.qcow2"
format = "qcow2"
interface = "ide"
readonly = false

[network]
enabled = false
mode = "user"
card = "rtl8139"

[display]
frontend = "sanaka"
gpu = "std"

[display.sanaka]
backend = "vnc"
scale_mode = "fit"
clipboard = true

[peripherals]
usb_tablet = true

[advanced]
audio_backend = "auto"
qemu_args = ""
`);
    const accessMock = vi.spyOn(fsPromises, 'access').mockResolvedValue(undefined);

    const result = await manager.previewMachineCommand('C:\\VMPreview.saka');

    expect(result.ok).toBeUndefined();
    expect(pathProxyService.resolveMachinePaths).toHaveBeenCalledTimes(1);
    expect(build).toHaveBeenCalledWith(expect.objectContaining({
      machine: expect.objectContaining({
        disks: [expect.objectContaining({ path: 'C:/Sanaka/runtime-preview/vm-preview/path-proxy/disk-0-dir/xp.qcow2' })]
      })
    }));

    readFileMock.mockRestore();
    accessMock.mockRestore();
  });

  it('serializes an already-running machine result', async () => {
    const { manager, registryState } = createManager();
    registryState.set('vm-2', {
      machineId: 'vm-2',
      bundlePath: '/tmp/VM2.saka',
      configPath: '/tmp/VM2.saka/machine.svm',
      pid: 2222,
      status: 'running',
      startedAt: '2026-06-04T00:00:00.000Z',
      arch: 'x86_64',
      displayFrontend: 'sanaka',
      displayBackend: 'vnc',
      displayPort: 5902,
      displayWebSocketPort: 5701,
      qmpSocketPath: null,
      qmpTcpPort: 47002,
      logPath: '/tmp/runtime/vm2.log',
      exitCode: null,
      lastError: null,
      process: { pid: 2222, kill: vi.fn() },
      qmpClient: { close: vi.fn() },
      machine: { id: 'vm-2' }
    });

    const fsModule = await import('fs/promises');
    const readFileMock = vi.spyOn(fsModule.default || fsModule, 'readFile').mockResolvedValue(`
kind = "machine"
id = "vm-2"
title = "VM 2"

[system]
arch = "x86_64"
`);

    const result = await manager.startMachine('/tmp/VM2.saka');

    expect(result.ok).toBe(true);
    expect(result.alreadyRunning).toBe(true);
    expect(result.state?.machineId).toBe('vm-2');
    expect(result.state).not.toHaveProperty('process');
    readFileMock.mockRestore();
  });

  it('resets a running machine through QMP and emits resetting state', async () => {
    const { manager, registryState } = createManager();
    const systemReset = vi.fn(async () => undefined);
    const emitEvent = vi.fn();
    manager.emitEvent = emitEvent;

    registryState.set('vm-3', {
      machineId: 'vm-3',
      bundlePath: '/tmp/VM3.saka',
      configPath: '/tmp/VM3.saka/machine.svm',
      pid: 3333,
      status: 'running',
      startedAt: '2026-06-04T00:00:00.000Z',
      arch: 'x86_64',
      displayFrontend: 'sanaka',
      displayBackend: 'vnc',
      displayPort: 5903,
      displayWebSocketPort: 5703,
      qmpSocketPath: null,
      qmpTcpPort: 47003,
      logPath: '/tmp/runtime/vm3.log',
      exitCode: null,
      lastError: null,
      process: { pid: 3333, kill: vi.fn(), exitCode: null, killed: false },
      qmpClient: { systemReset, close: vi.fn() },
      machine: { id: 'vm-3', media: {} }
    });

    const result = await manager.resetMachine('vm-3');

    expect(result.ok).toBe(true);
    expect(result.state?.status).toBe('resetting');
    expect(systemReset).toHaveBeenCalledTimes(1);
    expect(emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'machine-resetting',
        machineId: 'vm-3'
      })
    );
  });

  it('changes mounted cdrom media through QMP', async () => {
    const pathProxyService = {
      resolveMachinePaths: vi.fn(async ({ machine }) => ({ machine })),
      resolveLaunchPath: vi.fn(async () => ({
        qemuPath: 'C:/Sanaka/runtime/vm-4/path-proxy/change-media-cdrom.iso'
      }))
    };
    const { manager, registryState } = createManager({
      pathProxyService,
      platform: 'win32',
      arch: 'x64'
    });
    const queryBlock = vi.fn(async () => [
      {
        qdev: 'ide0-1-0',
        device: 'ide0-1-0',
        removable: true
      }
    ]);
    const blockdevChangeMedium = vi.fn(async () => undefined);

    registryState.set('vm-4', {
      machineId: 'vm-4',
      bundlePath: '/tmp/VM4.saka',
      configPath: '/tmp/VM4.saka/machine.svm',
      pid: 4444,
      status: 'running',
      startedAt: '2026-06-04T00:00:00.000Z',
      arch: 'x86_64',
      displayFrontend: 'sanaka',
      displayBackend: 'vnc',
      displayPort: 5904,
      displayWebSocketPort: 5704,
      qmpSocketPath: null,
      qmpTcpPort: 47004,
      logPath: '/tmp/runtime/vm4.log',
      exitCode: null,
      lastError: null,
      process: { pid: 4444, kill: vi.fn(), exitCode: null, killed: false },
      qmpClient: { queryBlock, blockdevChangeMedium, close: vi.fn() },
      machine: {
        id: 'vm-4',
        media: {
          iso: '/tmp/original.iso',
          floppy: ''
        }
      }
    });

    const result = await manager.changeMedia('vm-4', '/tmp/next.iso', 'cdrom');

    expect(result.ok).toBe(true);
    expect(queryBlock).toHaveBeenCalledTimes(1);
    expect(pathProxyService.resolveLaunchPath).toHaveBeenCalledTimes(1);
    expect(blockdevChangeMedium).toHaveBeenCalledWith({
      id: 'ide0-1-0',
      filename: 'C:/Sanaka/runtime/vm-4/path-proxy/change-media-cdrom.iso',
      format: 'raw',
      readOnly: true
    });
  });

  it('falls back across multiple removable media ids until one succeeds', async () => {
    const { manager, registryState } = createManager();
    const queryBlock = vi.fn(async () => [
      {
        qdev: 'bad-target',
        device: 'ide1-cd0',
        removable: true
      }
    ]);
    const blockdevChangeMedium = vi
      .fn()
      .mockRejectedValueOnce(new Error('first target failed'))
      .mockResolvedValueOnce(undefined);

    registryState.set('vm-4b', {
      machineId: 'vm-4b',
      bundlePath: '/tmp/VM4b.saka',
      configPath: '/tmp/VM4b.saka/machine.svm',
      pid: 4445,
      status: 'running',
      startedAt: '2026-06-04T00:00:00.000Z',
      arch: 'x86_64',
      displayFrontend: 'sanaka',
      displayBackend: 'vnc',
      displayPort: 5905,
      displayWebSocketPort: 5705,
      qmpSocketPath: null,
      qmpTcpPort: 47005,
      logPath: '/tmp/runtime/vm4b.log',
      exitCode: null,
      lastError: null,
      process: { pid: 4445, kill: vi.fn(), exitCode: null, killed: false },
      qmpClient: { queryBlock, blockdevChangeMedium, close: vi.fn() },
      machine: {
        id: 'vm-4b',
        media: {
          iso: '/tmp/original.iso',
          floppy: ''
        }
      }
    });

    const result = await manager.changeMedia('vm-4b', '/tmp/next.iso', 'cdrom');

    expect(result.ok).toBe(true);
    expect(blockdevChangeMedium).toHaveBeenNthCalledWith(1, {
      id: 'bad-target',
      filename: '/tmp/next.iso',
      format: 'raw',
      readOnly: true
    });
    expect(blockdevChangeMedium).toHaveBeenNthCalledWith(2, {
      id: 'ide1-cd0',
      filename: '/tmp/next.iso',
      format: 'raw',
      readOnly: true
    });
  });

  it('mounts the bundled testnet iso from the app root when available', async () => {
    const { manager } = createManager();
    const accessSpy = vi.spyOn(fsPromises, 'access').mockImplementation(async (targetPath) => {
      if (String(targetPath) === '/tmp/sanaka-app/iso/testnet.iso') {
        return undefined;
      }
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });
    const changeMediaSpy = vi.spyOn(manager, 'changeMedia').mockResolvedValue({ ok: true, state: null });

    const result = await manager.mountBundledTestNetIso('vm-testnet');

    expect(result.ok).toBe(true);
    expect(changeMediaSpy).toHaveBeenCalledWith('vm-testnet', '/tmp/sanaka-app/iso/testnet.iso', 'cdrom');

    accessSpy.mockRestore();
  });

  it('mounts the bundled Sanaka tools iso from the app root when available', async () => {
    const { manager } = createManager({
      sanakaToolsService: {
        ensureBundledIso: vi.fn(async () => '/tmp/sanaka-app/iso/sanaka-tools.iso')
      }
    });
    const changeMediaSpy = vi.spyOn(manager, 'changeMedia').mockResolvedValue({ ok: true, state: null });

    const result = await manager.mountSanakaToolsIso('vm-tools');

    expect(result.ok).toBe(true);
    expect(changeMediaSpy).toHaveBeenCalledWith('vm-tools', '/tmp/sanaka-app/iso/sanaka-tools.iso', 'cdrom');
  });

  it('mounts the bundled Linux Sanaka tools iso from the app root when available', async () => {
    const { manager } = createManager();
    const accessSpy = vi.spyOn(fsPromises, 'access').mockImplementation(async (targetPath) => {
      if (String(targetPath) === '/tmp/sanaka-app/iso/sanaka-tools-linux.iso') {
        return undefined;
      }
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });
    const changeMediaSpy = vi.spyOn(manager, 'changeMedia').mockResolvedValue({ ok: true, state: null });

    const result = await manager.mountSanakaToolsLinuxIso('vm-tools-linux');

    expect(result.ok).toBe(true);
    expect(changeMediaSpy).toHaveBeenCalledWith('vm-tools-linux', '/tmp/sanaka-app/iso/sanaka-tools-linux.iso', 'cdrom');

    accessSpy.mockRestore();
  });

  it('waits for a stopping machine to exit before reporting already running', async () => {
    const { manager, registryState } = createManager({
      builder: {
        build: vi.fn(() => {
          throw new Error('builder should not run before stop wait finishes in this test');
        })
      }
    });
    registryState.set('vm-5', {
      machineId: 'vm-5',
      bundlePath: '/tmp/VM5.saka',
      configPath: '/tmp/VM5.saka/machine.svm',
      pid: 5555,
      status: 'stopping',
      startedAt: '2026-06-04T00:00:00.000Z',
      arch: 'x86_64',
      displayFrontend: 'sanaka',
      displayBackend: 'vnc',
      displayPort: 5905,
      displayWebSocketPort: 5705,
      qmpSocketPath: null,
      qmpTcpPort: 47005,
      logPath: '/tmp/runtime/vm5.log',
      exitCode: null,
      lastError: null,
      process: { pid: 5555, kill: vi.fn(), exitCode: null, killed: false },
      qmpClient: { close: vi.fn() },
      machine: { id: 'vm-5' }
    });

    setTimeout(() => {
      registryState.delete('vm-5');
    }, 50);

    const fsModule = await import('fs/promises');
    const readFileMock = vi.spyOn(fsModule.default || fsModule, 'readFile').mockResolvedValue(`
kind = "machine"
id = "vm-5"
title = "VM 5"

[system]
arch = "x86_64"

[display]
frontend = "sanaka"
gpu = "virtio-vga"

[display.sanaka]
backend = "vnc"
scale_mode = "fit"
clipboard = true

[network]
enabled = false
mode = "user"
card = "virtio-net-pci"

[media]
iso = ""
floppy = ""

[advanced]
audio_backend = "auto"
qemu_args = ""

[peripherals]
usb_tablet = true
`);

    await expect(manager.startMachine('/tmp/VM5.saka')).resolves.toEqual({
      ok: false,
      error: 'builder should not run before stop wait finishes in this test',
      state: null
    });
    readFileMock.mockRestore();
  });

  it('force stops a machine with SIGKILL and clears the runtime state quickly', async () => {
    const { manager, registryState } = createManager();
    const emitEvent = vi.fn();
    manager.emitEvent = emitEvent;
    const kill = vi.fn(() => true);
    const processRef = {
      pid: 6666,
      kill,
      exitCode: null,
      killed: false
    };

    registryState.set('vm-6', {
      machineId: 'vm-6',
      bundlePath: '/tmp/VM6.saka',
      configPath: '/tmp/VM6.saka/machine.svm',
      pid: 6666,
      status: 'stopping',
      startedAt: '2026-06-04T00:00:00.000Z',
      arch: 'x86_64',
      displayFrontend: 'sanaka',
      displayBackend: 'vnc',
      displayPort: 5906,
      displayWebSocketPort: 5706,
      qmpSocketPath: null,
      qmpTcpPort: 47006,
      logPath: '/tmp/runtime/vm6.log',
      exitCode: null,
      lastError: null,
      process: processRef,
      qmpClient: {
        close: vi.fn()
      },
      machine: { id: 'vm-6' }
    });

    const result = await manager.forceStopMachine('vm-6');

    expect(result.ok).toBe(true);
    expect(kill).toHaveBeenCalledWith('SIGKILL');
    expect(registryState.has('vm-6')).toBe(false);
    expect(emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'machine-stopping',
        machineId: 'vm-6'
      })
    );
    expect(emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'machine-stopped',
        machineId: 'vm-6'
      })
    );
  });

  it('does not treat a QMP shutdown event as stopped unless Sanaka is already stopping', () => {
    const { manager, registryState } = createManager();
    const emitEvent = vi.fn();
    manager.emitEvent = emitEvent;

    registryState.set('vm-7', {
      machineId: 'vm-7',
      bundlePath: '/tmp/VM7.saka',
      configPath: '/tmp/VM7.saka/machine.svm',
      pid: 7777,
      status: 'running',
      startedAt: '2026-06-04T00:00:00.000Z',
      arch: 'x86_64',
      displayFrontend: 'sanaka',
      displayBackend: 'vnc',
      displayPort: 5907,
      displayWebSocketPort: 5707,
      qmpSocketPath: null,
      qmpTcpPort: 47007,
      logPath: '/tmp/runtime/vm7.log',
      exitCode: null,
      lastError: null,
      process: { pid: 7777, kill: vi.fn(), exitCode: null, killed: false },
      qmpClient: { close: vi.fn() },
      machine: { id: 'vm-7' }
    });

    manager.handleQmpEventForTest('vm-7', { event: 'SHUTDOWN' });

    expect(registryState.get('vm-7')?.status).toBe('running');
    expect(emitEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'machine-stopping'
      })
    );
  });

  it('returns a normal start failure when command building rejects the requested accelerator', async () => {
    const { manager } = createManager({
      builder: {
        build: vi.fn(() => {
          throw new Error('Requested accelerator "kvm" is not available on darwin. Available accelerators: hvf, tcg.');
        })
      }
    });

    const fsModule = await import('fs/promises');
    const readFileMock = vi.spyOn(fsModule.default || fsModule, 'readFile').mockResolvedValue(`
kind = "machine"
id = "vm-8"
title = "VM 8"

[system]
arch = "aarch64"
accelerator = "kvm"
boot_order = "cdrom"
memory_mib = 1024
cpu_cores = 2
sound_card = "intel-hda"

[display]
frontend = "sanaka"
gpu = "virtio-vga"

[display.sanaka]
backend = "vnc"
scale_mode = "fit"
clipboard = true

[network]
enabled = false
mode = "user"
card = "virtio-net-pci"

[media]
iso = ""
floppy = ""

[advanced]
audio_backend = "auto"
qemu_args = ""

[peripherals]
usb_tablet = true
`);

    const result = await manager.startMachine('/tmp/VM8.saka');

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Requested accelerator "kvm" is not available on darwin/);
    readFileMock.mockRestore();
  });
});
