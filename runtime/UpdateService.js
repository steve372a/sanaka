const { parse: parseToml } = require('smol-toml');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const UPDATE_CHANNELS = ['release', 'beta'];
const DEFAULT_STARTUP_DELAY_MS = 5_000;
const DEFAULT_CHECK_INTERVAL_MS = 8 * 60 * 60 * 1_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 5_000;
const GITHUB_RAW_BASE_URL = 'https://raw.githubusercontent.com/steve372a/sanaka/main/updates';
const GHPROXY_BASE_URL = 'https://ghproxy.net/';
const DEFAULT_DOWNLOAD_CONNECT_TIMEOUT_MS = 10_000;
const DEFAULT_MANIFEST_URLS = {
  release: [
    `${GITHUB_RAW_BASE_URL}/release.toml`,
    `${GHPROXY_BASE_URL}${GITHUB_RAW_BASE_URL}/release.toml`
  ],
  beta: [
    `${GITHUB_RAW_BASE_URL}/beta.toml`,
    `${GHPROXY_BASE_URL}${GITHUB_RAW_BASE_URL}/beta.toml`
  ]
};

function detectUpdateChannel(version) {
  return typeof version === 'string' && /beta/i.test(version) ? 'beta' : 'release';
}

function tokenizePreRelease(value) {
  if (!value) return [];
  return value.split('.').filter(Boolean).map((token) => (/^\d+$/.test(token) ? Number(token) : token.toLowerCase()));
}

function parseVersion(version) {
  const normalized = String(version || '').trim();
  const match = normalized.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) return null;
  return {
    raw: normalized,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    preRelease: tokenizePreRelease(match[4])
  };
}

function compareIdentifiers(left, right) {
  const leftIsNumber = typeof left === 'number';
  const rightIsNumber = typeof right === 'number';
  if (leftIsNumber && rightIsNumber) return left - right;
  if (leftIsNumber) return -1;
  if (rightIsNumber) return 1;
  return String(left).localeCompare(String(right));
}

function compareVersions(leftVersion, rightVersion) {
  const left = parseVersion(leftVersion);
  const right = parseVersion(rightVersion);
  if (!left || !right) {
    return String(leftVersion).localeCompare(String(rightVersion), undefined, { numeric: true, sensitivity: 'base' });
  }
  if (left.major !== right.major) return left.major - right.major;
  if (left.minor !== right.minor) return left.minor - right.minor;
  if (left.patch !== right.patch) return left.patch - right.patch;

  if (left.preRelease.length === 0 && right.preRelease.length === 0) return 0;
  if (left.preRelease.length === 0) return 1;
  if (right.preRelease.length === 0) return -1;

  const maxLength = Math.max(left.preRelease.length, right.preRelease.length);
  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = left.preRelease[index];
    const rightPart = right.preRelease[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    const diff = compareIdentifiers(leftPart, rightPart);
    if (diff !== 0) return diff;
  }
  return 0;
}

function normalizeManifest(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid update manifest.');
  }

  const version = typeof raw.version === 'string' ? raw.version.trim() : '';
  const channel = typeof raw.channel === 'string' ? raw.channel.trim().toLowerCase() : '';
  const url = typeof raw.url === 'string' ? raw.url.trim() : '';
  const notes = typeof raw.notes === 'string' ? raw.notes.trim() : '';

  if (!version) throw new Error('Update manifest is missing version.');
  if (!UPDATE_CHANNELS.includes(channel)) throw new Error('Update manifest has an unsupported channel.');
  if (!url) throw new Error('Update manifest is missing url.');
  if (!notes) throw new Error('Update manifest is missing notes.');

  const assets = Array.isArray(raw.assets)
    ? raw.assets.map((asset) => {
        const platform = typeof asset?.platform === 'string' ? asset.platform.trim() : '';
        const arch = typeof asset?.arch === 'string' ? asset.arch.trim() : '';
        const assetUrl = typeof asset?.url === 'string' ? asset.url.trim() : '';
        const fileName = typeof asset?.file_name === 'string' ? asset.file_name.trim() : '';
        const sha256 = typeof asset?.sha256 === 'string' ? asset.sha256.trim().toLowerCase() : '';
        if (!platform || !arch || !assetUrl || !fileName || !/^[a-f0-9]{64}$/.test(sha256)) {
          throw new Error('Update manifest contains an invalid asset.');
        }
        if (path.basename(fileName) !== fileName) {
          throw new Error('Update manifest contains an unsafe asset file name.');
        }
        return {
          platform,
          arch,
          url: assetUrl,
          fileName,
          sha256,
          size: Number.isFinite(asset.size) && asset.size > 0 ? Number(asset.size) : undefined
        };
      })
    : [];

  return {
    version,
    channel,
    mandatory: raw.mandatory === true,
    pubDate: typeof raw.pub_date === 'string' ? raw.pub_date.trim() : '',
    url,
    title: typeof raw.title === 'string' ? raw.title.trim() : '',
    notes,
    assets
  };
}

