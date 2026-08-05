import { describe, expect, it } from 'vitest';
import { createMachineFromTemplate } from './templates';

describe('template machine creation', () => {
  it('creates an opaque unique machine id instead of exposing a title slug', () => {
    const first = createMachineFromTemplate('win11');
    const second = createMachineFromTemplate('win11');

    expect(first.id).toMatch(/^machine-/);
    expect(second.id).toMatch(/^machine-/);
    expect(first.id).not.toBe(second.id);
    expect(first.id).not.toContain('win11-');
  });

  it('enables usb tablet by default for new machines', () => {
    const machine = createMachineFromTemplate('win98');
    expect(machine.peripherals.usb_tablet).toBe(true);
  });

  it('provides default memory and cpu values for new machines', () => {
    const machine = createMachineFromTemplate('win11');
    expect(machine.system.memory_mib).toBe(4096);
    expect(machine.system.cpu_cores).toBe(2);
  });

  it('keeps the q35 machine type for Windows 10', () => {
    const machine = createMachineFromTemplate('win11');
    expect(machine.system.machine_type).toBe('pc-q35-9.2');
  });

  it('provides a compatibility-first Windows XP template', () => {
    const machine = createMachineFromTemplate('winxp');
    expect(machine.template.label).toBe('Windows XP');
    expect(machine.system.arch).toBe('i386');
    expect(machine.system.machine_type).toBe('pc-i440fx-9.2');
    expect(machine.system.memory_mib).toBe(512);
    expect(machine.system.cpu_cores).toBe(1);
    expect(machine.system.sound_card).toBe('ac97');
    expect(machine.network.card).toBe('rtl8139');
    expect(machine.display.gpu).toBe('std');
  });

  it('creates a truly blank custom machine instead of pre-filling a hidden x86 setup', () => {
    const machine = createMachineFromTemplate('custom');
    expect(machine.template.label).toBe('Custom');
    expect(machine.system.arch).toBe('none');
    expect(machine.system.machine_type).toBe('none');
    expect(machine.system.accelerator).toBe('none');
    expect(machine.system.sound_card).toBe('none');
    expect(machine.system.boot_order).toBe('none');
    expect(machine.network.enabled).toBe(false);
    expect(machine.network.card).toBe('none');
    expect(machine.display.gpu).toBe('none');
  });

  it('uses compatibility-first defaults for the Linux template', () => {
    const machine = createMachineFromTemplate('linux');
    expect(machine.system.arch).toBe('x86_64');
    expect(machine.system.machine_type).toBe('pc-q35-9.2');
    expect(machine.network.card).toBe('e1000');
    expect(machine.display.gpu).toBe('std');
  });
});
