import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import layoutModule from './windows-qemu-layout';

const {
  WINDOWS_QEMU_SYSTEM_TARGETS,
  WINDOWS_QEMU_REQUIRED_TOOLS,
  findWindowsQemuLayout,
  resolveWindowsQemuLayout
} = layoutModule;

function makeWindowsQemuPackage(rootDir, binariesInBin) {
  const binDir = binariesInBin ? path.join(rootDir, 'bin') : rootDir;
  fs.mkdirSync(binDir, { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'share'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'lib'), { recursive: true });

  for (const name of [...WINDOWS_QEMU_SYSTEM_TARGETS, ...WINDOWS_QEMU_REQUIRED_TOOLS]) {
    fs.writeFileSync(path.join(binDir, name), 'test');
  }

  return binDir;
}

describe('Windows QEMU package layout', () => {
  it('accepts packages whose binaries are directly in the selected root', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sanaka-qemu-win-root-'));
    makeWindowsQemuPackage(rootDir, false);

    expect(resolveWindowsQemuLayout(rootDir)).toEqual({
      configuredDir: rootDir,
      rootDir,
      binDir: rootDir
    });
  });

  it('accepts packages whose binaries are under the selected root bin directory', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sanaka-qemu-win-bin-'));
    const binDir = makeWindowsQemuPackage(rootDir, true);

    expect(resolveWindowsQemuLayout(rootDir)).toEqual({
      configuredDir: rootDir,
      rootDir,
      binDir
    });
  });

  it('accepts the bin directory itself while resolving share and lib from its parent', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sanaka-qemu-win-selected-bin-'));
    const binDir = makeWindowsQemuPackage(rootDir, true);

    expect(resolveWindowsQemuLayout(binDir)).toEqual({
      configuredDir: binDir,
      rootDir,
      binDir
    });
  });

  it('skips an incomplete existing candidate and uses the next complete package', () => {
    const incompleteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sanaka-qemu-win-incomplete-'));
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sanaka-qemu-win-complete-'));
    const binDir = makeWindowsQemuPackage(rootDir, true);

    expect(findWindowsQemuLayout([incompleteDir, rootDir])).toEqual({
      configuredDir: rootDir,
      rootDir,
      binDir
    });
  });
});
