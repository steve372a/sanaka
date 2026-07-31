const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const QEMU_SYSTEM_BINARY_PATTERN = /^qemu-system-([a-z0-9_+-]+)(?:\.exe)?$/i;
const ALWAYS_SKIPPED_NAMES = new Set([
  '.git',
  '.hg',
  '.svn',
  '.Trash',
  '.Trashes',
  '$RECYCLE.BIN',
  'node_modules',
  'System Volume Information'
]);

function normalizeKey(value, platform) {
  const resolved = path.resolve(value);
  return platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function inferInstallRoot(binaryDirectory) {
  return path.basename(binaryDirectory).toLowerCase() === 'bin'
    ? path.dirname(binaryDirectory)
    : binaryDirectory;
}

function shouldSkipDirectory(directoryPath, name, platform) {
  if (ALWAYS_SKIPPED_NAMES.has(name)) return true;
  const normalized = directoryPath.replace(/\\/g, '/');
  if (platform === 'linux') {
    return normalized === '/dev' || normalized === '/proc' || normalized === '/run' || normalized === '/sys';
  }
  if (platform === 'darwin') {
    return normalized === '/dev' || normalized === '/System/Volumes' || normalized === '/private/var/vm';
  }
  return false;
}

async function readVersion(binaryPath, execFileImpl) {
  try {
    const { stdout, stderr } = await execFileImpl(binaryPath, ['--version'], {
      timeout: 5000,
      windowsHide: true
    });
    return `${stdout || ''}\n${stderr || ''}`.split(/\r?\n/).find((line) => line.trim())?.trim() || null;
  } catch {
    return null;
  }
}

async function findWindowsDriveRoots(fsImpl) {
  const candidates = Array.from({ length: 26 }, (_, index) => `${String.fromCharCode(65 + index)}:\\`);
  const checks = await Promise.all(candidates.map(async (candidate) => {
    try {
      const stats = await fsImpl.stat(candidate);
      return stats.isDirectory() ? candidate : null;
    } catch {
      return null;
    }
  }));
  return checks.filter(Boolean);
}

class QemuDirectoryScanner {
  constructor(options = {}) {
    this.platform = options.platform || process.platform;
    this.fs = options.fsImpl || fs;
    this.execFileImpl = options.execFileImpl || execFileAsync;
    this.roots = Array.isArray(options.roots) ? options.roots : null;
    this.concurrency = Math.max(1, Number(options.concurrency) || 24);
    this.maxDirectories = Math.max(1, Number(options.maxDirectories) || 2000000);
    this.now = options.now || (() => Date.now());
  }

  async getRoots() {
    if (this.roots) {
      return this.roots.map((root) => path.resolve(root));
    }
    if (this.platform === 'win32') {
      return findWindowsDriveRoots(this.fs);
    }
    return [path.parse(process.cwd()).root || path.sep];
  }

  async scan(options = {}) {
    const startedAt = this.now();
    const signal = options.signal;
    const onCandidate = typeof options.onCandidate === 'function' ? options.onCandidate : null;
    const roots = await this.getRoots();
    const queue = [...roots];
    const visited = new Set();
    const candidates = new Map();
    let scannedDirectories = 0;
    let skippedDirectories = 0;
    let truncated = false;

    while (queue.length > 0 && !signal?.aborted) {
      if (scannedDirectories >= this.maxDirectories) {
        truncated = true;
        break;
      }

      const batch = queue.splice(0, this.concurrency);
      const children = await Promise.all(batch.map(async (directoryPath) => {
        const key = normalizeKey(directoryPath, this.platform);
        if (visited.has(key)) return [];
        visited.add(key);
        scannedDirectories += 1;

        let entries;
        try {
          entries = await this.fs.readdir(directoryPath, { withFileTypes: true });
        } catch {
          skippedDirectories += 1;
          return [];
        }

        const nextDirectories = [];
        for (const entry of entries) {
          if (signal?.aborted) break;
          const childPath = path.join(directoryPath, entry.name);
          if (entry.isDirectory()) {
            if (!shouldSkipDirectory(childPath, entry.name, this.platform)) {
              nextDirectories.push(childPath);
            }
            continue;
          }

          const binaryMatch = entry.name.match(QEMU_SYSTEM_BINARY_PATTERN);
          if (!binaryMatch || (!entry.isFile() && !entry.isSymbolicLink())) continue;
          const installRoot = inferInstallRoot(directoryPath);
          const candidateKey = normalizeKey(installRoot, this.platform);
          const existing = candidates.get(candidateKey) || {
            path: installRoot,
            binaryPaths: [],
            targets: new Set(),
            version: null,
            versionPromise: null
          };
          existing.binaryPaths.push(childPath);
          existing.targets.add(binaryMatch[1].toLowerCase());
          candidates.set(candidateKey, existing);

          const notifyCandidate = () => {
            if (!onCandidate || signal?.aborted) return;
            onCandidate({
              path: existing.path,
              binaryPath: existing.binaryPaths[0] || null,
              version: existing.version,
              targets: Array.from(existing.targets).sort(),
              source: 'system-scan'
            });
          };
          notifyCandidate();

          if (!existing.versionPromise) {
            existing.versionPromise = readVersion(childPath, this.execFileImpl).then((version) => {
              existing.version = version;
              notifyCandidate();
              return version;
            });
          }
        }
        return nextDirectories;
      }));

      for (const nextDirectories of children) {
        queue.push(...nextDirectories);
      }
    }

    const enrichedCandidates = await Promise.all(Array.from(candidates.values()).map(async (candidate) => {
      const preferredBinary = candidate.binaryPaths.find((binaryPath) => /qemu-system-x86_64(?:\.exe)?$/i.test(binaryPath))
        || candidate.binaryPaths[0];
      return {
        path: candidate.path,
        binaryPath: preferredBinary,
        version: signal?.aborted ? candidate.version : await candidate.versionPromise,
        targets: Array.from(candidate.targets).sort(),
        source: 'system-scan'
      };
    }));

    enrichedCandidates.sort((left, right) => left.path.localeCompare(right.path));
    return {
      candidates: enrichedCandidates,
      roots,
      scannedDirectories,
      skippedDirectories,
      elapsedMs: Math.max(0, this.now() - startedAt),
      cancelled: Boolean(signal?.aborted),
      truncated
    };
  }
}

module.exports = {
  QemuDirectoryScanner,
  QEMU_SYSTEM_BINARY_PATTERN,
  inferInstallRoot,
  shouldSkipDirectory
};
