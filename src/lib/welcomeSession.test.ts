import { describe, expect, it } from 'vitest';
import { shouldShowWelcomeForVersion } from './welcomeSession';

describe('shouldShowWelcomeForVersion', () => {
  it('keeps the welcome dialog hidden for the dismissed version', () => {
    expect(shouldShowWelcomeForVersion('0.0.4-beta', '0.0.4-beta')).toBe(false);
  });

  it('shows the welcome dialog again after an upgrade', () => {
    expect(shouldShowWelcomeForVersion('0.0.4-beta', '0.0.5-beta')).toBe(true);
  });
});
