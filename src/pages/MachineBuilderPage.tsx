import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { DiskInterface, SakaMachine } from '../domain/schemas';
import { SectionCard, StatusChip } from '../components/Field';
import { MaterialSelect } from '../components/MaterialSelect';
import { DiskImageManager } from '../components/DiskImageManager';
import { Checkbox } from '../components/Checkbox';
import { QemuArgsList } from '../components/QemuArgsList';
import { useT } from '../hooks/useT';
import { collectMachineWarnings, getSupportedAccelerators, isGuestArchCompatibleWithHost, makeAudioHint, makeDisplayHint } from '../lib/machine';
import { machineRoute } from '../lib/routes';
import { useAppStore, getUniqueMachineTitle } from '../store/AppStore';

// SVG Icons
const WindowsIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    <path d="M0 3.449L9.75 2.1v9.45H0V3.449zM0 12.45h9.75v9.45L0 20.551v-8.101zM10.8 1.95L24 0v11.55H10.8V1.95zM10.8 12.45H24v11.55l-13.2-1.95v-9.6z" />
  </svg>
);

const LinuxIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
    <path d="M7 8l3 3-3 3" />
    <line x1="13" y1="14" x2="17" y2="14" />
  </svg>
);

const CustomIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const DiskIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%">
    <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
    <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
    <line x1="6" y1="6" x2="6.01" y2="6" />
    <line x1="6" y1="18" x2="6.01" y2="18" />
  </svg>
);

const CDIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

const CPUIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%">
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <rect x="9" y="9" width="6" height="6" />
    <line x1="9" y1="1" x2="9" y2="4" />
    <line x1="15" y1="1" x2="15" y2="4" />
    <line x1="9" y1="20" x2="9" y2="23" />
    <line x1="15" y1="20" x2="15" y2="23" />
    <line x1="20" y1="9" x2="23" y2="9" />
    <line x1="20" y1="15" x2="23" y2="15" />
    <line x1="1" y1="9" x2="4" y2="9" />
    <line x1="1" y1="15" x2="4" y2="15" />
  </svg>
);

const MonitorIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const SpeakerIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
  </svg>
);

const NetworkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%">
    <rect x="16" y="16" width="6" height="6" rx="1" />
    <rect x="2" y="16" width="6" height="6" rx="1" />
    <rect x="9" y="2" width="6" height="6" rx="1" />
    <path d="M12 8v8M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3" />
  </svg>
);

const AlertIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const FirmwareIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%">
    <rect x="6" y="2" width="12" height="20" rx="2" />
    <path d="M9 6h6" />
    <path d="M9 10h6" />
    <path d="M9 14h4" />
  </svg>
);

const FileIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

function getTemplateIcon(key: string) {
  const lowercaseKey = key.toLowerCase();
  if (lowercaseKey.includes('win')) {
    return <WindowsIcon />;
  }
  if (lowercaseKey.includes('linux') || lowercaseKey.includes('ubuntu') || lowercaseKey.includes('debian')) {
    return <LinuxIcon />;
  }
  return <CustomIcon />;
}

