import { useEffect, useMemo, useState } from 'react';
import type { RecentEntry, WorkspaceMachineItem } from '../domain/schemas';
import { getElementTransitionOrigin, type FullscreenTransitionOrigin } from '../lib/fullscreenTransition';

function getMachineTheme(entry: { templateLabel?: string; status?: string }) {
  const label = (entry.templateLabel ?? entry.status ?? '').toLowerCase();
  if (label.includes('98')) return 'machine-visual--legacy';
  if (label.includes('windows')) return 'machine-visual--windows';
  if (label.includes('linux')) return 'machine-visual--linux';
  return 'machine-visual--custom';
}

function toFileUrl(path: string) {
  const normalized = path.replace(/\\/g, '/');
  return new URL(`file://${normalized.startsWith('/') ? '' : '/'}${normalized}`).toString();
}

function normalizeCandidate(path?: string) {
  if (!path) return undefined;
  return path.includes('://') ? path : toFileUrl(path);
}

function buildPreviewCandidates(entry: Pick<RecentEntry, 'path' | 'previewImageUrl'> | Pick<WorkspaceMachineItem, 'path' | 'previewImageUrl'>) {
  if (!entry.path) {
    return entry.previewImageUrl ? [normalizeCandidate(entry.previewImageUrl)].filter((candidate): candidate is string => Boolean(candidate)) : [];
  }

  const normalizedPath = entry.path.replace(/[/\\]+$/, '');
  return [
    normalizeCandidate(entry.previewImageUrl),
    toFileUrl(`${normalizedPath}/preview.png`),
    entry.path.toLowerCase().endsWith('.saka') ? toFileUrl(`${entry.path.replace(/\.saka$/i, '')}.png`) : undefined,
    entry.path.toLowerCase().endsWith('.saka') ? toFileUrl(`${entry.path.replace(/\.saka$/i, '')}.jpg`) : undefined,
    entry.path.toLowerCase().endsWith('.saka') ? toFileUrl(`${entry.path.replace(/\.saka$/i, '')}.jpeg`) : undefined,
    entry.path.toLowerCase().endsWith('.saka') ? toFileUrl(`${entry.path.replace(/\.saka$/i, '')}.webp`) : undefined
  ].filter((candidate, index, items): candidate is string => Boolean(candidate) && items.indexOf(candidate) === index);
}

export function MachineVisual({
  entry,
  className = '',
  imageClassName = '',
  placeholderLabel,
  isRunning = false,
  onPlayClick
}: {
  entry: Pick<WorkspaceMachineItem, 'path' | 'previewImageUrl' | 'templateLabel' | 'status'>;
  className?: string;
  imageClassName?: string;
  placeholderLabel?: string;
  isRunning?: boolean;
  onPlayClick?: (origin: FullscreenTransitionOrigin) => void;
}) {
  const candidates = useMemo(() => buildPreviewCandidates(entry), [entry]);
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [entry.path, entry.previewImageUrl]);

  const src = candidates[candidateIndex];
  const themeClass = getMachineTheme(entry);
  const baseClassName = ['machine-visual', themeClass, className].filter(Boolean).join(' ');

  if (!src) {
    return (
      <div className={`${baseClassName} machine-visual--placeholder`} aria-hidden={placeholderLabel ? undefined : 'true'}>
        {onPlayClick ? (
          <button
            className="machine-visual__play-btn"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPlayClick(getElementTransitionOrigin(e.currentTarget));
            }}
            title={isRunning ? "进入控制台" : "启动虚拟机"}
          >
            {isRunning ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '28px', height: '28px' }}>
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '28px', height: '28px', marginLeft: '3px' }}>
                <polygon points="5 3 19 12 5 21" />
              </svg>
            )}
          </button>
        ) : (
          placeholderLabel ? <span>{placeholderLabel}</span> : null
        )}
      </div>
    );
  }

  return (
    <div className={baseClassName}>
      <img
        className={['machine-visual__image', imageClassName].filter(Boolean).join(' ')}
        src={src}
        alt=""
        aria-hidden="true"
        onError={() => {
          if (candidateIndex < candidates.length - 1) {
            setCandidateIndex((current) => current + 1);
          } else {
            setCandidateIndex(candidates.length);
          }
        }}
      />
      {onPlayClick ? (
        <button
          className="machine-visual__play-btn machine-visual__play-btn--overlay"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPlayClick(getElementTransitionOrigin(e.currentTarget));
          }}
          title={isRunning ? "进入控制台" : "启动虚拟机"}
        >
          {isRunning ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '28px', height: '28px' }}>
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '28px', height: '28px', marginLeft: '3px' }}>
              <polygon points="5 3 19 12 5 21" />
            </svg>
          )}
        </button>
      ) : null}
    </div>
  );
}
