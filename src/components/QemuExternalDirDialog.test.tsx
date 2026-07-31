import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { QemuDirectoryScanResult } from '../types/electron';
import { QemuExternalDirDialog } from './QemuExternalDirDialog';

vi.mock('../hooks/useT', () => ({
  useT: () => (key: string, vars?: Record<string, string | number>) => {
    const messages: Record<string, string> = {
      'app.close': 'Close',
      'settings.qemuExternalDirDialogTitle': 'Select QEMU Directory',
      'settings.qemuExternalDirDialogDescription': 'Choose or scan.',
      'settings.qemuExternalDirManualTitle': 'Directory',
      'settings.qemuExternalDirManualHint': 'Choose a directory.',
      'settings.qemuExternalDirPathPlaceholder': 'QEMU path',
      'settings.qemuExternalDirSelectPath': 'Browse',
      'settings.qemuExternalDirCandidatesTitle': 'QEMU on this computer',
      'settings.qemuExternalDirCandidatesHint': 'Scan drives.',
      'settings.qemuExternalDirScanningHint': 'Scanning drives.',
      'settings.qemuExternalDirScan': 'Scan computer',
      'settings.qemuExternalDirStopScan': 'Stop scan',
      'settings.qemuExternalDirScanning': 'Looking for QEMU',
      'settings.qemuExternalDirScanningDetail': 'This can take a while.',
      'settings.qemuExternalDirScanComplete': 'Scan complete',
      'settings.qemuExternalDirScanCancelled': 'Scan stopped',
      'settings.qemuExternalDirNotScanned': 'Not scanned yet',
      'settings.qemuExternalDirNotScannedHint': 'Start a scan.',
      'settings.qemuExternalDirNoCandidates': 'No QEMU installation found',
      'settings.qemuExternalDirNoCandidatesHint': 'Choose manually.',
      'settings.qemuExternalDirUnknownVersion': 'Unknown version',
      'settings.qemuExternalDirTargets': 'Targets',
      'settings.qemuExternalDirChecking': 'Validating…',
      'settings.qemuExternalDirStrictHint': 'No fallback.',
      'settings.qemuExternalDirAutoHint': 'Automatic detection.',
      'settings.qemuExternalDirCancel': 'Cancel',
      'settings.qemuExternalDirApply': 'Apply',
      'settings.qemuExternalDirErrorInvalid': 'No working QEMU installation was found.',
      'settings.qemuExternalDirErrorScan': 'Scan failed.'
    };
    return (messages[key] ?? key).replace('{count}', String(vars?.count ?? '{count}'));
  }
}));

const scanResult: QemuDirectoryScanResult = {
  candidates: [{
    path: '/opt/qemu',
    binaryPath: '/opt/qemu/bin/qemu-system-x86_64',
    version: 'QEMU emulator version 11.0.1',
    targets: ['aarch64', 'x86_64'],
    source: 'system-scan'
  }],
  roots: ['/'],
  scannedDirectories: 120,
  skippedDirectories: 2,
  elapsedMs: 50,
  cancelled: false,
  truncated: false
};

function installApi(overrides: Record<string, unknown> = {}) {
  const runtime = {
    scanQemuDirectories: vi.fn(async () => scanResult),
    cancelQemuDirectoryScan: vi.fn(async () => ({ ok: true, cancelled: false })),
    validateQemuDirectory: vi.fn(async (path: string) => ({
      ok: true,
      candidate: { ...scanResult.candidates[0], path }
    })),
    onRuntimeEvent: vi.fn(() => () => undefined),
    ...overrides
  };
  window.electronAPI = {
    runtime,
    dialogs: { selectFolder: vi.fn(async () => null) }
  } as never;
  return runtime;
}

describe('QemuExternalDirDialog', () => {
  it('scans the computer and selects a verified candidate', async () => {
    const user = userEvent.setup();
    const runtime = installApi();
    const onApply = vi.fn();
    const { container } = render(
      <div data-testid="clipped-parent">
        <QemuExternalDirDialog open initialPath="" onApply={onApply} onClose={() => undefined} />
      </div>
    );

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Scan computer' }));
    expect(await screen.findByText('/opt/qemu')).toBeInTheDocument();
    expect(screen.getByText('QEMU emulator version 11.0.1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /\/opt\/qemu/ }));
    expect(screen.getByDisplayValue('/opt/qemu')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    expect(runtime.validateQemuDirectory).toHaveBeenCalledWith('/opt/qemu');
    expect(onApply).toHaveBeenCalledWith('/opt/qemu');
  });

  it('stops an active scan and cancels when the dialog closes', async () => {
    const user = userEvent.setup();
    let resolveScan: ((result: QemuDirectoryScanResult) => void) | undefined;
    const runtime = installApi({
      scanQemuDirectories: vi.fn(() => new Promise<QemuDirectoryScanResult>((resolve) => {
        resolveScan = resolve;
      }))
    });
    const onClose = vi.fn();
    const { rerender } = render(
      <QemuExternalDirDialog open initialPath="" onApply={() => undefined} onClose={onClose} />
    );

    await user.click(screen.getByRole('button', { name: 'Scan computer' }));
    await user.click(screen.getByRole('button', { name: 'Stop scan' }));
    expect(runtime.cancelQemuDirectoryScan).toHaveBeenCalled();

    rerender(<QemuExternalDirDialog open={false} initialPath="" onApply={() => undefined} onClose={onClose} />);
    await waitFor(() => expect(runtime.cancelQemuDirectoryScan).toHaveBeenCalledTimes(2));
    await act(async () => {
      resolveScan?.({ ...scanResult, candidates: [], cancelled: true });
    });
  });

  it('shows each candidate as soon as the scanner finds it', async () => {
    const user = userEvent.setup();
    let resolveScan: ((result: QemuDirectoryScanResult) => void) | undefined;
    let runtimeHandler: ((event: { type: string; candidate?: typeof scanResult.candidates[number] }) => void) | undefined;
    installApi({
      scanQemuDirectories: vi.fn(() => new Promise<QemuDirectoryScanResult>((resolve) => {
        resolveScan = resolve;
      })),
      onRuntimeEvent: vi.fn((handler) => {
        runtimeHandler = handler;
        return () => undefined;
      })
    });
    render(<QemuExternalDirDialog open initialPath="" onApply={() => undefined} onClose={() => undefined} />);

    await user.click(screen.getByRole('button', { name: 'Scan computer' }));
    act(() => {
      runtimeHandler?.({
        type: 'qemu-directory-scan-candidate',
        candidate: { ...scanResult.candidates[0], version: null }
      });
    });

    expect(screen.getByText('/opt/qemu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop scan' })).toBeInTheDocument();
    await act(async () => {
      resolveScan?.(scanResult);
    });
  });

  it('shows a user-facing error when strict validation fails', async () => {
    const user = userEvent.setup();
    installApi({ validateQemuDirectory: vi.fn(async () => ({ ok: false, errorMessage: 'raw backend error' })) });
    const onApply = vi.fn();
    render(<QemuExternalDirDialog open initialPath="/wrong" onApply={onApply} onClose={() => undefined} />);

    await user.click(screen.getByRole('button', { name: 'Apply' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No working QEMU installation was found.');
    expect(screen.queryByText('raw backend error')).not.toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    installApi();
    const onClose = vi.fn();
    render(<QemuExternalDirDialog open initialPath="" onApply={() => undefined} onClose={onClose} />);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
