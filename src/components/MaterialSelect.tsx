import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

export type MaterialSelectOption<T extends string> = {
  value: T;
  label: string;
};

export function MaterialSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  rawValues = false
}: {
  label: string;
  value: T;
  options: ReadonlyArray<MaterialSelectOption<T>>;
  onChange: (value: T) => void;
  rawValues?: boolean;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const [menuDirection, setMenuDirection] = useState<'down' | 'up'>('down');
  const selected = options[selectedIndex] ?? options[0];

  const updateMenuPosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const margin = 12;
    const gap = 8;
    const preferredHeight = Math.min(280, Math.max(48, options.length * 48 + 16));
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const opensUp = spaceBelow < preferredHeight && spaceAbove > spaceBelow;
    const maxHeight = Math.max(96, Math.min(preferredHeight, opensUp ? spaceAbove - gap : spaceBelow - gap));
    const width = Math.min(rect.width, window.innerWidth - margin * 2);
    const left = Math.min(Math.max(margin, rect.left), window.innerWidth - width - margin);

    setMenuDirection(opensUp ? 'up' : 'down');
    setMenuStyle({
      left,
      width,
      maxHeight,
      top: opensUp ? undefined : rect.bottom + gap,
      bottom: opensUp ? window.innerHeight - rect.top + gap : undefined
    });
  }, [options.length]);

  const closeMenu = () => {
    if (!open || closing) return;
    setClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 150);
  };

  const openMenu = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setActiveIndex(selectedIndex);
    setClosing(false);
    updateMenuPosition();
    setOpen(true);
  };

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        closeMenu();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    updateMenuPosition();
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [closing, open, updateMenuPosition]);

  const moveActive = (direction: 1 | -1) => {
    const nextIndex = (activeIndex + direction + options.length) % options.length;
    setActiveIndex(nextIndex);
  };

  const choose = (nextValue: T) => {
    onChange(nextValue);
    closeMenu();
  };

  const menu = open ? (
    <div
      ref={menuRef}
      className={[
        'material-select__menu',
        menuDirection === 'up' ? 'material-select__menu--up' : '',
        closing ? 'material-select__menu--closing' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      id={`${id}-listbox`}
      role="listbox"
      aria-label={label}
      style={menuStyle}
    >
      {options.map((option, index) => (
        <button
          key={option.value}
          id={`${id}-option-${index}`}
          className={[
            'material-select__option',
            option.value === value ? 'material-select__option--selected' : '',
            index === activeIndex ? 'material-select__option--active' : ''
          ]
            .filter(Boolean)
            .join(' ')}
          type="button"
          role="option"
          aria-selected={option.value === value}
          tabIndex={-1}
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => choose(option.value)}
        >
          <span className="material-select__check" aria-hidden="true">
            {option.value === value ? '✓' : ''}
          </span>
          <span>{rawValues ? option.value : option.label}</span>
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div className="material-select" ref={rootRef}>
      <button
        ref={anchorRef}
        className={open ? 'material-select__anchor material-select__anchor--open' : 'material-select__anchor'}
        type="button"
        aria-controls={open ? `${id}-listbox` : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={label}
        aria-activedescendant={open ? `${id}-option-${activeIndex}` : undefined}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (!open) {
              openMenu();
              return;
            }
            moveActive(1);
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open) {
              openMenu();
              return;
            }
            moveActive(-1);
          }
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (!open) {
              openMenu();
              return;
            }
            choose(options[activeIndex]?.value ?? value);
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            closeMenu();
          }
          if (event.key === 'Tab') {
            closeMenu();
          }
        }}
      >
        <span>{rawValues ? selected?.value ?? value : selected?.label ?? value}</span>
        <svg className="material-select__chevron" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m7 10 5 5 5-5" />
        </svg>
      </button>

      {menu ? createPortal(menu, document.body) : null}
    </div>
  );
}

export function MaterialSelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
  rawValues = false
}: {
  label: string;
  value: T;
  options: ReadonlyArray<MaterialSelectOption<T>>;
  onChange: (value: T) => void;
  hint?: string;
  rawValues?: boolean;
}) {
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <MaterialSelect label={label} value={value} options={options} onChange={onChange} rawValues={rawValues} />
      {hint ? <span className="field__hint">{hint}</span> : null}
    </div>
  );
}
