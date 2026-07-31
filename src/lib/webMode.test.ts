import { describe, expect, it } from 'vitest';
import { getWebResourceDisplayName, isExternalWebResource } from './webMode';

describe('web mode resource helpers', () => {
  it('shows an external resource file name without exposing its internal reference', () => {
    const resource = 'web-external:abc123/%E4%B8%AD%E6%96%87.iso';
    expect(isExternalWebResource(resource)).toBe(true);
    expect(getWebResourceDisplayName(resource)).toBe('中文.iso');
  });
});
