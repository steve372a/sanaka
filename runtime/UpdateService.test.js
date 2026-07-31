import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_MANIFEST_URLS, UpdateService, compareVersions, detectUpdateChannel, isManifestCompatible } from './UpdateService';

describe('UpdateService helpers', () => {
  it('detects beta channel from version', () => {
    expect(detectUpdateChannel('0.0.1-beta')).toBe('beta');
    expect(detectUpdateChannel('0.0.1')).toBe('release');
  });

  it('compares release higher than beta prerelease', () => {
    expect(compareVersions('0.0.1', '0.0.1-beta')).toBeGreaterThan(0);
    expect(compareVersions('0.0.3-beta', '0.0.1')).toBeGreaterThan(0);
  });

  it('checks compatible channels', () => {
    expect(isManifestCompatible('release', 'release')).toBe(true);
    expect(isManifestCompatible('release', 'beta')).toBe(false);
    expect(isManifestCompatible('beta', 'beta')).toBe(true);
    expect(isManifestCompatible('beta', 'release')).toBe(true);
  });
});

describe('UpdateService', () => {
  it('uses repository raw manifests with a ghproxy fallback', () => {
    expect(DEFAULT_MANIFEST_URLS.beta).toEqual([
      'https://raw.githubusercontent.com/steve372a/sanaka/main/updates/beta.toml',
      'https://ghproxy.net/https://raw.githubusercontent.com/steve372a/sanaka/main/updates/beta.toml'
    ]);
    expect(DEFAULT_MANIFEST_URLS.release).toEqual([
      'https://raw.githubusercontent.com/steve372a/sanaka/main/updates/release.toml',
      'https://ghproxy.net/https://raw.githubusercontent.com/steve372a/sanaka/main/updates/release.toml'
    ]);
  });

  it('falls back to ghproxy when GitHub exceeds the request timeout', async () => {
    const fetchImpl = vi.fn((url, options = {}) => {
      if (url.startsWith('https://raw.githubusercontent.com/')) {
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => reject(new Error('request aborted')), { once: true });
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        text: async () => 'version = "0.0.4"\nchannel = "release"\nmandatory = false\npub_date = "2026-07-29"\nurl = "https://example.com/release"\nnotes = """\nrelease\n"""'
      });
    });
    const service = new UpdateService({
      appVersion: '0.0.3',
      loadSettings: vi.fn(async () => ({ updates: { skippedVersion: '' } })),
      saveSettings: vi.fn(async (value) => value),
      emitToRenderer: vi.fn(),
      openExternal: vi.fn(async () => ({ ok: true })),
      fetchImpl,
      manifestUrls: { release: DEFAULT_MANIFEST_URLS.release },
      requestTimeoutMs: 10
    });

    const result = await service.checkForUpdates({ silent: true });

    expect(result.hasUpdate).toBe(true);
    expect(result.latest?.version).toBe('0.0.4');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1][0]).toBe(DEFAULT_MANIFEST_URLS.release[1]);
  });

  it('falls back to ghproxy when GitHub returns an HTTP error', async () => {
    const fetchImpl = vi.fn(async (url) => url.startsWith('https://raw.githubusercontent.com/')
      ? { ok: false, status: 503, text: async () => '' }
      : {
          ok: true,
          status: 200,
          text: async () => 'version = "0.0.4"\nchannel = "release"\nmandatory = false\npub_date = "2026-07-29"\nurl = "https://example.com/release"\nnotes = """\nrelease\n"""'
        });
    const service = new UpdateService({
      appVersion: '0.0.3',
      loadSettings: vi.fn(async () => ({ updates: { skippedVersion: '' } })),
      saveSettings: vi.fn(async (value) => value),
      emitToRenderer: vi.fn(),
      openExternal: vi.fn(async () => ({ ok: true })),
      fetchImpl,
      manifestUrls: { release: DEFAULT_MANIFEST_URLS.release },
      requestTimeoutMs: 10
    });

    const result = await service.checkForUpdates({ silent: true });

    expect(result.hasUpdate).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('prefers newer release manifest for beta builds', async () => {
    const fetchImpl = vi.fn(async (url) => ({
      ok: true,
      status: 200,
      text: async () =>
        url.includes('beta')
          ? 'version = "0.0.3-beta"\nchannel = "beta"\nmandatory = false\npub_date = "2026-06-05"\nurl = "https://example.com/beta"\nnotes = """\nbeta\n"""'
          : 'version = "0.0.3"\nchannel = "release"\nmandatory = false\npub_date = "2026-06-05"\nurl = "https://example.com/release"\nnotes = """\nrelease\n"""'
    }));
    const emitToRenderer = vi.fn();
    const service = new UpdateService({
      appVersion: '0.0.1-beta',
      loadSettings: vi.fn(async () => ({ updates: { skippedVersion: '' } })),
      saveSettings: vi.fn(async (value) => value),
      emitToRenderer,
      openExternal: vi.fn(async () => ({ ok: true })),
      fetchImpl
    });

    const result = await service.checkForUpdates({ silent: true });
    expect(result.hasUpdate).toBe(true);
    expect(result.latest?.version).toBe('0.0.3');
    expect(emitToRenderer).toHaveBeenCalledWith('app:update-available', expect.objectContaining({ source: 'automatic' }));
  });

  it('suppresses automatic reminder for skipped version', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => 'version = "0.0.3"\nchannel = "release"\nmandatory = false\npub_date = "2026-06-05"\nurl = "https://example.com/release"\nnotes = """\nrelease\n"""'
    }));
    const emitToRenderer = vi.fn();
    const service = new UpdateService({
      appVersion: '0.0.1',
      loadSettings: vi.fn(async () => ({ updates: { skippedVersion: '0.0.3' } })),
      saveSettings: vi.fn(async (value) => value),
      emitToRenderer,
      openExternal: vi.fn(async () => ({ ok: true })),
      fetchImpl
    });

    const result = await service.checkForUpdates({ silent: true });
    expect(result.hasUpdate).toBe(true);
    expect(emitToRenderer).not.toHaveBeenCalled();
  });

  it('can override remote version for debug checks', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => 'version = "0.0.3"\nchannel = "release"\nmandatory = false\npub_date = "2026-06-05"\nurl = "https://example.com/release"\nnotes = """\nrelease\n"""'
    }));
    const service = new UpdateService({
      appVersion: '0.0.1',
      loadSettings: vi.fn(async () => ({ updates: { skippedVersion: '' } })),
      saveSettings: vi.fn(async (value) => value),
      emitToRenderer: vi.fn(),
      openExternal: vi.fn(async () => ({ ok: true })),
      fetchImpl,
      forcedRemoteVersion: '9.9.9'
    });

    const result = await service.checkForUpdates({ silent: true });
    expect(result.hasUpdate).toBe(true);
    expect(result.latest?.version).toBe('9.9.9');
  });
});
