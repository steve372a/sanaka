import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppStoreProvider, useAppStore } from './AppStore';
import { defaultSettings } from '../domain/defaults';
import { createMachineFromTemplate } from '../domain/templates';
import { serializeSakaMachine } from '../lib/saka';

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
  machine.system.accelerator = 'kvm';

  const saveSaka = vi.fn(async () => ({ path: machinePath, configPath: `${machinePath}/machine.svm` }));
  const startMachine = vi.fn(async () => ({ ok: true }));

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
      saveSaka,
      saveSakaAs: vi.fn(async () => ({ path: machinePath, configPath: `${machinePath}/machine.svm` })),
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
      list: vi.fn(async () => []),
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
        bundlePath: machinePath,
        configPath: `${machinePath}/machine.svm`,
        binaryPath: '/usr/bin/qemu-system-x86_64',
        args: ['-machine', 'pc-q35-9.2'],
        commandLine: '/usr/bin/qemu-system-x86_64 -machine pc-q35-9.2',
        accelerator: 'tcg',
        display: { frontend: 'sanaka' as const, backend: 'vnc' as const, port: 5901, websocketPort: 5700 },
        qmp: { transport: 'tcp' as const, path: null, host: '127.0.0.1', port: 47001 },
        environment: runtimeEnvironment
      })),
      startMachine,
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
      getMetadata: vi.fn(async () => ({ name: 'Sanaka', version: '1.0.0', platform: 'darwin', arch: 'arm64', userDataPath: '/tmp', documentsPath: '/tmp/Documents', defaultMachineDirectory: '/tmp/Documents/Sanaka' })),
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

  return { saveSaka, startMachine };
}

function StoreHarness() {
  const { ready, draft, openSakaByPath, recents, updateDraft, startMachine, importTemplateFromDialog, activity, transition, triggerTransition } = useAppStore();

  if (!ready) {
    return <div>loading</div>;
  }

  return (
    <div>
      <button type="button" onClick={() => void openSakaByPath(machinePath)}>
        open
      </button>
      <button type="button" onClick={() => void openSakaByPath(machinePath, { refreshRecents: false })}>
        open-no-recent-refresh
      </button>
      <button
        type="button"
        onClick={() =>
          updateDraft((current) => ({
            ...current,
            system: {
              ...current.system,
              accelerator: 'tcg'
            }
          }))
        }
        disabled={!draft}
      >
        set-tcg
      </button>
      <button type="button" onClick={() => void startMachine(machinePath)} disabled={!draft}>
        start
      </button>
      <button type="button" onClick={() => void importTemplateFromDialog()}>
        import-template
      </button>
      <button
        type="button"
        onClick={() => triggerTransition('launch', () => {
          document.body.dataset.transitionAction = 'done';
        }, { x: 140, y: 90, size: 72 })}
      >
        transition
      </button>
      <div>{activity[0]?.title ?? ''}</div>
      <div data-testid="recent-titles">{recents.map((item) => item.title).join('|')}</div>
      <div data-testid="transition-state">
        {transition.active ? `${transition.phase}:${transition.origin?.x}:${transition.origin?.y}:${transition.origin?.size}` : 'inactive'}
      </div>
    </div>
  );
}

