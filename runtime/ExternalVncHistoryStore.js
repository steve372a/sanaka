const { randomUUID } = require('crypto');

const HISTORY_VERSION = 1;
const DEFAULT_MAX_HISTORY = 12;

function cleanString(value) {
  return String(value ?? '').trim();
}

function normalizePort(value) {
  const port = Number.parseInt(String(value), 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid VNC port.');
  }
  return port;
}

function historyKey(host, port) {
  return `${cleanString(host).toLowerCase()}:${normalizePort(port)}`;
}

function serializeHistoryEntry(entry, passwordStorageAvailable) {
  return {
    id: entry.id,
    host: entry.host,
    port: entry.port,
    displayAddress: entry.displayAddress,
    lastConnectedAt: entry.lastConnectedAt,
    hasRememberedPassword: Boolean(entry.encryptedPassword),
    passwordStorageAvailable: Boolean(passwordStorageAvailable)
  };
}

class ExternalVncHistoryStore {
  constructor(options = {}) {
    if (typeof options.load !== 'function' || typeof options.save !== 'function') {
      throw new Error('VNC history load/save callbacks are required.');
    }
    this.load = options.load;
    this.save = options.save;
    this.encryptPassword = typeof options.encryptPassword === 'function' ? options.encryptPassword : () => null;
    this.decryptPassword = typeof options.decryptPassword === 'function' ? options.decryptPassword : () => null;
    this.isPasswordStorageAvailable = typeof options.isPasswordStorageAvailable === 'function'
      ? options.isPasswordStorageAvailable
      : () => false;
    this.maxEntries = Number.isInteger(options.maxEntries) && options.maxEntries > 0
      ? options.maxEntries
      : DEFAULT_MAX_HISTORY;
    this.now = typeof options.now === 'function' ? options.now : () => new Date().toISOString();
  }

  async readEntries() {
    const payload = await this.load();
    const rows = Array.isArray(payload) ? payload : payload?.items;
    if (!Array.isArray(rows)) return [];
    return rows.flatMap((row) => {
      try {
        const host = cleanString(row?.host);
        if (!host) return [];
        const port = normalizePort(row?.port);
        return [{
          id: cleanString(row?.id) || randomUUID(),
          host,
          port,
          displayAddress: cleanString(row?.displayAddress) || `${host}:${port}`,
          lastConnectedAt: cleanString(row?.lastConnectedAt) || this.now(),
          encryptedPassword: cleanString(row?.encryptedPassword) || null
        }];
      } catch {
        return [];
      }
    });
  }

  async writeEntries(entries) {
    await this.save({
      version: HISTORY_VERSION,
      items: entries.slice(0, this.maxEntries)
    });
  }

  async list() {
    const entries = await this.readEntries();
    return entries
      .sort((left, right) => right.lastConnectedAt.localeCompare(left.lastConnectedAt))
      .slice(0, this.maxEntries)
      .map((entry) => serializeHistoryEntry(entry, this.isPasswordStorageAvailable()));
  }

  canStorePassword() {
    return Boolean(this.isPasswordStorageAvailable());
  }

  async getWithCredential(historyId) {
    const id = cleanString(historyId);
    if (!id) return null;
    const entry = (await this.readEntries()).find((item) => item.id === id);
    if (!entry) return null;
    let password = null;
    if (entry.encryptedPassword) {
      try {
        password = cleanString(await this.decryptPassword(entry.encryptedPassword)) || null;
      } catch {
        password = null;
      }
    }
    return {
      ...serializeHistoryEntry(entry, this.isPasswordStorageAvailable()),
      password
    };
  }

  async recordConnection(input = {}) {
    const host = cleanString(input.host);
    if (!host) throw new Error('Missing VNC host.');
    const port = normalizePort(input.port);
    const entries = await this.readEntries();
    const key = historyKey(host, port);
    const existing = entries.find((entry) => historyKey(entry.host, entry.port) === key);
    let encryptedPassword = existing?.encryptedPassword || null;

    if (input.rememberPassword === true) {
      const password = cleanString(input.password);
      encryptedPassword = password ? cleanString(await this.encryptPassword(password)) || null : null;
    } else if (input.rememberPassword === false) {
      encryptedPassword = null;
    }

    const entry = {
      id: existing?.id || randomUUID(),
      host,
      port,
      displayAddress: cleanString(input.displayAddress) || `${host}:${port}`,
      lastConnectedAt: cleanString(input.connectedAt) || this.now(),
      encryptedPassword
    };
    const nextEntries = [entry, ...entries.filter((item) => item.id !== entry.id)]
      .sort((left, right) => right.lastConnectedAt.localeCompare(left.lastConnectedAt));
    await this.writeEntries(nextEntries);
    return serializeHistoryEntry(entry, this.isPasswordStorageAvailable());
  }

  async clearRememberedPassword(historyId) {
    const entries = await this.readEntries();
    const entry = entries.find((item) => item.id === cleanString(historyId));
    if (!entry) return { ok: false, error: 'VNC history entry not found.' };
    entry.encryptedPassword = null;
    await this.writeEntries(entries);
    return { ok: true, entry: serializeHistoryEntry(entry, this.isPasswordStorageAvailable()) };
  }

  async remove(historyId) {
    const id = cleanString(historyId);
    const entries = await this.readEntries();
    const nextEntries = entries.filter((entry) => entry.id !== id);
    if (nextEntries.length === entries.length) {
      return { ok: false, error: 'VNC history entry not found.' };
    }
    await this.writeEntries(nextEntries);
    return { ok: true };
  }
}

module.exports = {
  DEFAULT_MAX_HISTORY,
  ExternalVncHistoryStore,
  HISTORY_VERSION,
  historyKey
};
