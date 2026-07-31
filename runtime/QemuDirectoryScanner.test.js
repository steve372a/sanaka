import path from 'path';
import { describe, expect, it, vi } from 'vitest';
import scannerModule from './QemuDirectoryScanner';

const { QemuDirectoryScanner, inferInstallRoot } = scannerModule;

function directoryEntry(name, type) {
  return {
    name,
    isDirectory: () => type === 'directory',
    isFile: () => type === 'file',
    isSymbolicLink: () => type === 'symlink'
  };
}

describe('QemuDirectoryScanner', () => {
  it('finds and deduplicates QEMU roots while skipping unreadable directories', async () => {
    const root = path.resolve('/scan-root');
    const qemuBin = path.join(root, 'tools', 'qemu', 'bin');
    const tree = new Map([
      [root, [directoryEntry('tools', 'directory'), directoryEntry('private', 'directory')]],
      [path.join(root, 'tools'), [directoryEntry('qemu', 'directory')]],
      [path.join(root, 'tools', 'qemu'), [directoryEntry('bin', 'directory')]],
      [qemuBin, [
        directoryEntry('qemu-system-x86_64', 'file'),
        directoryEntry('qemu-system-aarch64', 'symlink')
      ]]
    ]);
    const fsImpl = {
      readdir: vi.fn(async (directoryPath) => {
        if (!tree.has(directoryPath)) throw Object.assign(new Error('denied'), { code: 'EACCES' });
        return tree.get(directoryPath);
      })
    };
    const execFileImpl = vi.fn(async () => ({ stdout: 'QEMU emulator version 11.0.1\n', stderr: '' }));
    const scanner = new QemuDirectoryScanner({ roots: [root], fsImpl, execFileImpl, concurrency: 2 });
    const onCandidate = vi.fn();

    const result = await scanner.scan({ onCandidate });

    expect(result.candidates).toEqual([
      expect.objectContaining({
        path: path.join(root, 'tools', 'qemu'),
        version: 'QEMU emulator version 11.0.1',
        targets: ['aarch64', 'x86_64']
      })
    ]);
    expect(result.skippedDirectories).toBe(1);
    expect(execFileImpl).toHaveBeenCalledTimes(1);
    expect(onCandidate).toHaveBeenCalledWith(expect.objectContaining({
      path: path.join(root, 'tools', 'qemu'),
      version: null
    }));
    expect(onCandidate).toHaveBeenLastCalledWith(expect.objectContaining({
      version: 'QEMU emulator version 11.0.1'
    }));
  });

  it('returns partial candidates when cancelled', async () => {
    const root = path.resolve('/scan-root');
    const controller = new AbortController();
    const fsImpl = {
      readdir: vi.fn(async () => {
        controller.abort();
        return [directoryEntry('qemu-system-x86_64', 'file')];
      })
    };
    const scanner = new QemuDirectoryScanner({
      roots: [root],
      fsImpl,
      execFileImpl: vi.fn(async () => ({ stdout: 'QEMU emulator version 9.2', stderr: '' }))
    });

    const result = await scanner.scan({ signal: controller.signal });

    expect(result.cancelled).toBe(true);
    expect(result.candidates).toHaveLength(0);
  });

  it('normalizes bin folders to the install root', () => {
    expect(inferInstallRoot(path.join('/opt', 'qemu', 'bin'))).toBe(path.join('/opt', 'qemu'));
    expect(inferInstallRoot(path.join('/opt', 'qemu'))).toBe(path.join('/opt', 'qemu'));
  });
});
