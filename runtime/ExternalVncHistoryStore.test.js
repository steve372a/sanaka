import { describe, expect, it, vi } from 'vitest';
import { ExternalVncHistoryStore } from './ExternalVncHistoryStore';

function createStore(initial = { version: 1, items: [] }, options = {}) {
  let payload = structuredClone(initial);
  const save = vi.fn(async (next) => {
    payload = structuredClone(next);
  });
  const store = new ExternalVncHistoryStore({
    load: async () => structuredClone(payload),
    save,
    encryptPassword: async (password) => `encrypted:${password}`,
    decryptPassword: async (encrypted) => encrypted.replace(/^encrypted:/, ''),
    isPasswordStorageAvailable: () => true,
    now: () => '2026-07-29T00:00:00.000Z',
    ...options
  });
  return { store, save, readPayload: () => payload };
}

describe('ExternalVncHistoryStore', () => {
  it('deduplicates addresses and returns the most recent connection first', async () => {
    const { store } = createStore();
    const first = await store.recordConnection({ host: 'VM.local', port: 5900, connectedAt: '2026-07-28T00:00:00.000Z' });
    await store.recordConnection({ host: 'other.local', port: 5901, connectedAt: '2026-07-29T00:00:00.000Z' });
    const updated = await store.recordConnection({ host: 'vm.LOCAL', port: 5900, connectedAt: '2026-07-30T00:00:00.000Z' });

    expect(updated.id).toBe(first.id);
    expect((await store.list()).map((entry) => entry.displayAddress)).toEqual([
      'vm.LOCAL:5900',
      'other.local:5901'
    ]);
  });

  it('stores only encrypted passwords and decrypts them on demand', async () => {
    const { store, readPayload } = createStore();
    const entry = await store.recordConnection({
      host: '192.168.1.10',
      port: 5900,
      password: 'secret',
      rememberPassword: true
    });

    expect(entry.hasRememberedPassword).toBe(true);
    expect(JSON.stringify(readPayload())).not.toContain('"secret"');
    expect(readPayload().items[0].encryptedPassword).toBe('encrypted:secret');
    expect((await store.getWithCredential(entry.id))?.password).toBe('secret');
  });

  it('never persists a password when encryption is unavailable', async () => {
    const { store, readPayload } = createStore(undefined, {
      encryptPassword: async () => null,
      decryptPassword: async () => null,
      isPasswordStorageAvailable: () => false
    });
    const entry = await store.recordConnection({
      host: '192.168.1.20',
      port: 5900,
      password: 'secret',
      rememberPassword: true
    });

    expect(entry.hasRememberedPassword).toBe(false);
    expect(entry.passwordStorageAvailable).toBe(false);
    expect(readPayload().items[0].encryptedPassword).toBeNull();
  });
});
