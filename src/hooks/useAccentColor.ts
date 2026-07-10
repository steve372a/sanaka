import { useEffect } from 'react';
import { useAppStore } from '../store/AppStore';
import { applyAccentColor } from '../lib/accentColor';

export function useAccentColor() {
  const { settings } = useAppStore();

  useEffect(() => {
    applyAccentColor(settings.accentColor);
  }, [settings.accentColor]);
}
