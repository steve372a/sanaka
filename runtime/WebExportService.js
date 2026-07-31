const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const { ExportService } = require('./ExportService');

class WebExportService {
  constructor(options = {}) {
    this.workspace = options.workspace;
    this.outputDirectory = options.outputDirectory;
    this.emitProgress = options.emitProgress || (() => {});
    this.ttlMs = options.ttlMs || 30 * 60 * 1000;
    this.tasks = new Map();
    this.downloads = new Map();
    this.exportService = new ExportService({
      platform: options.platform || process.platform,
      emitProgress: (payload) => { void this.#handleProgress(payload); }
    });
    this.cleanupTimer = setInterval(() => {
      void this.cleanupExpired();
    }, Math.min(this.ttlMs, 5 * 60 * 1000));
    this.cleanupTimer.unref?.();
  }

  async start(options = {}) {
    if (!this.workspace || !this.outputDirectory) {
      throw new Error('Web export is unavailable.');
    }
    const safeOptions = await this.workspace.sanitizeExportRequest(options.sourcePath, options);
    await fs.mkdir(this.outputDirectory, { recursive: true });
    const taskId = await this.exportService.exportMachine({
      ...safeOptions,
      targetDir: this.outputDirectory,
      packAsZip: true
    });
    this.tasks.set(taskId, { machineRef: options.sourcePath });
    return taskId;
  }

  async cancel(taskId) {
    this.tasks.delete(taskId);
    return this.exportService.cancelExport(taskId);
  }

  async resolveDownload(token) {
    const record = this.downloads.get(token);
    if (!record || record.expiresAt <= Date.now()) {
      if (record) await this.#removeDownload(token, record);
      return null;
    }
    const stats = await fs.stat(record.path).catch(() => null);
    if (!stats?.isFile()) {
      this.downloads.delete(token);
      return null;
    }
    return { path: record.path, name: record.name, size: stats.size };
  }

  async consumeDownload(token) {
    const record = this.downloads.get(token);
    if (!record) return;
    this.downloads.delete(token);
    setTimeout(() => {
      void fs.rm(record.path, { force: true });
    }, 60_000).unref?.();
  }

  async cleanupExpired() {
    const now = Date.now();
    for (const [token, record] of this.downloads) {
      if (record.expiresAt <= now) await this.#removeDownload(token, record);
    }
  }

  async #handleProgress(payload) {
    const task = this.tasks.get(payload.taskId);
    if (!task) return;
    if (payload.phase === 'completed') {
      const filePath = path.resolve(payload.detail || '');
      const relative = path.relative(path.resolve(this.outputDirectory), filePath);
      if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
        this.tasks.delete(payload.taskId);
        this.emitProgress({
          ...payload,
          phase: 'failed',
          error: 'The export output could not be secured.',
          detail: ''
        });
        return;
      }
      const token = randomUUID();
      this.downloads.set(token, {
        path: filePath,
        name: path.basename(filePath),
        expiresAt: Date.now() + this.ttlMs
      });
      this.tasks.delete(payload.taskId);
      this.emitProgress({ ...payload, detail: `/api/workspace/exports/${encodeURIComponent(token)}` });
      return;
    }
    if (payload.phase === 'failed') this.tasks.delete(payload.taskId);
    this.emitProgress(payload);
  }

  async #removeDownload(token, record) {
    this.downloads.delete(token);
    await fs.rm(record.path, { force: true }).catch(() => null);
  }
}

module.exports = { WebExportService };
