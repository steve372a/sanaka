const { deriveStableMacAddress, tokenizeUserArgs } = require('./QemuCommandBuilder');

const CONTROLLED_BINDINGS = {
  title: 'machine.title',
  machineType: 'system.machine_type',
  memory: 'system.memory_mib',
  cpu: 'system.cpu_cores',
  accel: 'system.accelerator',
  boot: 'system.boot_order',
  soundCard: 'system.sound_card',
  gpu: 'display.gpu',
  networkMode: 'network.mode',
  networkCard: 'network.card',
  usbTablet: 'peripherals.usb_tablet'
};

const VALID_ACCELERATORS = new Set(['none', 'tcg', 'mttcg', 'kvm', 'hax', 'whpx', 'hvf']);

function mapAcceleratorArg(accelerator) {
  if (accelerator === 'mttcg') {
    return 'tcg,thread=multi';
  }
  if (!accelerator || accelerator === 'none') {
    return 'tcg';
  }
  return accelerator;
}

function mapBootOrderArg(bootOrder) {
  if (bootOrder === 'cdrom') return 'd';
  if (bootOrder === 'disk') return 'c';
  if (bootOrder === 'floppy') return 'a';
  return null;
}

function unmapBootOrderArg(value) {
  if (value === 'd' || value === 'cdrom' || value === 'order=cdrom') return 'cdrom';
  if (value === 'c' || value === 'disk' || value === 'order=disk') return 'disk';
  if (value === 'a' || value === 'floppy' || value === 'order=floppy') return 'floppy';
  return null;
}

function makeControlledItem(bindingKey, raw) {
  return {
    id: `controlled:${bindingKey}`,
    raw,
    source: 'controlled',
    bindingKey,
    editable: true
  };
}

function makeCustomItem(raw, index) {
  return {
    id: `custom:${index}`,
    raw,
    source: 'custom',
    editable: true
  };
}

function splitCustomArgs(input) {
  const source = String(input || '').trim();
  if (!source) return [];
  const rawLines = source.includes('\n') ? source.split('\n') : mergeLegacySpaceArgs(tokenizeUserArgs(source));
  return rawLines.map((raw) => String(raw).trim()).filter(Boolean);
}

function mergeLegacySpaceArgs(tokens) {
  const knownValueFlags = new Set([
    '-m', '-smp', '-accel', '-boot', '-machine', '-cpu', '-name', '-pidfile', '-D', '-d',
    '-netdev', '-device', '-drive', '-blockdev', '-cdrom', '-fda', '-fdb', '-hda', '-hdb',
    '-hdc', '-hdd', '-pflash', '-bios', '-kernel', '-append', '-initrd', '-dtb',
    '-audiodev', '-audio', '-display', '-vga', '-chardev', '-fsdev',
    '-net', '-nic', '-serial', '-parallel', '-monitor', '-qmp', '-spice', '-vnc',
    '-global', '-set'
  ]);

  const result = [];
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index];
    if (knownValueFlags.has(token) && index + 1 < tokens.length) {
      result.push(`${token} ${tokens[index + 1]}`);
      index += 2;
      continue;
    }
    result.push(token);
    index += 1;
  }
  return result;
}

function buildControlledArgs(machine) {
  const args = [
    makeControlledItem(CONTROLLED_BINDINGS.memory, `-m ${machine.system.memory_mib}`),
    makeControlledItem(CONTROLLED_BINDINGS.cpu, `-smp ${machine.system.cpu_cores}`),
    makeControlledItem(CONTROLLED_BINDINGS.accel, `-accel ${mapAcceleratorArg(machine.system.accelerator)}`)
  ];

  const bootArg = mapBootOrderArg(machine.system.boot_order);
  if (bootArg) {
    args.push(makeControlledItem(CONTROLLED_BINDINGS.boot, `-boot ${bootArg}`));
  }

  if (machine.network?.enabled) {
    const mode = machine.network.mode === 'bridge' ? 'bridge' : 'user';
    args.push(makeControlledItem(CONTROLLED_BINDINGS.networkMode, `-netdev ${mode},id=net0`));
    if (machine.network.card && machine.network.card !== 'none') {
      args.push(
        makeControlledItem(
          CONTROLLED_BINDINGS.networkCard,
          `-device ${machine.network.card},netdev=net0,mac=${deriveStableMacAddress(machine.id)}`
        )
      );
    }
  }

  return args;
}

