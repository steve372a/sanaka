import { describe, expect, it } from 'vitest';
import { QemuCommandBuilder, chooseAccelerator, deriveStableMacAddress } from './QemuCommandBuilder';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

describe('chooseAccelerator', () => {
  it('keeps an explicitly requested accelerator so QEMU can report the raw startup error', () => {
    expect(
      chooseAccelerator('kvm', 'darwin', 'x86_64', 'arm64', ['hvf', 'tcg'])
    ).toBe('kvm');
  });

  it('still falls back to the platform default when no accelerator is specified', () => {
    expect(
      chooseAccelerator(null, 'darwin', 'aarch64', 'arm64', ['hvf', 'tcg'])
    ).toBe('hvf');
  });

  it('keeps mttcg when it is explicitly requested', () => {
    expect(
      chooseAccelerator('mttcg', 'win32', 'x86_64', 'x64', ['whpx', 'tcg', 'mttcg'])
    ).toBe('mttcg');
  });
});

describe('QemuCommandBuilder machine types', () => {
  function makeTempQcow2(tempRoot, name) {
    const diskPath = path.join(tempRoot, name);
    const result = spawnSync('/opt/homebrew/bin/qemu-img', ['create', '-f', 'qcow2', diskPath, '8M'], { encoding: 'utf8' });
    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || 'qemu-img create failed');
    }
    return diskPath;
  }

  function expectQemuAcceptsTopology(binaryPath, args) {
    const probe = spawnSync(binaryPath, [...args, '-nodefaults', '-nographic', '-no-reboot'], { encoding: 'utf8', timeout: 1500 });
    const stderr = `${probe.stderr || ''}${probe.stdout || ''}`;
    expect(stderr).not.toMatch(/IDE unit .* is in use|supports only 1 units|Bus '.*' not found|can't attach|Could not open/);
  }

  it('derives a stable locally administered MAC address from the machine id', () => {
    expect(deriveStableMacAddress('vm-mac-test')).toBe(deriveStableMacAddress('vm-mac-test'));
    expect(deriveStableMacAddress('vm-mac-test')).toMatch(/^52:54:00:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}$/);
  });

  it('silently disables vapic for x86 guests on QEMU 11.0.0', () => {
    const builder = new QemuCommandBuilder();
    const result = builder.build({
      machine: {
        title: 'Windows XP',
        system: {
          arch: 'x86_64',
          machine_type: 'pc-i440fx-9.2',
          accelerator: 'tcg',
          boot_order: 'disk',
          memory_mib: 512,
          cpu_cores: 1,
          sound_card: 'ac97',
          uefi: false
        },
        media: { iso: '', floppy: '' },
        disks: [],
        network: { enabled: false, mode: 'user', card: 'rtl8139' },
        display: { frontend: 'sanaka', gpu: 'std', sanaka: { backend: 'vnc', scale_mode: 'fit', clipboard: true } },
        peripherals: { usb_tablet: true },
        advanced: { audio_backend: 'auto', qemu_args: '' }
      },
      environment: {
        binaries: {
          x86_64: { found: true, path: '/usr/bin/qemu-system-x86_64', version: 'QEMU emulator version 11.0.0' }
        },
        accelerators: ['tcg']
      },
      runtimePaths: {
        qmp: { transport: 'tcp', host: '127.0.0.1', port: 47001 }
      },
      displayConfig: {
        port: 5901,
        websocketPort: 5701,
        displayNumber: 1
      },
      host: {
        platform: 'win32',
        arch: 'x64'
      }
    });

    expect(result.args).toContain('-global');
    expect(result.args).toContain('apic.vapic=off');
  });

  it('does not add the vapic workaround on QEMU 11.0.1', () => {
    const builder = new QemuCommandBuilder();
    const result = builder.build({
      machine: {
        title: 'Windows XP',
        system: {
          arch: 'x86_64',
          machine_type: 'pc-i440fx-9.2',
          accelerator: 'tcg',
          boot_order: 'disk',
          memory_mib: 512,
          cpu_cores: 1,
          sound_card: 'ac97',
          uefi: false
        },
        media: { iso: '', floppy: '' },
        disks: [],
        network: { enabled: false, mode: 'user', card: 'rtl8139' },
        display: { frontend: 'sanaka', gpu: 'std', sanaka: { backend: 'vnc', scale_mode: 'fit', clipboard: true } },
        peripherals: { usb_tablet: true },
        advanced: { audio_backend: 'auto', qemu_args: '' }
      },
      environment: {
        binaries: {
          x86_64: { found: true, path: '/usr/bin/qemu-system-x86_64', version: 'QEMU emulator version 11.0.1' }
        },
        accelerators: ['tcg']
      },
      runtimePaths: {
        qmp: { transport: 'tcp', host: '127.0.0.1', port: 47001 }
      },
      displayConfig: {
        port: 5901,
        websocketPort: 5701,
        displayNumber: 1
      },
      host: {
        platform: 'win32',
        arch: 'x64'
      }
    });

    expect(result.args).not.toContain('apic.vapic=off');
  });

  it('uses the dedicated qemu-system-arm binary for arm guests', () => {
    const builder = new QemuCommandBuilder();
    const result = builder.build({
      machine: {
        title: 'ARM Guest',
        system: {
          arch: 'arm',
          machine_type: 'virt',
          accelerator: 'tcg',
          boot_order: 'disk',
          memory_mib: 512,
          cpu_cores: 1,
          sound_card: 'sb16',
          uefi: false
        },
        media: { iso: '', floppy: '' },
        disks: [],
        network: { enabled: false, mode: 'user', card: 'rtl8139' },
        display: { frontend: 'sanaka', gpu: 'std', sanaka: { backend: 'vnc', scale_mode: 'fit', clipboard: true } },
        peripherals: { usb_tablet: true },
        advanced: { audio_backend: 'auto', qemu_args: '' }
      },
      environment: {
        binaries: {
          arm: { found: true, path: '/usr/bin/qemu-system-arm' }
        },
        accelerators: ['tcg']
      },
      runtimePaths: {
        qmp: { transport: 'tcp', host: '127.0.0.1', port: 47001 }
      },
      displayConfig: {
        port: 5901,
        websocketPort: 5701,
        displayNumber: 1
      },
      host: {
        platform: 'darwin',
        arch: 'arm64'
      }
    });

    expect(result.binaryPath).toBe('/usr/bin/qemu-system-arm');
  });

  it('rejects machines that still have custom placeholder hardware values', () => {
    const builder = new QemuCommandBuilder();

    expect(() =>
      builder.build({
        machine: {
          title: 'Custom Placeholder',
          system: {
            arch: 'none',
            machine_type: 'none',
            accelerator: 'none',
            boot_order: 'none',
            memory_mib: 2048,
            cpu_cores: 2,
            sound_card: 'none',
            uefi: false
          },
          media: { iso: '', floppy: '' },
          disks: [],
          network: { enabled: false, mode: 'user', card: 'none' },
          display: { frontend: 'sanaka', gpu: 'none', sanaka: { backend: 'vnc', scale_mode: 'fit', clipboard: true } },
          peripherals: { usb_tablet: true },
          advanced: { audio_backend: 'auto', qemu_args: '' }
        },
        environment: {
          binaries: {},
          accelerators: ['tcg']
        },
        runtimePaths: {
          qmp: { transport: 'tcp', host: '127.0.0.1', port: 47001 }
        },
        displayConfig: {
          port: 5901,
          websocketPort: 5701,
          displayNumber: 1
        },
        host: {
          platform: 'darwin',
          arch: 'arm64'
        }
      })
    ).toThrow('Machine architecture is not configured yet.');
  });

  it('allows gpu none and omits display hardware args', () => {
    const builder = new QemuCommandBuilder();
    const result = builder.build({
      machine: {
        title: 'Headless Display None',
        system: {
          arch: 'x86_64',
          machine_type: 'pc-q35-9.2',
          accelerator: 'tcg',
          boot_order: 'disk',
          memory_mib: 2048,
          cpu_cores: 2,
          sound_card: 'intel-hda',
          uefi: false
        },
        media: { iso: '', floppy: '' },
        disks: [],
        network: { enabled: false, mode: 'user', card: 'rtl8139' },
        display: { frontend: 'sanaka', gpu: 'none', sanaka: { backend: 'vnc', scale_mode: 'fit', clipboard: true } },
        peripherals: { usb_tablet: true },
        advanced: { audio_backend: 'auto', qemu_args: '' }
      },
      environment: {
        binaries: {
          x86_64: { found: true, path: '/usr/bin/qemu-system-x86_64' }
        },
        accelerators: ['tcg']
      },
      runtimePaths: {
        qmp: { transport: 'tcp', host: '127.0.0.1', port: 47001 }
      },
      displayConfig: {
        port: 5901,
        websocketPort: 5701,
        displayNumber: 1
      },
      host: {
        platform: 'darwin',
        arch: 'arm64'
      }
    });

    expect(result.args).not.toContain('-vga');
  });

  it('emits -machine q35 for x86 machines configured with q35', () => {
    const builder = new QemuCommandBuilder();
    const result = builder.build({
      machine: {
        title: 'Test Machine',
        system: {
          arch: 'x86_64',
          machine_type: 'q35',
          accelerator: 'tcg',
          boot_order: 'cdrom',
          memory_mib: 2048,
          cpu_cores: 2,
          sound_card: 'intel-hda'
        },
        media: { iso: '', floppy: '' },
        disks: [],
        network: { enabled: false, mode: 'user', card: 'virtio-net-pci' },
        display: { frontend: 'sanaka', gpu: 'virtio-vga', sanaka: { backend: 'vnc', scale_mode: 'fit', clipboard: true } },
        peripherals: { usb_tablet: true },
        advanced: { audio_backend: 'auto', qemu_args: '' }
      },
      environment: {
        binaries: {
          x86_64: { found: true, path: '/usr/bin/qemu-system-x86_64' }
        },
        accelerators: ['tcg']
      },
      runtimePaths: {
        qmp: { transport: 'tcp', host: '127.0.0.1', port: 47001 }
      },
      displayConfig: {
        port: 5901,
        websocketPort: 5701,
        displayNumber: 1
      },
      host: {
        platform: 'darwin',
        arch: 'arm64'
      }
    });

    expect(result.args).toContain('-machine');
    expect(result.args).toContain('q35');
  });

  it('emits -machine pc for x86 machines configured with pc', () => {
    const builder = new QemuCommandBuilder();
    const result = builder.build({
      machine: {
        title: 'Test Machine',
        system: {
          arch: 'i386',
          machine_type: 'pc',
          accelerator: 'tcg',
          boot_order: 'cdrom',
          memory_mib: 512,
          cpu_cores: 1,
          sound_card: 'ac97'
        },
        media: { iso: '', floppy: '' },
        disks: [],
        network: { enabled: false, mode: 'user', card: 'rtl8139' },
        display: { frontend: 'sanaka', gpu: 'cirrus-vga', sanaka: { backend: 'vnc', scale_mode: 'fit', clipboard: true } },
        peripherals: { usb_tablet: true },
        advanced: { audio_backend: 'auto', qemu_args: '' }
      },
      environment: {
        binaries: {
          i386: { found: true, path: '/usr/bin/qemu-system-i386' }
        },
        accelerators: ['tcg']
      },
      runtimePaths: {
        qmp: { transport: 'tcp', host: '127.0.0.1', port: 47001 }
      },
      displayConfig: {
        port: 5901,
        websocketPort: 5701,
        displayNumber: 1
      },
      host: {
        platform: 'darwin',
        arch: 'arm64'
      }
    });

    expect(result.args).toContain('-machine');
    expect(result.args).toContain('pc');
  });

  it('maps sata disks through an AHCI controller', () => {
    const builder = new QemuCommandBuilder();
    const result = builder.build({
      machine: {
        id: 'windows10-sata',
        title: 'Windows 10',
        system: {
          arch: 'x86_64',
          machine_type: 'q35',
          accelerator: 'tcg',
          boot_order: 'disk',
          memory_mib: 2048,
          cpu_cores: 2,
          sound_card: 'intel-hda',
          uefi: false
        },
        media: { iso: '', floppy: '' },
        disks: [
          {
            id: 'disk0',
            path: '/tmp/windows10.qcow2',
            format: 'qcow2',
            interface: 'sata',
            boot: true,
            readonly: false
          }
        ],
        network: { enabled: true, mode: 'user', card: 'rtl8139' },
        display: { frontend: 'sanaka', gpu: 'std', sanaka: { backend: 'vnc', scale_mode: 'fit', clipboard: true } },
        peripherals: { usb_tablet: true },
        advanced: { audio_backend: 'auto', qemu_args: '' }
      },
      environment: {
        binaries: {
          x86_64: { found: true, path: '/usr/bin/qemu-system-x86_64' }
        },
        accelerators: ['tcg']
      },
      runtimePaths: {
        runtimeDir: '/tmp/sanaka-runtime',
        qmp: { transport: 'tcp', host: '127.0.0.1', port: 47001 }
      },
      displayConfig: {
        port: 5901,
        websocketPort: 5701,
        displayNumber: 1
      },
      host: {
        platform: 'darwin',
        arch: 'arm64'
      }
    });

    expect(result.args).toContain('ich9-ahci,id=ahci0');
    expect(result.args).toContain('ide-hd,drive=drive0,bus=ahci0.1');
    expect(result.args).toContain(`rtl8139,netdev=net0,mac=${deriveStableMacAddress('windows10-sata')}`);
  });

  it('maps mttcg to tcg multi-thread mode', () => {
    const builder = new QemuCommandBuilder();
    const result = builder.build({
      machine: {
        id: 'mttcg-test',
        title: 'MTTCG',
        system: {
          arch: 'x86_64',
          machine_type: 'pc',
          accelerator: 'mttcg',
          boot_order: 'disk',
          memory_mib: 1024,
          cpu_cores: 2,
          sound_card: 'ac97',
          uefi: false
        },
        media: { iso: '', floppy: '' },
        disks: [],
        network: { enabled: false, mode: 'user', card: 'rtl8139' },
        display: { frontend: 'sanaka', gpu: 'std', sanaka: { backend: 'vnc', scale_mode: 'fit', clipboard: true } },
        peripherals: { usb_tablet: true },
        advanced: { audio_backend: 'auto', qemu_args: '' }
      },
      environment: {
        binaries: {
          x86_64: { found: true, path: '/usr/bin/qemu-system-x86_64', version: 'QEMU emulator version 9.0.0' }
        },
        accelerators: ['tcg', 'mttcg']
      },
      runtimePaths: {
        qmp: { transport: 'tcp', host: '127.0.0.1', port: 47001 }
      },
      displayConfig: {
        port: 5901,
        websocketPort: 5701,
        displayNumber: 1
      },
      host: {
        platform: 'linux',
        arch: 'x64'
      }
    });

    const accelIndex = result.args.indexOf('-accel');
    expect(accelIndex).toBeGreaterThan(-1);
    expect(result.args[accelIndex + 1]).toBe('tcg,thread=multi');
  });

  it('merges hostfwd advanced args into the generated user netdev instead of appending a broken standalone token', () => {
    const builder = new QemuCommandBuilder();
    const result = builder.build({
      machine: {
        id: 'debian-port-forward',
        title: 'Debian',
        system: {
          arch: 'x86_64',
          machine_type: 'pc-q35-9.2',
          accelerator: 'tcg',
          boot_order: 'disk',
          memory_mib: 2048,
          cpu_cores: 2,
          sound_card: 'intel-hda',
          uefi: false
        },
        media: { iso: '', floppy: '' },
        disks: [],
        network: { enabled: true, mode: 'user', card: 'rtl8139' },
        display: { frontend: 'sanaka', gpu: 'std', sanaka: { backend: 'vnc', scale_mode: 'fit', clipboard: true } },
        peripherals: { usb_tablet: true },
        advanced: { audio_backend: 'auto', qemu_args: 'hostfwd=tcp::5555-:22' }
      },
      environment: {
        binaries: {
          x86_64: { found: true, path: '/usr/bin/qemu-system-x86_64' }
        },
        accelerators: ['tcg']
      },
      runtimePaths: {
        qmp: { transport: 'tcp', host: '127.0.0.1', port: 47001 }
      },
      displayConfig: {
        port: 5901,
        websocketPort: 5701,
        displayNumber: 1
      },
      host: {
        platform: 'win32',
        arch: 'x64'
      }
    });

    const netdevIndex = result.args.indexOf('-netdev');
    expect(netdevIndex).toBeGreaterThan(-1);
    expect(result.args[netdevIndex + 1]).toContain('user,id=net0,hostfwd=tcp::5555-:22');
    expect(result.args).not.toContain('hostfwd=tcp::5555-:22');
  });

  it('rejects hostfwd advanced args when machine networking is disabled', () => {
    const builder = new QemuCommandBuilder();

    expect(() =>
      builder.build({
        machine: {
          id: 'debian-no-network',
          title: 'Debian',
          system: {
            arch: 'x86_64',
            machine_type: 'pc-q35-9.2',
            accelerator: 'tcg',
            boot_order: 'disk',
            memory_mib: 2048,
            cpu_cores: 2,
            sound_card: 'intel-hda',
            uefi: false
          },
          media: { iso: '', floppy: '' },
          disks: [],
          network: { enabled: false, mode: 'user', card: 'rtl8139' },
          display: { frontend: 'sanaka', gpu: 'std', sanaka: { backend: 'vnc', scale_mode: 'fit', clipboard: true } },
          peripherals: { usb_tablet: true },
          advanced: { audio_backend: 'auto', qemu_args: 'hostfwd=tcp::5555-:22' }
        },
        environment: {
          binaries: {
            x86_64: { found: true, path: '/usr/bin/qemu-system-x86_64' }
          },
          accelerators: ['tcg']
        },
        runtimePaths: {
          qmp: { transport: 'tcp', host: '127.0.0.1', port: 47001 }
        },
        displayConfig: {
          port: 5901,
          websocketPort: 5701,
          displayNumber: 1
        },
        host: {
          platform: 'win32',
          arch: 'x64'
        }
      })
    ).toThrow('hostfwd/guestfwd requires Sanaka machine networking to be enabled.');
  });

  it('maps q35 cdroms through AHCI instead of assuming a legacy IDE bus', () => {
    const builder = new QemuCommandBuilder();
    const result = builder.build({
      machine: {
        id: 'q35-cdrom-test',
        title: 'Q35 CDROM',
        system: {
          arch: 'x86_64',
          machine_type: 'pc-q35-9.2',
          accelerator: 'tcg',
          boot_order: 'cdrom',
          memory_mib: 2048,
          cpu_cores: 2,
          sound_card: 'intel-hda',
          uefi: false
        },
        media: { iso: '/tmp/installer.iso', floppy: '' },
        disks: [],
        network: { enabled: false, mode: 'user', card: 'rtl8139' },
        display: { frontend: 'sanaka', gpu: 'std', sanaka: { backend: 'vnc', scale_mode: 'fit', clipboard: true } },
        peripherals: { usb_tablet: true },
        advanced: { audio_backend: 'auto', qemu_args: '' }
      },
      environment: {
        binaries: {
          x86_64: { found: true, path: '/usr/bin/qemu-system-x86_64' }
        },
        accelerators: ['tcg']
      },
      runtimePaths: {
        runtimeDir: '/tmp/sanaka-runtime',
        qmp: { transport: 'tcp', host: '127.0.0.1', port: 47001 }
      },
      displayConfig: {
        port: 5901,
        websocketPort: 5701,
        displayNumber: 1
      },
      host: {
        platform: 'darwin',
        arch: 'arm64'
      }
    });

    expect(result.args).toContain('ich9-ahci,id=ahci0');
    expect(result.args).toContain('ide-cd,id=cdrom0,drive=cd0,bus=ahci0.0');
    expect(result.args).not.toContain('ide-cd,id=cdrom0,drive=cd0,bus=ide.1');
  });

  it('builds a valid q35 topology for one cdrom plus one sata disk', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sanaka-q35-topology-'));
    const diskPath = makeTempQcow2(tempRoot, 'disk0.qcow2');
    const isoPath = path.join(tempRoot, 'installer.iso');
    fs.writeFileSync(isoPath, '');
    const builder = new QemuCommandBuilder();
    const result = builder.build({
      machine: {
        id: 'q35-topology-test',
        title: 'Q35 Topology',
        system: {
          arch: 'x86_64',
          machine_type: 'pc-q35-9.2',
          accelerator: 'tcg',
          boot_order: 'cdrom',
          memory_mib: 512,
          cpu_cores: 1,
          sound_card: 'intel-hda',
          uefi: false
        },
        media: { iso: isoPath, floppy: '' },
        disks: [{ id: 'disk0', path: diskPath, format: 'qcow2', interface: 'sata' }],
        network: { enabled: false, mode: 'user', card: 'rtl8139' },
        display: { frontend: 'sanaka', gpu: 'std', sanaka: { backend: 'vnc', scale_mode: 'fit', clipboard: true } },
        peripherals: { usb_tablet: false },
        advanced: { audio_backend: 'auto', qemu_args: '' }
      },
      environment: {
        binaries: {
          x86_64: { found: true, path: '/opt/homebrew/bin/qemu-system-x86_64' }
        },
        accelerators: ['tcg']
      },
      runtimePaths: {
        runtimeDir: tempRoot,
        qmp: { transport: 'tcp', host: '127.0.0.1', port: 47101 }
      },
      displayConfig: {
        port: 5901,
        websocketPort: 5701,
        displayNumber: 1
      },
      host: {
        platform: 'darwin',
        arch: 'arm64'
      }
    });

    expectQemuAcceptsTopology(result.binaryPath, result.args);
  });

  it('builds a valid i440fx topology for one cdrom plus two ide disks', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sanaka-i440fx-topology-'));
    const disk0 = makeTempQcow2(tempRoot, 'disk0.qcow2');
    const disk1 = makeTempQcow2(tempRoot, 'disk1.qcow2');
    const isoPath = path.join(tempRoot, 'installer.iso');
    fs.writeFileSync(isoPath, '');
    const builder = new QemuCommandBuilder();
    const result = builder.build({
      machine: {
        id: 'i440fx-topology-test',
        title: 'i440fx Topology',
        system: {
          arch: 'x86_64',
          machine_type: 'pc-i440fx-9.2',
          accelerator: 'tcg',
          boot_order: 'cdrom',
          memory_mib: 512,
          cpu_cores: 1,
          sound_card: 'ac97',
          uefi: false
        },
        media: { iso: isoPath, floppy: '' },
        disks: [
          { id: 'disk0', path: disk0, format: 'qcow2', interface: 'ide' },
          { id: 'disk1', path: disk1, format: 'qcow2', interface: 'ide' }
        ],
        network: { enabled: false, mode: 'user', card: 'rtl8139' },
        display: { frontend: 'sanaka', gpu: 'std', sanaka: { backend: 'vnc', scale_mode: 'fit', clipboard: true } },
        peripherals: { usb_tablet: false },
        advanced: { audio_backend: 'auto', qemu_args: '' }
      },
      environment: {
        binaries: {
          x86_64: { found: true, path: '/opt/homebrew/bin/qemu-system-x86_64' }
        },
        accelerators: ['tcg']
      },
      runtimePaths: {
        runtimeDir: tempRoot,
        qmp: { transport: 'tcp', host: '127.0.0.1', port: 47102 }
      },
      displayConfig: {
        port: 5902,
        websocketPort: 5702,
        displayNumber: 2
      },
      host: {
        platform: 'darwin',
        arch: 'arm64'
      }
    });

    expectQemuAcceptsTopology(result.binaryPath, result.args);
    expect(result.args).toContain('ide-cd,id=cdrom0,drive=cd0,bus=ide.1');
    expect(result.args).toContain('ide-hd,drive=drive0,bus=ide.0');
    expect(result.args).toContain('ide-hd,drive=drive1,bus=ide.1');
  });

  it('uses a SCSI cdrom on aarch64 virt machines to avoid missing IDE buses', () => {
    const builder = new QemuCommandBuilder();
    const result = builder.build({
      machine: {
        id: 'aarch64-cdrom-test',
        title: 'ARM Installer',
        system: {
          arch: 'aarch64',
          machine_type: 'virt',
          accelerator: 'tcg',
          boot_order: 'cdrom',
          memory_mib: 2048,
          cpu_cores: 2,
          sound_card: 'intel-hda',
          uefi: false
        },
        media: { iso: '/tmp/arm.iso', floppy: '' },
        disks: [],
        network: { enabled: false, mode: 'user', card: 'virtio-net-pci' },
        display: { frontend: 'sanaka', gpu: 'std', sanaka: { backend: 'vnc', scale_mode: 'fit', clipboard: true } },
        peripherals: { usb_tablet: true },
        advanced: { audio_backend: 'auto', qemu_args: '' }
      },
      environment: {
        binaries: {
          aarch64: { found: true, path: '/usr/bin/qemu-system-aarch64' }
        },
        accelerators: ['tcg']
      },
      runtimePaths: {
        runtimeDir: '/tmp/sanaka-runtime',
        qmp: { transport: 'tcp', host: '127.0.0.1', port: 47001 }
      },
      displayConfig: {
        port: 5901,
        websocketPort: 5701,
        displayNumber: 1
      },
      host: {
        platform: 'darwin',
        arch: 'arm64'
      }
    });

    expect(result.args).toContain('virtio-scsi-pci,id=scsi0');
    expect(result.args).toContain('scsi-cd,drive=cd0,bus=scsi0.0');
    expect(result.args).not.toContain('ide-cd,id=cdrom0,drive=cd0');
  });

  it('uses the pseries SCSI controller for ppc64 optical media and disks', () => {
    const builder = new QemuCommandBuilder();
    const result = builder.build({
      machine: {
        id: 'ppc64-pseries-test',
        title: 'PPC64 Guest',
        system: {
          arch: 'ppc64',
          machine_type: 'pseries',
          accelerator: 'tcg',
          boot_order: 'cdrom',
          memory_mib: 2048,
          cpu_cores: 2,
          sound_card: 'intel-hda',
          uefi: false
        },
        media: { iso: '/tmp/ppc64.iso', floppy: '' },
        disks: [
          {
            id: 'disk0',
            path: '/tmp/ppc64.qcow2',
            format: 'qcow2',
            interface: 'ide',
            boot: true,
            readonly: false
          }
        ],
        network: { enabled: false, mode: 'user', card: 'rtl8139' },
        display: { frontend: 'sanaka', gpu: 'std', sanaka: { backend: 'vnc', scale_mode: 'fit', clipboard: true } },
        peripherals: { usb_tablet: true },
        advanced: { audio_backend: 'auto', qemu_args: '' }
      },
      environment: {
        binaries: {
          ppc64: { found: true, path: '/usr/bin/qemu-system-ppc64' }
        },
        accelerators: ['tcg']
      },
      runtimePaths: {
        runtimeDir: '/tmp/sanaka-runtime',
        qmp: { transport: 'tcp', host: '127.0.0.1', port: 47001 }
      },
      displayConfig: {
        port: 5901,
        websocketPort: 5701,
        displayNumber: 1
      },
      host: {
        platform: 'linux',
        arch: 'x64'
      }
    });

    expect(result.args).toContain('spapr-vscsi,id=scsi0');
    expect(result.args).toContain('scsi-cd,drive=cd0,bus=scsi0.0');
    expect(result.args).toContain('scsi-hd,drive=drive0,bus=scsi0.0');
  });

  it('respects the configured gpu for riscv64 guests instead of force-overriding it to virtio-gpu-pci', () => {
    const builder = new QemuCommandBuilder();
    const result = builder.build({
      machine: {
        id: 'riscv64-gpu-test',
        title: 'RISC-V Guest',
        system: {
          arch: 'riscv64',
          machine_type: 'virt',
          accelerator: 'tcg',
          boot_order: 'cdrom',
          memory_mib: 2048,
          cpu_cores: 2,
          sound_card: 'intel-hda',
          uefi: false
        },
        media: { iso: '/tmp/riscv64.iso', floppy: '' },
        disks: [],
        network: { enabled: false, mode: 'user', card: 'virtio-net-pci' },
        display: { frontend: 'sanaka', gpu: 'std', sanaka: { backend: 'vnc', scale_mode: 'fit', clipboard: true } },
        peripherals: { usb_tablet: true },
        advanced: { audio_backend: 'auto', qemu_args: '' }
      },
      environment: {
        binaries: {
          riscv64: { found: true, path: '/usr/bin/qemu-system-riscv64' }
        },
        accelerators: ['tcg']
      },
      runtimePaths: {
        runtimeDir: '/tmp/sanaka-runtime',
        qmp: { transport: 'tcp', host: '127.0.0.1', port: 47001 }
      },
      displayConfig: {
        port: 5901,
        websocketPort: 5701,
        displayNumber: 1
      },
      host: {
        platform: 'linux',
        arch: 'x64'
      }
    });

    expect(result.args).toContain('-vga');
    expect(result.args).toContain('std');
    expect(result.args).not.toContain('virtio-gpu-pci');
  });

  it('adds pflash firmware drives when UEFI is enabled', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sanaka-qemu-'));
    const fakeBinaryPath = path.join(tempRoot, 'bin', 'qemu-system-x86_64');
    const shareDir = path.join(tempRoot, 'share', 'qemu');
    fs.mkdirSync(path.dirname(fakeBinaryPath), { recursive: true });
    fs.mkdirSync(shareDir, { recursive: true });
    fs.writeFileSync(fakeBinaryPath, '');
    fs.writeFileSync(path.join(shareDir, 'edk2-x86_64-code.fd'), 'code');
    fs.writeFileSync(path.join(shareDir, 'edk2-i386-vars.fd'), 'vars');

    const builder = new QemuCommandBuilder();
    const runtimeDir = path.join(tempRoot, 'runtime');
    fs.mkdirSync(runtimeDir, { recursive: true });

    const result = builder.build({
      machine: {
        title: 'UEFI Machine',
        system: {
          arch: 'x86_64',
          machine_type: 'q35',
          accelerator: 'tcg',
          boot_order: 'disk',
          memory_mib: 2048,
          cpu_cores: 2,
          sound_card: 'intel-hda',
          uefi: true
        },
        media: { iso: '', floppy: '' },
        disks: [],
        network: { enabled: false, mode: 'user', card: 'rtl8139' },
        display: { frontend: 'sanaka', gpu: 'std', sanaka: { backend: 'vnc', scale_mode: 'fit', clipboard: true } },
        peripherals: { usb_tablet: true },
        advanced: { audio_backend: 'auto', qemu_args: '' }
      },
      environment: {
        binaries: {
          x86_64: { found: true, path: fakeBinaryPath }
        },
        accelerators: ['tcg']
      },
      runtimePaths: {
        runtimeDir,
        qmp: { transport: 'tcp', host: '127.0.0.1', port: 47001 }
      },
      displayConfig: {
        port: 5901,
        websocketPort: 5701,
        displayNumber: 1
      },
      host: {
        platform: 'darwin',
        arch: 'arm64'
      }
    });

    expect(result.args).toContain(`if=pflash,format=raw,readonly=on,file=${path.join(shareDir, 'edk2-x86_64-code.fd')}`);
    expect(result.args.some((value) => String(value).includes('uefi-x86_64-vars.fd'))).toBe(true);
  });

  it('resolves bundled Windows share firmware next to the embedded qemu directory', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sanaka-qemu-win-'));
    const fakeBinaryPath = path.join(tempRoot, 'qemu', 'bin', 'qemu-system-x86_64.exe');
    const shareDir = path.join(tempRoot, 'qemu', 'share', 'qemu');
    fs.mkdirSync(path.dirname(fakeBinaryPath), { recursive: true });
    fs.mkdirSync(shareDir, { recursive: true });
    fs.writeFileSync(fakeBinaryPath, '');
    fs.writeFileSync(path.join(shareDir, 'edk2-x86_64-code.fd'), 'code');
    fs.writeFileSync(path.join(shareDir, 'edk2-i386-vars.fd'), 'vars');

    const builder = new QemuCommandBuilder();
    const runtimeDir = path.join(tempRoot, 'runtime');
    fs.mkdirSync(runtimeDir, { recursive: true });

    const result = builder.build({
      machine: {
        title: 'Windows Embedded QEMU',
        system: {
          arch: 'x86_64',
          machine_type: 'q35',
          accelerator: 'tcg',
          boot_order: 'disk',
          memory_mib: 2048,
          cpu_cores: 2,
          sound_card: 'intel-hda',
          uefi: true
        },
        media: { iso: '', floppy: '' },
        disks: [],
        network: { enabled: false, mode: 'user', card: 'rtl8139' },
        display: { frontend: 'sanaka', gpu: 'std', sanaka: { backend: 'vnc', scale_mode: 'fit', clipboard: true } },
        peripherals: { usb_tablet: true },
        advanced: { audio_backend: 'auto', qemu_args: '' }
      },
      environment: {
        binaries: {
          x86_64: { found: true, path: fakeBinaryPath }
        },
        accelerators: ['tcg']
      },
      runtimePaths: {
        runtimeDir,
        qmp: { transport: 'tcp', host: '127.0.0.1', port: 47001 }
      },
      displayConfig: {
        port: 5901,
        websocketPort: 5701,
        displayNumber: 1
      },
      host: {
        platform: 'win32',
        arch: 'x64'
      }
    });

    expect(result.args).toContain(`if=pflash,format=raw,readonly=on,file=${path.join(shareDir, 'edk2-x86_64-code.fd')}`);
    const dataDirIndex = result.args.indexOf('-L');
    expect(dataDirIndex).toBeGreaterThanOrEqual(0);
    expect(result.args[dataDirIndex + 1]).toBe(shareDir);
  });

  it('normalizes Windows file paths before embedding them into -drive suboptions', () => {
    const builder = new QemuCommandBuilder();
    const result = builder.build({
      machine: {
        id: 'windows-paths',
        title: 'Windows Paths',
        system: {
          arch: 'x86_64',
          machine_type: 'q35',
          accelerator: 'tcg',
          boot_order: 'disk',
          memory_mib: 2048,
          cpu_cores: 2,
          sound_card: 'intel-hda',
          uefi: false
        },
        media: {
          iso: 'D:\\镜像\\CentOS-7-x86_64-DVD-2009.iso',
          floppy: 'A:\\工具\\boot.img'
        },
        disks: [
          {
            id: 'disk0',
            path: 'C:\\Downloads\\小叉屁\\xp.qcow2',
            format: 'qcow2',
            interface: 'virtio',
            readonly: false
          }
        ],
        network: { enabled: false, mode: 'user', card: 'rtl8139' },
        display: { frontend: 'sanaka', gpu: 'std', sanaka: { backend: 'vnc', scale_mode: 'fit', clipboard: true } },
        peripherals: { usb_tablet: true },
        advanced: { audio_backend: 'auto', qemu_args: '' }
      },
      environment: {
        binaries: {
          x86_64: { found: true, path: 'C:\\Program Files\\qemu\\qemu-system-x86_64.EXE' }
        },
        accelerators: ['tcg']
      },
      runtimePaths: {
        qmp: { transport: 'tcp', host: '127.0.0.1', port: 47001 }
      },
      displayConfig: {
        port: 5901,
        websocketPort: 5701,
        displayNumber: 1
      },
      host: {
        platform: 'win32',
        arch: 'x64'
      }
    });

    expect(result.args).toContain('if=none,id=cd0,media=cdrom,readonly=on,file=D:/镜像/CentOS-7-x86_64-DVD-2009.iso');
    expect(result.args).toContain('if=none,id=floppy0,media=disk,format=raw,file=A:/工具/boot.img');
    expect(result.args).toContain('file=C:/Downloads/小叉屁/xp.qcow2,format=qcow2,id=drive0,if=none');
  });

  it('supports custom third-party pflash CODE and VARS files for aarch64 UEFI', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sanaka-qemu-aarch64-'));
    const fakeBinaryPath = path.join(tempRoot, 'bin', 'qemu-system-aarch64');
    const codePath = path.join(tempRoot, 'firmware', 'AAVMF_CODE.fd');
    const varsPath = path.join(tempRoot, 'firmware', 'AAVMF_VARS.fd');
    fs.mkdirSync(path.dirname(fakeBinaryPath), { recursive: true });
    fs.mkdirSync(path.dirname(codePath), { recursive: true });
    fs.writeFileSync(fakeBinaryPath, '');
    fs.writeFileSync(codePath, 'code');
    fs.writeFileSync(varsPath, 'vars');

    const builder = new QemuCommandBuilder();
    const runtimeDir = path.join(tempRoot, 'runtime');
    fs.mkdirSync(runtimeDir, { recursive: true });

    const result = builder.build({
      machine: {
        title: 'ARM64 UEFI Machine',
        system: {
          arch: 'aarch64',
          machine_type: 'virt',
          accelerator: 'tcg',
          boot_order: 'disk',
          memory_mib: 2048,
          cpu_cores: 2,
          sound_card: 'intel-hda',
          uefi: true
        },
        media: { iso: '', floppy: '' },
        disks: [],
        network: { enabled: false, mode: 'user', card: 'virtio-net-pci' },
        display: { frontend: 'sanaka', gpu: 'virtio-gpu-pci', sanaka: { backend: 'vnc', scale_mode: 'fit', clipboard: true } },
        peripherals: { usb_tablet: true },
        advanced: {
          audio_backend: 'auto',
          qemu_args: '',
          firmware: {
            code_path: codePath,
            vars_path: varsPath
          }
        }
      },
      environment: {
        binaries: {
          aarch64: { found: true, path: fakeBinaryPath }
        },
        accelerators: ['tcg']
      },
      runtimePaths: {
        runtimeDir,
        qmp: { transport: 'tcp', host: '127.0.0.1', port: 47001 }
      },
      displayConfig: {
        port: 5901,
        websocketPort: 5701,
        displayNumber: 1
      },
      host: {
        platform: 'darwin',
        arch: 'arm64'
      }
    });

    expect(result.args).toContain(`if=pflash,format=raw,readonly=on,file=${codePath}`);
    expect(result.args).toContain(`if=pflash,format=raw,file=${varsPath}`);
  });

  it('supports custom third-party pflash CODE-only firmware when no VARS file is supplied', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sanaka-qemu-code-only-'));
    const fakeBinaryPath = path.join(tempRoot, 'bin', 'qemu-system-aarch64');
    const codePath = path.join(tempRoot, 'firmware', 'QEMU_EFI.fd');
    fs.mkdirSync(path.dirname(fakeBinaryPath), { recursive: true });
    fs.mkdirSync(path.dirname(codePath), { recursive: true });
    fs.writeFileSync(fakeBinaryPath, '');
    fs.writeFileSync(codePath, 'code');

    const builder = new QemuCommandBuilder();
    const runtimeDir = path.join(tempRoot, 'runtime');
    fs.mkdirSync(runtimeDir, { recursive: true });

    const result = builder.build({
      machine: {
        title: 'ARM64 CODE-only UEFI',
        system: {
          arch: 'aarch64',
          machine_type: 'virt',
          accelerator: 'tcg',
          boot_order: 'disk',
          memory_mib: 2048,
          cpu_cores: 2,
          sound_card: 'intel-hda',
          uefi: true
        },
        media: { iso: '', floppy: '' },
        disks: [],
        network: { enabled: false, mode: 'user', card: 'virtio-net-pci' },
        display: { frontend: 'sanaka', gpu: 'virtio-gpu-pci', sanaka: { backend: 'vnc', scale_mode: 'fit', clipboard: true } },
        peripherals: { usb_tablet: true },
        advanced: {
          audio_backend: 'auto',
          qemu_args: '',
          firmware: {
            code_path: codePath,
            vars_path: ''
          }
        }
      },
      environment: {
        binaries: {
          aarch64: { found: true, path: fakeBinaryPath }
        },
        accelerators: ['tcg']
      },
      runtimePaths: {
        runtimeDir,
        qmp: { transport: 'tcp', host: '127.0.0.1', port: 47001 }
      },
      displayConfig: {
        port: 5901,
        websocketPort: 5701,
        displayNumber: 1
      },
      host: {
        platform: 'darwin',
        arch: 'arm64'
      }
    });

    expect(result.args).toContain(`if=pflash,format=raw,readonly=on,file=${codePath}`);
    expect(result.args.filter((value) => String(value).includes('if=pflash,format=raw,file=')).length).toBe(0);
  });
});
