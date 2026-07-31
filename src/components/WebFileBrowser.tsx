import { useEffect, useRef, useState } from 'react';
import { useT } from '../hooks/useT';
import type { WebFileEntry } from '../types/electron';

interface WebFileBrowserProps {
  machineRef: string;
  initialDirectory?: 'Media' | 'Disks' | '';
  mode?: 'manage' | 'pick';
  accept?: string;
  onSelect?: (relativePath: string) => void;
  onClose?: () => void;
}

const FolderIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.8A1.8 1.8 0 0 1 4.8 5h5l2 2h7.4A1.8 1.8 0 0 1 21 8.8v8.4a1.8 1.8 0 0 1-1.8 1.8H4.8A1.8 1.8 0 0 1 3 17.2Z" /></svg>
);

const FileIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2.8h7l5 5v13.4H6Z" /><path d="M13 2.8v5h5" /></svg>
);

const UploadIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v5h14v-5" /></svg>
);

const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v12m0 0 4.5-4.5M12 16l-4.5-4.5M5 20h14" /></svg>
);

const BackIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg>
);

const RefreshIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6" /></svg>
);

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** index);
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function matchesAccept(fileName: string, accept: string) {
  if (!accept) return true;
  const lowerName = fileName.toLowerCase();
  return accept.split(',').some((entry) => {
    const rule = entry.trim().toLowerCase();
    return rule === '*/*' || (rule.startsWith('.') && lowerName.endsWith(rule));
  });
}

