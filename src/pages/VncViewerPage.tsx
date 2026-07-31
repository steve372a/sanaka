import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { NoVncViewport, type DisplayConnectionState, type NoVncCredentials, type NoVncScaleMode } from '../components/NoVncViewport';
import { VncPasswordDialog } from '../components/VncPasswordDialog';
import { useT } from '../hooks/useT';
import type { ExternalVncSession } from '../types/electron';

const ArrowLeftIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const DisconnectIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const ScaleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

function statusDotClass(state: DisplayConnectionState): string {
  if (state === 'connected') return 'console-topbar__dot console-topbar__dot--running';
  if (state === 'connecting' || state === 'reconnecting' || state === 'waiting-display') return 'console-topbar__dot console-topbar__dot--intermediate';
  return 'console-topbar__dot';
}

function resolveWebsocketUrl(session: ExternalVncSession | null): string | null {
  if (!session) return null;
  if (window.location.protocol === 'file:') {
    return session.localWebsocketUrl || session.websocketUrl || null;
  }
  if (session.websocketPath) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}${session.websocketPath}`;
  }
  return session.websocketUrl || session.networkWebsocketUrl || session.localWebsocketUrl || null;
}

export function VncViewerPage() {
  const t = useT();
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();

  const [session, setSession] = useState<ExternalVncSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [connectionState, setConnectionState] = useState<DisplayConnectionState>('waiting-display');
  const [scaleMode, setScaleMode] = useState<NoVncScaleMode>('fit');
  const [disconnecting, setDisconnecting] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordStorageAvailable, setPasswordStorageAvailable] = useState(false);
  const [passwordAuthFailed, setPasswordAuthFailed] = useState(false);
  const [retryPassword, setRetryPassword] = useState('');
  const [credentialAttempt, setCredentialAttempt] = useState(0);
  const closedRef = useRef(false);
  const recordedConnectionRef = useRef(false);
  const rememberedCredentialTriedRef = useRef(false);
  const credentialResolverRef = useRef<((credentials: NoVncCredentials | null) => void) | null>(null);

  const websocketUrl = useMemo(() => resolveWebsocketUrl(session), [session]);

  useEffect(() => {
    let cancelled = false;
    if (!sessionId) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotFound(false);
    recordedConnectionRef.current = false;
    rememberedCredentialTriedRef.current = false;
    setRetryPassword('');
    setCredentialAttempt(0);
    void window.electronAPI.viewer!.getExternalVncSession!(sessionId)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setNotFound(true);
        } else {
          setSession(result);
        }
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    return () => {
      credentialResolverRef.current?.(null);
      credentialResolverRef.current = null;
      if (closedRef.current || !sessionId) return;
      closedRef.current = true;
      void window.electronAPI.viewer?.closeExternalVncSession?.(sessionId).catch(() => undefined);
    };
  }, [sessionId]);

  const handleDisconnect = useCallback(async () => {
    if (disconnecting) return;
    setDisconnecting(true);
    try {
      if (sessionId && !closedRef.current) {
        closedRef.current = true;
        await window.electronAPI.viewer?.closeExternalVncSession?.(sessionId).catch(() => undefined);
      }
    } finally {
      setDisconnecting(false);
      navigate('/');
    }
  }, [disconnecting, navigate, sessionId]);

  const handleBack = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const handleCredentialsRequired = useCallback(async (): Promise<NoVncCredentials | null> => {
    if (!sessionId) return null;
    if (!rememberedCredentialTriedRef.current) {
      rememberedCredentialTriedRef.current = true;
      const result = await window.electronAPI.viewer?.getExternalVncCredential?.(sessionId).catch(() => null);
      setPasswordStorageAvailable(result?.passwordStorageAvailable === true);
      if (result?.ok && result.password) {
        return { password: result.password };
      }
    }
    setPasswordAuthFailed(false);
    setPasswordDialogOpen(true);
    return new Promise<NoVncCredentials | null>((resolve) => {
      credentialResolverRef.current = resolve;
    });
  }, [sessionId]);

  const handlePasswordSubmit = useCallback(async (password: string, rememberPassword: boolean) => {
    if (!sessionId) return;
    const result = await window.electronAPI.viewer?.setExternalVncCredential?.({
      sessionId,
      password,
      rememberPassword
    });
    if (!result?.ok) return;
    const resolver = credentialResolverRef.current;
    credentialResolverRef.current = null;
    setPasswordDialogOpen(false);
    setPasswordAuthFailed(false);
    if (resolver) {
      resolver({ password });
    } else {
      setRetryPassword(password);
      setCredentialAttempt((attempt) => attempt + 1);
    }
  }, [sessionId]);

  const handlePasswordCancel = useCallback(() => {
    credentialResolverRef.current?.(null);
    credentialResolverRef.current = null;
    setPasswordDialogOpen(false);
    void handleDisconnect();
  }, [handleDisconnect]);

  const handleSecurityFailure = useCallback(() => {
    if (!sessionId) return;
    credentialResolverRef.current?.(null);
    credentialResolverRef.current = null;
    rememberedCredentialTriedRef.current = true;
    setPasswordAuthFailed(true);
    setPasswordDialogOpen(true);
    const clearCredential = window.electronAPI.viewer?.clearExternalVncCredential;
    if (!clearCredential) return;
    void clearCredential({
      sessionId,
      forgetRemembered: true
    }).catch(() => undefined);
  }, [sessionId]);

  const handleConnectionStateChange = useCallback((state: DisplayConnectionState) => {
    setConnectionState(state);
    if (state === 'connected' && sessionId && !recordedConnectionRef.current) {
      recordedConnectionRef.current = true;
      const recordConnection = window.electronAPI.viewer?.recordExternalVncConnection;
      if (recordConnection) {
        void recordConnection(sessionId).catch(() => undefined);
      }
    }
  }, [sessionId]);

  const addressLabel = session?.displayAddress || session?.host || (session ? `${session.host}:${session.port}` : '');

  const scaleOptions: Array<{ value: NoVncScaleMode; label: string }> = [
    { value: 'fit', label: t('console.scaleFit') },
    { value: 'native', label: t('console.scaleNative') },
    { value: 'stretch', label: t('console.scaleStretch') }
  ];

  const stateLabel = (() => {
    switch (connectionState) {
      case 'connected':
        return t('viewer.connected');
      case 'connecting':
        return t('viewer.connectingState');
      case 'reconnecting':
        return t('viewer.reconnecting');
      case 'unavailable':
        return t('viewer.unavailable');
      case 'waiting-display':
      case 'waiting-runtime':
        return t('viewer.waitingConnection');
      default:
        return t('viewer.disconnected');
    }
  })();

  if (loading) {
    return (
      <div className="page page--console page--vnc-viewer">
        <div className="console-viewport">
          <div className="novnc-viewport__overlay" data-state="waiting-display">
            <span className="novnc-viewport__status">{t('viewer.waitingConnection')}</span>
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !sessionId) {
    return (
      <div className="page page--console page--vnc-viewer">
        <div className="console-topbar" role="toolbar" aria-label={t('viewer.title')}>
          <div className="console-topbar__left">
            <button className="console-topbar__btn" type="button" onClick={handleBack} title={t('viewer.back')} aria-label={t('viewer.back')}>
              <ArrowLeftIcon />
            </button>
            <span className="console-topbar__title">{t('viewer.title')}</span>
          </div>
        </div>
        <div className="console-viewport">
          <div className="novnc-viewport__overlay" data-state="unavailable">
            <span className="novnc-viewport__status">{t('viewer.sessionNotFound')}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page page--console page--vnc-viewer">
      <div className="console-topbar" role="toolbar" aria-label={t('viewer.title')}>
        <div className="console-topbar__left">
          <button className="console-topbar__btn" type="button" onClick={handleBack} title={t('viewer.back')} aria-label={t('viewer.back')}>
            <ArrowLeftIcon />
          </button>
          <span className="console-topbar__title" title={t('viewer.title')}>
            {t('viewer.title')}
          </span>
        </div>

        <div className="console-topbar__center">
          <span className={statusDotClass(connectionState)} />
          <span className="console-topbar__status-label">
            {addressLabel ? `${addressLabel} · ${stateLabel}` : stateLabel}
          </span>
        </div>

        <div className="console-topbar__right">
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
          <button
            className="console-topbar__btn console-topbar__btn--danger"
            type="button"
            onClick={() => void handleDisconnect()}
            disabled={disconnecting}
            title={t('viewer.disconnect')}
            aria-label={t('viewer.disconnect')}
          >
            <DisconnectIcon />
          </button>
        </div>
      </div>

      <div className="console-viewport">
        <NoVncViewport
          active
          machineRunning
          websocketUrl={websocketUrl}
          password={retryPassword}
          scaleMode={scaleMode}
          inputMode="touch"
          initialDelayMs={0}
          connectionKey={credentialAttempt}
          onConnectionStateChange={handleConnectionStateChange}
          onCredentialsRequired={handleCredentialsRequired}
          onSecurityFailure={handleSecurityFailure}
        />
      </div>
      <VncPasswordDialog
        open={passwordDialogOpen}
        address={addressLabel}
        passwordStorageAvailable={passwordStorageAvailable}
        authFailed={passwordAuthFailed}
        onCancel={handlePasswordCancel}
        onSubmit={handlePasswordSubmit}
      />
    </div>
  );
}
