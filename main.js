const { app, BrowserWindow, Menu, clipboard, dialog, ipcMain, nativeImage, safeStorage, screen, shell } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const { pathToFileURL } = require('node:url');
const { parse: parseToml, stringify: stringifyToml } = require('smol-toml');
const { DiskImageService } = require('./runtime/DiskImageService');
const { ExportService } = require('./runtime/ExportService');
const { RuntimeManager } = require('./runtime/RuntimeManager');
const { UpdateService } = require('./runtime/UpdateService');
const { WebModeService } = require('./runtime/WebModeService');
const { WebWorkspaceService } = require('./runtime/WebWorkspaceService');
const { WebExportService } = require('./runtime/WebExportService');
const {
  redactHostPaths,
  sanitizeFullQemuCommand,
  sanitizeQemuEnvironment,
  sanitizeSharedFolderEnvironment
} = require('./runtime/WebResponseSanitizer');
const { ExternalVncViewerService } = require('./runtime/ExternalVncViewerService');
const { ExternalVncHistoryStore } = require('./runtime/ExternalVncHistoryStore');
const { WelcomeVideoService } = require('./runtime/WelcomeVideoService');
const { applyControlledEdit, buildArgList, normalizeCustomArgs, removeControlledArg } = require('./runtime/QemuArgsSync');

const SETTINGS_FILE = 'settings.json';
const RECENTS_FILE = 'recents.json';
const VNC_HISTORY_FILE = 'vnc-history.json';
const MAX_RECENTS = 12;
const MACHINE_CONFIG_FILE = 'machine.svm';
const MACHINE_PREVIEW_FILE = 'preview.png';
const MACHINE_DISKS_DIRECTORY = 'Disks';
const DEFAULT_MACHINE_ROOT = 'Sanaka';
const APP_ICON_PATH = path.join(__dirname, 'assets', 'icons', 'sanakafish.png');
const DEFAULT_WEB_MODE_PORT = 25895;

app.setName('Sanaka');

function readPositiveIntEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

let mainWindow = null;
let pendingSakaPaths = [];
let runtimeManager = null;
let diskImageService = null;
let exportService = null;
let updateService = null;
let webModeService = null;
let webWorkspaceService = null;
let webExportService = null;
let externalVncViewerService = null;
let externalVncHistoryStore = null;
let welcomeVideoService = null;
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
}

function getDistIndexPath() {
  return path.join(__dirname, 'dist', 'index.html');
}

function getAppIcon() {
  const icon = nativeImage.createFromPath(APP_ICON_PATH);
  return icon.isEmpty() ? undefined : icon;
}

function getUserDataPath(fileName) {
  return path.join(app.getPath('userData'), fileName);
}

async function readJsonFile(fileName, fallback) {
  try {
    const raw = await fs.readFile(getUserDataPath(fileName), 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return fallback;
    }
    throw error;
  }
}

async function writeJsonFile(fileName, value) {
  const targetPath = getUserDataPath(fileName);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, JSON.stringify(value, null, 2), 'utf8');
  return value;
}

function emitToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
  if (webModeService) {
    const webPayload = channel === 'runtime:event'
      ? toWebRuntimeEvent(payload)
      : channel === 'machine:export-progress'
        ? toWebExportProgress(payload)
        : payload;
    webModeService.emit(channel, webPayload);
  }
}

function emitRuntimeEvent(payload) {
  emitToRenderer('runtime:event', payload);
}

function emitExportProgress(payload) {
  emitToRenderer('machine:export-progress', payload);
}

function emitUpdateDownloadProgress(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:update-download-progress', payload);
  }
}

function getUpdateService() {
  if (!updateService) {
    const forcedLocalVersion = typeof process.env.SANAKA_UPDATE_LOCAL_VERSION === 'string'
      ? process.env.SANAKA_UPDATE_LOCAL_VERSION.trim()
      : '';
    const forcedRemoteVersion = typeof process.env.SANAKA_UPDATE_REMOTE_VERSION === 'string'
      ? process.env.SANAKA_UPDATE_REMOTE_VERSION.trim()
      : '';
    updateService = new UpdateService({
      appVersion: forcedLocalVersion || app.getVersion(),
      loadSettings: () => readJsonFile(SETTINGS_FILE, null),
      saveSettings: (settings) => writeJsonFile(SETTINGS_FILE, settings),
      emitToRenderer,
      openExternal: (url) => shell.openExternal(url),
      downloadsDirectory: app.getPath('downloads'),
      platform: process.platform,
      arch: process.arch,
      emitDownloadProgress: emitUpdateDownloadProgress,
      forcedRemoteVersion,
      startupDelayMs: readPositiveIntEnv('SANAKA_UPDATE_STARTUP_DELAY_MS', undefined),
      checkIntervalMs: readPositiveIntEnv('SANAKA_UPDATE_INTERVAL_MS', undefined)
    });
  }
  return updateService;
}

async function readEffectiveSettings() {
  const loaded = await readJsonFile(SETTINGS_FILE, null);
  const externalDir = typeof loaded?.qemu?.externalDir === 'string' ? loaded.qemu.externalDir.trim() : '';
  return {
    ...(loaded || {}),
    qemu: {
      externalDir
    },
    webMode: {
      port: Number.isInteger(loaded?.webMode?.port) ? loaded.webMode.port : DEFAULT_WEB_MODE_PORT
    }
  };
}

function getExportService() {
  if (!exportService) {
    exportService = new ExportService({
      platform: process.platform,
      emitProgress: emitExportProgress
    });
  }
  return exportService;
}

function getWebModeService() {
  return webModeService;
}

function getWebWorkspaceService() {
  if (!webWorkspaceService) {
    webWorkspaceService = new WebWorkspaceService();
  }
  return webWorkspaceService;
}

function getWebExportService() {
  if (!webExportService) {
    webExportService = new WebExportService({
      workspace: getWebWorkspaceService(),
      outputDirectory: getUserDataPath('web-exports'),
      platform: process.platform,
      emitProgress: emitExportProgress
    });
  }
  return webExportService;
}

function getExternalVncViewerService() {
  if (!externalVncViewerService) {
    externalVncViewerService = new ExternalVncViewerService();
  }
  return externalVncViewerService;
}

