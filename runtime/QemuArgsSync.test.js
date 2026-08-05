import { describe, expect, it } from 'vitest';
import {
  applyControlledEdit,
  buildArgList,
  normalizeCustomArgs
} from './QemuArgsSync';

const baseMachine = {
  format_version: 1,
  kind: 'machine',
  id: 'test-machine',
  title: 'Test Machine',
  description: '',
  template: { key: 'custom', label: 'Custom' },
  system: {
    arch: 'x86_64',
    machine_type: 'q35',
    accelerator: 'tcg',
    boot_order: 'cdrom',
    uefi: false,
    memory_mib: 2048,
    cpu_cores: 2,
    sound_card: 'intel-hda'
  },
  media: { iso: '', floppy: '' },
  disks: [],
  network: { enabled: true, mode: 'user', card: 'e1000' },
  sharing: { enabled: false, hostPath: '', mode: 'readwrite', shareName: 'qemu' },
  integration: { clipboard: { enabled: false, mode: 'text', autoConnect: true } },
  display: { frontend: 'sanaka', gpu: 'std', sanaka: { backend: 'vnc', scale_mode: 'fit', clipboard: true } },
  peripherals: { usb_tablet: true },
  advanced: { audio_backend: 'auto', qemu_args: '' }
};

describe('QemuArgsSync', () => {
  it('builds controlled args from backend-owned machine semantics', () => {
    const args = buildArgList(baseMachine);
    expect(args.map((item) => item.raw)).toEqual([
      '-m 2048',
      '-smp 2',
      '-accel tcg',
      '-boot d',
      '-netdev user,id=net0',
      expect.stringMatching(/^-device e1000,netdev=net0,mac=/)
    ]);
  });

  it('applies boot edits using actual qemu boot letters', () => {
    const updated = applyControlledEdit(baseMachine, 'system.boot_order', '-boot c');
    expect(updated?.system.boot_order).toBe('disk');
  });

  it('promotes controlled-looking custom args back into machine fields', () => {
    const result = normalizeCustomArgs(baseMachine, [
      '-m 4096',
      '-machine pc-i440fx-9.2',
      '-accel whpx',
      '-global ICH9-LPC.disable_s3=1'
    ]);
    expect(result.machine.system.memory_mib).toBe(4096);
    expect(result.machine.system.machine_type).toBe('pc-i440fx-9.2');
    expect(result.machine.system.accelerator).toBe('whpx');
    expect(result.machine.advanced.qemu_args).toBe('-global ICH9-LPC.disable_s3=1');
    expect(result.args.map((item) => item.raw)).toContain('-m 4096');
    expect(result.args.map((item) => item.raw)).toContain('-global ICH9-LPC.disable_s3=1');
  });

  it('promotes network mode and card custom args into UI-backed machine fields', () => {
    const networkDisabled = {
      ...baseMachine,
      network: { enabled: false, mode: 'user', card: 'e1000' },
      advanced: { ...baseMachine.advanced, qemu_args: '' }
    };
    const result = normalizeCustomArgs(networkDisabled, ['-netdev bridge,id=net0', '-device rtl8139,netdev=net0']);
    expect(result.machine.network.enabled).toBe(true);
    expect(result.machine.network.mode).toBe('bridge');
    expect(result.machine.network.card).toBe('rtl8139');
    expect(result.machine.advanced.qemu_args).toBe('');
  });
});
