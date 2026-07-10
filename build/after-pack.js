const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const packageJson = require('../package.json');
const WINDOWS_QEMU_SYSTEM_TARGETS = [
  'qemu-system-x86_64.exe',
  'qemu-system-i386.exe',
  'qemu-system-aarch64.exe',
  'qemu-system-arm.exe',
  'qemu-system-riscv64.exe',
  'qemu-system-ppc.exe',
  'qemu-system-ppc64.exe'
];
const WINDOWS_QEMU_REQUIRED_TOOLS = ['qemu-img.exe'];

function pushIfString(target, value) {
  if (typeof value === 'string' && value.trim()) {
    target.push(value.trim());
  }
}

function resolveWindowsQemuDir(env = process.env) {
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

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function validateWindowsQemuDir(qemuDir) {
  const missingEntries = [];

  for (const binary of WINDOWS_QEMU_SYSTEM_TARGETS) {
    const source = path.join(qemuDir, binary);
    if (!fs.existsSync(source)) {
      missingEntries.push(source);
    }
  }

  for (const tool of WINDOWS_QEMU_REQUIRED_TOOLS) {
    const source = path.join(qemuDir, tool);
    if (!fs.existsSync(source)) {
      missingEntries.push(source);
    }
  }

  for (const requiredDir of ['share', 'lib']) {
    const source = path.join(qemuDir, requiredDir);
    if (!fs.existsSync(source)) {
      missingEntries.push(source);
    }
  }

  if (missingEntries.length > 0) {
    throw new Error(`[after-pack] Windows QEMU directory is incomplete: ${missingEntries.join(', ')}`);
  }
}

async function copyIfExists(sourcePath, targetPath) {
  if (!fs.existsSync(sourcePath)) {
    return;
  }
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  await fsp.cp(sourcePath, targetPath, { recursive: true, force: true });
}

async function embedWindowsQemu(context) {
  const qemuDir = resolveWindowsQemuDir(context.packager?.info?._configurationEnv || process.env);
  if (!qemuDir) {
    throw new Error('[after-pack] Windows QEMU directory was not found. Set SANAKA_QEMU_WIN_DIR or place QEMU under ~/sanaka/qemu/win.');
  }
  validateWindowsQemuDir(qemuDir);

  const resourcesDir = path.join(context.appOutDir, 'resources');
  const targetQemuDir = path.join(resourcesDir, 'qemu');

  await fsp.rm(targetQemuDir, { recursive: true, force: true });
  await fsp.mkdir(targetQemuDir, { recursive: true });

  for (const binary of WINDOWS_QEMU_SYSTEM_TARGETS) {
    const source = path.join(qemuDir, binary);
    await fsp.copyFile(source, path.join(targetQemuDir, binary));
  }

  for (const tool of WINDOWS_QEMU_REQUIRED_TOOLS) {
    const source = path.join(qemuDir, tool);
    await fsp.copyFile(source, path.join(targetQemuDir, tool));
  }

  const entries = await fsp.readdir(qemuDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const lowerName = entry.name.toLowerCase();
    if (!lowerName.endsWith('.dll') && lowerName !== 'zlib1.dll') continue;
    await fsp.copyFile(path.join(qemuDir, entry.name), path.join(targetQemuDir, entry.name));
  }

  await copyIfExists(path.join(qemuDir, 'share'), path.join(targetQemuDir, 'share'));
  await copyIfExists(path.join(qemuDir, 'lib'), path.join(targetQemuDir, 'lib'));

  await Promise.all([
    fsp.rm(path.join(targetQemuDir, 'share', 'doc'), { recursive: true, force: true }),
    fsp.rm(path.join(targetQemuDir, 'share', 'man'), { recursive: true, force: true }),
    fsp.rm(path.join(targetQemuDir, 'share', 'icons'), { recursive: true, force: true }),
    fsp.rm(path.join(targetQemuDir, 'share', 'applications'), { recursive: true, force: true })
  ]);

  console.log(`[after-pack] Embedded Windows QEMU from ${qemuDir} into ${targetQemuDir}`);
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
