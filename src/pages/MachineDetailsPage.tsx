import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MachineVisual } from '../components/MachineVisual';
import { StatusChip } from '../components/Field';
import type { SakaMachine } from '../domain/schemas';
import { useT } from '../hooks/useT';
import type { FullscreenTransitionOrigin } from '../lib/fullscreenTransition';
import { consoleRoute } from '../lib/routes';
import { isSameMachinePath } from '../lib/machinePath';
import { getWebResourceDisplayName, isWebMode } from '../lib/webMode';
import { useAppStore } from '../store/AppStore';

// 图标组件
const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

const EditIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const FolderIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6.8A1.8 1.8 0 0 1 4.8 5h5l2 2h7.4A1.8 1.8 0 0 1 21 8.8v8.4a1.8 1.8 0 0 1-1.8 1.8H4.8A1.8 1.8 0 0 1 3 17.2Z" />
  </svg>
);

const DisplayIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const AudioIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
  </svg>
);

const NetworkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const MediaIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="4" />
    <line x1="12" y1="2" x2="12" y2="8" />
    <line x1="12" y1="16" x2="12" y2="22" />
    <line x1="2" y1="12" x2="8" y2="12" />
    <line x1="16" y1="12" x2="22" y2="12" />
  </svg>
);

const DiskIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L2 7l10 5 10-5-10-5z" />
    <path d="M2 12l10 5 10-5" />
    <path d="M2 17l10 5 10-5" />
  </svg>
);

const ArchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

function statusLabel(
  status: string | undefined,
  t: ReturnType<typeof useT>
): string {
  switch (status) {
    case 'starting':
      return t('common.states.starting');
    case 'running':
      return t('common.states.running');
    case 'stopping':
      return t('common.states.stopping');
    case 'stopped':
      return t('common.states.stopped');
    default:
      return t('common.notStarted');
  }
}

function statusTone(status: string | undefined): 'success' | undefined {
  if (status === 'running') return 'success';
  if (status === 'starting' || status === 'stopping') return undefined;
  return undefined;
}

// 配置信息项组件
interface ConfigItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function ConfigItem({ icon, label, value }: ConfigItemProps) {
  return (
    <div className="details-config-item">
      <span className="details-config-item__icon">{icon}</span>
      <span className="details-config-item__copy">
        <span className="details-config-item__label">{label}</span>
        <span className="details-config-item__value" title={value}>{value}</span>
      </span>
    </div>
  );
}

function formatArchitecture(machine: SakaMachine, t: ReturnType<typeof useT>) {
  const label = t(`builder.architectures.${machine.system.arch}`);
  if (machine.system.arch === 'aarch64' && machine.system.uefi) {
    return `${label} · ${t('details.armUefi')}`;
  }
  if (machine.system.uefi) {
    return `${label} · UEFI`;
  }
  return label;
}

function formatAudioBackend(value: SakaMachine['advanced']['audio_backend']) {
  const names: Partial<Record<SakaMachine['advanced']['audio_backend'], string>> = {
    coreaudio: 'CoreAudio',
    directsound: 'DirectSound',
    pulseaudio: 'PulseAudio',
    pipewire: 'PipeWire',
    spice: 'SPICE'
  };
  return names[value] ?? value;
}

function formatNetworkCard(value: string) {
  const names: Record<string, string> = {
    rtl8139: 'RTL8139',
    e1000: 'Intel E1000',
    'virtio-net-pci': 'VirtIO'
  };
  return names[value] ?? value;
}

