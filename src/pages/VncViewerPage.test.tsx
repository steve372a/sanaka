import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { VncViewerPage } from './VncViewerPage';
import type { ExternalVncSession } from '../types/electron';

interface MockViewportProps {
  websocketUrl?: string | null;
  password?: string;
  onCredentialsRequired?: () => Promise<{ password?: string } | null>;
  onConnectionStateChange?: (state: string) => void;
  onSecurityFailure?: () => void;
}

const { viewportProps } = vi.hoisted(() => ({
  viewportProps: { current: null as MockViewportProps | null }
}));

vi.mock('../components/NoVncViewport', () => ({
  NoVncViewport: (props: MockViewportProps) => {
    viewportProps.current = props;
    return (
    <div data-testid="novnc-viewport" data-url={props.websocketUrl ?? ''} data-password={props.password ?? ''} />
    );
  }
}));

vi.mock('../hooks/useT', () => ({
  useT: () => (key: string) =>
    ({
      'viewer.title': 'VNC Viewer',
      'viewer.back': 'Back',
      'viewer.disconnect': 'Disconnect',
      'viewer.connected': 'Connected',
      'viewer.connectingState': 'Connecting…',
      'viewer.disconnected': 'Disconnected',
      'viewer.waitingConnection': 'Waiting for connection…',
      'viewer.sessionNotFound': 'This VNC session does not exist or has been closed.',
      'viewer.unavailable': 'Unavailable',
      'viewer.passwordRequiredTitle': 'The remote machine requires a VNC password',
      'viewer.passwordLabel': 'VNC Password',
      'viewer.rememberPassword': 'Remember password',
      'viewer.passwordStorageUnavailable': 'Secure storage unavailable.',
      'viewer.errorAuthFailed': 'Wrong password',
      'viewer.connect': 'Connect',
      'viewer.connecting': 'Connecting…',
      'app.cancel': 'Cancel',
      'console.scaleFit': 'Fit Window',
      'console.scaleNative': '100%',
      'console.scaleStretch': 'Stretch',
      'console.zoom': 'Zoom',
      'console.inputMode': 'Input Mode',
      'console.mouseMode': 'Mouse Mode',
      'console.touchMode': 'Touch Mode'
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
    hasPassword: true,
    activeConnections: 0,
    websocketPath: '/api/viewer/vnc/session-1',
    websocketUrl: 'ws://127.0.0.1:39281/api/viewer/vnc/session-1',
    localWebsocketUrl: 'ws://127.0.0.1:39281/api/viewer/vnc/session-1',
    networkWebsocketUrl: 'ws://192.168.1.8:39281/api/viewer/vnc/session-1',
    ...overrides
  };
}

function renderViewerAt(path: string, state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: path, state }]}>
      <Routes>
        <Route path="/viewer/vnc/:sessionId" element={<VncViewerPage />} />
        <Route path="*" element={<VncViewerPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('VncViewerPage', () => {
  it('loads the session and renders the viewer with the resolved websocket URL', async () => {
    const session = makeSession();
    const getExternalVncSession = vi.fn(async () => session);
    const closeExternalVncSession = vi.fn(async () => ({ ok: true }));

    window.electronAPI = {
      viewer: { getExternalVncSession, closeExternalVncSession }
    } as never;

    vi.stubGlobal('location', new URL('http://127.0.0.1:39281/'));

    renderViewerAt('/viewer/vnc/session-1', { password: 'secret' });

    const viewport = await screen.findByTestId('novnc-viewport');
    expect(viewport).toBeInTheDocument();
    expect(viewport.getAttribute('data-url')).toBe('ws://127.0.0.1:39281/api/viewer/vnc/session-1');
    expect(viewport.getAttribute('data-password')).toBe('');
    expect(getExternalVncSession).toHaveBeenCalledWith('session-1');

    expect(screen.getByText('VNC Viewer')).toBeInTheDocument();
    expect(screen.getByText(/192\.168\.1\.10:5901/)).toBeInTheDocument();
  });

  it('shows a not-found message when the session does not exist', async () => {
    const getExternalVncSession = vi.fn(async () => null);

    window.electronAPI = {
      viewer: { getExternalVncSession }
    } as never;

    vi.stubGlobal('location', new URL('http://127.0.0.1:39281/'));

    renderViewerAt('/viewer/vnc/missing-session');

    expect(await screen.findByText('This VNC session does not exist or has been closed.')).toBeInTheDocument();
    expect(screen.queryByTestId('novnc-viewport')).not.toBeInTheDocument();
  });

  it('disconnects and navigates back when the disconnect button is clicked', async () => {
    const user = userEvent.setup();
    const session = makeSession();
    const getExternalVncSession = vi.fn(async () => session);
    const closeExternalVncSession = vi.fn(async () => ({ ok: true }));

    window.electronAPI = {
      viewer: { getExternalVncSession, closeExternalVncSession }
    } as never;

    vi.stubGlobal('location', new URL('http://127.0.0.1:39281/'));

    renderViewerAt('/viewer/vnc/session-1', { password: '' });

    const disconnectBtn = await screen.findByRole('button', { name: 'Disconnect' });
    await user.click(disconnectBtn);

    await waitFor(() => {
      expect(closeExternalVncSession).toHaveBeenCalledWith('session-1');
    });
  });

  it('asks for a password only when noVNC reports that credentials are required', async () => {
    const user = userEvent.setup();
    const session = makeSession({ hasPassword: false });
    const getExternalVncCredential = vi.fn(async () => ({
      ok: true,
      password: null,
      remembered: false,
      passwordStorageAvailable: true
    }));
    const setExternalVncCredential = vi.fn(async () => ({ ok: true }));

    window.electronAPI = {
      viewer: {
        getExternalVncSession: vi.fn(async () => session),
        closeExternalVncSession: vi.fn(async () => ({ ok: true })),
        getExternalVncCredential,
        setExternalVncCredential
      }
    } as never;
    vi.stubGlobal('location', new URL('http://127.0.0.1:39281/'));

    renderViewerAt('/viewer/vnc/session-1');
    await screen.findByTestId('novnc-viewport');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    let credentialPromise: Promise<{ password?: string } | null> | undefined;
    await act(async () => {
      credentialPromise = viewportProps.current?.onCredentialsRequired?.();
      await Promise.resolve();
    });

    expect(await screen.findByRole('heading', { name: 'The remote machine requires a VNC password' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('VNC Password'), 'secret');
    await user.click(screen.getByLabelText('Remember password'));
    await user.click(screen.getByRole('button', { name: 'Connect' }));

    await expect(credentialPromise).resolves.toEqual({ password: 'secret' });
    expect(setExternalVncCredential).toHaveBeenCalledWith({
      sessionId: 'session-1',
      password: 'secret',
      rememberPassword: true
    });
  });

  it('records the device only after noVNC reaches the connected state', async () => {
    const recordExternalVncConnection = vi.fn(async () => ({ ok: true }));
    window.electronAPI = {
      viewer: {
        getExternalVncSession: vi.fn(async () => makeSession()),
        closeExternalVncSession: vi.fn(async () => ({ ok: true })),
        recordExternalVncConnection
      }
    } as never;
    vi.stubGlobal('location', new URL('http://127.0.0.1:39281/'));

    renderViewerAt('/viewer/vnc/session-1');
    await screen.findByTestId('novnc-viewport');
    expect(recordExternalVncConnection).not.toHaveBeenCalled();

    act(() => viewportProps.current?.onConnectionStateChange?.('connected'));
    await waitFor(() => expect(recordExternalVncConnection).toHaveBeenCalledWith('session-1'));

    act(() => viewportProps.current?.onConnectionStateChange?.('connected'));
    expect(recordExternalVncConnection).toHaveBeenCalledTimes(1);
  });
});
