import type { AppSettings } from '../domain/schemas';

export type AccentColor = AppSettings['accentColor'];

interface ColorPalette {
  lightPrimary: string;
  lightPrimaryStrong: string;
  lightPrimarySoft: string;
  lightSurface: string;
  lightPanel: string;
  lightPanelSoft: string;
  lightPanelMuted: string;
  lightBg: string;
  darkPrimary: string;
  darkPrimaryStrong: string;
  darkPrimarySoft: string;
  darkSurface: string;
  darkPanel: string;
  darkPanelSoft: string;
  darkPanelMuted: string;
  darkBg: string;
}

const PRESET_PALETTES: Record<AccentColor['preset'], ColorPalette> = {
  purple: {
    lightPrimary: '#BCA0C9',
    lightPrimaryStrong: '#B08DBD',
    lightPrimarySoft: '#F4EEF7',
    lightSurface: '#FAF7FB',
    lightPanel: '#FCFAFD',
    lightPanelSoft: '#F6F0F9',
    lightPanelMuted: '#F5EFF7',
    lightBg: '#FDFCFE',
    darkPrimary: '#D3ABF7',
    darkPrimaryStrong: '#E5C7FA',
    darkPrimarySoft: '#7D58AF',
    darkSurface: '#2E223C',
    darkPanel: '#261D33',
    darkPanelSoft: '#322643',
    darkPanelMuted: '#3D2F4E',
    darkBg: '#1B1423'
  },
  blue: {
    lightPrimary: '#88A8C5',
    lightPrimaryStrong: '#7696B2',
    lightPrimarySoft: '#EFF5FA',
    lightSurface: '#F8FBFD',
    lightPanel: '#FBFCFE',
    lightPanelSoft: '#F1F6FA',
    lightPanelMuted: '#EFF4F8',
    lightBg: '#FDFEFF',
    darkPrimary: '#77ACE7',
    darkPrimaryStrong: '#9BC2EE',
    darkPrimarySoft: '#5B95D3',
    darkSurface: '#1A2535',
    darkPanel: '#18202C',
    darkPanelSoft: '#212D3D',
    darkPanelMuted: '#2A3749',
    darkBg: '#131820'
  },
  orange: {
    lightPrimary: '#C8A184',
    lightPrimaryStrong: '#B58E72',
    lightPrimarySoft: '#FBF4EF',
    lightSurface: '#FDF9F6',
    lightPanel: '#FEFCFA',
    lightPanelSoft: '#FAF2EC',
    lightPanelMuted: '#FAF4EF',
    lightBg: '#FFFEFD',
    darkPrimary: '#E49D63',
    darkPrimaryStrong: '#ECB78F',
    darkPrimarySoft: '#CB824E',
    darkSurface: '#31261F',
    darkPanel: '#281E18',
    darkPanelSoft: '#392B22',
    darkPanelMuted: '#47362B',
    darkBg: '#201813'
  },
  white: {
    lightPrimary: '#C5C9CF',
    lightPrimaryStrong: '#A9AFB7',
    lightPrimarySoft: '#F1F3F5',
    lightSurface: '#FCFCFD',
    lightPanel: '#FFFFFF',
    lightPanelSoft: '#F5F6F8',
    lightPanelMuted: '#E9EBEE',
    lightBg: '#FFFFFF',
    darkPrimary: '#B8BCC2',
    darkPrimaryStrong: '#D0D4D9',
    darkPrimarySoft: '#707780',
    darkSurface: '#30343A',
    darkPanel: '#272B30',
    darkPanelSoft: '#383D43',
    darkPanelMuted: '#454B52',
    darkBg: '#202429'
  },
  green: {
    lightPrimary: '#85AA95',
    lightPrimaryStrong: '#739981',
    lightPrimarySoft: '#EFF6F1',
    lightSurface: '#F8FCF9',
    lightPanel: '#FBFDFB',
    lightPanelSoft: '#F1F7F3',
    lightPanelMuted: '#EFF5F0',
    lightBg: '#FDFFFE',
    darkPrimary: '#5ECA8C',
    darkPrimaryStrong: '#83D9A7',
    darkPrimarySoft: '#46B374',
    darkSurface: '#17241E',
    darkPanel: '#16241D',
    darkPanelSoft: '#1D3028',
    darkPanelMuted: '#263D32',
    darkBg: '#0E1913'
  }
};

