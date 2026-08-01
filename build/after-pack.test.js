import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import afterPackModule from './after-pack';
import layoutModule from './windows-qemu-layout';

const { embedWindowsQemu } = afterPackModule;
const { WINDOWS_QEMU_REQUIRED_TOOLS, WINDOWS_QEMU_SYSTEM_TARGETS } = layoutModule;

describe('Windows afterPack QEMU embedding', () => {
  it('places BIOS data below resources/qemu/share/qemu', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sanaka-after-pack-win-'));
    const sourceRoot = path.join(tempRoot, 'source');
    const appOutDir = path.join(tempRoot, 'app');

    fs.mkdirSync(path.join(sourceRoot, 'share'), { recursive: true });
    fs.mkdirSync(path.join(sourceRoot, 'lib'), { recursive: true });
    fs.writeFileSync(path.join(sourceRoot, 'share', 'bios-256k.bin'), 'bios');
    for (const name of [...WINDOWS_QEMU_SYSTEM_TARGETS, ...WINDOWS_QEMU_REQUIRED_TOOLS]) {
      fs.writeFileSync(path.join(sourceRoot, name), 'binary');
    }

    await embedWindowsQemu({
      appOutDir,
      packager: {
        info: {
          _configurationEnv: { SANAKA_QEMU_WIN_DIR: sourceRoot }
        }
      }
    });

    expect(fs.existsSync(path.join(appOutDir, 'resources', 'qemu', 'share', 'qemu', 'bios-256k.bin'))).toBe(true);
    expect(fs.existsSync(path.join(appOutDir, 'resources', 'qemu', 'share', 'bios-256k.bin'))).toBe(false);
  });
});