export function MachineDetailsPage() {
  const {
    draft,
    openSakaByPath,
    settings,
    runtimeEnvironment,
    getRuntimeStateForMachine,
    startMachine,
    triggerTransition,
    setDeleteTarget
  } = useAppStore();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const t = useT();
  const pendingConsolePathRef = useRef<string | null>(null);

  useEffect(() => {
    const pathParam = params.get('path');
    if (pathParam && !isSameMachinePath(draft?.filePath, pathParam)) {
      void openSakaByPath(pathParam).then((result) => {
        if (!result) {
          navigate('/', { replace: true });
        }
      });
    }
  }, [draft?.filePath, navigate, openSakaByPath, params]);

  useEffect(() => {
    if (!draft?.filePath) return;
    if (pendingConsolePathRef.current !== draft.filePath) return;
    const pendingRuntimeState = getRuntimeStateForMachine(draft.machine.id);
    if (!pendingRuntimeState || (pendingRuntimeState.status !== 'starting' && pendingRuntimeState.status !== 'running')) return;

    pendingConsolePathRef.current = null;
    navigate(consoleRoute(pendingRuntimeState.machineId, draft.filePath), { replace: true });
  }, [draft?.filePath, draft?.machine.id, getRuntimeStateForMachine, navigate]);

  if (!draft) {
    return <div className="page-loading">{t('common.loading')}</div>;
  }

  const machine = draft.machine;
  const runtimeState = getRuntimeStateForMachine(machine.id);
  const machineStatus = runtimeState?.status;
  const isMachineRunning = machineStatus === 'running' || machineStatus === 'starting';
  const qemuAvailable = runtimeEnvironment?.available ?? false;
  const displayHint = machine.display.frontend === 'sanaka'
    ? t('details.displaySanakaVnc')
    : machine.display.frontend.toUpperCase();
  const audioHint = machine.advanced.audio_backend === 'auto'
    ? t('details.audioAutomatic')
    : t('details.audioBackend', { backend: formatAudioBackend(machine.advanced.audio_backend) });
  const networkHint = machine.network.enabled
    ? t(machine.network.mode === 'bridge' ? 'details.networkBridge' : 'details.networkUser', {
      card: formatNetworkCard(machine.network.card)
    })
    : t('common.disabled');

  const handlePlayClick = (origin: FullscreenTransitionOrigin) => {
    if (!draft.filePath || !qemuAvailable) return;
    if (isMachineRunning) {
      triggerTransition('console', () => {
        navigate(consoleRoute(machine.id, draft.filePath!));
      }, origin);
    } else {
      triggerTransition('launch', async () => {
        pendingConsolePathRef.current = draft.filePath!;
        const result = await startMachine(draft.filePath!);
        if (result.ok) {
          navigate(consoleRoute(result.machineId ?? machine.id, result.machinePath));
          return;
        }
        pendingConsolePathRef.current = null;
      }, origin);
    }
  };

  return (
    <div className="page page--details">
      <div className="details-container">
        {/* 预览图区域 */}
        <section className="details-preview-section">
          <MachineVisual
            entry={{
              path: draft.filePath,
              previewImageUrl: draft.previewPath,
              templateLabel: machine.template.label,
              status: draft.dirty ? 'draft' : 'saved'
            }}
            className="details-preview"
            imageClassName="details-preview__image"
            placeholderLabel={t('home.previewEmpty')}
            isRunning={isMachineRunning}
            onPlayClick={qemuAvailable ? handlePlayClick : undefined}
          />
        </section>

        {/* 标题区域 */}
        <section className="details-header-section">
          <div className="details-header-main">
            <h1 className="details-title">{machine.title}</h1>
            <div className="details-meta-row">
              <p className="details-subtitle">{machine.template.label}</p>
              <StatusChip tone={statusTone(machineStatus)}>
                {statusLabel(machineStatus, t)}
              </StatusChip>
            </div>
          </div>
          <div className="details-header-actions">
            {isWebMode() && draft.filePath && (
              <button
                className="button button--secondary details-edit-button"
                type="button"
                onClick={() => navigate(`/machines/${encodeURIComponent(machine.id)}/files`)}
              >
                <FolderIcon />
                <span>{t('webFiles.title')}</span>
              </button>
            )}
            <button
              className="button details-edit-button"
              type="button"
              onClick={() => navigate('/machines/new')}
            >
              <EditIcon />
              <span>{t('details.editConfig')}</span>
            </button>
          </div>
        </section>

        {/* QEMU 警告 */}
        {!qemuAvailable && (
          <div className="warning-banner warning-banner--details" role="alert">
            <strong>{t('common.qemuMissing')}</strong>
            {runtimeEnvironment?.installHint && (
              <span className="warning-banner__hint">
                {runtimeEnvironment.installHint}
              </span>
            )}
          </div>
        )}

        {/* 配置信息区域 */}
        <section className="details-config-section">
          <h2 className="details-section-title">{t('details.configuration')}</h2>
          <div className="details-config-card">
            <ConfigItem
              icon={<DisplayIcon />}
              label={t('details.display')}
              value={displayHint}
            />
            <ConfigItem
              icon={<AudioIcon />}
              label={t('details.audio')}
              value={audioHint}
            />
            <ConfigItem
              icon={<NetworkIcon />}
              label={t('details.network')}
              value={networkHint}
            />
            <ConfigItem
              icon={<MediaIcon />}
              label={t('details.media')}
              value={getWebResourceDisplayName(machine.media.iso) || t('details.noMedia')}
            />
            <ConfigItem
              icon={<DiskIcon />}
              label={t('details.disks')}
              value={t('details.diskCount', { count: machine.disks.length })}
            />
            <ConfigItem
              icon={<ArchIcon />}
              label={t('details.architecture')}
              value={formatArchitecture(machine, t)}
            />
          </div>
        </section>

        {/* 危险操作区域 */}
        {draft.filePath && (
          <section className="details-danger-section">
            <h2 className="details-section-title">{t('details.deleteTitle')}</h2>
            <div className="details-danger-card">
              <div className="details-danger-info">
                <strong>{t('details.deleteTitle')}</strong>
                <p>{t('details.deleteDescription')}</p>
              </div>
              <button
                className="icon-button icon-button--danger"
                type="button"
                onClick={() => setDeleteTarget({ path: draft.filePath!, title: machine.title })}
                aria-label={t('details.deleteMachine')}
                title={t('details.deleteMachine')}
              >
                <TrashIcon />
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
