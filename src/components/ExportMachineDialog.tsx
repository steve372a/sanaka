import { useState, useEffect } from 'react';
import { useT } from '../hooks/useT';
import { usePresence } from '../hooks/usePresence';
import type { ExportProgress } from '../types/electron';
import { isExternalWebResource, isWebMode, showWebModificationNotice } from '../lib/webMode';

interface ExportMachineDialogProps {
  open: boolean;
  onClose: () => void;
  machine: {
    id: string;
    title: string;
    author?: string;
    path?: string;
    mediaIso?: string;
    disks?: Array<{ id: string; name: string; path: string; size?: string }>;
  };
}

// Icons
const ExportIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const FolderIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const DiskIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
    <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
    <line x1="6" y1="6" x2="6.01" y2="6" />
    <line x1="6" y1="18" x2="6.01" y2="18" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter" width="12" height="12">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export function ExportMachineDialog({ open, onClose, machine }: ExportMachineDialogProps) {
  const t = useT();
  const webMode = isWebMode();
  const { mounted, visible } = usePresence(open, 300);

  // 表单状态
  const [includeIso, setIncludeIso] = useState(false);
  const [selectedDisks, setSelectedDisks] = useState<string[]>([]);
  const [author, setAuthor] = useState(machine.author || '');
  const [machineName, setMachineName] = useState(machine.title);
  const [packAsZip, setPackAsZip] = useState(true);
  const [outputPath, setOutputPath] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 导出进度状态
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<ExportProgress['phase']>('preparing');
  const [currentOperation, setCurrentOperation] = useState('');
  const [currentDetail, setCurrentDetail] = useState('');
  const [remainingTime, setRemainingTime] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [completedOutputPath, setCompletedOutputPath] = useState('');

  const mapPhaseToLabel = (phase: ExportProgress['phase']) => {
    switch (phase) {
      case 'preparing':
        return t('export.preparing');
      case 'copying_config':
        return t('export.copyingConfig');
      case 'copying_iso':
        return t('export.copyingIso');
      case 'copying_disks':
        return t('export.copyingDisks');
      case 'updating_metadata':
        return t('export.generatingMetadata');
      case 'packing':
        return t('export.packing');
      case 'completed':
        return t('export.completed');
      case 'failed':
        return t('export.failed');
      default:
        return '';
    }
  };

  // 初始化磁盘选择（默认全选）
  useEffect(() => {
    if (machine.disks && machine.disks.length > 0) {
      setSelectedDisks(machine.disks
        .filter((disk) => !webMode || !isExternalWebResource(disk.path))
        .map((disk) => disk.id));
    }
  }, [machine.disks, webMode]);

  // 重置表单当对话框打开时
  useEffect(() => {
    if (open) {
      setIncludeIso(false);
      setAuthor(machine.author || '');
      setMachineName(machine.title);
      setPackAsZip(true);
      setOutputPath('');
      setError(null);
      setIsExporting(false);
      setProgress(0);
      setPhase('preparing');
      setCurrentOperation('');
      setCurrentDetail('');
      setRemainingTime('');
      setIsComplete(false);
      setExportError(null);
      setActiveTaskId(null);
      setCompletedOutputPath('');
      if (machine.disks && machine.disks.length > 0) {
        setSelectedDisks(machine.disks
          .filter((disk) => !webMode || !isExternalWebResource(disk.path))
          .map((disk) => disk.id));
      }
    }
  }, [open, machine, webMode]);

  useEffect(() => {
    const unsubscribe = window.electronAPI.machine.onExportProgress((payload) => {
      if (!activeTaskId || payload.taskId !== activeTaskId) {
        return;
      }

      if (payload.phase === 'failed') {
        setIsExporting(false);
        setActiveTaskId(null);
        setPhase(payload.phase);
        setExportError(payload.error || payload.detail || t('export.failed'));
        setError(payload.error || payload.detail || t('export.failed'));
        setCurrentOperation(mapPhaseToLabel(payload.phase));
        setCurrentDetail(payload.detail || '');
        setRemainingTime('');
        return;
      }

      setPhase(payload.phase);
      setProgress(payload.percent);
      setCurrentOperation(mapPhaseToLabel(payload.phase));
      setCurrentDetail(
        payload.phase === 'copying_disks' || payload.phase === 'copying_iso' || payload.phase === 'copying_config'
          ? payload.detail || ''
          : ''
      );
      setRemainingTime(
        typeof payload.estimatedSeconds === 'number'
          ? t('export.remainingTime', { seconds: payload.estimatedSeconds })
          : ''
      );

      if (payload.phase === 'completed') {
        setIsExporting(false);
        setIsComplete(true);
        setActiveTaskId(null);
        setCompletedOutputPath(payload.detail || outputPath);
        setCurrentOperation(mapPhaseToLabel(payload.phase));
        setCurrentDetail('');
        setRemainingTime('');
        setExportError(null);
      }
    });

    return unsubscribe;
  }, [activeTaskId, outputPath, t]);

  // 处理磁盘选择切换
  const handleDiskToggle = (diskId: string) => {
    const disk = machine.disks?.find((entry) => entry.id === diskId);
    if (webMode && isExternalWebResource(disk?.path)) {
      showWebModificationNotice();
      return;
    }
    setSelectedDisks(prev =>
      prev.includes(diskId)
        ? prev.filter(id => id !== diskId)
        : [...prev, diskId]
    );
  };

  // 处理浏览文件夹
  const handleBrowseFolder = async () => {
    try {
      const result = await window.electronAPI.dialogs.selectFolder();
      if (result?.path) {
        setOutputPath(result.path);
      }
    } catch {
      setError(t('export.error.noOutputPath'));
    }
  };

  // 处理开始导出
  const handleStartExport = async () => {
    if (!machine.path) {
      setError(t('export.error.noSourcePath'));
      return;
    }
    if (!webMode && !outputPath.trim()) {
      setError(t('export.error.noOutputPath'));
      return;
    }
    if (!machineName.trim()) {
      setError(t('export.error.noMachineName'));
      return;
    }

    setError(null);
    setIsExporting(true);
    setProgress(0);
    setCurrentOperation(t('export.preparing'));
    setRemainingTime(t('export.calculating'));
    setIsComplete(false);
    setExportError(null);
    setCompletedOutputPath('');

    try {
      const taskId = await window.electronAPI.machine.exportMachine({
        sourcePath: machine.path,
        targetDir: webMode ? '' : outputPath.trim(),
        name: machineName.trim(),
        author: author.trim(),
        includeIso,
        selectedDisks,
        packAsZip: webMode ? true : packAsZip
      });
      setActiveTaskId(taskId);
    } catch (err) {
      setIsExporting(false);
      setActiveTaskId(null);
      setExportError(err instanceof Error ? err.message : t('export.failed'));
      setError(err instanceof Error ? err.message : t('export.failed'));
    }
  };

  // 处理取消导出
  const handleCancelExport = async () => {
    if (activeTaskId) {
      await window.electronAPI.machine.cancelExport(activeTaskId).catch(() => false);
    }
    setIsExporting(false);
    setActiveTaskId(null);
    setProgress(0);
    setPhase('preparing');
    setCurrentOperation('');
    setCurrentDetail('');
    setRemainingTime('');
    setExportError(null);
  };

  // 处理打开文件夹
  const handleOpenFolder = async () => {
    const targetPath = completedOutputPath || outputPath;
    if (targetPath) {
      try {
        if (webMode) {
          const link = document.createElement('a');
          link.href = targetPath;
          link.download = '';
          document.body.appendChild(link);
          link.click();
          link.remove();
          return;
        }
        await window.electronAPI.files.openFolder(targetPath);
      } catch (err) {
        console.error('打开文件夹失败:', err);
      }
    }
  };

  // 处理完成导出
  const handleComplete = () => {
    setIsExporting(false);
    setIsComplete(false);
    setActiveTaskId(null);
    setProgress(0);
    onClose();
  };

  const handleRequestClose = () => {
    if (!isExporting) {
      onClose();
    }
  };

  if (!mounted) return null;

  const isFinishingPhase = phase === 'updating_metadata' || phase === 'packing';
  const progressMetaLabel = isFinishingPhase ? t('export.finalizing') : remainingTime;

  return (
    <div
      className={visible ? 'about-dialog-backdrop about-dialog-backdrop--visible' : 'about-dialog-backdrop'}
      role="presentation"
      onClick={handleRequestClose}
    >
      <div
        className={visible ? 'about-dialog about-dialog--visible export-dialog--purple' : 'about-dialog export-dialog--purple'}
        style={{ width: 'min(100%, 560px)', maxHeight: '90vh', overflow: 'auto', padding: '0' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-machine-title"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="export-dialog__header">
          <h2 id="export-machine-title" className="export-dialog__title">
            <ExportIcon />
            {t('export.title')}
          </h2>
          <button
            type="button"
            className="about-dialog__close"
            onClick={handleRequestClose}
            aria-label={t('app.close')}
            disabled={isExporting}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="export-dialog__content">
          {/* 导出完成界面 */}
          {isComplete ? (
            <div className="export-dialog__complete">
              <div className="export-dialog__success-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ width: '32px', height: '32px' }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>

              <div className="export-dialog__complete-info">
                <p className="export-dialog__complete-title">
                  {t('export.completeTitle', { name: machineName })}
                </p>
                <p className="export-dialog__complete-path">
                  {webMode ? t('export.webDownloadDescription') : completedOutputPath}
                </p>
              </div>

              <div className="export-dialog__complete-actions">
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={handleOpenFolder}
                >
                  {webMode ? <ExportIcon /> : <FolderIcon />}
                  {webMode ? t('export.download') : t('export.openFolder')}
                </button>
                <button
                  type="button"
                  className="button button--primary"
                  onClick={handleComplete}
                >
                  {t('export.done')}
                </button>
              </div>
            </div>
          ) : isExporting ? (
            /* 导出进度界面 */
            <div className="export-dialog__progress">
              <div className="export-dialog__progress-header">
                <p className="export-dialog__progress-name">{machineName}</p>
                <p className="export-dialog__progress-status">{t('export.exporting')}</p>
              </div>

              <div className="export-dialog__progress-bar">
                <div className={`export-dialog__progress-track${isFinishingPhase ? ' export-dialog__progress-track--active' : ''}`}>
                  <div
                    className="export-dialog__progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="export-dialog__progress-meta">
                  <span>{progress}%</span>
                  <span>{progressMetaLabel}</span>
                </div>
              </div>

              <div className="export-dialog__progress-operation">
                {currentOperation}
              </div>

              {currentDetail ? (
                <div className="export-dialog__progress-detail">
                  {currentDetail}
                </div>
              ) : null}

              {exportError && (
                <div className="export-dialog__progress-error">
                  {exportError}
                </div>
              )}

              <div className="export-dialog__progress-actions">
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={handleCancelExport}
                >
                  {t('export.cancel')}
                </button>
              </div>
            </div>
          ) : (
            /* 导出配置表单 */
            <div className="export-dialog__form">
              {/* 虚拟机信息卡片 */}
              <div className="export-dialog__info-card">
                <div className="export-dialog__info-row">
                  <span className="export-dialog__info-label">{t('export.originalName')}</span>
                  <span className="export-dialog__info-value">{machine.title}</span>
                </div>
                {machine.author && (
                  <div className="export-dialog__info-row">
                    <span className="export-dialog__info-label">{t('export.originalAuthor')}</span>
                    <span className="export-dialog__info-value">{machine.author}</span>
                  </div>
                )}
              </div>

              {/* 基本信息 */}
              <div className="export-dialog__section">
                <h3 className="export-dialog__section-title">{t('export.basicInfo')}</h3>
                <div className="export-dialog__field-row">
                  <div className="field">
                    <label className="field__label">{t('export.machineName')}</label>
                    <input
                      type="text"
                      value={machineName}
                      onChange={(e) => setMachineName(e.target.value)}
                      placeholder={t('export.machineNamePlaceholder')}
                    />
                  </div>
                  <div className="field">
                    <label className="field__label">{t('export.author')}</label>
                    <input
                      type="text"
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      placeholder={t('export.authorPlaceholder')}
                    />
                  </div>
                </div>
              </div>

              {/* 包含内容 */}
              <div className="export-dialog__section">
                <h3 className="export-dialog__section-title">{t('export.includeContent')}</h3>

                <label className="export-dialog__option">
                  <input
                    type="checkbox"
                    className="custom-checkbox__input"
                    checked={includeIso}
                    aria-disabled={webMode && isExternalWebResource(machine.mediaIso)}
                    onClick={(event) => {
                      if (webMode && isExternalWebResource(machine.mediaIso)) {
                        event.preventDefault();
                        showWebModificationNotice();
                      }
                    }}
                    onChange={(e) => {
                      if (!webMode || !isExternalWebResource(machine.mediaIso)) {
                        setIncludeIso(e.target.checked);
                      }
                    }}
                  />
                  <span className="custom-checkbox__box">
                    {includeIso && <CheckIcon />}
                  </span>
                  <span className="export-dialog__option-content">
                    <span className="export-dialog__option-title">{t('export.includeIso')}</span>
                    <span className="export-dialog__option-desc">{t('export.includeIsoDesc')}</span>
                  </span>
                </label>

                {/* 磁盘镜像选择 */}
                {machine.disks && machine.disks.length > 0 && (
                  <div className="export-dialog__disks">
                    <span className="export-dialog__option-title">{t('export.selectDisks')}</span>
                    <div className="export-dialog__disk-list">
                      {machine.disks.map(disk => {
                        const isChecked = selectedDisks.includes(disk.id);
                        const isExternal = webMode && isExternalWebResource(disk.path);
                        return (
                          <label
                            key={disk.id}
                            className={`export-dialog__disk-item ${isChecked ? 'export-dialog__disk-item--checked' : 'export-dialog__disk-item--unchecked'}`}
                            aria-disabled={isExternal}
                          >
                            <DiskIcon />
                            <span className="export-dialog__disk-info">
                              <span className="export-dialog__disk-name">{disk.name}</span>
                              {disk.size && <span className="export-dialog__disk-size">{disk.size}</span>}
                            </span>
                            <input
                              type="checkbox"
                              className="custom-checkbox__input"
                              checked={isChecked}
                              aria-disabled={isExternal}
                              onChange={() => handleDiskToggle(disk.id)}
                            />
                            <span className="custom-checkbox__box">
                              {isChecked && <CheckIcon />}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 输出设置 */}
              <div className="export-dialog__section">
                <h3 className="export-dialog__section-title">{t('export.outputSettings')}</h3>
                {webMode ? (
                  <div className="export-dialog__info-card">
                    <div className="export-dialog__info-row">
                      <span className="export-dialog__info-label">{t('export.webDownloadTitle')}</span>
                      <span className="export-dialog__info-value">{t('export.webDownloadDescription')}</span>
                    </div>
                  </div>
                ) : <>
                <label className="export-dialog__option">
                  <input
                    type="checkbox"
                    className="custom-checkbox__input"
                    checked={packAsZip}
                    onChange={(e) => setPackAsZip(e.target.checked)}
                  />
                  <span className="custom-checkbox__box">
                    {packAsZip && <CheckIcon />}
                  </span>
                  <span className="export-dialog__option-content">
                    <span className="export-dialog__option-title">{t('export.packAsZip')}</span>
                    <span className="export-dialog__option-desc">
                      {packAsZip ? t('export.packAsZipDescOn') : t('export.packAsZipDescOff')}
                    </span>
                  </span>
                </label>

                <div className="field" style={{ marginTop: '12px' }}>
                  <label className="field__label">
                    {t('export.outputPath')} <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <div className="export-dialog__path-input">
                    <input
                      type="text"
                      value={outputPath}
                      onChange={(e) => setOutputPath(e.target.value)}
                      placeholder={t('export.outputPathPlaceholder')}
                    />
                    <button
                      type="button"
                      className="button button--secondary"
                      onClick={handleBrowseFolder}
                    >
                      <FolderIcon />
                      {t('export.browse')}
                    </button>
                  </div>
                </div>
                </>}
              </div>

              {/* 错误提示 */}
              {error && (
                <div className="export-dialog__error">
                  {error}
                </div>
              )}

              {/* 开始导出按钮 */}
              <div className="export-dialog__actions">
                <button
                  type="button"
                  className="button button--primary export-dialog__export-btn"
                  onClick={handleStartExport}
                  disabled={isExporting}
                >
                  <ExportIcon />
                  {isExporting ? t('export.exporting') : t('export.startExport')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
