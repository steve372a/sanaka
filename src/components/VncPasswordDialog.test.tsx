import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { VncPasswordDialog } from './VncPasswordDialog';

vi.mock('../hooks/useT', () => ({
  useT: () => (key: string) =>
    ({
      'viewer.passwordRequiredTitle': '远程机器要求输入VNC密码',
      'viewer.passwordLabel': 'VNC 密码',
      'viewer.rememberPassword': '记住密码',
      'viewer.passwordStorageUnavailable': '当前系统无法安全保存密码。',
      'viewer.errorAuthFailed': '密码错误或目标拒绝连接',
      'viewer.connecting': '正在连接…',
      'viewer.connect': '连接',
      'app.cancel': '取消'
    })[key] ?? key
}));

describe('VncPasswordDialog', () => {
  it('submits the password and remember choice only after the remote requests credentials', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);

    render(
      <VncPasswordDialog
        open
        address="192.168.1.20:5900"
        passwordStorageAvailable
        onCancel={() => undefined}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByRole('heading', { name: '远程机器要求输入VNC密码' })).toBeInTheDocument();
    expect(screen.getByText('192.168.1.20:5900')).toBeInTheDocument();
    await user.type(screen.getByLabelText('VNC 密码'), 'secret');
    await user.click(screen.getByLabelText('记住密码'));
    await user.click(screen.getByRole('button', { name: '连接' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('secret', true));
  });

  it('disables password persistence when secure storage is unavailable', () => {
    render(
      <VncPasswordDialog
        open
        address="server.local:5900"
        passwordStorageAvailable={false}
        onCancel={() => undefined}
        onSubmit={() => undefined}
      />
    );

    expect(screen.getByLabelText('记住密码')).toBeDisabled();
    expect(screen.getByText('当前系统无法安全保存密码。')).toBeInTheDocument();
  });

  it('shows an authentication error after a rejected password', () => {
    render(
      <VncPasswordDialog
        open
        address="server.local:5900"
        passwordStorageAvailable
        authFailed
        onCancel={() => undefined}
        onSubmit={() => undefined}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('密码错误或目标拒绝连接');
  });
});