describe('AppStore startMachine', () => {
  beforeEach(() => {
    mockElectronApi();
    delete document.body.dataset.transitionAction;
  });

  it('saves a dirty machine before starting so runtime reads the updated accelerator', async () => {
    const { saveSaka, startMachine } = mockElectronApi();
    const user = userEvent.setup();

    render(
      <AppStoreProvider>
        <StoreHarness />
      </AppStoreProvider>
    );

    await user.click(await screen.findByRole('button', { name: 'open' }));
    await user.click(await screen.findByRole('button', { name: 'set-tcg' }));
    await user.click(screen.getByRole('button', { name: 'start' }));

    await waitFor(() => {
      expect(saveSaka).toHaveBeenCalledTimes(1);
      expect(startMachine).toHaveBeenCalledWith(machinePath);
    });

    const firstSaveCall = saveSaka.mock.calls[0] as unknown[] | undefined;
    expect(firstSaveCall).toBeTruthy();
    const savedContent = firstSaveCall?.[1];
    expect(typeof savedContent).toBe('string');
    expect(savedContent).toContain('accelerator = "tcg"');
  });

  it('migrates the old permanent welcome dismissal to the current version', async () => {
    const legacySettings = structuredClone(defaultSettings);
    legacySettings.showWelcomeOnStartup = false;
    delete (legacySettings as Partial<typeof legacySettings>).welcomeDismissedVersion;
    window.electronAPI.settings.load = vi.fn(async () => legacySettings);
    const saveSettings = vi.fn(async (settings) => settings);
    window.electronAPI.settings.save = saveSettings;

    render(
      <AppStoreProvider>
        <StoreHarness />
      </AppStoreProvider>
    );

    await screen.findByRole('button', { name: 'open' });
    await waitFor(() => {
      expect(saveSettings).toHaveBeenCalledWith(expect.objectContaining({
        showWelcomeOnStartup: true,
        welcomeDismissedVersion: '1.0.0'
      }));
    });
  });

  it('shows an import error when the selected svm is not a template', async () => {
    mockElectronApi();
    window.electronAPI.files.openSaka = vi.fn(async () => ({
      path: '/tmp/not-template.svm',
      configPath: '/tmp/not-template.svm',
      content: serializeSakaMachine(createMachineFromTemplate('win11')),
      legacySingleFile: true
    }));

    const user = userEvent.setup();

    render(
      <AppStoreProvider>
        <StoreHarness />
      </AppStoreProvider>
    );

    await user.click(await screen.findByRole('button', { name: 'import-template' }));

    await screen.findByText('导入失败');
  });

  it('can open a machine without moving it to the top of recents', async () => {
    mockElectronApi();
    window.electronAPI.recents.list = vi.fn(async () => [
      {
        id: 'other-machine',
        title: 'Other Machine',
        path: '/tmp/other-machine.saka',
        kind: 'machine',
        templateLabel: 'Windows 10',
        updatedAt: '2026-06-12T01:00:00.000Z',
        status: 'saved'
      },
      {
        id: 'machine-1',
        title: 'Windows Dev Box',
        path: machinePath,
        kind: 'machine',
        templateLabel: 'Windows 10',
        updatedAt: '2026-06-12T00:00:00.000Z',
        status: 'saved'
      }
    ]);

    const pushSpy = vi.fn(async (entry) => [entry]);
    window.electronAPI.recents.push = pushSpy;

    const user = userEvent.setup();

    render(
      <AppStoreProvider>
        <StoreHarness />
      </AppStoreProvider>
    );

    await user.click(await screen.findByRole('button', { name: 'open-no-recent-refresh' }));

    await waitFor(() => {
      expect(screen.getByTestId('recent-titles').textContent).toBe('Other Machine|Windows Dev Box');
    });
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('waits for full coverage before running the action, then reveals the destination', async () => {
    render(
      <AppStoreProvider>
        <StoreHarness />
      </AppStoreProvider>
    );

    const transitionButton = await screen.findByRole('button', { name: 'transition' });
    vi.useFakeTimers();
    try {
      fireEvent.click(transitionButton);
      expect(screen.getByTestId('transition-state')).toHaveTextContent('covering:140:90:72');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(679);
      });
      expect(document.body.dataset.transitionAction).toBeUndefined();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(document.body.dataset.transitionAction).toBe('done');
      expect(screen.getByTestId('transition-state')).toHaveTextContent('revealing:140:90:72');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(360);
      });
      expect(screen.getByTestId('transition-state')).toHaveTextContent('inactive');
    } finally {
      vi.useRealTimers();
    }
  });
});