function classifyRaw(raw) {
  const tokens = tokenizeUserArgs(raw);
  const flag = tokens[0];
  if (flag === '-name') return { source: 'controlled', bindingKey: CONTROLLED_BINDINGS.title };
  if (flag === '-machine') return { source: 'controlled', bindingKey: CONTROLLED_BINDINGS.machineType };
  if (flag === '-m') return { source: 'controlled', bindingKey: CONTROLLED_BINDINGS.memory };
  if (flag === '-smp') return { source: 'controlled', bindingKey: CONTROLLED_BINDINGS.cpu };
  if (flag === '-accel') return { source: 'controlled', bindingKey: CONTROLLED_BINDINGS.accel };
  if (flag === '-boot') return { source: 'controlled', bindingKey: CONTROLLED_BINDINGS.boot };
  if (flag === '-vga') return { source: 'controlled', bindingKey: CONTROLLED_BINDINGS.gpu };
  if (flag === '-netdev') return { source: 'controlled', bindingKey: CONTROLLED_BINDINGS.networkMode };
  if (flag === '-device' && typeof tokens[1] === 'string' && tokens[1].includes('netdev=net0')) {
    return { source: 'controlled', bindingKey: CONTROLLED_BINDINGS.networkCard };
  }
  if (flag === '-device' && typeof tokens[1] === 'string') {
    const device = tokens[1].split(',')[0];
    if (device === 'intel-hda' || device === 'AC97' || device === 'sb16' || device === 'virtio-sound-pci') {
      return { source: 'controlled', bindingKey: CONTROLLED_BINDINGS.soundCard };
    }
    if (device === 'virtio-gpu-pci' || device === 'virtio-vga') {
      return { source: 'controlled', bindingKey: CONTROLLED_BINDINGS.gpu };
    }
    if (device === 'usb-tablet') {
      return { source: 'controlled', bindingKey: CONTROLLED_BINDINGS.usbTablet };
    }
  }
  if (flag === '-usb') {
    return { source: 'controlled', bindingKey: CONTROLLED_BINDINGS.usbTablet };
  }
  return { source: 'custom' };
}

function buildArgList(machine) {
  const controlled = buildControlledArgs(machine);
  const custom = splitCustomArgs(machine.advanced?.qemu_args || '');
  const cleanCustom = custom.filter((raw) => classifyRaw(raw).source === 'custom');
  return [...controlled, ...cleanCustom.map((raw, index) => makeCustomItem(raw, index))];
}

