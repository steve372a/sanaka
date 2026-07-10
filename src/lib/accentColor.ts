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
    lightPrimary: '#C678FF',
    lightPrimaryStrong: '#A84FE8',
    lightPrimarySoft: '#E6CFFF',
    lightSurface: '#F7EFFF',
    lightPanel: '#FAF5FF',
    lightPanelSoft: '#F3E6FF',
    lightPanelMuted: '#EBD9FF',
    lightBg: '#FCF8FF',
    darkPrimary: '#D4A3FF',
    darkPrimaryStrong: '#E6C2FF',
    darkPrimarySoft: '#7C4FB8',
    darkSurface: '#2E1F3F',
    darkPanel: '#261A36',
    darkPanelSoft: '#322346',
    darkPanelMuted: '#3D2B52',
    darkBg: '#1B1225'
  },
  blue: {
    lightPrimary: '#4A90E2',
    lightPrimaryStrong: '#2F6DB3',
    lightPrimarySoft: '#7CAEEA',
    lightSurface: '#F0F6FC',
    lightPanel: '#EBF4FD',
    lightPanelSoft: '#E1EEFB',
    lightPanelMuted: '#D3E5F7',
    lightBg: '#FAFCFF',
    darkPrimary: '#6BABF3',
    darkPrimaryStrong: '#92C1F7',
    darkPrimarySoft: '#4E94E0',
    darkSurface: '#172538',
    darkPanel: '#161F2E',
    darkPanelSoft: '#1E2C40',
    darkPanelMuted: '#26364D',
    darkBg: '#111822'
  },
  orange: {
    lightPrimary: '#E67E22',
    lightPrimaryStrong: '#B56217',
    lightPrimarySoft: '#EEA55B',
    lightSurface: '#FDF7F2',
    lightPanel: '#FDF1E7',
    lightPanelSoft: '#FBE9DB',
    lightPanelMuted: '#F7DEC9',
    lightBg: '#FFFCFA',
    darkPrimary: '#F29C55',
    darkPrimaryStrong: '#F6B685',
    darkPrimarySoft: '#D98040',
    darkSurface: '#33251D',
    darkPanel: '#2A1E16',
    darkPanelSoft: '#3B2A20',
    darkPanelMuted: '#4A3528',
    darkBg: '#211812'
  },
  white: {
    lightPrimary: '#5A5A5A',
    lightPrimaryStrong: '#3D3D3D',
    lightPrimarySoft: '#8A8A8A',
    lightSurface: '#F7F7F7',
    lightPanel: '#F5F5F5',
    lightPanelSoft: '#EFEFEF',
    lightPanelMuted: '#E5E5E5',
    lightBg: '#FFFFFF',
    darkPrimary: '#9E9E9E',
    darkPrimaryStrong: '#C2C2C2',
    darkPrimarySoft: '#7A7A7A',
    darkSurface: '#1A1A1A',
    darkPanel: '#121212',
    darkPanelSoft: '#1E1E1E',
    darkPanelMuted: '#262626',
    darkBg: '#0D0D0D'
  },
  green: {
    lightPrimary: '#27AE60',
    lightPrimaryStrong: '#1C7A44',
    lightPrimarySoft: '#5BCA88',
    lightSurface: '#F0FAF4',
    lightPanel: '#E9F7EF',
    lightPanelSoft: '#DFF2E6',
    lightPanelMuted: '#CEEDD8',
    lightBg: '#FAFFFC',
    darkPrimary: '#52D68A',
    darkPrimaryStrong: '#7AE2A5',
    darkPrimarySoft: '#3ABF72',
    darkSurface: '#15261E',
    darkPanel: '#14261D',
    darkPanelSoft: '#1B3228',
    darkPanelMuted: '#234032',
    darkBg: '#0D1A13'
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
