import { type ReactNode, useEffect, useId, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { AppSettings, TemplateCatalogEntry } from '../domain/schemas';
import { SectionCard } from '../components/Field';
import { MaterialSelect, MaterialSelectField } from '../components/MaterialSelect';
import { Checkbox } from '../components/Checkbox';
import { AccentColorPicker } from '../components/AccentColorPicker';
import { AccentColorCustomDialog } from '../components/AccentColorCustomDialog';
import { QemuExternalDirDialog } from '../components/QemuExternalDirDialog';
import { useAppStore } from '../store/AppStore';
import { useT } from '../hooks/useT';
import { isWebMode as isSanakaWebMode, showWebModificationNotice } from '../lib/webMode';

// Settings Icons
const GlobeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);

const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);

const FolderIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
);

const CpuIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <rect x="4" y="4" width="16" height="16" rx="2"/>
    <rect x="9" y="9" width="6" height="6"/>
    <line x1="9" y1="1" x2="9" y2="4"/>
    <line x1="15" y1="1" x2="15" y2="4"/>
    <line x1="9" y1="20" x2="9" y2="23"/>
    <line x1="15" y1="20" x2="15" y2="23"/>
    <line x1="20" y1="9" x2="23" y2="9"/>
    <line x1="20" y1="14" x2="23" y2="14"/>
    <line x1="1" y1="9" x2="4" y2="9"/>
    <line x1="1" y1="14" x2="4" y2="14"/>
  </svg>
);

const MonitorIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <rect x="2" y="3" width="20" height="14" rx="2"/>
    <line x1="8" y1="21" x2="16" y2="21"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
  </svg>
);

const LayoutGridIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <rect x="3" y="3" width="7" height="7"/>
    <rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/>
    <rect x="3" y="14" width="7" height="7"/>
  </svg>
);

const FlaskIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <path d="M10 2v7.31"/>
    <path d="M14 2v7.31"/>
    <path d="M8.5 2h7"/>
    <path d="M14 9.3a6.5 6.5 0 1 1-4 0"/>
    <path d="M12 9.3v-2"/>
  </svg>
);

const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

// Template OS icons (clean, proportion-correct SVG paths)
const WindowsLogoIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
    <path d="M2 2h9v9H2zM13 2h9v9h-9zM2 13h9v9H2zM13 13h9v9h-9z" />
  </svg>
);

const LinuxIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
    <path d="M12 2c-1.5 0-2.8.8-3.4 2.1-.4.8-.4 1.7-.1 2.5-.6.3-1.2.7-1.7 1.2-1.4 1.4-2.1 3.3-2.1 5.3 0 2.1.8 4 2.2 5.4.6.6 1.4 1 2.2 1.2-.1.3-.2.6-.2 1 0 1 .8 1.8 1.8 1.8s1.8-.8 1.8-1.8c0-.3-.1-.6-.2-.8.9-.2 1.6-.6 2.2-1.2 1.4-1.4 2.2-3.3 2.2-5.4 0-1.2-.3-2.3-.8-3.3-.5-1-1.2-1.8-2.1-2.4.3-.6.5-1.3.5-2C16.3 3.8 14.5 2 12 2zm0 1.8c1 0 1.8.8 1.8 1.8s-.8 1.8-1.8 1.8-1.8-.8-1.8-1.8.8-1.8 1.8-1.8zM9.5 9.5c.5 0 .9.4.9.9s-.4.9-.9.9-.9-.4-.9-.9.4-.9.9-.9zm5 0c.5 0 .9.4.9.9s-.4.9-.9.9-.9-.4-.9-.9.4-.9.9-.9zm-2.5 3c1.4 0 2.5 1.1 2.5 2.5h-5c0-1.4 1.1-2.5 2.5-2.5z" />
  </svg>
);

const ComputerIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

function getTemplateIcon(key: string) {
  const lowercaseKey = key.toLowerCase();
  if (lowercaseKey.includes('win')) {
    return <WindowsLogoIcon />;
  }
  if (lowercaseKey.includes('linux') || lowercaseKey.includes('ubuntu') || lowercaseKey.includes('debian')) {
    return <LinuxIcon />;
  }
  return <ComputerIcon />;
}

interface TemplateItemProps {
  entry: TemplateCatalogEntry;
  isFirst: boolean;
  isLast: boolean;
  t: ReturnType<typeof useT>;
  onToggle: (key: string, enabled: boolean) => void;
  onReorder: (key: string, offset: number) => void;
}

