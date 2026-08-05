import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SakaMachine } from '../domain/schemas';
import { QemuArgsList } from './QemuArgsList';

function createMachine(memory_mib = 2048): SakaMachine {
  return {
    format_version: 1,
    kind: 'machine',
    id: 'vm-qemu-args-list',
    title: 'VM QEMU Args',
    description: '',
    author: '',
    created_with: 'Sanaka 0.1',
    template: {
      key: 'custom',
      label: 'Custom'
    },
    meta: {
      notes: '',
      tags: []
    },
    system: {
      arch: 'x86_64',
      machine_type: 'pc-q35-9.2',
      accelerator: 'tcg',
      boot_order: 'disk',
      uefi: false,
      memory_mib,
      cpu_cores: 2,
      sound_card: 'intel-hda'
    },
    media: {
      iso: '',
      floppy: ''
    },
    disks: [],
    network: {
      enabled: false,
      mode: 'user',
      card: 'rtl8139'
    },
    sharing: {
      enabled: false,
      hostPath: '',
      mode: 'readwrite',
      shareName: 'qemu'
    },
    integration: {
      clipboard: {
        enabled: false,
        mode: 'text',
        autoConnect: true
      }
    },
    display: {
      frontend: 'sanaka',
      gpu: 'std',
      sanaka: {
        backend: 'vnc',
        scale_mode: 'fit',
        clipboard: true
      }
    },
    peripherals: {
      usb_tablet: true
    },
    advanced: {
      audio_backend: 'auto',
      qemu_args: '-device usb-kbd'
    }
  };
}

function buildFullCommand(machine: SakaMachine) {
  return {
    args: [
      { id: 'binary', raw: '/usr/bin/qemu-system-x86_64', isCustom: false, editable: false },
      { id: 'generated:meta:flag', raw: '-name', isCustom: false, editable: false },
      { id: 'generated:meta:value', raw: 'New VM 1', isCustom: false, editable: false },
      { id: 'generated:display:flag', raw: '-display', isCustom: false, editable: false },
      { id: 'generated:display:value', raw: 'none', isCustom: false, editable: false },
      { id: 'generated:accel:flag', raw: '-accel', isCustom: false, editable: false },
      {
        id: 'generated:accel:value',
        raw: machine.system.accelerator,
        isCustom: false,
        editable: true,
        bindingKey: 'system.accelerator' as const,
        editPrefix: '-accel'
      },
      { id: 'generated:sound:flag', raw: '-device', isCustom: false, editable: false },
      {
        id: 'generated:sound:value',
        raw: 'intel-hda',
        isCustom: false,
        editable: true,
        removable: true,
        bindingKey: 'system.sound_card' as const,
        editPrefix: '-device'
      },
      { id: 'generated:0:flag', raw: '-m', isCustom: false, editable: false },
      {
        id: 'generated:0:value',
        raw: String(machine.system.memory_mib),
        isCustom: false,
        editable: true,
        bindingKey: 'system.memory_mib' as const,
        editPrefix: '-m'
      },
      { id: 'generated:2:flag', raw: '-smp', isCustom: false, editable: false },
      {
        id: 'generated:2:value',
        raw: String(machine.system.cpu_cores),
        isCustom: false,
        editable: true,
        bindingKey: 'system.cpu_cores' as const,
        editPrefix: '-smp'
      },
      { id: 'custom:0:0', raw: '-device', isCustom: true, editable: false, customIndex: 0 },
      { id: 'custom:0:1', raw: 'usb-kbd', isCustom: true, editable: false, customIndex: 0 }
    ]
  };
}

const translations: Record<string, string> = {
  'builder.labels.advancedArgs': 'Custom QEMU Arguments',
  'builder.actions.addArg': 'Add custom argument',
  'builder.actions.add': 'Add',
  'builder.actions.removeArg': 'Remove argument',
  'builder.descriptions.advanced': 'Advanced QEMU arguments',
  'builder.errors.invalidArgValue': 'Invalid argument value',
  'builder.errors.webCustomArgsLocked': 'Web mode cannot modify custom QEMU arguments. Use the desktop app.'
};

