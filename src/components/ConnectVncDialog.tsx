import { useEffect, useState } from 'react';
import { usePresence } from '../hooks/usePresence';
import { useT } from '../hooks/useT';
import type { ExternalVncSession } from '../types/electron';

interface ConnectVncDialogProps {
  open: boolean;
  onClose: () => void;
  onConnected: (session: ExternalVncSession, password: string) => void;
}

const NetworkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '24px', height: '24px', color: 'var(--primary-strong)' }}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

export function ConnectVncDialog({ open, onClose, onConnected }: ConnectVncDialogProps) {
  const t = useT();
  const presence = usePresence(open);
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setAddress('');
      setPassword('');
      setSubmitting(false);
      setErrorKey(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const trimmedAddress = address.trim();
    if (!trimmedAddress) {
      setErrorKey('viewer.errorEmptyAddress');
      return;
    }

    const trimmedPassword = password.trim();
    setSubmitting(true);
    setErrorKey(null);

    try {
      const session = await window.electronAPI.viewer!.createExternalVncSession!({
        address: trimmedAddress,
        password: trimmedPassword || undefined
      });
      onConnected(session, trimmedPassword);
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
      setSubmitting(false);
    }
  };

  if (!presence.mounted) {
    return null;
  }

  return (
    <div
      className={presence.visible ? 'modal-backdrop modal-backdrop--visible' : 'modal-backdrop'}
      role="presentation"
      onClick={onClose}
    >
      <div
        className={presence.visible ? 'modal-card modal-card--visible connect-vnc-dialog' : 'modal-card connect-vnc-dialog'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-vnc-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="connect-vnc-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 10px 0', fontSize: '1.2rem' }}>
          <NetworkIcon />
          {t('viewer.title')}
        </h2>
        <p className="muted" style={{ margin: '0 0 18px 0', fontSize: '0.86rem', lineHeight: '1.5' }}>
          {t('viewer.subtitle')}
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <label className="field" htmlFor="connect-vnc-address" style={{ width: '100%' }}>
            <span className="field__label">{t('viewer.addressLabel')}</span>
            <input
              id="connect-vnc-address"
              type="text"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                if (errorKey) setErrorKey(null);
              }}
              placeholder={t('viewer.addressPlaceholder')}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              disabled={submitting}
            />
          </label>
          <p className="muted" style={{ margin: '-8px 0 0 0', fontSize: '0.76rem', lineHeight: '1.5' }}>
            {t('viewer.addressHint')}
          </p>
          <label className="field" htmlFor="connect-vnc-password" style={{ width: '100%' }}>
            <span className="field__label">{t('viewer.passwordLabel')}</span>
            <input
              id="connect-vnc-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('viewer.passwordPlaceholder')}
              autoComplete="off"
              spellCheck={false}
              disabled={submitting}
            />
          </label>
          {errorKey && (
            <p className="connect-vnc-dialog__error" role="alert">
              {t(errorKey)}
            </p>
          )}
          <p className="muted" style={{ margin: '0', fontSize: '0.76rem', lineHeight: '1.5' }}>
            {t('viewer.externalSessionNote')}
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
            <button className="button button--secondary" type="button" onClick={onClose} disabled={submitting}>
              {t('app.cancel')}
            </button>
            <button className="button button--primary" type="submit" disabled={submitting}>
              {submitting ? t('viewer.connecting') : t('viewer.connect')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
