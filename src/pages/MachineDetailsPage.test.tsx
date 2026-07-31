import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMachineFromTemplate } from '../domain/templates';
import { serializeSakaMachine } from '../lib/saka';
import { AppStoreProvider } from '../store/AppStore';
import { RoutedShell } from '../App';

const machinePath = '/tmp/windows-dev-box.saka';
const runtimeEnvironment = {
  available: true,
  binaries: {
    x86_64: { name: 'qemu-system-x86_64', found: true, path: '/usr/bin/qemu-system-x86_64', version: 'QEMU emulator version 9.0.0' },
    aarch64: { name: 'qemu-system-aarch64', found: true, path: '/usr/bin/qemu-system-aarch64', version: 'QEMU emulator version 9.0.0' },
    i386: { name: 'qemu-system-i386', found: true, path: '/usr/bin/qemu-system-i386', version: 'QEMU emulator version 9.0.0' },
    arm: { name: 'qemu-system-arm', found: true, path: '/usr/bin/qemu-system-arm', version: 'QEMU emulator version 9.0.0' },
    riscv64: { name: 'qemu-system-riscv64', found: true, path: '/usr/bin/qemu-system-riscv64', version: 'QEMU emulator version 9.0.0' },
    ppc: { name: 'qemu-system-ppc', found: true, path: '/usr/bin/qemu-system-ppc', version: 'QEMU emulator version 9.0.0' },
    ppc64: { name: 'qemu-system-ppc64', found: true, path: '/usr/bin/qemu-system-ppc64', version: 'QEMU emulator version 9.0.0' },
    qemuImg: { name: 'qemu-img', found: true, path: '/usr/bin/qemu-img', version: 'QEMU emulator version 9.0.0' }
  },
  accelerators: ['hvf', 'tcg'],
  availableSystemTargets: ['x86_64'],
  checkedAt: new Date().toISOString(),
  platform: 'darwin',
  arch: 'arm64',
  installHint: ''
};

