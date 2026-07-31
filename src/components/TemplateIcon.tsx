import type { ReactNode } from 'react';
import windowsXpIcon from '../assets/template-icons/windows-xp.svg';
import windows98Icon from '../assets/template-icons/windows-98.svg';
import windows10Icon from '../assets/template-icons/windows-10.svg';
import linuxTuxIcon from '../assets/template-icons/linux-tux.png';

interface TemplateIconProps {
  templateKey: string;
  fallback?: ReactNode;
}

function getTemplateAsset(templateKey: string) {
  const key = templateKey.toLowerCase();
  if (key === 'winxp') return windowsXpIcon;
  if (key === 'win98') return windows98Icon;
  if (key === 'win11' || key === 'win10') return windows10Icon;
  if (key === 'linux' || key.includes('ubuntu') || key.includes('debian')) return linuxTuxIcon;
  return null;
}

export function TemplateIcon({ templateKey, fallback = null }: TemplateIconProps) {
  const asset = getTemplateAsset(templateKey);
  if (!asset) return fallback;

  return <img className="template-os-icon" src={asset} alt="" aria-hidden="true" />;
}