const archOptions = ['x86_64', 'i386', 'aarch64', 'arm', 'riscv64', 'ppc', 'ppc64'].map((value) => ({ value, label: value })) as Array<{
  value: SakaMachine['system']['arch'];
  label: string;
}>;
const customArchOptions = [
  { value: 'none', label: 'none' },
  ...archOptions
] as Array<{
  value: SakaMachine['system']['arch'];
  label: string;
}>;
const x86MachineTypeOptions = [
  { value: 'pc-q35-11.0', label: 'pc-q35-11.0' },
  { value: 'pc-q35-10.2', label: 'pc-q35-10.2' },
  { value: 'pc-q35-10.1', label: 'pc-q35-10.1' },
  { value: 'pc-q35-10.0', label: 'pc-q35-10.0' },
  { value: 'pc-q35-9.2', label: 'pc-q35-9.2' },
  { value: 'pc-q35-9.1', label: 'pc-q35-9.1' },
  { value: 'pc-q35-9.0', label: 'pc-q35-9.0' },
  { value: 'q35', label: 'q35' },
  { value: 'pc-i440fx-11.0', label: 'pc-i440fx-11.0' },
  { value: 'pc-i440fx-10.2', label: 'pc-i440fx-10.2' },
  { value: 'pc-i440fx-10.1', label: 'pc-i440fx-10.1' },
  { value: 'pc-i440fx-10.0', label: 'pc-i440fx-10.0' },
  { value: 'pc-i440fx-9.2', label: 'pc-i440fx-9.2' },
  { value: 'pc-i440fx-9.1', label: 'pc-i440fx-9.1' },
  { value: 'pc-i440fx-9.0', label: 'pc-i440fx-9.0' },
  { value: 'pc', label: 'pc' }
] as const;
const aarch64MachineTypeOptions = [
  { value: 'virt', label: 'virt' },
  { value: 'virt-11.0', label: 'virt-11.0' },
  { value: 'virt-10.2', label: 'virt-10.2' },
  { value: 'virt-10.1', label: 'virt-10.1' },
  { value: 'virt-10.0', label: 'virt-10.0' },
  { value: 'virt-9.2', label: 'virt-9.2' },
  { value: 'virt-9.1', label: 'virt-9.1' },
  { value: 'virt-9.0', label: 'virt-9.0' },
  { value: 'virt-8.2', label: 'virt-8.2' },
  { value: 'virt-8.1', label: 'virt-8.1' },
  { value: 'sbsa-ref', label: 'sbsa-ref' },
  { value: 'raspi4b', label: 'raspi4b' },
  { value: 'raspi3b', label: 'raspi3b' },
  { value: 'imx8mp-evk', label: 'imx8mp-evk' },
  { value: 'xlnx-zcu102', label: 'xlnx-zcu102' },
  { value: 'vexpress-a15', label: 'vexpress-a15' },
  { value: 'vexpress-a9', label: 'vexpress-a9' }
] as const;
const armMachineTypeOptions = [
  { value: 'virt', label: 'virt' },
  { value: 'virt-11.0', label: 'virt-11.0' },
  { value: 'virt-10.2', label: 'virt-10.2' },
  { value: 'virt-10.1', label: 'virt-10.1' },
  { value: 'virt-10.0', label: 'virt-10.0' },
  { value: 'virt-9.2', label: 'virt-9.2' },
  { value: 'virt-9.1', label: 'virt-9.1' },
  { value: 'virt-9.0', label: 'virt-9.0' },
  { value: 'virt-8.2', label: 'virt-8.2' },
  { value: 'virt-8.1', label: 'virt-8.1' },
  { value: 'vexpress-a15', label: 'vexpress-a15' },
  { value: 'vexpress-a9', label: 'vexpress-a9' },
  { value: 'realview-eb', label: 'realview-eb' },
  { value: 'realview-eb-mpcore', label: 'realview-eb-mpcore' },
  { value: 'realview-pb-a8', label: 'realview-pb-a8' },
  { value: 'realview-pbx-a9', label: 'realview-pbx-a9' },
  { value: 'versatileab', label: 'versatileab' },
  { value: 'versatilepb', label: 'versatilepb' },
  { value: 'integratorcp', label: 'integratorcp' },
  { value: 'raspi2b', label: 'raspi2b' },
  { value: 'raspi1ap', label: 'raspi1ap' },
  { value: 'raspi0', label: 'raspi0' },
  { value: 'cubieboard', label: 'cubieboard' },
  { value: 'orangepi-pc', label: 'orangepi-pc' },
  { value: 'sabrelite', label: 'sabrelite' },
  { value: 'mcimx7d-sabre', label: 'mcimx7d-sabre' },
  { value: 'mcimx6ul-evk', label: 'mcimx6ul-evk' },
  { value: 'imx25-pdk', label: 'imx25-pdk' },
  { value: 'mps2-an385', label: 'mps2-an385 (Cortex-M3)' },
  { value: 'mps2-an386', label: 'mps2-an386 (Cortex-M4)' },
  { value: 'mps2-an500', label: 'mps2-an500 (Cortex-M7)' },
  { value: 'mps2-an505', label: 'mps2-an505 (Cortex-M33)' },
  { value: 'mps2-an511', label: 'mps2-an511 (Cortex-M3)' },
  { value: 'mps2-an521', label: 'mps2-an521 (dual Cortex-M33)' },
  { value: 'mps3-an524', label: 'mps3-an524 (dual Cortex-M33)' },
  { value: 'mps3-an536', label: 'mps3-an536 (Cortex-R52)' },
  { value: 'mps3-an547', label: 'mps3-an547 (Cortex-M55)' }
] as const;
const riscvMachineTypeOptions = [
  { value: 'virt', label: 'virt' },
  { value: 'spike', label: 'spike' },
  { value: 'sifive_u', label: 'sifive_u' },
  { value: 'sifive_e', label: 'sifive_e' },
  { value: 'microchip-icicle-kit', label: 'microchip-icicle-kit' }
] as const;
const ppcMachineTypeOptions = [
  { value: 'mac99', label: 'mac99' },
  { value: 'g3beige', label: 'g3beige' },
  { value: 'pegasos2', label: 'pegasos2' },
  { value: 'pegasos1', label: 'pegasos1' },
  { value: 'sam460ex', label: 'sam460ex' },
  { value: '40p', label: '40p' }
] as const;
const ppc64MachineTypeOptions = [
  { value: 'pseries', label: 'pseries' },
  { value: 'pseries-11.0', label: 'pseries-11.0' },
  { value: 'pseries-10.2', label: 'pseries-10.2' },
  { value: 'pseries-10.1', label: 'pseries-10.1' },
  { value: 'pseries-10.0', label: 'pseries-10.0' },
  { value: 'pseries-9.2', label: 'pseries-9.2' },
  { value: 'pseries-9.1', label: 'pseries-9.1' },
  { value: 'pseries-9.0', label: 'pseries-9.0' },
  { value: 'powernv10', label: 'powernv10' },
  { value: 'powernv10-rainier', label: 'powernv10-rainier' },
  { value: 'powernv9', label: 'powernv9' },
  { value: 'powernv8', label: 'powernv8' },
  { value: 'mac99', label: 'mac99' },
  { value: 'g3beige', label: 'g3beige' }
] as const;
const fallbackMachineTypeOptions = [
  { value: 'none', label: 'none' }
] as const;
const soundOptions = ['ac97', 'intel-hda', 'sb16', 'virtio-sound-pci'].map((value) => ({ value, label: value })) as Array<{ value: string; label: string }>;
const customSoundOptions = [
  { value: 'none', label: 'none' },
  ...soundOptions
] as Array<{ value: string; label: string }>;
const x86GpuOptions = [
  { value: 'std', label: 'std (Standard VGA)' },
  { value: 'cirrus-vga', label: 'cirrus-vga' },
  { value: 'qxl', label: 'qxl' },
  { value: 'virtio-vga', label: 'virtio-vga' },
  { value: 'vmware-svga', label: 'vmware-svga' }
] as Array<{ value: string; label: string }>;
const armLikeGpuOptions = [
  { value: 'virtio-gpu-pci', label: 'virtio-gpu-pci (推荐)' },
  { value: 'std', label: 'std (实验性)' }
] as Array<{ value: string; label: string }>;
const ppcGpuOptions = [
  { value: 'std', label: 'std (Standard VGA)' },
  { value: 'cirrus-vga', label: 'cirrus-vga' }
] as Array<{ value: string; label: string }>;
const customGpuOptions = [
  { value: 'none', label: 'none' },
  ...x86GpuOptions,
  { value: 'virtio-gpu-pci', label: 'virtio-gpu-pci' }
] as Array<{ value: string; label: string }>;
const networkCardOptions = [
  { value: 'rtl8139', label: 'rtl8139' },
  { value: 'e1000', label: 'e1000' },
  { value: 'pcnet', label: 'pcnet' },
  { value: 'ne2k_pci', label: 'ne2k_pci' },
  { value: 'virtio-net-pci', label: 'virtio-net-pci' }
] as Array<{ value: string; label: string }>;
const customNetworkCardOptions = [
  { value: 'none', label: 'none' },
  ...networkCardOptions
] as Array<{ value: string; label: string }>;
const diskInterfaceOptions = [
  { value: 'ide', label: 'IDE (兼容性)' },
  { value: 'scsi', label: 'SCSI (冷门)' },
  { value: 'sata', label: 'SATA (稍快)' },
  { value: 'virtio', label: 'VirtIO (快，需驱动)' }
] as Array<{ value: DiskInterface; label: string }>;

const networkModeOptions = [
  { value: 'user', label: 'User' },
  { value: 'bridge', label: 'Bridge' }
] as ReadonlyArray<{ value: SakaMachine['network']['mode']; label: string }>;
const audioBackendOptions = [
  { value: 'auto', label: '系统自动' },
  { value: 'pipewire', label: 'PipeWire' },
  { value: 'pulseaudio', label: 'PulseAudio' },
  { value: 'coreaudio', label: 'CoreAudio' },
  { value: 'directsound', label: 'DirectSound' }
] as ReadonlyArray<{ value: SakaMachine['advanced']['audio_backend']; label: string }>;

