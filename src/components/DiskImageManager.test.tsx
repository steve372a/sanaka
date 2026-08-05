import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiskImageManager } from './DiskImageManager';

vi.mock('../hooks/useT', () => ({
  useT: () => (key: string) => ({
    'app.close': '关闭',
    'diskManager.title': '镜像管理',
    'diskManager.tabs.import': '导入镜像',
    'diskManager.tabs.browse': '浏览本地',
    'diskManager.tabs.create': '创建镜像',
    'diskManager.tabs.manage': '管理镜像',
    'diskManager.formats.supported': '支持的格式',
    'diskManager.import.title': '导入已有镜像',
    'diskManager.import.description': '选择已有的磁盘镜像文件，将其添加到当前虚拟机。',
    'diskManager.import.button': '选择镜像文件',
    'diskManager.toast.imported': '镜像导入成功'
  })[key] ?? key
}));

afterEach(() => {
  delete window.sanakaWebAPI;
});

describe('DiskImageManager import', () => {
  it('shows a success notice with a circled check after importing an image', async () => {
    const user = userEvent.setup();
    const onDisksChange = vi.fn();
    window.electronAPI = {
      dialogs: {
        pickDisk: vi.fn(async () => ({ path: 'D:\\Images\\windows.qcow2' }))
      }
    } as unknown as Window['electronAPI'];

    render(
      <DiskImageManager
        isOpen
        onClose={() => undefined}
        existingDisks={[]}
        onDisksChange={onDisksChange}
        defaultInterface="virtio"
      />
    );

    await user.click(await screen.findByRole('button', { name: '选择镜像文件' }));

    await waitFor(() => expect(onDisksChange).toHaveBeenCalledTimes(1));
    expect(onDisksChange.mock.calls[0][0][0]).toMatchObject({
      path: 'D:\\Images\\windows.qcow2',
      format: 'qcow2',
      interface: 'virtio',
      boot: true
    });

    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent('镜像导入成功');
    expect(notice).toHaveClass('toast--success');
    expect(notice.querySelector('.toast__icon circle')).not.toBeNull();
    expect(notice.querySelector('.toast__icon path')).not.toBeNull();
  });
});
