import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConnectVncDialog } from './ConnectVncDialog';
import type { ExternalVncSession } from '../types/electron';

vi.mock('../hooks/useT', () => ({
  useT: () => (key: string) =>
    ({
      'viewer.title': 'VNC Viewer',
      'viewer.subtitle': 'Connect to a remote VNC machine.',
      'viewer.addressLabel': 'VNC Address',
      'viewer.addressPlaceholder': '192.168.1.10:5901',
      'viewer.connect': 'Connect',
      'viewer.connecting': 'Connecting…',
      'viewer.addressHint': 'You can enter host:port or just the host. The default port is 5900.',
      'viewer.externalSessionNote': 'This is an external VNC session.',
      'viewer.recentConnections': 'Recent connections',
      'viewer.loadingHistory': 'Loading…',
      'viewer.noRecentConnections': 'No recent connections',
      'viewer.savedPassword': 'Password saved',
      'viewer.removeHistory': 'Remove from history',
      'viewer.errorEmptyAddress': 'Please enter a VNC address',
      'viewer.errorConnectFailed': 'Could not connect to the target address',
      'viewer.errorInvalidPort': 'Invalid port format',
      'app.cancel': 'Cancel'
    })[key] ?? key
}));

function makeSession(overrides: Partial<ExternalVncSession> = {}): ExternalVncSession {
  return {
    id: 'session-1',
    type: 'external-vnc',
    host: '192.168.1.10',
    port: 5901,
    displayAddress: '192.168.1.10:5901',
    status: 'idle',
    createdAt: '2026-07-05T00:00:00.000Z',
    updatedAt: '2026-07-05T00:00:00.000Z',
    lastError: null,
    hasPassword: false,
    activeConnections: 0,
    websocketPath: '/api/viewer/vnc/session-1',
    websocketUrl: 'ws://127.0.0.1:39281/api/viewer/vnc/session-1',
    localWebsocketUrl: 'ws://127.0.0.1:39281/api/viewer/vnc/session-1',
    networkWebsocketUrl: 'ws://192.168.1.8:39281/api/viewer/vnc/session-1',
    ...overrides
  };
}

describe('ConnectVncDialog', () => {
  it('shows an error when the address is empty', async () => {
    const user = userEvent.setup();
    const onConnected = vi.fn();

    render(<ConnectVncDialog open={true} onClose={() => undefined} onConnected={onConnected} />);

    await user.click(screen.getByRole('button', { name: 'Connect' }));

    expect(screen.getByText('Please enter a VNC address')).toBeInTheDocument();
    expect(onConnected).not.toHaveBeenCalled();
  });

  it('creates a session without asking for a password', async () => {
    const user = userEvent.setup();
    const session = makeSession();
    const createExternalVncSession = vi.fn(async () => session);
    const onConnected = vi.fn();

    window.electronAPI = {
      viewer: { createExternalVncSession, listExternalVncHistory: vi.fn(async () => []) }
    } as never;

    render(<ConnectVncDialog open={true} onClose={() => undefined} onConnected={onConnected} />);

    await user.type(screen.getByLabelText('VNC Address'), '192.168.1.10:5901');
    await user.click(screen.getByRole('button', { name: 'Connect' }));

    await waitFor(() => {
      expect(onConnected).toHaveBeenCalledTimes(1);
    });

    expect(createExternalVncSession).toHaveBeenCalledWith({
      address: '192.168.1.10:5901'
    });
    expect(screen.queryByLabelText('Password (optional)')).not.toBeInTheDocument();
    expect(onConnected).toHaveBeenCalledWith(session);
  });

  it('lists recent devices and reconnects by history id', async () => {
    const user = userEvent.setup();
    const session = makeSession();
    const createExternalVncSession = vi.fn(async () => session);
    const listExternalVncHistory = vi.fn(async () => [{
      id: 'history-1',
      host: '192.168.1.20',
      port: 5900,
      displayAddress: '192.168.1.20:5900',
      lastConnectedAt: '2026-07-29T00:00:00.000Z',
      hasRememberedPassword: true,
      passwordStorageAvailable: true
    }]);
    const onConnected = vi.fn();
    window.electronAPI = { viewer: { createExternalVncSession, listExternalVncHistory } } as never;

    render(<ConnectVncDialog open={true} onClose={() => undefined} onConnected={onConnected} />);
    await user.click(await screen.findByRole('button', { name: /192\.168\.1\.20:5900/ }));

    expect(createExternalVncSession).toHaveBeenCalledWith({ historyId: 'history-1' });
    expect(onConnected).toHaveBeenCalledWith(session);
  });

  it('shows an invalid port error when the backend rejects the port', async () => {
    const user = userEvent.setup();
    const createExternalVncSession = vi.fn(async () => {
      throw new Error('Invalid VNC port.');
    });
    const onConnected = vi.fn();

    window.electronAPI = {
      viewer: { createExternalVncSession }
    } as never;

    render(<ConnectVncDialog open={true} onClose={() => undefined} onConnected={onConnected} />);

    await user.type(screen.getByLabelText('VNC Address'), '192.168.1.10:99999');
    await user.click(screen.getByRole('button', { name: 'Connect' }));

    expect(await screen.findByText('Invalid port format')).toBeInTheDocument();
    expect(onConnected).not.toHaveBeenCalled();
  });

  it('removes a device from recent connections', async () => {
    const user = userEvent.setup();
    const removeExternalVncHistory = vi.fn(async () => ({ ok: true }));
    window.electronAPI = {
      viewer: {
        listExternalVncHistory: vi.fn(async () => [{
          id: 'history-1',
          host: '192.168.1.20',
          port: 5900,
          displayAddress: '192.168.1.20:5900',
          lastConnectedAt: '2026-07-29T00:00:00.000Z',
          hasRememberedPassword: false,
          passwordStorageAvailable: true
        }]),
        removeExternalVncHistory
      }
    } as never;

    render(<ConnectVncDialog open={true} onClose={() => undefined} onConnected={() => undefined} />);
    await screen.findByText('192.168.1.20:5900');
    await user.click(screen.getByRole('button', { name: 'Remove from history' }));

    expect(removeExternalVncHistory).toHaveBeenCalledWith('history-1');
    await waitFor(() => expect(screen.queryByText('192.168.1.20:5900')).not.toBeInTheDocument());
  });

  it('shows a generic connection error for unknown backend errors', async () => {
    const user = userEvent.setup();
    const createExternalVncSession = vi.fn(async () => {
      throw new Error('Something went wrong');
    });
    const onConnected = vi.fn();

    window.electronAPI = {
      viewer: { createExternalVncSession }
    } as never;

    render(<ConnectVncDialog open={true} onClose={() => undefined} onConnected={onConnected} />);

    await user.type(screen.getByLabelText('VNC Address'), '192.168.1.10');
    await user.click(screen.getByRole('button', { name: 'Connect' }));

    expect(await screen.findByText('Could not connect to the target address')).toBeInTheDocument();
    expect(onConnected).not.toHaveBeenCalled();
  });
});
