import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../store/AppStore';
import { useT } from '../hooks/useT';
import { NoVncViewport, type NoVncInputMode, type NoVncScaleMode, type NoVncViewportHandle } from '../components/NoVncViewport';
import { WebFilePickerDialog } from '../components/WebFileBrowser';
import { usePresence } from '../hooks/usePresence';
import { makeAudioHint, makeDisplayHint } from '../lib/machine';
import { isSameMachinePath } from '../lib/machinePath';
import { formatRuntimeBackend } from '../lib/console-session';

// 移动端检测 hook
function useMobileDetect() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 760);
  const [isPortrait, setIsPortrait] = useState(() => window.innerHeight > window.innerWidth);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 760);
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return { isMobile, isPortrait };
}


/* ---- icons ---- */
const ArrowLeftIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const InfoCircleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const OpticalDiscIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <circle cx="12" cy="12" r="9.25" />
    <circle cx="12" cy="12" r="2.1" />
    <path d="M15.3 6.2a7 7 0 0 1 2.5 2.5" />
    <path d="M8.7 17.8a7 7 0 0 1-2.5-2.5" />
  </svg>
);

const ResetIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </svg>
);

const PowerIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
    <line x1="12" y1="2" x2="12" y2="12" />
  </svg>
);

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" width="20" height="20">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const AlertIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const MonitorIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const SpeakerIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
  </svg>
);

const PowerStatusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
);

// Info drawer specific icons
const DisplayProtocolIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const AudioIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
  </svg>
);

const ConnectionIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <path d="M5 12.55a11 11 0 0 1 14.08 0" />
    <path d="M1.42 9a16 16 0 0 1 21.16 0" />
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
    <line x1="12" y1="20" x2="12.01" y2="20" />
  </svg>
);

const DisplayBackendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <circle cx="12" cy="10" r="2" />
    <path d="M6 21h12" />
  </svg>
);

const PortIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <rect x="3" y="7" width="18" height="10" rx="2" />
    <line x1="7" y1="7" x2="7" y2="17" />
    <line x1="12" y1="7" x2="12" y2="17" />
    <line x1="17" y1="7" x2="17" y2="17" />
  </svg>
);

const WebSocketIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <path d="M4 4h16v16H4z" />
    <path d="M9 9l6 6" />
    <path d="M15 9l-6 6" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </svg>
);

const MacAddressIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <line x1="4" y1="9" x2="20" y2="9" />
    <line x1="9" y1="4" x2="9" y2="9" />
    <circle cx="15" cy="15" r="1" fill="currentColor" />
    <circle cx="18" cy="15" r="1" fill="currentColor" />
  </svg>
);

const BootstrapIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v4" />
    <path d="M12 18v4" />
  </svg>
);

const ClipboardIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <rect x="9" y="2" width="6" height="4" rx="1" />
    <rect x="4" y="6" width="16" height="14" rx="2" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const QemuStatusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <path d="M12 2L2 7l10 5 10-5-10-5z" />
    <path d="M2 17l10 5 10-5" />
    <path d="M2 12l10 5 10-5" />
  </svg>
);

const ScaleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M8 3v18M16 3v18M3 8h18M3 16h18" />
  </svg>
);

const MoreIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <circle cx="12" cy="6" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="12" cy="18" r="1.5" />
  </svg>
);

const KeyboardIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <line x1="6" y1="8" x2="6" y2="8" />
    <line x1="10" y1="8" x2="10" y2="8" />
    <line x1="14" y1="8" x2="14" y2="8" />
    <line x1="18" y1="8" x2="18" y2="8" />
    <line x1="6" y1="12" x2="6" y2="12" />
    <line x1="10" y1="12" x2="10" y2="12" />
    <line x1="14" y1="12" x2="14" y2="12" />
    <line x1="18" y1="12" x2="18" y2="12" />
    <line x1="6" y1="16" x2="18" y2="16" />
  </svg>
);

const PenDrawIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    {/* 平板/触控板底座 */}
    <path d="M2 14 L12 6 L22 14 L12 22 Z" />
    <path d="M2 14 L2 16 L12 24 L22 16 L22 14" />
    {/* 触控笔 */}
    <path d="M14 4 L18 2 L20 6 L16 8 Z" fill="currentColor" opacity="0.2" />
    <path d="M14 4 L18 2 L20 6 L16 8 Z" />
    <line x1="16" y1="8" x2="12" y2="14" />
    {/* 笔尖触点 */}
    <circle cx="12" cy="14" r="1.5" fill="currentColor" />
  </svg>
);

const MouseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    {/* 鼠标主体轮廓 */}
    <rect x="6" y="3" width="12" height="18" rx="6" />
    {/* 滚轮 */}
    <line x1="12" y1="7" x2="12" y2="10" />
    {/* 左右键分隔线 */}
    <path d="M6 9 L18 9" />
    {/* 鼠标线 */}
    <path d="M12 3 Q12 0 14 0" />
  </svg>
);

/* ---- helpers ---- */
function statusDot(status: string | undefined) {
  if (status === 'running') return <span className="console-topbar__dot console-topbar__dot--running" />;
  if (status === 'starting' || status === 'stopping') return <span className="console-topbar__dot console-topbar__dot--intermediate" />;
  return <span className="console-topbar__dot" />;
}

function statusLabel(t: (key: string) => string, status: string | undefined) {
  if (status === 'running') return t('console.states.running');
  if (status === 'starting') return t('console.waitingConnection');
  if (status === 'stopping') return t('console.states.disconnected');
  return t('console.states.disconnected');
}

/* ---- main ---- */
export function MachineConsolePage() {
  const { machineId: rawMachineId } = useParams<{ machineId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const t = useT();
  const [infoOpen, setInfoOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [enhancementsOpen, setEnhancementsOpen] = useState(false);
  const [terminateConfirmOpen, setTerminateConfirmOpen] = useState(false);
  const [scaleMode, setScaleMode] = useState<NoVncScaleMode>('fit');
  const infoDrawer = usePresence(infoOpen, 240);
  const menuRef = useRef<HTMLDivElement>(null);
  const terminateModal = usePresence(terminateConfirmOpen);
  const pathParam = searchParams.get('path') ?? undefined;
  const { isMobile, isPortrait } = useMobileDetect();
  const viewportRef = useRef<NoVncViewportHandle>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [webMediaPickerOpen, setWebMediaPickerOpen] = useState(false);
  const [inputMode, setInputMode] = useState<NoVncInputMode>('touch');
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSocketRef = useRef<WebSocket | null>(null);
  const audioQueueTimeRef = useRef(0);

  const scaleOptions: Array<{ value: NoVncScaleMode; label: string }> = [
    { value: 'native', label: t('console.scaleNative') },
    { value: 'fit', label: t('console.scaleFit') },
    { value: 'stretch', label: t('console.scaleStretch') }
  ];

  const {
    draft,
    recents,
    openSakaByPath,
    runtimeEnvironment,
    getRuntimeStateForMachine,
    runtimeMachines,
    startMachine,
    forceStopMachine,
    settings,
    setStartError
  } = useAppStore();

  const machineId = rawMachineId ? decodeURIComponent(rawMachineId) : '';

  useEffect(() => {
    if (pathParam && !isSameMachinePath(draft?.filePath, pathParam)) {
      void openSakaByPath(pathParam).then((result) => {
        if (!result) {
          navigate('/', { replace: true });
        }
      });
    }
  }, [draft?.filePath, navigate, openSakaByPath, pathParam]);

  const draftMatchesRoute = draft?.machine.id === machineId || isSameMachinePath(draft?.filePath, pathParam);
  const machine = draftMatchesRoute ? draft?.machine : undefined;
  const machinePath = pathParam ?? (draftMatchesRoute ? draft?.filePath : undefined);

  const runtimeState = useMemo(
    () =>
      getRuntimeStateForMachine(machineId) ??
      runtimeMachines.find((entry) => entry.machineId === machineId) ??
      (machinePath
        ? runtimeMachines.find((entry) => isSameMachinePath(entry.bundlePath, machinePath) || isSameMachinePath(entry.configPath, machinePath))
        : undefined),
    [getRuntimeStateForMachine, machineId, machinePath, runtimeMachines]
  );
  const recentEntry = useMemo(
    () => recents.find((entry) => isSameMachinePath(entry.path, machinePath) || entry.id === machineId),
    [machineId, machinePath, recents]
  );
  const machineTitle = machine?.title ?? recentEntry?.title ?? machineId;
  const runtimeMachineId = runtimeState?.machineId ?? machineId;

  useEffect(() => {
    if (!runtimeState || !machinePath) return;
    if (runtimeState.machineId === machineId) return;
    navigate(`/machines/${encodeURIComponent(runtimeState.machineId)}/console?path=${encodeURIComponent(machinePath)}`, { replace: true });
  }, [machineId, machinePath, navigate, runtimeState]);

  const status = runtimeState?.status;
  const hasError = status === 'stopped' && runtimeState?.lastError != null;
  const qemuAvailable = runtimeEnvironment?.available ?? false;
  const hasLiveConsole = status === 'running' && runtimeState?.displayBackend === 'vnc' && runtimeState?.displayWebSocketPort != null;
  const isWebMode = typeof window !== 'undefined' && window.location.protocol !== 'file:';

  const displayHint = machine
    ? makeDisplayHint(machine)
    : runtimeState
      ? formatRuntimeBackend(runtimeState)
      : '—';

  const audioHint = machine
    ? makeAudioHint(machine.display.frontend, machine.display.sanaka?.backend ?? settings.runtimeDefaults.displayBackendHint, machine.advanced.audio_backend)
    : t('common.disabled');
  const clipboardBridgeStatusLabel = runtimeState?.clipboardBridge
    ? runtimeState.clipboardBridge.enabled
      ? runtimeState.clipboardBridge.connected
        ? t('details.runtimeClipboardConnected')
        : runtimeState.clipboardBridge.status === 'error'
          ? t('details.runtimeClipboardError')
          : runtimeState.clipboardBridge.status === 'waiting'
            ? t('details.runtimeClipboardWaiting')
            : t('details.runtimeClipboardIdle')
      : t('details.runtimeClipboardDisabled')
    : t('details.runtimeClipboardDisabled');

  useEffect(() => {
    if (!isWebMode || !runtimeMachineId || !hasLiveConsole) {
      if (audioSocketRef.current) {
        audioSocketRef.current.close();
        audioSocketRef.current = null;
      }
      if (audioContextRef.current) {
        void audioContextRef.current.close().catch(() => undefined);
        audioContextRef.current = null;
      }
      audioQueueTimeRef.current = 0;
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(
      `${protocol}//${window.location.host}/api/audio-ws?machineId=${encodeURIComponent(runtimeMachineId)}`
    );
    socket.binaryType = 'arraybuffer';
    audioSocketRef.current = socket;

    let disposed = false;
    let sampleRate = 44100;
    let channels = 2;

    const ensureAudioContext = async () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      if (audioContextRef.current.state === 'suspended') {
        try {
          await audioContextRef.current.resume();
        } catch {
          // Safari may still require a gesture. Keep the socket alive.
        }
      }
      return audioContextRef.current;
    };

    socket.onmessage = async (event) => {
      if (disposed) {
        return;
      }
      if (typeof event.data === 'string') {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.type === 'audio-meta') {
            sampleRate = Number(payload.sampleRate) || 44100;
            channels = Number(payload.channels) || 2;
          }
        } catch {
          // ignore malformed meta
        }
        return;
      }

      if (!(event.data instanceof ArrayBuffer)) {
        return;
      }

      const audioContext = await ensureAudioContext();
      if (!audioContext) {
        return;
      }

      const pcm = new Int16Array(event.data);
      if (pcm.length === 0) {
        return;
      }

      const frameCount = Math.floor(pcm.length / channels);
      if (frameCount <= 0) {
        return;
      }

      const audioBuffer = audioContext.createBuffer(channels, frameCount, sampleRate);
      for (let channelIndex = 0; channelIndex < channels; channelIndex += 1) {
        const channelData = audioBuffer.getChannelData(channelIndex);
        for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
          const sample = pcm[frameIndex * channels + channelIndex] || 0;
          channelData[frameIndex] = Math.max(-1, Math.min(1, sample / 32768));
        }
      }

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);

      const now = audioContext.currentTime;
      const startAt = audioQueueTimeRef.current > now ? audioQueueTimeRef.current : now + 0.02;
      source.start(startAt);
      audioQueueTimeRef.current = startAt + audioBuffer.duration;
    };

    return () => {
      disposed = true;
      socket.close();
      if (audioSocketRef.current === socket) {
        audioSocketRef.current = null;
      }
    };
  }, [hasLiveConsole, isWebMode, runtimeMachineId]);

  const handleStart = async () => {
    if (!machinePath) return;
    await startMachine(machinePath);
  };

  const handleStop = () => {
    if (!runtimeMachineId) return;
    setTerminateConfirmOpen(true);
  };

  const handleConfirmTerminate = async () => {
    if (!runtimeMachineId) return;
    setTerminateConfirmOpen(false);
    await forceStopMachine(runtimeMachineId);
  };

  const handleReset = async () => {
    if (!runtimeMachineId) return;
    // Use backend atomic reset API instead of manual stop+start
    await window.electronAPI.runtime.resetMachine({ machineId: runtimeMachineId, mode: 'hard' });
  };

  const handleChangeDisk = async () => {
    if (!machinePath || !runtimeMachineId) return;
    if (isWebMode) {
      setWebMediaPickerOpen(true);
      return;
    }
    const result = await window.electronAPI.dialogs.pickIso();
    if (result?.path) {
      const changeResult = await window.electronAPI.runtime.changeMedia({
        machineId: runtimeMachineId,
        isoPath: result.path,
        drive: 'cdrom'
      });
      if (!changeResult.ok) {
        setStartError({
          title: t('console.changeDisk'),
          description: t('console.runtimeError'),
          detail: changeResult.error || undefined
        });
        return;
      }
      if (machinePath) {
        await openSakaByPath(machinePath);
      }
    }
  };

  const handleWebMediaSelected = async (relativePath: string) => {
    if (!runtimeMachineId) return;
    const changeResult = await window.electronAPI.runtime.changeMedia({
      machineId: runtimeMachineId,
      isoPath: relativePath,
      drive: 'cdrom'
    });
    if (!changeResult.ok) {
      setStartError({
        title: t('console.changeDisk'),
        description: t('console.runtimeError'),
        detail: changeResult.error || undefined
      });
      return;
    }
    setWebMediaPickerOpen(false);
    if (machinePath) await openSakaByPath(machinePath);
  };

  const handleBack = () => {
    navigate('/');
  };

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
        setEnhancementsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  const showToolsMountError = (result: { ok: boolean; error?: string | undefined }) => {
    const errorText = String(result.error || '');
    const missing = errorText.includes('not found') || errorText.includes('Missing');
    setStartError({
      title: missing ? t('console.mountToolsMissingTitle') : t('console.mountToolsErrorTitle'),
      description: missing ? t('console.mountToolsMissingDesc') : t('console.mountToolsErrorDesc'),
      detail: result.error || undefined
    });
  };

  return (
    <div className="page page--console">
      {/* Fixed top toolbar */}
      <div className={`console-topbar ${isMobile ? 'console-topbar--mobile' : ''}`} role="toolbar" aria-label={t('console.title')}>
        <div className="console-topbar__left">
          <button
            className="console-topbar__btn"
            type="button"
            onClick={handleBack}
            title={t('app.back')}
            aria-label={t('app.back')}
          >
            <ArrowLeftIcon />
          </button>
          <span className="console-topbar__title" title={machineTitle}>
            {machineTitle}
          </span>
        </div>

        <div className="console-topbar__center">
          {statusDot(status)}
          <span className="console-topbar__status-label">
            {statusLabel(t, status)}
          </span>
        </div>

        <div className="console-topbar__right">
          {/* 桌面端显示缩放控制 */}
          {!isMobile && (
            <div className="console-scale-group" role="group" aria-label={t('console.zoom')}>
              <span className="console-scale-group__icon" aria-hidden="true">
                <ScaleIcon />
              </span>
              {scaleOptions.map((option) => (
                <button
                  key={option.value}
                  className={option.value === scaleMode ? 'console-scale-chip console-scale-chip--active' : 'console-scale-chip'}
                  type="button"
                  onClick={() => setScaleMode(option.value)}
                  title={option.label}
                  aria-label={option.label}
                  aria-pressed={option.value === scaleMode ? 'true' : 'false'}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
          {/* 桌面端显示信息按钮 */}
          {!isMobile && (
            <button
              className="console-topbar__btn"
              type="button"
              onClick={() => setInfoOpen(true)}
              title={t('console.info')}
              aria-label={t('console.info')}
            >
              <InfoCircleIcon />
            </button>
          )}
          <div className="console-dropdown" ref={menuRef}>
            <button
              className="console-topbar__btn"
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              title={t('console.more')}
              aria-label={t('console.more')}
              aria-haspopup="true"
              aria-expanded={menuOpen ? 'true' : 'false'}
            >
              <MoreIcon />
            </button>
            {menuOpen && (
              <div className="console-dropdown__menu" role="menu">
                {/* 移动端在更多菜单中显示缩放控制 */}
                {isMobile && (
                  <div className="console-dropdown__section">
                    <span className="console-dropdown__label">{t('console.zoom')}</span>
                    {scaleOptions.map((option) => (
                      <button
                        key={option.value}
                        className={`console-dropdown__item ${option.value === scaleMode ? 'console-dropdown__item--active' : ''}`}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setScaleMode(option.value);
                          setMenuOpen(false);
                        }}
                      >
                        <span className="console-dropdown__check">{option.value === scaleMode ? '●' : '○'}</span>
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
                {isMobile && (
                  <div className="console-dropdown__section">
                    <span className="console-dropdown__label">{t('console.inputMode')}</span>
                    <button
                      className={`console-dropdown__item ${inputMode === 'touch' ? 'console-dropdown__item--active' : ''}`}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setInputMode('touch');
                        setMenuOpen(false);
                      }}
                    >
                      <span className="console-dropdown__check">{inputMode === 'touch' ? '●' : '○'}</span>
                      <span className="console-dropdown__item-icon"><PenDrawIcon /></span>
                      {t('console.touchMode')}
                    </button>
                    <button
                      className={`console-dropdown__item ${inputMode === 'mouse' ? 'console-dropdown__item--active' : ''}`}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setInputMode('mouse');
                        setMenuOpen(false);
                      }}
                    >
                      <span className="console-dropdown__check">{inputMode === 'mouse' ? '●' : '○'}</span>
                      <span className="console-dropdown__item-icon"><MouseIcon /></span>
                      {t('console.mouseMode')}
                    </button>
                  </div>
                )}
                <button
                  className="console-dropdown__item"
                  type="button"
                  role="menuitem"
                  onClick={async () => {
                    setMenuOpen(false);
                    if (!runtimeMachineId) return;
                    const result = await window.electronAPI.runtime.mountBundledTestNetIso!(runtimeMachineId);
                    if (!result.ok) {
                      setStartError({
                        title: t('console.testNetErrorTitle'),
                        description: t('console.testNetErrorDesc'),
                        detail: result.error || undefined
                      });
                    }
                  }}
                >
                  {t('console.testNetWindows')}
                </button>
                <div className="console-dropdown__submenu">
                  <button
                    className="console-dropdown__item console-dropdown__item--submenu"
                    type="button"
                    role="menuitem"
                    aria-haspopup="true"
                    aria-expanded={enhancementsOpen ? 'true' : 'false'}
                    onClick={() => setEnhancementsOpen((value) => !value)}
                  >
                    <span>{t('console.enhancements')}</span>
                    <span className="console-dropdown__arrow">›</span>
                  </button>
                  {enhancementsOpen && (
                    <div className="console-dropdown__submenu-panel" role="menu">
                      <button
                        className="console-dropdown__item"
                        type="button"
                        role="menuitem"
                        onClick={async () => {
                          setMenuOpen(false);
                          setEnhancementsOpen(false);
                          if (!runtimeMachineId) return;
                          const result = await window.electronAPI.runtime.mountSanakaToolsIso!(runtimeMachineId);
                          if (!result.ok) {
                            showToolsMountError(result);
                          }
                        }}
                      >
                        {t('console.enhancementsWindows')}
                      </button>
                      <button
                        className="console-dropdown__item"
                        type="button"
                        role="menuitem"
                        onClick={async () => {
                          setMenuOpen(false);
                          setEnhancementsOpen(false);
                          if (!runtimeMachineId) return;
                          const result = await window.electronAPI.runtime.mountSanakaToolsLinuxIso!(runtimeMachineId);
                          if (!result.ok) {
                            showToolsMountError(result);
                          }
                        }}
                      >
                        {t('console.enhancementsLinux')}
                      </button>
                    </div>
                  )}
                </div>
                {/* 移动端在更多菜单中显示其他操作 */}
                {isMobile && (
                  <>
                    <div className="console-dropdown__divider" />
                    <button
                      className="console-dropdown__item"
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        handleChangeDisk();
                      }}
                    >
                      {t('console.changeDisk')}
                    </button>
                    <button
                      className="console-dropdown__item"
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        handleReset();
                      }}
                      disabled={status !== 'running'}
                    >
                      {t('console.reset')}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          {/* 桌面端显示换盘、重启按钮 */}
          {!isMobile && (
            <>
              <button
                className="console-topbar__btn"
                type="button"
                onClick={handleChangeDisk}
                title={t('console.changeDisk')}
                aria-label={t('console.changeDisk')}
              >
                <OpticalDiscIcon />
              </button>
              <button
                className="console-topbar__btn"
                type="button"
                onClick={handleReset}
                disabled={status !== 'running'}
                title={t('console.reset')}
                aria-label={t('console.reset')}
              >
                <ResetIcon />
              </button>
            </>
          )}
          <button
            className="console-topbar__btn console-topbar__btn--danger"
            type="button"
            onClick={handleStop}
            disabled={status !== 'running'}
            title={t('console.close')}
            aria-label={t('console.close')}
          >
            <PowerIcon />
          </button>
        </div>
      </div>

      {/* Fullscreen viewport */}
      <div className={`console-viewport ${isMobile ? 'console-viewport--mobile' : ''}`}>
        {hasLiveConsole ? (
          <NoVncViewport
            ref={viewportRef}
            active
            machineRunning={status === 'running'}
            websocketPort={runtimeState.displayWebSocketPort}
            password={machine?.display.vnc?.password ?? ''}
            reconnectWindowMs={15000}
            scaleMode={scaleMode}
            inputMode={inputMode}
          />
        ) : status === 'starting' ? (
          <div className="console-state">
            <div className="console-state__spinner" />
            <p className="console-state__text">{t('console.waitingConnection')}</p>
            <p className="console-state__hint">{displayHint}</p>
          </div>
        ) : hasError ? (
          <div className="console-state">
            <div className="console-state__error-icon">
              <AlertIcon />
            </div>
            <p className="console-state__text console-state__text--error">
              {t('console.startFailed')}
            </p>
            <p className="console-state__hint">{runtimeState?.lastError}</p>
            <button className="button button--ghost" type="button" onClick={handleStart} style={{ marginTop: '16px' }}>
              {t('console.reconnect')}
            </button>
          </div>
        ) : !qemuAvailable ? (
          <div className="console-state">
            <div className="console-state__error-icon">
              <AlertIcon />
            </div>
            <p className="console-state__text">{t('common.qemuMissing')}</p>
            {runtimeEnvironment?.installHint && (
              <p className="console-state__hint">{runtimeEnvironment.installHint}</p>
            )}
          </div>
        ) : (
          <div className="console-state">
            <p className="console-state__label">{t('console.states.disconnected')}</p>
            <p className="console-state__hint">{displayHint}</p>
            <button
              className="console-start-btn"
              type="button"
              disabled={!qemuAvailable || !machinePath}
              onClick={handleStart}
              title={!qemuAvailable ? t('details.qemuMissingHint') : t('console.startHint')}
            >
              <PlayIcon />
              <span>{t('console.reconnect')}</span>
            </button>
          </div>
        )}
      </div>

      {/* 移动端底部操作栏 */}
      {isMobile && isPortrait && (
        <div className="console-mobile-toolbar">
          <button
            className="console-mobile-toolbar__btn"
            type="button"
            onClick={handleChangeDisk}
            title={t('console.changeDisk')}
          >
            <OpticalDiscIcon />
            <span className="console-mobile-toolbar__label">{t('console.changeDisk')}</span>
          </button>
          <button
            className="console-mobile-toolbar__btn"
            type="button"
            onClick={handleReset}
            disabled={status !== 'running'}
            title={t('console.reset')}
          >
            <ResetIcon />
            <span className="console-mobile-toolbar__label">{t('console.reset')}</span>
          </button>
          <button
            className={`console-mobile-toolbar__btn ${keyboardOpen ? 'console-mobile-toolbar__btn--active' : ''}`}
            type="button"
            onClick={() => {
              setKeyboardOpen(true);
              hiddenInputRef.current?.focus();
            }}
            title={t('console.keyboard')}
          >
            <KeyboardIcon />
            <span className="console-mobile-toolbar__label">{t('console.keyboard')}</span>
          </button>
          <button
            className="console-mobile-toolbar__btn"
            type="button"
            onClick={() => setInfoOpen(true)}
            title={t('console.info')}
          >
            <InfoCircleIcon />
            <span className="console-mobile-toolbar__label">{t('console.info')}</span>
          </button>
          <button
            className="console-mobile-toolbar__btn"
            type="button"
            onClick={() => setMenuOpen(true)}
            title={t('console.more')}
          >
            <MoreIcon />
            <span className="console-mobile-toolbar__label">{t('console.more')}</span>
          </button>
        </div>
      )}

      {/* Hidden input for mobile keyboard */}
      {isMobile && isPortrait && (
        <input
          ref={hiddenInputRef}
          type="text"
          className="console-hidden-input"
          aria-hidden="true"
          onBlur={() => setKeyboardOpen(false)}
          onInput={(e) => {
            const value = (e.target as HTMLInputElement).value;
            if (value && viewportRef.current) {
              viewportRef.current.sendText(value);
              (e.target as HTMLInputElement).value = '';
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && viewportRef.current) {
              viewportRef.current.sendText('\n');
              e.preventDefault();
            }
          }}
        />
      )}

      {/* Info drawer */}
      {infoDrawer.mounted && (
        <div className={infoDrawer.visible ? 'console-drawer-backdrop console-drawer-backdrop--visible' : 'console-drawer-backdrop'} role="presentation" onClick={() => setInfoOpen(false)}>
          <aside
            className={infoDrawer.visible ? 'console-drawer console-drawer--visible' : 'console-drawer'}
            role="dialog"
            aria-modal="true"
            aria-label={t('console.infoTitle')}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="console-drawer__header">
              <h2 className="console-drawer__title">{t('console.infoTitle')}</h2>
              <button
                className="console-drawer__close"
                type="button"
                onClick={() => setInfoOpen(false)}
                aria-label={t('app.close')}
              >
                <CloseIcon />
              </button>
            </div>

            <div className="console-drawer__body spec-list">
              <div className="spec-row">
                <span className="spec-row__label">
                  <span className="spec-row__icon"><DisplayProtocolIcon /></span>
                  {t('console.protocol')}
                </span>
                <span className="spec-row__value">{displayHint}</span>
              </div>
              <div className="spec-row">
                <span className="spec-row__label">
                  <span className="spec-row__icon"><AudioIcon /></span>
                  {t('console.audio')}
                </span>
                <span className="spec-row__value">{audioHint}</span>
              </div>
              <div className="spec-row">
                <span className="spec-row__label">
                  <span className="spec-row__icon"><ConnectionIcon /></span>
                  {t('console.connected')}
                </span>
                <span className="spec-row__value">
                  {status === 'running'
                    ? t('console.connectedRuntime')
                    : status === 'starting'
                      ? t('console.waitingConnection')
                      : t('console.states.disconnected')}
                </span>
              </div>
              {runtimeState && (
                <>
                  <div className="spec-row">
                    <span className="spec-row__label">
                      <span className="spec-row__icon"><DisplayBackendIcon /></span>
                      {t('details.runtimeDisplayBackend')}
                    </span>
                    <span className="spec-row__value">{formatRuntimeBackend(runtimeState)}</span>
                  </div>
                  <div className="spec-row">
                    <span className="spec-row__label">
                      <span className="spec-row__icon"><PortIcon /></span>
                      {t('details.runtimeDisplayPort')}
                    </span>
                    <span className="spec-row__value">{String(runtimeState.displayPort)}</span>
                  </div>
                  {runtimeState.displayWebSocketPort != null && (
                    <div className="spec-row">
                      <span className="spec-row__label">
                        <span className="spec-row__icon"><WebSocketIcon /></span>
                        {t('details.runtimeWebsocketPort')}
                      </span>
                      <span className="spec-row__value">{String(runtimeState.displayWebSocketPort)}</span>
                    </div>
                  )}
                  {runtimeState.machineMac && (
                    <div className="spec-row">
                      <span className="spec-row__label">
                        <span className="spec-row__icon"><MacAddressIcon /></span>
                        {t('details.runtimeMachineMac')}
                      </span>
                      <span className="spec-row__value">{runtimeState.machineMac}</span>
                    </div>
                  )}
                  {runtimeState.clipboardBridge?.bootstrapPort != null && (
                    <div className="spec-row">
                      <span className="spec-row__label">
                        <span className="spec-row__icon"><BootstrapIcon /></span>
                        {t('details.runtimeBootstrapPort')}
                      </span>
                      <span className="spec-row__value">{String(runtimeState.clipboardBridge.bootstrapPort)}</span>
                    </div>
                  )}
                  <div className="spec-row">
                    <span className="spec-row__label">
                      <span className="spec-row__icon"><ClipboardIcon /></span>
                      {t('details.runtimeClipboardBridge')}
                    </span>
                    <span className="spec-row__value">{clipboardBridgeStatusLabel}</span>
                  </div>
                  {runtimeState.clipboardBridge?.listenPort != null && (
                    <div className="spec-row">
                      <span className="spec-row__label">
                        <span className="spec-row__icon"><PortIcon /></span>
                        {t('details.runtimeClipboardPort')}
                      </span>
                      <span className="spec-row__value">{String(runtimeState.clipboardBridge.listenPort)}</span>
                    </div>
                  )}
                  {runtimeState.clipboardBridge?.sessionId && (
                    <div className="spec-row">
                      <span className="spec-row__label">
                        <span className="spec-row__icon"><ClipboardIcon /></span>
                        {t('details.runtimeClipboardSession')}
                      </span>
                      <span className="spec-row__value">{runtimeState.clipboardBridge.sessionId}</span>
                    </div>
                  )}
                  {runtimeState.clipboardBridge?.lastError && (
                    <div className="spec-row" style={{ color: 'var(--danger)' }}>
                      <span className="spec-row__label">
                        <span className="spec-row__icon"><AlertIcon /></span>
                        {t('details.runtimeClipboardBridge')}
                      </span>
                      <span className="spec-row__value">{runtimeState.clipboardBridge.lastError}</span>
                    </div>
                  )}
                  {runtimeState.lastError && (
                    <div className="spec-row" style={{ color: 'var(--danger)' }}>
                      <span className="spec-row__label">
                        <span className="spec-row__icon"><AlertIcon /></span>
                        {t('details.runtimeLastError')}
                      </span>
                      <span className="spec-row__value">{runtimeState.lastError}</span>
                    </div>
                  )}
                </>
              )}
              <div className="spec-row">
                <span className="spec-row__label">
                  <span className="spec-row__icon"><QemuStatusIcon /></span>
                  {t('details.runtimeQemuStatus')}
                </span>
                <span className="spec-row__value">
                  {qemuAvailable ? t('details.runtimeQemuAvailable') : t('details.runtimeQemuUnavailable')}
                </span>
              </div>
            </div>
          </aside>
        </div>
      )}

      {terminateModal.mounted && (
        <div className={terminateModal.visible ? 'modal-backdrop modal-backdrop--visible' : 'modal-backdrop'} role="presentation" onClick={() => setTerminateConfirmOpen(false)}>
          <div
            className={terminateModal.visible ? 'modal-card modal-card--visible' : 'modal-card'}
            role="dialog"
            aria-modal="true"
            aria-labelledby="terminate-confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="terminate-confirm-title" style={{ color: 'var(--danger)', margin: '0 0 10px 0', fontSize: '1.25rem' }}>
              {t('console.terminateTitle')}
            </h2>
            <p className="muted" style={{ margin: '0 0 24px 0', fontSize: '0.88rem', lineHeight: '1.5' }}>
              {t('console.terminateConfirm')}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="button button--secondary" type="button" onClick={() => setTerminateConfirmOpen(false)}>
                {t('app.cancel')}
              </button>
              <button className="button button--danger" type="button" onClick={handleConfirmTerminate}>
                {t('app.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
      {isWebMode && machinePath && (
        <WebFilePickerDialog
          open={webMediaPickerOpen}
          machineRef={machinePath}
          directory="Media"
          accept=".iso,.img"
          onSelect={(relativePath) => void handleWebMediaSelected(relativePath)}
          onClose={() => setWebMediaPickerOpen(false)}
        />
      )}
    </div>
  );
}
