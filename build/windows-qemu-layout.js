const fs = require('node:fs');
const path = require('node:path');

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
const WINDOWS_QEMU_REQUIRED_DIRS = ['share', 'lib'];

function makeLayout(rootDir, binDir, configuredDir) {
  return {
    configuredDir,
    rootDir: path.resolve(rootDir),
    binDir: path.resolve(binDir)
  };
}

function makeCandidateLayouts(inputDir) {
  const configuredDir = path.resolve(String(inputDir || '').trim());
  const layouts = [];

  if (path.basename(configuredDir).toLowerCase() === 'bin') {
    layouts.push(makeLayout(path.dirname(configuredDir), configuredDir, configuredDir));
  }

  layouts.push(makeLayout(configuredDir, configuredDir, configuredDir));
  layouts.push(makeLayout(configuredDir, path.join(configuredDir, 'bin'), configuredDir));

  return layouts.filter((layout, index, entries) => entries.findIndex((entry) => (
    entry.rootDir === layout.rootDir && entry.binDir === layout.binDir
  )) === index);
}

function getMissingWindowsQemuEntries(layout, existsSync = fs.existsSync) {
  const missingEntries = [];

  for (const binary of [...WINDOWS_QEMU_SYSTEM_TARGETS, ...WINDOWS_QEMU_REQUIRED_TOOLS]) {
    const source = path.join(layout.binDir, binary);
    if (!existsSync(source)) missingEntries.push(source);
  }

  for (const requiredDir of WINDOWS_QEMU_REQUIRED_DIRS) {
    const source = path.join(layout.rootDir, requiredDir);
    if (!existsSync(source)) missingEntries.push(source);
  }

  return missingEntries;
}

function resolveWindowsQemuLayout(inputDir, existsSync = fs.existsSync) {
  if (typeof inputDir !== 'string' || !inputDir.trim()) return null;

  for (const layout of makeCandidateLayouts(inputDir)) {
    if (!existsSync(layout.configuredDir)) continue;
    if (getMissingWindowsQemuEntries(layout, existsSync).length === 0) return layout;
  }

  return null;
}

function findWindowsQemuLayout(candidates, existsSync = fs.existsSync) {
  for (const candidate of candidates) {
    const layout = resolveWindowsQemuLayout(candidate, existsSync);
    if (layout) return layout;
  }
  return null;
}

module.exports = {
  WINDOWS_QEMU_SYSTEM_TARGETS,
  WINDOWS_QEMU_REQUIRED_TOOLS,
  findWindowsQemuLayout,
  getMissingWindowsQemuEntries,
  makeCandidateLayouts,
  resolveWindowsQemuLayout
};
