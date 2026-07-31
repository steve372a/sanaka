const fs = require('fs/promises');
const path = require('path');
const { createHash, randomUUID } = require('crypto');
const { parse: parseToml, stringify: stringifyToml } = require('smol-toml');

const MACHINE_CONFIG_FILE = 'machine.svm';
const MACHINE_PREVIEW_FILE = 'preview.png';
const SANDBOX_DIRECTORIES = new Set(['Disks', 'Media']);
const MACHINE_REF_PREFIX = 'web-machine:';
const EXTERNAL_REF_PREFIX = 'web-external:';

class WebWorkspaceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'WebWorkspaceError';
    this.code = code;
  }
}

function isPathInside(rootPath, targetPath) {
  const relative = path.relative(rootPath, targetPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function pathsEqual(left, right) {
  const normalizedLeft = path.resolve(left);
  const normalizedRight = path.resolve(right);
  return process.platform === 'win32'
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

function normalizeRelativePath(value) {
  if (typeof value !== 'string') {
    throw new WebWorkspaceError('INVALID_PATH', 'The requested path is invalid.');
  }
  if (value.includes('\0')) {
    throw new WebWorkspaceError('INVALID_PATH', 'The requested path is invalid.');
  }
  const normalizedInput = value.replace(/\\/g, '/').replace(/^\.\//, '');
  if (path.posix.isAbsolute(normalizedInput) || /^[a-zA-Z]:\//.test(normalizedInput)) {
    throw new WebWorkspaceError('ABSOLUTE_PATH_DENIED', 'Web mode cannot access host absolute paths.');
  }
  const normalized = path.posix.normalize(normalizedInput || '.');
  if (normalized === '..' || normalized.startsWith('../')) {
    throw new WebWorkspaceError('PATH_ESCAPE_DENIED', 'The requested path is outside the machine sandbox.');
  }
  return normalized === '.' ? '' : normalized;
}

function sanitizeFileName(value) {
  const fileName = path.basename(String(value || '').trim());
  if (!fileName || fileName === '.' || fileName === '..' || /[\u0000-\u001f]/.test(fileName)) {
    throw new WebWorkspaceError('INVALID_FILE_NAME', 'The file name is invalid.');
  }
  return fileName;
}

function sanitizeMachineName(value) {
  const normalized = String(value || '')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\.+$/g, '');
  if (!normalized) throw new WebWorkspaceError('INVALID_MACHINE_NAME', 'The machine name is invalid.');
  return normalized.slice(0, 80);
}

function resolveBundlePaths(machinePath) {
  const absolutePath = path.resolve(machinePath);
  if (path.basename(absolutePath).toLowerCase() === MACHINE_CONFIG_FILE) {
    return { bundlePath: path.dirname(absolutePath), configPath: absolutePath };
  }
  return { bundlePath: absolutePath, configPath: path.join(absolutePath, MACHINE_CONFIG_FILE) };
}

function getConfiguredPaths(machine) {
  const paths = [
    { key: 'media.iso', get: () => machine.media?.iso || '', set: (value) => { machine.media.iso = value; } },
    { key: 'media.floppy', get: () => machine.media?.floppy || '', set: (value) => { machine.media.floppy = value; } },
    { key: 'sharing.hostPath', get: () => machine.sharing?.hostPath || '', set: (value) => { machine.sharing.hostPath = value; } },
    { key: 'advanced.firmware.code_path', get: () => machine.advanced?.firmware?.code_path || '', set: (value) => { machine.advanced.firmware.code_path = value; } },
    { key: 'advanced.firmware.vars_path', get: () => machine.advanced?.firmware?.vars_path || '', set: (value) => { machine.advanced.firmware.vars_path = value; } }
  ];

  for (let index = 0; index < (machine.disks || []).length; index += 1) {
    paths.push({
      key: `disks.${index}.path`,
      get: () => machine.disks[index]?.path || '',
      set: (value) => { machine.disks[index].path = value; }
    });
    paths.push({
      key: `disks.${index}.source_path`,
      get: () => machine.disks[index]?.source_path || '',
      set: (value) => { machine.disks[index].source_path = value; }
    });
  }
  return paths;
}

class WebWorkspaceService {
  constructor(options = {}) {
    this.machineByRef = new Map();
    this.refByPath = new Map();
    this.externalByRef = new Map();
    this.externalRefByField = new Map();
    this.protectedQemuArgsByMachineRef = new Map();
    this.maxUploadBytes = options.maxUploadBytes || 64 * 1024 * 1024 * 1024;
  }

  registerMachinePath(machinePath) {
    if (!machinePath || typeof machinePath !== 'string') {
      throw new WebWorkspaceError('MISSING_MACHINE', 'Missing machine reference.');
    }
    const { bundlePath } = resolveBundlePaths(machinePath);
    const pathKey = process.platform === 'win32' ? bundlePath.toLowerCase() : bundlePath;
    const existing = this.refByPath.get(pathKey);
    if (existing) return existing;

    const machineRef = `${MACHINE_REF_PREFIX}${randomUUID()}`;
    this.machineByRef.set(machineRef, bundlePath);
    this.refByPath.set(pathKey, machineRef);
    return machineRef;
  }

  resolveMachineRef(machineRef) {
    if (typeof machineRef !== 'string' || !machineRef.startsWith(MACHINE_REF_PREFIX)) {
      throw new WebWorkspaceError('HOST_PATH_DENIED', 'Web mode requires a machine sandbox reference.');
    }
    const bundlePath = this.machineByRef.get(machineRef);
    if (!bundlePath) {
      throw new WebWorkspaceError('UNKNOWN_MACHINE', 'This machine is no longer available in the web session.');
    }
    return bundlePath;
  }

  async resolveValidatedMachineRef(machineRef) {
    const { bundlePath } = await this.#resolveMachineConfig(machineRef);
    return bundlePath;
  }

  toWebRecent(entry) {
    const machineRef = this.registerMachinePath(entry.path);
    return {
      ...entry,
      path: machineRef,
      previewImageUrl: `/api/workspace/preview?machine=${encodeURIComponent(machineRef)}`
    };
  }

  toWebRecents(entries) {
    return (Array.isArray(entries) ? entries : []).filter((entry) => entry?.path).map((entry) => this.toWebRecent(entry));
  }

  toHostRecent(entry) {
    return {
      ...entry,
      path: this.resolveMachineRef(entry.path),
      previewImageUrl: undefined
    };
  }

  async readMachine(machineRef) {
    const { bundlePath, configPath } = await this.#resolveMachineConfig(machineRef);
    let content;
    try {
      content = await fs.readFile(configPath, 'utf8');
    } catch (error) {
      if (error?.code === 'ENOENT') return null;
      throw error;
    }

    const sanitized = this.#sanitizeConfig(machineRef, bundlePath, content);
    return {
      path: machineRef,
      configPath: `${machineRef}/${MACHINE_CONFIG_FILE}`,
      previewPath: `/api/workspace/preview?machine=${encodeURIComponent(machineRef)}`,
      content: sanitized.content,
      resources: sanitized.resources,
      legacySingleFile: false
    };
  }

  async saveMachine(machineRef, content) {
    const { bundlePath, configPath } = await this.#resolveMachineConfig(machineRef);
    const originalContent = await fs.readFile(configPath, 'utf8');
    this.#sanitizeConfig(machineRef, bundlePath, originalContent);
    const restoredContent = this.#restoreConfig(machineRef, bundlePath, content);
    await fs.writeFile(configPath, restoredContent, 'utf8');
    return { path: machineRef, configPath: `${machineRef}/${MACHINE_CONFIG_FILE}` };
  }

  async renameMachine(machineRef, requestedName) {
    const { bundlePath } = await this.#resolveMachineConfig(machineRef);
    const nextName = sanitizeMachineName(requestedName);
    const extension = path.extname(bundlePath).toLowerCase() === '.saka' ? '.saka' : '';
    const targetPath = path.join(path.dirname(bundlePath), `${nextName}${extension}`);
    if (targetPath !== bundlePath) {
      const exists = await fs.stat(targetPath).then(() => true).catch((error) => {
        if (error?.code === 'ENOENT') return false;
        throw error;
      });
      if (exists) throw new WebWorkspaceError('MACHINE_EXISTS', 'A machine with this name already exists.');
      await fs.rename(bundlePath, targetPath);
    }
    try {
      const { configPath } = await this.#resolveConfigInsideBundle(targetPath);
      const machine = parseToml(await fs.readFile(configPath, 'utf8'));
      machine.title = nextName;
      machine.updated_at = new Date().toISOString();
      await fs.writeFile(configPath, stringifyToml(machine), 'utf8');
    } catch (error) {
      if (targetPath !== bundlePath) await fs.rename(targetPath, bundlePath).catch(() => null);
      throw error;
    }

    const oldKey = process.platform === 'win32' ? bundlePath.toLowerCase() : bundlePath;
    const nextKey = process.platform === 'win32' ? targetPath.toLowerCase() : targetPath;
    this.refByPath.delete(oldKey);
    this.refByPath.set(nextKey, machineRef);
    this.machineByRef.set(machineRef, targetPath);
    return { machineRef, bundlePath: targetPath, title: nextName };
  }

  async duplicateMachine(machineRef, requestedName) {
    const { bundlePath: sourcePath } = await this.#resolveMachineConfig(machineRef);
    const nextName = sanitizeMachineName(requestedName);
    const extension = path.extname(sourcePath).toLowerCase() === '.saka' ? '.saka' : '';
    const targetPath = path.join(path.dirname(sourcePath), `${nextName}${extension}`);
    const exists = await fs.stat(targetPath).then(() => true).catch((error) => {
      if (error?.code === 'ENOENT') return false;
      throw error;
    });
    if (exists) throw new WebWorkspaceError('MACHINE_EXISTS', 'A machine with this name already exists.');

    await fs.cp(sourcePath, targetPath, { recursive: true, errorOnExist: true, force: false });
    try {
      const { configPath } = await this.#resolveConfigInsideBundle(targetPath);
      const machine = parseToml(await fs.readFile(configPath, 'utf8'));
      machine.id = `machine-${randomUUID()}`;
      machine.title = nextName;
      machine.updated_at = new Date().toISOString();
      await fs.writeFile(configPath, stringifyToml(machine), 'utf8');
      return {
        machineRef: this.registerMachinePath(targetPath),
        bundlePath: targetPath,
        machine
      };
    } catch (error) {
      await fs.rm(targetPath, { recursive: true, force: true }).catch(() => null);
      throw error;
    }
  }

  prepareNewMachineContent(content) {
    const machine = parseToml(content);
    if (String(machine.advanced?.qemu_args || '').trim()) {
      throw new WebWorkspaceError('CUSTOM_QEMU_ARGS_DENIED', 'Web mode cannot add custom QEMU arguments.');
    }
    for (const configuredPath of getConfiguredPaths(machine)) {
      const value = configuredPath.get();
      if (!value) continue;
      if (typeof value === 'string' && value.startsWith(EXTERNAL_REF_PREFIX)) {
        throw new WebWorkspaceError('EXTERNAL_RESOURCE_DENIED', 'Web mode cannot add host external files to a new machine.');
      }
      if (path.isAbsolute(value) || /^[a-zA-Z]:[\\/]/.test(value)) {
        throw new WebWorkspaceError('HOST_PATH_DENIED', 'Web mode cannot set host absolute paths.');
      }
      const normalized = normalizeRelativePath(value);
      if (!SANDBOX_DIRECTORIES.has(normalized.split('/')[0])) {
        throw new WebWorkspaceError('PATH_ESCAPE_DENIED', 'Machine file paths must stay inside Media or Disks.');
      }
      configuredPath.set(normalized);
    }
    return stringifyToml(machine);
  }

  prepareRuntimePreviewMachine(machine) {
    if (!machine || typeof machine !== 'object') {
      throw new WebWorkspaceError('INVALID_MACHINE', 'The machine configuration is invalid.');
    }
    const nextMachine = structuredClone(machine);
    if (String(nextMachine.advanced?.qemu_args || '').trim()) {
      throw new WebWorkspaceError('CUSTOM_QEMU_ARGS_DENIED', 'Web mode cannot preview custom QEMU arguments.');
    }

    for (const configuredPath of getConfiguredPaths(nextMachine)) {
      const value = configuredPath.get();
      if (!value) continue;
      if (typeof value === 'string' && value.startsWith(EXTERNAL_REF_PREFIX)) {
        const externalRef = value.split('/')[0];
        const resource = this.externalByRef.get(externalRef);
        if (!resource || resource.field !== configuredPath.key) {
          throw new WebWorkspaceError('EXTERNAL_RESOURCE_DENIED', 'Web mode cannot use a forged external resource.');
        }
        if (configuredPath.key === 'sharing.hostPath') {
          configuredPath.set('');
          continue;
        }
        const directory = configuredPath.key.startsWith('disks.') ? 'Disks' : 'Media';
        configuredPath.set(path.posix.join(directory, sanitizeFileName(resource.name)));
        continue;
      }
      if (path.isAbsolute(value) || /^[a-zA-Z]:[\\/]/.test(value)) {
        throw new WebWorkspaceError('HOST_PATH_DENIED', 'Web mode cannot preview host absolute paths.');
      }
      const normalized = normalizeRelativePath(value);
      if (!SANDBOX_DIRECTORIES.has(normalized.split('/')[0])) {
        throw new WebWorkspaceError('PATH_ESCAPE_DENIED', 'Machine file paths must stay inside Media or Disks.');
      }
      configuredPath.set(normalized);
    }

    return nextMachine;
  }

  sanitizeManagedDiskRequest(machineRef, request = {}) {
    const bundlePath = this.resolveMachineRef(machineRef);
    const requestedName = String(request.name || '').trim();
    if (!requestedName || requestedName.includes('/') || requestedName.includes('\\')) {
      throw new WebWorkspaceError('INVALID_FILE_NAME', 'The disk image name must be a file name.');
    }
    return {
      bundlePath,
      diskId: String(request.diskId || ''),
      name: sanitizeFileName(requestedName),
      size: request.size,
      unit: request.unit,
      format: request.format,
      options: {
        preallocate: request.options?.preallocate === true
      }
    };
  }

  async sanitizeExportRequest(machineRef, request = {}) {
    const { bundlePath, configPath } = await this.#resolveMachineConfig(machineRef);
    const machine = parseToml(await fs.readFile(configPath, 'utf8'));
    const disks = Array.isArray(machine.disks) ? machine.disks : [];
    const diskById = new Map(disks.map((disk) => [String(disk.id || ''), disk]));
    const selectedDisks = [...new Set(
      (Array.isArray(request.selectedDisks) ? request.selectedDisks : []).map((value) => String(value))
    )];

    for (const diskId of selectedDisks) {
      const disk = diskById.get(diskId);
      if (!disk) {
        throw new WebWorkspaceError('UNKNOWN_DISK', 'The selected disk is not part of this machine.');
      }
      if (!this.#isSandboxRelativePath(bundlePath, disk.path)) {
        throw new WebWorkspaceError('EXTERNAL_RESOURCE_DENIED', 'Web mode cannot export host external disks.');
      }
      await this.resolveSandboxPath(machineRef, disk.path, { mustExist: true });
    }

    let includeIso = request.includeIso === true;
    if (includeIso) {
      const isoPath = String(machine.media?.iso || '');
      if (!isoPath) {
        includeIso = false;
      } else {
        if (!this.#isSandboxRelativePath(bundlePath, isoPath)) {
          throw new WebWorkspaceError('EXTERNAL_RESOURCE_DENIED', 'Web mode cannot export host external media.');
        }
        await this.resolveSandboxPath(machineRef, isoPath, { mustExist: true });
      }
    }

    return {
      sourcePath: bundlePath,
      name: request.name,
      author: request.author,
      includeIso,
      selectedDisks,
      packAsZip: true,
      restrictToBundle: true
    };
  }

  async listFiles(machineRef, directory = '') {
    const normalizedDirectory = normalizeRelativePath(directory);
    if (normalizedDirectory && !SANDBOX_DIRECTORIES.has(normalizedDirectory.split('/')[0])) {
      throw new WebWorkspaceError('PROTECTED_PATH', 'Only machine media and disk files are available in web mode.');
    }

    if (!normalizedDirectory) {
      return {
        machineRef,
        directory: '',
        entries: await Promise.all([...SANDBOX_DIRECTORIES].map(async (name) => {
          await this.ensureSandboxDirectory(machineRef, name);
          return { name, path: name, kind: 'directory', size: 0, modifiedAt: null, exists: true };
        }))
      };
    }

    const directoryPath = SANDBOX_DIRECTORIES.has(normalizedDirectory)
      ? await this.ensureSandboxDirectory(machineRef, normalizedDirectory)
      : await this.resolveSandboxPath(machineRef, normalizedDirectory, { mustExist: true, directory: true });
    const dirents = await fs.readdir(directoryPath, { withFileTypes: true });
    const entries = [];
    for (const dirent of dirents) {
      const relativePath = path.posix.join(normalizedDirectory, dirent.name);
      try {
        const absolutePath = await this.resolveSandboxPath(machineRef, relativePath, { mustExist: true });
        const stats = await fs.stat(absolutePath);
        entries.push({
          name: dirent.name,
          path: relativePath,
          kind: stats.isDirectory() ? 'directory' : 'file',
          size: stats.isFile() ? stats.size : 0,
          modifiedAt: stats.mtime.toISOString()
        });
      } catch (error) {
        if (error?.code !== 'SYMLINK_ESCAPE_DENIED') throw error;
      }
    }
    entries.sort((left, right) => left.kind === right.kind ? left.name.localeCompare(right.name) : left.kind === 'directory' ? -1 : 1);
    return { machineRef, directory: normalizedDirectory, entries };
  }

  async resolveSandboxPath(machineRef, relativePath, options = {}) {
    const bundlePath = this.resolveMachineRef(machineRef);
    const normalized = normalizeRelativePath(relativePath);
    const topLevel = normalized.split('/')[0];
    if (!normalized || !SANDBOX_DIRECTORIES.has(topLevel)) {
      throw new WebWorkspaceError('PROTECTED_PATH', 'Only machine media and disk files are available in web mode.');
    }

    const absolutePath = path.resolve(bundlePath, ...normalized.split('/'));
    if (!isPathInside(bundlePath, absolutePath)) {
      throw new WebWorkspaceError('PATH_ESCAPE_DENIED', 'The requested path is outside the machine sandbox.');
    }

    const existingTarget = options.mustExist !== false;
    if (existingTarget) {
      const [realBundlePath, realTargetPath] = await Promise.all([fs.realpath(bundlePath), fs.realpath(absolutePath)]);
      if (!isPathInside(realBundlePath, realTargetPath)) {
        throw new WebWorkspaceError('SYMLINK_ESCAPE_DENIED', 'Symbolic links cannot leave the machine sandbox.');
      }
      if (options.directory) {
        const stats = await fs.stat(realTargetPath);
        if (!stats.isDirectory()) {
          throw new WebWorkspaceError('NOT_A_DIRECTORY', 'The requested path is not a directory.');
        }
      }
      return realTargetPath;
    }

    const parentPath = path.dirname(absolutePath);
    const [realBundlePath, realParentPath] = await Promise.all([fs.realpath(bundlePath), fs.realpath(parentPath)]);
    if (!isPathInside(realBundlePath, realParentPath)) {
      throw new WebWorkspaceError('SYMLINK_ESCAPE_DENIED', 'Symbolic links cannot leave the machine sandbox.');
    }
    return path.join(realParentPath, path.basename(absolutePath));
  }

  async ensureSandboxDirectory(machineRef, directory) {
    const normalized = normalizeRelativePath(directory);
    if (!SANDBOX_DIRECTORIES.has(normalized)) {
      throw new WebWorkspaceError('PROTECTED_PATH', 'Only top-level Media and Disks directories can be created.');
    }
    const bundlePath = this.resolveMachineRef(machineRef);
    const realBundlePath = await fs.realpath(bundlePath);
    const targetPath = path.join(realBundlePath, normalized);
    try {
      await fs.mkdir(targetPath);
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
    }
    return this.resolveSandboxPath(machineRef, normalized, { mustExist: true, directory: true });
  }

  async resolveUploadTarget(machineRef, directory, fileName) {
    const normalizedDirectory = normalizeRelativePath(directory);
    if (!normalizedDirectory || !SANDBOX_DIRECTORIES.has(normalizedDirectory.split('/')[0])) {
      throw new WebWorkspaceError('PROTECTED_PATH', 'Uploads are only allowed in Media and Disks.');
    }
    const safeName = sanitizeFileName(fileName);
    const relativePath = path.posix.join(normalizedDirectory, safeName);
    const targetPath = await this.resolveSandboxPath(machineRef, relativePath, { mustExist: false });
    return { targetPath, relativePath, fileName: safeName };
  }

  async resolvePreviewPath(machineRef) {
    const bundlePath = this.resolveMachineRef(machineRef);
    const previewPath = path.join(bundlePath, MACHINE_PREVIEW_FILE);
    const [realBundlePath, realPreviewPath] = await Promise.all([fs.realpath(bundlePath), fs.realpath(previewPath)]);
    if (!isPathInside(realBundlePath, realPreviewPath)) {
      throw new WebWorkspaceError('SYMLINK_ESCAPE_DENIED', 'Symbolic links cannot leave the machine sandbox.');
    }
    return realPreviewPath;
  }

  #sanitizeConfig(machineRef, bundlePath, content) {
    for (const [externalRef, resource] of this.externalByRef) {
      if (resource.machineRef === machineRef) this.externalByRef.delete(externalRef);
    }
    for (const fieldKey of this.externalRefByField.keys()) {
      if (fieldKey.startsWith(`${machineRef}\0`)) this.externalRefByField.delete(fieldKey);
    }
    const machine = parseToml(content);
    const protectedQemuArgs = String(machine.advanced?.qemu_args || '');
    this.protectedQemuArgsByMachineRef.set(machineRef, protectedQemuArgs);
    machine.advanced = {
      ...(machine.advanced || {}),
      qemu_args: ''
    };
    const resources = [];
    for (const configuredPath of getConfiguredPaths(machine)) {
      const value = configuredPath.get();
      if (!value || this.#isSandboxRelativePath(bundlePath, value)) continue;

      const absolutePath = path.isAbsolute(value) ? path.resolve(value) : path.resolve(bundlePath, value);
      const digest = createHash('sha256').update(`${machineRef}\0${configuredPath.key}\0${absolutePath}`).digest('hex').slice(0, 24);
      const externalRef = `${EXTERNAL_REF_PREFIX}${digest}`;
      const name = path.basename(absolutePath) || 'External file';
      this.externalByRef.set(externalRef, {
        machineRef,
        field: configuredPath.key,
        hostPath: absolutePath,
        name,
        context: configuredPath.key === 'sharing.hostPath'
          ? {
              enabled: Boolean(machine.sharing?.enabled),
              mode: machine.sharing?.mode || 'readwrite',
              shareName: machine.sharing?.shareName || 'qemu'
            }
          : null
      });
      this.externalRefByField.set(`${machineRef}\0${configuredPath.key}`, externalRef);
      configuredPath.set(`${externalRef}/${encodeURIComponent(name)}`);
      resources.push({ id: externalRef, field: configuredPath.key, name, kind: 'external', mutable: false });
    }
    return { content: stringifyToml(machine), resources };
  }

  #restoreConfig(machineRef, bundlePath, content) {
    const machine = parseToml(content);
    const submittedQemuArgs = String(machine.advanced?.qemu_args || '');
    if (submittedQemuArgs.trim()) {
      throw new WebWorkspaceError('CUSTOM_QEMU_ARGS_DENIED', 'Web mode cannot modify custom QEMU arguments.');
    }
    machine.advanced = {
      ...(machine.advanced || {}),
      qemu_args: this.protectedQemuArgsByMachineRef.get(machineRef) || ''
    };
    const seenExternalRefs = new Set();
    for (const configuredPath of getConfiguredPaths(machine)) {
      const value = configuredPath.get();
      const protectedExternalRef = this.externalRefByField.get(`${machineRef}\0${configuredPath.key}`);
      if (protectedExternalRef && (typeof value !== 'string' || !value.startsWith(`${protectedExternalRef}/`))) {
        throw new WebWorkspaceError('EXTERNAL_RESOURCE_DENIED', 'Web mode cannot modify host external files.');
      }
      if (!value) continue;
      if (value.startsWith(EXTERNAL_REF_PREFIX)) {
        const externalRef = value.split('/')[0];
        const resource = this.externalByRef.get(externalRef);
        if (!resource || resource.machineRef !== machineRef || resource.field !== configuredPath.key) {
          throw new WebWorkspaceError('EXTERNAL_RESOURCE_DENIED', 'Web mode cannot modify host external files.');
        }
        if (resource.context && (
          Boolean(machine.sharing?.enabled) !== resource.context.enabled
          || (machine.sharing?.mode || 'readwrite') !== resource.context.mode
          || (machine.sharing?.shareName || 'qemu') !== resource.context.shareName
        )) {
          throw new WebWorkspaceError('EXTERNAL_RESOURCE_DENIED', 'Web mode cannot modify host shared folders.');
        }
        seenExternalRefs.add(externalRef);
        configuredPath.set(resource.hostPath);
        continue;
      }
      if (path.isAbsolute(value) || /^[a-zA-Z]:[\\/]/.test(value)) {
        throw new WebWorkspaceError('HOST_PATH_DENIED', 'Web mode cannot set host absolute paths.');
      }
      if (!this.#isSandboxRelativePath(bundlePath, value)) {
        throw new WebWorkspaceError('PATH_ESCAPE_DENIED', 'Machine file paths must stay inside Media or Disks.');
      }
    }
    for (const [externalRef, resource] of this.externalByRef) {
      if (resource.machineRef === machineRef && !seenExternalRefs.has(externalRef)) {
        throw new WebWorkspaceError('EXTERNAL_RESOURCE_DENIED', 'Web mode cannot remove host external files.');
      }
    }
    return stringifyToml(machine);
  }

  #isSandboxRelativePath(bundlePath, value) {
    if (!value || path.isAbsolute(value) || /^[a-zA-Z]:[\\/]/.test(value)) return false;
    let normalized;
    try {
      normalized = normalizeRelativePath(value);
    } catch {
      return false;
    }
    const topLevel = normalized.split('/')[0];
    if (!SANDBOX_DIRECTORIES.has(topLevel)) return false;
    return isPathInside(bundlePath, path.resolve(bundlePath, ...normalized.split('/')));
  }

  async #resolveMachineConfig(machineRef) {
    return this.#resolveConfigInsideBundle(this.resolveMachineRef(machineRef));
  }

  async #resolveConfigInsideBundle(bundlePath) {
    const bundleStats = await fs.lstat(bundlePath);
    if (bundleStats.isSymbolicLink()) {
      throw new WebWorkspaceError('SYMLINK_ESCAPE_DENIED', 'The registered machine bundle cannot be a symbolic link.');
    }
    if (!bundleStats.isDirectory()) {
      throw new WebWorkspaceError('INVALID_MACHINE', 'The registered machine bundle is not a directory.');
    }
    const configPath = path.join(bundlePath, MACHINE_CONFIG_FILE);
    const configStats = await fs.lstat(configPath);
    if (configStats.isSymbolicLink()) {
      throw new WebWorkspaceError('SYMLINK_ESCAPE_DENIED', 'The machine configuration cannot be a symbolic link.');
    }
    if (!configStats.isFile()) {
      throw new WebWorkspaceError('INVALID_MACHINE', 'The machine configuration is not a file.');
    }

    const [realBundlePath, realConfigPath] = await Promise.all([
      fs.realpath(bundlePath),
      fs.realpath(configPath)
    ]);
    const expectedConfigPath = path.join(realBundlePath, MACHINE_CONFIG_FILE);
    if (!isPathInside(realBundlePath, realConfigPath) || !pathsEqual(realConfigPath, expectedConfigPath)) {
      throw new WebWorkspaceError('SYMLINK_ESCAPE_DENIED', 'The machine configuration is outside the registered bundle.');
    }
    return { bundlePath, configPath: realConfigPath };
  }
}

module.exports = {
  EXTERNAL_REF_PREFIX,
  MACHINE_REF_PREFIX,
  SANDBOX_DIRECTORIES,
  WebWorkspaceError,
  WebWorkspaceService,
  normalizeRelativePath
};
