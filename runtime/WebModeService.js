const fs = require('fs/promises');
const fsSync = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { randomUUID } = require('crypto');
const WebSocket = require('ws');
const { webModeApiSpec, transformWebModeArgs } = require('./webModeApi');
const { redactHostPaths } = require('./WebResponseSanitizer');

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4'
};

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeError(error) {
  if (!error) {
    return { message: 'Unknown error.' };
  }

  if (error instanceof Error) {
    return {
      message: redactHostPaths(error.message) || 'Unknown error.',
      code: error.code
    };
  }

  if (typeof error === 'string') {
    return { message: redactHostPaths(error) };
  }

  return {
    message: String(error)
  };
}

class WebModeService {
  constructor(options = {}) {
    this.appName = options.appName || 'Sanaka';
    this.appVersion = options.appVersion || '0.0.0';
    this.host = options.host || '0.0.0.0';
    this.port = options.port || 0;
    this.distDir = options.distDir;
    this.getRuntimeManager = options.getRuntimeManager || (() => null);
    this.getRuntimeSummary = options.getRuntimeSummary || (async () => ({}));
    this.invokeHandlers = options.invokeHandlers || {};
    this.webWorkspaceService = options.webWorkspaceService || null;
    this.webExportService = options.webExportService || null;
    this.getWelcomeVideoPath = options.getWelcomeVideoPath || null;
    this.server = null;
    this.wsServer = null;
    this.startedAt = null;
    this.boundPort = null;
    this.clients = new Set();
    this.socketPairs = new Set();
    this.channelHandlers = this.#buildChannelHandlers();
    this.browserApiScript = this.#buildBrowserApiScript();
  }

  async start() {
    if (this.server && this.boundPort) {
      return this.getState();
    }

    await new Promise((resolve, reject) => {
      const server = http.createServer((request, response) => {
        void this.#handleRequest(request, response);
      });
      const wsServer = new WebSocket.Server({ noServer: true });

      server.on('upgrade', (request, socket, head) => {
        void this.#handleUpgrade(request, socket, head, wsServer);
      });

      const onError = (error) => {
        server.removeListener('listening', onListening);
        reject(error);
      };

      const onListening = () => {
        server.removeListener('error', onError);
        this.server = server;
        this.wsServer = wsServer;
        this.startedAt = new Date().toISOString();
        this.boundPort = server.address()?.port || this.port;
        resolve();
      };

      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(this.port, this.host);
    });

    return this.getState();
  }

  getState() {
    const active = Boolean(this.server && this.boundPort);
    const localUrl = active ? `http://127.0.0.1:${this.boundPort}/` : null;
    const networkHost = this.#resolvePrimaryNetworkHost();
    const networkUrl = active && networkHost ? `http://${networkHost}:${this.boundPort}/` : null;
    const url = networkUrl || localUrl;
    return {
      active,
      url,
      localUrl,
      networkUrl,
      host: this.host,
      port: this.boundPort,
      startedAt: this.startedAt,
      localOnly: this.host === '127.0.0.1' || this.host === 'localhost'
    };
  }

  async stop() {
    if (!this.server) {
      this.boundPort = null;
      this.startedAt = null;
      return;
    }

    for (const client of this.clients) {
      client.end();
    }
    this.clients.clear();
    this.#closeSocketPairs();
    if (this.wsServer) {
      try {
        this.wsServer.close();
      } catch {
        // ignore
      }
      this.wsServer = null;
    }

    const server = this.server;
    this.server = null;
    this.boundPort = null;
    this.startedAt = null;

    await new Promise((resolve) => {
      server.close(() => resolve());
    });
  }

  emit(channel, payload) {
    if (this.clients.size === 0) {
      return;
    }

    const data = `event: ${channel}\ndata: ${JSON.stringify(payload ?? null)}\n\n`;
    for (const client of this.clients) {
      client.write(data);
    }
  }

  async #handleRequest(request, response) {
    const url = new URL(request.url || '/', `http://${this.host}:${this.boundPort || this.port || 80}`);

    if (url.pathname === '/api/status') {
      const payload = await this.#buildStatusPayload();
      this.#writeJson(response, 200, payload);
      return;
    }

    if (url.pathname === '/api/events') {
      this.#handleEvents(response);
      return;
    }

