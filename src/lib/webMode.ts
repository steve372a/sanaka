export const WEB_MACHINE_PREFIX = 'web-machine:';
export const WEB_EXTERNAL_PREFIX = 'web-external:';
export const WEB_RESTRICTION_EVENT = 'sanaka:web-restriction';

export function isWebMode() {
  return window.sanakaWebAPI?.isWebMode === true;
}

export function isWebMachineRef(value: string | null | undefined) {
  return typeof value === 'string' && value.startsWith(WEB_MACHINE_PREFIX);
}

export function isExternalWebResource(value: string | null | undefined) {
  return typeof value === 'string' && value.startsWith(WEB_EXTERNAL_PREFIX);
}

export function getWebResourceDisplayName(value: string | null | undefined) {
  if (!value) return '';
  if (!isExternalWebResource(value)) return value.split(/[/\\]/).pop() || value;
  const encodedName = value.slice(value.indexOf('/') + 1);
  try {
    return decodeURIComponent(encodedName) || 'External file';
  } catch {
    return encodedName || 'External file';
  }
}

export function showWebModificationNotice(message = '网页版不能修改主机外部文件，请使用桌面版操作。') {
  window.dispatchEvent(new CustomEvent(WEB_RESTRICTION_EVENT, {
    detail: { message }
  }));
}