function isVncPasswordStorageAvailable() {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

function getExternalVncHistoryStore() {
  if (!externalVncHistoryStore) {
    externalVncHistoryStore = new ExternalVncHistoryStore({
      load: () => readJsonFile(VNC_HISTORY_FILE, { version: 1, items: [] }),
      save: (payload) => writeJsonFile(VNC_HISTORY_FILE, payload),
      isPasswordStorageAvailable: isVncPasswordStorageAvailable,
      encryptPassword: async (password) => isVncPasswordStorageAvailable()
        ? safeStorage.encryptString(password).toString('base64')
        : null,
      decryptPassword: async (encryptedPassword) => isVncPasswordStorageAvailable()
        ? safeStorage.decryptString(Buffer.from(encryptedPassword, 'base64'))
        : null
    });
  }
  return externalVncHistoryStore;
}

function getWelcomeVideoService() {
  if (!welcomeVideoService) {
    welcomeVideoService = new WelcomeVideoService({
      version: app.getVersion(),
      repoRoot: __dirname,
      resourcesPath: process.resourcesPath,
      userDataPath: app.getPath('userData'),
      isPackaged: app.isPackaged
    });
  }
  return welcomeVideoService;
}

function deriveWebSocketUrl(httpUrl, pathname) {
  if (!httpUrl || !pathname) {
    return null;
  }
  try {
    const parsed = new URL(httpUrl);
    parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
    parsed.pathname = pathname;
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return null;
  }
}

function decorateExternalVncSession(session, serviceState) {
  if (!session) {
    return null;
  }
  const websocketPath = `/api/viewer/vnc/${encodeURIComponent(session.id)}`;
  return {
    ...session,
    websocketPath,
    websocketUrl: deriveWebSocketUrl(serviceState?.url, websocketPath),
    localWebsocketUrl: deriveWebSocketUrl(serviceState?.localUrl, websocketPath),
    networkWebsocketUrl: deriveWebSocketUrl(serviceState?.networkUrl, websocketPath)
  };
}

async function ensureWebModeService() {
  const settings = await readEffectiveSettings();
  const configuredPort = Number.isInteger(settings.webMode?.port) ? settings.webMode.port : DEFAULT_WEB_MODE_PORT;

  if (!webModeService || webModeService.port !== configuredPort) {
    if (webModeService) {
      await webModeService.stop().catch(() => null);
    }

    webModeService = new WebModeService({
      appName: app.getName(),
      appVersion: app.getVersion(),
      port: configuredPort,
      distDir: path.join(__dirname, 'dist'),
      getRuntimeManager: () => getRuntimeManager(),
      webWorkspaceService: getWebWorkspaceService(),
      webExportService: getWebExportService(),
      getExternalVncViewerService: () => getExternalVncViewerService(),
      getRuntimeSummary: async () => {
        const environment = await getRuntimeManager().getRuntimeEnvironment().catch(() => null);
        const runningMachines = await getRuntimeManager().listRunningMachines().catch(() => []);
        return {
          qemuAvailable: Boolean(environment?.available),
          runningMachines: Array.isArray(runningMachines) ? runningMachines.length : 0
        };
      },
      getWelcomeVideoPath: async () => (await getWelcomeVideoService().resolve().catch(() => null))?.path || null,
      invokeHandlers: webInvokeHandlers
    });
  }

  return webModeService;
}

function wrapWebInvoke(handler, mode = 'spread') {
  if (mode === 'none') {
    return () => handler();
  }

  if (mode === 'single') {
    return (arg) => handler(undefined, arg);
  }

  return (...args) => handler(undefined, ...args);
}

function toWebRuntimeState(state) {
  if (!state || typeof state !== 'object') return state;
  const machineRef = state.bundlePath
    ? getWebWorkspaceService().registerMachinePath(state.bundlePath)
    : '';
  return {
    ...state,
    bundlePath: machineRef,
    configPath: machineRef ? `${machineRef}/${MACHINE_CONFIG_FILE}` : '',
    qmpSocketPath: null,
    logPath: '',
    lastError: redactHostPaths(state.lastError),
    sharedFolder: state.sharedFolder
      ? { ...state.sharedFolder, hostPath: undefined, warning: redactHostPaths(state.sharedFolder.warning) }
      : state.sharedFolder,
    clipboardBridge: state.clipboardBridge
      ? { ...state.clipboardBridge, configPath: null, lastError: redactHostPaths(state.clipboardBridge.lastError) }
      : state.clipboardBridge
  };
}

function toWebRuntimeResult(result) {
  if (!result || typeof result !== 'object') return result;
  return { ...result, state: result.state ? toWebRuntimeState(result.state) : result.state };
}

function toWebRuntimeEvent(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  return {
    ...payload,
    state: payload.state ? toWebRuntimeState(payload.state) : payload.state,
    environment: payload.environment ? sanitizeQemuEnvironment(payload.environment) : payload.environment,
    candidate: undefined,
    message: redactHostPaths(payload.message),
    error: redactHostPaths(payload.error)
  };
}

function toWebExportProgress(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const detail = typeof payload.detail === 'string' && payload.detail.startsWith('/api/workspace/exports/')
    ? payload.detail
    : redactHostPaths(payload.detail);
  return {
    ...payload,
    detail,
    error: redactHostPaths(payload.error)
  };
}

function normalizeSakaArg(argv) {
  if (!Array.isArray(argv)) return [];
  return argv
    .filter((item) => typeof item === 'string' && /\.(saka|svm)$/i.test(item))
    .map((item) => path.resolve(item));
}

async function readTextFile(filePath) {
  return fs.readFile(filePath, 'utf8');
}

function normalizeSharedFolderConfig(config = {}) {
  return {
    enabled: Boolean(config.enabled),
    hostPath: String(config.hostPath || ''),
    mode: config.mode === 'readonly' ? 'readonly' : 'readwrite',
    shareName: 'qemu'
  };
}

function normalizeClipboardBridgeConfig(config = {}) {
  return {
    enabled: Boolean(config.enabled),
    mode: 'text',
    autoConnect: config.autoConnect !== false
  };
}

async function filePathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isMachineConfigPath(filePath) {
  return path.basename(filePath).toLowerCase() === MACHINE_CONFIG_FILE;
}

function isConfigLikeFile(filePath) {
  return /\.(saka|svm|toml)$/i.test(filePath);
}

function isLegacySingleFilePath(filePath) {
  return /\.(saka|toml)$/i.test(filePath) && !isMachineConfigPath(filePath);
}

function sanitizeMachineName(value, fallback = 'machine') {
  const normalized = String(value ?? '')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\.+$/g, '');

  return (normalized || fallback).slice(0, 80);
}

function buildBundleDirectoryName(machineName, fallbackName = 'machine') {
  const baseName = sanitizeMachineName(machineName, fallbackName);
  return process.platform === 'darwin' ? `${baseName}.saka` : baseName;
}

async function resolveDefaultMachineDirectory() {
  const settings = await readJsonFile(SETTINGS_FILE, null);
  const configured = typeof settings?.defaultSaveDirectory === 'string' ? settings.defaultSaveDirectory.trim() : '';
  return configured || path.join(app.getPath('documents'), DEFAULT_MACHINE_ROOT);
}

async function ensureDefaultMachineDirectory() {
  const defaultDirectory = path.join(app.getPath('documents'), DEFAULT_MACHINE_ROOT);
  await fs.mkdir(defaultDirectory, { recursive: true });
  return defaultDirectory;
}

async function ensureUniqueBundlePath(rootDirectory, directoryName) {
  const parsed = path.parse(directoryName);
  const base = parsed.name || directoryName;
  const ext = parsed.ext || '';

  let candidate = path.join(rootDirectory, directoryName);
  let resolvedDirectoryName = directoryName;
  let index = 2;

  while (await filePathExists(candidate)) {
    resolvedDirectoryName = `${base} ${index}${ext}`;
    candidate = path.join(rootDirectory, resolvedDirectoryName);
    index += 1;
  }

  return {
    bundlePath: candidate,
    directoryName: resolvedDirectoryName,
    machineName: base === parsed.name ? path.parse(resolvedDirectoryName).name : resolvedDirectoryName
  };
}

function replaceTomlTitle(content, title) {
  const escapedTitle = JSON.stringify(title);
  if (/^title\s*=/m.test(content)) {
    return content.replace(/^title\s*=.*$/m, `title = ${escapedTitle}`);
  }
  return `title = ${escapedTitle}\n${content}`;
}

function toBundlePreviewPath(bundlePath) {
  return path.join(bundlePath, MACHINE_PREVIEW_FILE);
}

function toBundleDisksPath(bundlePath) {
  return path.join(bundlePath, MACHINE_DISKS_DIRECTORY);
}

function toDisplayDiskCapacity(bytes) {
  const value = Number(bytes) || 0;
  if (value >= 1024 ** 3) {
    return { size: Number((value / (1024 ** 3)).toFixed(2)), unit: 'GB' };
  }
  return { size: Number((value / (1024 ** 2)).toFixed(2)), unit: 'MB' };
}

