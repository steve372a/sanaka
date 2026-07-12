const fs = require('node:fs/promises');
const path = require('node:path');
const { Arch } = require('builder-util');
const { buildArtifactFileName } = require('./artifact-names');

async function resolveArchName(context, filePath) {
  const rawArch = context?.arch;

  if (typeof rawArch === 'number' && typeof Arch[rawArch] === 'string') {
    return Arch[rawArch];
  }

  if (typeof rawArch === 'string') {
    const trimmed = rawArch.trim();
    if (trimmed) {
      if (/^\d+$/.test(trimmed) && typeof Arch[Number(trimmed)] === 'string') {
        return Arch[Number(trimmed)];
      }
      return trimmed;
    }
  }

  const baseName = path.basename(filePath || '');
  const archMatch = baseName.match(/-(x64|x86|ia32|arm64|aarch64|amd64)(?=\.|[-])/i);
  if (archMatch) {
    return archMatch[1].toLowerCase();
  }

  const defaultArch = context?.packager?.platformSpecificBuildOptions?.defaultArch;
  if (typeof defaultArch === 'string' && defaultArch.trim()) {
    return defaultArch.trim();
  }

  try {
    const dirEntries = await fs.readdir(path.dirname(filePath || ''));
    const siblingMatch = dirEntries
      .map((entry) => entry.match(/-(x64|x86|ia32|arm64|aarch64|amd64)(?=\.)/i))
      .find(Boolean);
    if (siblingMatch) {
      return siblingMatch[1].toLowerCase();
    }
  } catch {
    // ignore directory scan failures and fall back to the current host arch
  }

  return process.arch;
}

exports.default = async function artifactBuildCompleted(context) {
  const filePath = context?.file;
  if (!filePath) {
    return;
  }

  const ext = path.extname(filePath).replace(/^\./, '');
  if (!ext) {
    return;
  }

  const electronPlatformName = context.packager?.platform?.nodeName || context.packager?.platform?.buildConfigurationKey || '';
  const archName = await resolveArchName(context, filePath);

  const nextFileName = buildArtifactFileName({
    platform: electronPlatformName,
    arch: archName,
    ext
  });

  if (!nextFileName || path.basename(filePath) === nextFileName) {
    return;
  }

  const nextPath = path.join(path.dirname(filePath), nextFileName);
  await fs.rm(nextPath, { force: true }).catch(() => undefined);
  await fs.rename(filePath, nextPath);
  context.file = nextPath;
};
