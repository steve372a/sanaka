import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppStoreProvider } from '../store/AppStore';
import { WelcomeDialog } from './WelcomeDialog';

describe('WelcomeDialog', () => {
  beforeEach(() => {
    window.electronAPI = {
      app: {
        getMetadata: vi.fn(async () => ({
          name: 'Sanaka',
          version: '0.0.4-beta',
          platform: 'darwin',
          arch: 'arm64',
          userDataPath: '/tmp',
          documentsPath: '/tmp/Documents',
          defaultMachineDirectory: '/tmp/Documents/Sanaka'
        })),
        getWelcomeVideo: vi.fn(async () => ({ available: false, url: null }))
      },
      settings: {
        load: vi.fn(async () => null),
        save: vi.fn(async (settings) => settings)
      },
      recents: {
        list: vi.fn(async () => [])
      },
      runtime: {
        getRuntimeEnvironment: vi.fn(async () => null),
        listRunningMachines: vi.fn(async () => []),
        onRuntimeEvent: vi.fn(() => () => undefined)
      },
      updater: {
        getCurrentInfo: vi.fn(async () => ({ currentVersion: '0.0.4-beta', currentChannel: 'beta', skippedVersion: '' })),
        onUpdateAvailable: vi.fn(() => () => undefined)
      }
    } as unknown as typeof window.electronAPI;
  });

  it('renders translated welcome copy instead of translation keys', async () => {
    render(
      <AppStoreProvider>
        <MemoryRouter>
          <WelcomeDialog open onClose={() => undefined} onNeverRemind={() => undefined} />
        </MemoryRouter>
      </AppStoreProvider>
    );

    expect(await screen.findByRole('heading', { name: '欢迎使用 Sanaka' })).toBeInTheDocument();
    expect(screen.getByText('来见见新版本更新了什么吧！')).toBeInTheDocument();
    expect(screen.queryByText('app.welcome.title')).not.toBeInTheDocument();
  });
});
