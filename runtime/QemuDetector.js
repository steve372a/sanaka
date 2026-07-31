const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const BINARY_CANDIDATES = {
  x86_64: 'qemu-system-x86_64',
  aarch64: 'qemu-system-aarch64',
  i386: 'qemu-system-i386',
  arm: 'qemu-system-arm',
  riscv64: 'qemu-system-riscv64',
  ppc: 'qemu-system-ppc',
  ppc64: 'qemu-system-ppc64',
  qemuImg: 'qemu-img'
};

function splitPathValue(value) {
  return String(value || '')
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getExecutableExtensions(platform, env) {
  if (platform !== 'win32') {
    return [''];
  }

  const pathext = String(env.PATHEXT || '.EXE;.CMD;.BAT;.COM');
  return pathext
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function isExecutable(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveBinary(binaryName, platform, env, searchRoots = []) {
  return resolveBinaryWithOptions(binaryName, platform, env, searchRoots, true);
}

async function resolveBinaryWithOptions(binaryName, platform, env, searchRoots = [], includeEnvPath = true) {
  if (path.isAbsolute(binaryName) || binaryName.includes(path.sep)) {
    return (await isExecutable(binaryName)) ? binaryName : null;
  }

  const searchPaths = [
    ...searchRoots.filter(Boolean),
    ...(includeEnvPath ? splitPathValue(env.PATH) : [])
  ];
  const extensions = getExecutableExtensions(platform, env);

  for (const searchPath of searchPaths) {
    for (const ext of extensions) {
      const suffix = binaryName.toLowerCase().endsWith(ext.toLowerCase()) ? '' : ext;
      const candidate = path.join(searchPath, `${binaryName}${suffix}`);
      if (await isExecutable(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

async function readVersion(commandPath, execFileImpl) {
  try {
    const { stdout, stderr } = await execFileImpl(commandPath, ['--version']);
    const output = `${stdout || ''}\n${stderr || ''}`.trim();
    return output.split(/\r?\n/).find(Boolean) || null;
  } catch {
    return null;
  }
}

function inferAccelerators(platform) {
  if (platform === 'darwin') {
    return ['hvf', 'tcg', 'mttcg'];
  }
  if (platform === 'linux') {
    return ['kvm', 'tcg', 'mttcg'];
  }
  if (platform === 'win32') {
    return ['whpx', 'tcg', 'mttcg'];
  }
  return ['tcg', 'mttcg'];
}

function makeInstallHint(platform) {
  if (platform === 'darwin') {
    return 'Use the bundled QEMU in the packaged app, or install QEMU with Homebrew: brew install qemu';
  }
  if (platform === 'linux') {
    return 'Install QEMU from your distribution packages, for example: sudo apt install qemu-system qemu-utils';
  }
  if (platform === 'win32') {
    return 'Install QEMU and ensure the qemu-system binaries are available on PATH. Sanaka also scans common Windows install folders, but you may still need to restart the app after changing PATH.';
  }
  return 'Install QEMU and ensure the qemu-system binaries are available on PATH.';
}

function pushIfString(target, value) {
  if (typeof value === 'string' && value.trim()) {
    target.push(value.trim());
  }
}

function makeWindowsSearchRoots(env = {}) {
  const roots = [];
  const programFilesRoots = [
    env.ProgramW6432,
    env['ProgramFiles(x86)'],
    env.ProgramFiles
  ].filter(Boolean);

  for (const base of programFilesRoots) {
    pushIfString(roots, path.join(base, 'qemu'));
    pushIfString(roots, path.join(base, 'qemu', 'bin'));
    pushIfString(roots, path.join(base, 'QEMU'));
    pushIfString(roots, path.join(base, 'QEMU', 'bin'));
  }

  if (env.LocalAppData) {
    pushIfString(roots, path.join(env.LocalAppData, 'Programs', 'qemu'));
    pushIfString(roots, path.join(env.LocalAppData, 'Programs', 'qemu', 'bin'));
    pushIfString(roots, path.join(env.LocalAppData, 'Programs', 'QEMU'));
    pushIfString(roots, path.join(env.LocalAppData, 'Programs', 'QEMU', 'bin'));
  }

  if (env.ChocolateyInstall) {
    pushIfString(roots, path.join(env.ChocolateyInstall, 'bin'));
    pushIfString(roots, path.join(env.ChocolateyInstall, 'lib', 'qemu'));
    pushIfString(roots, path.join(env.ChocolateyInstall, 'lib', 'qemu', 'tools'));
  }

  if (env.USERPROFILE) {
    pushIfString(roots, path.join(env.USERPROFILE, 'scoop', 'apps', 'qemu', 'current'));
    pushIfString(roots, path.join(env.USERPROFILE, 'scoop', 'apps', 'qemu', 'current', 'bin'));
  }

  pushIfString(roots, 'C:\\Program Files\\qemu');
  pushIfString(roots, 'C:\\Program Files\\qemu\\bin');
  pushIfString(roots, 'C:\\Program Files\\QEMU');
  pushIfString(roots, 'C:\\Program Files\\QEMU\\bin');
  pushIfString(roots, 'C:\\Program Files (x86)\\qemu');
  pushIfString(roots, 'C:\\Program Files (x86)\\qemu\\bin');
  pushIfString(roots, 'C:\\msys64\\mingw64\\bin');

  return roots;
}

function makePlatformSearchRoots(platform, env = {}) {
  if (platform === 'win32') {
    return makeWindowsSearchRoots(env);
  }
  return [];
}

function makeBundledSearchRoots(options = {}) {
  const roots = [];
  const resourcesPath = options.resourcesPath || process.resourcesPath;

  if (typeof resourcesPath === 'string' && resourcesPath.trim()) {
    roots.push(path.join(resourcesPath, 'qemu', 'bin'));
  }

  for (const entry of makePlatformSearchRoots(options.platform || process.platform, options.env || process.env)) {
    if (typeof entry === 'string' && entry.trim()) {
      roots.push(entry);
    }
  }

  for (const entry of options.searchRoots || []) {
    if (typeof entry === 'string' && entry.trim()) {
      roots.push(entry);
    }
  }

  return Array.from(new Set(roots.map((entry) => path.resolve(entry))));
}

function makeExternalSearchRoots(externalDir) {
  const normalized = String(externalDir || '').trim();
  if (!normalized) return [];
  const resolvedRoot = path.resolve(normalized);
  return Array.from(new Set([resolvedRoot, path.join(resolvedRoot, 'bin')]));
}

function makeEmptyBinaryMap() {
  return Object.fromEntries(
    Object.entries(BINARY_CANDIDATES).map(([key, binaryName]) => [key, {
      name: binaryName,
      found: false,
      path: null,
      version: null
    }])
  );
}

function inferEffectiveRootFromBinary(binaryPath) {
  if (!binaryPath) return null;
  const binDir = path.dirname(binaryPath);
  return path.basename(binDir).toLowerCase() === 'bin' ? path.dirname(binDir) : binDir;
}

class QemuDetector {
  constructor(options = {}) {
    this.platform = options.platform || process.platform;
    this.arch = options.arch || process.arch;
    this.env = options.env || process.env;
    this.execFileImpl = options.execFileImpl || execFileAsync;
    this.resourcesPath = options.resourcesPath || process.resourcesPath;
    this.externalDir = typeof options.externalDir === 'string' ? options.externalDir.trim() : '';
    this.searchRoots = makeBundledSearchRoots(options);
  }

  async detect() {
    if (this.externalDir) return this.detectFromExternalDir();
    const binaries = {};

    for (const [key, binaryName] of Object.entries(BINARY_CANDIDATES)) {
      const resolvedPath = await resolveBinary(binaryName, this.platform, this.env, this.searchRoots);
      binaries[key] = {
        name: binaryName,
        found: Boolean(resolvedPath),
        path: resolvedPath,
        version: resolvedPath ? await readVersion(resolvedPath, this.execFileImpl) : null
      };
    }

    const availableSystemTargets = Object.entries(binaries)
      .filter(([key, entry]) => key !== 'qemuImg' && entry.found)
      .map(([key]) => key);

    const bundledRoot = typeof this.resourcesPath === 'string' && this.resourcesPath.trim()
      ? path.resolve(path.join(this.resourcesPath, 'qemu'))
      : null;
    const firstAvailableBinary = Object.values(binaries).find((entry) => entry.found && entry.path)?.path || null;
    const effectiveRoot = inferEffectiveRootFromBinary(firstAvailableBinary);
    const source = bundledRoot && firstAvailableBinary
      && (path.resolve(firstAvailableBinary) === bundledRoot || path.resolve(firstAvailableBinary).startsWith(`${bundledRoot}${path.sep}`))
      ? 'bundled'
      : 'auto-detected';

    return {
      checkedAt: new Date().toISOString(),
      platform: this.platform,
      arch: this.arch,
      available: availableSystemTargets.length > 0,
      source,
      configuredExternalDir: '',
      effectiveRoot,
      errorCode: null,
      errorMessage: null,
      availableSystemTargets,
      accelerators: inferAccelerators(this.platform),
      installHint: makeInstallHint(this.platform),
      searchRoots: [...this.searchRoots],
      binaries
    };
  }

  async detectFromExternalDir() {
    const configuredExternalDir = path.resolve(this.externalDir);
    const searchRoots = makeExternalSearchRoots(configuredExternalDir);
    const binaries = makeEmptyBinaryMap();

    try {
      const stats = await fs.stat(configuredExternalDir);
      if (!stats.isDirectory()) {
        return this.makeExternalErrorEnvironment({
          configuredExternalDir, searchRoots, binaries,
          errorCode: 'QEMU_EXTERNAL_DIR_NOT_DIRECTORY',
          errorMessage: `Configured QEMU directory is not a folder: ${configuredExternalDir}`
        });
      }
    } catch (error) {
      return this.makeExternalErrorEnvironment({
        configuredExternalDir, searchRoots, binaries,
        errorCode: error?.code === 'ENOENT' ? 'QEMU_EXTERNAL_DIR_NOT_FOUND' : 'QEMU_EXTERNAL_DIR_UNREADABLE',
        errorMessage: error?.code === 'ENOENT'
          ? `Configured QEMU directory was not found: ${configuredExternalDir}`
          : `Configured QEMU directory could not be read: ${configuredExternalDir}`
      });
    }

    for (const [key, binaryName] of Object.entries(BINARY_CANDIDATES)) {
      const resolvedPath = await resolveBinaryWithOptions(binaryName, this.platform, this.env, searchRoots, false);
      binaries[key] = {
        name: binaryName,
        found: Boolean(resolvedPath),
        path: resolvedPath,
        version: resolvedPath ? await readVersion(resolvedPath, this.execFileImpl) : null
      };
    }

    const availableSystemTargets = Object.entries(binaries)
      .filter(([key, entry]) => key !== 'qemuImg' && entry.found)
      .map(([key]) => key);
    if (availableSystemTargets.length === 0) {
      return this.makeExternalErrorEnvironment({
        configuredExternalDir, searchRoots, binaries,
        errorCode: 'QEMU_EXTERNAL_BINARIES_MISSING',
        errorMessage: `No QEMU system binaries were found in the configured directory: ${configuredExternalDir}`
      });
    }

    return {
      checkedAt: new Date().toISOString(),
      platform: this.platform,
      arch: this.arch,
      available: true,
      source: 'external-configured',
      configuredExternalDir,
      effectiveRoot: configuredExternalDir,
      errorCode: null,
      errorMessage: null,
      availableSystemTargets,
      accelerators: inferAccelerators(this.platform),
      installHint: makeInstallHint(this.platform),
      searchRoots,
      binaries
    };
  }

  makeExternalErrorEnvironment({ configuredExternalDir, searchRoots, binaries, errorCode, errorMessage }) {
    return {
      checkedAt: new Date().toISOString(),
      platform: this.platform,
      arch: this.arch,
      available: false,
      source: 'external-configured',
      configuredExternalDir,
      effectiveRoot: configuredExternalDir,
      errorCode,
      errorMessage,
      availableSystemTargets: [],
      accelerators: inferAccelerators(this.platform),
      installHint: makeInstallHint(this.platform),
      searchRoots,
      binaries
    };
  }
}

module.exports = {
  QemuDetector,
  BINARY_CANDIDATES,
  inferAccelerators
};
