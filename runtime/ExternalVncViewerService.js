const { randomUUID } = require('crypto');

const DEFAULT_VNC_PORT = 5900;
const SESSION_STATUS = {
  idle: 'idle',
  connecting: 'connecting',
  connected: 'connected',
  disconnected: 'disconnected',
  error: 'error',
  closed: 'closed'
};

function makeTimestamp() {
  return new Date().toISOString();
}

function cleanString(value) {
  return String(value ?? '').trim();
}

function parsePort(value, fallback = DEFAULT_VNC_PORT) {
  if (value == null || value === '') {
    return fallback;
  }
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error('Invalid VNC port.');
  }
  return parsed;
}

function parseAddress(address, explicitPort) {
  const input = cleanString(address);
  if (!input) {
    return {
      host: '',
      port: parsePort(explicitPort, DEFAULT_VNC_PORT)
    };
  }

  const normalized = input.replace(/^vnc:\/\//i, '');
  if (normalized.startsWith('[')) {
    const bracketIndex = normalized.indexOf(']');
    if (bracketIndex === -1) {
      throw new Error('Invalid VNC address.');
    }
    const host = normalized.slice(1, bracketIndex);
    const rest = normalized.slice(bracketIndex + 1);
    const port = rest.startsWith(':') ? parsePort(rest.slice(1), explicitPort ?? DEFAULT_VNC_PORT) : parsePort(explicitPort, DEFAULT_VNC_PORT);
    return { host, port };
  }

  const colonMatches = normalized.match(/:/g) || [];
  if (colonMatches.length === 1) {
    const separator = normalized.lastIndexOf(':');
    const maybePort = normalized.slice(separator + 1);
    if (/^\d+$/.test(maybePort)) {
      return {
        host: normalized.slice(0, separator),
        port: parsePort(maybePort, explicitPort ?? DEFAULT_VNC_PORT)
      };
    }
  }

  return {
    host: normalized,
    port: parsePort(explicitPort, DEFAULT_VNC_PORT)
  };
}

function normalizeHost(value) {
  const host = cleanString(value);
  if (!host) {
    throw new Error('Missing VNC host.');
  }
  if (host.length > 255) {
    throw new Error('VNC host is too long.');
  }
  if (/[\s/?#]/.test(host)) {
    throw new Error('Invalid VNC host.');
  }
  return host;
}

function toDisplayAddress(host, port) {
  return host.includes(':') && !host.startsWith('[') ? `[${host}]:${port}` : `${host}:${port}`;
}

function serializeSession(record) {
  if (!record) {
    return null;
  }
  return {
    id: record.id,
    type: 'external-vnc',
    host: record.host,
    port: record.port,
    displayAddress: record.displayAddress,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    lastError: record.lastError,
    hasPassword: record.hasPassword,
    historyId: record.historyId,
    activeConnections: record.activeConnections
  };
}

class ExternalVncViewerService {
  constructor() {
    this.sessions = new Map();
  }

  createSession(input = {}) {
    const parsed = parseAddress(input.address || input.host || '', input.port);
    const host = normalizeHost(input.host || parsed.host);
    const port = parsePort(input.port ?? parsed.port, DEFAULT_VNC_PORT);
    const password = cleanString(input.password);
    const now = makeTimestamp();
    const record = {
      id: randomUUID(),
      host,
      port,
      displayAddress: toDisplayAddress(host, port),
      status: SESSION_STATUS.idle,
      createdAt: now,
      updatedAt: now,
      lastError: null,
      hasPassword: password.length > 0,
      password,
      rememberPassword: input.rememberPassword === true,
      historyId: cleanString(input.historyId) || null,
      activeConnections: 0
    };
    this.sessions.set(record.id, record);
    return serializeSession(record);
  }

  listSessions() {
    return Array.from(this.sessions.values())
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((record) => serializeSession(record));
  }

  getSession(sessionId) {
    return serializeSession(this.sessions.get(sessionId) || null);
  }

  getCredentials(sessionId) {
    const record = this.sessions.get(sessionId);
    if (!record) return null;
    return {
      password: record.password,
      rememberPassword: record.rememberPassword
    };
  }

  setCredentials(sessionId, input = {}) {
    const record = this.sessions.get(sessionId);
    if (!record) return { ok: false, error: 'VNC viewer session not found.' };
    const password = cleanString(input.password);
    record.password = password;
    record.hasPassword = password.length > 0;
    record.rememberPassword = input.rememberPassword === true;
    record.updatedAt = makeTimestamp();
    return { ok: true, hasPassword: record.hasPassword, rememberPassword: record.rememberPassword };
  }

  clearCredentials(sessionId) {
    return this.setCredentials(sessionId, { password: '', rememberPassword: false });
  }

  attachHistory(sessionId, historyId) {
    const record = this.sessions.get(sessionId);
    if (!record) return false;
    record.historyId = cleanString(historyId) || null;
    record.updatedAt = makeTimestamp();
    return true;
  }

  closeSession(sessionId) {
    const record = this.sessions.get(sessionId);
    if (!record) {
      return { ok: false, error: 'VNC viewer session not found.' };
    }
    record.status = SESSION_STATUS.closed;
    record.updatedAt = makeTimestamp();
    this.sessions.delete(sessionId);
    return { ok: true, session: serializeSession(record) };
  }

  reserveProxyTarget(sessionId) {
    const record = this.sessions.get(sessionId);
    if (!record) {
      return { ok: false, error: 'VNC viewer session not found.' };
    }
    if (record.activeConnections > 0) {
      return { ok: false, error: 'VNC viewer session is already active.' };
    }
    record.activeConnections += 1;
    record.status = SESSION_STATUS.connecting;
    record.lastError = null;
    record.updatedAt = makeTimestamp();
    return {
      ok: true,
      target: {
        host: record.host,
        port: record.port
      }
    };
  }

  markProxyConnected(sessionId) {
    const record = this.sessions.get(sessionId);
    if (!record) {
      return;
    }
    record.status = SESSION_STATUS.connected;
    record.lastError = null;
    record.updatedAt = makeTimestamp();
  }

  releaseProxyTarget(sessionId, options = {}) {
    const record = this.sessions.get(sessionId);
    if (!record) {
      return;
    }
    record.activeConnections = Math.max(0, record.activeConnections - 1);
    record.updatedAt = makeTimestamp();
    if (options.error) {
      record.status = SESSION_STATUS.error;
      record.lastError = String(options.error);
      return;
    }
    if (record.status !== SESSION_STATUS.closed) {
      record.status = SESSION_STATUS.disconnected;
      record.lastError = null;
    }
  }
}

module.exports = {
  DEFAULT_VNC_PORT,
  ExternalVncViewerService,
  SESSION_STATUS,
  parseAddress
};
