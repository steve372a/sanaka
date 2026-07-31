import { useEffect, useState } from 'react';
import { usePresence } from '../hooks/usePresence';
import { useT } from '../hooks/useT';

interface VncPasswordDialogProps {
  open: boolean;
  address: string;
  passwordStorageAvailable: boolean;
  authFailed?: boolean;
  onCancel: () => void;
  onSubmit: (password: string, rememberPassword: boolean) => Promise<void> | void;
}

const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="10" width="14" height="10" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);

export function VncPasswordDialog({
  open,
  address,
  passwordStorageAvailable,
  authFailed = false,
  onCancel,
  onSubmit
}: VncPasswordDialogProps) {
  const t = useT();
  const presence = usePresence(open);
  const [password, setPassword] = useState('');
  const [rememberPassword, setRememberPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setPassword('');
      setRememberPassword(false);
      setSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(password, passwordStorageAvailable && rememberPassword);
    } finally {
      setSubmitting(false);
    }
  };

  if (!presence.mounted) return null;

  return (
    <div className={presence.visible ? 'modal-backdrop modal-backdrop--visible vnc-password-backdrop' : 'modal-backdrop vnc-password-backdrop'} role="presentation">
      <div
        className={presence.visible ? 'modal-card modal-card--visible vnc-password-dialog' : 'modal-card vnc-password-dialog'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vnc-password-title"
      >
        <header className="vnc-password-dialog__header">
          <span className="vnc-password-dialog__icon"><LockIcon /></span>
          <span>
            <h2 id="vnc-password-title">{t('viewer.passwordRequiredTitle')}</h2>
            <p>{address}</p>
          </span>
        </header>

        <form className="vnc-password-dialog__form" onSubmit={handleSubmit}>
          {authFailed && <p className="vnc-password-dialog__error" role="alert">{t('viewer.errorAuthFailed')}</p>}
          <label className="field" htmlFor="vnc-required-password">
            <span className="field__label">{t('viewer.passwordLabel')}</span>
            <input
              id="vnc-required-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoFocus
              autoComplete="current-password"
              disabled={submitting}
            />
          </label>
          <label className={passwordStorageAvailable ? 'vnc-password-dialog__remember' : 'vnc-password-dialog__remember vnc-password-dialog__remember--disabled'}>
            <input
              type="checkbox"
              checked={rememberPassword}
              onChange={(event) => setRememberPassword(event.target.checked)}
              disabled={!passwordStorageAvailable || submitting}
            />
            <span>{t('viewer.rememberPassword')}</span>
          </label>
          {!passwordStorageAvailable && <p className="vnc-password-dialog__storage-note">{t('viewer.passwordStorageUnavailable')}</p>}
          <div className="vnc-password-dialog__actions">
            <button className="button button--secondary" type="button" onClick={onCancel} disabled={submitting}>
              {t('app.cancel')}
            </button>
            <button className="button button--primary" type="submit" disabled={!password || submitting}>
              {submitting ? t('viewer.connecting') : t('viewer.connect')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
