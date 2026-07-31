import { useEffect, useState } from 'react';
import { usePresence } from '../hooks/usePresence';
import { useT } from '../hooks/useT';
import type { CreateExternalVncSessionRequest, ExternalVncHistoryEntry, ExternalVncSession } from '../types/electron';

interface ConnectVncDialogProps {
  open: boolean;
  onClose: () => void;
  onConnected: (session: ExternalVncSession) => void;
}

const NetworkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="13" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="10" width="14" height="10" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 10v6M14 10v6" />
  </svg>
);

function formatLastConnected(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export function ConnectVncDialog({ open, onClose, onConnected }: ConnectVncDialogProps) {
  const t = useT();
  const presence = usePresence(open);
  const [address, setAddress] = useState('');
  const [history, setHistory] = useState<ExternalVncHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!open) {
      setAddress('');
      setHistory([]);
      setLoadingHistory(false);
      setSubmittingId(null);
      setErrorKey(null);
      return () => undefined;
    }
    setLoadingHistory(true);
    const listHistory = window.electronAPI?.viewer?.listExternalVncHistory;
    if (!listHistory) {
      setHistory([]);
      setLoadingHistory(false);
      return () => {
        cancelled = true;
      };
    }
    void listHistory()
      .then((entries) => {
        if (!cancelled) setHistory(Array.isArray(entries) ? entries : []);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const connect = async (request: CreateExternalVncSessionRequest, pendingId: string) => {
    if (submittingId) return;
    setSubmittingId(pendingId);
    setErrorKey(null);
    try {
      const session = await window.electronAPI.viewer!.createExternalVncSession!(request);
      onConnected(session);
    } catch (error) {
      const message = error instanceof Error ? error.message.trim() : String(error || '').trim();
      const lowered = message.toLowerCase();
      if (lowered.includes('host') && lowered.includes('missing')) {
        setErrorKey('viewer.errorEmptyAddress');
      } else if (lowered.includes('port')) {
        setErrorKey('viewer.errorInvalidPort');
      } else {
        setErrorKey('viewer.errorConnectFailed');
      }
    } finally {
      setSubmittingId(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedAddress = address.trim();
    if (!trimmedAddress) {
      setErrorKey('viewer.errorEmptyAddress');
      return;
    }
    await connect({ address: trimmedAddress }, 'manual');
  };

  const handleRemoveHistory = async (historyId: string) => {
    const result = await window.electronAPI.viewer?.removeExternalVncHistory?.(historyId).catch(() => null);
    if (result?.ok) {
      setHistory((current) => current.filter((entry) => entry.id !== historyId));
    }
  };

  if (!presence.mounted) return null;

  const busy = submittingId !== null;

  return (
    <div className={presence.visible ? 'modal-backdrop modal-backdrop--visible' : 'modal-backdrop'} role="presentation" onClick={onClose}>
      <div
        className={presence.visible ? 'modal-card modal-card--visible connect-vnc-dialog' : 'modal-card connect-vnc-dialog'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-vnc-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="connect-vnc-dialog__header">
          <span className="connect-vnc-dialog__title-icon"><NetworkIcon /></span>
          <span>
            <h2 id="connect-vnc-title">{t('viewer.title')}</h2>
            <p>{t('viewer.subtitle')}</p>
          </span>
        </header>

        <form className="connect-vnc-dialog__form" onSubmit={handleSubmit}>
          <label className="field" htmlFor="connect-vnc-address">
            <span className="field__label">{t('viewer.addressLabel')}</span>
            <span className="connect-vnc-dialog__address-row">
              <input
                id="connect-vnc-address"
                type="text"
                value={address}
                onChange={(event) => {
                  setAddress(event.target.value);
                  if (errorKey) setErrorKey(null);
                }}
                placeholder={t('viewer.addressPlaceholder')}
                autoFocus
                autoComplete="off"
                spellCheck={false}
                disabled={busy}
              />
              <button className="button button--primary" type="submit" disabled={busy}>
                {submittingId === 'manual' ? t('viewer.connecting') : t('viewer.connect')}
              </button>
            </span>
          </label>
          <p className="connect-vnc-dialog__hint">{t('viewer.addressHint')}</p>
        </form>

        {errorKey && <p className="connect-vnc-dialog__error" role="alert">{t(errorKey)}</p>}

        <section className="connect-vnc-dialog__history" aria-labelledby="connect-vnc-history-title">
          <div className="connect-vnc-dialog__section-title">
            <span id="connect-vnc-history-title">{t('viewer.recentConnections')}</span>
            {history.length > 0 && <small>{history.length}</small>}
          </div>
          {loadingHistory ? (
            <div className="connect-vnc-dialog__empty">{t('viewer.loadingHistory')}</div>
          ) : history.length === 0 ? (
            <div className="connect-vnc-dialog__empty">
              <ClockIcon />
              <span>{t('viewer.noRecentConnections')}</span>
            </div>
          ) : (
            <div className="connect-vnc-dialog__history-list">
              {history.map((entry) => (
                <div className="connect-vnc-history-item" key={entry.id}>
                  <button
                    className="connect-vnc-history-item__main"
                    type="button"
                    onClick={() => void connect({ historyId: entry.id }, entry.id)}
                    disabled={busy}
                  >
                    <span className="connect-vnc-history-item__icon"><NetworkIcon /></span>
                    <span className="connect-vnc-history-item__copy">
                      <strong>{entry.displayAddress}</strong>
                      <small>{formatLastConnected(entry.lastConnectedAt)}</small>
                    </span>
                    {entry.hasRememberedPassword && (
                      <span className="connect-vnc-history-item__saved" title={t('viewer.savedPassword')}>
                        <LockIcon />
                        {t('viewer.savedPassword')}
                      </span>
                    )}
                    {submittingId === entry.id && <span className="connect-vnc-history-item__status">{t('viewer.connecting')}</span>}
                  </button>
                  <button
                    className="connect-vnc-history-item__remove"
                    type="button"
                    title={t('viewer.removeHistory')}
                    aria-label={t('viewer.removeHistory')}
                    onClick={() => void handleRemoveHistory(entry.id)}
                    disabled={busy}
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <footer className="connect-vnc-dialog__footer">
          <p>{t('viewer.externalSessionNote')}</p>
          <button className="button button--secondary" type="button" onClick={onClose} disabled={busy}>
            {t('app.cancel')}
          </button>
        </footer>
      </div>
    </div>
  );
}
