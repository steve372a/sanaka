import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiskImageService, formatSizeArgument, normalizeImageFormat, supportsCompression } from './DiskImageService';

describe('DiskImageService helpers', () => {
  it('normalizes common alias formats', () => {
    expect(normalizeImageFormat('img')).toBe('raw');
    expect(normalizeImageFormat('vhd')).toBe('vpc');
    expect(normalizeImageFormat('QCOW2')).toBe('qcow2');
  });

  it('formats disk sizes for qemu-img arguments', () => {
    expect(formatSizeArgument(20, 'GB')).toBe('20G');
    expect(formatSizeArgument(512, 'MB')).toBe('512M');
  });

  it('marks compression support conservatively', () => {
    expect(supportsCompression('qcow2')).toBe(true);
    expect(supportsCompression('qcow')).toBe(true);
    expect(supportsCompression('vmdk')).toBe(false);
  });
});

describe('DiskImageService', () => {
  let execFileImpl;
  let fsImpl;
  let service;

  beforeEach(() => {
    execFileImpl = vi.fn();
    fsImpl = {
      stat: vi.fn(),
      mkdir: vi.fn(async () => undefined),
      mkdtemp: vi.fn(async () => '/tmp/sanaka-reclaim-123'),
      rename: vi.fn(async () => undefined),
      rm: vi.fn(async () => undefined)
    };

    service = new DiskImageService({
      getEnvironment: async () => ({
        binaries: {
          qemuImg: {
            found: true,
            path: '/usr/bin/qemu-img'
          }
        }
      }),
      execFileImpl,
      fsImpl,
      tempRoot: '/tmp'
    });
  });

  it('reads image info from qemu-img info JSON', async () => {
    execFileImpl.mockResolvedValueOnce({
      stdout: JSON.stringify({
        format: 'qcow2',
        'virtual-size': 21474836480,
        'actual-size': 5368709120,
        'full-backing-filename': '/images/base.qcow2'
      }),
      stderr: ''
    });
    fsImpl.stat.mockResolvedValueOnce({ size: 5368709120 });

    const result = await service.getInfo('/images/disk.qcow2');

    expect(execFileImpl).toHaveBeenCalledWith('/usr/bin/qemu-img', ['info', '--output=json', '/images/disk.qcow2']);
    expect(result).toEqual({
      path: '/images/disk.qcow2',
      format: 'qcow2',
      virtualSize: 21474836480,
      actualSize: 5368709120,
      backingFile: '/images/base.qcow2'
    });
  });

  it('creates a new disk image and returns refreshed info', async () => {
    execFileImpl
      .mockResolvedValueOnce({ stdout: '', stderr: '' })
      .mockResolvedValueOnce({
        stdout: JSON.stringify({
          format: 'qcow2',
          'virtual-size': 21474836480,
          'actual-size': 196608
        }),
        stderr: ''
      });
    fsImpl.stat.mockResolvedValueOnce({ size: 196608 });

    const result = await service.create({
      name: 'new-disk',
      directory: '/images',
      size: 20,
      unit: 'GB',
      format: 'qcow2'
    });

    expect(result.ok).toBe(true);
    expect(result.path).toBe('/images/new-disk.qcow2');
    expect(execFileImpl).toHaveBeenNthCalledWith(
      1,
      '/usr/bin/qemu-img',
      ['create', '-f', 'qcow2', '/images/new-disk.qcow2', '20G']
    );
  });

  it('rejects disk image names that can escape the selected directory', async () => {
    const result = await service.create({
      name: '../escape',
      directory: '/images',
      size: 1,
      unit: 'GB',
      format: 'qcow2'
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('must be a file name');
    expect(execFileImpl).not.toHaveBeenCalled();
  });

  it('resizes an image and returns updated info', async () => {
    execFileImpl
      .mockResolvedValueOnce({ stdout: '', stderr: '' })
      .mockResolvedValueOnce({
        stdout: JSON.stringify({
          format: 'qcow2',
          'virtual-size': 32212254720,
          'actual-size': 2147483648
        }),
        stderr: ''
      });
    fsImpl.stat.mockResolvedValueOnce({ size: 2147483648 });

    const result = await service.resize({
      path: '/images/disk.qcow2',
      newSize: 30,
      unit: 'GB'
    });

    expect(result.ok).toBe(true);
    expect(execFileImpl).toHaveBeenNthCalledWith(
      1,
      '/usr/bin/qemu-img',
      ['resize', '/images/disk.qcow2', '30G']
    );
  });

  it('reclaims unused space by converting into a temporary image and swapping it back', async () => {
    execFileImpl
      .mockResolvedValueOnce({
        stdout: JSON.stringify({
          format: 'qcow2',
          'virtual-size': 21474836480,
          'actual-size': 734003200
        }),
        stderr: ''
      })
      .mockResolvedValueOnce({ stdout: '', stderr: '' })
      .mockResolvedValueOnce({
        stdout: JSON.stringify({
          format: 'qcow2',
          'virtual-size': 21474836480,
          'actual-size': 524288000
        }),
        stderr: ''
      })
      .mockResolvedValueOnce({
        stdout: JSON.stringify({
          format: 'qcow2',
          'virtual-size': 21474836480,
          'actual-size': 524288000
        }),
        stderr: ''
      });

    fsImpl.stat
      .mockResolvedValueOnce({ size: 734003200 })
      .mockResolvedValueOnce({ size: 734003200 })
      .mockResolvedValueOnce({ size: 524288000 })
      .mockResolvedValueOnce({ size: 524288000 });

    const result = await service.reclaimSpace('/images/disk.qcow2');

    expect(result.ok).toBe(true);
    expect(result.reclaimedBytes).toBe(209715200);
    expect(fsImpl.rename).toHaveBeenCalledWith('/images/disk.qcow2', '/images/disk.qcow2.sanaka-backup');
    expect(fsImpl.rename).toHaveBeenCalledWith('/tmp/sanaka-reclaim-123/disk.qcow2', '/images/disk.qcow2');
  });
});