function TemplateItem({ entry, isFirst, isLast, t, onToggle, onReorder }: TemplateItemProps) {
  return (
    <div className={entry.enabled ? 'template-item template-item--active' : 'template-item'}>
      <span className="template-item__accent" aria-hidden="true" />
      <div className="template-item__icon">{getTemplateIcon(entry.key)}</div>
      <div className="template-item__body">
        <div className="template-item__meta">
          <strong>{entry.label}</strong>
          <span className="template-item__source">
            {entry.source === 'builtin' ? t('settings.templateBuiltIn') : t('settings.templateImported')}
          </span>
        </div>
        <div className="template-item__actions">
          <div className="template-item__reorder">
            <button
              className="button button--ghost button--icon button--compact"
              type="button"
              disabled={isFirst}
              onClick={() => void onReorder(entry.key, -1)}
              title={t('common.moveUp')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                <path d="M18 15l-6-6-6 6" />
              </svg>
            </button>
            <button
              className="button button--ghost button--icon button--compact"
              type="button"
              disabled={isLast}
              onClick={() => void onReorder(entry.key, 1)}
              title={t('common.moveDown')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          </div>
          <label className="ios-toggle ios-toggle--small" aria-label={t('common.enabled')}>
            <input
              checked={entry.enabled}
              type="checkbox"
              onChange={(event) => void onToggle(entry.key, event.target.checked)}
            />
            <span className="ios-toggle__track">
              <span className="ios-toggle__thumb" />
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}

const tabs = ['general', 'files', 'runtime', 'displayAudio', 'templates', 'experimental', 'update'] as const;
const languageOptions = [
  { value: 'zh-CN', label: 'zh-CN' },
  { value: 'en-US', label: 'en-US' }
] as ReadonlyArray<{ value: AppSettings['language']; label: string }>;
const displayFrontendOptions = [
  { value: 'sanaka', label: 'Sanaka' }
] as const;
const displayBackendOptions = [
  { value: 'vnc', label: 'VNC' }
] as ReadonlyArray<{ value: AppSettings['runtimeDefaults']['displayBackendHint']; label: string }>;

function SettingsDrawerSection({
  active,
  children,
  description,
  onOpen,
  title
}: {
  active: boolean;
  children: ReactNode;
  description?: string;
  onOpen: () => void;
  title: string;
}) {
  const id = useId();

  return (
    <section className={active ? 'settings-drawer settings-drawer--active' : 'settings-drawer'}>
      <button className="settings-drawer__trigger" type="button" aria-expanded={active} aria-controls={id} onClick={onOpen}>
        <span>
          <strong>{title}</strong>
          {description ? <small>{description}</small> : null}
        </span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m7 10 5 5 5-5" />
        </svg>
      </button>
      <div id={id} className="settings-drawer__content">
        <div className="settings-drawer__body">{children}</div>
      </div>
    </section>
  );
}

export function SettingsPage() {
  const { appMeta, settings, persistSettings, setTheme, setReduceMotion, importTemplateFromDialog, templates, updateTemplateCatalog, updateCurrentInfo, checkForUpdates, runtimeEnvironment } = useAppStore();
  const t = useT();
  const isWebMode = typeof window !== 'undefined' && window.location.protocol !== 'file:';
  const [params, setParams] = useSearchParams();
  const initialTab = params.get('tab');
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>(tabs.includes(initialTab as (typeof tabs)[number]) ? (initialTab as (typeof tabs)[number]) : 'general');
  const [checking, setChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);
  const [templateImportMessage, setTemplateImportMessage] = useState<string | null>(null);
  const [accentColorDialogOpen, setAccentColorDialogOpen] = useState(false);
  const [qemuExternalDirDialogOpen, setQemuExternalDirDialogOpen] = useState(false);

  useEffect(() => {
    const nextTab = params.get('tab');
    const resolvedTab = tabs.includes(nextTab as (typeof tabs)[number]) ? (nextTab as (typeof tabs)[number]) : 'general';
    if (resolvedTab !== activeTab) {
      setActiveTab(resolvedTab);
    }
  }, [activeTab, params]);

  const orderedTemplates = useMemo(() => [...templates].sort((a, b) => a.order - b.order), [templates]);
  const defaultMachineDirectory = settings.defaultSaveDirectory || appMeta?.defaultMachineDirectory || '';

  const patchSettings = async (patch: Partial<AppSettings>) => {
    await persistSettings({ ...settings, ...patch });
  };

  const reorder = async (key: string, offset: number) => {
    await updateTemplateCatalog((catalog) => {
      const index = catalog.findIndex((entry) => entry.key === key);
      const target = index + offset;
      if (index < 0 || target < 0 || target >= catalog.length) return catalog;
      const next = [...catalog];
      const [entry] = next.splice(index, 1);
      next.splice(target, 0, entry);
      return next;
    });
  };

  const handleCheckUpdates = async () => {
    setChecking(true);
    setCheckMessage(null);
    try {
      const result = await checkForUpdates({ silent: false });
      if (result.error) {
        setCheckMessage(t('settings.checkFailed'));
      } else if (!result.hasUpdate) {
        setCheckMessage(t('settings.alreadyLatest'));
      }
    } catch {
      setCheckMessage(t('settings.checkFailed'));
    } finally {
      setChecking(false);
      setTimeout(() => setCheckMessage(null), 3000);
    }
  };

  const handleImportTemplate = async () => {
    const result = await importTemplateFromDialog();
    setTemplateImportMessage(result.message ?? null);
    if (result.message) {
      setTimeout(() => setTemplateImportMessage(null), 4000);
    }
  };

  const handleToggleTemplate = (key: string, enabled: boolean) => {
    void updateTemplateCatalog((catalog) =>
      catalog.map((item) => (item.key === key ? { ...item, enabled } : item))
    );
  };

  const handleOpenQemuExternalDir = () => {
    if (isSanakaWebMode()) {
      showWebModificationNotice();
      return;
    }
    setQemuExternalDirDialogOpen(true);
  };

  const handleApplyQemuExternalDir = async (externalDir: string) => {
    await patchSettings({ qemu: { ...settings.qemu, externalDir } });
    setQemuExternalDirDialogOpen(false);
    await window.electronAPI.runtime.detectQemu();
  };

  const handleClearQemuExternalDir = async () => {
    if (isSanakaWebMode()) {
      showWebModificationNotice();
      return;
    }
    await handleApplyQemuExternalDir('');
  };

  const qemuVersion = Object.values(runtimeEnvironment?.binaries || {}).find((binary) => binary.found && binary.version)?.version || t('settings.qemuVersionUnknown');
  const qemuSource = runtimeEnvironment?.source === 'external-configured'
    ? t('settings.qemuSourceExternal')
    : runtimeEnvironment?.source === 'bundled'
      ? t('settings.qemuSourceBundled')
      : t('settings.qemuSourceAuto');

  return (
    <div className="page page--settings">
      <div className="workspace-header">
        <div>
          <span className="eyebrow">{t('app.settings')}</span>
          <h1>{t('settings.title')}</h1>
          <p>{t('settings.subtitle')}</p>
        </div>
      </div>

      <div className="settings-drawer-list">
        {tabs.map((tab) => {
          const active = activeTab === tab;
          const openSection = () => {
            setActiveTab(tab);
            setParams({ tab });
          };

          return (
            <SettingsDrawerSection key={tab} active={active} title={t(`settings.tabs.${tab}`)} description={t(`settings.${tab === 'displayAudio' ? 'displayAudio' : tab}Description`)} onOpen={openSection}>
              {tab === 'general' ? (
                <SectionCard title={t('settings.tabs.general')} description={t('settings.generalDescription')} icon={<GlobeIcon />}>
              <MaterialSelectField label={t('settings.language')} value={settings.language} options={languageOptions} onChange={(nextValue) => void patchSettings({ language: nextValue })} />
              <div className="field">
                <span className="field__label">{t('settings.theme')}</span>
                <div className="theme-toggle">
                  <button
                    className={settings.theme === 'light' ? 'theme-toggle__btn theme-toggle__btn--active' : 'theme-toggle__btn'}
                    type="button"
                    onClick={() => void setTheme('light')}
                  >
                    <SunIcon />
                    <span>{t('settings.light')}</span>
                  </button>
                  <button
                    className={settings.theme === 'dark' ? 'theme-toggle__btn theme-toggle__btn--active' : 'theme-toggle__btn'}
                    type="button"
                    onClick={() => void setTheme('dark')}
                  >
                    <MoonIcon />
                    <span>{t('settings.dark')}</span>
                  </button>
                </div>
              </div>
              <div className="field">
                <span className="field__label">{t('settings.accentColor')}</span>
                <AccentColorPicker
                  value={settings.accentColor}
                  onChange={(next) => void patchSettings({ accentColor: next })}
                  onOpenCustom={() => setAccentColorDialogOpen(true)}
                />
              </div>
              <div className="field">
                <span className="field__label">{t('settings.motion')}</span>
                <label className={settings.reduceMotion ? 'settings-motion-option settings-motion-option--enabled' : 'settings-motion-option'}>
                  <span className="settings-motion-option__copy">
                    <strong>{t('settings.reduceMotion')}</strong>
                    <small>{t('settings.reduceMotionDescription')}</small>
                  </span>
                  <input
                    aria-label={t('settings.reduceMotion')}
                    checked={settings.reduceMotion}
                    className="settings-motion-option__input"
                    type="checkbox"
                    onChange={(event) => void setReduceMotion(event.target.checked)}
                  />
                  <span className="ios-toggle__track" aria-hidden="true"><span className="ios-toggle__thumb" /></span>
                </label>
              </div>
              <AccentColorCustomDialog
                open={accentColorDialogOpen}
                value={settings.accentColor}
                onChange={(next) => void patchSettings({ accentColor: next })}
                onClose={() => setAccentColorDialogOpen(false)}
              />
                </SectionCard>
              ) : null}

              {tab === 'files' ? (
                <SectionCard title={t('settings.tabs.files')} description={t('settings.filesDescription')} icon={<FolderIcon />}>
              <label className="field">
                <span className="field__label">{t('settings.savePath')}</span>
                <input value={defaultMachineDirectory} onChange={(event) => void patchSettings({ defaultSaveDirectory: event.target.value })} placeholder={appMeta?.defaultMachineDirectory ?? ''} />
              </label>
                </SectionCard>
              ) : null}

              {tab === 'runtime' ? (
                <SectionCard title={t('settings.tabs.runtime')} description={t('settings.runtimeDescription')} icon={<CpuIcon />}>
              <div className="field-grid field-grid--two">
                <div className="field">
                  <span className="field__label">{t('settings.frontend')}</span>
                  <div className="info-panel">
                    <strong>Sanaka</strong>
                    <p>{t('settings.displaySanaka')}</p>
                  </div>
                </div>
                <div className="field">
                  <span className="field__label">{t('settings.backend')}</span>
                  <div className="info-panel">
                    <strong>VNC</strong>
                    <p>{t('settings.displayVnc')}</p>
                  </div>
                </div>
              </div>
              <div className="field">
                <span className="field__label">{t('settings.qemuExternalDirTitle')}</span>
                <div className="info-panel">
                  <strong>{qemuSource}</strong>
                  <p>{runtimeEnvironment?.effectiveRoot || settings.qemu.externalDir || t('settings.qemuPathUnavailable')}</p>
                  <small className="field__hint">{qemuVersion}</small>
                  {runtimeEnvironment?.errorMessage ? <p className="status-text status-text--danger">{runtimeEnvironment.errorMessage}</p> : null}
                  <div className="action-row">
                    <button className="button button--secondary" type="button" onClick={handleOpenQemuExternalDir}>
                      {t('settings.qemuExternalDirConfigure')}
                    </button>
                    {settings.qemu.externalDir ? (
                      <button className="button button--ghost" type="button" onClick={() => void handleClearQemuExternalDir()}>
                        {t('settings.qemuExternalDirUseAuto')}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
              <label className="field">
                <span className="field__label">{t('settings.webModePort')}</span>
                <input
                  type="number"
                  min={1}
                  max={65535}
                  value={settings.webMode.port}
                  disabled={isWebMode}
                  onChange={(event) => {
                    const next = Number.parseInt(event.target.value, 10);
                    if (!Number.isInteger(next)) {
                      return;
                    }
                    void patchSettings({
                      webMode: {
                        ...settings.webMode,
                        port: Math.max(1, Math.min(65535, next))
                      }
                    });
                  }}
                />
                <small className="field__hint">
                  {isWebMode ? t('settings.webModePortWebLocked') : t('settings.webModePortHint')}
                </small>
              </label>
                </SectionCard>
              ) : null}

              {tab === 'displayAudio' ? (
                <SectionCard title={t('settings.tabs.displayAudio')} description={t('settings.displayAudioDescription')} icon={<MonitorIcon />}>
                  <div className="display-grid">
                    <div className="display-card display-card--active">
                      <strong>Sanaka</strong>
                      <span>{t('settings.displaySanaka')}</span>
                      <span className="display-card__checkbox">✓</span>
                    </div>
                    <div className="display-card display-card--active">
                      <strong>VNC</strong>
                      <span>{t('settings.displayVnc')}</span>
                      <span className="display-card__checkbox">✓</span>
                    </div>
                  </div>
                </SectionCard>
              ) : null}

              {tab === 'templates' ? (
                <SectionCard title={t('settings.tabs.templates')} description={t('settings.templatesDescription')} icon={<LayoutGridIcon />}>
              <div className="template-toolbar">
                <div className="template-toolbar__info">
                  <strong>{t('settings.tabs.templates')}</strong>
                  <span>{t('settings.templateCount', { count: orderedTemplates.length })}</span>
                </div>
                <button className="button button--primary" type="button" onClick={() => void handleImportTemplate()}>
                  {t('settings.importTemplate')}
                </button>
              </div>
              {templateImportMessage ? (
                <div className="info-panel template-import-message">
                  <p>{templateImportMessage}</p>
                </div>
              ) : null}
              <div className="template-list">
                {orderedTemplates.map((entry, index) => (
                  <TemplateItem
                    key={entry.key}
                    entry={entry}
                    isFirst={index === 0}
                    isLast={index === orderedTemplates.length - 1}
                    t={t}
                    onToggle={handleToggleTemplate}
                    onReorder={reorder}
                  />
                ))}
              </div>
                </SectionCard>
              ) : null}

              {tab === 'experimental' ? (
                <SectionCard title={t('settings.tabs.experimental')} description={t('settings.experimentalDescription')} icon={<FlaskIcon />}>
              <Checkbox
                checked={settings.experimental.brandedHero}
                onChange={(checked) => void patchSettings({ experimental: { ...settings.experimental, brandedHero: checked } })}
                label={t('settings.experimentalHero')}
              />
              <Checkbox
                checked={settings.experimental.advancedConsole}
                onChange={(checked) => void patchSettings({ experimental: { ...settings.experimental, advancedConsole: checked } })}
                label={t('settings.experimentalConsole')}
              />
              <Checkbox
                checked={settings.experimental.protocolInspector}
                onChange={(checked) => void patchSettings({ experimental: { ...settings.experimental, protocolInspector: checked } })}
                label={t('settings.experimentalInspector')}
              />
              <Checkbox
                checked={settings.experimental.rawQemuValues}
                onChange={(checked) => void patchSettings({ experimental: { ...settings.experimental, rawQemuValues: checked } })}
                label={t('settings.experimentalRawQemuValues')}
              />
                </SectionCard>
              ) : null}

              {tab === 'update' ? (
                <SectionCard title={t('settings.tabs.update')} description={t('settings.updateDescription')} icon={<DownloadIcon />}>
                  <div className="field">
                    <span className="field__label">{t('settings.currentVersion')}</span>
                    <div className="info-panel">
                      <strong>{updateCurrentInfo?.currentVersion || '0.0.1'}</strong>
                    </div>
                  </div>
                  <div className="field">
                    <span className="field__label">{t('settings.currentChannel')}</span>
                    <div className="info-panel">
                      <strong>{updateCurrentInfo?.currentChannel || 'Beta'}</strong>
                    </div>
                  </div>
                  <div className="field">
                    <span className="field__label">{t('settings.skippedVersion')}</span>
                    <div className="info-panel">
                      <strong>{updateCurrentInfo?.skippedVersion || t('settings.noSkippedVersion')}</strong>
                    </div>
                  </div>
                  <div className="action-row">
                    <button
                      className="button button--primary"
                      type="button"
                      onClick={() => void handleCheckUpdates()}
                      disabled={checking}
                    >
                      {checking ? t('settings.checkingUpdates') : t('settings.checkUpdates')}
                    </button>
                  </div>
                  {checkMessage ? (
                    <div className="info-panel" style={{ marginTop: '8px' }}>
                      <p style={{ margin: 0 }}>{checkMessage}</p>
                    </div>
                  ) : null}
                </SectionCard>
              ) : null}
            </SettingsDrawerSection>
          );
        })}
      </div>
      <QemuExternalDirDialog
        open={qemuExternalDirDialogOpen}
        initialPath={settings.qemu.externalDir}
        onApply={(externalDir) => void handleApplyQemuExternalDir(externalDir)}
        onClose={() => setQemuExternalDirDialogOpen(false)}
      />
    </div>
  );
}