async function resolveOpenedConfig(filePath) {
  if (!filePath) return null;

  const absolutePath = path.resolve(filePath);
  const stats = await fs.stat(absolutePath);

  if (stats.isDirectory()) {
    const configPath = path.join(absolutePath, MACHINE_CONFIG_FILE);
    const content = await readTextFile(configPath);
    const previewPath = (await filePathExists(toBundlePreviewPath(absolutePath))) ? toBundlePreviewPath(absolutePath) : undefined;
    return {
      path: absolutePath,
      configPath,
      previewPath,
      content,
      legacySingleFile: false
    };
  }

  if (isMachineConfigPath(absolutePath)) {
    const bundlePath = path.dirname(absolutePath);
    const content = await readTextFile(absolutePath);
    const previewPath = (await filePathExists(toBundlePreviewPath(bundlePath))) ? toBundlePreviewPath(bundlePath) : undefined;
    return {
      path: bundlePath,
      configPath: absolutePath,
      previewPath,
      content,
      legacySingleFile: false
    };
  }

  const content = await readTextFile(absolutePath);
  return {
    path: absolutePath,
    configPath: absolutePath,
    previewPath: undefined,
    content,
    legacySingleFile: true
  };
}

async function openFileByDialog(options) {
  const result = await dialog.showOpenDialog(mainWindow, options);
  if (result.canceled || !Array.isArray(result.filePaths) || !result.filePaths[0]) {
    return null;
  }
  return result.filePaths[0];
}

function hasAllowedExtension(filePath, allowedExtensions) {
  const lower = path.basename(filePath).toLowerCase();
  return allowedExtensions.some((extension) => lower.endsWith(`.${extension.toLowerCase()}`));
}

async function openAllowedMachinePath({ allowedExtensions, title }) {
  const selectedPath = await openFileByDialog(
    process.platform === 'darwin'
      ? {
          properties: ['openFile', 'openDirectory'],
          treatPackageAsDirectory: false
        }
      : {
          properties: ['openFile'],
          filters: [{ name: title, extensions: allowedExtensions }]
        }
  );

  if (!selectedPath) {
    return null;
  }

  if (!hasAllowedExtension(selectedPath, allowedExtensions)) {
    await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['确定'],
      defaultId: 0,
      message: '请选择 Sanaka 虚拟机配置',
      detail: `当前只支持：${allowedExtensions.map((ext) => `.${ext}`).join('、')}`
    });
    return null;
  }

  return selectedPath;
}

async function openSakaByPath(filePath) {
  return resolveOpenedConfig(filePath);
}

async function resolveSaveTarget(targetPath) {
  if (!targetPath) {
    throw new Error('Missing target path.');
  }

  const absolutePath = path.resolve(targetPath);
  const exists = await filePathExists(absolutePath);

  if (exists) {
    const stats = await fs.stat(absolutePath);
    if (stats.isDirectory()) {
      return {
        bundlePath: absolutePath,
        configPath: path.join(absolutePath, MACHINE_CONFIG_FILE)
      };
    }
  }

  if (isMachineConfigPath(absolutePath)) {
    return {
      bundlePath: path.dirname(absolutePath),
      configPath: absolutePath
    };
  }

  if (!exists && absolutePath.toLowerCase().endsWith('.svm') && !isMachineConfigPath(absolutePath)) {
    const bundlePath = absolutePath.slice(0, -4);
    return {
      bundlePath,
      configPath: path.join(bundlePath, MACHINE_CONFIG_FILE)
    };
  }

  if (!exists && absolutePath.toLowerCase().endsWith('.saka')) {
    return {
      bundlePath: absolutePath,
      configPath: path.join(absolutePath, MACHINE_CONFIG_FILE)
    };
  }

  if (exists && isLegacySingleFilePath(absolutePath)) {
    return {
      bundlePath: absolutePath,
      configPath: absolutePath,
      legacySingleFile: true
    };
  }

  if (isConfigLikeFile(absolutePath)) {
    return {
      bundlePath: absolutePath,
      configPath: absolutePath,
      legacySingleFile: true
    };
  }

  return {
    bundlePath: absolutePath,
    configPath: path.join(absolutePath, MACHINE_CONFIG_FILE)
  };
}

async function createMachineBundleAtDefaultLocation(payload) {
  const rootDirectory = await resolveDefaultMachineDirectory();
  const directoryName = buildBundleDirectoryName(payload.machineName, payload.fallbackName);
  const resolved = await ensureUniqueBundlePath(rootDirectory, directoryName);
  const bundlePath = resolved.bundlePath;
  const configPath = path.join(bundlePath, MACHINE_CONFIG_FILE);
  const content = resolved.machineName === payload.machineName ? payload.content : replaceTomlTitle(payload.content, resolved.machineName);

  await fs.mkdir(bundlePath, { recursive: true });
  await fs.mkdir(toBundleDisksPath(bundlePath), { recursive: true });
  await fs.writeFile(configPath, content, 'utf8');

  return {
    path: bundlePath,
    configPath,
    previewPath: undefined,
    machineName: resolved.machineName
  };
}

