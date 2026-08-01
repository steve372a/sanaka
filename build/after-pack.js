const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const packageJson = require('../package.json');
const {
  WINDOWS_QEMU_SYSTEM_TARGETS,
  WINDOWS_QEMU_REQUIRED_TOOLS,
  findWindowsQemuLayout
} = require('./windows-qemu-layout');

function pushIfString(target, value) {
  if (typeof value === 'string' && value.trim()) {
    target.push(value.trim());
  }
}

function makeWindowsQemuCandidates(env = process.env) {
  const candidates = [];
  pushIfString(candidates, env.SANAKA_QEMU_WIN_DIR);
  pushIfString(candidates, env.SANAKA_QEMU_DIR);
  pushIfString(candidates, path.join(env.HOME || '', 'sanaka', 'qemu', 'win'));
  pushIfString(candidates, path.join(env.USERPROFILE || '', 'sanaka', 'qemu', 'win'));

  const programFilesRoots = [
    env.ProgramW6432,
    env['ProgramFiles(x86)'],
    env.ProgramFiles
  ].filter(Boolean);

  for (const base of programFilesRoots) {
    pushIfString(candidates, path.join(base, 'qemu'));
    pushIfString(candidates, path.join(base, 'QEMU'));
  }

  if (env.LocalAppData) {
    pushIfString(candidates, path.join(env.LocalAppData, 'Programs', 'qemu'));
    pushIfString(candidates, path.join(env.LocalAppData, 'Programs', 'QEMU'));
  }

  if (env.ChocolateyInstall) {
    pushIfString(candidates, path.join(env.ChocolateyInstall, 'lib', 'qemu', 'tools'));
    pushIfString(candidates, path.join(env.ChocolateyInstall, 'lib', 'qemu'));
  }

  if (env.USERPROFILE) {
    pushIfString(candidates, path.join(env.USERPROFILE, 'scoop', 'apps', 'qemu', 'current'));
  }

  pushIfString(candidates, 'C:\\Program Files\\qemu');
  pushIfString(candidates, 'C:\\Program Files\\QEMU');

  return candidates;
}

async function copyIfExists(sourcePath, targetPath) {
  if (!fs.existsSync(sourcePath)) {
    return;
  }
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  await fsp.cp(sourcePath, targetPath, { recursive: true, force: true });
}

async function embedWindowsQemu(context) {
  const candidates = makeWindowsQemuCandidates(context.packager?.info?._configurationEnv || process.env);
  const qemuLayout = findWindowsQemuLayout(candidates);
  if (!qemuLayout) {
    throw new Error('[after-pack] A complete Windows QEMU directory was not found. The selected directory may contain binaries directly or under bin/.');
  }
  const { rootDir: qemuRootDir, binDir: qemuBinDir } = qemuLayout;

  const resourcesDir = path.join(context.appOutDir, 'resources');
  const targetQemuRootDir = path.join(resourcesDir, 'qemu');
  const targetQemuDir = path.join(targetQemuRootDir, 'bin');

  await fsp.rm(targetQemuRootDir, { recursive: true, force: true });
  await fsp.mkdir(targetQemuDir, { recursive: true });

  for (const binary of WINDOWS_QEMU_SYSTEM_TARGETS) {
    const source = path.join(qemuBinDir, binary);
    await fsp.copyFile(source, path.join(targetQemuDir, binary));
  }

  for (const tool of WINDOWS_QEMU_REQUIRED_TOOLS) {
    const source = path.join(qemuBinDir, tool);
    await fsp.copyFile(source, path.join(targetQemuDir, tool));
  }

  const entries = await fsp.readdir(qemuBinDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const lowerName = entry.name.toLowerCase();
    if (!lowerName.endsWith('.dll') && lowerName !== 'zlib1.dll') continue;
    await fsp.copyFile(path.join(qemuBinDir, entry.name), path.join(targetQemuDir, entry.name));
  }

  await copyIfExists(path.join(qemuRootDir, 'share'), path.join(targetQemuRootDir, 'share'));
  await copyIfExists(path.join(qemuRootDir, 'lib'), path.join(targetQemuRootDir, 'lib'));

  await Promise.all([
    fsp.rm(path.join(targetQemuRootDir, 'share', 'doc'), { recursive: true, force: true }),
    fsp.rm(path.join(targetQemuRootDir, 'share', 'man'), { recursive: true, force: true }),
    fsp.rm(path.join(targetQemuRootDir, 'share', 'icons'), { recursive: true, force: true }),
    fsp.rm(path.join(targetQemuRootDir, 'share', 'applications'), { recursive: true, force: true })
  ]);

  console.log(`[after-pack] Embedded Windows QEMU from ${qemuRootDir} (binaries: ${qemuBinDir}) into ${targetQemuRootDir}`);
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName === 'win32') {
    await embedWindowsQemu(context);
    return;
  }

  if (context.electronPlatformName !== 'darwin') {
    return;
  }

  const plistPath = path.join(context.appOutDir, 'Sanaka.app', 'Contents', 'Info.plist');
  const packageVersion = String(packageJson.version || '0.0.0').trim();
  const bundleVersion = packageVersion.replace(/-.*$/, '') || packageVersion;

  const setPlistValue = (key, type, value) => {
    try {
      execFileSync('/usr/libexec/PlistBuddy', ['-c', `Set :${key} ${value}`, plistPath]);
    } catch {
      execFileSync('/usr/libexec/PlistBuddy', ['-c', `Add :${key} ${type} ${value}`, plistPath]);
    }
  };

  const setDocumentTypeValue = (index, key, type, value) => {
    const plistKey = `CFBundleDocumentTypes:${index}:${key}`;
    try {
      execFileSync('/usr/libexec/PlistBuddy', ['-c', `Set :${plistKey} ${value}`, plistPath]);
    } catch {
      execFileSync('/usr/libexec/PlistBuddy', ['-c', `Add :${plistKey} ${type} ${value}`, plistPath]);
    }
  };

  setPlistValue('CFBundleShortVersionString', 'string', packageVersion);
  setPlistValue('CFBundleVersion', 'string', bundleVersion);
  setPlistValue('NSHumanReadableCopyright', 'string', 'Copyright © 2026 Sanakaprix');
  setDocumentTypeValue(0, 'LSTypeIsPackage', 'bool', 'true');
}
