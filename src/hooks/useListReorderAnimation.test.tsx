import { render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useListReorderAnimation } from './useListReorderAnimation';

function AnimatedList({ items }: { items: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useListReorderAnimation(ref, items);

  return (
    <div ref={ref}>
      {items.map((item) => (
        <div key={item} data-list-motion-key={item}>{item}</div>
      ))}
    </div>
  );
}

describe('useListReorderAnimation', () => {
  const animate = vi.fn();

  beforeEach(() => {
    document.documentElement.setAttribute('data-reduced-motion', 'false');
    animate.mockReset();
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      value: animate
    });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({ matches: false }))
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const parent = this.parentElement;
      const index = parent ? Array.from(parent.children).indexOf(this) : 0;
      return {
        x: 0,
        y: index * 48,
        top: index * 48,
        right: 200,
        bottom: index * 48 + 40,
        left: 0,
        width: 200,
        height: 40,
        toJSON: () => undefined
      };
    });
  });

  afterEach(() => {
    document.documentElement.setAttribute('data-reduced-motion', 'false');
    vi.restoreAllMocks();
  });

  it('moves existing items when their order changes', () => {
    const view = render(<AnimatedList items={['a', 'b']} />);
    view.rerender(<AnimatedList items={['b', 'a']} />);

    expect(animate).toHaveBeenCalledTimes(2);
    expect(animate).toHaveBeenCalledWith(
      [{ transform: 'translateY(48px)' }, { transform: 'translateY(0)' }],
      expect.objectContaining({ duration: 280 })
    );
  });

  it('fades in a newly inserted item', () => {
    const view = render(<AnimatedList items={['a']} />);
    view.rerender(<AnimatedList items={['new', 'a']} />);

    expect(animate).toHaveBeenCalledWith(
      [{ opacity: 0 }, { opacity: 1 }],
      expect.objectContaining({ duration: 220 })
    );
  });

  it('does not replay when a rerender keeps the same order', () => {
    const view = render(<AnimatedList items={['a', 'b']} />);
    view.rerender(<AnimatedList items={['a', 'b']} />);

    expect(animate).not.toHaveBeenCalled();
  });

  it('uses only opacity when reduced motion is enabled', () => {
    document.documentElement.setAttribute('data-reduced-motion', 'true');
    const view = render(<AnimatedList items={['a', 'b']} />);
    view.rerender(<AnimatedList items={['b', 'a']} />);

    expect(animate).toHaveBeenCalledTimes(2);
    expect(animate).toHaveBeenCalledWith(
      [{ opacity: 0 }, { opacity: 1 }],
      expect.objectContaining({ duration: 160 })
    );
    expect(JSON.stringify(animate.mock.calls)).not.toContain('transform');
  });
});
