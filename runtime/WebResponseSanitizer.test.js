import { describe, expect, it } from 'vitest';
import {
  redactHostPaths,
  sanitizeFullQemuCommand,
  sanitizeQemuEnvironment,
  sanitizeSharedFolderEnvironment
} from './WebResponseSanitizer';

describe('WebResponseSanitizer', () => {
  it('removes host paths from QEMU environments', () => {
    const result = sanitizeQemuEnvironment({
      available: true,
      configuredExternalDir: '/opt/qemu',
      effectiveRoot: '/opt/qemu',
      errorMessage: 'Missing /Users/test/qemu/bin/qemu-system-x86_64',
      searchRoots: ['/opt/qemu/bin'],
      binaries: {
        x86_64: { name: 'qemu-system-x86_64', found: true, path: '/opt/qemu/bin/qemu-system-x86_64', version: '11.0.1' }
      }
    });

    expect(result.configuredExternalDir).toBe('');
    expect(result.effectiveRoot).toBeNull();
    expect(result.searchRoots).toEqual([]);
    expect(result.binaries.x86_64.path).toBeNull();
    expect(JSON.stringify(result)).not.toContain('/opt/qemu');
    expect(JSON.stringify(result)).not.toContain('/Users/test');
  });

  it('redacts absolute paths from command rows and runtime errors', () => {
    const result = sanitizeFullQemuCommand({
      args: [
        { id: 'binary', raw: '/opt/qemu/bin/qemu-system-x86_64' },
        { id: 'drive', raw: 'file=/Users/test/Machine.saka/Disks/system.qcow2,format=qcow2' },
        { id: 'qmp', raw: 'unix:/Users/test/Library/Application Support/Sanaka/runtime/qmp.sock' },
        { id: 'safe', raw: 'file=Disks/system.qcow2,format=qcow2' }
      ]
    });

    expect(result.args[0].raw).toBe('qemu-system-x86_64');
    expect(result.args[1].raw).toContain('[host]/system.qcow2');
    expect(result.args[2].raw).not.toContain('/Users/test');
    expect(result.args[2].raw).not.toContain('Support/Sanaka/runtime');
    expect(result.args[3].raw).toBe('file=Disks/system.qcow2,format=qcow2');
    expect(redactHostPaths('Could not open C:\\Users\\test\\secret.iso')).toContain('[host]/secret.iso');
    expect(redactHostPaths('Could not open C:\\Users\\test\\My VM\\secret.iso')).not.toContain('My VM');
  });

  it('removes shared-folder binary paths from web responses', () => {
    const result = sanitizeSharedFolderEnvironment({
      available: false,
      backend: 'smb',
      smbdPath: '/opt/homebrew/sbin/smbd',
      reason: 'Missing /opt/homebrew/sbin/smbd',
      installHint: 'Install it under /opt/homebrew'
    });

    expect(result.smbdPath).toBeNull();
    expect(JSON.stringify(result)).not.toContain('/opt/homebrew');
  });
});
