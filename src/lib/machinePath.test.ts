import { describe, expect, it } from 'vitest';
import { isSameMachinePath, normalizeMachinePathIdentity } from './machinePath';

describe('machine path identity', () => {
  it('treats Windows separators, drive casing, and machine.svm as the same bundle', () => {
    expect(isSameMachinePath(
      'D:\\Virtual Machines\\Linux.saka',
      'd:/Virtual Machines/Linux.saka/machine.svm'
    )).toBe(true);
  });

  it('keeps case sensitivity for POSIX paths', () => {
    expect(isSameMachinePath('/Users/test/Linux.saka', '/Users/test/linux.saka')).toBe(false);
  });

  it('normalizes a trailing separator without accepting empty paths', () => {
    expect(normalizeMachinePathIdentity('D:\\VMs\\Linux\\')).toBe('d:/vms/linux');
    expect(isSameMachinePath('', '')).toBe(false);
  });
});
