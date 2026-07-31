import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppStoreProvider } from '../store/AppStore';
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
  source: 'auto-detected' as const,
  effectiveRoot: '/usr',
  installHint: ''
};

type RuntimeEnvironmentFixture = Omit<typeof runtimeEnvironment, 'source'> & {
  source: 'bundled' | 'auto-detected' | 'external-configured';
  errorCode?: string | null;
  errorMessage?: string | null;
};

function mockElectronApi(environment: RuntimeEnvironmentFixture = runtimeEnvironment) {
  window.electronAPI = {
    files: {
      openMachineBundle: vi.fn(async () => null),
      openSaka: vi.fn(async () => null),
      createMachineBundle: vi.fn(async () => ({ path: '/tmp/example.saka', configPath: '/tmp/example.saka/machine.svm' })),
      readSaka: vi.fn(async () => null),
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
      load: vi.fn(async () => null),
      save: vi.fn(async (settings) => settings)
    },
    recents: {
      list: vi.fn(async () => []),
      push: vi.fn(async (entry) => [entry]),
      remove: vi.fn(async () => []),
      reorder: vi.fn(async (paths) => paths)
    },
    runtime: {
      detectQemu: vi.fn(async () => environment),
      scanQemuDirectories: vi.fn(async () => ({ candidates: [], roots: [], scannedDirectories: 0, skippedDirectories: 0, elapsedMs: 0, cancelled: false, truncated: false })),
      cancelQemuDirectoryScan: vi.fn(async () => ({ ok: true as const, cancelled: false })),
      validateQemuDirectory: vi.fn(async () => ({ ok: false })),
      getRuntimeEnvironment: vi.fn(async () => environment),
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

function renderSettings(initialEntry = '/settings') {
  return render(
    <AppStoreProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </MemoryRouter>
    </AppStoreProvider>
  );
}

describe('SettingsPage', () => {
  beforeEach(() => {
    mockElectronApi();
  });

  it('keeps only one settings drawer expanded', async () => {
    const user = userEvent.setup();
    renderSettings();

    const general = await screen.findByRole('button', { name: /^通用/ });
    const templates = screen.getByRole('button', { name: /^模板/ });

    expect(general).toHaveAttribute('aria-expanded', 'true');
    expect(templates).toHaveAttribute('aria-expanded', 'false');

    await user.click(templates);

    expect(general).toHaveAttribute('aria-expanded', 'false');
    expect(templates).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: '导入模板' })).toBeInTheDocument();
  });

  it('opens the drawer from the tab query parameter', async () => {
    renderSettings('/settings?tab=templates');

    expect(await screen.findByRole('button', { name: /^模板/ })).toHaveAttribute('aria-expanded', 'true');
  });

  it('persists reduced motion from general settings', async () => {
    const user = userEvent.setup();
    renderSettings('/settings?tab=general');

    const toggle = await screen.findByRole('checkbox', { name: '减弱动态效果' });
    expect(toggle).not.toBeChecked();
    expect(screen.queryByRole('button', { name: '减弱动态效果' })).not.toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).toBeChecked();
    expect(document.documentElement).toHaveAttribute('data-reduced-motion', 'true');
    expect(window.electronAPI.settings.save).toHaveBeenCalledWith(
      expect.objectContaining({ reduceMotion: true })
    );
  });

  it('shows the real default machine directory from the app metadata', async () => {
    renderSettings('/settings?tab=files');

    expect(await screen.findByDisplayValue('/tmp/Documents/Sanaka')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('/Users/you/Documents/Sanaka')).not.toBeInTheDocument();
  });

  it('keeps QEMU directory selection in the files drawer', async () => {
    renderSettings('/settings?tab=files');

    const chooseButton = await screen.findByRole('button', { name: '选择 QEMU 目录' });
    const drawer = chooseButton.closest('.settings-drawer');

    expect(drawer?.querySelector('.settings-drawer__trigger')).toHaveTextContent('文件');
    expect(drawer?.querySelector('.settings-drawer__trigger')).not.toHaveTextContent('默认配置');
    expect(screen.queryByRole('button', { name: '恢复自动检测' })).not.toBeInTheDocument();
    expect(chooseButton.closest('.qemu-runtime-card')).toBeInTheDocument();
    expect(screen.getByText('外部路径 QEMU')).toBeInTheDocument();
    expect(screen.getByText('QEMU 版本 9.0.0')).toBeInTheDocument();
    expect(screen.queryByText('QEMU emulator version 9.0.0')).not.toBeInTheDocument();
  });

  it('shows the web mode experiment and original template artwork', async () => {
    renderSettings('/settings?tab=experimental');

    expect(await screen.findByRole('checkbox', { name: '网页版' })).toBeInTheDocument();
    expect(document.querySelectorAll('.template-os-icon').length).toBeGreaterThan(0);
  });

  it('uses the green internal QEMU status', async () => {
    mockElectronApi({ ...runtimeEnvironment, source: 'bundled' });
    renderSettings('/settings?tab=files');

    expect(await screen.findByText('Sanaka 内部 QEMU')).toBeInTheDocument();
    expect(document.querySelector('.qemu-runtime-card__status--internal')).toBeInTheDocument();
  });

  it('uses the red unavailable QEMU status and localized error', async () => {
    mockElectronApi({
      ...runtimeEnvironment,
      available: false,
      source: 'external-configured',
      errorCode: 'QEMU_EXTERNAL_BINARIES_MISSING',
      errorMessage: 'raw backend error',
      effectiveRoot: '/opt/qemu'
    });
    renderSettings('/settings?tab=files');

    expect(await screen.findByText('QEMU 不可用')).toBeInTheDocument();
    expect(document.querySelector('.qemu-runtime-card__status--unavailable')).toBeInTheDocument();
    expect(screen.getByText('这个目录中没有可用的 QEMU：/opt/qemu')).toBeInTheDocument();
    expect(screen.queryByText('raw backend error')).not.toBeInTheDocument();
  });

  it('shows five progress dots while checking for updates', async () => {
    const user = userEvent.setup();
    renderSettings('/settings?tab=update');

    await user.click(await screen.findByRole('button', { name: '检查更新' }));

    expect(screen.getByRole('button', { name: '检查中...' })).toBeDisabled();
    expect(document.querySelectorAll('.update-settings__progress-dot')).toHaveLength(5);
  });

  it('shows the default web mode port in desktop settings', async () => {
    renderSettings('/settings?tab=runtime');

    expect(await screen.findByDisplayValue('25895')).toBeInTheDocument();
  });

  it('locks the web mode port field when rendered in web mode', async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        protocol: 'http:'
      }
    });

    renderSettings('/settings?tab=runtime');

    expect(await screen.findByDisplayValue('25895')).toBeDisabled();

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation
    });
  });
});
