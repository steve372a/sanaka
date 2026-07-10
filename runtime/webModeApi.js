const webModeApiSpec = {
  files: {
    openMachineBundle: { type: 'invoke', channel: 'files:open-machine-bundle' },
    openSaka: { type: 'invoke', channel: 'files:open-saka' },
    createMachineBundle: { type: 'invoke', channel: 'files:create-machine-bundle', argStyle: 'passthrough-single' },
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
    create: { type: 'invoke', channel: 'disks:create', argStyle: 'passthrough-single' },
    prepareManaged: { type: 'invoke', channel: 'disks:prepare-managed', argStyle: 'passthrough-single' },
    resize: { type: 'invoke', channel: 'disks:resize', argStyle: 'passthrough-single' },
    convert: { type: 'invoke', channel: 'disks:convert', argStyle: 'passthrough-single' },
    reclaimSpace: { type: 'invoke', channel: 'disks:reclaim-space' },
    listLocalImages: { type: 'invoke', channel: 'disks:list-local-images' }
  },
  settings: {
    load: { type: 'invoke', channel: 'settings:load' },
    save: { type: 'invoke', channel: 'settings:save', argStyle: 'passthrough-single' }
  },
  recents: {
    list: { type: 'invoke', channel: 'recents:list' },
    push: { type: 'invoke', channel: 'recents:push', argStyle: 'passthrough-single' },
    remove: { type: 'invoke', channel: 'recents:remove' }
  },
  runtime: {
    detectQemu: { type: 'invoke', channel: 'runtime:detect-qemu' },
    getRuntimeEnvironment: { type: 'invoke', channel: 'runtime:get-environment' },
    getSharedFolderEnvironment: { type: 'invoke', channel: 'runtime:get-shared-folder-environment' },
    buildQemuArgList: { type: 'invoke', channel: 'runtime:build-qemu-arg-list', argStyle: 'passthrough-single' },
    getFullQemuCommand: { type: 'invoke', channel: 'runtime:get-full-qemu-command', argStyle: 'passthrough-single' },
    applyControlledQemuArgEdit: { type: 'invoke', channel: 'runtime:apply-controlled-qemu-arg-edit', argStyle: 'passthrough-single' },
    removeControlledQemuArg: { type: 'invoke', channel: 'runtime:remove-controlled-qemu-arg', argStyle: 'passthrough-single' },
    normalizeCustomQemuArgs: { type: 'invoke', channel: 'runtime:normalize-custom-qemu-args', argStyle: 'passthrough-single' },
    previewMachineCommand: { type: 'invoke', channel: 'runtime:preview-machine-command' },
    startMachine: { type: 'invoke', channel: 'runtime:start-machine' },
    stopMachine: { type: 'invoke', channel: 'runtime:stop-machine' },
    forceStopMachine: { type: 'invoke', channel: 'runtime:force-stop-machine' },
    resetMachine: { type: 'invoke', channel: 'runtime:reset-machine', argStyle: 'passthrough-single' },
    changeMedia: { type: 'invoke', channel: 'runtime:change-media', argStyle: 'passthrough-single' },
    mountBundledTestNetIso: { type: 'invoke', channel: 'runtime:mount-bundled-testnet-iso' },
    mountSanakaToolsIso: { type: 'invoke', channel: 'runtime:mount-sanaka-tools-iso' },
    mountSanakaToolsLinuxIso: { type: 'invoke', channel: 'runtime:mount-sanaka-tools-linux-iso' },
    getMachineState: { type: 'invoke', channel: 'runtime:get-machine-state' },
    listRunningMachines: { type: 'invoke', channel: 'runtime:list-running-machines' },
    onRuntimeEvent: { type: 'event', channel: 'runtime:event' }
  },
  machine: {
    updateSharedFolder: { type: 'invoke', channel: 'machine:update-shared-folder', argStyle: 'spread' },
    updateClipboardBridge: { type: 'invoke', channel: 'machine:update-clipboard-bridge', argStyle: 'spread' },
    exportMachine: { type: 'invoke', channel: 'machine:export', argStyle: 'passthrough-single' },
    cancelExport: { type: 'invoke', channel: 'machine:cancel-export' },
    onExportProgress: { type: 'event', channel: 'machine:export-progress' }
  },
  updater: {
    getCurrentInfo: { type: 'invoke', channel: 'updater:get-current-info' },
    checkForUpdates: { type: 'invoke', channel: 'updater:check-for-updates', argStyle: 'passthrough-single' },
    skipVersion: { type: 'invoke', channel: 'updater:skip-version' },
    openUpdatePage: { type: 'invoke', channel: 'updater:open-update-page' },
    onUpdateAvailable: { type: 'event', channel: 'app:update-available' }
  },
  viewer: {
    createExternalVncSession: { type: 'invoke', channel: 'viewer:create-external-vnc-session', argStyle: 'passthrough-single' },
    getExternalVncSession: { type: 'invoke', channel: 'viewer:get-external-vnc-session' },
    listExternalVncSessions: { type: 'invoke', channel: 'viewer:list-external-vnc-sessions' },
    closeExternalVncSession: { type: 'invoke', channel: 'viewer:close-external-vnc-session' }
  },
  app: {
    getMetadata: { type: 'invoke', channel: 'app:get-metadata' },
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

function transformWebModeArgs(argStyle, args) {
  switch (argStyle) {
    case 'saveSaka':
      return [{ path: args[0], content: args[1] }];
    case 'saveSakaAs':
      return [{ defaultName: args[0], content: args[1] }];
    case 'renamePath':
      return [{ oldPath: args[0], newPath: args[1] }];
    case 'copyPath':
      return [{ srcPath: args[0], destPath: args[1] }];
    case 'spread':
      return args;
    case 'passthrough-single':
      return [args[0]];
    default:
      return args;
  }
}

module.exports = {
  webModeApiSpec,
  transformWebModeArgs
};