function withCustomOption<T extends string>(
  options: ReadonlyArray<{ value: T; label: string }>,
  value: T | null | undefined,
  customLabel: string
): Array<{ value: T; label: string }> {
  if (!value) {
    return [...options];
  }
  if (options.some((option) => option.value === value)) {
    return [...options];
  }
  return [{ value, label: customLabel }, ...options];
}

function linuxArchDefaults(arch: SakaMachine['system']['arch']) {
  if (arch === 'i386') {
    return {
      machineType: 'pc-i440fx-9.2',
      accelerator: 'tcg' as SakaMachine['system']['accelerator'],
      soundCard: 'ac97',
      gpu: 'std',
      networkEnabled: true,
      networkCard: 'rtl8139',
      diskInterface: 'ide' as DiskInterface
    };
  }
  if (arch === 'aarch64') {
    return {
      machineType: 'virt',
      accelerator: 'tcg' as SakaMachine['system']['accelerator'],
      soundCard: 'intel-hda',
      gpu: 'virtio-gpu-pci',
      networkEnabled: true,
      networkCard: 'virtio-net-pci',
      diskInterface: 'scsi' as DiskInterface
    };
  }
  if (arch === 'arm') {
    return {
      machineType: 'virt',
      accelerator: 'tcg' as SakaMachine['system']['accelerator'],
      soundCard: 'sb16',
      gpu: 'virtio-gpu-pci',
      networkEnabled: true,
      networkCard: 'virtio-net-pci',
      diskInterface: 'scsi' as DiskInterface
    };
  }
  if (arch === 'riscv64') {
    return {
      machineType: 'virt',
      accelerator: 'tcg' as SakaMachine['system']['accelerator'],
      soundCard: 'intel-hda',
      gpu: 'virtio-gpu-pci',
      networkEnabled: true,
      networkCard: 'virtio-net-pci',
      diskInterface: 'scsi' as DiskInterface
    };
  }
  if (arch === 'ppc') {
    return {
      machineType: 'mac99',
      accelerator: 'tcg' as SakaMachine['system']['accelerator'],
      soundCard: 'sb16',
      gpu: 'std',
      networkEnabled: true,
      networkCard: 'rtl8139',
      diskInterface: 'ide' as DiskInterface
    };
  }
  if (arch === 'ppc64') {
    return {
      machineType: 'pseries',
      accelerator: 'tcg' as SakaMachine['system']['accelerator'],
      soundCard: 'intel-hda',
      gpu: 'virtio-gpu-pci',
      networkEnabled: true,
      networkCard: 'virtio-net-pci',
      diskInterface: 'scsi' as DiskInterface
    };
  }
  return {
    machineType: 'pc-q35-9.2',
    accelerator: 'tcg' as SakaMachine['system']['accelerator'],
    soundCard: 'intel-hda',
    gpu: 'std',
    networkEnabled: true,
    networkCard: 'e1000',
    diskInterface: 'sata' as DiskInterface
  };
}

function gpuOptionsForMachine(machine: SakaMachine) {
  if (machine.template.key === 'custom') {
    return customGpuOptions;
  }
  if (machine.system.arch === 'aarch64' || machine.system.arch === 'arm' || machine.system.arch === 'riscv64' || machine.system.arch === 'ppc64') {
    return armLikeGpuOptions;
  }
  if (machine.system.arch === 'ppc') {
    return ppcGpuOptions;
  }
  return x86GpuOptions;
}

function networkCardOptionsForMachine(machine: SakaMachine) {
  if (machine.template.key === 'custom') {
    return customNetworkCardOptions;
  }
  if (machine.system.arch === 'aarch64' || machine.system.arch === 'arm' || machine.system.arch === 'riscv64' || machine.system.arch === 'ppc64') {
    return [{ value: 'virtio-net-pci', label: 'virtio-net-pci' }] as Array<{ value: string; label: string }>;
  }
  if (machine.system.arch === 'ppc') {
    return [
      { value: 'rtl8139', label: 'rtl8139' },
      { value: 'pcnet', label: 'pcnet' }
    ] as Array<{ value: string; label: string }>;
  }
  return networkCardOptions;
}

function diskInterfaceOptionsForMachine(machine: SakaMachine) {
  if (machine.system.arch === 'aarch64' || machine.system.arch === 'arm' || machine.system.arch === 'riscv64' || machine.system.arch === 'ppc64') {
    return [
      { value: 'scsi', label: 'SCSI (兼容性)' },
      { value: 'virtio', label: 'VirtIO (快，需驱动)' }
    ] as Array<{ value: DiskInterface; label: string }>;
  }
  if (machine.system.arch === 'ppc') {
    return [
      { value: 'ide', label: 'IDE (兼容性)' },
      { value: 'scsi', label: 'SCSI (冷门)' }
    ] as Array<{ value: DiskInterface; label: string }>;
  }
  return diskInterfaceOptions;
}

function supportsUefiForMachine(machine: SakaMachine) {
  return (machine.system.arch === 'x86_64' && machine.template.key !== 'win98') ||
    (machine.system.arch === 'aarch64' && machine.system.machine_type === 'virt');
}

function defaultDiskInterfaceForMachine(machine: SakaMachine): DiskInterface {
  if (machine.template.key === 'custom') {
    return 'sata';
  }
  if (machine.template.key === 'linux') {
    return linuxArchDefaults(machine.system.arch).diskInterface;
  }
  if (machine.template.key === 'win98' || machine.template.key === 'winxp') {
    return 'ide';
  }
  if (machine.template.key === 'win11') {
    return 'sata';
  }
  return 'virtio';
}

