import { useState, useEffect, useCallback } from 'react';
import { useT } from '../hooks/useT';
import { usePresence } from '../hooks/usePresence';
import type { SharedFolderConfig, SharedFolderEnvironment, RuntimeSharedFolderState } from '../types/electron';
import { getWebResourceDisplayName, isWebMode, showWebModificationNotice } from '../lib/webMode';

interface SharedFolderPanelProps {
  open: boolean;
  onClose: () => void;
  machinePath: string;
  machineSharing?: SharedFolderConfig;
  runtimeSharedFolder?: RuntimeSharedFolderState;
  sharedFolderEnv?: SharedFolderEnvironment;
  isRunning: boolean;
  onSaved?: () => void | Promise<void>;
}

const FolderIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);

const AlertIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter" width="12" height="12">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export function SharedFolderPanel({
  open,
  onClose,
  machinePath,
  machineSharing,
  runtimeSharedFolder,
  sharedFolderEnv,
  isRunning,
  onSaved
}: SharedFolderPanelProps) {
  const t = useT();
  const webRestricted = isWebMode();
  const { mounted, visible } = usePresence(open, 240);

  const [enabled, setEnabled] = useState(machineSharing?.enabled ?? false);
  const [hostPath, setHostPath] = useState(machineSharing?.hostPath ?? '');
  const [mode, setMode] = useState<SharedFolderConfig['mode']>(machineSharing?.mode ?? 'readwrite');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setEnabled(machineSharing?.enabled ?? false);
      setHostPath(machineSharing?.hostPath ?? '');
      setMode(machineSharing?.mode ?? 'readwrite');
      setError(null);
    }
  }, [open, machineSharing]);

  const envAvailable = sharedFolderEnv?.available ?? false;
  const envWarning = sharedFolderEnv?.reason ?? null;
  const installHint = sharedFolderEnv?.installHint ?? null;

  const isActive = runtimeSharedFolder?.active ?? false;
  const pendingRestart = runtimeSharedFolder?.pendingRestart ?? false;
  const runtimeWarning = runtimeSharedFolder?.warning ?? null;
  const runtimeInstallHint = runtimeSharedFolder?.installHint ?? null;

  const guestAddress = runtimeSharedFolder?.guestAddress ?? '10.0.2.4';
  const guestShareName = runtimeSharedFolder?.guestPath ?? 'qemu';
  const guestUrl = runtimeSharedFolder?.guestUrl ?? `smb://${guestAddress}/${guestShareName}`;
  const windowsPath = `\\\\${guestAddress}\\${guestShareName}`;

  const handleSelectFolder = async () => {
    if (webRestricted) {
      showWebModificationNotice();
      return;
    }
    try {
      const result = await window.electronAPI.dialogs.selectFolder();
      if (result?.path) {
        setHostPath(result.path);
      }
    } catch {
      // ignore
    }
  };

  const handleSave = useCallback(async () => {
    if (webRestricted) {
      showWebModificationNotice();
      return;
    }
    setError(null);
    setSaving(true);

    try {
      const config: SharedFolderConfig = {
        enabled,
        hostPath: hostPath.trim(),
        mode,
        shareName: 'qemu'
      };

      const result = await window.electronAPI.machine.updateSharedFolder!(machinePath, config);

      if (!result.ok) {
        setError(result.error ?? t('sharedFolder.saveFailed'));
        return;
      }

      await Promise.resolve(onSaved?.());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('sharedFolder.saveFailed'));
    } finally {
      setSaving(false);
    }
  }, [enabled, hostPath, mode, machinePath, onClose, onSaved, t, webRestricted]);

  const getStatusDisplay = () => {
    if (!enabled) {
      return { label: t('sharedFolder.statusInactive'), color: 'var(--muted)' };
    }
    if (pendingRestart) {
      return { label: t('sharedFolder.statusPendingRestart'), color: 'var(--warning, #f59e0b)' };
    }
    if (isActive) {
      return { label: t('sharedFolder.statusActive'), color: 'var(--success, #4caf50)' };
    }
    return { label: t('sharedFolder.statusInactive'), color: 'var(--muted)' };
  };

  const statusDisplay = getStatusDisplay();

  if (!mounted) return null;

  return (
    <div
      className={visible ? 'console-drawer-backdrop console-drawer-backdrop--visible' : 'console-drawer-backdrop'}
      role="presentation"
      onClick={onClose}
    >
      <aside
        className={visible ? 'console-drawer console-drawer--visible' : 'console-drawer'}
        role="dialog"
        aria-modal="true"
        aria-label={t('sharedFolder.title')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="console-drawer__header">
          <h2 className="console-drawer__title">
            <ShareIcon />
            {t('sharedFolder.title')}
          </h2>
          <button
            className="console-drawer__close"
            type="button"
            onClick={onClose}
            aria-label={t('app.close')}
          >
            <CloseIcon />
          </button>
        </div>

        <div className="console-drawer__body">
          {/* 环境不可用警告 */}
          {!envAvailable && (
            <div className="shared-folder__warning">
              <AlertIcon />
              <div className="shared-folder__warning-content">
                <p>{t('sharedFolder.warningNotAvailable')}</p>
                {installHint && <p className="shared-folder__warning-hint">{installHint}</p>}
              </div>
            </div>
          )}

          {/* 运行时警告 */}
          {runtimeWarning && (
            <div className="shared-folder__warning">
              <AlertIcon />
              <p>{runtimeWarning}</p>
            </div>
          )}

          {/* 开关 */}
          <label className="shared-folder__toggle">
            <span className="shared-folder__toggle-label">{t('sharedFolder.enable')}</span>
            <input
              type="checkbox"
              className="custom-checkbox__input"
              checked={enabled}
              aria-disabled={webRestricted}
              onClick={(event) => {
                if (webRestricted) {
                  event.preventDefault();
                  showWebModificationNotice();
                }
              }}
              onChange={(e) => { if (!webRestricted) setEnabled(e.target.checked); }}
              disabled={!webRestricted && !envAvailable}
            />
            <span className="custom-checkbox__box">
              {enabled && <CheckIcon />}
            </span>
          </label>

          {enabled && (
            <>
              {/* 目录选择 */}
              <div className="field" style={{ marginTop: '16px' }}>
                <label className="field__label">{t('sharedFolder.hostPath')}</label>
                <div className="shared-folder__path-input">
                  <input
                    type="text"
                    value={webRestricted ? getWebResourceDisplayName(hostPath) : hostPath}
                    readOnly={webRestricted}
                    aria-disabled={webRestricted}
                    onClick={() => { if (webRestricted) showWebModificationNotice(); }}
                    onChange={(e) => setHostPath(e.target.value)}
                    placeholder={t('sharedFolder.selectFolder')}
                    disabled={!webRestricted && !envAvailable}
                  />
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={handleSelectFolder}
                    aria-disabled={webRestricted}
                    disabled={!webRestricted && !envAvailable}
                  >
                    <FolderIcon />
                    {t('sharedFolder.selectFolder')}
                  </button>
                </div>
              </div>

              {/* 模式选择 */}
              <div className="shared-folder__mode" style={{ marginTop: '16px' }}>
                <span className="field__label">{t('sharedFolder.mode')}</span>
                <div className="shared-folder__mode-options">
                  <button
                    type="button"
                    className={mode === 'readwrite' ? 'shared-folder__mode-btn shared-folder__mode-btn--active' : 'shared-folder__mode-btn'}
                    aria-disabled={webRestricted}
                    onClick={() => webRestricted ? showWebModificationNotice() : setMode('readwrite')}
                    disabled={!webRestricted && !envAvailable}
                  >
                    {t('sharedFolder.readwrite')}
                  </button>
                  <button
                    type="button"
                    className={mode === 'readonly' ? 'shared-folder__mode-btn shared-folder__mode-btn--active' : 'shared-folder__mode-btn'}
                    aria-disabled={webRestricted}
                    onClick={() => webRestricted ? showWebModificationNotice() : setMode('readonly')}
                    disabled={!webRestricted && !envAvailable}
                  >
                    {t('sharedFolder.readonly')}
                  </button>
                </div>
              </div>

              {/* 状态 */}
              <div className="shared-folder__status" style={{ marginTop: '16px' }}>
                <span className="field__label">{t('sharedFolder.status')}</span>
                <span className="shared-folder__status-badge" style={{ color: statusDisplay.color }}>
                  {statusDisplay.label}
                </span>
              </div>

              {/* 客户机访问方式 */}
              {isActive && (
                <div className="shared-folder__guest-access" style={{ marginTop: '16px' }}>
                  <span className="field__label">{t('sharedFolder.guestAccess')}</span>
                  <div className="shared-folder__access-list">
                    <div className="shared-folder__access-item">
                      <span className="shared-folder__access-label">Windows</span>
                      <code className="shared-folder__access-path">{windowsPath}</code>
                    </div>
                    <div className="shared-folder__access-item">
                      <span className="shared-folder__access-label">macOS / Linux</span>
                      <code className="shared-folder__access-path">{guestUrl}</code>
                    </div>
                  </div>
                  {runtimeInstallHint && (
                    <div className="shared-folder__warning" style={{ marginTop: '12px' }}>
                      <AlertIcon />
                      <p>{runtimeInstallHint}</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="shared-folder__error">
              {error}
            </div>
          )}

          {/* 操作按钮 */}
          <div className="shared-folder__actions">
            <button
              type="button"
              className="button button--secondary"
              onClick={onClose}
              disabled={saving}
            >
              {t('sharedFolder.cancel')}
            </button>
            <button
              type="button"
              className="button button--primary"
              onClick={handleSave}
              aria-disabled={webRestricted}
              disabled={saving || (!webRestricted && !envAvailable)}
            >
              {saving ? t('app.save') : t('sharedFolder.save')}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