describe('QemuArgsList', () => {
  it('edits generated value rows via the full command API and keeps one remove button per custom line', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const getFullQemuCommand = vi.fn(async (machine: SakaMachine) => buildFullCommand(machine));
    const applyControlledQemuArgEdit = vi.fn(async ({ machine, bindingKey, raw }) => {
      if (bindingKey !== 'system.memory_mib') {
        return { ok: false, error: 'Invalid argument value' };
      }

      return {
        ok: true,
        machine: {
          ...machine,
          system: {
            ...machine.system,
            memory_mib: Number(String(raw).split(' ')[1])
          }
        }
      };
    });
    const removeControlledQemuArg = vi.fn(async ({ machine, bindingKey }) => {
      if (bindingKey !== 'system.sound_card') {
        return { ok: false, error: 'Invalid argument value' };
      }
      return {
        ok: true,
        machine: {
          ...machine,
          system: {
            ...machine.system,
            sound_card: 'none'
          }
        }
      };
    });

    window.electronAPI = {
      runtime: {
        getFullQemuCommand,
        applyControlledQemuArgEdit,
        removeControlledQemuArg
      }
    } as unknown as Window['electronAPI'];

    render(
      <QemuArgsList
        machine={createMachine()}
        onChange={onChange}
        t={(key) => translations[key] || key}
      />
    );

    const toggle = screen.getByTestId('qemu-args-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    expect(await screen.findByText('-name New VM 1')).toBeInTheDocument();
    expect(screen.getByText('-display none')).toBeInTheDocument();
    expect(screen.getByText('-device intel-hda')).toBeInTheDocument();
    expect(screen.getByText('-m 2048')).toBeInTheDocument();
    expect(screen.getByText('-device usb-kbd')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Remove argument' })).toHaveLength(2);

    await user.click(screen.getByText('-m 2048'));
    const input = await screen.findByDisplayValue('-m 2048');
    await user.clear(input);
    await user.type(input, '4096{enter}');

    await waitFor(() => {
      expect(applyControlledQemuArgEdit).toHaveBeenCalledWith({
        machine: expect.objectContaining({
          system: expect.objectContaining({ memory_mib: 2048 })
        }),
        bindingKey: 'system.memory_mib',
        raw: '-m 4096'
      });
    });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.objectContaining({ memory_mib: 4096 })
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText('-m 4096')).toBeInTheDocument();
    });

    await user.click(screen.getAllByRole('button', { name: 'Remove argument' })[0]);

    await waitFor(() => {
      expect(removeControlledQemuArg).toHaveBeenCalledWith({
        machine: expect.objectContaining({
          system: expect.objectContaining({ sound_card: 'intel-hda' })
        }),
        bindingKey: 'system.sound_card'
      });
    });
  });

  it('keeps the add control visible but blocks custom arguments in web mode', async () => {
    const user = userEvent.setup();
    window.sanakaWebAPI = { isWebMode: true } as Window['sanakaWebAPI'];
    window.electronAPI = {
      runtime: {
        getFullQemuCommand: vi.fn(async (machine: SakaMachine) => buildFullCommand(machine))
      }
    } as unknown as Window['electronAPI'];
    const restriction = vi.fn();
    window.addEventListener('sanaka:web-restriction', restriction);

    render(<QemuArgsList machine={createMachine()} onChange={vi.fn()} t={(key) => translations[key] || key} />);
    const add = screen.getByRole('button', { name: 'Add custom argument' });
    expect(add).toHaveAttribute('aria-disabled', 'true');
    await user.click(add);

    expect(restriction).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('textbox', { name: 'Add custom argument' })).not.toBeInTheDocument();

    window.removeEventListener('sanaka:web-restriction', restriction);
    window.sanakaWebAPI = undefined;
  });

  it('promotes an added accelerator argument into the UI-backed machine field', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const normalizeCustomQemuArgs = vi.fn(async ({ machine, customArgs }) => ({
      ok: true,
      machine: {
        ...machine,
        system: { ...machine.system, accelerator: 'whpx' as const },
        advanced: { ...machine.advanced, qemu_args: '-device usb-kbd' }
      },
      args: []
    }));
    window.electronAPI = {
      runtime: {
        getFullQemuCommand: vi.fn(async (machine: SakaMachine) => buildFullCommand(machine)),
        normalizeCustomQemuArgs
      }
    } as unknown as Window['electronAPI'];

    render(<QemuArgsList machine={createMachine()} onChange={onChange} t={(key) => translations[key] || key} />);

    await user.click(screen.getByRole('button', { name: 'Add custom argument' }));
    const input = await screen.findByRole('textbox', { name: 'Add custom argument' });
    await user.type(input, '-accel whpx');
    await user.keyboard('{Control>}{Enter}{/Control}');

    await waitFor(() => {
      expect(normalizeCustomQemuArgs).toHaveBeenCalledWith({
        machine: expect.objectContaining({ system: expect.objectContaining({ accelerator: 'tcg' }) }),
        customArgs: ['-device usb-kbd', '-accel whpx']
      });
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        system: expect.objectContaining({ accelerator: 'whpx' }),
        advanced: expect.objectContaining({ qemu_args: '-device usb-kbd' })
      }));
    });
    expect(await screen.findByText('-accel whpx')).toBeInTheDocument();
  });

  it('ignores an older command preview that completes after the current machine preview', async () => {
    const tcgMachine = createMachine();
    const whpxMachine = {
      ...tcgMachine,
      system: { ...tcgMachine.system, accelerator: 'whpx' as const }
    };
    let resolveOldPreview!: (value: ReturnType<typeof buildFullCommand>) => void;
    const oldPreview = new Promise<ReturnType<typeof buildFullCommand>>((resolve) => {
      resolveOldPreview = resolve;
    });
    const getFullQemuCommand = vi.fn()
      .mockImplementationOnce(async () => oldPreview)
      .mockImplementation(async (machine: SakaMachine) => buildFullCommand(machine));
    window.electronAPI = {
      runtime: { getFullQemuCommand }
    } as unknown as Window['electronAPI'];

    const { rerender } = render(
      <QemuArgsList machine={tcgMachine} onChange={vi.fn()} t={(key) => translations[key] || key} />
    );
    await waitFor(() => expect(getFullQemuCommand).toHaveBeenCalledTimes(1));

    rerender(<QemuArgsList machine={whpxMachine} onChange={vi.fn()} t={(key) => translations[key] || key} />);
    await userEvent.setup().click(screen.getByTestId('qemu-args-toggle'));
    expect(await screen.findByText('-accel whpx')).toBeInTheDocument();

    await act(async () => {
      resolveOldPreview(buildFullCommand(tcgMachine));
      await oldPreview;
    });

    expect(screen.getByText('-accel whpx')).toBeInTheDocument();
    expect(screen.queryByText('-accel tcg')).not.toBeInTheDocument();
  });
});
