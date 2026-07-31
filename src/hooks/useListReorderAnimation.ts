import { useLayoutEffect, useRef, type RefObject } from 'react';

const LIST_ITEM_SELECTOR = '[data-list-motion-key]';

export function useListReorderAnimation(
  containerRef: RefObject<HTMLElement | null>,
  itemKeys: readonly string[],
  disabled = false
) {
  const previousRectsRef = useRef(new Map<string, DOMRect>());
  const initializedRef = useRef(false);
  const activeAnimationsRef = useRef<Animation[]>([]);
  const skipNextAnimationRef = useRef(false);
  const orderSignature = JSON.stringify(itemKeys);

  if (disabled) {
    skipNextAnimationRef.current = true;
  }

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    for (const animation of activeAnimationsRef.current) {
      try {
        animation.finish();
      } catch {
        animation.cancel();
      }
    }
    activeAnimationsRef.current = [];

    const elements = Array.from(container.querySelectorAll<HTMLElement>(LIST_ITEM_SELECTOR));
    const nextRects = new Map<string, DOMRect>();

    for (const element of elements) {
      const key = element.dataset.listMotionKey;
      if (key) nextRects.set(key, element.getBoundingClientRect());
    }

    const reduceMotion =
      document.documentElement.getAttribute('data-reduced-motion') === 'true' ||
      (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
    const shouldAnimate = initializedRef.current && !skipNextAnimationRef.current;
    skipNextAnimationRef.current = false;

    if (shouldAnimate) {
      for (const element of elements) {
        const key = element.dataset.listMotionKey;
        if (!key) continue;
        if (typeof element.animate !== 'function') continue;

        const previousRect = previousRectsRef.current.get(key);
        const nextRect = nextRects.get(key);
        if (!nextRect) continue;

        if (reduceMotion) {
          const positionChanged = !previousRect || Math.abs(previousRect.top - nextRect.top) >= 1;
          if (!positionChanged) continue;
          const animation = element.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: 160,
            easing: 'ease-out'
          });
          if (animation) activeAnimationsRef.current.push(animation);
          continue;
        }

        if (!previousRect) {
          const animation = element.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: 220,
            easing: 'ease-out'
          });
          if (animation) activeAnimationsRef.current.push(animation);
          continue;
        }

        const offsetY = previousRect.top - nextRect.top;
        if (Math.abs(offsetY) < 1) continue;

        const animation = element.animate(
          [{ transform: `translateY(${offsetY}px)` }, { transform: 'translateY(0)' }],
          {
            duration: 280,
            easing: 'cubic-bezier(0.2, 0, 0, 1)'
          }
        );
        if (animation) activeAnimationsRef.current.push(animation);
      }
    }

    previousRectsRef.current = nextRects;
    initializedRef.current = true;
  }, [orderSignature]);
}
