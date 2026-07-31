import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { QemuDirectoryCandidate, QemuDirectoryScanResult } from '../types/electron';
import { useT } from '../hooks/useT';
import { usePresence } from '../hooks/usePresence';

interface QemuExternalDirDialogProps {
  open: boolean;
  initialPath: string;
  onApply: (path: string) => void;
  onClose: () => void;
}

export function QemuExternalDirDialog({ open, initialPath, onApply, onClose }: QemuExternalDirDialogProps) {
  const t = useT();
  const { mounted, visible } = usePresence(open);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openRef = useRef(open);
  const [path, setPath] = useState(initialPath);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<QemuDirectoryScanResult | null>(null);
  const [candidates, setCandidates] = useState<QemuDirectoryCandidate[]>([]);

  openRef.current = open;

  useEffect(() => {
    if (open) {
      setPath(initialPath);
      setError(null);
      setChecking(false);
      setScanning(false);
      setScanResult(null);
      setCandidates([]);
    }
  }, [open, initialPath]);

  useEffect(() => {
    if (!open) {
      void window.electronAPI.runtime.cancelQemuDirectoryScan();
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (visible) closeButtonRef.current?.focus();
  }, [visible]);

  useEffect(() => {
    if (!open) return undefined;
    return window.electronAPI.runtime.onRuntimeEvent((event) => {
      if (event.type !== 'qemu-directory-scan-candidate' || !event.candidate) return;
      setCandidates((current) => {
        const index = current.findIndex((candidate) => candidate.path === event.candidate?.path);
        if (index < 0) return [...current, event.candidate as QemuDirectoryCandidate];
        const next = [...current];
        next[index] = event.candidate as QemuDirectoryCandidate;
        return next;
      });
    });
  }, [open]);

  if (!mounted) return null;

  const handleApply = async () => {
    setError(null);
    const trimmed = path.trim();
    if (!trimmed) {
      setError(t('settings.qemuExternalDirErrorInvalid'));
      return;
    }
    try {
      setChecking(true);
      const result = await window.electronAPI.runtime.validateQemuDirectory(trimmed);
      if (!openRef.current) return;
      if (result.ok && result.candidate) {
        onApply(result.candidate.path);
      } else {
        setError(t('settings.qemuExternalDirErrorInvalid'));
      }
    } catch {
      if (openRef.current) setError(t('settings.qemuExternalDirErrorScan'));
    } finally {
      if (openRef.current) setChecking(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      void handleApply();
    }
  };

  const handleSelectPath = async () => {
    setError(null);
    const picked = await window.electronAPI.dialogs.selectFolder();
    if (picked?.path) {
      setPath(picked.path);
      setError(null);
    }
  };

  const handleScan = async () => {
    if (scanning) {
      await window.electronAPI.runtime.cancelQemuDirectoryScan();
      return;
    }

    setScanning(true);
    setError(null);
    setScanResult(null);
    setCandidates([]);
    try {
      const result = await window.electronAPI.runtime.scanQemuDirectories();
      if (openRef.current) {
        setScanResult(result);
        setCandidates(result.candidates);
      }
    } catch {
      if (openRef.current) setError(t('settings.qemuExternalDirErrorScan'));
    } finally {
      if (openRef.current) setScanning(false);
    }
  };

  const selectCandidate = (candidate: QemuDirectoryCandidate) => {
    setPath(candidate.path);
    setError(null);
  };

  const candidateCount = candidates.length;

  const dialog = (
    <div
      className={visible ? 'about-dialog-backdrop qemu-external-dir-backdrop about-dialog-backdrop--visible' : 'about-dialog-backdrop qemu-external-dir-backdrop'}
      role="presentation"
      onClick={onClose}
    >
      <div
        className={visible ? 'about-dialog qemu-external-dir-dialog about-dialog--visible' : 'about-dialog qemu-external-dir-dialog'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="qemu-external-dir-title"
        aria-busy={scanning}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="qemu-external-dir-dialog__header">
          <h2 id="qemu-external-dir-title">{t('settings.qemuExternalDirDialogTitle')}</h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="button button--ghost qemu-external-dir-dialog__close"
            onClick={onClose}
            aria-label={t('app.close')}
          >
            {t('app.close')}
          </button>
        </header>

        <div className="qemu-external-dir-dialog__toolbar" aria-labelledby="qemu-external-dir-manual-title">
          <div className="qemu-external-dir-dialog__directory-copy">
            <strong id="qemu-external-dir-manual-title">{t('settings.qemuExternalDirManualTitle')}</strong>
            <span>{t('settings.qemuExternalDirManualHint')}</span>
          </div>
          <div className="qemu-external-dir-dialog__input-row">
            <input
              id="qemu-external-dir-path"
              className="input"
              type="text"
              value={path}
              onChange={(event) => {
                setPath(event.target.value);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder={t('settings.qemuExternalDirPathPlaceholder')}
              spellCheck={false}
            />
            <button type="button" className="button qemu-external-dir-dialog__browse" onClick={() => void handleSelectPath()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 7.5h6l2 2h10v9.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
                <path d="M3 7.5V6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1.5" />
              </svg>
              {t('settings.qemuExternalDirSelectPath')}
            </button>
          </div>
          <button
            type="button"
            className={scanning ? 'button qemu-external-dir-dialog__scan-button qemu-external-dir-dialog__scan-button--active' : 'button qemu-external-dir-dialog__scan-button'}
            onClick={() => void handleScan()}
          >
            {scanning ? (
              <span className="qemu-external-dir-dialog__spinner" aria-hidden="true" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-4-4" />
              </svg>
            )}
            {scanning ? t('settings.qemuExternalDirStopScan') : t('settings.qemuExternalDirScan')}
          </button>
        </div>

        <main className="qemu-external-dir-dialog__content">
          <section aria-labelledby="qemu-external-dir-scan-title">
            <div className="qemu-external-dir-dialog__content-heading">
              <div>
                <h3 id="qemu-external-dir-scan-title">{t('settings.qemuExternalDirCandidatesTitle')}</h3>
                <p>{scanning ? t('settings.qemuExternalDirScanningHint') : t('settings.qemuExternalDirCandidatesHint')}</p>
              </div>
              {candidateCount > 0 ? (
                <span className="qemu-external-dir-dialog__status">
                  {scanning
                    ? t('settings.qemuExternalDirScanning')
                    : scanResult?.cancelled
                      ? t('settings.qemuExternalDirScanCancelled')
                      : t('settings.qemuExternalDirScanComplete')}
                </span>
              ) : null}
            </div>

            <div className="qemu-external-dir-dialog__results" aria-live="polite">
              {candidateCount > 0 ? (
                <div className="qemu-external-dir-dialog__candidate-list">
                  {candidates.map((candidate) => {
                    const selected = path.trim() === candidate.path;
                    return (
                      <button
                        type="button"
                        key={candidate.path}
                        className={selected ? 'qemu-external-dir-dialog__candidate qemu-external-dir-dialog__candidate--selected' : 'qemu-external-dir-dialog__candidate'}
                        onClick={() => selectCandidate(candidate)}
                        aria-pressed={selected}
                      >
                        <span className="qemu-external-dir-dialog__candidate-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="14" rx="2" />
                            <path d="M8 21h8M12 18v3" />
                          </svg>
                        </span>
                        <strong className="qemu-external-dir-dialog__candidate-path">{candidate.path}</strong>
                        <span className="qemu-external-dir-dialog__candidate-meta">
                          {candidate.version || t('settings.qemuExternalDirReadingVersion')}
                          <small>{candidate.targets.join(', ') || '-'}</small>
                        </span>
                        <span className="qemu-external-dir-dialog__candidate-check" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : scanning ? (
                <div className="qemu-external-dir-dialog__empty qemu-external-dir-dialog__empty--compact">
                  <span className="qemu-external-dir-dialog__spinner" aria-hidden="true" />
                  <span>{t('settings.qemuExternalDirScanningDetail')}</span>
                </div>
              ) : scanResult ? (
                <div className="qemu-external-dir-dialog__empty qemu-external-dir-dialog__empty--compact">
                  <strong>{scanResult.cancelled ? t('settings.qemuExternalDirScanCancelled') : t('settings.qemuExternalDirNoCandidates')}</strong>
                  <span>{t('settings.qemuExternalDirNoCandidatesHint')}</span>
                </div>
              ) : (
                <div className="qemu-external-dir-dialog__empty qemu-external-dir-dialog__empty--compact">
                  <strong>{t('settings.qemuExternalDirNotScanned')}</strong>
                  <span>{t('settings.qemuExternalDirNotScannedHint')}</span>
                </div>
              )}
            </div>
          </section>

          {error ? <p className="qemu-external-dir-dialog__error" role="alert">{error}</p> : null}
        </main>

        <footer className="qemu-external-dir-dialog__actions">
          <span>{t('settings.qemuExternalDirStrictHint')}</span>
          <div>
            <button type="button" className="button button--ghost" onClick={onClose}>{t('settings.qemuExternalDirCancel')}</button>
            <button type="button" className="button button--primary" onClick={() => void handleApply()} disabled={checking || scanning || !path.trim()}>
              {checking ? t('settings.qemuExternalDirChecking') : t('settings.qemuExternalDirApply')}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