export function MachineBuilderPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { draft, templates, createDraftFromTemplateKey, applyTemplateSelection, updateDraft, saveDraft, settings, appMeta, recents, runtimeEnvironment } = useAppStore();
  const t = useT();
  const [isDiskManagerOpen, setIsDiskManagerOpen] = useState(false);
  const requestedTemplate = params.get('template') || 'win11';
  const freshToken = params.get('fresh');
  const shouldCreateFresh = freshToken !== null;
  const hostArch = runtimeEnvironment?.arch || appMeta?.arch || null;

  const showArchWarning = useMemo(() => {
    return !isGuestArchCompatibleWithHost(hostArch, draft?.machine.system.arch);
  }, [draft?.machine.system.arch, hostArch]);

  const otherTitles = useMemo(() => {
    if (!draft?.machine) return [];
    return recents
      .filter((r) => r.id !== draft.machine.id)
      .map((r) => r.title.trim().toLowerCase());
  }, [recents, draft?.machine?.id]);

  const isTitleDuplicate = useMemo(() => {
    if (!draft?.machine?.title) return false;
    return otherTitles.includes(draft.machine.title.trim().toLowerCase());
  }, [otherTitles, draft?.machine?.title]);

  const uniqueTitle = useMemo(() => {
    if (!draft?.machine?.title) return '';
    const otherRawTitles = recents
      .filter((r) => r.id !== draft.machine.id)
      .map((r) => r.title);
    return getUniqueMachineTitle(draft.machine.title, otherRawTitles);
  }, [recents, draft?.machine?.title, draft?.machine?.id]);

  const isTitleEmpty = !draft?.machine?.title?.trim();

  const isSaveDisabled = isTitleEmpty;

  const bootOrderOptions = useMemo(() => [
    { value: 'none', label: t('builder.bootOptions.none') },
    { value: 'cdrom', label: t('builder.bootOptions.cdrom') },
    { value: 'disk', label: t('builder.bootOptions.disk') },
    { value: 'floppy', label: t('builder.bootOptions.floppy') }
  ] as const, [t]);
  const initializationKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const requestKey = `${requestedTemplate}:${freshToken ?? 'default'}`;
    if ((!draft || shouldCreateFresh) && initializationKeyRef.current !== requestKey) {
      initializationKeyRef.current = requestKey;
      void createDraftFromTemplateKey(requestedTemplate);
      if (shouldCreateFresh || params.get('template')) {
        navigate('/machines/new', { replace: true });
      }
    }
  }, [createDraftFromTemplateKey, draft, freshToken, navigate, params, requestedTemplate, shouldCreateFresh]);

  const warnings = useMemo(() => (draft ? collectMachineWarnings(draft.machine) : []), [draft]);
  const machine = draft?.machine ?? null;
  const isCustomTemplate = machine?.template.key === 'custom';
  const machineTypeOptions = useMemo(() => {
    if (isCustomTemplate && machine?.system.arch === 'none') {
      return fallbackMachineTypeOptions;
    }
    const arch = machine?.system.arch;
    if (arch === 'x86_64' || arch === 'i386') {
      return x86MachineTypeOptions;
    }
    if (arch === 'aarch64') {
      return aarch64MachineTypeOptions;
    }
    if (arch === 'arm') {
      return armMachineTypeOptions;
    }
    if (arch === 'riscv64') {
      return riscvMachineTypeOptions;
    }
    if (arch === 'ppc') {
      return ppcMachineTypeOptions;
    }
    if (arch === 'ppc64') {
      return ppc64MachineTypeOptions;
    }
    return fallbackMachineTypeOptions;
  }, [isCustomTemplate, machine?.system.arch]);
  const acceleratorOptions = getSupportedAccelerators({
    hostArch,
    guestArch: machine?.system.arch,
    availableAccelerators: runtimeEnvironment?.accelerators
  }).map((value) => {
    const label =
      value === 'mttcg' ? 'MTTCG（多线程TCG）'
        : value === 'hvf' ? 'HVF（macOS）'
          : value === 'kvm' ? 'KVM（Linux）'
            : value === 'whpx' ? 'WHPX（Windows）'
              : value === 'hax' ? 'HAX（Windows）'
                : value === 'none' ? 'none'
                  : value.toUpperCase();

    return { value, label };
  }) as Array<{
    value: SakaMachine['system']['accelerator'];
    label: string;
  }>;
  const visibleArchOptions = customArchOptions;
  const baseGpuOptions = machine ? gpuOptionsForMachine(machine) : x86GpuOptions;
  const baseNetworkCardOptions = machine ? networkCardOptionsForMachine(machine) : networkCardOptions;
  const visibleDiskInterfaceOptions = machine ? diskInterfaceOptionsForMachine(machine) : diskInterfaceOptions;
  const baseSoundOptions = isCustomTemplate ? customSoundOptions : soundOptions;
  const selectedAccelerator = machine?.system.accelerator ?? null;
  const selectedMachineType = machine?.system.machine_type ?? null;
  const selectedGpu = machine?.display.gpu ?? null;
  const selectedSoundCard = machine?.system.sound_card ?? null;
  const selectedNetworkCard = machine?.network.card ?? null;
  const previousLinuxArchRef = useRef<SakaMachine['system']['arch'] | null>(null);
  const customOptionLabel = t('builder.firmware.custom');
  const visibleMachineTypeOptions = withCustomOption(machineTypeOptions, selectedMachineType, customOptionLabel);
  const visibleGpuOptions = withCustomOption(baseGpuOptions, selectedGpu, customOptionLabel);
  const visibleSoundOptions = withCustomOption(baseSoundOptions, selectedSoundCard, customOptionLabel);
  const visibleNetworkCardOptions = withCustomOption(baseNetworkCardOptions, selectedNetworkCard, customOptionLabel);

  useEffect(() => {
    if (!machine || !selectedAccelerator) {
      return;
    }

    if (acceleratorOptions.some((option) => option.value === selectedAccelerator)) {
      return;
    }

    const fallback = acceleratorOptions[0]?.value;
    if (!fallback) {
      return;
    }

    updateDraft((current) => ({
      ...current,
      system: {
        ...current.system,
        accelerator: fallback
      }
    }));
  }, [acceleratorOptions, machine, selectedAccelerator, updateDraft]);

  useEffect(() => {
    if (!machine) {
      return;
    }

    if (machine.template.key === 'linux') {
      if (previousLinuxArchRef.current !== machine.system.arch) {
        previousLinuxArchRef.current = machine.system.arch;
        const defaults = linuxArchDefaults(machine.system.arch);
        updateDraft((current) => ({
          ...current,
          system: {
            ...current.system,
            machine_type: defaults.machineType,
            accelerator: defaults.accelerator,
            sound_card: defaults.soundCard
          },
          network: {
            ...current.network,
            enabled: defaults.networkEnabled,
            card: defaults.networkCard
          },
          disks: current.disks.map((disk, index) =>
            index === 0 && disk.interface !== defaults.diskInterface
              ? { ...disk, interface: defaults.diskInterface }
              : disk
          )
        }));
      }
      return;
    }

    previousLinuxArchRef.current = null;

  }, [machine, selectedMachineType, updateDraft]);

  useEffect(() => {
    if (!machine || !selectedGpu) {
      return;
    }

  }, [machine, selectedGpu, updateDraft]);

  useEffect(() => {
    if (!machine) {
      return;
    }

    if (machine.display.frontend === 'sanaka' && (machine.display.sanaka?.backend ?? 'vnc') === 'vnc') {
      return;
    }

    updateDraft((current) => ({
      ...current,
      display: {
        ...current.display,
        frontend: 'sanaka',
        sanaka: {
          backend: 'vnc',
          scale_mode: current.display.sanaka?.scale_mode ?? 'fit',
          clipboard: current.display.sanaka?.clipboard ?? true
        }
      }
    }));
  }, [machine, updateDraft]);

  useEffect(() => {
    if (!machine?.system.uefi) {
      return;
    }

    if (!supportsUefiForMachine(machine)) {
      updateDraft((current) => ({
        ...current,
        system: {
          ...current.system,
          uefi: false
        }
      }));
    }
  }, [machine, updateDraft]);

  if (!draft || !machine) {
    return <div className="page-loading">{t('common.loading')}</div>;
  }

  const selectedTemplateKey = machine.template.key;
  const audioHint = makeAudioHint(machine.display.frontend, machine.display.sanaka?.backend ?? settings.runtimeDefaults.displayBackendHint, machine.advanced.audio_backend);
  const displayHint = makeDisplayHint(machine);
  const defaultMachineLocation = settings.defaultSaveDirectory || appMeta?.defaultMachineDirectory || '';
  const defaultDiskInterface = defaultDiskInterfaceForMachine(machine);
  const supportsUefi = supportsUefiForMachine(machine);

  const saveAndOpenDetails = async () => {
    const titleToSave = uniqueTitle || machine.title;
    if (titleToSave !== machine.title) {
      updateDraft((current) => ({ ...current, title: titleToSave }));
    }
    const savedPath = await saveDraft('save', titleToSave);
    if (!savedPath) return;
    navigate(machineRoute(machine.id, savedPath));
  };

  const handleSaveAs = async () => {
    const titleToSave = uniqueTitle || machine.title;
    if (titleToSave !== machine.title) {
      updateDraft((current) => ({ ...current, title: titleToSave }));
    }
    await saveDraft('saveAs', titleToSave);
  };

  return (
    <div className="page page--builder">
      <div className="workspace-header">
        <div>
          <button className="button button--secondary button--inline" type="button" onClick={() => navigate(-1)} style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '8px' }}>
            ← {t('app.back')}
          </button>
          <h1>{t('builder.title')}</h1>
          <p>{t('builder.subtitle')}</p>
        </div>
        <div className="workspace-header__actions" style={{ flexWrap: 'nowrap', flexShrink: 0 }}>
          <StatusChip tone={draft.dirty ? 'warning' : 'success'}>{draft.dirty ? t('common.dirty') : t('common.saved')}</StatusChip>
          <button className="button button--secondary" type="button" onClick={() => void handleSaveAs()} disabled={isSaveDisabled}>
            {t('builder.actions.saveAs')}
          </button>
          <button className="button button--primary" type="button" onClick={() => void saveAndOpenDetails()} disabled={isSaveDisabled}>
            {t('app.create')}
          </button>
        </div>
      </div>

      <div className="builder-grid">
        <div className="builder-main">
          <SectionCard title={t('builder.sections.basic')} description={t('builder.descriptions.basic')}>
            <div className="field-grid">
              <div className="field form-row-align">
                <label className="field__label" htmlFor="machine-name-input">{t('builder.labels.name')}</label>
                <div>
                  <input
                    id="machine-name-input"
                    value={machine.title}
                    onChange={(event) => updateDraft((current) => ({ ...current, title: event.target.value }))}
                    style={{ width: '100%', borderColor: isTitleEmpty ? 'var(--danger)' : isTitleDuplicate ? 'var(--warning)' : undefined }}
                  />
                  {isTitleDuplicate && (
                    <span className="field__hint" style={{ marginTop: '6px', display: 'block', fontSize: '0.78rem', color: 'var(--warning)', fontWeight: 500 }}>
                      ⚠️ {t('builder.descriptions.nameDuplicateWarning').replace('<新名称>', uniqueTitle)}
                    </span>
                  )}
                  {isTitleEmpty && (
                    <span className="field__hint" style={{ marginTop: '6px', display: 'block', fontSize: '0.78rem', color: 'var(--danger)', fontWeight: 500 }}>
                      ⚠️ {t('builder.descriptions.nameEmptyWarning')}
                    </span>
                  )}
                  <span className="field__hint" style={{ marginTop: '6px', display: 'block', fontSize: '0.78rem' }}>
                    {t('notices.defaultMachineLocation')} <strong>{defaultMachineLocation}</strong>
                  </span>
                </div>
              </div>
              <label className="field form-row-align form-row-align--top">
                <span className="field__label">{t('builder.labels.notes')}</span>
                <textarea
                  rows={3}
                  value={machine.meta.notes}
                  onChange={(event) =>
                    updateDraft((current) => ({
                      ...current,
                      meta: { ...current.meta, notes: event.target.value }
                    }))
                  }
                />
              </label>
            </div>
            <div style={{ marginTop: '20px' }}>
              <span className="field__label" style={{ display: 'block', marginBottom: '10px' }}>{t('builder.labels.template')}</span>
              <div className="template-grid">
                {templates
                  .filter((entry) => entry.enabled)
                  .map((entry) => {
                    const isActive = entry.key === selectedTemplateKey;
                    return (
                      <button
                        key={entry.key}
                        className={isActive ? 'template-card template-card--active' : 'template-card'}
                        type="button"
                        onClick={() => void applyTemplateSelection(entry.key)}
                      >
                        <div className="template-card__header">
                          <span className="template-card__icon">
                            {getTemplateIcon(entry.key)}
                          </span>
                          <strong>{entry.label}</strong>
                        </div>
                        <span>{entry.source === 'builtin' ? t('builder.descriptions.templateBuiltIn') : t('builder.descriptions.templateImported')}</span>
                        {isActive && <span className="template-card__checkbox">✓</span>}
                      </button>
                    );
                  })}
              </div>
            </div>
          </SectionCard>

          <SectionCard title={t('builder.sections.boot')} description={t('builder.descriptions.boot')}>
            <div className="field-grid" style={{ marginBottom: '20px' }}>
              <div className="form-row-align">
                <span className="field__label">{t('builder.labels.bootOrder')}</span>
                <MaterialSelect
                  label={t('builder.labels.bootOrder')}
                  value={machine.system.boot_order}
                  options={bootOrderOptions}
                  onChange={(nextValue: SakaMachine['system']['boot_order']) => updateDraft((current) => ({ ...current, system: { ...current.system, boot_order: nextValue } }))}
                />
              </div>
              <div className="form-row-align form-row-align--top">
                <span className="field__label">{t('builder.labels.iso')}</span>
                <div className="path-picker-card">
                  <span className="path-picker-card__icon">
                    <CDIcon />
                  </span>
                  <span className={`path-picker-card__path ${!machine.media.iso ? 'path-picker-card__path--empty' : ''}`}>
                    {machine.media.iso || t('builder.descriptions.noImage')}
                  </span>
                  <div className="path-picker-card__actions">
                    <button
                      className="button button--secondary path-picker-card__button"
                      type="button"
                      onClick={async () => {
                        const picked = await window.electronAPI.dialogs.pickIso();
                        if (!picked?.path) return;
                        updateDraft((current) => ({ ...current, media: { ...current.media, iso: picked.path } }));
                      }}
                    >
                      {t('builder.actions.pickIso')}
                    </button>
                    {machine.media.iso && (
                      <button
                        className="button button--ghost path-picker-card__button"
                        type="button"
                        onClick={() => updateDraft((current) => ({ ...current, media: { ...current.media, iso: '' } }))}
                      >
                        {t('builder.actions.clearIso')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <span className="field__label" style={{ display: 'block', marginBottom: '10px' }}>{t('builder.labels.disks')}</span>
              <div className="disk-stack">
                {machine.disks.length === 0 ? <div className="empty-inline">{t('builder.descriptions.noDisks')}</div> : null}
                {machine.disks.map((disk, index) => (
                  <div key={disk.id} className="disk-item">
                    <div className="disk-item__icon">
                      <DiskIcon />
                    </div>
                    <div className="disk-item__details">
                      <strong>{disk.path.split(/[/\\]/).pop()}</strong>
                      <p>{disk.path}</p>
                    </div>
                    <div className="disk-item__actions">
                      <div style={{ minWidth: '170px' }}>
                        <MaterialSelect
                          label={t('builder.labels.diskInterface')}
                          value={disk.interface}
                          options={visibleDiskInterfaceOptions}
                          onChange={(nextValue: DiskInterface) =>
                            updateDraft((current) => ({
                              ...current,
                              disks: current.disks.map((entry) => (entry.id === disk.id ? { ...entry, interface: nextValue } : entry))
                            }))
                          }
                        />
                      </div>
                      <StatusChip tone={disk.boot ? 'success' : 'default'}>{disk.boot ? 'Boot' : `Disk ${index + 1}`}</StatusChip>
                      <button
                        className="button button--ghost"
                        style={{ padding: '6px', minWidth: 'auto', display: 'inline-flex', color: 'var(--danger)' }}
                        type="button"
                        aria-label="Delete disk"
                        onClick={() =>
                          updateDraft((current) => ({
                            ...current,
                            disks: current.disks.filter((entry) => entry.id !== disk.id)
                          }))
                        }
                      >
                        <span style={{ width: '18px', height: '18px', display: 'inline-flex' }}>
                          <TrashIcon />
                        </span>
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  className="button button--secondary"
                  style={{ alignSelf: 'flex-start', marginTop: '4px' }}
                  type="button"
                  onClick={() => setIsDiskManagerOpen(true)}
                >
                  {t('builder.labels.addDisk')}
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard title={t('builder.sections.hardware')} description={t('builder.descriptions.hardware')}>
            <div className="field-grid">
              <div className="form-row-align">
                <span className="field__label">{t('builder.labels.arch')}</span>
                <MaterialSelect
                  label={t('builder.labels.arch')}
                  value={machine.system.arch}
                  options={visibleArchOptions}
                  onChange={(nextValue: SakaMachine['system']['arch']) => updateDraft((current) => ({ ...current, system: { ...current.system, arch: nextValue } }))}
                />
              </div>
              <div className="form-row-align">
                <span className="field__label">{t('builder.labels.accelerator')}</span>
                <div>
                  <MaterialSelect
                    label={t('builder.labels.accelerator')}
                    value={machine.system.accelerator}
                    options={acceleratorOptions}
                    onChange={(nextValue: SakaMachine['system']['accelerator']) => updateDraft((current) => ({ ...current, system: { ...current.system, accelerator: nextValue } }))}
                  />
                  {showArchWarning && (
                    <span className="field__hint" style={{ color: 'var(--danger)', marginTop: '8px', display: 'block', fontWeight: 500 }}>
                      ⚠️ {t('builder.descriptions.archMismatchWarning')
                            .replace('<宿主机架构名称>', (appMeta?.arch || '').toUpperCase())
                            .replace('<虚拟机架构名称>', machine.system.arch || '')}
                    </span>
                  )}
                </div>
              </div>
              <div className="form-row-align">
                <span className="field__label">{t('builder.labels.machineType')}</span>
                <MaterialSelect
                  label={t('builder.labels.machineType')}
                  value={machine.system.machine_type}
                  options={visibleMachineTypeOptions}
                  onChange={(nextValue: string) => updateDraft((current) => ({ ...current, system: { ...current.system, machine_type: nextValue } }))}
                />
              </div>
              <label className="field form-row-align">
                <span className="field__label">{t('builder.labels.memory')}</span>
                <input
                  type="number"
                  min={64}
                  step={64}
                  value={machine.system.memory_mib}
                  onChange={(event) =>
                    updateDraft((current) => ({
                      ...current,
                      system: {
                        ...current.system,
                        memory_mib: Math.max(64, Number(event.target.value) || 64)
                      }
                    }))
                  }
                />
              </label>
              <label className="field form-row-align">
                <span className="field__label">{t('builder.labels.cpuCores')}</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={machine.system.cpu_cores}
                  onChange={(event) =>
                    updateDraft((current) => ({
                      ...current,
                      system: {
                        ...current.system,
                        cpu_cores: Math.max(1, Number(event.target.value) || 1)
                      }
                    }))
                  }
                />
              </label>
              <div className="form-row-align">
                <span className="field__label">{t('builder.labels.soundCard')}</span>
                <MaterialSelect
                  label={t('builder.labels.soundCard')}
                  value={machine.system.sound_card}
                  options={visibleSoundOptions}
                  onChange={(nextValue: string) => updateDraft((current) => ({ ...current, system: { ...current.system, sound_card: nextValue } }))}
                />
              </div>
              <div className="form-row-align">
                <span className="field__label">{t('builder.labels.gpu')}</span>
                <MaterialSelect
                  label={t('builder.labels.gpu')}
                  value={machine.display.gpu}
                  options={visibleGpuOptions}
                  onChange={(nextValue: string) => updateDraft((current) => ({ ...current, display: { ...current.display, gpu: nextValue } }))}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title={t('builder.sections.experience')} description={t('builder.descriptions.experience')}>
            <div className="field-grid">
              <div className="form-row-align">
                <span className="field__label">{t('builder.labels.mouseAlignment')}</span>
                <label className="ios-toggle" aria-label={t('builder.labels.mouseAlignment')}>
                  <input
                    checked={machine.peripherals.usb_tablet}
                    type="checkbox"
                    aria-label={t('builder.labels.mouseAlignment')}
                    onChange={(event) => updateDraft((current) => ({ ...current, peripherals: { ...current.peripherals, usb_tablet: event.target.checked } }))}
                  />
                  <span className="ios-toggle__track">
                    <span className="ios-toggle__thumb" />
                  </span>
                </label>
              </div>
              <div className="form-row-align">
                <span className="field__label">{t('builder.labels.clipboardSharing')}</span>
                <label className="ios-toggle" aria-label={t('builder.labels.clipboardSharing')}>
                  <input
                    checked={machine.integration.clipboard.enabled}
                    type="checkbox"
                    aria-label={t('builder.labels.clipboardSharing')}
                    onChange={(event) => updateDraft((current) => ({ ...current, integration: { ...current.integration, clipboard: { ...current.integration.clipboard, enabled: event.target.checked } } }))}
                  />
                  <span className="ios-toggle__track">
                    <span className="ios-toggle__thumb" />
                  </span>
                </label>
              </div>
              {machine.integration.clipboard.enabled && (
                <div className="info-panel" style={{ marginTop: '4px' }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.5 }}>
                    {t('builder.descriptions.clipboardSharingHint')}
                  </p>
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard title={t('builder.sections.networkDisplay')} description={t('builder.descriptions.networkDisplay')}>
            <div className="field-grid" style={{ marginBottom: '20px' }}>
              <div className="form-row-align">
                <span className="field__label">{t('builder.labels.networkEnabled')}</span>
                <Checkbox
                  checked={machine.network.enabled}
                  onChange={(checked) => updateDraft((current) => ({ ...current, network: { ...current.network, enabled: checked } }))}
                  label={t('builder.labels.networkEnabled')}
                />
              </div>
              {machine.network.enabled && (
                <>
                  <div className="form-row-align">
                    <span className="field__label">{t('builder.labels.networkMode')}</span>
                    <MaterialSelect
                      label={t('builder.labels.networkMode')}
                      value={machine.network.mode}
                      options={networkModeOptions}
                      onChange={(nextValue: SakaMachine['network']['mode']) => updateDraft((current) => ({ ...current, network: { ...current.network, mode: nextValue } }))}
                    />
                  </div>
                  <div className="form-row-align">
                    <span className="field__label">{t('builder.labels.networkCard')}</span>
                    <MaterialSelect
                      label={t('builder.labels.networkCard')}
                      value={machine.network.card}
                      options={visibleNetworkCardOptions}
                      onChange={(nextValue: string) => updateDraft((current) => ({ ...current, network: { ...current.network, card: nextValue } }))}
                    />
                  </div>
                </>
              )}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div className="field-grid">
                <div className="form-row-align form-row-align--top">
                  <span className="field__label">{t('builder.labels.displayFrontend')}</span>
                  <div className="info-panel">
                    <strong>Sanaka</strong>
                    <p>{t('builder.descriptions.displaySanaka')}</p>
                  </div>
                </div>
                <div className="form-row-align form-row-align--top">
                  <span className="field__label">{t('builder.labels.sanakaBackend')}</span>
                  <div className="info-panel">
                    <strong>VNC</strong>
                    <p>{t('builder.descriptions.sanakaBackendVnc')}</p>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title={t('builder.sections.advanced')} description={t('builder.descriptions.advanced')}>
            <div className="field-grid">
              <div className="form-row-align">
                <span className="field__label">{t('builder.labels.uefi')}</span>
                <div>
                  <label className="ios-toggle" aria-label={t('builder.labels.uefi')}>
                    <input
                      checked={supportsUefi ? machine.system.uefi : false}
                      disabled={!supportsUefi}
                      type="checkbox"
                      aria-label={t('builder.labels.uefi')}
                      onChange={(event) =>
                        updateDraft((current) => ({
                          ...current,
                          system: {
                            ...current.system,
                            uefi: event.target.checked
                          }
                        }))
                      }
                    />
                    <span className="ios-toggle__track">
                      <span className="ios-toggle__thumb" />
                    </span>
                  </label>
                  <span className="field__hint" style={{ marginTop: '8px', display: 'block' }}>
                    {supportsUefi ? t('builder.descriptions.uefiHint') : t('builder.descriptions.uefiUnavailable')}
                  </span>
                </div>
              </div>

              {machine.system.uefi && supportsUefi && (
                <div className="firmware-config" style={{ marginTop: '16px', padding: '16px', background: 'var(--panel-muted)', borderRadius: '8px' }}>
                  <div className="form-row-align" style={{ marginBottom: '12px' }}>
                    <span className="field__label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '18px', height: '18px', display: 'inline-flex' }}><FirmwareIcon /></span>
                      {t('builder.labels.firmwareSource')}
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className={!machine.advanced.firmware?.code_path ? 'button button--primary' : 'button button--secondary'}
                        type="button"
                        onClick={() => updateDraft((current) => ({
                          ...current,
                          advanced: {
                            ...current.advanced,
                            firmware: { code_path: '', vars_path: '' }
                          }
                        }))}
                      >
                        {t('builder.firmware.auto')}
                      </button>
                      <button
                        className={machine.advanced.firmware?.code_path ? 'button button--primary' : 'button button--secondary'}
                        type="button"
                        onClick={() => updateDraft((current) => ({
                          ...current,
                          advanced: {
                            ...current.advanced,
                            firmware: { code_path: current.advanced.firmware?.code_path || '', vars_path: current.advanced.firmware?.vars_path || '' }
                          }
                        }))}
                      >
                        {t('builder.firmware.custom')}
                      </button>
                    </div>
                  </div>

                  <p className="field__hint" style={{ marginBottom: '16px', fontSize: '0.85rem' }}>
                    {!machine.advanced.firmware?.code_path
                      ? t('builder.descriptions.firmwareAuto')
                      : !machine.advanced.firmware?.vars_path
                        ? t('builder.descriptions.firmwareCodeOnly')
                        : t('builder.descriptions.firmwareCustom')}
                  </p>

                  {machine.advanced.firmware?.code_path !== undefined && (
                    <>
                      <div className="form-row-align form-row-align--top" style={{ marginBottom: '12px' }}>
                        <span className="field__label">{t('builder.labels.firmwareCode')}</span>
                        <div className="path-picker-card" style={{ flex: 1 }}>
                          <span className="path-picker-card__icon">
                            <FileIcon />
                          </span>
                          <span className={`path-picker-card__path ${!machine.advanced.firmware.code_path ? 'path-picker-card__path--empty' : ''}`}>
                            {machine.advanced.firmware.code_path
                              ? machine.advanced.firmware.code_path.split(/[/\\]/).pop()
                              : t('builder.descriptions.noFirmwareCode')}
                          </span>
                          <div className="path-picker-card__actions">
                            <button
                              className="button button--secondary path-picker-card__button"
                              type="button"
                              onClick={async () => {
                                const picked = await window.electronAPI.dialogs.pickFirmwareCode();
                                if (!picked?.path) return;
                                updateDraft((current) => ({
                                  ...current,
                                  advanced: {
                                    ...current.advanced,
                                    firmware: {
                                      vars_path: current.advanced.firmware?.vars_path || '',
                                      code_path: picked.path
                                    }
                                  }
                                }));
                              }}
                            >
                              {t('builder.actions.pickFile')}
                            </button>
                            {machine.advanced.firmware.code_path && (
                              <button
                                className="button button--ghost path-picker-card__button"
                                type="button"
                                onClick={() => updateDraft((current) => ({
                                  ...current,
                                  advanced: {
                                    ...current.advanced,
                                    firmware: {
                                      code_path: '',
                                      vars_path: current.advanced.firmware?.vars_path || ''
                                    }
                                  }
                                }))}
                              >
                                {t('builder.actions.clear')}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      {machine.advanced.firmware.code_path && (
                        <span className="field__hint" style={{ display: 'block', marginBottom: '12px', fontSize: '0.78rem', wordBreak: 'break-all' }}>
                          {machine.advanced.firmware.code_path}
                        </span>
                      )}

                      <div className="form-row-align form-row-align--top">
                        <span className="field__label">{t('builder.labels.firmwareVars')}</span>
                        <div className="path-picker-card" style={{ flex: 1 }}>
                          <span className="path-picker-card__icon">
                            <FileIcon />
                          </span>
                          <span className={`path-picker-card__path ${!machine.advanced.firmware.vars_path ? 'path-picker-card__path--empty' : ''}`}>
                            {machine.advanced.firmware.vars_path
                              ? machine.advanced.firmware.vars_path.split(/[/\\]/).pop()
                              : t('builder.descriptions.noFirmwareVars')}
                          </span>
                          <div className="path-picker-card__actions">
                            <button
                              className="button button--secondary path-picker-card__button"
                              type="button"
                              onClick={async () => {
                                const picked = await window.electronAPI.dialogs.pickFirmwareVars();
                                if (!picked?.path) return;
                                updateDraft((current) => ({
                                  ...current,
                                  advanced: {
                                    ...current.advanced,
                                    firmware: {
                                      code_path: current.advanced.firmware?.code_path || '',
                                      vars_path: picked.path
                                    }
                                  }
                                }));
                              }}
                            >
                              {t('builder.actions.pickFile')}
                            </button>
                            {machine.advanced.firmware.vars_path && (
                              <button
                                className="button button--ghost path-picker-card__button"
                                type="button"
                                onClick={() => updateDraft((current) => ({
                                  ...current,
                                  advanced: {
                                    ...current.advanced,
                                    firmware: {
                                      code_path: current.advanced.firmware?.code_path || '',
                                      vars_path: ''
                                    }
                                  }
                                }))}
                              >
                                {t('builder.actions.clear')}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      {machine.advanced.firmware.vars_path && (
                        <span className="field__hint" style={{ display: 'block', marginTop: '8px', fontSize: '0.78rem', wordBreak: 'break-all' }}>
                          {machine.advanced.firmware.vars_path}
                        </span>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className="form-row-align" style={{ marginTop: '16px' }}>
                <span className="field__label">{t('builder.labels.audioBackend')}</span>
                <MaterialSelect
                  label={t('builder.labels.audioBackend')}
                  value={machine.advanced.audio_backend}
                  options={audioBackendOptions}
                  onChange={(nextValue: SakaMachine['advanced']['audio_backend']) => updateDraft((current) => ({ ...current, advanced: { ...current.advanced, audio_backend: nextValue } }))}
                />
              </div>
              <div className="qemu-args-list__wrapper">
                <QemuArgsList
                  machine={machine}
                  onChange={(next) => updateDraft(() => next)}
                  t={t}
                />
              </div>
            </div>
          </SectionCard>
        </div>

        <aside className="builder-aside">
          <SectionCard title={t('builder.summary.title')}>
            <div className="spec-list" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="spec-row">
                <span className="spec-row__label">
                  <span className="spec-row__icon"><CustomIcon /></span>
                  {t('builder.summary.machine')}
                </span>
                <span className="spec-row__value">{machine.title}</span>
              </div>
              <div className="spec-row">
                <span className="spec-row__label">
                  <span className="spec-row__icon"><WindowsIcon /></span>
                  {t('builder.summary.template')}
                </span>
                <span className="spec-row__value">{machine.template.label}</span>
              </div>
              <div className="spec-row">
                <span className="spec-row__label">
                  <span className="spec-row__icon"><CPUIcon /></span>
                  {t('builder.summary.compute')}
                </span>
                <span className="spec-row__value">{`${machine.system.cpu_cores} CPU · ${machine.system.memory_mib} MiB`}</span>
              </div>
              <div className="spec-row">
                <span className="spec-row__label">
                  <span className="spec-row__icon"><MonitorIcon /></span>
                  {t('builder.summary.display')}
                </span>
                <span className="spec-row__value">{displayHint}</span>
              </div>
              <div className="spec-row">
                <span className="spec-row__label">
                  <span className="spec-row__icon"><SpeakerIcon /></span>
                  {t('builder.summary.audio')}
                </span>
                <span className="spec-row__value">{audioHint}</span>
              </div>
              <div className="spec-row">
                <span className="spec-row__label">
                  <span className="spec-row__icon"><DiskIcon /></span>
                  {t('builder.summary.disks')}
                </span>
                <span className="spec-row__value">{machine.disks.length}</span>
              </div>
              <div className="spec-row">
                <span className="spec-row__label">
                  <span className="spec-row__icon"><NetworkIcon /></span>
                  {t('builder.summary.network')}
                </span>
                <span className="spec-row__value">{machine.network.enabled ? `${machine.network.mode}` : t('common.disabled')}</span>
              </div>
            </div>
          </SectionCard>

          <SectionCard title={t('builder.summary.warnings')}>
            <div className="warning-stack">
              {warnings.map((warning) => (
                <div key={warning} className="warning-panel">
                  <span className="warning-panel__icon">
                    <AlertIcon />
                  </span>
                  <span>{warning}</span>
                </div>
              ))}
              {warnings.length === 0 ? (
                <div className="empty-inline" style={{ color: 'var(--success)', background: 'rgba(27, 122, 88, 0.06)', border: '1px solid rgba(27, 122, 88, 0.15)' }}>
                  {t('builder.descriptions.cleanWarnings')}
                </div>
              ) : null}
            </div>
          </SectionCard>
        </aside>
      </div>

      <DiskImageManager
        isOpen={isDiskManagerOpen}
        onClose={() => setIsDiskManagerOpen(false)}
        existingDisks={machine.disks}
        onDisksChange={(newDisks) => updateDraft((current) => ({ ...current, disks: newDisks as SakaMachine['disks'] }))}
        defaultInterface={defaultDiskInterface}
        bundlePath={draft.filePath}
      />
    </div>
  );
}
