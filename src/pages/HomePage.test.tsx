import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppHeader } from '../components/AppHeader';
import { defaultSettings } from '../domain/defaults';
import { createMachineFromTemplate } from '../domain/templates';
import { serializeSakaMachine } from '../lib/saka';
import { AppStoreProvider } from '../store/AppStore';
import { HomePage } from './HomePage';
import { MachineDetailsPage } from './MachineDetailsPage';
import { SettingsPage } from './SettingsPage';

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

function mockElectronApi(recents: Array<Record<string, unknown>> = [], webModeEnabled = false) {
  const machine = createMachineFromTemplate('win11');
  machine.id = 'machine-1';
  machine.title = 'Windows Dev Box';

  window.electronAPI = {
    files: {
      openMachineBundle: vi.fn(async () => null),
      openSaka: vi.fn(async () => null),
      createMachineBundle: vi.fn(async () => ({ path: '/tmp/example.saka', configPath: '/tmp/example.saka/machine.svm' })),
      readSaka: vi.fn(async (path: string) => {
        if (path === '/tmp/windows-dev-box.saka') {
          return {
            path,
            configPath: `${path}/machine.svm`,
            content: serializeSakaMachine(machine),
            legacySingleFile: false
          };
        }
        return null;
      }),
      saveSaka: vi.fn(async () => ({ path: '/tmp/example.saka', configPath: '/tmp/example.saka/machine.svm' })),
      saveSakaAs: vi.fn(async () => ({ path: '/tmp/example.saka', configPath: '/tmp/example.saka/machine.svm' })),
      trashMachineBundle: vi.fn(async () => ({ ok: true as const })),
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
      prepareManaged: vi.fn(async () => ({ ok: true, path: '/tmp/example.saka/Disks/disk.qcow2', relativePath: 'Disks/disk.qcow2' })),
      resize: vi.fn(async () => ({ ok: true, path: '/tmp/disk.qcow2' })),
      convert: vi.fn(async () => ({ ok: true, path: '/tmp/disk-converted.qcow2' })),
      reclaimSpace: vi.fn(async () => ({ ok: true, path: '/tmp/disk.qcow2', reclaimedBytes: 0 })),
      listLocalImages: vi.fn(async () => ({ images: [] }))
    },
    settings: {
      load: vi.fn(async () => webModeEnabled ? {
        ...defaultSettings,
        experimental: {
          ...defaultSettings.experimental,
          webMode: true
        }
      } : null),
      save: vi.fn(async (settings) => settings)
    },
    recents: {
      list: vi.fn(async () => recents),
      push: vi.fn(async (entry) => [entry]),
      remove: vi.fn(async () => []),
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
}

function renderHome() {
  return render(
    <AppStoreProvider>
      <MemoryRouter initialEntries={['/']}>
        <div className="app-shell">
          <div className="app-shell__surface">
            <AppHeader />
            <main className="app-shell__content">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/machines/:machineId" element={<MachineDetailsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </main>
          </div>
        </div>
      </MemoryRouter>
    </AppStoreProvider>
  );
}

describe('HomePage', () => {
  beforeEach(() => {
    mockElectronApi();
  });

  it('renders a quiet workspace empty state instead of the old hero slogan', async () => {
    renderHome();

    expect((await screen.findAllByText('还没有虚拟机')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('还没有虚拟机').length).toBeGreaterThan(0);
    expect(screen.getAllByText('打开虚拟机配置').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: '减弱动态效果' })).not.toBeInTheDocument();
    expect(screen.queryByText('Build a machine, not a checklist.')).not.toBeInTheDocument();
    expect(screen.queryByText(/\.saka/)).not.toBeInTheDocument();
  });

  it('uses the shared machine details view for the current recent machine', async () => {
    mockElectronApi([
      {
        id: 'machine-1',
        title: 'Windows Dev Box',
        path: '/tmp/windows-dev-box.saka',
        kind: 'machine',
        templateLabel: 'Windows 10/11',
        updatedAt: '2026-06-02T12:00:00.000Z',
        status: 'saved'
      }
    ]);

    const user = userEvent.setup();
    renderHome();

    expect(await screen.findByRole('heading', { name: 'Windows Dev Box' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '配置' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '编辑配置' })).toHaveLength(1);
    expect(screen.queryByText('当前虚拟机')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '设置' }));

    expect(await screen.findByText('管理应用偏好、默认配置和模板。')).toBeInTheDocument();
  });

  it('opens machine details when clicking a recent machine in the sidebar', async () => {
    mockElectronApi([
      {
        id: 'machine-1',
        title: 'Windows Dev Box',
        path: '/tmp/windows-dev-box.saka',
        kind: 'machine',
        templateLabel: 'Windows 10',
        updatedAt: '2026-06-02T12:00:00.000Z',
        status: 'saved'
      }
    ]);

    const user = userEvent.setup();
    renderHome();

    const sidebarMachine = await screen.findByRole('button', { name: 'Windows Dev Box' });
    await user.click(sidebarMachine);

    expect(await screen.findByRole('heading', { name: 'Windows Dev Box' })).toBeInTheDocument();
  });

  it('opens web mode from the top tools menu', async () => {
    const user = userEvent.setup();
    mockElectronApi([], true);
    renderHome();

    await user.click(await screen.findByRole('button', { name: '更多' }));
    await user.click(await screen.findByRole('menuitem', { name: '打开网页模式' }));

    expect(window.electronAPI.app.openWebMode).toHaveBeenCalledTimes(1);
  });

  it('copies and stops web mode from the top tools menu', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText
      }
    });

    mockElectronApi([], true);
    (window.electronAPI.app.getWebModeState as ReturnType<typeof vi.fn>).mockResolvedValue({
      active: true,
      url: 'http://127.0.0.1:39281/',
      host: '127.0.0.1',
      port: 39281,
      startedAt: new Date().toISOString(),
      localOnly: true
    });

    renderHome();

    await screen.findByRole('button', { name: '更多' });

    await user.click(screen.getByRole('button', { name: '更多' }));
    await user.click(await screen.findByRole('menuitem', { name: '复制网页地址' }));
    expect(writeText).toHaveBeenCalledWith('http://127.0.0.1:39281/');

    await user.click(screen.getByRole('button', { name: '更多' }));
    await user.click(await screen.findByRole('menuitem', { name: '停止网页服务' }));
    expect(window.electronAPI.app.stopWebMode).toHaveBeenCalledTimes(1);
  });

  it('opens the browser again from the web mode info dialog', async () => {
    const user = userEvent.setup();

    mockElectronApi([], true);
    (window.electronAPI.app.getWebModeState as ReturnType<typeof vi.fn>).mockResolvedValue({
      active: true,
      url: 'http://127.0.0.1:39281/',
      host: '127.0.0.1',
      port: 39281,
      startedAt: new Date().toISOString(),
      localOnly: true
    });

    renderHome();

    await screen.findByRole('button', { name: '更多' });
    await user.click(screen.getByRole('button', { name: '更多' }));
    await user.click(await screen.findByRole('menuitem', { name: '查看网页服务信息' }));
    await user.click(await screen.findByRole('button', { name: '在浏览器打开' }));

    expect(window.electronAPI.app.openExternal).toHaveBeenCalledWith('http://127.0.0.1:39281/');
  });
});
