const path = require('path');

function redactHostPaths(value) {
  if (typeof value !== 'string' || !value) return value;

  const redact = (candidate) => {
    const normalized = candidate.replace(/[),.;]+$/g, '');
    const suffix = candidate.slice(normalized.length);
    const fileName = normalized.includes('\\')
      ? path.win32.basename(normalized)
      : path.posix.basename(normalized);
    return `[host]/${fileName || 'path'}${suffix}`;
  };

  return value
    .replace(/[A-Za-z]:[\\/][^,"'\r\n]+/g, redact)
    .replace(/(^|[\s=,:"'])(\/(?!api\/workspace\/exports\/)[^,"'\r\n]+)/g, (_match, prefix, candidate) => `${prefix}${redact(candidate)}`);
}

function sanitizeQemuEnvironment(environment) {
  if (!environment || typeof environment !== 'object') return environment;
  return {
    ...environment,
    configuredExternalDir: '',
    effectiveRoot: null,
    errorMessage: redactHostPaths(environment.errorMessage),
    searchRoots: [],
    binaries: Object.fromEntries(
      Object.entries(environment.binaries || {}).map(([key, binary]) => [
        key,
        binary && typeof binary === 'object' ? { ...binary, path: null } : binary
      ])
    ),
    sharedFolders: environment.sharedFolders
      ? {
          ...environment.sharedFolders,
          smb: environment.sharedFolders.smb
            ? {
                ...environment.sharedFolders.smb,
                smbdPath: null,
                reason: redactHostPaths(environment.sharedFolders.smb.reason),
                installHint: redactHostPaths(environment.sharedFolders.smb.installHint)
              }
            : environment.sharedFolders.smb
        }
      : environment.sharedFolders
  };
}

function sanitizeSharedFolderEnvironment(environment) {
  if (!environment || typeof environment !== 'object') return environment;
  return {
    ...environment,
    smbdPath: null,
    reason: redactHostPaths(environment.reason),
    installHint: redactHostPaths(environment.installHint)
  };
}

function sanitizeFullQemuCommand(result) {
  if (!result || typeof result !== 'object') return result;
  return {
    ...result,
    args: (result.args || []).map((item, index) => ({
      ...item,
      raw: index === 0 && !String(item.raw || '').startsWith('-')
        ? (String(item.raw || '').includes('\\')
            ? path.win32.basename(String(item.raw || 'qemu'))
            : path.posix.basename(String(item.raw || 'qemu')))
        : redactHostPaths(String(item.raw || ''))
    }))
  };
}

module.exports = {
  redactHostPaths,
  sanitizeFullQemuCommand,
  sanitizeQemuEnvironment,
  sanitizeSharedFolderEnvironment
};
