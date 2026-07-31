import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import { WebWorkspaceService } from './WebWorkspaceService';

const tempDirectories = [];

async function createMachine() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sanaka-web-workspace-'));
  tempDirectories.push(root);
  const bundlePath = path.join(root, 'Machine.saka');
  await fs.mkdir(path.join(bundlePath, 'Media'), { recursive: true });
  await fs.mkdir(path.join(bundlePath, 'Disks'), { recursive: true });
  const externalIso = path.join(root, 'outside.iso');
  await fs.writeFile(externalIso, 'iso');
  const machine = {
    format_version: 1,
    kind: 'machine',
    id: 'machine-1',
    title: 'Machine',
    media: { iso: externalIso, floppy: '' },
    sharing: { enabled: false, hostPath: '', mode: 'readwrite', shareName: 'qemu' },
    advanced: { audio_backend: 'auto', qemu_args: '' },
    disks: [{ id: 'disk-1', path: 'Disks/system.qcow2', source_path: '', storage_mode: 'managed' }]
  };
  await fs.writeFile(path.join(bundlePath, 'machine.svm'), stringifyToml(machine), 'utf8');
  await fs.writeFile(path.join(bundlePath, 'Disks', 'system.qcow2'), 'disk');
  return { root, bundlePath, externalIso };
}

afterEach(async () => {
  while (tempDirectories.length) {
    await fs.rm(tempDirectories.pop(), { recursive: true, force: true });
  }
});

