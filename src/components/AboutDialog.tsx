import { useT } from '../hooks/useT';
import { usePresence } from '../hooks/usePresence';
import { useAppStore } from '../store/AppStore';
import logoUrl from '../../assets/icons/fish.png';

interface AboutDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AboutDialog({ open, onClose }: AboutDialogProps) {
  const t = useT();
  const { mounted, visible } = usePresence(open);
  const { appMeta } = useAppStore();

  if (!mounted) return null;

  return (
    <div
      className={visible ? 'about-dialog-backdrop about-dialog-backdrop--visible' : 'about-dialog-backdrop'}
      role="presentation"
      onClick={onClose}
    >
      <div
        className={visible ? 'about-dialog about-dialog--visible' : 'about-dialog'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="about-dialog__close"
          onClick={onClose}
          aria-label={t('app.close')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="about-dialog__content">
          <img className="about-dialog__logo" src={logoUrl} alt="" />
          <h2 id="about-title" className="about-dialog__title">{t('app.about')}</h2>
          <p className="about-dialog__description">{t('app.aboutDescription')}</p>
          <p className="about-dialog__footer">{t('app.aboutFooter')}</p>
          <p className="about-dialog__version">{appMeta?.version ?? '0.0.4-beta'}</p>
          <a
            href="https://github.com/steve372a/sanaka"
            className="about-dialog__link"
            onClick={(event) => {
              event.preventDefault();
              void window.electronAPI.app.openExternal('https://github.com/steve372a/sanaka');
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z" />
            </svg>
            <span>GitHub</span>
          </a>
        </div>
      </div>
    </div>
  );
}
