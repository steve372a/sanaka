import { useState } from 'react';
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
  lightPrimary: '#C678FF',
  lightSurface: '#F7EFFF',
  darkPrimary: '#D4A3FF',
  darkSurface: '#2E1F3F'
};

export function AccentColorCustomDialog({ open, value, onChange, onClose }: AccentColorCustomDialogProps) {
  const t = useT();
  const { mounted, visible } = usePresence(open);
  const [saving, setSaving] = useState(false);
  const [templateName, setTemplateName] = useState('');

  const custom = value.mode === 'custom' ? value.custom : DEFAULT_CUSTOM;
  const templates = value.templates ?? [];

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

  return (
    <div
      className={visible ? 'about-dialog-backdrop about-dialog-backdrop--visible' : 'about-dialog-backdrop'}
      role="presentation"
      onClick={onClose}
    >
      <div
        className={visible ? 'about-dialog accent-color-dialog about-dialog--visible' : 'about-dialog accent-color-dialog'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="accent-color-title"
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
          <h2 id="accent-color-title" className="about-dialog__title">{t('settings.accentColorCustom')}</h2>

          <div className="accent-color-dialog__fields">
            <label className="accent-color-dialog__field">
              <span className="accent-color-dialog__label">浅色区主色</span>
              <input
                type="color"
                value={custom.lightPrimary}
                onChange={(e) => updateCustom({ lightPrimary: e.target.value })}
              />
            </label>
            <label className="accent-color-dialog__field">
              <span className="accent-color-dialog__label">浅色区表面</span>
              <input
                type="color"
                value={custom.lightSurface}
                onChange={(e) => updateCustom({ lightSurface: e.target.value })}
              />
            </label>
            <label className="accent-color-dialog__field">
              <span className="accent-color-dialog__label">深色区主色</span>
              <input
                type="color"
                value={custom.darkPrimary}
                onChange={(e) => updateCustom({ darkPrimary: e.target.value })}
              />
            </label>
            <label className="accent-color-dialog__field">
              <span className="accent-color-dialog__label">深色区表面</span>
              <input
                type="color"
                value={custom.darkSurface}
                onChange={(e) => updateCustom({ darkSurface: e.target.value })}
              />
            </label>
          </div>

          <div className="accent-color-dialog__templates">
            <div className="accent-color-dialog__templates-header">
              <span className="accent-color-dialog__templates-title">{t('settings.savedColorTemplates')}</span>
              <button
                type="button"
                className="button button--small"
                onClick={() => setSaving(true)}
              >
                {t('settings.saveColorTemplate')}
              </button>
            </div>

            {saving && (
              <div className="accent-color-dialog__save-row">
                <input
                  type="text"
                  className="input"
                  placeholder={t('settings.colorTemplateNamePlaceholder')}
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave();
                  }}
                  autoFocus
                />
                <button type="button" className="button button--primary" onClick={handleSave}>
                  {t('settings.createColorTemplate')}
                </button>
                <button type="button" className="button button--ghost" onClick={() => setSaving(false)}>
                  {t('app.cancel')}
                </button>
              </div>
            )}

            {templates.length > 0 ? (
              <ul className="accent-color-dialog__template-list">
                {templates.map((template) => (
                  <li key={template.id} className="accent-color-dialog__template-item">
                    <button
                      type="button"
                      className="accent-color-dialog__template-name"
                      onClick={() => applyTemplate(template)}
                    >
                      {template.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="accent-color-dialog__empty">暂无保存的模板</p>
            )}
          </div>

          <div className="accent-color-dialog__actions">
            <button type="button" className="button button--primary" onClick={onClose}>
              {t('app.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
