import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WebFileBrowser } from './WebFileBrowser';

vi.mock('../hooks/useT', () => ({
  useT: () => (key: string) => key === 'webFiles.protectedHint'
    ? '虚拟机配置和预览由 Sanaka 管理，不会显示在这里。'
    : key
}));

describe('WebFileBrowser', () => {
  const list = vi.fn();
  const upload = vi.fn();

  beforeEach(() => {
    list.mockReset();
    upload.mockReset();
    window.sanakaWebAPI = {
      isWebMode: true,
      files: {
        list,
        upload,
        downloadUrl: (machineRef, relativePath) => `/download/${machineRef}/${relativePath}`
      }
    };
  });

  it('shows only the sandbox roots and lists one file per row', async () => {
    list
      .mockResolvedValueOnce({
        machineRef: 'web-machine:test',
        directory: '',
        entries: [
          { name: 'Media', path: 'Media', kind: 'directory', size: 0, modifiedAt: null },
          { name: 'Disks', path: 'Disks', kind: 'directory', size: 0, modifiedAt: null }
        ]
      })
      .mockResolvedValueOnce({
        machineRef: 'web-machine:test',
        directory: 'Media',
        entries: [
          { name: 'installer.iso', path: 'Media/installer.iso', kind: 'file', size: 1048576, modifiedAt: null }
        ]
      });

    render(<WebFileBrowser machineRef="web-machine:test" />);
    expect(await screen.findByText('webFiles.media')).toBeInTheDocument();
    expect(screen.getByText('webFiles.disks')).toBeInTheDocument();
    expect(screen.queryByText(/machine\.svm/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('webFiles.media'));
    expect(await screen.findByText('installer.iso')).toBeInTheDocument();
    expect(screen.getByTitle('webFiles.download')).toHaveAttribute('href', '/download/web-machine:test/Media/installer.iso');
  });

  it('uploads into the currently opened sandbox directory and refreshes the list', async () => {
    list.mockResolvedValue({ machineRef: 'web-machine:test', directory: 'Media', entries: [] });
    upload.mockResolvedValue({ path: 'Media/new.iso', name: 'new.iso', size: 3 });
    const { container } = render(<WebFileBrowser machineRef="web-machine:test" initialDirectory="Media" />);
    await waitFor(() => expect(list).toHaveBeenCalledWith('web-machine:test', 'Media'));

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['iso'], 'new.iso', { type: 'application/octet-stream' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(upload).toHaveBeenCalledWith('web-machine:test', 'Media', file, expect.any(Function)));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });
});
