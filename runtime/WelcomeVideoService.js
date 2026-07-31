const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const REPOSITORY = 'https://github.com/steve372a/sanaka';

function releaseTagForVersion(version) {
  const normalized = String(version || '').trim();
  return /-beta$/i.test(normalized)
    ? `v${normalized.slice(0, -5)}(beta)`
    : `v${normalized}`;
}

function videoFileNameForVersion(version) {
  return `${String(version || '').trim()}.mp4`;
}

function releaseUrlForVersion(version) {
  return `${REPOSITORY}/releases/download/${releaseTagForVersion(version)}/${videoFileNameForVersion(version)}`;
}

class WelcomeVideoService {
  constructor(options = {}) {
    this.version = String(options.version || '').trim();
    this.repoRoot = options.repoRoot || process.cwd();
    this.resourcesPath = options.resourcesPath || process.resourcesPath;
    this.userDataPath = options.userDataPath || null;
    this.isPackaged = options.isPackaged === true;
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
  }

  get fileName() {
    return videoFileNameForVersion(this.version);
  }

  get releaseTag() {
    return releaseTagForVersion(this.version);
  }

  get releaseUrl() {
    return releaseUrlForVersion(this.version);
  }

  get localDevelopmentPath() {
    return path.join(this.repoRoot, 'video', this.fileName);
  }

  get bundledPath() {
    return path.join(this.resourcesPath || '', 'video', this.fileName);
  }

  get cachePath() {
    return this.userDataPath ? path.join(this.userDataPath, 'video', this.fileName) : null;
  }

  async resolve() {
    const candidates = [];
    if (!this.isPackaged) candidates.push({ path: this.localDevelopmentPath, source: 'development' });
    candidates.push({ path: this.bundledPath, source: 'bundled' });
    if (this.cachePath) candidates.push({ path: this.cachePath, source: 'cache' });

    for (const candidate of candidates) {
      if (await this.isUsableFile(candidate.path)) {
        return { ...candidate, version: this.version, fileName: this.fileName };
      }
    }

    if (!this.cachePath || typeof this.fetchImpl !== 'function') return null;
    await this.downloadToCache();
    if (!(await this.isUsableFile(this.cachePath))) return null;
    return { path: this.cachePath, source: 'downloaded', version: this.version, fileName: this.fileName };
  }

  async isUsableFile(filePath) {
    if (!filePath) return false;
    try {
      const stat = await fs.stat(filePath);
      return stat.isFile() && stat.size > 0;
    } catch {
      return false;
    }
  }

  async downloadToCache() {
    const targetPath = this.cachePath;
    if (!targetPath) throw new Error('Welcome video cache is unavailable.');
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    const temporaryPath = `${targetPath}.part-${randomUUID()}`;
    try {
      const response = await this.fetchImpl(this.releaseUrl, { redirect: 'follow' });
      if (!response?.ok) {
        throw new Error(`Welcome video download failed with HTTP ${response?.status || 'unknown'}.`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length === 0) throw new Error('Welcome video download returned an empty file.');
      await fs.writeFile(temporaryPath, bytes, { flag: 'wx' });
      await fs.rename(temporaryPath, targetPath);
    } catch (error) {
      await fs.rm(temporaryPath, { force: true }).catch(() => null);
      throw error;
    }
  }
}

module.exports = {
  REPOSITORY,
  WelcomeVideoService,
  releaseTagForVersion,
  releaseUrlForVersion,
  videoFileNameForVersion
};
