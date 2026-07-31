import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WEB_RESTRICTION_EVENT } from '../lib/webMode';
import { ExportMachineDialog } from './ExportMachineDialog';

vi.mock('../hooks/useT', () => ({
  useT: () => (key: string) => ({
    'export.title': 'Export machine',
    'export.originalName': 'Original name',
    'export.basicInfo': 'Basic information',
    'export.machineName': 'Machine name',
    'export.machineNamePlaceholder': 'Machine name',
    'export.author': 'Author',
    'export.authorPlaceholder': 'Author',
    'export.includeContent': 'Include content',
    'export.includeIso': 'Include ISO',
    'export.includeIsoDesc': 'Copy the selected ISO',
    'export.selectDisks': 'Select disks',
    'export.outputSettings': 'Output',
    'export.webDownloadTitle': 'Browser download',
    'export.webDownloadDescription': 'A ZIP will be downloaded.',
    'export.startExport': 'Export',
    'app.close': 'Close'
  })[key] ?? key
}));

afterEach(() => {
  delete window.sanakaWebAPI;
});

describe('ExportMachineDialog web restrictions', () => {
  it('keeps external resources visible but excludes them from browser exports', async () => {
    const user = userEvent.setup();
    const notices: string[] = [];
    const onNotice = (event: Event) => {
      notices.push((event as CustomEvent<{ message: string }>).detail.message);
    };
    window.addEventListener(WEB_RESTRICTION_EVENT, onNotice);
    window.sanakaWebAPI = { isWebMode: true } as Window['sanakaWebAPI'];
    window.electronAPI = {
      machine: {
        onExportProgress: vi.fn(() => () => undefined)
      }
    } as unknown as Window['electronAPI'];

    render(
      <ExportMachineDialog
        open
        onClose={() => undefined}
        machine={{
          id: 'machine-1',
          title: 'Machine',
          path: 'web-machine:machine-1',
          mediaIso: 'web-external:iso/installer.iso',
          disks: [
            { id: 'external', name: 'external.qcow2', path: 'web-external:disk/external.qcow2' },
            { id: 'managed', name: 'system.qcow2', path: 'Disks/system.qcow2' }
          ]
        }}
      />
    );

    const iso = screen.getByRole('checkbox', { name: /Include ISO/ });
    const externalDisk = screen.getByRole('checkbox', { name: /external\.qcow2/ });
    const managedDisk = screen.getByRole('checkbox', { name: /system\.qcow2/ });
    expect(iso).not.toBeChecked();
    expect(externalDisk).not.toBeChecked();
    expect(managedDisk).toBeChecked();

    await user.click(iso);
    await user.click(externalDisk);

    expect(iso).not.toBeChecked();
    expect(externalDisk).not.toBeChecked();
    expect(notices).toEqual([
      '网页版不能修改主机外部文件，请使用桌面版操作。',
      '网页版不能修改主机外部文件，请使用桌面版操作。'
    ]);
    window.removeEventListener(WEB_RESTRICTION_EVENT, onNotice);
  });
});
