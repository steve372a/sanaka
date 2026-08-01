import { useEffect, useRef, useState } from 'react';
import { useT } from '../hooks/useT';

interface WelcomeDialogProps {
  open: boolean;
  onClose: () => void;
  onDismissUntilNextVersion: () => void;
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 6 18 18M18 6 6 18" />
    </svg>
  );
}

export function WelcomeDialog({ open, onClose, onDismissUntilNextVersion }: WelcomeDialogProps) {
  const t = useT();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();

    let cancelled = false;
    setVideoUrl(null);
    const getVideo = window.electronAPI.app.getWelcomeVideo;
    if (typeof getVideo === 'function') {
      void getVideo().then((result) => {
        if (!cancelled && result.available && result.url) setVideoUrl(result.url);
      }).catch(() => {
        if (!cancelled) setVideoUrl(null);
      });
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelled = true;
      document.removeEventListener('keydown', onKeyDown);
      restoreFocusRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="welcome-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="welcome-dialog" role="alertdialog" aria-modal="true" aria-labelledby="welcome-dialog-title">
        <header className="welcome-dialog__header">
          <h2 id="welcome-dialog-title">{t('app.welcome.title')}</h2>
          <p className="welcome-dialog__subtitle">{t('app.welcome.subtitle')}</p>
          <button ref={closeRef} className="icon-button welcome-dialog__close" type="button" aria-label={`${t('app.welcome.close')} ${t('app.welcome.title')}`} onClick={onClose}>
            <CloseIcon />
          </button>
        </header>
        <div className="welcome-dialog__video-shell">
          {videoUrl ? (
            <video
              className="welcome-dialog__video"
              src={videoUrl}
              autoPlay
              muted
              playsInline
              controls={false}
              onEnded={(event) => {
                const video = event.currentTarget;
                video.currentTime = 0;
                void video.play().catch(() => null);
              }}
              onError={() => setVideoUrl(null)}
            />
          ) : <div className="welcome-dialog__video-fallback" aria-hidden="true" />}
        </div>
        <footer className="welcome-dialog__actions">
          <button className="button button--secondary" type="button" onClick={onDismissUntilNextVersion}>{t('app.welcome.dismissUntilNextVersion')}</button>
          <button className="button button--primary" type="button" aria-label={`${t('app.welcome.close')} ${t('app.welcome.title')}`} onClick={onClose}>{t('app.welcome.close')}</button>
        </footer>
      </section>
    </div>
  );
}
