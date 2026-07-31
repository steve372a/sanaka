import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import net from 'net';
import os from 'os';
import path from 'path';
import WebSocket from 'ws';
import { ExternalVncViewerService } from './ExternalVncViewerService';
import { WebModeService } from './WebModeService';
import { WebWorkspaceService } from './WebWorkspaceService';

async function fetchText(url) {
  const response = await fetch(url);
  return {
    status: response.status,
    text: await response.text(),
    headers: response.headers
  };
}

describe('WebModeService', () => {
  const services = [];
  const tempDirs = [];

  afterEach(async () => {
    while (services.length > 0) {
      const service = services.pop();
      await service.stop();
    }
    while (tempDirs.length > 0) {
      await fs.rm(tempDirs.pop(), { recursive: true, force: true });
    }
  });

  it('starts a local web mode server and returns a usable URL', async () => {
    const service = new WebModeService({
      appName: 'Sanaka',
      appVersion: '0.0.3-beta',
      host: '127.0.0.1',
      getRuntimeSummary: async () => ({
        qemuAvailable: true,
        runningMachines: 2
      })
    });
    services.push(service);

    const state = await service.start();

    expect(state.active).toBe(true);
    expect(state.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
    expect(state.localUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
    expect(typeof state.networkUrl === 'string' || state.networkUrl === null).toBe(true);
    expect(state.port).toBeGreaterThan(0);
  });

  it('returns 500 for the root page when no dist directory is configured', async () => {
    const service = new WebModeService({
      appName: 'Sanaka',
      appVersion: '0.0.3-beta',
      getRuntimeSummary: async () => ({
        qemuAvailable: false,
        runningMachines: 0
      })
    });
    services.push(service);

    const state = await service.start();
    const result = await fetchText(state.url);

    expect(result.status).toBe(500);
    expect(result.text).toContain('Missing dist directory.');
  });

  it('serves a machine-readable status endpoint', async () => {
    const service = new WebModeService({
      appName: 'Sanaka',
      appVersion: '0.0.3-beta',
      getRuntimeSummary: async () => ({
        qemuAvailable: true,
        runningMachines: 1
      })
    });
    services.push(service);

    const state = await service.start();
    const response = await fetch(`${state.url}api/status`);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.appName).toBe('Sanaka');
    expect(payload.runtimeSummary.runningMachines).toBe(1);
    expect(payload.runtimeSummary.qemuAvailable).toBe(true);
  });

  it('serves the existing web entry and injects the web bridge', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sanaka-webmode-'));
    tempDirs.push(tempDir);
    await fs.mkdir(path.join(tempDir, 'assets'));
    await fs.writeFile(
      path.join(tempDir, 'web.html'),
      '<!doctype html><html><head><title>Sanaka</title></head><body><div id="root"></div></body></html>',
      'utf8'
    );

    const service = new WebModeService({
      appName: 'Sanaka',
      appVersion: '0.0.3-beta',
      distDir: tempDir,
      invokeHandlers: {
        settings: {
          load: async () => ({ language: 'zh-CN' })
        }
      }
    });
    services.push(service);

    const state = await service.start();
    const result = await fetchText(state.url);

    expect(result.status).toBe(200);
    expect(result.text).toContain('<script src="./web-bridge.js"></script>');
    expect(result.text).toContain('<div id="root"></div>');
  });

  it('handles rpc through the electron api contract', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sanaka-webmode-'));
    tempDirs.push(tempDir);
    await fs.writeFile(path.join(tempDir, 'web.html'), '<!doctype html><html><head></head><body></body></html>', 'utf8');

    const service = new WebModeService({
      appName: 'Sanaka',
      appVersion: '0.0.3-beta',
      distDir: tempDir,
      invokeHandlers: {
        settings: {
          load: async () => ({ language: 'zh-CN', theme: 'light' })
        }
      }
    });
    services.push(service);

    const state = await service.start();
    const response = await fetch(`${state.url}api/rpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'settings:load',
        args: []
      })
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.result.language).toBe('zh-CN');
  });

  it('exposes sandbox file APIs without the legacy arbitrary host file proxy', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sanaka-webmode-'));
    tempDirs.push(tempDir);
    await fs.writeFile(path.join(tempDir, 'web.html'), '<!doctype html><html><head></head><body></body></html>', 'utf8');

    const service = new WebModeService({
      appName: 'Sanaka',
      appVersion: '0.0.3-beta',
      distDir: tempDir
    });
    services.push(service);

    const state = await service.start();
    const result = await fetchText(`${state.url}web-bridge.js`);

    expect(result.status).toBe(200);
    expect(result.text).toContain('/api/workspace/files?');
    expect(result.text).toContain('/api/workspace/upload?');
    expect(result.text).not.toContain('/api/file?url=');
  });

  it('uploads, lists, and downloads files only through a registered machine sandbox', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sanaka-webmode-files-'));
    tempDirs.push(root);
    const bundlePath = path.join(root, 'Machine.saka');
    await fs.mkdir(path.join(bundlePath, 'Media'), { recursive: true });
    await fs.mkdir(path.join(bundlePath, 'Disks'), { recursive: true });
    await fs.writeFile(path.join(bundlePath, 'machine.svm'), 'kind = "machine"\n', 'utf8');
    const workspace = new WebWorkspaceService({ maxUploadBytes: 1024 });
    const machineRef = workspace.registerMachinePath(bundlePath);
    const service = new WebModeService({ host: '127.0.0.1', webWorkspaceService: workspace });
    services.push(service);
    const state = await service.start();

    const uploadQuery = new URLSearchParams({ machine: machineRef, directory: 'Media', name: 'installer.iso' });
    const uploadResponse = await fetch(`${state.url}api/workspace/upload?${uploadQuery}`, {
      method: 'POST',
      body: Buffer.from('image-data')
    });
    expect(uploadResponse.status).toBe(201);

    const listQuery = new URLSearchParams({ machine: machineRef, directory: 'Media' });
    const listResponse = await fetch(`${state.url}api/workspace/files?${listQuery}`);
    const listing = await listResponse.json();
    expect(listing.result.entries).toEqual([
      expect.objectContaining({ name: 'installer.iso', path: 'Media/installer.iso', kind: 'file', size: 10 })
    ]);

    const downloadQuery = new URLSearchParams({ machine: machineRef, path: 'Media/installer.iso' });
    const downloadResponse = await fetch(`${state.url}api/workspace/download?${downloadQuery}`);
    expect(downloadResponse.status).toBe(200);
    expect(await downloadResponse.text()).toBe('image-data');

    const escapeQuery = new URLSearchParams({ machine: machineRef, path: '../machine.svm' });
    expect((await fetch(`${state.url}api/workspace/download?${escapeQuery}`)).status).toBe(403);
    expect((await fetch(`${state.url}api/file?path=${encodeURIComponent(path.join(root, 'secret'))}`)).status).toBe(410);
  });

  it('downloads a completed web export only through its opaque token endpoint', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sanaka-webmode-export-'));
    tempDirs.push(root);
    const zipPath = path.join(root, 'Machine.zip');
    await fs.writeFile(zipPath, 'zip-content');
    const consumeDownload = vi.fn(async () => undefined);
    const webExportService = {
      resolveDownload: vi.fn(async (token) => token === 'download-token'
        ? { path: zipPath, name: 'Machine.zip', size: 11 }
        : null),
      consumeDownload
    };
    const service = new WebModeService({
      host: '127.0.0.1',
      webExportService
    });
    services.push(service);
    const state = await service.start();

    const response = await fetch(`${state.url}api/workspace/exports/download-token`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/zip');
    expect(response.headers.get('content-disposition')).toContain('Machine.zip');
    expect(await response.text()).toBe('zip-content');
    await vi.waitFor(() => expect(consumeDownload).toHaveBeenCalledWith('download-token'));

    const missing = await fetch(`${state.url}api/workspace/exports/forged-token`);
    expect(missing.status).toBe(404);
  });

  it('bridges an external VNC websocket session to a raw TCP target', async () => {
    const targetServer = net.createServer();
    await new Promise((resolve) => targetServer.listen(0, '127.0.0.1', resolve));
    const address = targetServer.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to allocate a TCP target port.');
    }

    targetServer.on('connection', (socket) => {
      socket.on('data', (chunk) => {
        if (chunk.toString('utf8') === 'ping') {
          socket.write(Buffer.from('pong'));
        }
      });
    });

    const viewerService = new ExternalVncViewerService();
    const session = viewerService.createSession({
      host: '127.0.0.1',
      port: address.port
    });

    const webService = new WebModeService({
      appName: 'Sanaka',
      appVersion: '0.0.3-beta',
      host: '127.0.0.1',
      invokeHandlers: {
        viewer: {
          reserveExternalVncProxyTarget: async (sessionId) => viewerService.reserveProxyTarget(sessionId),
          markExternalVncProxyConnected: async (sessionId) => viewerService.markProxyConnected(sessionId),
          releaseExternalVncProxyTarget: async (sessionId, options) => viewerService.releaseProxyTarget(sessionId, options)
        }
      }
    });
    services.push(webService);

    const state = await webService.start();
    const client = new WebSocket(`ws://127.0.0.1:${state.port}/api/viewer/vnc/${session.id}`);
    const payload = await new Promise((resolve, reject) => {
      client.on('open', () => {
        client.send(Buffer.from('ping'));
      });
      client.on('message', (data) => {
        resolve(Buffer.isBuffer(data) ? data.toString('utf8') : String(data));
      });
      client.on('error', reject);
    });

    expect(payload).toBe('pong');
    expect(viewerService.getSession(session.id)?.status).toBe('connected');

    client.close();
    targetServer.close();
  });
});
