import type { CSSProperties } from 'react';
import type { FullscreenTransitionOrigin, FullscreenTransitionType } from '../lib/fullscreenTransition';

interface FullscreenTransitionProps {
  type: FullscreenTransitionType;
  origin: FullscreenTransitionOrigin | null;
  phase: 'covering' | 'revealing';
}

type TransitionStyle = CSSProperties & {
  '--transition-origin-x': string;
  '--transition-origin-y': string;
  '--transition-size': string;
  '--transition-glyph-size': string;
  '--transition-cover-scale': string;
  '--transition-reveal-scale': string;
};

function getTransitionStyle(origin: FullscreenTransitionOrigin | null): TransitionStyle {
  const viewportWidth = Math.max(window.innerWidth, 1);
  const viewportHeight = Math.max(window.innerHeight, 1);
  const resolvedOrigin = origin && origin.size > 0
    ? origin
    : { x: viewportWidth / 2, y: viewportHeight / 2, size: 64 };
  const farthestX = Math.max(resolvedOrigin.x, viewportWidth - resolvedOrigin.x);
  const farthestY = Math.max(resolvedOrigin.y, viewportHeight - resolvedOrigin.y);
  const coverDiameter = Math.hypot(farthestX, farthestY) * 2 + 8;

  return {
    '--transition-origin-x': `${resolvedOrigin.x}px`,
    '--transition-origin-y': `${resolvedOrigin.y}px`,
    '--transition-size': `${resolvedOrigin.size}px`,
    '--transition-glyph-size': `${resolvedOrigin.size * 0.44}px`,
    '--transition-cover-scale': String(coverDiameter / resolvedOrigin.size),
    '--transition-reveal-scale': String((coverDiameter / resolvedOrigin.size) * 1.025)
  };
}

export function FullscreenTransition({ type, origin, phase }: FullscreenTransitionProps) {
  return (
    <div
      className={`fullscreen-transition-overlay fullscreen-transition-overlay--${type} fullscreen-transition-overlay--${phase}`}
      data-testid="fullscreen-transition"
      data-phase={phase}
      style={getTransitionStyle(origin)}
      aria-hidden="true"
    >
      <span className="fullscreen-transition-disc" />
      <span className="fullscreen-transition-glyph">
        {type === 'launch' ? (
          <svg viewBox="0 0 24 24" fill="currentColor">
            <polygon points="6 4 20 12 6 20" />
          </svg>
        ) : null}
        {type === 'console' ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        ) : null}
        {type === 'delete' ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        ) : null}
      </span>
    </div>
  );
}
