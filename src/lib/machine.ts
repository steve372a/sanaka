import type { DisplayFrontend, MachineDraft, RecentEntry, SakaMachine, SakaTemplate, WorkspaceMachineItem, WorkspaceSelection } from '../domain/schemas';
import { isSameMachinePath } from './machinePath';

const KNOWN_ACCELERATORS = ['tcg', 'mttcg', 'kvm', 'hax', 'whpx', 'hvf'] as const;
type KnownAccelerator = (typeof KNOWN_ACCELERATORS)[number];

function guestFamily(guestArch: string) {
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

function hostFamily(hostArch: string) {
  if (hostArch === 'x64' || hostArch === 'ia32') {
    return 'x86';
  }
  if (hostArch === 'arm64' || hostArch === 'arm') {
    return 'arm';
  }
  return hostArch;
}

export function isGuestArchCompatibleWithHost(hostArch: string | null | undefined, guestArch: string | null | undefined) {
  if (!hostArch || !guestArch) {
    return true;
  }
  return hostFamily(hostArch.toLowerCase()) === guestFamily(guestArch.toLowerCase());
}

export function getSupportedAccelerators({
  hostArch,
  guestArch,
  availableAccelerators
}: {
  hostArch: string | null | undefined;
  guestArch: string | null | undefined;
  availableAccelerators: readonly string[] | null | undefined;
}): Array<SakaMachine['system']['accelerator']> {
  if (!guestArch || guestArch === 'none') {
    return ['none'];
  }

  const normalizedAvailable = (availableAccelerators || [])
    .map((value) => value.toLowerCase())
    .filter((value): value is KnownAccelerator =>
      (KNOWN_ACCELERATORS as readonly string[]).includes(value)
    );

  const ordered: KnownAccelerator[] = [];
  const pushUnique = (value: KnownAccelerator) => {
    if (!ordered.includes(value)) {
      ordered.push(value);
    }
  };

  normalizedAvailable.forEach(pushUnique);
  KNOWN_ACCELERATORS.forEach(pushUnique);

  return ordered;
}

export function makeDisplayHint(machine: SakaMachine) {
  if (machine.display.frontend === 'sanaka') {
    return 'Sanaka / VNC';
  }
  return machine.display.frontend.toUpperCase();
}

export function makeAudioHint(frontend: DisplayFrontend, backendHint: string, audioBackend = 'auto') {
  if (audioBackend === 'auto') return 'System audio auto-detect.';
  if (frontend === 'vnc') return `${audioBackend} host audio with VNC display.`;
  if (frontend === 'spice') return `${audioBackend} host audio with SPICE display.`;
  return `${audioBackend} host audio with Sanaka / ${backendHint.toUpperCase()}.`;
}

function toFileUrl(filePath: string) {
  if (/^https?:\/\//i.test(filePath) || filePath.startsWith('/api/')) {
    return filePath;
  }
  const normalized = filePath.replace(/\\/g, '/');
  return new URL(`file://${normalized.startsWith('/') ? '' : '/'}${normalized}`).toString();
}

export function makeRecentEntry(machine: SakaMachine, filePath: string, previewPath?: string): RecentEntry {
  return {
    id: machine.id,
    title: machine.title,
    path: filePath,
    kind: 'machine',
    author: machine.author || undefined,
    templateLabel: machine.template.label,
    previewImageUrl: previewPath ? toFileUrl(previewPath) : undefined,
    updatedAt: machine.updated_at ?? new Date().toISOString(),
    status: 'saved'
  };
}

function dedupeKey(item: Pick<WorkspaceMachineItem, 'id'>) {
  return item.id;
}

export async function checkMachinePaths(items: WorkspaceMachineItem[]): Promise<WorkspaceMachineItem[]> {
  const checked = await Promise.all(
    items.map(async (item) => {
      if (!item.path || item.source === 'draft') return item;
      const exists = await window.electronAPI.files.pathExists(item.path);
      return exists ? item : { ...item, missing: true };
    })
  );
  return checked;
}

export function makeWorkspaceMachineItems(recents: RecentEntry[], draft: MachineDraft | null): WorkspaceMachineItem[] {
  const seenRecentIds = new Set<string>();
  const items = recents.reduce<WorkspaceMachineItem[]>((current, entry) => {
    if (seenRecentIds.has(entry.id)) return current;
    seenRecentIds.add(entry.id);
    current.push({
      id: entry.id,
      title: entry.title,
      path: entry.path,
      author: entry.author,
      templateLabel: entry.templateLabel,
      previewImageUrl: entry.previewImageUrl,
      updatedAt: entry.updatedAt,
      status: entry.status,
      source: 'recent'
    });
    return current;
  }, []);

  if (!draft?.filePath) {
    return items;
  }

  const draftItem: WorkspaceMachineItem = {
    id: draft.machine.id,
    title: draft.machine.title,
    path: draft.filePath,
    author: draft.machine.author || undefined,
    templateLabel: draft.machine.template.label,
    previewImageUrl: draft.previewPath ? new URL(`file://${draft.previewPath.startsWith('/') ? '' : '/'}${draft.previewPath.replace(/\\/g, '/')}`).toString() : undefined,
    updatedAt: draft.machine.updated_at ?? new Date().toISOString(),
    status: draft.dirty ? 'draft' : 'saved',
    source: 'draft',
    dirty: draft.dirty
  };

  const existingIndex = items.findIndex((entry) => dedupeKey(entry) === dedupeKey(draftItem));
  if (existingIndex >= 0) {
    items[existingIndex] = {
      ...items[existingIndex],
      ...draftItem,
      source: draftItem.source
    };
    return items;
  }

  return [draftItem, ...items];
}

export function resolveWorkspaceSelection(items: WorkspaceMachineItem[], pathname: string, search: string, draft: MachineDraft | null): WorkspaceSelection {
  if (items.length === 0) {
    return { items, primary: null };
  }

  const params = new URLSearchParams(search);
  const routePath = params.get('path');
  const pathSegments = pathname.split('/').filter(Boolean);
  const isUnsavedBuilder = pathSegments[0] === 'machines' && pathSegments[1] === 'new' && !draft?.filePath;
  const routeMachineId = pathSegments[0] === 'machines' && pathSegments[1] && pathSegments[1] !== 'new' ? decodeURIComponent(pathSegments[1]) : null;

  if (isUnsavedBuilder) {
    return { items, primary: null };
  }

  const primary =
    (routePath ? items.find((item) => isSameMachinePath(item.path, routePath)) : null) ??
    (routeMachineId ? items.find((item) => item.id === routeMachineId) : null) ??
    (draft ? items.find((item) => item.id === draft.machine.id) : null) ??
    items[0];

  return { items, primary };
}

export function collectMachineWarnings(machine: SakaMachine) {
  const warnings: string[] = [];
  if (machine.template.key === 'win98') {
    warnings.push('Windows 98 模板建议继续保持 TCG、Cirrus VGA、IDE 和 PCnet 组合。');
  }
  if (machine.template.key === 'win11' && machine.disks.some((disk) => disk.interface === 'virtio')) {
    warnings.push('Windows 10 模板如果使用 VirtIO 磁盘，需要在系统安装阶段额外加载驱动。');
  }
  if (machine.display.frontend === 'spice') {
    warnings.push('当前主流程显示方式已经收敛为 Sanaka / VNC，旧的 SPICE 配置建议改回 Sanaka。');
  }
  if (machine.system.uefi) {
    warnings.push('UEFI 需要宿主机存在可用固件，若未找到固件将无法启动。');
  }
  if (machine.network.mode === 'bridge') {
    warnings.push('Bridge 网络在不同平台上的配置方式会不同，后续 Runtime 层需要单独适配。');
  }
  return warnings;
}

export function machineToTemplate(machine: SakaMachine): SakaTemplate {
  return {
    format_version: 1,
    kind: 'template',
    id: `${machine.id}-template`,
    title: `${machine.title} Template`,
    description: machine.description,
    template: machine.template,
    system: machine.system,
    media: machine.media,
    network: machine.network,
    sharing: machine.sharing,
    integration: machine.integration,
    display: machine.display,
    peripherals: machine.peripherals,
    advanced: machine.advanced
  };
}
