import { describe, expect, it } from 'vitest';
import { DEFAULT_VNC_PORT, ExternalVncViewerService, parseAddress } from './ExternalVncViewerService';

describe('ExternalVncViewerService', () => {
  it('parses host:port addresses and falls back to the default port', () => {
    expect(parseAddress('192.168.1.2:5905')).toEqual({
      host: '192.168.1.2',
      port: 5905
    });
    expect(parseAddress('vm.local')).toEqual({
      host: 'vm.local',
      port: DEFAULT_VNC_PORT
    });
  });

  it('creates and serializes external VNC sessions', () => {
    const service = new ExternalVncViewerService();

    const session = service.createSession({
      address: '192.168.1.100:5902',
      password: 'secret'
    });

    expect(session.host).toBe('192.168.1.100');
    expect(session.port).toBe(5902);
    expect(session.displayAddress).toBe('192.168.1.100:5902');
    expect(session.hasPassword).toBe(true);
    expect(session.status).toBe('idle');
    expect(service.listSessions()).toHaveLength(1);
  });

  it('tracks proxy lifecycle without exposing password state', () => {
    const service = new ExternalVncViewerService();
    const session = service.createSession({
      host: '192.168.1.10'
    });

    const reservation = service.reserveProxyTarget(session.id);
    expect(reservation).toEqual({
      ok: true,
      target: {
        host: '192.168.1.10',
        port: 5900
      }
    });
    expect(service.getSession(session.id)?.status).toBe('connecting');

    service.markProxyConnected(session.id);
    expect(service.getSession(session.id)?.status).toBe('connected');

    service.releaseProxyTarget(session.id);
    const released = service.getSession(session.id);
    expect(released?.status).toBe('disconnected');
    expect(released?.activeConnections).toBe(0);
    expect(released).not.toHaveProperty('password');
  });

  it('keeps credentials private while allowing the active viewer to update them', () => {
    const service = new ExternalVncViewerService();
    const session = service.createSession({
      host: '192.168.1.30',
      historyId: 'history-1'
    });

    expect(service.setCredentials(session.id, { password: 'secret', rememberPassword: true })).toEqual({
      ok: true,
      hasPassword: true,
      rememberPassword: true
    });
    expect(service.getCredentials(session.id)).toEqual({ password: 'secret', rememberPassword: true });
    expect(service.getSession(session.id)).toMatchObject({ historyId: 'history-1', hasPassword: true });
    expect(service.getSession(session.id)).not.toHaveProperty('password');

    service.clearCredentials(session.id);
    expect(service.getCredentials(session.id)).toEqual({ password: '', rememberPassword: false });
  });
});
