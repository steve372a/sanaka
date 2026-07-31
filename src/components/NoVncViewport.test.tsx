import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NoVncViewport } from './NoVncViewport';

interface MockRfbInstance extends EventTarget {
  viewOnly: boolean;
  scaleViewport: boolean;
  resizeSession: boolean;
  background: string;
  clipViewport: boolean;
  qualityLevel: number;
  compressionLevel: number;
  disconnect: ReturnType<typeof vi.fn>;
  sendCredentials: ReturnType<typeof vi.fn>;
  __url?: string;
}

const { MockRfb, rfbInstances } = vi.hoisted(() => {
  const instances: MockRfbInstance[] = [];

  class HoistedMockRfb extends EventTarget {
    viewOnly = false;
    scaleViewport = false;
    resizeSession = false;
    background = '';
    clipViewport = false;
    qualityLevel = 0;
    compressionLevel = 0;
    disconnect = vi.fn();
    sendCredentials = vi.fn();
    __url?: string;

    constructor(target: HTMLElement, url?: string) {
      super();
      this.__url = url;
      instances.push(this);
      target.appendChild(document.createElement('canvas'));
    }
  }

  return {
    MockRfb: HoistedMockRfb,
    rfbInstances: instances
  };
});

vi.mock('@novnc/novnc', () => ({
  default: MockRfb
}));

vi.mock('../hooks/useT', () => ({
  useT: () => (key: string) =>
    ({
      'console.waitingConnection': '等待连接...',
      'console.liveDisplayConnecting': '正在连接画面…',
      'console.liveDisplayReconnecting': '正在恢复画面…',
      'console.liveDisplayUnavailable': '暂时无法连接到虚拟机画面'
    })[key] ?? key
}));

class MockResizeObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
}

vi.stubGlobal('ResizeObserver', MockResizeObserver);
vi.stubGlobal('location', new URL('http://127.0.0.1:39281/'));

describe('NoVncViewport', () => {
  it('uses direct localhost websocket in desktop file mode', async () => {
    vi.useFakeTimers();
    rfbInstances.length = 0;
    vi.stubGlobal('location', new URL('file:///Users/test/Sanaka/index.html'));

    render(
      <NoVncViewport
        active
        machineRunning
        websocketPort={5700}
        initialDelayMs={0}
      />
    );

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    expect(rfbInstances).toHaveLength(1);
    expect(rfbInstances[0].__url).toBe('ws://127.0.0.1:5700');
    vi.useRealTimers();
  });

  it('keeps display disconnection separate from machine power state and retries clean disconnects', async () => {
    vi.useFakeTimers();
    rfbInstances.length = 0;
    vi.stubGlobal('location', new URL('http://127.0.0.1:39281/'));

    render(
      <NoVncViewport
        active
        machineRunning
        websocketPort={5700}
        initialDelayMs={10}
      />
    );

    expect(screen.getByText('等待连接...')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(10);
    });

    expect(screen.getByText('正在连接画面…')).toBeInTheDocument();
    expect(rfbInstances).toHaveLength(1);
    expect(rfbInstances[0].__url).toBe('ws://127.0.0.1:39281/api/novnc?port=5700');

    await act(async () => {
      rfbInstances[0].dispatchEvent(new Event('connect'));
    });

    expect(screen.queryByText('正在连接画面…')).not.toBeInTheDocument();

    await act(async () => {
      rfbInstances[0].dispatchEvent(new CustomEvent('disconnect', { detail: { clean: true } }));
    });

    expect(screen.getByText('正在恢复画面…')).toBeInTheDocument();
    expect(screen.queryByText('关机')).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(rfbInstances).toHaveLength(2);
    vi.useRealTimers();
  });

  it('switches fit and stretch modes without relying on remote resize requests', async () => {
    vi.useFakeTimers();
    rfbInstances.length = 0;
    vi.stubGlobal('location', new URL('http://127.0.0.1:39281/'));

    const { rerender } = render(
      <NoVncViewport
        active
        machineRunning
        websocketPort={5700}
        initialDelayMs={0}
        scaleMode="fit"
      />
    );

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    expect(rfbInstances).toHaveLength(1);
    expect(rfbInstances[0].__url).toBe('ws://127.0.0.1:39281/api/novnc?port=5700');
    expect(rfbInstances[0].scaleViewport).toBe(true);
    expect(rfbInstances[0].resizeSession).toBe(false);

    await act(async () => {
      rerender(
        <NoVncViewport
          active
          machineRunning
          websocketPort={5700}
          initialDelayMs={0}
          scaleMode="stretch"
        />
      );
    });

    expect(rfbInstances[0].scaleViewport).toBe(false);
    expect(rfbInstances[0].resizeSession).toBe(false);
    vi.useRealTimers();
  });

  it('uses the explicit websocketUrl when provided instead of constructing from port', async () => {
    vi.useFakeTimers();
    rfbInstances.length = 0;
    vi.stubGlobal('location', new URL('http://127.0.0.1:39281/'));

    render(
      <NoVncViewport
        active
        machineRunning
        websocketPort={5700}
        websocketUrl="ws://127.0.0.1:39281/api/viewer/vnc/test-session"
        initialDelayMs={0}
      />
    );

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    expect(rfbInstances).toHaveLength(1);
    expect(rfbInstances[0].__url).toBe('ws://127.0.0.1:39281/api/viewer/vnc/test-session');
    vi.useRealTimers();
  });

  it('waits for credentials and sends them through the existing RFB connection', async () => {
    vi.useFakeTimers();
    rfbInstances.length = 0;
    const onCredentialsRequired = vi.fn(async () => ({ password: 'secret' }));

    render(
      <NoVncViewport
        active
        machineRunning
        websocketUrl="ws://127.0.0.1:39281/api/viewer/vnc/test-session"
        initialDelayMs={0}
        onCredentialsRequired={onCredentialsRequired}
      />
    );

    await act(async () => {
      vi.advanceTimersByTime(0);
    });
    await act(async () => {
      rfbInstances[0].dispatchEvent(new Event('credentialsrequired'));
      await Promise.resolve();
    });

    expect(onCredentialsRequired).toHaveBeenCalledTimes(1);
    expect(rfbInstances[0].sendCredentials).toHaveBeenCalledWith({ password: 'secret' });
    expect(rfbInstances).toHaveLength(1);
    vi.useRealTimers();
  });
});