    if (url.pathname === '/api/rpc' && request.method === 'POST') {
      await this.#handleRpc(request, response);
      return;
    }

    if (url.pathname === '/api/healthz') {
      response.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store'
      });
      response.end('ok');
      return;
    }

    if (url.pathname === '/api/workspace/files' && request.method === 'GET') {
      await this.#listWorkspaceFiles(url, response);
      return;
    }

    if (url.pathname === '/api/workspace/upload' && request.method === 'POST') {
      await this.#uploadWorkspaceFile(request, url, response);
      return;
    }

    if (url.pathname === '/api/workspace/download' && request.method === 'GET') {
      await this.#downloadWorkspaceFile(url, response);
      return;
    }

    if (url.pathname === '/api/workspace/preview' && request.method === 'GET') {
      await this.#serveWorkspacePreview(url, response);
      return;
    }

    if (url.pathname.startsWith('/api/workspace/exports/') && request.method === 'GET') {
      await this.#downloadWebExport(url, response);
      return;
    }

    if (url.pathname === '/api/file') {
      response.writeHead(410, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end('Host file access is unavailable in web mode.');
      return;
    }

    if (url.pathname === '/api/audio') {
      await this.#serveAudioStream(url, response);
      return;
    }

    if (url.pathname.startsWith('/video/')) {
      await this.#serveWelcomeVideo(request, url, response);
      return;
    }

    if (url.pathname === '/web-bridge.js') {
      response.writeHead(200, {
        'Content-Type': MIME_TYPES['.js'],
        'Cache-Control': 'no-store'
      });
      response.end(this.browserApiScript);
      return;
    }

    await this.#serveDist(url.pathname, response);
  }

  async #handleUpgrade(request, socket, head, wsServer) {
    const url = new URL(request.url || '/', `http://${this.host}:${this.boundPort || this.port || 80}`);
    if (url.pathname === '/api/novnc') {
      const port = Number.parseInt(url.searchParams.get('port') || '', 10);
      if (!Number.isInteger(port) || port <= 0 || port > 65535 || !(await this.#isAllowedDisplayWebSocketPort(port))) {
        socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
        socket.destroy();
        return;
      }

      wsServer.handleUpgrade(request, socket, head, (clientSocket) => {
        const targetSocket = new WebSocket(`ws://127.0.0.1:${port}`);
        const pair = { clientSocket, targetSocket };
        this.socketPairs.add(pair);

        const dispose = () => {
          this.socketPairs.delete(pair);
          if (clientSocket.readyState === WebSocket.OPEN || clientSocket.readyState === WebSocket.CONNECTING) {
            try {
              clientSocket.close();
            } catch {
              // ignore
            }
          }
          if (targetSocket.readyState === WebSocket.OPEN || targetSocket.readyState === WebSocket.CONNECTING) {
            try {
              targetSocket.close();
            } catch {
              // ignore
            }
          }
        };

        targetSocket.on('open', () => {
          clientSocket.on('message', (data, isBinary) => {
            if (targetSocket.readyState === WebSocket.OPEN) {
              targetSocket.send(data, { binary: isBinary });
            }
          });

          targetSocket.on('message', (data, isBinary) => {
            if (clientSocket.readyState === WebSocket.OPEN) {
              clientSocket.send(data, { binary: isBinary });
            }
          });
        });

        clientSocket.on('close', dispose);
        targetSocket.on('close', dispose);
        clientSocket.on('error', dispose);
        targetSocket.on('error', dispose);
      });
      return;
    }

    if (url.pathname === '/api/audio-ws') {
      await this.#handleAudioUpgrade(request, socket, head, wsServer, url);
      return;
    }

    if (url.pathname.startsWith('/api/viewer/vnc/')) {
      await this.#handleExternalVncUpgrade(request, socket, head, wsServer, url);
      return;
    }

    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
  }

  async #isAllowedDisplayWebSocketPort(port) {
    try {
      const runtimeManager = this.getRuntimeManager();
      if (!runtimeManager || typeof runtimeManager.listRunningMachines !== 'function') return false;
      const machines = await runtimeManager.listRunningMachines();
      return machines.some((machine) => (
        machine?.displayBackend === 'vnc'
        && machine?.displayWebSocketPort === port
        && (machine.status === 'starting' || machine.status === 'running')
      ));
    } catch {
      return false;
    }
  }

  #handleEvents(response) {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive'
    });
    response.write('\n');
    this.clients.add(response);
    response.on('close', () => {
      this.clients.delete(response);
    });
  }

  async #handleRpc(request, response) {
    try {
      const rawBody = await this.#readRequestBody(request);
      const body = rawBody ? JSON.parse(rawBody) : {};
      const channel = body?.channel;
      const args = Array.isArray(body?.args) ? body.args : [];

      const handler = this.channelHandlers[channel];
      if (typeof handler !== 'function') {
        this.#writeJson(response, 404, {
          ok: false,
          error: {
            message: `Unknown RPC channel: ${channel}`
          }
        });
        return;
      }

      const result = await handler(...args);
      this.#writeJson(response, 200, { ok: true, result });
    } catch (error) {
      this.#writeJson(response, 500, {
        ok: false,
        error: normalizeError(error)
      });
    }
  }

  async #serveDist(pathname, response) {
    if (!this.distDir) {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Missing dist directory.');
      return;
    }

    const requestedPath = pathname === '/' ? '/web.html' : pathname;
    const safePath = path.normalize(requestedPath).replace(/^(\.\.(\/|\\|$))+/, '');
    const absolutePath = path.join(this.distDir, safePath);

    try {
      const stat = await fs.stat(absolutePath);
      if (stat.isDirectory()) {
        await this.#serveDist(path.join(requestedPath, 'index.html'), response);
        return;
      }

      let content = await fs.readFile(absolutePath);
      const ext = path.extname(absolutePath).toLowerCase();
      const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

      if (path.basename(absolutePath) === 'index.html' || path.basename(absolutePath) === 'web.html') {
        content = Buffer.from(this.#injectBridgeIntoHtml(content.toString('utf8')), 'utf8');
      }

      response.writeHead(200, {
        'Content-Type': mimeType,
        'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=31536000, immutable'
      });
      response.end(content);
    } catch (error) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    }
  }

  async #serveWelcomeVideo(request, url, response) {
    const expectedName = `${this.appVersion}.mp4`;
    let requestedName = '';
    try {
      requestedName = path.basename(decodeURIComponent(url.pathname.slice('/video/'.length)));
    } catch {
      requestedName = '';
    }
    if (requestedName !== expectedName || typeof this.getWelcomeVideoPath !== 'function') {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    try {
      const filePath = await this.getWelcomeVideoPath();
      const stats = await fs.stat(filePath);
      if (!stats.isFile() || stats.size <= 0) throw new Error('missing');
      const commonHeaders = {
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable'
      };
      const range = request.headers.range;
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
        if (!match || (!match[1] && !match[2])) {
          response.writeHead(416, { ...commonHeaders, 'Content-Range': `bytes */${stats.size}` });
          response.end();
          return;
        }
        let start;
        let end;
        if (!match[1]) {
          const suffixLength = Number.parseInt(match[2], 10);
          start = Math.max(0, stats.size - suffixLength);
          end = stats.size - 1;
        } else {
          start = Number.parseInt(match[1], 10);
          end = match[2] ? Number.parseInt(match[2], 10) : stats.size - 1;
        }
        if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= stats.size) {
          response.writeHead(416, { ...commonHeaders, 'Content-Range': `bytes */${stats.size}` });
          response.end();
          return;
        }
        end = Math.min(end, stats.size - 1);
        response.writeHead(206, {
          ...commonHeaders,
          'Content-Length': end - start + 1,
          'Content-Range': `bytes ${start}-${end}/${stats.size}`
        });
        fsSync.createReadStream(filePath, { start, end }).pipe(response);
        return;
      }
      response.writeHead(200, { ...commonHeaders, 'Content-Length': stats.size });
      fsSync.createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    }
  }

  async #listWorkspaceFiles(url, response) {
    if (!this.webWorkspaceService) {
      this.#writeJson(response, 503, { ok: false, error: { message: 'The web workspace is unavailable.' } });
      return;
    }
    try {
      const result = await this.webWorkspaceService.listFiles(
        url.searchParams.get('machine') || '',
        url.searchParams.get('directory') || ''
      );
      this.#writeJson(response, 200, { ok: true, result });
    } catch (error) {
      this.#writeJson(response, 403, { ok: false, error: normalizeError(error) });
    }
  }

  async #uploadWorkspaceFile(request, url, response) {
    if (!this.webWorkspaceService) {
      this.#writeJson(response, 503, { ok: false, error: { message: 'The web workspace is unavailable.' } });
      return;
    }

    let partPath = null;
    let fileHandle = null;
    try {
      const contentLength = Number.parseInt(request.headers['content-length'] || '0', 10);
      if (Number.isFinite(contentLength) && contentLength > this.webWorkspaceService.maxUploadBytes) {
        this.#writeJson(response, 413, { ok: false, error: { message: 'The uploaded file is too large.' } });
        return;
      }
      const target = await this.webWorkspaceService.resolveUploadTarget(
        url.searchParams.get('machine') || '',
        url.searchParams.get('directory') || '',
        url.searchParams.get('name') || ''
      );
      const targetExists = await fs.stat(target.targetPath).then(() => true).catch((error) => {
        if (error?.code === 'ENOENT') return false;
        throw error;
      });
      if (targetExists) {
        this.#writeJson(response, 409, { ok: false, error: { message: 'A file with this name already exists.' } });
        return;
      }

      partPath = `${target.targetPath}.part-${randomUUID()}`;
      fileHandle = await fs.open(partPath, 'wx');
      let totalBytes = 0;
      for await (const chunk of request) {
        totalBytes += chunk.length;
        if (totalBytes > this.webWorkspaceService.maxUploadBytes) {
          throw Object.assign(new Error('The uploaded file is too large.'), { code: 'UPLOAD_TOO_LARGE' });
        }
        await fileHandle.write(chunk);
      }
      await fileHandle.sync();
      await fileHandle.close();
      fileHandle = null;
      await fs.rename(partPath, target.targetPath);
      partPath = null;
      this.#writeJson(response, 201, {
        ok: true,
        result: { path: target.relativePath, name: target.fileName, size: totalBytes }
      });
    } catch (error) {
      if (fileHandle) await fileHandle.close().catch(() => null);
      if (partPath) await fs.rm(partPath, { force: true }).catch(() => null);
      this.#writeJson(response, error?.code === 'UPLOAD_TOO_LARGE' ? 413 : 403, { ok: false, error: normalizeError(error) });
    }
  }

  async #downloadWorkspaceFile(url, response) {
    if (!this.webWorkspaceService) {
      response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('The web workspace is unavailable.');
      return;
    }
    try {
      const filePath = await this.webWorkspaceService.resolveSandboxPath(
        url.searchParams.get('machine') || '',
        url.searchParams.get('path') || '',
        { mustExist: true }
      );
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('The requested path is not a file.');
        return;
      }
      const fileName = path.basename(filePath).replace(/["\r\n]/g, '_');
      response.writeHead(200, {
        'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'Content-Length': stats.size,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'Cache-Control': 'no-store'
      });
      fsSync.createReadStream(filePath).pipe(response);
    } catch (error) {
      response.writeHead(error?.code === 'ENOENT' ? 404 : 403, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(error?.message || 'The requested file is unavailable.');
    }
  }

  async #serveWorkspacePreview(url, response) {
    if (!this.webWorkspaceService) {
      response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('The web workspace is unavailable.');
      return;
    }
    try {
      const previewPath = await this.webWorkspaceService.resolvePreviewPath(url.searchParams.get('machine') || '');
      const stats = await fs.stat(previewPath);
      response.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': stats.size,
        'Cache-Control': 'no-store'
      });
      fsSync.createReadStream(previewPath).pipe(response);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Preview not found.');
    }
  }

  async #downloadWebExport(url, response) {
    if (!this.webExportService) {
      response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Web export is unavailable.');
      return;
    }
    const token = decodeURIComponent(url.pathname.slice('/api/workspace/exports/'.length));
    const download = await this.webExportService.resolveDownload(token);
    if (!download) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end('This export download is unavailable or has expired.');
      return;
    }
    const fileName = download.name.replace(/["\r\n]/g, '_');
    response.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-Length': download.size,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'Cache-Control': 'no-store'
    });
    fsSync.createReadStream(download.path).pipe(response);
    response.on('finish', () => {
      void this.webExportService.consumeDownload(token);
    });
  }

  async #serveAudioStream(url, response) {
    const machineId = url.searchParams.get('machineId');
    if (!machineId) {
      response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Missing machineId.');
      return;
    }

    const runtimeHandlers = this.invokeHandlers?.runtime || {};
    const getWebAudioState = runtimeHandlers.getWebAudioState;
    if (typeof getWebAudioState !== 'function') {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Web audio is unavailable.');
      return;
    }

    const state = await getWebAudioState(machineId);
    if (!state?.enabled) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Audio bridge is inactive.');
      return;
    }

    response.writeHead(200, {
      'Content-Type': 'audio/wav',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'Transfer-Encoding': 'chunked',
      'X-Accel-Buffering': 'no'
    });

    let dispose = () => {};
    try {
      const runtimeManager = this.getRuntimeManager();
      if (!runtimeManager || typeof runtimeManager.onWebAudioChunk !== 'function') {
        response.end();
        return;
      }
      const header = runtimeManager.getWebAudioHeader?.(machineId);
      if (header) {
        response.write(header);
      }
      dispose = runtimeManager.onWebAudioChunk(machineId, (chunk) => {
        try {
          response.write(chunk);
        } catch {
          // ignore downstream close
        }
      });
    } catch {
      response.end();
      return;
    }

    response.on('close', () => {
      dispose();
    });
  }

  async #handleAudioUpgrade(request, socket, head, wsServer, url) {
    const machineId = url.searchParams.get('machineId');
    if (!machineId) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    const runtimeHandlers = this.invokeHandlers?.runtime || {};
    const getWebAudioState = runtimeHandlers.getWebAudioState;
    if (typeof getWebAudioState !== 'function') {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    const state = await getWebAudioState(machineId);
    if (!state?.enabled) {
      socket.write('HTTP/1.1 409 Conflict\r\n\r\n');
      socket.destroy();
      return;
    }

    wsServer.handleUpgrade(request, socket, head, (clientSocket) => {
      const runtimeManager = this.getRuntimeManager();
      if (!runtimeManager || typeof runtimeManager.onWebAudioChunk !== 'function') {
        clientSocket.close();
        return;
      }

      clientSocket.send(JSON.stringify({
        type: 'audio-meta',
        sampleRate: state.sampleRate,
        channels: state.channels,
        bitsPerSample: state.bitsPerSample
      }));

      const disposeStream = runtimeManager.onWebAudioChunk(machineId, (chunk) => {
        if (clientSocket.readyState !== WebSocket.OPEN) {
          return;
        }
        try {
          clientSocket.send(chunk, { binary: true });
        } catch {
          // ignore send failures during close
        }
      });

      const dispose = () => {
        disposeStream();
        if (clientSocket.readyState === WebSocket.OPEN || clientSocket.readyState === WebSocket.CONNECTING) {
          try {
            clientSocket.close();
          } catch {
            // ignore
          }
        }
      };

      clientSocket.on('close', disposeStream);
      clientSocket.on('error', dispose);
    });
  }

  async #handleExternalVncUpgrade(request, socket, head, wsServer, url) {
    const sessionId = url.pathname.slice('/api/viewer/vnc/'.length).trim();
    if (!sessionId) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    const viewerHandlers = this.invokeHandlers?.viewer || {};
    const reserveTarget = viewerHandlers.reserveExternalVncProxyTarget;
    const markConnected = viewerHandlers.markExternalVncProxyConnected;
    const releaseTarget = viewerHandlers.releaseExternalVncProxyTarget;

    if (typeof reserveTarget !== 'function' || typeof releaseTarget !== 'function') {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    const reservation = await reserveTarget(sessionId);
    if (!reservation?.ok || !reservation.target?.host || !reservation.target?.port) {
      const statusLine = reservation?.error === 'VNC viewer session is already active.'
        ? 'HTTP/1.1 409 Conflict\r\n\r\n'
        : 'HTTP/1.1 404 Not Found\r\n\r\n';
      socket.write(statusLine);
      socket.destroy();
      return;
    }

    wsServer.handleUpgrade(request, socket, head, (clientSocket) => {
      const targetSocket = net.createConnection({
        host: reservation.target.host,
        port: reservation.target.port
      });

      const pair = { clientSocket, targetSocket };
      this.socketPairs.add(pair);
      let released = false;

      const finalize = (options = {}) => {
        if (!released) {
          released = true;
          this.socketPairs.delete(pair);
          try {
            releaseTarget(sessionId, options);
          } catch {
            // ignore cleanup failures
          }
        }
      };

      const closeBoth = (options = {}) => {
        finalize(options);
        if (clientSocket.readyState === WebSocket.OPEN || clientSocket.readyState === WebSocket.CONNECTING) {
          try {
            clientSocket.close();
          } catch {
            // ignore
          }
        }
        if (!targetSocket.destroyed) {
          targetSocket.destroy();
        }
      };

      targetSocket.on('connect', () => {
        if (typeof markConnected === 'function') {
          try {
            markConnected(sessionId);
          } catch {
            // ignore
          }
        }
      });

      targetSocket.on('data', (chunk) => {
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(chunk, { binary: true });
        }
      });

      targetSocket.on('error', (error) => {
        closeBoth({ error: error?.message || 'Failed to connect to the remote VNC server.' });
      });

      targetSocket.on('close', () => {
        closeBoth();
      });

      clientSocket.on('message', (data) => {
        if (!targetSocket.destroyed) {
          targetSocket.write(data);
        }
      });

      clientSocket.on('close', () => {
        closeBoth();
      });

      clientSocket.on('error', (error) => {
        closeBoth({ error: error?.message || 'WebSocket bridge closed unexpectedly.' });
      });
    });
  }

  async #buildStatusPayload() {
    const runtimeSummary = await this.getRuntimeSummary().catch(() => ({}));
    return {
      appName: this.appName,
      appVersion: this.appVersion,
      startedAt: this.startedAt,
      runtimeSummary,
      url: this.getState().url
    };
  }

  #injectBridgeIntoHtml(html) {
    const marker = '</head>';
    const scriptTag = '<script src="./web-bridge.js"></script>';
    if (html.includes(scriptTag)) {
      return html;
    }
    if (html.includes(marker)) {
      return html.replace(marker, `  ${scriptTag}\n${marker}`);
    }
    return `${scriptTag}\n${html}`;
  }

  #buildBrowserApiScript() {
    const contractJson = JSON.stringify(webModeApiSpec);
    const webSocketLoopbackPattern = '^ws://127\\\\.0\\\\.0\\\\.1:(\\\\d+)/?$';

    return `
(() => {
  const contract = ${contractJson};
  let sharedEventSource = null;
  const eventListeners = new Map();

  function rewriteWebSocketUrl(input) {
    if (typeof input !== 'string') {
      return input;
    }

    const match = input.match(new RegExp('${webSocketLoopbackPattern}', 'i'));
    if (match) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return protocol + '//' + window.location.host + '/api/novnc?port=' + encodeURIComponent(match[1]);
    }

    return input;
  }

  const OriginalWebSocket = window.WebSocket;
  function BrowserWebSocket(url, protocols) {
    return new OriginalWebSocket(rewriteWebSocketUrl(url), protocols);
  }
  BrowserWebSocket.prototype = OriginalWebSocket.prototype;
  Object.setPrototypeOf(BrowserWebSocket, OriginalWebSocket);
  window.WebSocket = BrowserWebSocket;

  function on(channel, handler) {
    if (typeof handler !== 'function') {
      return () => {};
    }

    if (!sharedEventSource) {
      sharedEventSource = new EventSource('./api/events');
    }

    const listener = (event) => {
      try {
        const payload = JSON.parse(event.data);
        handler(payload);
      } catch {
        handler(undefined);
      }
    };

    sharedEventSource.addEventListener(channel, listener);
    if (!eventListeners.has(channel)) {
      eventListeners.set(channel, new Set());
    }
    eventListeners.get(channel).add(listener);
    return () => {
      if (!sharedEventSource) {
        return;
      }
      sharedEventSource.removeEventListener(channel, listener);
      const listeners = eventListeners.get(channel);
      if (listeners) {
        listeners.delete(listener);
        if (listeners.size === 0) {
          eventListeners.delete(channel);
        }
      }
      if (eventListeners.size === 0) {
        sharedEventSource.close();
        sharedEventSource = null;
      }
    };
  }

  async function invoke(channel, ...args) {
    const [namespace, method] = channel.split(':');
    const payload = {
      namespace,
      method: method.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()),
      channel,
      args
    };

    const response = await fetch('./api/rpc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({ ok: false, error: { message: 'Invalid RPC response.' } }));
    if (!response.ok || !data.ok) {
      throw new Error(data?.error?.message || 'RPC request failed.');
    }
    return data.result;
  }

  function bindNode(node) {
    if (!node || typeof node !== 'object') {
      return node;
    }

    if (node.type === 'invoke') {
      return (...args) => invoke(node.channel, ...args);
    }

    if (node.type === 'event') {
      return (handler) => on(node.channel, handler);
    }

    return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, bindNode(value)]));
  }

  window.electronAPI = bindNode(contract);
  window.sanakaWebAPI = {
    isWebMode: true,
    files: {
      async list(machineRef, directory = '') {
        const query = new URLSearchParams({ machine: machineRef, directory });
        const response = await fetch('./api/workspace/files?' + query.toString(), { cache: 'no-store' });
        const payload = await response.json().catch(() => ({ ok: false, error: { message: 'Invalid file list response.' } }));
        if (!response.ok || !payload.ok) {
          throw new Error(payload?.error?.message || 'Could not list machine files.');
        }
        return payload.result;
      },
      upload(machineRef, directory, file, onProgress) {
        return new Promise((resolve, reject) => {
          const query = new URLSearchParams({ machine: machineRef, directory, name: file.name });
          const request = new XMLHttpRequest();
          request.open('POST', './api/workspace/upload?' + query.toString());
          request.setRequestHeader('Content-Type', 'application/octet-stream');
          request.upload.addEventListener('progress', (event) => {
            if (typeof onProgress === 'function' && event.lengthComputable) {
              onProgress(Math.round((event.loaded / Math.max(event.total, 1)) * 100));
            }
          });
          request.addEventListener('load', () => {
            let payload = null;
            try { payload = JSON.parse(request.responseText); } catch { /* handled below */ }
            if (request.status < 200 || request.status >= 300 || !payload?.ok) {
              reject(new Error(payload?.error?.message || 'Could not upload the file.'));
              return;
            }
            resolve(payload.result);
          });
          request.addEventListener('error', () => reject(new Error('Could not upload the file.')));
          request.send(file);
        });
      },
      downloadUrl(machineRef, relativePath) {
        const query = new URLSearchParams({ machine: machineRef, path: relativePath });
        return window.location.origin + '/api/workspace/download?' + query.toString();
      }
    }
  };
  window.addEventListener('error', (event) => {
    console.error('[web-mode error]', event.error || event.message || event);
  });
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[web-mode unhandledrejection]', event.reason);
  });
})();
`;
  }

  #buildChannelHandlers() {
    const handlers = {};
    const walk = (node, stack = []) => {
      if (!node || typeof node !== 'object') {
        return;
      }

      if (node.type === 'invoke') {
        const namespace = stack[0];
        const method = stack[1];
        const namespaceHandlers = this.invokeHandlers?.[namespace];
        if (typeof namespaceHandlers?.[method] === 'function') {
          handlers[node.channel] = (...args) => namespaceHandlers[method](...transformWebModeArgs(node.argStyle, args));
        }
        return;
      }

      Object.entries(node).forEach(([key, value]) => walk(value, [...stack, key]));
    };

    walk(webModeApiSpec);
    return handlers;
  }

  async #readRequestBody(request, maxBytes = 1024 * 1024) {
    const chunks = [];
    let totalBytes = 0;
    for await (const chunk of request) {
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        throw Object.assign(new Error('The RPC request is too large.'), { code: 'REQUEST_TOO_LARGE' });
      }
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
  }

  #writeJson(response, statusCode, payload) {
    response.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    response.end(JSON.stringify(payload));
  }

  #closeSocketPairs() {
    for (const pair of this.socketPairs) {
      try {
        pair.clientSocket.close();
      } catch {
        // ignore
      }
      try {
        pair.targetSocket.close();
      } catch {
        // ignore
      }
    }
    this.socketPairs.clear();
  }

  #resolvePrimaryNetworkHost() {
    if (!this.server || !this.boundPort) {
      return null;
    }

    if (this.host && this.host !== '0.0.0.0' && this.host !== '::') {
      return this.host;
    }

    const interfaces = os.networkInterfaces();
    for (const records of Object.values(interfaces)) {
      if (!Array.isArray(records)) {
        continue;
      }

      for (const record of records) {
        if (!record || record.internal) {
          continue;
        }

        if (record.family === 'IPv4' && record.address) {
          return record.address;
        }
      }
    }

    return null;
  }
}

module.exports = {
  WebModeService
};
