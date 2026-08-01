import type { AppSettings } from '../domain/schemas';
import { useT } from '../hooks/useT';
import { getAccentPresetColor } from '../lib/accentColor';

export type AccentColor = AppSettings['accentColor'];

interface AccentColorPickerProps {
  value: AccentColor;
  onChange: (next: AccentColor) => void;
  onOpenCustom: () => void;
}

const PRESETS: Array<{ key: AccentColor['preset']; color: string }> = [
  { key: 'purple', color: getAccentPresetColor('purple') },
  { key: 'blue', color: getAccentPresetColor('blue') },
  { key: 'orange', color: getAccentPresetColor('orange') },
  { key: 'white', color: getAccentPresetColor('white') },
  { key: 'green', color: getAccentPresetColor('green') }
];

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export function AccentColorPicker({ value, onChange, onOpenCustom }: AccentColorPickerProps) {
  const t = useT();

  return (
    <div className="accent-color-picker" role="radiogroup" aria-label={t('settings.accentColor')}>
      {PRESETS.map((preset) => {
        const selected = value.mode === 'preset' && value.preset === preset.key;
        return (
          <button
            key={preset.key}
            type="button"
            className={`accent-color-picker__swatch ${selected ? 'accent-color-picker__swatch--selected' : ''}`}
            style={{ backgroundColor: preset.color }}
            onClick={() => onChange({ ...value, mode: 'preset', preset: preset.key })}
            aria-label={preset.key}
            aria-checked={selected ? 'true' : 'false'}
            role="radio"
          />
        );
      })}
      <button
        type="button"
        className={`accent-color-picker__swatch accent-color-picker__swatch--custom ${value.mode === 'custom' ? 'accent-color-picker__swatch--selected' : ''}`}
        onClick={onOpenCustom}
        aria-label={t('settings.accentColorCustom')}
        title={t('settings.accentColorCustom')}
      >
        <PlusIcon />
      </button>
    </div>
  );
}
