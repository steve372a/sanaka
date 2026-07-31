import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  WelcomeVideoService,
  releaseTagForVersion,
  releaseUrlForVersion
} from './WelcomeVideoService';

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

async function makeFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sanaka-welcome-video-'));
  temporaryDirectories.push(root);
  return root;
}

describe('WelcomeVideoService', () => {
  it('maps beta versions to the repository release asset', () => {
    expect(releaseTagForVersion('0.0.4-beta')).toBe('v0.0.4(beta)');
    expect(releaseUrlForVersion('0.0.4-beta')).toBe(
      'https://github.com/steve372a/sanaka/releases/download/v0.0.4(beta)/0.0.4-beta.mp4'
    );
  });

  it('prefers the development video before bundled and cached copies', async () => {
    const root = await makeFixture();
    await fs.mkdir(path.join(root, 'video'), { recursive: true });
    await fs.writeFile(path.join(root, 'video', '0.0.4-beta.mp4'), 'dev');

    const result = await new WelcomeVideoService({
      version: '0.0.4-beta',
      repoRoot: root,
      resourcesPath: path.join(root, 'resources'),
      userDataPath: path.join(root, 'user-data')
    }).resolve();

    expect(result.source).toBe('development');
    expect(await fs.readFile(result.path, 'utf8')).toBe('dev');
  });

  it('downloads an absent video into the user cache atomically', async () => {
    const root = await makeFixture();
    const service = new WelcomeVideoService({
      version: '0.0.4-beta',
      repoRoot: root,
      resourcesPath: path.join(root, 'resources'),
      userDataPath: path.join(root, 'user-data'),
      isPackaged: true,
      fetchImpl: async () => ({ ok: true, arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer })
    });

    const result = await service.resolve();

    expect(result.source).toBe('downloaded');
    expect(await fs.readFile(result.path)).toEqual(Buffer.from([1, 2, 3]));
    await expect(fs.access(`${result.path}.part`)).rejects.toThrow();
  });
});