function createWindow() {
  const { workAreaSize } = screen.getPrimaryDisplay();
  const appIcon = getAppIcon();
  const minWidth = 960;
  const minHeight = 640;
  const width = Math.max(minWidth, Math.round(workAreaSize.width * 0.6));
  const height = Math.max(minHeight, Math.round(workAreaSize.height * 0.6));

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth,
    minHeight,
    backgroundColor: process.platform === 'darwin' ? '#00000000' : '#f7f3fa',
    vibrancy: process.platform === 'darwin' ? 'sidebar' : undefined,
    visualEffectState: process.platform === 'darwin' ? 'active' : undefined,
    icon: appIcon || APP_ICON_PATH,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(getDistIndexPath());
  }

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[renderer console:${level}] ${sourceId}:${line} ${message}`);
  });

  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error(`[preload error] ${preloadPath}`, error);
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[render-process-gone]', details);
  });

  mainWindow.webContents.on('unresponsive', () => {
    console.error('[renderer] unresponsive');
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[did-fail-load]', { errorCode, errorDescription, validatedURL });
  });

  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingSakaPaths.length > 0) {
      pendingSakaPaths.forEach((filePath) => emitToRenderer('app:open-saka', { path: filePath }));
    }
  });
}

function revealMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
}

function buildMenu() {
  const appSubmenu = [
    {
      label: '关于 Sanaka',
      click: () => emitToRenderer('app:open-about')
    },
    {
      label: '设置',
      click: () => emitToRenderer('app:open-settings')
    },
    { type: 'separator' },
    {
      label: '打开虚拟机配置',
      accelerator: 'CmdOrCtrl+O',
      click: async () => {
        const opened = await ipcHandlers.openMachineBundle();
        if (opened) {
          emitToRenderer('app:open-saka', { path: opened.path });
        }
      }
    }
  ];

  const template =
    process.platform === 'darwin'
      ? [
          {
            label: app.name,
            submenu: [
              ...appSubmenu,
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' }
            ]
          }
        ]
      : [
          {
            label: '选项(&O)',
            submenu: [
              ...appSubmenu,
              { type: 'separator' },
              { role: 'quit', label: '退出' }
            ]
          }
        ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function getRuntimeManager() {
  if (!runtimeManager) {
    runtimeManager = new RuntimeManager({
      app,
      emitEvent: emitRuntimeEvent,
      loadSettings: () => readEffectiveSettings(),
      readClipboardText: () => clipboard.readText(),
      writeClipboardText: (text) => clipboard.writeText(String(text || ''))
    });
  }
  return runtimeManager;
}

function getDiskImageService() {
  if (!diskImageService) {
    diskImageService = new DiskImageService({
      getEnvironment: () => getRuntimeManager().getRuntimeEnvironment()
    });
  }
  return diskImageService;
}

const ipcHandlers = {
  async openExternal(_event, url) {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      throw new Error('Invalid external URL.');
    }
    await shell.openExternal(url);
    return { ok: true };
  },
  async openMachineBundle() {
    const selectedPath = await openAllowedMachinePath({
      allowedExtensions: ['saka', 'svm'],
      title: 'Sanaka Machine'
    });
    return selectedPath ? openSakaByPath(selectedPath) : null;
  },
  async openSaka() {
    const selectedPath = await openAllowedMachinePath({
      allowedExtensions: ['saka', 'svm', 'toml'],
      title: 'Sanaka Config'
    });
    return selectedPath ? openSakaByPath(selectedPath) : null;
  },
  async createMachineBundle(_event, payload) {
    return createMachineBundleAtDefaultLocation(payload);
  },
  async readSaka(_event, filePath) {
    try {
      return await openSakaByPath(filePath);
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  },
  async saveSaka(_event, payload) {
    const resolved = await resolveSaveTarget(payload.path);
    if (resolved.legacySingleFile) {
      await fs.mkdir(path.dirname(resolved.configPath), { recursive: true });
    } else {
      await fs.mkdir(resolved.bundlePath, { recursive: true });
      await fs.mkdir(toBundleDisksPath(resolved.bundlePath), { recursive: true });
    }
    await fs.writeFile(resolved.configPath, payload.content, 'utf8');
    return { path: resolved.bundlePath, configPath: resolved.configPath };
  },
  async saveSakaAs(_event, payload) {
    const defaultName = payload.defaultName || 'machine';
    const defaultPath =
      process.platform === 'darwin'
        ? path.join(app.getPath('documents'), defaultName.toLowerCase().endsWith('.saka') ? defaultName : `${defaultName}.saka`)
        : path.join(app.getPath('documents'), defaultName);
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath,
      filters: [{ name: 'Sanaka Config', extensions: ['svm', 'saka'] }]
    });
    if (result.canceled || !result.filePath) {
      return null;
    }
    const normalizedSelection = process.platform === 'darwin' ? result.filePath.replace(/\.svm$/i, '') : result.filePath.replace(/\.saka$/i, '');
    const targetPath = process.platform === 'darwin' && !normalizedSelection.toLowerCase().endsWith('.saka') ? `${normalizedSelection}.saka` : normalizedSelection;
    const resolved = await resolveSaveTarget(targetPath);
    if (resolved.legacySingleFile) {
      await fs.mkdir(path.dirname(resolved.configPath), { recursive: true });
    } else {
      await fs.mkdir(resolved.bundlePath, { recursive: true });
      await fs.mkdir(toBundleDisksPath(resolved.bundlePath), { recursive: true });
    }
    await fs.writeFile(resolved.configPath, payload.content, 'utf8');
    return { path: resolved.bundlePath, configPath: resolved.configPath };
  },
  async trashMachineBundle(_event, bundlePath) {
    if (!bundlePath) {
      throw new Error('Missing machine path.');
    }
    const absolutePath = path.resolve(bundlePath);
    await shell.trashItem(absolutePath);
    return { ok: true };
  },
  async renamePath(_event, { oldPath, newPath }) {
    if (!oldPath || !newPath) {
      throw new Error('Missing oldPath or newPath');
    }
    const resolvedOld = path.resolve(oldPath);
    const resolvedNew = path.resolve(newPath);
    await fs.rename(resolvedOld, resolvedNew);
    return { ok: true };
  },
  async copyPath(_event, { srcPath, destPath }) {
    if (!srcPath || !destPath) {
      throw new Error('Missing srcPath or destPath');
    }
    const resolvedSrc = path.resolve(srcPath);
    const resolvedDest = path.resolve(destPath);
    await fs.cp(resolvedSrc, resolvedDest, { recursive: true });
    return { ok: true };
  },
  async openPath(_event, filePath) {
    if (!filePath) {
      throw new Error('Missing file path');
    }
    shell.showItemInFolder(path.resolve(filePath));
    return { ok: true };
  },
  async openFolder(_event, folderPath) {
    if (!folderPath) {
      throw new Error('Missing folder path');
    }
    const absolutePath = path.resolve(folderPath);
    if (await filePathExists(absolutePath)) {
      shell.showItemInFolder(absolutePath);
    } else {
      shell.showItemInFolder(path.dirname(absolutePath));
    }
    return { ok: true };
  },
  async pathExists(_event, filePath) {
    if (!filePath) {
      return false;
    }
    return filePathExists(path.resolve(filePath));
  },
  async selectFolder() {
    const selectedPath = await openFileByDialog({
      properties: ['openDirectory', 'createDirectory']
    });
    return selectedPath ? { path: selectedPath } : null;
  },
  async pickDisk() {
    const selectedPath = await openFileByDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Disk Images', extensions: ['qcow2', 'qed', 'qcow', 'vmdk', 'vhd', 'vpc', 'vdi', 'img', 'raw'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    return selectedPath ? { path: selectedPath } : null;
  },
  async getDiskInfo(_event, imagePath) {
    return getDiskImageService().getInfo(imagePath);
  },
  async createDisk(_event, request) {
    return getDiskImageService().create(request || {});
  },
  async prepareManagedDisk(_event, request) {
    if (!request?.bundlePath) {
      throw new Error('Missing machine bundle path.');
    }
    const absoluteBundlePath = path.resolve(request.bundlePath);
    const disksDirectory = toBundleDisksPath(absoluteBundlePath);
    const result = await getDiskImageService().create({
      ...request,
      directory: disksDirectory
    });
    if (!result.ok || !result.path) {
      return result;
    }
    return {
      ...result,
      relativePath: path.posix.join(MACHINE_DISKS_DIRECTORY, path.basename(result.path))
    };
  },
  async resizeDisk(_event, request) {
    return getDiskImageService().resize(request || {});
  },
  async convertDisk(_event, request) {
    return getDiskImageService().convert(request || {});
  },
  async reclaimDiskSpace(_event, imagePath) {
    return getDiskImageService().reclaimSpace(imagePath);
  },
  async listLocalImages(_event, bundlePath) {
    return getDiskImageService().listLocalImages(bundlePath);
  },
  async pickIso() {
    const selectedPath = await openFileByDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Optical Images', extensions: ['iso', 'img'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    return selectedPath ? { path: selectedPath } : null;
  },
  async pickFirmwareCode() {
    const selectedPath = await openFileByDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Firmware Files', extensions: ['fd', 'bin', 'rom', 'img'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    return selectedPath ? { path: selectedPath } : null;
  },
  async pickFirmwareVars() {
    const selectedPath = await openFileByDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Firmware Variable Files', extensions: ['fd', 'bin', 'rom', 'img'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    return selectedPath ? { path: selectedPath } : null;
  },
  async loadSettings() {
    return readEffectiveSettings();
  },
  async saveSettings(_event, settings) {
    const effective = {
      ...(settings || {}),
      qemu: {
        externalDir: typeof settings?.qemu?.externalDir === 'string' ? settings.qemu.externalDir.trim() : ''
      },
      webMode: {
        port: Number.isInteger(settings?.webMode?.port) ? settings.webMode.port : DEFAULT_WEB_MODE_PORT
      }
    };
    return writeJsonFile(SETTINGS_FILE, effective);
  },
  async listRecents() {
    return readJsonFile(RECENTS_FILE, []);
  },
  async pushRecent(_event, entry) {
    const recents = await readJsonFile(RECENTS_FILE, []);
    const next = [entry, ...recents.filter((item) => item.path !== entry.path)].slice(0, MAX_RECENTS);
    await writeJsonFile(RECENTS_FILE, next);
    return next;
  },
  async removeRecent(_event, recentPath) {
    const recents = await readJsonFile(RECENTS_FILE, []);
    const next = recents.filter((item) => item.path !== recentPath);
    await writeJsonFile(RECENTS_FILE, next);
    return next;
  },
  async reorderRecents(_event, orderedPaths) {
    const recents = await readJsonFile(RECENTS_FILE, []);
    const pathSet = new Set(orderedPaths);
    // Create a map for quick lookup
    const recentsMap = new Map(recents.map(r => [r.path, r]));
    // Reorder based on provided paths, keeping any new items at the end
    const ordered = orderedPaths
      .map(path => recentsMap.get(path))
      .filter(Boolean);
    // Add any items not in orderedPaths (new items) at the end
    const remaining = recents.filter(r => !pathSet.has(r.path));
    const next = [...ordered, ...remaining];
    await writeJsonFile(RECENTS_FILE, next);
    return next;
  },
  async getAppMetadata() {
    const defaultMachineDirectory = await ensureDefaultMachineDirectory();
    return {
      name: app.getName(),
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      userDataPath: app.getPath('userData'),
      documentsPath: app.getPath('documents'),
      defaultMachineDirectory
    };
  },
  async getWelcomeVideo() {
    const service = getWelcomeVideoService();
    const resolved = await service.resolve().catch(() => null);
    return {
      available: Boolean(resolved),
      url: resolved ? pathToFileURL(resolved.path).href : null,
      source: resolved?.source || null,
      version: service.version
    };
  },
  async openWebMode() {
    const state = await (await ensureWebModeService()).start();
    const openUrl = state.localUrl || state.url;
    if (!openUrl) {
      throw new Error('Web mode did not provide a usable local URL.');
    }
    console.log(`[web-mode] opened at ${openUrl}`);
    await shell.openExternal(openUrl);
    return state;
  },
  async getWebModeState() {
    const service = await ensureWebModeService();
    return service.getState();
  },
  async stopWebMode() {
    const service = await ensureWebModeService();
    await service.stop();
    return { ok: true };
  },
  consumePendingSakaPaths() {
    const pending = [...pendingSakaPaths];
    pendingSakaPaths = [];
    return pending;
  },
  async detectQemu() {
    return getRuntimeManager().detectQemu();
  },
  async scanQemuDirectories() {
    return getRuntimeManager().scanQemuDirectories();
  },
  cancelQemuDirectoryScan() {
    return { ok: true, cancelled: getRuntimeManager().cancelQemuDirectoryScan() };
  },
  async validateQemuDirectory(_event, directoryPath) {
    return getRuntimeManager().validateQemuDirectory(directoryPath);
  },
  async getUpdaterCurrentInfo() {
    return getUpdateService().getCurrentInfo();
  },
  async checkForUpdates(_event, options) {
    return getUpdateService().checkForUpdates(options || {});
  },
  async downloadLatestUpdate(_event, options) {
    return getUpdateService().downloadLatest(options || {});
  },
  async skipUpdateVersion(_event, version) {
    return getUpdateService().skipVersion(version);
  },
  async openUpdatePage(_event, url) {
    return getUpdateService().openUpdatePage(url);
  },
  async createExternalVncSession(_event, request) {
    const input = request || {};
    let sessionInput = input;
    if (input.historyId) {
      const history = await getExternalVncHistoryStore().getWithCredential(input.historyId);
      if (!history) throw new Error('VNC history entry not found.');
      sessionInput = {
        host: history.host,
        port: history.port,
        historyId: history.id,
        password: history.password || '',
        rememberPassword: Boolean(history.password)
      };
    }
    const session = getExternalVncViewerService().createSession(sessionInput);
    const serviceState = await (await ensureWebModeService()).start();
    return decorateExternalVncSession(session, serviceState);
  },
  async listExternalVncHistory() {
    return getExternalVncHistoryStore().list();
  },
  async removeExternalVncHistory(_event, historyId) {
    return getExternalVncHistoryStore().remove(historyId);
  },
  async getExternalVncCredential(_event, sessionId) {
    const credentials = getExternalVncViewerService().getCredentials(sessionId);
    if (!credentials) return { ok: false, error: 'VNC viewer session not found.' };
    return {
      ok: true,
      password: credentials.password || null,
      remembered: credentials.rememberPassword === true,
      passwordStorageAvailable: getExternalVncHistoryStore().canStorePassword()
    };
  },
  async setExternalVncCredential(_event, request) {
    return getExternalVncViewerService().setCredentials(request?.sessionId, {
      password: request?.password,
      rememberPassword: request?.rememberPassword === true
    });
  },
  async clearExternalVncCredential(_event, request) {
    const session = getExternalVncViewerService().getSession(request?.sessionId);
    if (!session) return { ok: false, error: 'VNC viewer session not found.' };
    getExternalVncViewerService().clearCredentials(session.id);
    if (request?.forgetRemembered === true && session.historyId) {
      await getExternalVncHistoryStore().clearRememberedPassword(session.historyId);
    }
    return { ok: true };
  },
  async recordExternalVncConnection(_event, sessionId) {
    const service = getExternalVncViewerService();
    const session = service.getSession(sessionId);
    const credentials = service.getCredentials(sessionId);
    if (!session || !credentials) return { ok: false, error: 'VNC viewer session not found.' };
    const entry = await getExternalVncHistoryStore().recordConnection({
      host: session.host,
      port: session.port,
      displayAddress: session.displayAddress,
      password: credentials.password,
      rememberPassword: credentials.rememberPassword
    });
    service.attachHistory(session.id, entry.id);
    return { ok: true, entry };
  },
  async getExternalVncSession(_event, sessionId) {
    const session = getExternalVncViewerService().getSession(sessionId);
    const serviceState = webModeService ? webModeService.getState() : null;
    return decorateExternalVncSession(session, serviceState);
  },
  async listExternalVncSessions() {
    const serviceState = webModeService ? webModeService.getState() : null;
    return getExternalVncViewerService().listSessions().map((session) => decorateExternalVncSession(session, serviceState));
  },
  async closeExternalVncSession(_event, sessionId) {
    const result = getExternalVncViewerService().closeSession(sessionId);
    const serviceState = webModeService ? webModeService.getState() : null;
    return {
      ...result,
      session: decorateExternalVncSession(result.session || null, serviceState) || undefined
    };
  },
  async getRuntimeEnvironment() {
    return getRuntimeManager().getRuntimeEnvironment();
  },
  async buildQemuArgList(_event, machine) {
    return {
      args: buildArgList(machine)
    };
  },
  async getFullQemuCommand(_event, machine) {
    return getRuntimeManager().getFullQemuCommand(machine);
  },
  async applyControlledQemuArgEdit(_event, payload) {
    const machine = payload?.machine;
    const bindingKey = payload?.bindingKey;
    const raw = payload?.raw;
    const nextMachine = applyControlledEdit(machine, bindingKey, raw);
    if (!nextMachine) {
      return {
        ok: false,
        error: 'Invalid controlled QEMU argument value.'
      };
    }
    return {
      ok: true,
      machine: nextMachine,
      args: buildArgList(nextMachine)
    };
  },
  async removeControlledQemuArg(_event, payload) {
    const machine = payload?.machine;
    const bindingKey = payload?.bindingKey;
    const nextMachine = removeControlledArg(machine, bindingKey);
    if (!nextMachine) {
      return {
        ok: false,
        error: 'Controlled QEMU argument cannot be removed.'
      };
    }
    return {
      ok: true,
      machine: nextMachine,
      args: buildArgList(nextMachine)
    };
  },
  async normalizeCustomQemuArgs(_event, payload) {
    const machine = payload?.machine;
    const customArgs = Array.isArray(payload?.customArgs) ? payload.customArgs : [];
    const result = normalizeCustomArgs(machine, customArgs);
    return {
      ok: true,
      machine: result.machine,
      args: result.args
    };
  },
  async getSharedFolderEnvironment() {
    return getRuntimeManager().getSharedFolderEnvironment();
  },
  async previewMachineCommand(_event, bundlePath) {
    return getRuntimeManager().previewMachineCommand(bundlePath);
  },
  async startMachine(_event, bundlePath) {
    return getRuntimeManager().startMachine(bundlePath);
  },
  async stopMachine(_event, machineId) {
    return getRuntimeManager().stopMachine(machineId);
  },
  async forceStopMachine(_event, machineId) {
    return getRuntimeManager().forceStopMachine(machineId);
  },
  async resetMachine(_event, payload) {
    return getRuntimeManager().resetMachine(payload?.machineId, payload?.mode);
  },
  async changeMedia(_event, payload) {
    return getRuntimeManager().changeMedia(payload?.machineId, payload?.isoPath, payload?.drive);
  },
  async mountBundledTestNetIso(_event, machineId) {
    return getRuntimeManager().mountBundledTestNetIso(machineId);
  },
  async mountSanakaToolsIso(_event, machineId) {
    return getRuntimeManager().mountSanakaToolsIso(machineId);
  },
  async mountSanakaToolsLinuxIso(_event, machineId) {
    return getRuntimeManager().mountSanakaToolsLinuxIso(machineId);
  },
  async getMachineState(_event, machineId) {
    return getRuntimeManager().getMachineState(machineId);
  },
  async getWebAudioState(_event, machineId) {
    return getRuntimeManager().getWebAudioState(machineId);
  },
  async listRunningMachines() {
    return getRuntimeManager().listRunningMachines();
  },
  async updateSharedFolder() {
    return {
      ok: false,
      error: 'Shared folders are unavailable in this version.',
      pendingRestart: false,
      state: null
    };
  },
  async updateClipboardBridge(_event, machinePath, config) {
    return getRuntimeManager().updateClipboardBridge(machinePath, normalizeClipboardBridgeConfig(config));
  },
  async exportMachine(_event, options) {
    return getExportService().exportMachine(options || {});
  },
  async cancelExport(_event, taskId) {
    return getExportService().cancelExport(taskId);
  }
};

const webInvokeHandlers = {
  files: {
    openMachineBundle: () => null,
    openSaka: () => null,
    createMachineBundle: async (payload) => {
      const result = await ipcHandlers.createMachineBundle(undefined, {
        ...payload,
        content: getWebWorkspaceService().prepareNewMachineContent(payload?.content)
      });
      const machineRef = getWebWorkspaceService().registerMachinePath(result.path);
      return { path: machineRef, configPath: `${machineRef}/${MACHINE_CONFIG_FILE}`, machineName: result.machineName };
    },
    readSaka: (machineRef) => getWebWorkspaceService().readMachine(machineRef),
    saveSaka: (payload) => getWebWorkspaceService().saveMachine(payload?.path, payload?.content),
    saveSakaAs: async (payload) => {
      const result = await ipcHandlers.createMachineBundle(undefined, {
        machineName: payload?.defaultName,
        fallbackName: 'machine',
        content: getWebWorkspaceService().prepareNewMachineContent(payload?.content)
      });
      const machineRef = getWebWorkspaceService().registerMachinePath(result.path);
      return { path: machineRef, configPath: `${machineRef}/${MACHINE_CONFIG_FILE}`, machineName: result.machineName };
    },
    trashMachineBundle: async (machineRef) => ipcHandlers.trashMachineBundle(undefined, getWebWorkspaceService().resolveMachineRef(machineRef)),
    pathExists: async (machineRef) => {
      try {
        await getWebWorkspaceService().resolveValidatedMachineRef(machineRef);
        return true;
      } catch (error) {
        if (error?.code === 'ENOENT') return false;
        throw error;
      }
    }
  },
  disks: {
    prepareManaged: async (request) => {
      const workspace = getWebWorkspaceService();
      const safeRequest = workspace.sanitizeManagedDiskRequest(request?.bundlePath, request);
      const directory = await workspace.ensureSandboxDirectory(request?.bundlePath, MACHINE_DISKS_DIRECTORY);
      const { bundlePath: _bundlePath, ...createRequest } = safeRequest;
      const result = await getDiskImageService().create({ ...createRequest, directory });
      return {
        ...result,
        path: undefined,
        relativePath: result.ok && result.path
          ? path.posix.join(MACHINE_DISKS_DIRECTORY, path.basename(result.path))
          : result.relativePath
      };
    },
    listLocalImages: async (machineRef) => {
      const workspace = getWebWorkspaceService();
      const listing = await workspace.listFiles(machineRef, MACHINE_DISKS_DIRECTORY);
      const images = [];
      for (const entry of listing.entries) {
        if (entry.kind !== 'file' || !/\.(qcow2|qed|qcow|vmdk|vhd|vpc|vdi|img|raw)$/i.test(entry.name)) continue;
        const absolutePath = await workspace.resolveSandboxPath(machineRef, entry.path, { mustExist: true });
        let format = path.extname(entry.name).slice(1).toLowerCase();
        let bytes = entry.size;
        try {
          const info = await getDiskImageService().getInfo(absolutePath);
          format = info.format || format;
          bytes = info.virtualSize || bytes;
        } catch {
          // Uploaded raw files can still be listed when qemu-img cannot inspect them.
        }
        const capacity = toDisplayDiskCapacity(bytes);
        images.push({
          path: entry.path,
          name: path.parse(entry.name).name,
          format: format === 'img' ? 'raw' : format,
          size: capacity.size,
          unit: capacity.unit
        });
      }
      return { images };
    }
  },
  settings: {
    load: async () => {
      const settings = await ipcHandlers.loadSettings();
      return {
        ...settings,
        defaultSaveDirectory: '',
        qemu: { externalDir: '' },
        templateCatalog: (settings.templateCatalog || []).map((entry) => ({ ...entry, path: '' }))
      };
    },
    save: async (settings) => {
      const current = await ipcHandlers.loadSettings();
      const currentTemplates = new Map((current.templateCatalog || []).map((entry) => [entry.key, entry]));
      return ipcHandlers.saveSettings(undefined, {
        ...settings,
        defaultSaveDirectory: current.defaultSaveDirectory,
        qemu: current.qemu,
        templateCatalog: (settings.templateCatalog || []).map((entry) => ({
          ...entry,
          path: currentTemplates.get(entry.key)?.path || ''
        }))
      });
    }
  },
  recents: {
    list: async () => getWebWorkspaceService().toWebRecents(await ipcHandlers.listRecents()),
    push: async (entry) => {
      const hostEntry = getWebWorkspaceService().toHostRecent(entry);
      const existing = (await ipcHandlers.listRecents()).find((item) => item.path === hostEntry.path);
      return getWebWorkspaceService().toWebRecents(
        await ipcHandlers.pushRecent(undefined, {
          ...hostEntry,
          previewImageUrl: existing?.previewImageUrl
        })
      );
    },
    remove: async (machineRef) => getWebWorkspaceService().toWebRecents(
      await ipcHandlers.removeRecent(undefined, getWebWorkspaceService().resolveMachineRef(machineRef))
    ),
    reorder: async (machineRefs) => getWebWorkspaceService().toWebRecents(
      await ipcHandlers.reorderRecents(undefined, (machineRefs || []).map((entry) => getWebWorkspaceService().resolveMachineRef(entry)))
    )
  },
  webWorkspace: {
    renameMachine: async (payload) => {
      const service = getWebWorkspaceService();
      const oldBundlePath = service.resolveMachineRef(payload?.machineRef);
      const recents = await ipcHandlers.listRecents();
      const existing = recents.find((entry) => entry.path === oldBundlePath);
      const result = await service.renameMachine(payload?.machineRef, payload?.name);
      await ipcHandlers.removeRecent(undefined, oldBundlePath);
      const next = await ipcHandlers.pushRecent(undefined, {
        ...(existing || {}),
        id: payload?.machineId || existing?.id,
        title: result.title,
        path: result.bundlePath,
        updatedAt: new Date().toISOString(),
        previewImageUrl: existing?.previewImageUrl
      });
      return { ok: true, path: result.machineRef, title: result.title, recents: service.toWebRecents(next) };
    },
    duplicateMachine: async (payload) => {
      const service = getWebWorkspaceService();
      const sourceBundlePath = service.resolveMachineRef(payload?.machineRef);
      const existing = (await ipcHandlers.listRecents()).find((entry) => entry.path === sourceBundlePath);
      const result = await service.duplicateMachine(payload?.machineRef, payload?.name);
      const next = await ipcHandlers.pushRecent(undefined, {
        ...(existing || {}),
        id: result.machine.id,
        title: result.machine.title,
        path: result.bundlePath,
        updatedAt: result.machine.updated_at || new Date().toISOString(),
        previewImageUrl: undefined
      });
      return { ok: true, path: result.machineRef, machineId: result.machine.id, recents: service.toWebRecents(next) };
    }
  },
  runtime: {
    detectQemu: async () => sanitizeQemuEnvironment(await ipcHandlers.detectQemu()),
    getRuntimeEnvironment: async () => sanitizeQemuEnvironment(await ipcHandlers.getRuntimeEnvironment()),
    getSharedFolderEnvironment: async () => sanitizeSharedFolderEnvironment(
      await ipcHandlers.getSharedFolderEnvironment()
    ),
    buildQemuArgList: async (machine) => ipcHandlers.buildQemuArgList(
      undefined,
      getWebWorkspaceService().prepareRuntimePreviewMachine(machine)
    ),
    getFullQemuCommand: async (machine) => sanitizeFullQemuCommand(
      await getRuntimeManager().getFullQemuCommand(
        getWebWorkspaceService().prepareRuntimePreviewMachine(machine),
        { resolvePaths: false }
      )
    ),
    applyControlledQemuArgEdit: async (payload) => ipcHandlers.applyControlledQemuArgEdit(undefined, {
      ...payload,
      machine: getWebWorkspaceService().prepareRuntimePreviewMachine(payload?.machine)
    }),
    removeControlledQemuArg: async (payload) => ipcHandlers.removeControlledQemuArg(undefined, {
      ...payload,
      machine: getWebWorkspaceService().prepareRuntimePreviewMachine(payload?.machine)
    }),
    normalizeCustomQemuArgs: async () => {
      throw Object.assign(new Error('Web mode cannot modify custom QEMU arguments.'), { code: 'CUSTOM_QEMU_ARGS_DENIED' });
    },
    startMachine: async (machineRef) => toWebRuntimeResult(
      await ipcHandlers.startMachine(
        undefined,
        await getWebWorkspaceService().resolveValidatedMachineRef(machineRef)
      )
    ),
    stopMachine: async (machineId) => toWebRuntimeResult(await ipcHandlers.stopMachine(undefined, machineId)),
    forceStopMachine: async (machineId) => toWebRuntimeResult(await ipcHandlers.forceStopMachine(undefined, machineId)),
    resetMachine: async (payload) => toWebRuntimeResult(await ipcHandlers.resetMachine(undefined, payload)),
    changeMedia: async (payload) => {
      const state = await ipcHandlers.getMachineState(undefined, payload?.machineId);
      if (!state?.bundlePath) {
        throw new Error('The running machine is unavailable.');
      }
      const machineRef = getWebWorkspaceService().registerMachinePath(state.bundlePath);
      const isoPath = payload?.isoPath
        ? await getWebWorkspaceService().resolveSandboxPath(machineRef, payload.isoPath, { mustExist: true })
        : '';
      return toWebRuntimeResult(await ipcHandlers.changeMedia(undefined, { ...payload, isoPath }));
    },
    mountBundledTestNetIso: wrapWebInvoke(ipcHandlers.mountBundledTestNetIso, 'single'),
    mountSanakaToolsIso: wrapWebInvoke(ipcHandlers.mountSanakaToolsIso, 'single'),
    mountSanakaToolsLinuxIso: wrapWebInvoke(ipcHandlers.mountSanakaToolsLinuxIso, 'single'),
    getMachineState: async (machineId) => toWebRuntimeState(await ipcHandlers.getMachineState(undefined, machineId)),
    getWebAudioState: wrapWebInvoke(ipcHandlers.getWebAudioState, 'single'),
    listRunningMachines: async () => (await ipcHandlers.listRunningMachines()).map(toWebRuntimeState)
  },
  machine: {
    updateClipboardBridge: async (machineRef, config) => ipcHandlers.updateClipboardBridge(
      undefined,
      await getWebWorkspaceService().resolveValidatedMachineRef(machineRef),
      config
    ),
    exportMachine: (options) => getWebExportService().start(options),
    cancelExport: (taskId) => getWebExportService().cancel(taskId)
  },
  updater: {
    getCurrentInfo: wrapWebInvoke(ipcHandlers.getUpdaterCurrentInfo, 'none'),
    checkForUpdates: wrapWebInvoke(ipcHandlers.checkForUpdates, 'single'),
    skipVersion: wrapWebInvoke(ipcHandlers.skipUpdateVersion, 'single'),
    openUpdatePage: wrapWebInvoke(ipcHandlers.openUpdatePage, 'single')
  },
  viewer: {
    createExternalVncSession: wrapWebInvoke(ipcHandlers.createExternalVncSession, 'single'),
    listExternalVncHistory: wrapWebInvoke(ipcHandlers.listExternalVncHistory, 'none'),
    removeExternalVncHistory: wrapWebInvoke(ipcHandlers.removeExternalVncHistory, 'single'),
    getExternalVncCredential: wrapWebInvoke(ipcHandlers.getExternalVncCredential, 'single'),
    setExternalVncCredential: wrapWebInvoke(ipcHandlers.setExternalVncCredential, 'single'),
    clearExternalVncCredential: wrapWebInvoke(ipcHandlers.clearExternalVncCredential, 'single'),
    recordExternalVncConnection: wrapWebInvoke(ipcHandlers.recordExternalVncConnection, 'single'),
    getExternalVncSession: wrapWebInvoke(ipcHandlers.getExternalVncSession, 'single'),
    listExternalVncSessions: wrapWebInvoke(ipcHandlers.listExternalVncSessions, 'none'),
    closeExternalVncSession: wrapWebInvoke(ipcHandlers.closeExternalVncSession, 'single'),
    reserveExternalVncProxyTarget: wrapWebInvoke((_event, sessionId) => getExternalVncViewerService().reserveProxyTarget(sessionId), 'single'),
    markExternalVncProxyConnected: wrapWebInvoke((_event, sessionId) => getExternalVncViewerService().markProxyConnected(sessionId), 'single'),
    releaseExternalVncProxyTarget: wrapWebInvoke((_event, sessionId, options) => getExternalVncViewerService().releaseProxyTarget(sessionId, options || {}), 'spread')
  },
  app: {
    getMetadata: async () => {
      const metadata = await ipcHandlers.getAppMetadata();
      return { ...metadata, userDataPath: '', documentsPath: '', defaultMachineDirectory: '' };
    },
    getWelcomeVideo: async () => {
      const service = getWelcomeVideoService();
      const resolved = await service.resolve().catch(() => null);
      return {
        available: Boolean(resolved),
        url: resolved ? `/video/${encodeURIComponent(resolved.fileName)}` : null,
        source: resolved?.source || null,
        version: service.version
      };
    },
    consumePendingSakaPaths: () => [],
    openExternal: wrapWebInvoke(ipcHandlers.openExternal, 'single')
  }
};

function normalizeBundlePathForUpdate(machinePath) {
  const absolutePath = path.resolve(machinePath);
  if (path.basename(absolutePath).toLowerCase() === MACHINE_CONFIG_FILE) {
    return {
      bundlePath: path.dirname(absolutePath),
      configPath: absolutePath
    };
  }

  return {
    bundlePath: absolutePath,
    configPath: path.join(absolutePath, MACHINE_CONFIG_FILE)
  };
}

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  pendingSakaPaths.push(filePath);
  revealMainWindow();
  emitToRenderer('app:open-saka', { path: filePath });
});

app.on('second-instance', (_event, argv) => {
  const startupSakaPaths = normalizeSakaArg(argv.slice(1));
  if (startupSakaPaths.length > 0) {
    pendingSakaPaths.push(...startupSakaPaths);
    startupSakaPaths.forEach((filePath) => emitToRenderer('app:open-saka', { path: filePath }));
  }
  revealMainWindow();
});

app.whenReady().then(() => {
  const appIcon = getAppIcon();
  if (process.platform === 'darwin' && appIcon) {
    app.dock.setIcon(appIcon);
  }

  buildMenu();
  createWindow();

  const startupSakaPaths = normalizeSakaArg(process.argv.slice(1));
  if (startupSakaPaths.length > 0) {
    pendingSakaPaths.push(...startupSakaPaths);
  }

  void getRuntimeManager().initialize();
  getUpdateService().initialize();

  ipcMain.handle('files:open-machine-bundle', ipcHandlers.openMachineBundle);
  ipcMain.handle('files:open-saka', ipcHandlers.openSaka);
  ipcMain.handle('files:create-machine-bundle', ipcHandlers.createMachineBundle);
  ipcMain.handle('files:read-saka', ipcHandlers.readSaka);
  ipcMain.handle('files:save-saka', ipcHandlers.saveSaka);
  ipcMain.handle('files:save-saka-as', ipcHandlers.saveSakaAs);
  ipcMain.handle('files:trash-machine-bundle', ipcHandlers.trashMachineBundle);
  ipcMain.handle('files:rename-path', ipcHandlers.renamePath);
  ipcMain.handle('files:copy-path', ipcHandlers.copyPath);
  ipcMain.handle('files:open-path', ipcHandlers.openPath);
  ipcMain.handle('files:open-folder', ipcHandlers.openFolder);
  ipcMain.handle('files:path-exists', ipcHandlers.pathExists);
  ipcMain.handle('dialogs:select-folder', ipcHandlers.selectFolder);
  ipcMain.handle('dialogs:pick-disk', ipcHandlers.pickDisk);
  ipcMain.handle('dialogs:pick-iso', ipcHandlers.pickIso);
  ipcMain.handle('dialogs:pick-firmware-code', ipcHandlers.pickFirmwareCode);
  ipcMain.handle('dialogs:pick-firmware-vars', ipcHandlers.pickFirmwareVars);
  ipcMain.handle('disks:get-info', ipcHandlers.getDiskInfo);
  ipcMain.handle('disks:create', ipcHandlers.createDisk);
  ipcMain.handle('disks:prepare-managed', ipcHandlers.prepareManagedDisk);
  ipcMain.handle('disks:resize', ipcHandlers.resizeDisk);
  ipcMain.handle('disks:convert', ipcHandlers.convertDisk);
  ipcMain.handle('disks:reclaim-space', ipcHandlers.reclaimDiskSpace);
  ipcMain.handle('disks:list-local-images', ipcHandlers.listLocalImages);
  ipcMain.handle('settings:load', ipcHandlers.loadSettings);
  ipcMain.handle('settings:save', ipcHandlers.saveSettings);
  ipcMain.handle('recents:list', ipcHandlers.listRecents);
  ipcMain.handle('recents:push', ipcHandlers.pushRecent);
  ipcMain.handle('recents:remove', ipcHandlers.removeRecent);
  ipcMain.handle('recents:reorder', ipcHandlers.reorderRecents);
  ipcMain.handle('app:get-metadata', ipcHandlers.getAppMetadata);
  ipcMain.handle('app:get-welcome-video', ipcHandlers.getWelcomeVideo);
  ipcMain.handle('app:open-web-mode', ipcHandlers.openWebMode);
  ipcMain.handle('app:get-web-mode-state', ipcHandlers.getWebModeState);
  ipcMain.handle('app:stop-web-mode', ipcHandlers.stopWebMode);
  ipcMain.handle('app:consume-pending-saka-paths', ipcHandlers.consumePendingSakaPaths);
  ipcMain.handle('app:open-external', ipcHandlers.openExternal);
  ipcMain.handle('updater:get-current-info', ipcHandlers.getUpdaterCurrentInfo);
  ipcMain.handle('updater:check-for-updates', ipcHandlers.checkForUpdates);
  ipcMain.handle('updater:download-latest', ipcHandlers.downloadLatestUpdate);
  ipcMain.handle('updater:skip-version', ipcHandlers.skipUpdateVersion);
  ipcMain.handle('updater:open-update-page', ipcHandlers.openUpdatePage);
  ipcMain.handle('viewer:create-external-vnc-session', ipcHandlers.createExternalVncSession);
  ipcMain.handle('viewer:list-external-vnc-history', ipcHandlers.listExternalVncHistory);
  ipcMain.handle('viewer:remove-external-vnc-history', ipcHandlers.removeExternalVncHistory);
  ipcMain.handle('viewer:get-external-vnc-credential', ipcHandlers.getExternalVncCredential);
  ipcMain.handle('viewer:set-external-vnc-credential', ipcHandlers.setExternalVncCredential);
  ipcMain.handle('viewer:clear-external-vnc-credential', ipcHandlers.clearExternalVncCredential);
  ipcMain.handle('viewer:record-external-vnc-connection', ipcHandlers.recordExternalVncConnection);
  ipcMain.handle('viewer:get-external-vnc-session', ipcHandlers.getExternalVncSession);
  ipcMain.handle('viewer:list-external-vnc-sessions', ipcHandlers.listExternalVncSessions);
  ipcMain.handle('viewer:close-external-vnc-session', ipcHandlers.closeExternalVncSession);
  ipcMain.handle('runtime:detect-qemu', ipcHandlers.detectQemu);
  ipcMain.handle('runtime:scan-qemu-directories', ipcHandlers.scanQemuDirectories);
  ipcMain.handle('runtime:cancel-qemu-directory-scan', ipcHandlers.cancelQemuDirectoryScan);
  ipcMain.handle('runtime:validate-qemu-directory', ipcHandlers.validateQemuDirectory);
  ipcMain.handle('runtime:get-environment', ipcHandlers.getRuntimeEnvironment);
  ipcMain.handle('runtime:get-shared-folder-environment', ipcHandlers.getSharedFolderEnvironment);
  ipcMain.handle('runtime:build-qemu-arg-list', ipcHandlers.buildQemuArgList);
  ipcMain.handle('runtime:get-full-qemu-command', ipcHandlers.getFullQemuCommand);
  ipcMain.handle('runtime:apply-controlled-qemu-arg-edit', ipcHandlers.applyControlledQemuArgEdit);
  ipcMain.handle('runtime:remove-controlled-qemu-arg', ipcHandlers.removeControlledQemuArg);
  ipcMain.handle('runtime:normalize-custom-qemu-args', ipcHandlers.normalizeCustomQemuArgs);
  ipcMain.handle('runtime:preview-machine-command', ipcHandlers.previewMachineCommand);
  ipcMain.handle('runtime:start-machine', ipcHandlers.startMachine);
  ipcMain.handle('runtime:stop-machine', ipcHandlers.stopMachine);
  ipcMain.handle('runtime:force-stop-machine', ipcHandlers.forceStopMachine);
  ipcMain.handle('runtime:reset-machine', ipcHandlers.resetMachine);
  ipcMain.handle('runtime:change-media', ipcHandlers.changeMedia);
  ipcMain.handle('runtime:mount-bundled-testnet-iso', ipcHandlers.mountBundledTestNetIso);
  ipcMain.handle('runtime:mount-sanaka-tools-iso', ipcHandlers.mountSanakaToolsIso);
  ipcMain.handle('runtime:mount-sanaka-tools-linux-iso', ipcHandlers.mountSanakaToolsLinuxIso);
  ipcMain.handle('runtime:get-machine-state', ipcHandlers.getMachineState);
  ipcMain.handle('runtime:get-web-audio-state', ipcHandlers.getWebAudioState);
  ipcMain.handle('runtime:list-running-machines', ipcHandlers.listRunningMachines);
  ipcMain.handle('machine:update-shared-folder', ipcHandlers.updateSharedFolder);
  ipcMain.handle('machine:update-clipboard-bridge', ipcHandlers.updateClipboardBridge);
  ipcMain.handle('machine:export', ipcHandlers.exportMachine);
  ipcMain.handle('machine:cancel-export', ipcHandlers.cancelExport);
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    revealMainWindow();
  }
});

app.on('before-quit', async () => {
  if (updateService) {
    updateService.dispose();
  }
  if (webModeService) {
    await webModeService.stop().catch(() => null);
  }
  if (runtimeManager) {
    await runtimeManager.dispose().catch(() => null);
  }
});
