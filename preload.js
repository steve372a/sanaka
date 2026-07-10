const { contextBridge, ipcRenderer } = require('electron');

function on(channel, handler) {
  if (typeof handler !== 'function') {
    return () => {};
  }
  const listener = (_event, payload) => handler(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('electronAPI', {
  files: {
    openMachineBundle: () => ipcRenderer.invoke('files:open-machine-bundle'),
    openSaka: () => ipcRenderer.invoke('files:open-saka'),
    createMachineBundle: (payload) => ipcRenderer.invoke('files:create-machine-bundle', payload),
    readSaka: (filePath) => ipcRenderer.invoke('files:read-saka', filePath),
    saveSaka: (path, content) => ipcRenderer.invoke('files:save-saka', { path, content }),
    saveSakaAs: (defaultName, content) => ipcRenderer.invoke('files:save-saka-as', { defaultName, content }),
    trashMachineBundle: (path) => ipcRenderer.invoke('files:trash-machine-bundle', path),
    renamePath: (oldPath, newPath) => ipcRenderer.invoke('files:rename-path', { oldPath, newPath }),
    copyPath: (srcPath, destPath) => ipcRenderer.invoke('files:copy-path', { srcPath, destPath }),
    openPath: (path) => ipcRenderer.invoke('files:open-path', path),
    openFolder: (path) => ipcRenderer.invoke('files:open-folder', path),
    pathExists: (path) => ipcRenderer.invoke('files:path-exists', path)
  },
  dialogs: {
    selectFolder: () => ipcRenderer.invoke('dialogs:select-folder'),
    pickDisk: () => ipcRenderer.invoke('dialogs:pick-disk'),
    pickIso: () => ipcRenderer.invoke('dialogs:pick-iso'),
    pickFirmwareCode: () => ipcRenderer.invoke('dialogs:pick-firmware-code'),
    pickFirmwareVars: () => ipcRenderer.invoke('dialogs:pick-firmware-vars')
  },
  disks: {
    getInfo: (imagePath) => ipcRenderer.invoke('disks:get-info', imagePath),
    create: (request) => ipcRenderer.invoke('disks:create', request),
    prepareManaged: (request) => ipcRenderer.invoke('disks:prepare-managed', request),
    resize: (request) => ipcRenderer.invoke('disks:resize', request),
    convert: (request) => ipcRenderer.invoke('disks:convert', request),
    reclaimSpace: (imagePath) => ipcRenderer.invoke('disks:reclaim-space', imagePath),
    listLocalImages: (bundlePath) => ipcRenderer.invoke('disks:list-local-images', bundlePath)
  },
  settings: {
    load: () => ipcRenderer.invoke('settings:load'),
    save: (settings) => ipcRenderer.invoke('settings:save', settings)
  },
  recents: {
    list: () => ipcRenderer.invoke('recents:list'),
    push: (entry) => ipcRenderer.invoke('recents:push', entry),
    remove: (path) => ipcRenderer.invoke('recents:remove', path),
    reorder: (paths) => ipcRenderer.invoke('recents:reorder', paths)
  },
  runtime: {
    detectQemu: () => ipcRenderer.invoke('runtime:detect-qemu'),
    getRuntimeEnvironment: () => ipcRenderer.invoke('runtime:get-environment'),
    getSharedFolderEnvironment: () => ipcRenderer.invoke('runtime:get-shared-folder-environment'),
    buildQemuArgList: (machine) => ipcRenderer.invoke('runtime:build-qemu-arg-list', machine),
    getFullQemuCommand: (machine) => ipcRenderer.invoke('runtime:get-full-qemu-command', machine),
    applyControlledQemuArgEdit: (payload) => ipcRenderer.invoke('runtime:apply-controlled-qemu-arg-edit', payload),
    removeControlledQemuArg: (payload) => ipcRenderer.invoke('runtime:remove-controlled-qemu-arg', payload),
    normalizeCustomQemuArgs: (payload) => ipcRenderer.invoke('runtime:normalize-custom-qemu-args', payload),
    previewMachineCommand: (bundlePath) => ipcRenderer.invoke('runtime:preview-machine-command', bundlePath),
    startMachine: (bundlePath) => ipcRenderer.invoke('runtime:start-machine', bundlePath),
    stopMachine: (machineId) => ipcRenderer.invoke('runtime:stop-machine', machineId),
    forceStopMachine: (machineId) => ipcRenderer.invoke('runtime:force-stop-machine', machineId),
    resetMachine: (payload) => ipcRenderer.invoke('runtime:reset-machine', payload),
    changeMedia: (payload) => ipcRenderer.invoke('runtime:change-media', payload),
    mountBundledTestNetIso: (machineId) => ipcRenderer.invoke('runtime:mount-bundled-testnet-iso', machineId),
    mountSanakaToolsIso: (machineId) => ipcRenderer.invoke('runtime:mount-sanaka-tools-iso', machineId),
    mountSanakaToolsLinuxIso: (machineId) => ipcRenderer.invoke('runtime:mount-sanaka-tools-linux-iso', machineId),
    getMachineState: (machineId) => ipcRenderer.invoke('runtime:get-machine-state', machineId),
    listRunningMachines: () => ipcRenderer.invoke('runtime:list-running-machines'),
    onRuntimeEvent: (handler) => on('runtime:event', handler)
  },
  machine: {
    updateSharedFolder: (machinePath, config) => ipcRenderer.invoke('machine:update-shared-folder', machinePath, config),
    updateClipboardBridge: (machinePath, config) => ipcRenderer.invoke('machine:update-clipboard-bridge', machinePath, config),
    exportMachine: (options) => ipcRenderer.invoke('machine:export', options),
    cancelExport: (taskId) => ipcRenderer.invoke('machine:cancel-export', taskId),
    onExportProgress: (handler) => on('machine:export-progress', handler)
  },
  updater: {
    getCurrentInfo: () => ipcRenderer.invoke('updater:get-current-info'),
    checkForUpdates: (options) => ipcRenderer.invoke('updater:check-for-updates', options),
    skipVersion: (version) => ipcRenderer.invoke('updater:skip-version', version),
    openUpdatePage: (url) => ipcRenderer.invoke('updater:open-update-page', url),
    onUpdateAvailable: (handler) => on('app:update-available', handler)
  },
  viewer: {
    createExternalVncSession: (request) => ipcRenderer.invoke('viewer:create-external-vnc-session', request),
    getExternalVncSession: (sessionId) => ipcRenderer.invoke('viewer:get-external-vnc-session', sessionId),
    listExternalVncSessions: () => ipcRenderer.invoke('viewer:list-external-vnc-sessions'),
    closeExternalVncSession: (sessionId) => ipcRenderer.invoke('viewer:close-external-vnc-session', sessionId)
  },
  app: {
    getMetadata: () => ipcRenderer.invoke('app:get-metadata'),
    openWebMode: () => ipcRenderer.invoke('app:open-web-mode'),
    getWebModeState: () => ipcRenderer.invoke('app:get-web-mode-state'),
    stopWebMode: () => ipcRenderer.invoke('app:stop-web-mode'),
    consumePendingSakaPaths: () => ipcRenderer.invoke('app:consume-pending-saka-paths'),
    openExternal: (url) => ipcRenderer.invoke('app:open-external', url),
    onOpenSaka: (handler) => on('app:open-saka', handler),
    onOpenAbout: (handler) => on('app:open-about', handler),
    onOpenSettings: (handler) => on('app:open-settings', handler)
  }
});