function mockElectronApi() {
  const machine = createMachineFromTemplate('win11');
  machine.id = 'machine-1';
  machine.title = 'Windows Dev Box';
  const trashMachineBundle = vi.fn(async () => ({ ok: true as const }));
  const remove = vi.fn(async () => []);

  window.electronAPI = {
    files: {
      openMachineBundle: vi.fn(async () => null),
      openSaka: vi.fn(async () => null),
      createMachineBundle: vi.fn(async () => ({ path: machinePath, configPath: `${machinePath}/machine.svm` })),
      readSaka: vi.fn(async () => ({
        path: machinePath,
        configPath: `${machinePath}/machine.svm`,
        content: serializeSakaMachine(machine),
        legacySingleFile: false
      })),
      saveSaka: vi.fn(async () => ({ path: machinePath, configPath: `${machinePath}/machine.svm` })),
      saveSakaAs: vi.fn(async () => ({ path: machinePath, configPath: `${machinePath}/machine.svm` })),
      trashMachineBundle,
      renamePath: vi.fn(async () => ({ ok: true as const })),
      copyPath: vi.fn(async () => ({ ok: true as const })),
      openPath: vi.fn(async () => ({ ok: true as const })),
      openFolder: vi.fn(),
      pathExists: vi.fn(async () => true)
    },
    dialogs: {
      selectFolder: vi.fn(async () => null),
      pickDisk: vi.fn(async () => null),
      pickIso: vi.fn(async () => null),
      pickFirmwareCode: vi.fn(async () => null),
      pickFirmwareVars: vi.fn(async () => null)
    },
    disks: {
      getInfo: vi.fn(async () => ({ path: '/tmp/disk.qcow2', format: 'qcow2' as const, virtualSize: 0, actualSize: 0 })),
      create: vi.fn(async () => ({ ok: true, path: '/tmp/disk.qcow2' })),
      prepareManaged: vi.fn(async () => ({ ok: true, path: `${machinePath}/Disks/disk.qcow2`, relativePath: 'Disks/disk.qcow2' })),
      resize: vi.fn(async () => ({ ok: true, path: '/tmp/disk.qcow2' })),
      convert: vi.fn(async () => ({ ok: true, path: '/tmp/disk-converted.qcow2' })),
      reclaimSpace: vi.fn(async () => ({ ok: true, path: '/tmp/disk.qcow2', reclaimedBytes: 0 })),
      listLocalImages: vi.fn(async () => ({ images: [] }))
    },
    settings: {
      load: vi.fn(async () => null),
      save: vi.fn(async (settings) => settings)
    },
    recents: {
      list: vi.fn(async () => [
        {
          id: machine.id,
          title: machine.title,
          path: machinePath,
          kind: 'machine',
          templateLabel: machine.template.label,
          updatedAt: machine.updated_at ?? new Date().toISOString(),
          status: 'saved'
        }
      ]),
      push: vi.fn(async (entry) => [entry]),
      remove,
      reorder: vi.fn(async (paths) => paths)
    },
    runtime: {
      detectQemu: vi.fn(async () => runtimeEnvironment),
      scanQemuDirectories: vi.fn(async () => ({ candidates: [], roots: [], scannedDirectories: 0, skippedDirectories: 0, elapsedMs: 0, cancelled: false, truncated: false })),
      cancelQemuDirectoryScan: vi.fn(async () => ({ ok: true as const, cancelled: false })),
      validateQemuDirectory: vi.fn(async () => ({ ok: false })),
      getRuntimeEnvironment: vi.fn(async () => runtimeEnvironment),
      previewMachineCommand: vi.fn(async () => ({
        machineId: 'machine-1',
        bundlePath: '/tmp/example.saka',
        configPath: '/tmp/example.saka/machine.svm',
        binaryPath: '/usr/bin/qemu-system-x86_64',
        args: ['-machine', 'pc-q35-9.2'],
        commandLine: '/usr/bin/qemu-system-x86_64 -machine pc-q35-9.2',
        accelerator: 'tcg',
        display: { frontend: 'sanaka' as const, backend: 'vnc' as const, port: 5901, websocketPort: 5700 },
        qmp: { transport: 'tcp' as const, path: null, host: '127.0.0.1', port: 47001 },
        environment: runtimeEnvironment
      })),
      startMachine: vi.fn(async () => ({ ok: true })),
      stopMachine: vi.fn(async () => ({ ok: true })),
      forceStopMachine: vi.fn(async () => ({ ok: true })),
      resetMachine: vi.fn(async () => ({ ok: true })),
      changeMedia: vi.fn(async () => ({ ok: true })),
      getMachineState: vi.fn(async () => null),
      listRunningMachines: vi.fn(async () => []),
      onRuntimeEvent: vi.fn(() => () => undefined)
    },
    machine: {
      exportMachine: vi.fn(async () => 'export-task-1'),
      cancelExport: vi.fn(async () => true),
      onExportProgress: vi.fn(() => () => undefined)
    },
    updater: {
      getCurrentInfo: vi.fn(async () => ({ currentVersion: '1.0.0', currentChannel: 'release' as const, skippedVersion: '' })),
      checkForUpdates: vi.fn(async () => ({ currentVersion: '1.0.0', currentChannel: 'release' as const, hasUpdate: false, skippedVersion: '' })),
      skipVersion: vi.fn(async () => ({ ok: true as const, skippedVersion: '1.0.0' })),
      openUpdatePage: vi.fn(async () => ({ ok: true as const })),
      onUpdateAvailable: vi.fn(() => () => undefined)
    },
    app: {
      getMetadata: vi.fn(async () => ({ name: 'Sanaka', version: '1.0.0', platform: 'darwin', arch: 'x64', userDataPath: '/tmp', documentsPath: '/tmp/Documents', defaultMachineDirectory: '/tmp/Documents/Sanaka' })),
      openWebMode: vi.fn(async () => ({ active: true, url: 'http://127.0.0.1:39281/', localUrl: 'http://127.0.0.1:39281/', networkUrl: 'http://192.168.1.8:39281/', host: '0.0.0.0', port: 39281, startedAt: new Date().toISOString(), localOnly: false })),
      getWebModeState: vi.fn(async () => ({ active: false, url: null, localUrl: null, networkUrl: null, host: '0.0.0.0', port: null, startedAt: null, localOnly: false })),
      stopWebMode: vi.fn(async () => ({ ok: true as const })),
      consumePendingSakaPaths: vi.fn(async () => []),
      openExternal: vi.fn(async () => ({ ok: true as const })),
      onOpenSaka: vi.fn(() => () => undefined),
      onOpenAbout: vi.fn(() => () => undefined),
      onOpenSettings: vi.fn(() => () => undefined)
    }
  };

  return { remove, trashMachineBundle };
}

