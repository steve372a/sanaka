import { describe, expect, it } from 'vitest';
import { defaultSettings } from './defaults';
import { appSettingsSchema } from './schemas';

describe('appSettingsSchema experimental defaults', () => {
  it('keeps web mode disabled for settings saved before the opt-in existed', () => {
    const legacySettings = structuredClone(defaultSettings);
    delete (legacySettings.experimental as Partial<typeof legacySettings.experimental>).webMode;

    expect(appSettingsSchema.parse(legacySettings).experimental.webMode).toBe(false);
  });

  it('keeps raw QEMU values disabled for settings saved before the opt-in existed', () => {
    const legacySettings = structuredClone(defaultSettings);
    delete (legacySettings.experimental as Partial<typeof legacySettings.experimental>).rawQemuValues;

    expect(appSettingsSchema.parse(legacySettings).experimental.rawQemuValues).toBe(false);
  });

  it('keeps reduced motion disabled for older settings', () => {
    const legacySettings = structuredClone(defaultSettings);
    delete (legacySettings as Partial<typeof legacySettings>).reduceMotion;

    expect(appSettingsSchema.parse(legacySettings).reduceMotion).toBe(false);
  });

  it('shows the welcome video for older settings', () => {
    const legacySettings = structuredClone(defaultSettings);
    delete (legacySettings as Partial<typeof legacySettings>).showWelcomeOnStartup;
    delete (legacySettings as Partial<typeof legacySettings>).welcomeDismissedVersion;

    const parsed = appSettingsSchema.parse(legacySettings);
    expect(parsed.showWelcomeOnStartup).toBe(true);
    expect(parsed.welcomeDismissedVersion).toBe('');
  });
});
