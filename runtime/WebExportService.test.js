import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { stringify as stringifyToml } from 'smol-toml';
import { WebExportService } from './WebExportService';
import { WebWorkspaceService } from './WebWorkspaceService';

const roots = [];

afterEach(async () => {
  while (roots.length) await fs.rm(roots.pop(), { recursive: true, force: true });
});

describe('WebExportService', () => {
  it('creates a controlled ZIP download without accepting a host target directory', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sanaka-web-export-'));
    roots.push(root);
    const bundlePath = path.join(root, 'Machine.saka');
    const outputDirectory = path.join(root, 'exports');
    await fs.mkdir(path.join(bundlePath, 'Disks'), { recursive: true });
    await fs.writeFile(path.join(bundlePath, 'Disks', 'disk.img'), 'disk');
    await fs.writeFile(path.join(bundlePath, 'machine.svm'), stringifyToml({
      format_version: 1,
      kind: 'machine',
      id: 'machine-1',
      title: 'Machine',
      media: { iso: '', floppy: '' },
      disks: [{ id: 'disk-1', path: 'Disks/disk.img', storage_mode: 'managed', interface: 'virtio', boot: true }]
    }), 'utf8');
    const workspace = new WebWorkspaceService();
    const machineRef = workspace.registerMachinePath(bundlePath);
    let resolveCompleted;
    const completed = new Promise((resolve) => { resolveCompleted = resolve; });
    const emitProgress = vi.fn((payload) => {
      if (payload.phase === 'completed' || payload.phase === 'failed') resolveCompleted(payload);
    });
    const service = new WebExportService({ workspace, outputDirectory, emitProgress, platform: 'linux' });

    await service.start({ sourcePath: machineRef, name: 'Download', includeIso: false, selectedDisks: ['disk-1'] });
    const result = await completed;
    expect(result.phase).toBe('completed');
    expect(result.detail).toMatch(/^\/api\/workspace\/exports\//);
    const token = decodeURIComponent(result.detail.split('/').pop());
    const download = await service.resolveDownload(token);
    expect(download.name).toBe('Download.zip');
    expect(download.path.startsWith(outputDirectory)).toBe(true);
  });

  it('rejects attempts to include external host media or disks', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sanaka-web-export-'));
    roots.push(root);
    const bundlePath = path.join(root, 'Machine.saka');
    const outputDirectory = path.join(root, 'exports');
    const externalIso = path.join(root, 'external.iso');
    const externalDisk = path.join(root, 'external.qcow2');
    await fs.mkdir(path.join(bundlePath, 'Disks'), { recursive: true });
    await fs.writeFile(externalIso, 'iso');
    await fs.writeFile(externalDisk, 'disk');
    await fs.writeFile(path.join(bundlePath, 'machine.svm'), stringifyToml({
      format_version: 1,
      kind: 'machine',
      id: 'machine-1',
      title: 'Machine',
      media: { iso: externalIso, floppy: '' },
      disks: [{ id: 'disk-external', path: externalDisk, storage_mode: 'external', interface: 'virtio', boot: true }]
    }), 'utf8');
    const workspace = new WebWorkspaceService();
    const machineRef = workspace.registerMachinePath(bundlePath);
    const service = new WebExportService({ workspace, outputDirectory, platform: 'linux' });

    await expect(service.start({
      sourcePath: machineRef,
      name: 'Leaked ISO',
      includeIso: true,
      selectedDisks: []
    })).rejects.toMatchObject({ code: 'EXTERNAL_RESOURCE_DENIED' });
    await expect(service.start({
      sourcePath: machineRef,
      name: 'Leaked disk',
      includeIso: false,
      selectedDisks: ['disk-external']
    })).rejects.toMatchObject({ code: 'EXTERNAL_RESOURCE_DENIED' });
  });
});