function derivePalette(custom: AccentColor['custom']): ColorPalette {
  return {
    lightPrimary: custom.lightPrimary,
    lightPrimaryStrong: custom.lightPrimary,
    lightPrimarySoft: custom.lightPrimary,
    lightSurface: custom.lightSurface,
    lightPanel: custom.lightSurface,
    lightPanelSoft: custom.lightSurface,
    lightPanelMuted: custom.lightSurface,
    lightBg: custom.lightSurface,
    darkPrimary: custom.darkPrimary,
    darkPrimaryStrong: custom.darkPrimary,
    darkPrimarySoft: custom.darkPrimary,
    darkSurface: custom.darkSurface,
    darkPanel: custom.darkSurface,
    darkPanelSoft: custom.darkSurface,
    darkPanelMuted: custom.darkSurface,
    darkBg: custom.darkSurface
  };
}

function getPalette(accentColor: AccentColor): ColorPalette {
  if (accentColor.mode === 'preset') {
    return PRESET_PALETTES[accentColor.preset];
  }
  return derivePalette(accentColor.custom);
}

export function getAccentPresetColor(preset: AccentColor['preset']): string {
  return PRESET_PALETTES[preset].lightPrimary;
}

export function applyAccentColor(accentColor: AccentColor): void {
  if (typeof document === 'undefined') return;
  const palette = getPalette(accentColor);
  const root = document.documentElement;

  // Light theme accent variables
  root.style.setProperty('--accent-light-primary', palette.lightPrimary);
  root.style.setProperty('--accent-light-primary-strong', palette.lightPrimaryStrong);
  root.style.setProperty('--accent-light-primary-soft', palette.lightPrimarySoft);
  root.style.setProperty('--accent-light-surface', palette.lightSurface);
  root.style.setProperty('--accent-light-panel', palette.lightPanel);
  root.style.setProperty('--accent-light-panel-soft', palette.lightPanelSoft);
  root.style.setProperty('--accent-light-panel-muted', palette.lightPanelMuted);
  root.style.setProperty('--accent-light-bg', palette.lightBg);

  // Dark theme accent variables
  root.style.setProperty('--accent-dark-primary', palette.darkPrimary);
  root.style.setProperty('--accent-dark-primary-strong', palette.darkPrimaryStrong);
  root.style.setProperty('--accent-dark-primary-soft', palette.darkPrimarySoft);
  root.style.setProperty('--accent-dark-surface', palette.darkSurface);
  root.style.setProperty('--accent-dark-panel', palette.darkPanel);
  root.style.setProperty('--accent-dark-panel-soft', palette.darkPanelSoft);
  root.style.setProperty('--accent-dark-panel-muted', palette.darkPanelMuted);
  root.style.setProperty('--accent-dark-bg', palette.darkBg);
}

export function clearAccentColorOverrides(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const vars = [
    '--accent-light-primary', '--accent-light-primary-strong', '--accent-light-primary-soft',
    '--accent-light-surface', '--accent-light-panel', '--accent-light-panel-soft',
    '--accent-light-panel-muted', '--accent-light-bg',
    '--accent-dark-primary', '--accent-dark-primary-strong', '--accent-dark-primary-soft',
    '--accent-dark-surface', '--accent-dark-panel', '--accent-dark-panel-soft',
    '--accent-dark-panel-muted', '--accent-dark-bg'
  ];
  vars.forEach((v) => root.style.removeProperty(v));
}
