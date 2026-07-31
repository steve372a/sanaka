export type FullscreenTransitionType = 'launch' | 'console' | 'delete';

export interface FullscreenTransitionOrigin {
  x: number;
  y: number;
  size: number;
}

export interface FullscreenTransitionState {
  active: boolean;
  type: FullscreenTransitionType;
  origin: FullscreenTransitionOrigin | null;
  phase: 'covering' | 'revealing';
}

export function getElementTransitionOrigin(element: HTMLElement): FullscreenTransitionOrigin {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
    size: Math.max(rect.width, rect.height)
  };
}
