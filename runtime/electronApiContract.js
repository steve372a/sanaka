const electronApiContract = {
  files: {
    openMachineBundle: { type: 'invoke', channel: 'files:open-machine-bundle' },
    openSaka: { type: 'invoke', channel: 'files:open-saka' },
    createMachineBundle: { type: 'invoke', channel: 'files:create-machine-bundle' },
    readSaka: { type: 'invoke', channel: 'files:read-saka' },
    saveSaka: { type: 'invoke', channel: 'files:save-saka', argStyle: 'saveSaka' },
    saveSakaAs: { type: 'invoke', channel: 'files:save-saka-as', argStyle: 'saveSakaAs' },
    trashMachineBundle: { type: 'invoke', channel: 'files:trash-machine-bundle' },
    renamePath: { type: 'invoke', channel: 'files:rename-path', argStyle: 'renamePath' },
    copyPath: { type: 'invoke', channel: 'files:copy-path', argStyle: 'copyPath' },
    openPath: { type: 'invoke', channel: 'files:open-path' },
    openFolder: { type: 'invoke', channel: 'files:open-folder' },
    pathExists: { type: 'invoke', channel: 'files:path-exists' }
  },
  dialogs: {
    selectFolder: { type: 'invoke', channel: 'dialogs:select-folder' },
    pickDisk: { type: 'invoke', channel: 'dialogs:pick-disk' },
    pickIso: { type: 'invoke', channel: 'dialogs:pick-iso' },
    pickFirmwareCode: { type: 'invoke', channel: 'dialogs:pick-firmware-code' },
    pickFirmwareVars: { type: 'invoke', channel: 'dialogs:pick-firmware-vars' }
  },
  disks: {
    getInfo: { type: 'invoke', channel: 'disks:get-info' },
    create: { type: 'invoke', channel: 'disks:create' },
    prepareManaged: { type: 'invoke', channel: 'disks:prepare-managed' },
    resize: { type: 'invoke', channel: 'disks:resize' },
    convert: { type: 'invoke', channel: 'disks:convert' },
    reclaimSpace: { type: 'invoke', channel: 'disks:reclaim-space' },
    listLocalImages: { type: 'invoke', channel: 'disks:list-local-images' }
  },
  settings: {
    load: { type: 'invoke', channel: 'settings:load' },
    save: { type: 'invoke', channel: 'settings:save' }
  },
  recents: {
    list: { type: 'invoke', channel: 'recents:list' },
    push: { type: 'invoke', channel: 'recents:push' },
    remove: { type: 'invoke', channel: 'recents:remove' }
  },
  runtime: {
    detectQemu: { type: 'invoke', channel: 'runtime:detect-qemu' },
    scanQemuDirectories: { type: 'invoke', channel: 'runtime:scan-qemu-directories' },
    cancelQemuDirectoryScan: { type: 'invoke', channel: 'runtime:cancel-qemu-directory-scan' },
    validateQemuDirectory: { type: 'invoke', channel: 'runtime:validate-qemu-directory' },
    getRuntimeEnvironment: { type: 'invoke', channel: 'runtime:get-environment' },
    getSharedFolderEnvironment: { type: 'invoke', channel: 'runtime:get-shared-folder-environment' },
    buildQemuArgList: { type: 'invoke', channel: 'runtime:build-qemu-arg-list' },
    getFullQemuCommand: { type: 'invoke', channel: 'runtime:get-full-qemu-command' },
    applyControlledQemuArgEdit: { type: 'invoke', channel: 'runtime:apply-controlled-qemu-arg-edit' },
    removeControlledQemuArg: { type: 'invoke', channel: 'runtime:remove-controlled-qemu-arg' },
    normalizeCustomQemuArgs: { type: 'invoke', channel: 'runtime:normalize-custom-qemu-args' },
    previewMachineCommand: { type: 'invoke', channel: 'runtime:preview-machine-command' },
    startMachine: { type: 'invoke', channel: 'runtime:start-machine' },
    stopMachine: { type: 'invoke', channel: 'runtime:stop-machine' },
    forceStopMachine: { type: 'invoke', channel: 'runtime:force-stop-machine' },
    resetMachine: { type: 'invoke', channel: 'runtime:reset-machine' },
    changeMedia: { type: 'invoke', channel: 'runtime:change-media' },
    mountBundledTestNetIso: { type: 'invoke', channel: 'runtime:mount-bundled-testnet-iso' },
    mountSanakaToolsIso: { type: 'invoke', channel: 'runtime:mount-sanaka-tools-iso' },
    mountSanakaToolsLinuxIso: { type: 'invoke', channel: 'runtime:mount-sanaka-tools-linux-iso' },
    getMachineState: { type: 'invoke', channel: 'runtime:get-machine-state' },
    listRunningMachines: { type: 'invoke', channel: 'runtime:list-running-machines' },
    onRuntimeEvent: { type: 'event', channel: 'runtime:event' }
  },
  machine: {
    updateSharedFolder: { type: 'invoke', channel: 'machine:update-shared-folder' },
    updateClipboardBridge: { type: 'invoke', channel: 'machine:update-clipboard-bridge' },
    exportMachine: { type: 'invoke', channel: 'machine:export' },
    cancelExport: { type: 'invoke', channel: 'machine:cancel-export' },
    onExportProgress: { type: 'event', channel: 'machine:export-progress' }
  },
  updater: {
    getCurrentInfo: { type: 'invoke', channel: 'updater:get-current-info' },
    checkForUpdates: { type: 'invoke', channel: 'updater:check-for-updates' },
    downloadLatest: { type: 'invoke', channel: 'updater:download-latest' },
    skipVersion: { type: 'invoke', channel: 'updater:skip-version' },
    openUpdatePage: { type: 'invoke', channel: 'updater:open-update-page' },
    onUpdateAvailable: { type: 'event', channel: 'app:update-available' },
    onDownloadProgress: { type: 'event', channel: 'app:update-download-progress' }
  },
  viewer: {
    createExternalVncSession: { type: 'invoke', channel: 'viewer:create-external-vnc-session' },
    listExternalVncHistory: { type: 'invoke', channel: 'viewer:list-external-vnc-history' },
    removeExternalVncHistory: { type: 'invoke', channel: 'viewer:remove-external-vnc-history' },
    getExternalVncCredential: { type: 'invoke', channel: 'viewer:get-external-vnc-credential' },
    setExternalVncCredential: { type: 'invoke', channel: 'viewer:set-external-vnc-credential' },
    clearExternalVncCredential: { type: 'invoke', channel: 'viewer:clear-external-vnc-credential' },
    recordExternalVncConnection: { type: 'invoke', channel: 'viewer:record-external-vnc-connection' },
    getExternalVncSession: { type: 'invoke', channel: 'viewer:get-external-vnc-session' },
    listExternalVncSessions: { type: 'invoke', channel: 'viewer:list-external-vnc-sessions' },
    closeExternalVncSession: { type: 'invoke', channel: 'viewer:close-external-vnc-session' }
  },
  app: {
    getMetadata: { type: 'invoke', channel: 'app:get-metadata' },
    getWelcomeVideo: { type: 'invoke', channel: 'app:get-welcome-video' },
    openWebMode: { type: 'invoke', channel: 'app:open-web-mode' },
    getWebModeState: { type: 'invoke', channel: 'app:get-web-mode-state' },
    stopWebMode: { type: 'invoke', channel: 'app:stop-web-mode' },
    consumePendingSakaPaths: { type: 'invoke', channel: 'app:consume-pending-saka-paths' },
    openExternal: { type: 'invoke', channel: 'app:open-external' },
    onOpenSaka: { type: 'event', channel: 'app:open-saka' },
    onOpenAbout: { type: 'event', channel: 'app:open-about' },
    onOpenSettings: { type: 'event', channel: 'app:open-settings' }
  }
};

function bindContractNode(node, invoke, on) {
  if (!node || typeof node !== 'object') {
    return node;
  }

  if (node.type === 'invoke') {
    return (...args) => {
      const transformedArgs = transformInvokeArgs(node.argStyle, args);
      return invoke(node.channel, ...transformedArgs);
    };
  }

  if (node.type === 'event') {
    return (handler) => on(node.channel, handler);
  }

  return Object.fromEntries(
    Object.entries(node).map(([key, value]) => [key, bindContractNode(value, invoke, on)])
  );
}

function transformInvokeArgs(argStyle, args) {
  switch (argStyle) {
    case 'saveSaka':
      return [{ path: args[0], content: args[1] }];
    case 'saveSakaAs':
      return [{ defaultName: args[0], content: args[1] }];
    case 'renamePath':
      return [{ oldPath: args[0], newPath: args[1] }];
    case 'copyPath':
      return [{ srcPath: args[0], destPath: args[1] }];
    default:
      return args;
  }
}

function createElectronApiBindings({ invoke, on }) {
  return bindContractNode(electronApiContract, invoke, on);
}

module.exports = {
  electronApiContract,
  createElectronApiBindings,
  transformInvokeArgs
};
