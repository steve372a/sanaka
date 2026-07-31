const fs = require('fs');
const fsPromises = require('fs/promises');
const os = require('os');
const path = require('path');
const { randomUUID } = require('crypto');
const { spawn } = require('child_process');
const { parse: parseToml, stringify: stringifyToml } = require('smol-toml');

const MACHINE_CONFIG_FILE = 'machine.svm';
const MACHINE_PREVIEW_FILE = 'preview.png';
const MACHINE_DISKS_DIRECTORY = 'Disks';
const MACHINE_MEDIA_DIRECTORY = 'Media';

class ExportCancelledError extends Error {
  constructor() {
    super('Export cancelled.');
    this.name = 'ExportCancelledError';
  }
}

function sanitizeMachineName(value, fallback = 'machine') {
  const normalized = String(value ?? '')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\.+$/g, '');

  return (normalized || fallback).slice(0, 80);
}

function buildBundleDirectoryName(machineName, platform, fallbackName = 'machine') {
  const baseName = sanitizeMachineName(machineName, fallbackName);
  return platform === 'darwin' ? `${baseName}.saka` : baseName;
}

async function pathExists(filePath) {
  try {
    await fsPromises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureUniqueOutputPath(targetDir, desiredName) {
  const parsed = path.parse(desiredName);
  const base = parsed.name || desiredName;
  const ext = parsed.ext || '';
  let candidate = path.join(targetDir, desiredName);
  let index = 2;

  while (await pathExists(candidate)) {
    candidate = path.join(targetDir, `${base} ${index}${ext}`);
    index += 1;
  }

  return candidate;
}

function isPathInside(rootPath, targetPath) {
  const relative = path.relative(rootPath, targetPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function resolveRestrictedBundleFile(bundlePath, sourcePath, allowedTopLevel) {
  const [realBundlePath, realSourcePath] = await Promise.all([
    fsPromises.realpath(bundlePath),
    fsPromises.realpath(sourcePath)
  ]);
  if (!isPathInside(realBundlePath, realSourcePath)) {
    throw new Error('Web export cannot read files outside the machine bundle.');
  }
  const relativePath = path.relative(realBundlePath, realSourcePath);
  const topLevel = relativePath.split(path.sep)[0];
  if (allowedTopLevel && topLevel !== allowedTopLevel) {
    throw new Error(`Web export can only read files from ${allowedTopLevel}.`);
  }
  const stats = await fsPromises.stat(realSourcePath);
  if (!stats.isFile()) {
    throw new Error('The selected export source is not a file.');
  }
  return realSourcePath;
}

function normalizeSourcePaths(sourcePath) {
  const absolutePath = path.resolve(sourcePath);
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

function resolveMediaPath(bundlePath, mediaPath) {
  if (!mediaPath) return null;
  return path.isAbsolute(mediaPath) ? path.resolve(mediaPath) : path.resolve(bundlePath, mediaPath);
}

function resolveDiskPath(bundlePath, disk) {
  const storageMode = disk.storage_mode || (path.isAbsolute(disk.path) ? 'external' : 'managed');
  if (storageMode === 'managed') {
    return path.resolve(bundlePath, disk.path);
  }
  return path.resolve(disk.path);
}

function makeStructuredError(error) {
  if (error instanceof ExportCancelledError) {
    return 'Export cancelled.';
  }
  if (error?.code === 'ENOENT') {
    return 'Source path does not exist or is no longer available.';
  }
  if (error?.code === 'EACCES' || error?.code === 'EPERM') {
    return 'Target directory is not writable.';
  }
  if (error?.code === 'ENOSPC') {
    return 'Not enough disk space to export the virtual machine.';
  }
  return error instanceof Error ? error.message : 'Export failed.';
}

async function movePath(sourcePath, targetPath) {
  try {
    await fsPromises.rename(sourcePath, targetPath);
  } catch (error) {
    if (error?.code !== 'EXDEV') {
      throw error;
    }
    await fsPromises.cp(sourcePath, targetPath, { recursive: true, force: true });
    await fsPromises.rm(sourcePath, { recursive: true, force: true });
  }
}

function isTaskCancelled(task) {
  if (task?.cancelled) {
    throw new ExportCancelledError();
  }
}

class ExportService {
  constructor(options = {}) {
    this.platform = options.platform || process.platform;
    this.emitProgress = options.emitProgress || (() => {});
    this.tasks = new Map();
  }

  async exportMachine(options) {
    const taskId = `export-${randomUUID()}`;
    const task = {
      id: taskId,
      cancelled: false,
      zipProcess: null
    };
    this.tasks.set(taskId, task);
    void this.#runExport(task, options);
    return taskId;
  }

  async cancelExport(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }
    task.cancelled = true;
    if (task.zipProcess && !task.zipProcess.killed) {
      try {
        task.zipProcess.kill('SIGTERM');
      } catch {
        // ignore
      }
    }
    return true;
  }

  async #runExport(task, options) {
    const startedAt = Date.now();
    const emit = (payload) => {
      const elapsedSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      this.emitProgress({
        taskId: task.id,
        estimatedSeconds: payload.percent > 0 && payload.percent < 100
          ? Math.max(0, Math.round((elapsedSeconds / payload.percent) * (100 - payload.percent)))
          : 0,
        ...payload
      });
    };

    let tempDirectory = null;

    try {
      isTaskCancelled(task);
      emit({ percent: 0, phase: 'preparing', detail: 'Preparing export task.' });

      if (!options?.sourcePath || !options?.targetDir || !options?.name) {
        throw new Error('Missing export source path, target directory, or export name.');
      }

      const { bundlePath, configPath } = normalizeSourcePaths(options.sourcePath);
      if (!(await pathExists(bundlePath)) || !(await pathExists(configPath))) {
        throw Object.assign(new Error('Source machine bundle is missing.'), { code: 'ENOENT' });
      }

      const safeConfigPath = options.restrictToBundle
        ? await resolveRestrictedBundleFile(bundlePath, configPath, null)
        : configPath;

      await fsPromises.access(options.targetDir, fs.constants.W_OK);

      const rawConfig = await fsPromises.readFile(safeConfigPath, 'utf8');
      const machine = parseToml(rawConfig);
      if (machine.kind !== 'machine') {
        throw new Error('Only machine bundles can be exported.');
      }

      tempDirectory = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'sanaka-export-'));
      const exportName = sanitizeMachineName(options.name, machine.title || 'machine');
      const tempBundleName = buildBundleDirectoryName(exportName, this.platform, machine.title || 'machine');
      const tempBundlePath = path.join(tempDirectory, tempBundleName);
      const tempDisksPath = path.join(tempBundlePath, MACHINE_DISKS_DIRECTORY);
      const tempMediaPath = path.join(tempBundlePath, MACHINE_MEDIA_DIRECTORY);

      await fsPromises.mkdir(tempBundlePath, { recursive: true });
      await fsPromises.mkdir(tempDisksPath, { recursive: true });

      const previewSourcePath = path.join(bundlePath, MACHINE_PREVIEW_FILE);
      const previewExists = await pathExists(previewSourcePath);

      const hasExplicitDiskSelection = Array.isArray(options.selectedDisks);
      const requestedDisks = hasExplicitDiskSelection ? options.selectedDisks : [];
      const selectedDiskKeys = new Set(requestedDisks.map((entry) => String(entry)));
      const selectedDisks = [];
      for (const disk of Array.isArray(machine.disks) ? machine.disks : []) {
        const absoluteDiskPath = resolveDiskPath(bundlePath, disk);
        const diskFileName = path.basename(absoluteDiskPath);
        if (
          !hasExplicitDiskSelection ||
          selectedDiskKeys.has(disk.id) ||
          selectedDiskKeys.has(disk.path) ||
          selectedDiskKeys.has(diskFileName)
        ) {
          selectedDisks.push({
            source: absoluteDiskPath,
            targetName: diskFileName,
            disk
          });
        }
      }

      let isoSourcePath = options.includeIso ? resolveMediaPath(bundlePath, machine.media?.iso || '') : null;
      if (isoSourcePath && options.restrictToBundle) {
        isoSourcePath = await resolveRestrictedBundleFile(bundlePath, isoSourcePath, MACHINE_MEDIA_DIRECTORY);
      }
      const copyItems = [];

      if (previewExists) {
        const safePreviewSourcePath = options.restrictToBundle
          ? await resolveRestrictedBundleFile(bundlePath, previewSourcePath, null)
          : previewSourcePath;
        const stats = await fsPromises.stat(safePreviewSourcePath);
        copyItems.push({
          phase: 'copying_config',
          detail: MACHINE_PREVIEW_FILE,
          source: safePreviewSourcePath,
          target: path.join(tempBundlePath, MACHINE_PREVIEW_FILE),
          size: stats.size
        });
      }

      if (isoSourcePath) {
        if (!(await pathExists(isoSourcePath))) {
          throw new Error(`ISO file not found: ${isoSourcePath}`);
        }
        await fsPromises.mkdir(tempMediaPath, { recursive: true });
        const isoStats = await fsPromises.stat(isoSourcePath);
        copyItems.push({
          phase: 'copying_iso',
          detail: path.basename(isoSourcePath),
          source: isoSourcePath,
          target: path.join(tempMediaPath, path.basename(isoSourcePath)),
          size: isoStats.size
        });
      }

      for (const item of selectedDisks) {
        if (!(await pathExists(item.source))) {
          throw new Error(`Disk image not found: ${item.source}`);
        }
        const safeDiskSource = options.restrictToBundle
          ? await resolveRestrictedBundleFile(bundlePath, item.source, MACHINE_DISKS_DIRECTORY)
          : item.source;
        const stats = await fsPromises.stat(safeDiskSource);
        copyItems.push({
          phase: 'copying_disks',
          detail: item.targetName,
          source: safeDiskSource,
          target: path.join(tempDisksPath, item.targetName),
          size: stats.size
        });
      }

      const totalBytes = copyItems.reduce((sum, item) => sum + item.size, 0) || 1;
      let copiedBytes = 0;

      const emitCopyProgress = (phase, detail, completedBytes) => {
        const percent = Math.min(90, Math.round((completedBytes / totalBytes) * 90));
        emit({
          percent,
          phase,
          detail
        });
      };

      for (const item of copyItems) {
        isTaskCancelled(task);
        await this.#copyFileWithProgress(task, item.source, item.target, (bytesWritten) => {
          emitCopyProgress(item.phase, item.detail, copiedBytes + bytesWritten);
        });
        copiedBytes += item.size;
      }

      isTaskCancelled(task);
      emit({ percent: 92, phase: 'updating_metadata', detail: 'Writing machine.svm.' });

      machine.title = exportName;
      machine.updated_at = new Date().toISOString();
      machine.author = options.author || machine.author || '';
      machine.meta = {
        ...(machine.meta || {}),
        exported_at: new Date().toISOString()
      };

      if (isoSourcePath) {
        machine.media = {
          ...(machine.media || {}),
          iso: `${MACHINE_MEDIA_DIRECTORY}/${path.basename(isoSourcePath)}`.replace(/\\/g, '/')
        };
      } else if (machine.media) {
        machine.media = {
          ...machine.media,
          iso: ''
        };
      }

      machine.disks = selectedDisks.map(({ disk, targetName }, index) => ({
        ...disk,
        path: `${MACHINE_DISKS_DIRECTORY}/${targetName}`.replace(/\\/g, '/'),
        storage_mode: 'managed',
        source_path: '',
        boot: index === 0 ? true : Boolean(disk.boot)
      }));

      await fsPromises.writeFile(path.join(tempBundlePath, MACHINE_CONFIG_FILE), stringifyToml(machine), 'utf8');

      const finalPath = options.packAsZip
        ? await ensureUniqueOutputPath(options.targetDir, `${exportName}.zip`)
        : await ensureUniqueOutputPath(options.targetDir, tempBundleName);

      if (options.packAsZip) {
        isTaskCancelled(task);
        emit({ percent: 95, phase: 'packing', detail: path.basename(finalPath) });
        await this.#zipDirectory(task, tempBundlePath, finalPath);
      } else {
        await movePath(tempBundlePath, finalPath);
      }

      emit({
        percent: 100,
        phase: 'completed',
        detail: finalPath
      });
    } catch (error) {
      emit({
        percent: 100,
        phase: 'failed',
        error: makeStructuredError(error),
        detail: error instanceof Error ? error.message : 'Export failed.'
      });
    } finally {
      if (tempDirectory) {
        await fsPromises.rm(tempDirectory, { recursive: true, force: true }).catch(() => null);
      }
      this.tasks.delete(task.id);
    }
  }

  async #copyFileWithProgress(task, sourcePath, targetPath, onProgress) {
    await fsPromises.mkdir(path.dirname(targetPath), { recursive: true });
    const stats = await fsPromises.stat(sourcePath);
    const totalBytes = stats.size || 1;

    await new Promise((resolve, reject) => {
      let completed = 0;
      const readStream = fs.createReadStream(sourcePath);
      const writeStream = fs.createWriteStream(targetPath);

      const abort = (error) => {
        readStream.destroy();
        writeStream.destroy();
        reject(error);
      };

      readStream.on('data', (chunk) => {
        if (task.cancelled) {
          abort(new ExportCancelledError());
          return;
        }
        completed += chunk.length;
        onProgress(Math.min(completed, totalBytes));
      });

      readStream.once('error', reject);
      writeStream.once('error', reject);
      writeStream.once('close', resolve);
      readStream.pipe(writeStream);
    });
  }

  async #zipDirectory(task, sourceDirectory, destinationZip) {
    const sourceParent = path.dirname(sourceDirectory);
    const sourceName = path.basename(sourceDirectory);

    await new Promise((resolve, reject) => {
      let child;

      if (this.platform === 'win32') {
        child = spawn(
          'powershell.exe',
          [
            '-NoProfile',
            '-Command',
            `Compress-Archive -Path '${sourceDirectory.replace(/'/g, "''")}' -DestinationPath '${destinationZip.replace(/'/g, "''")}' -Force`
          ],
          { stdio: 'ignore' }
        );
      } else if (this.platform === 'darwin') {
        child = spawn('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', sourceDirectory, destinationZip], {
          stdio: 'ignore'
        });
      } else {
        child = spawn(
          'python3',
          [
            '-c',
            [
              'import os, sys, zipfile',
              'source_parent, source_name, destination = sys.argv[1:4]',
              'source_dir = os.path.join(source_parent, source_name)',
              'with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED) as archive:',
              '    for root, _, files in os.walk(source_dir):',
              '        for name in files:',
              '            full = os.path.join(root, name)',
              '            rel = os.path.relpath(full, source_parent)',
              '            archive.write(full, rel)'
            ].join('\n'),
            sourceParent,
            sourceName,
            destinationZip
          ],
          { stdio: 'ignore' }
        );
      }

      task.zipProcess = child;

      child.once('error', reject);
      child.once('exit', (code) => {
        task.zipProcess = null;
        if (task.cancelled) {
          reject(new ExportCancelledError());
          return;
        }
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(`Failed to create ZIP archive. Exit code: ${code}`));
      });
    });
  }
}

module.exports = {
  ExportService
};
