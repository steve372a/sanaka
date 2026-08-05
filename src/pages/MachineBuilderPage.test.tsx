import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppStoreProvider, useAppStore } from '../store/AppStore';
import { defaultSettings } from '../domain/defaults';
import { createMachineFromTemplate } from '../domain/templates';
import { serializeSakaMachine } from '../lib/saka';
import { defaultDiskInterfaceForMachine, MachineBuilderPage } from './MachineBuilderPage';

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
  const createMachineBundle = vi.fn<Window['electronAPI']['files']['createMachineBundle']>(async () => ({
    path: '/tmp/example.saka',
    configPath: '/tmp/example.saka/machine.svm'
  }));
  window.electronAPI = {
    files: {
      openMachineBundle: vi.fn(async () => null),
      openSaka: vi.fn(async () => null),
      createMachineBundle,
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
      detectQemu: vi.fn(async () => runtimeEnvironment),
      scanQemuDirectories: vi.fn(async () => ({ candidates: [], roots: [], scannedDirectories: 0, skippedDirectories: 0, elapsedMs: 0, cancelled: false, truncated: false })),
      cancelQemuDirectoryScan: vi.fn(async () => ({ ok: true as const, cancelled: false })),
      validateQemuDirectory: vi.fn(async () => ({ ok: false })),
      getRuntimeEnvironment: vi.fn(async () => runtimeEnvironment),
      buildQemuArgList: vi.fn(async (machine) => ({
        args: [
          { id: 'controlled:system.memory_mib', raw: `-m ${machine.system.memory_mib}`, source: 'controlled' as const, bindingKey: 'system.memory_mib' as const, editable: true },
          { id: 'controlled:system.cpu_cores', raw: `-smp ${machine.system.cpu_cores}`, source: 'controlled' as const, bindingKey: 'system.cpu_cores' as const, editable: true }
        ]
      })),
      applyControlledQemuArgEdit: vi.fn(async ({ machine, bindingKey, raw }) => {
        if (bindingKey === 'system.memory_mib') {
          const value = Number(String(raw).split(' ')[1]);
          return {
            ok: true,
            machine: { ...machine, system: { ...machine.system, memory_mib: value } },
            args: [
              { id: 'controlled:system.memory_mib', raw: `-m ${value}`, source: 'controlled' as const, bindingKey: 'system.memory_mib' as const, editable: true },
              { id: 'controlled:system.cpu_cores', raw: `-smp ${machine.system.cpu_cores}`, source: 'controlled' as const, bindingKey: 'system.cpu_cores' as const, editable: true }
            ]
          };
        }
        return { ok: false, error: 'Invalid controlled QEMU argument value.' };
      }),
      normalizeCustomQemuArgs: vi.fn(async ({ machine, customArgs }) => ({
        ok: true,
        machine: {
          ...machine,
          advanced: {
            ...machine.advanced,
            qemu_args: customArgs.join('\n')
          }
        },
        args: [
          { id: 'controlled:system.memory_mib', raw: `-m ${machine.system.memory_mib}`, source: 'controlled' as const, bindingKey: 'system.memory_mib' as const, editable: true },
          { id: 'controlled:system.cpu_cores', raw: `-smp ${machine.system.cpu_cores}`, source: 'controlled' as const, bindingKey: 'system.cpu_cores' as const, editable: true },
          ...customArgs.map((raw: string, index: number) => ({ id: `custom:${index}`, raw, source: 'custom' as const, editable: true }))
        ]
      })),
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
  return { createMachineBundle };
}

function ExistingMachineEditor({ path }: { path: string }) {
  const { ready, draft, openSakaByPath } = useAppStore();
  const openedRef = useRef(false);

  useEffect(() => {
    if (!ready || openedRef.current) return;
    openedRef.current = true;
    void openSakaByPath(path);
  }, [openSakaByPath, path, ready]);

  return draft ? <MachineBuilderPage /> : <div>loading machine</div>;
}

describe('MachineBuilderPage', () => {
  it('uses IDE as the default disk interface for Windows 10', () => {
    expect(defaultDiskInterfaceForMachine(createMachineFromTemplate('win11'))).toBe('ide');
  });

  beforeEach(() => {
    mockElectronApi();
  });

  it('syncs the summary when machine title changes', async () => {
    const user = userEvent.setup();

    render(
      <AppStoreProvider>
        <MemoryRouter initialEntries={['/machines/new']}>
          <Routes>
            <Route path="/machines/new" element={<MachineBuilderPage />} />
          </Routes>
        </MemoryRouter>
      </AppStoreProvider>
    );

    const input = await screen.findByLabelText('虚拟机名称');
    await user.clear(input);
    await user.type(input, 'My Test Machine');

    await waitFor(() => {
      expect(screen.getByText('My Test Machine')).toBeInTheDocument();
    });
  });

  it('defaults a new machine title to 新虚拟机', async () => {
    render(
      <AppStoreProvider>
        <MemoryRouter initialEntries={['/machines/new']}>
          <Routes>
            <Route path="/machines/new" element={<MachineBuilderPage />} />
          </Routes>
        </MemoryRouter>
      </AppStoreProvider>
    );

    expect(await screen.findByDisplayValue('新虚拟机')).toBeInTheDocument();
  });

  it('shows the floating primary action after scrolling and uses the same save flow', async () => {
    const { createMachineBundle } = mockElectronApi();
    const user = userEvent.setup();
    const { container } = render(
      <AppStoreProvider>
        <MemoryRouter initialEntries={['/machines/new']}>
          <div className="app-shell__content">
            <Routes>
              <Route path="/machines/new" element={<MachineBuilderPage />} />
              <Route path="/machines/:machineId" element={<div>details</div>} />
            </Routes>
          </div>
        </MemoryRouter>
      </AppStoreProvider>
    );

    await screen.findByDisplayValue('新虚拟机');
    const scrollContainer = container.querySelector<HTMLElement>('.app-shell__content');
    const floatingSave = container.querySelector<HTMLButtonElement>('.builder-floating-save');
    expect(scrollContainer).not.toBeNull();
    expect(floatingSave).not.toBeNull();
    expect(floatingSave).not.toHaveClass('builder-floating-save--visible');
    expect(floatingSave).toHaveAttribute('tabindex', '-1');

    scrollContainer!.scrollTop = 40;
    fireEvent.scroll(scrollContainer!);

    await waitFor(() => expect(floatingSave).toHaveClass('builder-floating-save--visible'));
    expect(floatingSave).toHaveAttribute('tabindex', '0');

    scrollContainer!.scrollTop = 0;
    fireEvent.scroll(scrollContainer!);
    await waitFor(() => expect(floatingSave).not.toHaveClass('builder-floating-save--visible'));
    expect(floatingSave).toHaveAttribute('tabindex', '-1');

    scrollContainer!.scrollTop = 40;
    fireEvent.scroll(scrollContainer!);
    await waitFor(() => expect(floatingSave).toHaveClass('builder-floating-save--visible'));
    await user.click(floatingSave!);

    await waitFor(() => expect(createMachineBundle).toHaveBeenCalledTimes(1));
  });

  it('uses the unique machine name returned by the bundle creator', async () => {
    const { createMachineBundle } = mockElectronApi();
    createMachineBundle.mockResolvedValueOnce({
      path: '/tmp/win11-2.saka',
      configPath: '/tmp/win11-2.saka/machine.svm',
      machineName: 'win11 2'
    });
    const user = userEvent.setup();

    render(
      <AppStoreProvider>
        <MemoryRouter initialEntries={['/machines/new']}>
          <Routes>
            <Route path="/machines/new" element={<MachineBuilderPage />} />
            <Route path="/machines/:machineId" element={<div>details</div>} />
          </Routes>
        </MemoryRouter>
      </AppStoreProvider>
    );

    const input = await screen.findByLabelText('虚拟机名称');
    await user.clear(input);
    await user.type(input, 'win11');
    await user.click(screen.getByRole('button', { name: '创建虚拟机' }));

    await waitFor(() => {
      expect(window.electronAPI.recents.push).toHaveBeenCalledWith(expect.objectContaining({ title: 'win11 2' }));
    });
  });

  it('renders editable memory and cpu fields', async () => {
    render(
      <AppStoreProvider>
        <MemoryRouter initialEntries={['/machines/new']}>
          <Routes>
            <Route path="/machines/new" element={<MachineBuilderPage />} />
          </Routes>
        </MemoryRouter>
      </AppStoreProvider>
    );

    expect(await screen.findByLabelText('内存')).toBeInTheDocument();
    expect(screen.getByLabelText('CPU 核心')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '机器类型' })).toBeInTheDocument();
  });

  it('keeps the full accelerator list visible even when host and guest architectures differ', async () => {
    const user = userEvent.setup();

    render(
      <AppStoreProvider>
        <MemoryRouter initialEntries={['/machines/new']}>
          <Routes>
            <Route path="/machines/new" element={<MachineBuilderPage />} />
          </Routes>
        </MemoryRouter>
      </AppStoreProvider>
    );

    await user.click(await screen.findByRole('button', { name: '加速方式' }));

    expect(screen.getByRole('option', { name: 'TCG' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'MTTCG（多线程TCG）' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'KVM（Linux）' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'HAX（Windows）' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'WHPX（Windows）' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'HVF（macOS）' })).toBeInTheDocument();
  });

  it('does not replace saved Linux machine settings when the editor mounts on Windows', async () => {
    const machinePath = 'D:\\Virtual Machines\\Linux.saka';
    const linuxMachine = createMachineFromTemplate('linux');
    linuxMachine.system.accelerator = 'whpx';
    linuxMachine.system.machine_type = 'pc-q35-9.1';
    window.electronAPI.files.readSaka = vi.fn(async () => ({
      path: machinePath,
      configPath: `${machinePath}\\machine.svm`,
      content: serializeSakaMachine(linuxMachine),
      legacySingleFile: false
    }));
    window.electronAPI.app.getMetadata = vi.fn(async () => ({
      name: 'Sanaka',
      version: '1.0.0',
      platform: 'win32',
      arch: 'x64',
      userDataPath: 'C:\\Users\\Tester\\AppData\\Roaming\\Sanaka',
      documentsPath: 'C:\\Users\\Tester\\Documents',
      defaultMachineDirectory: 'C:\\Users\\Tester\\Documents\\Sanaka'
    }));

    const view = render(
      <AppStoreProvider>
        <MemoryRouter initialEntries={['/machines/new']}>
          <ExistingMachineEditor path={machinePath} />
        </MemoryRouter>
      </AppStoreProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '加速方式' })).toHaveTextContent('WHPX');
      expect(screen.getByRole('button', { name: '机器类型' })).toHaveTextContent('pc-q35-9.1');
    });

    view.unmount();
    render(
      <AppStoreProvider>
        <MemoryRouter initialEntries={['/machines/new']}>
          <ExistingMachineEditor path={machinePath} />
        </MemoryRouter>
      </AppStoreProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '加速方式' })).toHaveTextContent('WHPX');
      expect(screen.getByRole('button', { name: '机器类型' })).toHaveTextContent('pc-q35-9.1');
    });
  });

  it('persists accelerator and machine type selected in the Linux editor across a full reopen', async () => {
    const machinePath = 'D:\\Virtual Machines\\Linux.saka';
    const linuxMachine = createMachineFromTemplate('linux');
    let persistedContent = serializeSakaMachine(linuxMachine);
    window.electronAPI.files.readSaka = vi.fn(async () => ({
      path: machinePath,
      configPath: `${machinePath}\\machine.svm`,
      content: persistedContent,
      legacySingleFile: false
    }));
    const saveSaka = vi.fn(async (_path: string, content: string) => {
      persistedContent = content;
      return { path: machinePath, configPath: `${machinePath}\\machine.svm` };
    });
    window.electronAPI.files.saveSaka = saveSaka;
    const user = userEvent.setup();

    const firstView = render(
      <AppStoreProvider>
        <MemoryRouter initialEntries={['/machines/new']}>
          <Routes>
            <Route path="/machines/new" element={<ExistingMachineEditor path={machinePath} />} />
            <Route path="/machines/:machineId" element={<div>saved details</div>} />
          </Routes>
        </MemoryRouter>
      </AppStoreProvider>
    );

    await user.click(await screen.findByRole('button', { name: '加速方式' }));
    await user.click(screen.getByRole('option', { name: 'WHPX（Windows）' }));
    await user.click(screen.getByRole('button', { name: '机器类型' }));
    await user.click(screen.getByRole('option', { name: 'pc-q35-9.1' }));
    await user.click(screen.getByRole('button', { name: '保存更改' }));

    await waitFor(() => {
      expect(saveSaka).toHaveBeenCalledTimes(1);
      expect(persistedContent).toContain('accelerator = "whpx"');
      expect(persistedContent).toContain('machine_type = "pc-q35-9.1"');
    });

    firstView.unmount();
    render(
      <AppStoreProvider>
        <MemoryRouter initialEntries={['/machines/new']}>
          <ExistingMachineEditor path={machinePath} />
        </MemoryRouter>
      </AppStoreProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '加速方式' })).toHaveTextContent('WHPX');
      expect(screen.getByRole('button', { name: '机器类型' })).toHaveTextContent('pc-q35-9.1');
    });
  });

  it('shows QEMU option values without annotations when raw display is enabled', async () => {
    window.electronAPI.settings.load = vi.fn(async () => ({
      ...defaultSettings,
      experimental: { ...defaultSettings.experimental, rawQemuValues: true }
    }));
    const user = userEvent.setup();

    render(
      <AppStoreProvider>
        <MemoryRouter initialEntries={['/machines/new']}>
          <Routes>
            <Route path="/machines/new" element={<MachineBuilderPage />} />
          </Routes>
        </MemoryRouter>
      </AppStoreProvider>
    );

    const accelerator = await screen.findByRole('button', { name: '加速方式' });
    await waitFor(() => expect(accelerator).toHaveTextContent('tcg'));
    await user.click(accelerator);

    expect(screen.getByRole('option', { name: 'hvf' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'mttcg' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'HVF（macOS）' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: 'tcg' }));
    await user.click(screen.getByRole('button', { name: '添加磁盘' }));
    await user.click(screen.getByRole('button', { name: '创建镜像' }));

    expect(screen.getByText('qcow2')).toBeInTheDocument();
    expect(screen.queryByText('QCOW2 (QEMU)')).not.toBeInTheDocument();
  });

  it('keeps the full architecture list visible for non-custom templates', async () => {
    const user = userEvent.setup();

    render(
      <AppStoreProvider>
        <MemoryRouter initialEntries={['/machines/new?template=linux']}>
          <Routes>
            <Route path="/machines/new" element={<MachineBuilderPage />} />
          </Routes>
        </MemoryRouter>
      </AppStoreProvider>
    );

    await user.click(await screen.findByRole('button', { name: 'QEMU 架构' }));

    expect(screen.getByRole('option', { name: '未选择' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '64 位 x86 (x86_64)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'ARM64 (AArch64)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '64 位 PowerPC (ppc64)' })).toBeInTheDocument();
  });

  it('shows architecture-aware gpu options for aarch64 linux machines', async () => {
    const user = userEvent.setup();

    render(
      <AppStoreProvider>
        <MemoryRouter initialEntries={['/machines/new?template=linux']}>
          <Routes>
            <Route path="/machines/new" element={<MachineBuilderPage />} />
          </Routes>
        </MemoryRouter>
      </AppStoreProvider>
    );

    await user.click(await screen.findByRole('button', { name: 'QEMU 架构' }));
    await user.click(await screen.findByRole('option', { name: 'ARM64 (AArch64)' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '机器类型' })).toHaveTextContent('virt');
      expect(screen.getByRole('checkbox', { name: 'UEFI' })).toBeChecked();
    });

    await user.click(await screen.findByRole('button', { name: '显卡' }));

    expect(await screen.findByRole('option', { name: 'virtio-gpu-pci (推荐)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'std (实验性)' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'qxl' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'virtio-vga' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'vmware-svga' })).not.toBeInTheDocument();
  });

  it('warns when selecting an architecture that usually needs extra configuration', async () => {
    const user = userEvent.setup();

    render(
      <AppStoreProvider>
        <MemoryRouter initialEntries={['/machines/new?template=linux']}>
          <Routes>
            <Route path="/machines/new" element={<MachineBuilderPage />} />
          </Routes>
        </MemoryRouter>
      </AppStoreProvider>
    );

    await user.click(await screen.findByRole('button', { name: 'QEMU 架构' }));
    await user.click(await screen.findByRole('option', { name: '64 位 RISC-V (riscv64)' }));

    expect(await screen.findByRole('status')).toHaveTextContent('此架构可能需要额外配置。');
  });
});