describe('MachineDetailsPage', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('moves a saved machine to the trash and removes it from recents', async () => {
    const { remove, trashMachineBundle } = mockElectronApi();
    const user = userEvent.setup();

    render(
      <AppStoreProvider>
        <MemoryRouter initialEntries={[`/machines/machine-1?path=${encodeURIComponent(machinePath)}`]}>
          <RoutedShell />
        </MemoryRouter>
      </AppStoreProvider>
    );

    await user.click(await screen.findByRole('button', { name: '删除虚拟机' }));

    const dialog = await screen.findByRole('dialog');
    const confirmButton = within(dialog).getByRole('button', { name: '删除虚拟机' });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(trashMachineBundle).toHaveBeenCalledWith(machinePath);
      expect(remove).toHaveBeenCalledWith(machinePath);
    });
  });

  it('starts the machine when clicking the preview overlay button', async () => {
    mockElectronApi();
    const user = userEvent.setup();

    render(
      <AppStoreProvider>
        <MemoryRouter initialEntries={[`/machines/machine-1?path=${encodeURIComponent(machinePath)}`]}>
          <RoutedShell />
        </MemoryRouter>
      </AppStoreProvider>
    );

    const startButtons = await screen.findAllByRole('button', { name: '启动虚拟机' });
    expect(startButtons).toHaveLength(1);
    await user.click(startButtons[0]);

    await waitFor(() => {
      expect(window.electronAPI.runtime.startMachine).toHaveBeenCalledWith(machinePath);
    });
  });

  it('keeps saving inside the configuration editor', async () => {
    mockElectronApi();

    render(
      <AppStoreProvider>
        <MemoryRouter initialEntries={[`/machines/machine-1?path=${encodeURIComponent(machinePath)}`]}>
          <RoutedShell />
        </MemoryRouter>
      </AppStoreProvider>
    );

    expect(await screen.findByText('Windows Dev Box')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '保存更改' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '编辑配置' })).toHaveLength(1);
  });

  it('preserves machine identity when changing templates during editing', async () => {
    mockElectronApi();
    const user = userEvent.setup();

    render(
      <AppStoreProvider>
        <MemoryRouter initialEntries={[`/machines/machine-1?path=${encodeURIComponent(machinePath)}`]}>
          <RoutedShell />
        </MemoryRouter>
      </AppStoreProvider>
    );

    const editButtons = await screen.findAllByRole('button', { name: '编辑配置' });
    await user.click(editButtons[editButtons.length - 1]);

    expect(await screen.findByRole('heading', { name: '编辑虚拟机' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Windows 98/ }));

    await waitFor(() => {
      expect(screen.getByLabelText('虚拟机名称')).toHaveValue('Windows Dev Box');
      expect(screen.queryByText('该虚拟机名称已存在，请使用其他名称。')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: '保存更改' })).toBeInTheDocument();
  });
});
