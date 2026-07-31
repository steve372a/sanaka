import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AccentColor } from './AccentColorPicker';
import { useT } from '../hooks/useT';
import { usePresence } from '../hooks/usePresence';

interface AccentColorCustomDialogProps {
  open: boolean;
  value: AccentColor;
  onChange: (next: AccentColor) => void;
  onClose: () => void;
}

const DEFAULT_CUSTOM = {
  lightPrimary: '#BCA0C9',
  lightSurface: '#F7EFFF',
  darkPrimary: '#D3ABF7',
  darkSurface: '#2E1F3F'
};

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function ColorField({ label, value, onChange }: ColorFieldProps) {
  return (
    <label className="accent-color-dialog__field">
      <span className="accent-color-dialog__field-copy">
        <strong>{label}</strong>
        <small>{value.toUpperCase()}</small>
      </span>
      <span className="accent-color-dialog__color-control" style={{ backgroundColor: value }}>
        <input aria-label={label} type="color" value={value} onChange={(event) => onChange(event.target.value)} />
      </span>
    </label>
  );
}

export function AccentColorCustomDialog({ open, value, onChange, onClose }: AccentColorCustomDialogProps) {
  const t = useT();
  const { mounted, visible } = usePresence(open);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [saving, setSaving] = useState(false);
  const [templateName, setTemplateName] = useState('');

  const custom = value.mode === 'custom' ? value.custom : DEFAULT_CUSTOM;
  const templates = value.templates ?? [];

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (visible) closeButtonRef.current?.focus();
  }, [visible]);

  if (!mounted) return null;

  const updateCustom = (patch: Partial<typeof custom>) => {
    onChange({
      ...value,
      mode: 'custom',
      custom: { ...custom, ...patch }
    });
  };

  const applyTemplate = (template: (typeof templates)[number]) => {
    onChange({
      ...value,
      mode: 'custom',
      custom: template.custom
    });
  };

  const handleSave = () => {
    if (!templateName.trim()) return;
    const next: AccentColor = {
      ...value,
      mode: 'custom',
      custom,
      templates: [
        ...templates,
        {
          id: `template-${Date.now()}`,
          name: templateName.trim(),
          custom: { ...custom }
        }
      ]
    };
    onChange(next);
    setTemplateName('');
    setSaving(false);
  };

  const dialog = (
    <div
      className={visible ? 'about-dialog-backdrop about-dialog-backdrop--visible accent-color-dialog-backdrop' : 'about-dialog-backdrop accent-color-dialog-backdrop'}
      role="presentation"
      onClick={onClose}
    >
      <div
        className={visible ? 'about-dialog accent-color-dialog about-dialog--visible' : 'about-dialog accent-color-dialog'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="accent-color-title"
        aria-describedby="accent-color-description"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="accent-color-dialog__header">
          <div>
            <h2 id="accent-color-title">{t('settings.accentColorDialogTitle')}</h2>
            <p id="accent-color-description">{t('settings.accentColorDialogDescription')}</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="about-dialog__close accent-color-dialog__close"
            onClick={onClose}
            aria-label={t('app.close')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div className="accent-color-dialog__body">
          <div className="accent-color-dialog__preview" aria-hidden="true">
            <div className="accent-color-dialog__preview-card accent-color-dialog__preview-card--light" style={{ backgroundColor: custom.lightSurface }}>
              <span>{t('settings.light')}</span>
              <i style={{ backgroundColor: custom.lightPrimary }} />
            </div>
            <div className="accent-color-dialog__preview-card accent-color-dialog__preview-card--dark" style={{ backgroundColor: custom.darkSurface }}>
              <span>{t('settings.dark')}</span>
              <i style={{ backgroundColor: custom.darkPrimary }} />
            </div>
          </div>

          <div className="accent-color-dialog__mode-grid">
            <section className="accent-color-dialog__mode-group">
              <h3>{t('settings.lightModeColors')}</h3>
              <ColorField label={t('settings.primaryColor')} value={custom.lightPrimary} onChange={(next) => updateCustom({ lightPrimary: next })} />
              <ColorField label={t('settings.surfaceColor')} value={custom.lightSurface} onChange={(next) => updateCustom({ lightSurface: next })} />
            </section>
            <section className="accent-color-dialog__mode-group">
              <h3>{t('settings.darkModeColors')}</h3>
              <ColorField label={t('settings.primaryColor')} value={custom.darkPrimary} onChange={(next) => updateCustom({ darkPrimary: next })} />
              <ColorField label={t('settings.surfaceColor')} value={custom.darkSurface} onChange={(next) => updateCustom({ darkSurface: next })} />
            </section>
          </div>

          <section className="accent-color-dialog__templates">
            <div className="accent-color-dialog__templates-header">
              <div>
                <h3>{t('settings.savedColorTemplates')}</h3>
                <p>{t('settings.savedColorTemplatesDescription')}</p>
              </div>
              {!saving ? (
                <button type="button" className="button button--small" onClick={() => setSaving(true)}>
                  {t('settings.saveColorTemplate')}
                </button>
              ) : null}
            </div>

            {saving ? (
              <div className="accent-color-dialog__save-row">
                <input
                  type="text"
                  className="input"
                  placeholder={t('settings.colorTemplateNamePlaceholder')}
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleSave();
                  }}
                  autoFocus
                />
                <button type="button" className="button button--primary" onClick={handleSave} disabled={!templateName.trim()}>
                  {t('settings.createColorTemplate')}
                </button>
                <button type="button" className="button button--ghost" onClick={() => setSaving(false)}>
                  {t('app.cancel')}
                </button>
              </div>
            ) : null}

            {templates.length > 0 ? (
              <ul className="accent-color-dialog__template-list">
                {templates.map((template) => (
                  <li key={template.id}>
                    <button type="button" className="accent-color-dialog__template" onClick={() => applyTemplate(template)}>
                      <span className="accent-color-dialog__template-swatches" aria-hidden="true">
                        <i style={{ backgroundColor: template.custom.lightPrimary }} />
                        <i style={{ backgroundColor: template.custom.lightSurface }} />
                        <i style={{ backgroundColor: template.custom.darkPrimary }} />
                        <i style={{ backgroundColor: template.custom.darkSurface }} />
                      </span>
                      <strong>{template.name}</strong>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="accent-color-dialog__empty">{t('settings.noSavedColorTemplates')}</p>
            )}
          </section>
        </div>

        <footer className="accent-color-dialog__actions">
          <span>{t('settings.accentColorAppliesImmediately')}</span>
          <button type="button" className="button button--primary" onClick={onClose}>
            {t('app.confirm')}
          </button>
        </footer>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