function applyControlledEdit(machine, bindingKey, raw) {
  const tokens = tokenizeUserArgs(raw);
  switch (bindingKey) {
    case CONTROLLED_BINDINGS.title: {
      if (tokens[0] !== '-name' || !tokens[1]) return null;
      return {
        ...machine,
        title: tokens.slice(1).join(' ')
      };
    }
    case CONTROLLED_BINDINGS.machineType: {
      if (tokens[0] !== '-machine' || !tokens[1]) return null;
      return {
        ...machine,
        system: {
          ...machine.system,
          machine_type: tokens[1]
        }
      };
    }
    case CONTROLLED_BINDINGS.memory: {
      if (tokens[0] !== '-m' || !tokens[1]) return null;
      const value = Number(tokens[1]);
      if (!Number.isFinite(value) || value < 64) return null;
      return {
        ...machine,
        system: {
          ...machine.system,
          memory_mib: value
        }
      };
    }
    case CONTROLLED_BINDINGS.cpu: {
      if (tokens[0] !== '-smp' || !tokens[1]) return null;
      const value = Number(tokens[1]);
      if (!Number.isFinite(value) || value < 1) return null;
      return {
        ...machine,
        system: {
          ...machine.system,
          cpu_cores: value
        }
      };
    }
    case CONTROLLED_BINDINGS.accel: {
      if (tokens[0] !== '-accel' || !tokens[1]) return null;
      const next = tokens[1] === 'tcg,thread=multi' ? 'mttcg' : tokens[1];
      if (!VALID_ACCELERATORS.has(next)) return null;
      return {
        ...machine,
        system: {
          ...machine.system,
          accelerator: next
        }
      };
    }
    case CONTROLLED_BINDINGS.boot: {
      if (tokens[0] !== '-boot' || !tokens[1]) return null;
      const bootOrder = unmapBootOrderArg(tokens[1]);
      if (!bootOrder) return null;
      return {
        ...machine,
        system: {
          ...machine.system,
          boot_order: bootOrder
        }
      };
    }
    case CONTROLLED_BINDINGS.soundCard: {
      if (tokens[0] !== '-device' || !tokens[1]) return null;
      const device = tokens[1].split(',')[0];
      if (!device) return null;
      return {
        ...machine,
        system: {
          ...machine.system,
          sound_card: device
        }
      };
    }
    case CONTROLLED_BINDINGS.gpu: {
      if (!tokens[0] || !tokens[1]) return null;
      if (tokens[0] === '-vga') {
        const value = tokens[1];
        const gpu = value === 'cirrus' ? 'cirrus-vga'
          : value === 'vmware' ? 'vmware-svga'
            : value === 'qxl' ? 'qxl'
              : value === 'std' ? 'std'
                : value;
        return {
          ...machine,
          display: {
            ...machine.display,
            gpu
          }
        };
      }
      if (tokens[0] === '-device') {
        const device = tokens[1].split(',')[0];
        if (!device) return null;
        return {
          ...machine,
          display: {
            ...machine.display,
            gpu: device
          }
        };
      }
      return null;
    }
    case CONTROLLED_BINDINGS.networkMode: {
      if (tokens[0] !== '-netdev' || !tokens[1]) return null;
      const mode = tokens[1].split(',')[0];
      if (mode !== 'user' && mode !== 'bridge') return null;
      return {
        ...machine,
        network: {
          ...machine.network,
          enabled: true,
          mode
        }
      };
    }
    case CONTROLLED_BINDINGS.networkCard: {
      if (tokens[0] !== '-device' || !tokens[1]) return null;
      const device = tokens[1].split(',')[0];
      if (!device || device === 'none') return null;
      return {
        ...machine,
        network: {
          ...machine.network,
          enabled: true,
          card: device
        }
      };
    }
    case CONTROLLED_BINDINGS.usbTablet: {
      if (tokens[0] !== '-usb' && tokens[0] !== '-device') return null;
      return {
        ...machine,
        peripherals: {
          ...machine.peripherals,
          usb_tablet: true
        }
      };
    }
    default:
      return null;
  }
}

function removeControlledArg(machine, bindingKey) {
  switch (bindingKey) {
    case CONTROLLED_BINDINGS.soundCard:
      return {
        ...machine,
        system: {
          ...machine.system,
          sound_card: 'none'
        }
      };
    case CONTROLLED_BINDINGS.gpu:
      return {
        ...machine,
        display: {
          ...machine.display,
          gpu: 'none'
        }
      };
    case CONTROLLED_BINDINGS.networkMode:
    case CONTROLLED_BINDINGS.networkCard:
      return {
        ...machine,
        network: {
          ...machine.network,
          enabled: false,
          card: 'none'
        }
      };
    case CONTROLLED_BINDINGS.usbTablet:
      return {
        ...machine,
        peripherals: {
          ...machine.peripherals,
          usb_tablet: false
        }
      };
    default:
      return null;
  }
}

function normalizeCustomArgs(machine, customArgs) {
  let nextMachine = structuredClone(machine);
  const remainingCustom = [];

  for (const rawValue of customArgs) {
    const raw = String(rawValue || '').trim();
    if (!raw) continue;
    const classification = classifyRaw(raw);
    if (classification.source === 'controlled' && classification.bindingKey) {
      const updated = applyControlledEdit(nextMachine, classification.bindingKey, raw);
      if (updated) {
        nextMachine = updated;
        continue;
      }
    }
    remainingCustom.push(raw);
  }

  nextMachine.advanced = {
    ...nextMachine.advanced,
    qemu_args: remainingCustom.join('\n')
  };

  return {
    machine: nextMachine,
    args: buildArgList(nextMachine)
  };
}

module.exports = {
  CONTROLLED_BINDINGS,
  applyControlledEdit,
  buildArgList,
  buildControlledArgs,
  classifyRaw,
  normalizeCustomArgs,
  removeControlledArg,
  splitCustomArgs
};