describe('WebWorkspaceService', () => {
  it('replaces host machine and external file paths with opaque web references', async () => {
    const { bundlePath, externalIso } = await createMachine();
    const service = new WebWorkspaceService();
    const machineRef = service.registerMachinePath(bundlePath);

    expect(machineRef).toMatch(/^web-machine:/);
    expect(machineRef).not.toContain(bundlePath);

    const opened = await service.readMachine(machineRef);
    const machine = parseToml(opened.content);
    expect(opened.path).toBe(machineRef);
    expect(opened.content).not.toContain(externalIso);
    expect(machine.media.iso).toMatch(/^web-external:/);
    expect(opened.resources).toEqual([
      expect.objectContaining({ name: 'outside.iso', kind: 'external', mutable: false })
    ]);
  });

  it('does not allow an external resource reference to be copied into a new machine', async () => {
    const { bundlePath } = await createMachine();
    const service = new WebWorkspaceService();
    const machineRef = service.registerMachinePath(bundlePath);
    const opened = await service.readMachine(machineRef);

    expect(() => service.prepareNewMachineContent(opened.content)).toThrowError(
      expect.objectContaining({ code: 'EXTERNAL_RESOURCE_DENIED' })
    );
  });

  it('restores unchanged external references while saving ordinary config edits', async () => {
    const { bundlePath, externalIso } = await createMachine();
    const service = new WebWorkspaceService();
    const machineRef = service.registerMachinePath(bundlePath);
    const opened = await service.readMachine(machineRef);
    const machine = parseToml(opened.content);
    machine.title = 'Renamed';

    await service.saveMachine(machineRef, stringifyToml(machine));

    const saved = parseToml(await fs.readFile(path.join(bundlePath, 'machine.svm'), 'utf8'));
    expect(saved.title).toBe('Renamed');
    expect(saved.media.iso).toBe(externalIso);
  });

  it('hides and preserves existing custom QEMU arguments while rejecting web changes', async () => {
    const { bundlePath } = await createMachine();
    const configPath = path.join(bundlePath, 'machine.svm');
    const original = parseToml(await fs.readFile(configPath, 'utf8'));
    original.advanced.qemu_args = '-drive file=/host/secret.img -plugin /host/plugin.so';
    await fs.writeFile(configPath, stringifyToml(original), 'utf8');

    const service = new WebWorkspaceService();
    const machineRef = service.registerMachinePath(bundlePath);
    const opened = await service.readMachine(machineRef);
    const visible = parseToml(opened.content);
    expect(visible.advanced.qemu_args).toBe('');
    expect(opened.content).not.toContain('/host/secret.img');

    visible.title = 'Safe edit';
    await service.saveMachine(machineRef, stringifyToml(visible));
    const saved = parseToml(await fs.readFile(configPath, 'utf8'));
    expect(saved.title).toBe('Safe edit');
    expect(saved.advanced.qemu_args).toBe(original.advanced.qemu_args);

    visible.advanced.qemu_args = '-plugin /tmp/forged.so';
    await expect(service.saveMachine(machineRef, stringifyToml(visible))).rejects.toMatchObject({
      code: 'CUSTOM_QEMU_ARGS_DENIED'
    });
    expect(() => service.prepareNewMachineContent(stringifyToml(visible))).toThrowError();
  });

  it('sanitizes runtime previews and managed disk creation requests', async () => {
    const { bundlePath } = await createMachine();
    const service = new WebWorkspaceService();
    const machineRef = service.registerMachinePath(bundlePath);
    const opened = await service.readMachine(machineRef);
    const machine = parseToml(opened.content);

    const preview = service.prepareRuntimePreviewMachine(machine);
    expect(preview.media.iso).toBe('Media/outside.iso');
    expect(preview.disks[0].path).toBe('Disks/system.qcow2');

    machine.disks[0].path = '/etc/passwd';
    expect(() => service.prepareRuntimePreviewMachine(machine)).toThrowError();

    const safeRequest = service.sanitizeManagedDiskRequest(machineRef, {
      bundlePath: machineRef,
      path: '/tmp/escape.qcow2',
      name: 'system',
      size: 20,
      unit: 'GB',
      format: 'qcow2',
      options: { preallocate: true, backingFile: '/etc/passwd' }
    });
    expect(safeRequest).toEqual({
      bundlePath,
      diskId: '',
      name: 'system',
      size: 20,
      unit: 'GB',
      format: 'qcow2',
      options: { preallocate: true }
    });
    expect(() => service.sanitizeManagedDiskRequest(machineRef, { name: '../escape', size: 1 })).toThrowError();
  });

  it('allows web exports to select only files that remain inside the machine bundle', async () => {
    const { root, bundlePath } = await createMachine();
    const configPath = path.join(bundlePath, 'machine.svm');
    const machine = parseToml(await fs.readFile(configPath, 'utf8'));
    const externalDisk = path.join(root, 'external.qcow2');
    await fs.writeFile(externalDisk, 'external');
    machine.disks.push({ id: 'disk-external', path: externalDisk, storage_mode: 'external' });
    await fs.writeFile(configPath, stringifyToml(machine), 'utf8');

    const service = new WebWorkspaceService();
    const machineRef = service.registerMachinePath(bundlePath);
    await expect(service.sanitizeExportRequest(machineRef, {
      name: 'Safe export',
      selectedDisks: ['disk-1'],
      includeIso: false
    })).resolves.toMatchObject({
      sourcePath: bundlePath,
      selectedDisks: ['disk-1'],
      includeIso: false,
      restrictToBundle: true
    });
    await expect(service.sanitizeExportRequest(machineRef, {
      selectedDisks: ['disk-external']
    })).rejects.toMatchObject({ code: 'EXTERNAL_RESOURCE_DENIED' });
    await expect(service.sanitizeExportRequest(machineRef, {
      includeIso: true
    })).rejects.toMatchObject({ code: 'EXTERNAL_RESOURCE_DENIED' });
    await expect(service.sanitizeExportRequest(machineRef, {
      selectedDisks: ['disk-forged']
    })).rejects.toMatchObject({ code: 'UNKNOWN_DISK' });
  });

  it('rejects forged absolute paths and forged external resource references', async () => {
    const { bundlePath } = await createMachine();
    const service = new WebWorkspaceService();
    const machineRef = service.registerMachinePath(bundlePath);
    const opened = await service.readMachine(machineRef);
    const machine = parseToml(opened.content);

    machine.media.iso = '/etc/passwd';
    await expect(service.saveMachine(machineRef, stringifyToml(machine))).rejects.toMatchObject({ code: 'EXTERNAL_RESOURCE_DENIED' });

    machine.media.iso = 'web-external:forged/passwd';
    await expect(service.saveMachine(machineRef, stringifyToml(machine))).rejects.toMatchObject({ code: 'EXTERNAL_RESOURCE_DENIED' });

    machine.media.iso = '';
    await expect(service.saveMachine(machineRef, stringifyToml(machine))).rejects.toMatchObject({ code: 'EXTERNAL_RESOURCE_DENIED' });
  });

  it('rejects removing an external resource field from the submitted config', async () => {
    const { bundlePath } = await createMachine();
    const service = new WebWorkspaceService();
    const machineRef = service.registerMachinePath(bundlePath);
    const opened = await service.readMachine(machineRef);
    const machine = parseToml(opened.content);
    delete machine.media;

    await expect(service.saveMachine(machineRef, stringifyToml(machine))).rejects.toMatchObject({ code: 'EXTERNAL_RESOURCE_DENIED' });
  });

  it('only resolves paths below Media and Disks', async () => {
    const { bundlePath } = await createMachine();
    const service = new WebWorkspaceService();
    const machineRef = service.registerMachinePath(bundlePath);

    await expect(service.resolveSandboxPath(machineRef, '../machine.svm')).rejects.toMatchObject({ code: 'PATH_ESCAPE_DENIED' });
    await expect(service.resolveSandboxPath(machineRef, 'machine.svm')).rejects.toMatchObject({ code: 'PROTECTED_PATH' });
    await expect(service.resolveSandboxPath(machineRef, '/etc/passwd')).rejects.toMatchObject({ code: 'ABSOLUTE_PATH_DENIED' });
    await expect(service.resolveSandboxPath(bundlePath, 'Media/test.iso')).rejects.toMatchObject({ code: 'HOST_PATH_DENIED' });
  });

  it('rejects symbolic links that escape the machine bundle', async () => {
    const { root, bundlePath } = await createMachine();
    const outside = path.join(root, 'secret.txt');
    await fs.writeFile(outside, 'secret');
    await fs.symlink(outside, path.join(bundlePath, 'Media', 'escape.iso'));
    const service = new WebWorkspaceService();
    const machineRef = service.registerMachinePath(bundlePath);

    await expect(service.resolveSandboxPath(machineRef, 'Media/escape.iso')).rejects.toMatchObject({ code: 'SYMLINK_ESCAPE_DENIED' });
    const listing = await service.listFiles(machineRef, 'Media');
    expect(listing.entries).not.toEqual(expect.arrayContaining([expect.objectContaining({ name: 'escape.iso' })]));
  });

  it('rejects a machine configuration symbolic link before reading or saving it', async () => {
    const { root, bundlePath } = await createMachine();
    const configPath = path.join(bundlePath, 'machine.svm');
    const outsideConfig = path.join(root, 'outside.svm');
    await fs.rename(configPath, outsideConfig);
    await fs.symlink(outsideConfig, configPath);
    const service = new WebWorkspaceService();
    const machineRef = service.registerMachinePath(bundlePath);

    await expect(service.readMachine(machineRef)).rejects.toMatchObject({ code: 'SYMLINK_ESCAPE_DENIED' });
    await expect(service.saveMachine(machineRef, 'kind = "machine"\n')).rejects.toMatchObject({ code: 'SYMLINK_ESCAPE_DENIED' });
  });

  it('rejects a registered machine bundle that is itself a symbolic link', async () => {
    const { root, bundlePath } = await createMachine();
    const linkedBundle = path.join(root, 'Linked.saka');
    await fs.symlink(bundlePath, linkedBundle);
    const service = new WebWorkspaceService();
    const machineRef = service.registerMachinePath(linkedBundle);

    await expect(service.readMachine(machineRef)).rejects.toMatchObject({ code: 'SYMLINK_ESCAPE_DENIED' });
    await expect(service.resolveValidatedMachineRef(machineRef)).rejects.toMatchObject({ code: 'SYMLINK_ESCAPE_DENIED' });
  });

  it('creates safe upload targets without allowing file name traversal', async () => {
    const { bundlePath } = await createMachine();
    const service = new WebWorkspaceService();
    const machineRef = service.registerMachinePath(bundlePath);

    const target = await service.resolveUploadTarget(machineRef, 'Media', '../../installer.iso');
    expect(target.relativePath).toBe('Media/installer.iso');
    expect(target.targetPath).toBe(path.join(await fs.realpath(bundlePath), 'Media', 'installer.iso'));
    await expect(service.resolveUploadTarget(machineRef, '', 'installer.iso')).rejects.toMatchObject({ code: 'PROTECTED_PATH' });
  });

  it('creates missing top-level sandbox directories without following an escaping directory link', async () => {
    const { root, bundlePath } = await createMachine();
    await fs.rm(path.join(bundlePath, 'Media'), { recursive: true, force: true });
    const service = new WebWorkspaceService();
    const machineRef = service.registerMachinePath(bundlePath);

    const listing = await service.listFiles(machineRef, 'Media');
    expect(listing).toMatchObject({ machineRef, directory: 'Media', entries: [] });
    expect((await fs.stat(path.join(bundlePath, 'Media'))).isDirectory()).toBe(true);

    await fs.rm(path.join(bundlePath, 'Disks'), { recursive: true, force: true });
    const outsideDisks = path.join(root, 'outside-disks');
    await fs.mkdir(outsideDisks);
    await fs.symlink(outsideDisks, path.join(bundlePath, 'Disks'));
    await expect(service.ensureSandboxDirectory(machineRef, 'Disks')).rejects.toMatchObject({
      code: 'SYMLINK_ESCAPE_DENIED'
    });
  });

  it('renames and duplicates only a registered machine bundle', async () => {
    const { bundlePath } = await createMachine();
    const service = new WebWorkspaceService();
    const machineRef = service.registerMachinePath(bundlePath);

    const renamed = await service.renameMachine(machineRef, 'Renamed');
    expect(renamed.machineRef).toBe(machineRef);
    expect(path.basename(renamed.bundlePath)).toBe('Renamed.saka');
    expect(service.resolveMachineRef(machineRef)).toBe(renamed.bundlePath);

    const duplicated = await service.duplicateMachine(machineRef, 'Copy');
    expect(duplicated.machineRef).toMatch(/^web-machine:/);
    expect(duplicated.machineRef).not.toBe(machineRef);
    expect(duplicated.machine.title).toBe('Copy');
    expect(duplicated.machine.id).not.toBe('machine-1');
  });
});