function isManifestCompatible(currentChannel, manifestChannel) {
  if (currentChannel === 'beta') {
    return manifestChannel === 'beta' || manifestChannel === 'release';
  }
  return manifestChannel === 'release';
}

class UpdateService {
  constructor(options) {
    this.appVersion = options.appVersion;
    this.loadSettings = options.loadSettings;
    this.saveSettings = options.saveSettings;
    this.emitToRenderer = options.emitToRenderer;
    this.openExternal = options.openExternal;
    this.downloadsDirectory = options.downloadsDirectory || '';
    this.platform = options.platform || process.platform;
    this.arch = options.arch || process.arch;
    this.emitDownloadProgress = options.emitDownloadProgress || (() => undefined);
    this.fetchImpl = options.fetchImpl || global.fetch;
    this.manifestUrls = options.manifestUrls || DEFAULT_MANIFEST_URLS;
    this.forcedRemoteVersion = typeof options.forcedRemoteVersion === 'string' ? options.forcedRemoteVersion.trim() : '';
    this.startupDelayMs = options.startupDelayMs ?? DEFAULT_STARTUP_DELAY_MS;
    this.checkIntervalMs = options.checkIntervalMs ?? DEFAULT_CHECK_INTERVAL_MS;
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.downloadConnectTimeoutMs = options.downloadConnectTimeoutMs ?? DEFAULT_DOWNLOAD_CONNECT_TIMEOUT_MS;
    this.currentChannel = detectUpdateChannel(this.appVersion);
    this.timer = null;
    this.interval = null;
    this.inFlight = null;
    this.pendingUpdate = null;
    this.downloadInFlight = null;
  }

  async getCurrentInfo() {
    const settings = await this.loadSettings();
    const skippedVersion = typeof settings?.updates?.skippedVersion === 'string' ? settings.updates.skippedVersion : '';
    return {
      currentVersion: this.appVersion,
      currentChannel: this.currentChannel,
      skippedVersion
    };
  }

  initialize() {
    this.dispose();
    this.timer = setTimeout(() => {
      void this.checkForUpdates({ silent: true });
      this.interval = setInterval(() => {
        void this.checkForUpdates({ silent: true });
      }, this.checkIntervalMs);
    }, this.startupDelayMs);
  }

  dispose() {
    if (this.timer) clearTimeout(this.timer);
    if (this.interval) clearInterval(this.interval);
    this.timer = null;
    this.interval = null;
  }

  async skipVersion(version) {
    const rawSettings = (await this.loadSettings()) || {};
    const nextSettings = {
      ...rawSettings,
      updates: {
        ...(rawSettings.updates || {}),
        skippedVersion: String(version || '').trim()
      }
    };
    await this.saveSettings(nextSettings);
    return { ok: true, skippedVersion: nextSettings.updates.skippedVersion };
  }

  async openUpdatePage(url) {
    await this.openExternal(url);
    return { ok: true };
  }

