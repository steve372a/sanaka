const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function tokenizeUserArgs(input) {
  const tokens = [];
  const source = String(input || '').trim();
  if (!source) {
    return tokens;
  }

  let current = '';
  let quote = null;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (quote) {
      if (char === quote) {
        quote = null;
      } else if (char === '\\' && index + 1 < source.length) {
        index += 1;
        current += source[index];
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === '\'') {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

function splitAdvancedUserArgs(tokens) {
  const passthroughArgs = [];
  const userNetdevExtras = [];

  for (const token of tokens) {
    if (typeof token === 'string' && (token.startsWith('hostfwd=') || token.startsWith('guestfwd='))) {
      userNetdevExtras.push(token);
      continue;
    }
    passthroughArgs.push(token);
  }

  return {
    passthroughArgs,
    userNetdevExtras
  };
}

function guestFamily(guestArch) {
  if (guestArch === 'x86_64' || guestArch === 'i386') {
    return 'x86';
  }
  if (guestArch === 'aarch64' || guestArch === 'arm') {
    return 'arm';
  }
  if (guestArch === 'ppc' || guestArch === 'ppc64') {
    return 'ppc';
  }
  return guestArch;
}

function isQemu1100(versionString) {
  const version = String(versionString || '');
  return /\b11\.0\.0\b/.test(version);
}

function hostFamily(hostArch) {
  if (hostArch === 'x64' || hostArch === 'ia32') {
    return 'x86';
  }
  if (hostArch === 'arm64' || hostArch === 'arm') {
    return 'arm';
  }
  return hostArch;
}

function resolveBinaryKey(machineArch) {
  if (machineArch === 'x86_64') return 'x86_64';
  if (machineArch === 'i386') return 'i386';
  if (machineArch === 'aarch64') return 'aarch64';
  if (machineArch === 'arm') return 'arm';
  return machineArch;
}

function chooseAccelerator(requested, platform, guestArch, hostArch, availableAccelerators) {
  const platformDefault = platform === 'darwin' ? 'hvf' : platform === 'linux' ? 'kvm' : platform === 'win32' ? 'whpx' : 'tcg';
  const familyMatches = guestFamily(guestArch) === hostFamily(hostArch);

  if (requested) {
    return requested;
  }

  if (!familyMatches) {
    return 'tcg';
  }

  return availableAccelerators.includes(platformDefault) ? platformDefault : 'tcg';
}

function mapAcceleratorArg(accelerator) {
  if (accelerator === 'mttcg') {
    return 'tcg,thread=multi';
  }
  if (!accelerator || accelerator === 'none') {
    return 'tcg';
  }
  return accelerator;
}

function mapBootOrder(bootOrder) {
  if (bootOrder === 'cdrom') return 'd';
  if (bootOrder === 'disk') return 'c';
  if (bootOrder === 'floppy') return 'a';
  return null;
}

function normalizeQemuFilePath(filePath, hostPlatform) {
  const value = String(filePath || '');
  if (!value) {
    return '';
  }
  if (hostPlatform === 'win32') {
    return value.replace(/\\/g, '/');
  }
  return value;
}

function mapAudioDevice(machine, audioBackend, hostPlatform) {
  const soundCard = machine.system?.sound_card || 'intel-hda';
  const resolvedBackend =
    !audioBackend || audioBackend === 'auto'
      ? (hostPlatform === 'darwin'
        ? 'coreaudio'
        : hostPlatform === 'win32'
          ? 'directsound'
          : 'none')
      : audioBackend;

  if (resolvedBackend === 'none' || resolvedBackend === 'spice') {
    if (soundCard === 'intel-hda') {
      return ['-device', 'intel-hda', '-device', 'hda-duplex'];
    }
    if (soundCard === 'ac97') {
      return ['-device', 'AC97'];
    }
    if (soundCard === 'sb16') {
      return ['-device', 'sb16'];
    }
    if (soundCard === 'virtio-sound-pci') {
      return ['-device', 'virtio-sound-pci'];
    }
    return [];
  }

  const audiodevType =
    resolvedBackend === 'coreaudio' ? 'coreaudio'
      : resolvedBackend === 'pulseaudio' ? 'pa'
        : resolvedBackend === 'pipewire' ? 'pipewire'
          : resolvedBackend === 'directsound' ? 'dsound'
            : null;

  if (!audiodevType) {
    return [];
  }

  if (soundCard === 'intel-hda') {
    return ['-audiodev', `${audiodevType},id=audio0`, '-device', 'intel-hda', '-device', 'hda-duplex,audiodev=audio0'];
  }

  if (soundCard === 'ac97') {
    return ['-audiodev', `${audiodevType},id=audio0`, '-device', 'AC97,audiodev=audio0'];
  }

  if (soundCard === 'virtio-sound-pci') {
    return ['-audiodev', `${audiodevType},id=audio0`, '-device', 'virtio-sound-pci,audiodev=audio0'];
  }

  if (soundCard === 'sb16') {
    return ['-audiodev', `${audiodevType},id=audio0`, '-device', 'sb16,audiodev=audio0'];
  }

  return [];
}

function buildDisplayArgs(machineArch, gpu) {
  if (machineArch === 'ppc') {
    if (gpu === 'cirrus-vga') return ['-vga', 'cirrus'];
    return ['-vga', 'std'];
  }

  if (gpu === 'virtio-vga') return ['-vga', 'none', '-device', 'virtio-vga'];
  if (gpu === 'virtio-gpu-pci') return ['-device', 'virtio-gpu-pci'];
  if (gpu === 'cirrus-vga') return ['-vga', 'cirrus'];
  if (gpu === 'vmware-svga') return ['-vga', 'vmware'];
  if (gpu === 'qxl') return ['-vga', 'qxl'];
  if (gpu === 'std' || gpu === 'VGA') return ['-vga', 'std'];
  return ['-vga', 'std'];
}

function defaultMachineType(machineArch) {
  if (machineArch === 'aarch64' || machineArch === 'arm') {
    return 'virt';
  }
  if (machineArch === 'riscv64') {
    return 'virt';
  }
  if (machineArch === 'x86_64' || machineArch === 'i386') {
    return 'pc-q35-9.2';
  }
  if (machineArch === 'ppc') {
    return 'mac99';
  }
  if (machineArch === 'ppc64') {
    return 'pseries';
  }
  return '';
}

function isX86MachineType(machineType) {
  return machineType === 'q35' || machineType === 'pc' || machineType.startsWith('pc-');
}

function isQ35MachineType(machineType) {
  return machineType === 'q35' || machineType.startsWith('pc-q35');
}

function isPowerMacMachineType(machineType) {
  return machineType === 'mac99'
    || machineType === 'g3beige'
    || machineType.startsWith('mac99-')
    || machineType.startsWith('g3beige-');
}

function isPSeriesMachineType(machineType) {
  return machineType === 'pseries' || machineType.startsWith('pseries-');
}

function resolveScsiController(machineArch, machineType) {
  if ((machineArch === 'ppc' || machineArch === 'ppc64') && isPSeriesMachineType(machineType)) {
    return 'spapr-vscsi,id=scsi0';
  }
  return 'virtio-scsi-pci,id=scsi0';
}

function resolveCdromAttachment(machineArch, machineType) {
  if (machineArch === 'x86_64' || machineArch === 'i386') {
    if (isQ35MachineType(machineType)) {
      return {
        controller: 'ahci',
        device: 'ide-cd,id=cdrom0,drive=cd0,bus=ahci0.0'
      };
    }

    return {
      controller: null,
      device: 'ide-cd,id=cdrom0,drive=cd0,bus=ide.1'
    };
  }

  if (machineArch === 'ppc' && isPowerMacMachineType(machineType)) {
    return {
      controller: null,
      device: 'ide-cd,id=cdrom0,drive=cd0,bus=ide.1'
    };
  }

  return {
    controller: 'scsi',
    device: 'scsi-cd,drive=cd0,bus=scsi0.0'
  };
}

function resolveDiskAttachment(machineArch, machineType, disk, index) {
  const requestedInterface = disk.interface || 'virtio';
  const sataBusOffset = 1;

  if (machineArch === 'x86_64' || machineArch === 'i386') {
    if (requestedInterface === 'scsi') {
      return {
        controller: 'scsi',
        device: `scsi-hd,drive=drive${index},bus=scsi0.0`
      };
    }

    if (requestedInterface === 'sata' || (requestedInterface === 'ide' && isQ35MachineType(machineType))) {
      return {
        controller: 'ahci',
        device: `ide-hd,drive=drive${index},bus=ahci0.${index + sataBusOffset}`
      };
    }

    if (requestedInterface === 'ide') {
      return {
        controller: null,
        device: `ide-hd,drive=drive${index},bus=ide.${index}`
      };
    }

    return {
      controller: null,
      device: `virtio-blk-pci,drive=drive${index}`
    };
  }

  if (machineArch === 'ppc' && isPowerMacMachineType(machineType)) {
    if (requestedInterface === 'scsi') {
      return {
        controller: 'scsi',
        device: `scsi-hd,drive=drive${index},bus=scsi0.0`
      };
    }

    if (requestedInterface === 'ide' || requestedInterface === 'sata') {
      return {
        controller: null,
        device: `ide-hd,drive=drive${index},bus=ide.${index}`
      };
    }
  }

  if (requestedInterface === 'virtio') {
    return {
      controller: null,
      device: `virtio-blk-pci,drive=drive${index}`
    };
  }

  return {
    controller: 'scsi',
    device: `scsi-hd,drive=drive${index},bus=scsi0.0`
  };
}

function ensureFile(filePath) {
  return typeof filePath === 'string' && filePath.length > 0 && fs.existsSync(filePath);
}

function deriveStableMacAddress(machineId) {
  const digest = crypto.createHash('sha256').update(String(machineId || 'sanaka')).digest();
  const bytes = [0x52, 0x54, 0x00, digest[0], digest[1], digest[2]];
  return bytes.map((value) => value.toString(16).padStart(2, '0')).join(':');
}

function resolveQemuShareDir(binaryPath) {
  const candidates = [
    path.resolve(path.dirname(binaryPath), '../share/qemu'),
    path.resolve(path.dirname(binaryPath), 'share'),
    path.resolve(path.dirname(binaryPath), '../share'),
    '/usr/share/qemu',
    '/usr/local/share/qemu',
    '/opt/homebrew/share/qemu'
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function resolveFirmwarePair(customFirmware, runtimeDir, guestArch, autoCodeCandidates, autoVarsCandidates) {
  const customCodePath = customFirmware?.code_path || '';
  const customVarsPath = customFirmware?.vars_path || '';

  if (customCodePath) {
    if (!ensureFile(customCodePath)) {
      throw new Error(`UEFI firmware code file was not found: ${customCodePath}`);
    }

    if (customVarsPath) {
      if (!ensureFile(customVarsPath)) {
        throw new Error(`UEFI firmware vars file was not found: ${customVarsPath}`);
      }
      return {
        codePath: customCodePath,
        varsPath: customVarsPath
      };
    }

    return {
      codePath: customCodePath,
      varsPath: ''
    };
  }

  const codePath = autoCodeCandidates.find(ensureFile);
  const varsTemplatePath = autoVarsCandidates.find(ensureFile);

  if (!codePath) {
    throw new Error('UEFI firmware was not found. Install firmware files or provide a custom pflash CODE file.');
  }

  if (!varsTemplatePath) {
    return {
      codePath,
      varsPath: ''
    };
  }

  const varsPath = path.join(runtimeDir, `uefi-${guestArch}-vars.fd`);
  if (!fs.existsSync(varsPath)) {
    fs.copyFileSync(varsTemplatePath, varsPath);
  }

  return {
    codePath,
    varsPath
  };
}

function resolveUefiFirmware(binaryPath, machineType, guestArch, runtimeDir, customFirmware) {
  const shareDir = resolveQemuShareDir(binaryPath);

  if (guestArch === 'x86_64' || guestArch === 'i386') {
    if (!isX86MachineType(machineType)) {
      throw new Error(`UEFI requires a PC-compatible machine type. Current machine type: ${machineType}.`);
    }

    const autoCodeCandidates = shareDir
      ? [
          guestArch === 'x86_64'
            ? path.join(shareDir, 'edk2-x86_64-code.fd')
            : path.join(shareDir, 'edk2-i386-code.fd')
        ]
      : [];
    const autoVarsCandidates = shareDir
      ? [
          path.join(shareDir, 'edk2-i386-vars.fd')
        ]
      : [];

    return resolveFirmwarePair(customFirmware, runtimeDir, guestArch, autoCodeCandidates, autoVarsCandidates);
  }

  if (guestArch === 'aarch64' || guestArch === 'arm') {
    if (machineType !== 'virt') {
      throw new Error(`UEFI for ${guestArch} requires the virt machine type. Current machine type: ${machineType}.`);
    }

    const autoCodeCandidates = [
      '/opt/homebrew/share/qemu/edk2-aarch64-code.fd',
      '/usr/local/share/qemu/edk2-aarch64-code.fd',
      '/usr/share/qemu/edk2-aarch64-code.fd',
      '/opt/homebrew/share/qemu/AAVMF_CODE.fd',
      '/usr/local/share/qemu/AAVMF_CODE.fd',
      '/usr/share/qemu/AAVMF_CODE.fd',
      '/opt/homebrew/share/qemu/QEMU_EFI.fd',
      '/usr/local/share/qemu/QEMU_EFI.fd',
      '/usr/share/qemu/QEMU_EFI.fd'
    ];
    const autoVarsCandidates = [
      '/opt/homebrew/share/qemu/edk2-arm-vars.fd',
      '/usr/local/share/qemu/edk2-arm-vars.fd',
      '/usr/share/qemu/edk2-arm-vars.fd',
      '/opt/homebrew/share/qemu/AAVMF_VARS.fd',
      '/usr/local/share/qemu/AAVMF_VARS.fd',
      '/usr/share/qemu/AAVMF_VARS.fd'
    ];

    return resolveFirmwarePair(customFirmware, runtimeDir, guestArch, autoCodeCandidates, autoVarsCandidates);
  }

  throw new Error(`UEFI is not supported yet for ${guestArch} machines.`);
}

class QemuCommandBuilder {
  build({ machine, environment, runtimePaths, displayConfig, host }) {
    const guestArch = machine.system.arch;

    if (!guestArch || guestArch === 'none') {
      throw new Error('Machine architecture is not configured yet.');
    }
    if (!machine.system?.accelerator || machine.system.accelerator === 'none') {
      throw new Error('Machine accelerator is not configured yet.');
    }
    if (!machine.system?.machine_type || machine.system.machine_type === 'none') {
      throw new Error('Machine type is not configured yet.');
    }
    if (!machine.display?.gpu) {
      throw new Error('Machine display device is not configured yet.');
    }

    const binaryKey = resolveBinaryKey(guestArch);
    const binary = environment.binaries[binaryKey];

    if (!binary?.found || !binary.path) {
      throw new Error(`QEMU binary for ${guestArch} is not available.`);
    }

    const accelerator = chooseAccelerator(
      machine.system.accelerator,
      host.platform,
      guestArch,
      host.arch,
      environment.accelerators
    );

    const displayFrontend = 'sanaka';
    const displayBackend = 'vnc';
    const args = ['-name', machine.title, '-display', 'none'];
    const machineType = machine.system?.machine_type || defaultMachineType(guestArch);

    if (machineType) {
      args.push('-machine', machineType);
    }

    if (guestFamily(guestArch) === 'x86' && isQemu1100(binary.version)) {
      args.push('-global', 'apic.vapic=off');
    }

    args.push('-accel', mapAcceleratorArg(accelerator));

    args.push('-m', String(machine.system?.memory_mib || 2048));
    args.push('-smp', String(machine.system?.cpu_cores || 2));

    const bootOrder = mapBootOrder(machine.system.boot_order);
    if (bootOrder) {
      args.push('-boot', `order=${bootOrder}`);
    }

    const qmpAddress =
      runtimePaths.qmp.transport === 'unix'
        ? `unix:${runtimePaths.qmp.path},server=on,wait=off`
        : `tcp:${runtimePaths.qmp.host}:${runtimePaths.qmp.port},server=on,wait=off`;
    args.push('-qmp', qmpAddress);

    if (machine.system?.uefi) {
      const firmware = resolveUefiFirmware(
        binary.path,
        machineType,
        guestArch,
        runtimePaths.runtimeDir,
        machine.advanced?.firmware
      );
      args.push('-drive', `if=pflash,format=raw,readonly=on,file=${normalizeQemuFilePath(firmware.codePath, host.platform)}`);
      if (firmware.varsPath) {
        args.push('-drive', `if=pflash,format=raw,file=${normalizeQemuFilePath(firmware.varsPath, host.platform)}`);
      }
    }

    if (machine.display.gpu !== 'none') {
      args.push(...buildDisplayArgs(guestArch, machine.display.gpu));
    }

    const cdromAttachment = resolveCdromAttachment(guestArch, machineType);
    args.push('-drive', `if=none,id=cd0,media=cdrom,readonly=on,file=${normalizeQemuFilePath(machine.media?.iso || '', host.platform)}`);

    if (machine.media?.floppy) {
      args.push('-drive', `if=none,id=floppy0,media=disk,format=raw,file=${normalizeQemuFilePath(machine.media.floppy, host.platform)}`);
      args.push('-device', 'floppy,id=floppy-device0,drive=floppy0');
    }

    let needsScsiController = cdromAttachment.controller === 'scsi';
    let needsSataController = cdromAttachment.controller === 'ahci';
    const diskAttachments = (machine.disks || []).map((disk, index) => {
      const attachment = resolveDiskAttachment(guestArch, machineType, disk, index);
      if (attachment.controller === 'scsi') {
        needsScsiController = true;
      }
      if (attachment.controller === 'ahci') {
        needsSataController = true;
      }
      return attachment;
    });

    if (needsScsiController) {
      args.push('-device', resolveScsiController(guestArch, machineType));
    }

    if (needsSataController) {
      args.push('-device', 'ich9-ahci,id=ahci0');
    }

    args.push('-device', cdromAttachment.device);

    (machine.disks || []).forEach((disk, index) => {
      const driveId = `drive${index}`;
      const driveArgs = [`file=${normalizeQemuFilePath(disk.path, host.platform)}`, `format=${disk.format || 'qcow2'}`, `id=${driveId}`, 'if=none'];
      if (disk.readonly) {
        driveArgs.push('readonly=on');
      }
      args.push('-drive', driveArgs.join(','));
      args.push('-device', diskAttachments[index].device);
    });

    const tokenizedUserArgs = tokenizeUserArgs(machine.advanced?.qemu_args || '');
    const { passthroughArgs, userNetdevExtras } = splitAdvancedUserArgs(tokenizedUserArgs);

    if (userNetdevExtras.length > 0) {
      if (!machine.network?.enabled) {
        throw new Error('hostfwd/guestfwd requires Sanaka machine networking to be enabled.');
      }
      if (machine.network.mode !== 'user') {
        throw new Error('hostfwd/guestfwd is only supported with User networking.');
      }
    }

    if (machine.network?.enabled) {
      if (!machine.network.card || machine.network.card === 'none') {
        throw new Error('Machine network card is not configured yet.');
      }
      if (machine.network.mode === 'bridge' && host.platform !== 'linux') {
        throw new Error('Bridge networking is only supported in the first runtime version on Linux hosts.');
      }

      const netdevParts =
        machine.network.mode === 'bridge'
          ? ['bridge,id=net0']
          : ['user,id=net0'];
      if (machine.network.mode === 'user' && userNetdevExtras.length > 0) {
        netdevParts.push(...userNetdevExtras);
      }
      const netdev = netdevParts.join(',');
      const machineMac = deriveStableMacAddress(machine.id);
      args.push('-netdev', netdev, '-device', `${machine.network.card},netdev=net0,mac=${machineMac}`);
    }

    if (machine.peripherals?.usb_tablet) {
      args.push('-usb', '-device', 'usb-tablet');
    }

    args.push(...mapAudioDevice(machine, machine.advanced?.audio_backend, host.platform));

    args.push(
      '-vnc',
      `127.0.0.1:${displayConfig.displayNumber},websocket=${displayConfig.websocketPort}`
    );

    args.push(...passthroughArgs);

    return {
      binaryPath: binary.path,
      args,
      accelerator,
      display: {
        frontend: displayFrontend,
        backend: displayBackend,
        port: displayBackend === 'vnc' ? displayConfig.port : displayConfig.port,
        websocketPort: displayBackend === 'vnc' ? displayConfig.websocketPort : undefined
      }
    };
  }
}

module.exports = {
  QemuCommandBuilder,
  chooseAccelerator,
  resolveBinaryKey,
  tokenizeUserArgs,
  buildDisplayArgs,
  resolveUefiFirmware,
  splitAdvancedUserArgs,
  deriveStableMacAddress,
  normalizeQemuFilePath
};
