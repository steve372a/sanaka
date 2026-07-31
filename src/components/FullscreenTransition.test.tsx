import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FullscreenTransition } from './FullscreenTransition';
import { getElementTransitionOrigin } from '../lib/fullscreenTransition';

describe('FullscreenTransition', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('expands from the supplied button origin far enough to cover the viewport', () => {
    vi.stubGlobal('innerWidth', 1000);
    vi.stubGlobal('innerHeight', 700);

    render(
      <FullscreenTransition
        type="launch"
        phase="covering"
        origin={{ x: 200, y: 300, size: 72 }}
      />
    );

    const overlay = screen.getByTestId('fullscreen-transition');
    const expectedDiameter = Math.hypot(800, 400) * 2 + 8;
    expect(overlay).toHaveStyle({
      '--transition-origin-x': '200px',
      '--transition-origin-y': '300px',
      '--transition-size': '72px',
      '--transition-cover-scale': String(expectedDiameter / 72)
    });
    expect(overlay).toHaveAttribute('data-phase', 'covering');
  });

  it('reads the visual origin from the clicked element bounds', () => {
    const button = document.createElement('button');
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
      x: 120,
      y: 80,
      left: 120,
      top: 80,
      right: 192,
      bottom: 152,
      width: 72,
      height: 72,
      toJSON: () => ({})
    });

    expect(getElementTransitionOrigin(button)).toEqual({ x: 156, y: 116, size: 72 });
  });

  it('uses the delete color and reveal phase for removal transitions', () => {
    render(
      <FullscreenTransition
        type="delete"
        phase="revealing"
        origin={{ x: 400, y: 240, size: 44 }}
      />
    );

    const overlay = screen.getByTestId('fullscreen-transition');
    expect(overlay).toHaveClass('fullscreen-transition-overlay--delete');
    expect(overlay).toHaveClass('fullscreen-transition-overlay--revealing');
  });
});