  async checkForUpdates({ silent = false } = {}) {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.#performCheck({ silent }).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  async downloadLatest({ force = false } = {}) {
    if (this.downloadInFlight) return this.downloadInFlight;
    this.downloadInFlight = this.#performDownload({ force: Boolean(force) }).finally(() => {
      this.downloadInFlight = null;
    });
    return this.downloadInFlight;
  }

  async #performDownload({ force }) {
    try {
      const manifests = await this.#loadCandidateManifests();
      const compatible = manifests
        .filter((manifest) => isManifestCompatible(this.currentChannel, manifest.channel))
        .sort((left, right) => compareVersions(right.version, left.version));
      const latest = compatible[0];

      if (!latest) {
        return { ok: false, code: 'MANIFEST_UNAVAILABLE', error: 'No compatible update manifest is available.' };
      }
      if (!force && compareVersions(latest.version, this.appVersion) <= 0) {
        return { ok: false, code: 'NO_UPDATE', version: latest.version };
      }

      const asset = latest.assets.find((candidate) => candidate.platform === this.platform && candidate.arch === this.arch);
      if (!asset) {
        return {
          ok: false,
          code: 'ASSET_UNAVAILABLE',
          version: latest.version,
          error: `No update package is available for ${this.platform}/${this.arch}.`
        };
      }
      if (!this.downloadsDirectory) {
        return { ok: false, code: 'DOWNLOAD_DIRECTORY_UNAVAILABLE', version: latest.version, error: 'The downloads directory is unavailable.' };
      }

      await fs.mkdir(this.downloadsDirectory, { recursive: true });
      const targetPath = await this.#findAvailableTargetPath(asset.fileName);
      const temporaryPath = `${targetPath}.part`;
      const urls = asset.url.startsWith('https://github.com/')
        ? [asset.url, `${GHPROXY_BASE_URL}${asset.url}`]
        : [asset.url];
      const failures = [];

      for (const url of urls) {
        try {
          const result = await this.#downloadAsset({ asset, latest, targetPath, temporaryPath, url });
          return result;
        } catch (error) {
          await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
          failures.push(error instanceof Error ? error.message : String(error));
        }
      }

      const error = failures.join(' | ') || 'The update package could not be downloaded.';
      this.emitDownloadProgress({
        status: 'failed',
        version: latest.version,
        fileName: asset.fileName,
        receivedBytes: 0,
        totalBytes: asset.size || 0,
        percent: 0,
        error
      });
      return { ok: false, code: 'DOWNLOAD_FAILED', version: latest.version, error };
    } catch (error) {
      return {
        ok: false,
        code: 'DOWNLOAD_FAILED',
        error: error instanceof Error ? error.message : 'The update package could not be downloaded.'
      };
    }
  }

  async #findAvailableTargetPath(fileName) {
    const parsed = path.parse(fileName);
    for (let index = 0; ; index += 1) {
      const suffix = index === 0 ? '' : ` (${index})`;
      const candidate = path.join(this.downloadsDirectory, `${parsed.name}${suffix}${parsed.ext}`);
      try {
        await fs.access(candidate);
      } catch (error) {
        if (error?.code === 'ENOENT') return candidate;
        throw error;
      }
    }
  }

  async #downloadAsset({ asset, latest, targetPath, temporaryPath, url }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.downloadConnectTimeoutMs);
    let response;
    try {
      response = await this.fetchImpl(url, {
        headers: { 'cache-control': 'no-cache' },
        redirect: 'follow',
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok || !response.body) {
      throw new Error(`${url}: HTTP ${response.status}`);
    }

    const responseLength = Number(response.headers?.get?.('content-length')) || 0;
    const totalBytes = asset.size || responseLength;
    let receivedBytes = 0;
    const hash = crypto.createHash('sha256');
    const file = await fs.open(temporaryPath, 'w');
    const reader = response.body.getReader();

    this.emitDownloadProgress({
      status: 'downloading',
      version: latest.version,
      fileName: asset.fileName,
      receivedBytes,
      totalBytes,
      percent: 0
    });

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await file.write(value);
        hash.update(value);
        receivedBytes += value.byteLength;
        this.emitDownloadProgress({
          status: 'downloading',
          version: latest.version,
          fileName: asset.fileName,
          receivedBytes,
          totalBytes,
          percent: totalBytes > 0 ? Math.min(100, Math.round((receivedBytes / totalBytes) * 100)) : 0
        });
      }
    } finally {
      await file.close();
      reader.releaseLock();
    }

    const digest = hash.digest('hex');
    if (digest !== asset.sha256) {
      throw new Error(`${url}: SHA-256 mismatch`);
    }
    await fs.rename(temporaryPath, targetPath);
    const result = {
      ok: true,
      version: latest.version,
      fileName: path.basename(targetPath),
      path: targetPath,
      receivedBytes
    };
    this.emitDownloadProgress({
      status: 'completed',
      version: latest.version,
      fileName: result.fileName,
      receivedBytes,
      totalBytes: totalBytes || receivedBytes,
      percent: 100,
      path: targetPath
    });
    return result;
  }

  async #performCheck({ silent }) {
    const settings = (await this.loadSettings()) || {};
    const skippedVersion = typeof settings?.updates?.skippedVersion === 'string' ? settings.updates.skippedVersion : '';

    try {
      const manifests = await this.#loadCandidateManifests();
      const compatible = manifests
        .filter((manifest) => isManifestCompatible(this.currentChannel, manifest.channel))
        .sort((left, right) => compareVersions(right.version, left.version));

      const latest = compatible[0];
      const hasUpdate = Boolean(latest) && compareVersions(latest.version, this.appVersion) > 0;

      const result = {
        currentVersion: this.appVersion,
        currentChannel: this.currentChannel,
        latest: hasUpdate ? latest : undefined,
        hasUpdate,
        skippedVersion
      };

      if (hasUpdate && latest) {
        this.pendingUpdate = latest;
        const shouldNotify = !silent || latest.version !== skippedVersion;
        if (shouldNotify) {
          this.emitToRenderer('app:update-available', {
            source: silent ? 'automatic' : 'manual',
            manifest: latest,
            currentVersion: this.appVersion,
            currentChannel: this.currentChannel,
            skippedVersion
          });
        }
      }

      return result;
    } catch (error) {
      return {
        currentVersion: this.appVersion,
        currentChannel: this.currentChannel,
        latest: undefined,
        hasUpdate: false,
        skippedVersion,
        error: error instanceof Error ? error.message : 'Could not check for updates.'
      };
    }
  }

  async #loadCandidateManifests() {
    const channelsToCheck = this.currentChannel === 'beta' ? ['beta', 'release'] : ['release'];
    const results = await Promise.all(
      channelsToCheck.map(async (channel) => {
        const text = await this.#fetchManifestText(channel);
        const manifest = normalizeManifest(parseToml(text));
        if (this.forcedRemoteVersion) {
          return {
            ...manifest,
            version: this.forcedRemoteVersion
          };
        }
        return manifest;
      })
    );
    return results.filter(Boolean);
  }

  async #fetchManifestText(channel) {
    const configured = this.manifestUrls[channel];
    const urls = Array.isArray(configured) ? configured : [configured];
    const failures = [];

    for (const url of urls.filter(Boolean)) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs);
      try {
        const response = await this.fetchImpl(url, {
          headers: { 'cache-control': 'no-cache' },
          signal: controller.signal
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return await response.text();
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        failures.push(`${url}: ${reason}`);
      } finally {
        clearTimeout(timer);
      }
    }

    throw new Error(`Update source for ${channel} is unavailable. ${failures.join(' | ')}`);
  }
}

module.exports = {
  UpdateService,
  DEFAULT_MANIFEST_URLS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_DOWNLOAD_CONNECT_TIMEOUT_MS,
  compareVersions,
  detectUpdateChannel,
  normalizeManifest,
  isManifestCompatible
};
