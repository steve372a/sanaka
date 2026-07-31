import { describe, expect, it } from 'vitest';
import { applyAccentColor, getAccentPresetColor } from './accentColor';

describe('accent color presets', () => {
  it('exposes the muted preset colors used by the settings picker', () => {
    expect(getAccentPresetColor('purple')).toBe('#BCA0C9');
    expect(getAccentPresetColor('blue')).toBe('#88A8C5');
    expect(getAccentPresetColor('orange')).toBe('#C8A184');
    expect(getAccentPresetColor('white')).toBe('#5A5A5A');
    expect(getAccentPresetColor('green')).toBe('#85AA95');
  });

  it('applies the selected preset palette without changing custom color data', () => {
    const custom = {
      lightPrimary: '#123456',
      lightSurface: '#234567',
      darkPrimary: '#345678',
      darkSurface: '#456789'
    };

    applyAccentColor({ mode: 'preset', preset: 'purple', custom, templates: [] });

    expect(document.documentElement.style.getPropertyValue('--accent-light-primary')).toBe('#BCA0C9');
    expect(document.documentElement.style.getPropertyValue('--accent-light-primary-strong')).toBe('#B08DBD');
    expect(document.documentElement.style.getPropertyValue('--accent-light-primary-soft')).toBe('#F4EEF7');
    expect(document.documentElement.style.getPropertyValue('--accent-light-panel-muted')).toBe('#F5EFF7');
    expect(document.documentElement.style.getPropertyValue('--accent-dark-primary')).toBe('#D3ABF7');
    expect(custom).toEqual({
      lightPrimary: '#123456',
      lightSurface: '#234567',
      darkPrimary: '#345678',
      darkSurface: '#456789'
    });
  });
});