export function WebFileBrowser({
  machineRef,
  initialDirectory = '',
  mode = 'manage',
  accept = '',
  onSelect,
  onClose
}: WebFileBrowserProps) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [directory, setDirectory] = useState<string>(initialDirectory);
  const [entries, setEntries] = useState<WebFileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const loadFiles = async (nextDirectory = directory) => {
    const api = window.sanakaWebAPI?.files;
    if (!api) {
      setError(t('webFiles.loadFailed'));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const listing = await api.list(machineRef, nextDirectory);
      setDirectory(listing.directory);
      setEntries(listing.entries);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('webFiles.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFiles(initialDirectory);
    // machineRef is the identity boundary; changing it must reset the browser.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machineRef, initialDirectory]);

  const uploadFile = async (file: File) => {
    if (!directory || uploadProgress !== null) return;
    const api = window.sanakaWebAPI?.files;
    if (!api) return;
    setError('');
    setUploadProgress(0);
    try {
      await api.upload(machineRef, directory, file, setUploadProgress);
      await loadFiles(directory);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : t('webFiles.uploadFailed'));
    } finally {
      setUploadProgress(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const openEntry = (entry: WebFileEntry) => {
    if (entry.kind === 'directory') {
      void loadFiles(entry.path);
      return;
    }
    if (mode === 'pick' && matchesAccept(entry.name, accept)) {
      onSelect?.(entry.path);
    }
  };

  const isRoot = !directory;
  const visibleEntries = mode === 'pick'
    ? entries.filter((entry) => entry.kind === 'directory' || matchesAccept(entry.name, accept))
    : entries;

  return (
    <div
      className={`web-file-browser ${dragging ? 'web-file-browser--dragging' : ''}`}
      onDragEnter={(event) => {
        event.preventDefault();
        if (directory) setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (file) void uploadFile(file);
      }}
    >
      <div className="web-file-browser__toolbar">
        <div className="web-file-browser__location">
          {!isRoot && (
            <button className="icon-button web-file-browser__icon-button" type="button" title={t('webFiles.back')} onClick={() => void loadFiles('')}>
              <BackIcon />
            </button>
          )}
          <div className="web-file-browser__crumbs">
            <button type="button" onClick={() => void loadFiles('')}>{t('webFiles.title')}</button>
            {directory && <><span>/</span><strong>{directory}</strong></>}
          </div>
        </div>
        <div className="web-file-browser__actions">
          <button className="icon-button web-file-browser__icon-button" type="button" title={t('webFiles.refresh')} onClick={() => void loadFiles()}>
            <RefreshIcon />
          </button>
          <input
            ref={inputRef}
            className="web-file-browser__file-input"
            type="file"
            accept={accept || undefined}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadFile(file);
            }}
          />
          <button
            className="button button--primary web-file-browser__upload"
            type="button"
            aria-disabled={!directory || uploadProgress !== null}
            onClick={() => {
              if (directory && uploadProgress === null) inputRef.current?.click();
            }}
          >
            <UploadIcon />
            {uploadProgress === null ? t('webFiles.upload') : `${t('webFiles.uploading')} ${uploadProgress}%`}
          </button>
          {onClose && <button className="button button--secondary" type="button" onClick={onClose}>{t('webFiles.close')}</button>}
        </div>
      </div>

      {uploadProgress !== null && (
        <div className="web-file-browser__progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadProgress}>
          <span style={{ width: `${uploadProgress}%` }} />
        </div>
      )}

      {error && <div className="warning-banner web-file-browser__error">{error}</div>}

      {isRoot ? (
        <div className="web-file-browser__roots">
          {visibleEntries.map((entry) => {
            const isMedia = entry.name === 'Media';
            return (
              <button key={entry.path} className="web-file-root" type="button" onClick={() => openEntry(entry)}>
                <span className="web-file-root__icon"><FolderIcon /></span>
                <span className="web-file-root__text">
                  <strong>{isMedia ? t('webFiles.media') : t('webFiles.disks')}</strong>
                  <small>{isMedia ? t('webFiles.mediaDescription') : t('webFiles.disksDescription')}</small>
                </span>
                <span className="web-file-root__arrow">›</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="web-file-browser__list" aria-busy={loading}>
          {!loading && visibleEntries.length === 0 && (
            <div className="web-file-browser__empty">
              <FolderIcon />
              <strong>{t('webFiles.empty')}</strong>
              <span>{t('webFiles.uploadHere')}</span>
            </div>
          )}
          {visibleEntries.map((entry) => (
            <div className="web-file-row" key={entry.path}>
              <button className="web-file-row__main" type="button" onClick={() => openEntry(entry)}>
                <span className="web-file-row__icon">{entry.kind === 'directory' ? <FolderIcon /> : <FileIcon />}</span>
                <span className="web-file-row__name">{entry.name}</span>
                <span className="web-file-row__meta">{entry.kind === 'file' ? formatFileSize(entry.size) : ''}</span>
              </button>
              {entry.kind === 'file' && mode === 'manage' && (
                <a className="icon-button web-file-browser__icon-button" href={window.sanakaWebAPI?.files.downloadUrl(machineRef, entry.path)} title={t('webFiles.download')}>
                  <DownloadIcon />
                </a>
              )}
              {entry.kind === 'file' && mode === 'pick' && (
                <button className="button button--secondary web-file-row__choose" type="button" onClick={() => onSelect?.(entry.path)}>
                  {t('webFiles.choose')}
                </button>
              )}
            </div>
          ))}
          {loading && <div className="page-loading web-file-browser__loading">{t('common.loading')}</div>}
        </div>
      )}

      <p className="web-file-browser__hint">{t('webFiles.protectedHint')}</p>
      {dragging && directory && <div className="web-file-browser__drop"><UploadIcon /><strong>{t('webFiles.uploadHere')}</strong></div>}
    </div>
  );
}

interface WebFilePickerDialogProps {
  open: boolean;
  machineRef: string;
  directory: 'Media' | 'Disks';
  accept?: string;
  onSelect: (relativePath: string) => void;
  onClose: () => void;
}

export function WebFilePickerDialog({ open, machineRef, directory, accept, onSelect, onClose }: WebFilePickerDialogProps) {
  const t = useT();
  if (!open) return null;
  return (
    <div className="modal-backdrop modal-backdrop--visible" role="presentation" onClick={onClose}>
      <div className="modal-card modal-card--visible web-file-picker" role="dialog" aria-modal="true" aria-labelledby="web-file-picker-title" onClick={(event) => event.stopPropagation()}>
        <div className="web-file-picker__header">
          <div>
            <h2 id="web-file-picker-title">{t('webFiles.selectTitle')}</h2>
            <p>{t('webFiles.subtitle')}</p>
          </div>
        </div>
        <WebFileBrowser machineRef={machineRef} initialDirectory={directory} mode="pick" accept={accept} onSelect={onSelect} onClose={onClose} />
      </div>
    </div>
  );
}
