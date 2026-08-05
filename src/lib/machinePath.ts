const MACHINE_CONFIG_NAME = 'machine.svm';

export function normalizeMachinePathIdentity(value: string | null | undefined): string {
  if (!value) return '';

  let normalized = value.trim().replace(/\\/g, '/').replace(/\/+$/g, '');
  if (normalized.toLowerCase().endsWith(`/${MACHINE_CONFIG_NAME}`)) {
    normalized = normalized.slice(0, -(MACHINE_CONFIG_NAME.length + 1)).replace(/\/+$/g, '');
  }

  if (/^[a-z]:\//i.test(normalized) || normalized.startsWith('//')) {
    return normalized.toLowerCase();
  }
  return normalized;
}

export function isSameMachinePath(left: string | null | undefined, right: string | null | undefined): boolean {
  const normalizedLeft = normalizeMachinePathIdentity(left);
  const normalizedRight = normalizeMachinePathIdentity(right);
  return normalizedLeft.length > 0 && normalizedLeft === normalizedRight;
}
