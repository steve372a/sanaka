const webModeApiSpec = {
  files: {
    createMachineBundle: { type: 'invoke', channel: 'files:create-machine-bundle', argStyle: 'passthrough-single' },
    readSaka: { type: 'invoke', channel: 'files:read-saka' },
    saveSaka: { type: 'invoke', channel: 'files:save-saka', argStyle: 'saveSaka' },
    saveSakaAs: { type: 'invoke', channel: 'files:save-saka-as', argStyle: 'saveSakaAs' },
    trashMachineBundle: { type: 'invoke', channel: 'files:trash-machine-bundle' },
    pathExists: { type: 'invoke', channel: 'files:path-exists' }
  },
  disks: {
    prepareManaged: { type: 'invoke', channel: 'disks:prepare-managed', argStyle: 'passthrough-single' },
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
  webWorkspace: {
    renameMachine: { type: 'invoke', channel: 'web-workspace:rename-machine', argStyle: 'passthrough-single' },
    duplicateMachine: { type: 'invoke', channel: 'web-workspace:duplicate-machine', argStyle: 'passthrough-single' }
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
    listExternalVncHistory: { type: 'invoke', channel: 'viewer:list-external-vnc-history' },
    removeExternalVncHistory: { type: 'invoke', channel: 'viewer:remove-external-vnc-history' },
    getExternalVncCredential: { type: 'invoke', channel: 'viewer:get-external-vnc-credential' },
    setExternalVncCredential: { type: 'invoke', channel: 'viewer:set-external-vnc-credential', argStyle: 'passthrough-single' },
    clearExternalVncCredential: { type: 'invoke', channel: 'viewer:clear-external-vnc-credential', argStyle: 'passthrough-single' },
    recordExternalVncConnection: { type: 'invoke', channel: 'viewer:record-external-vnc-connection' },
    getExternalVncSession: { type: 'invoke', channel: 'viewer:get-external-vnc-session' },
    listExternalVncSessions: { type: 'invoke', channel: 'viewer:list-external-vnc-sessions' },
    closeExternalVncSession: { type: 'invoke', channel: 'viewer:close-external-vnc-session' }
  },
  app: {
    getMetadata: { type: 'invoke', channel: 'app:get-metadata' },
    getWelcomeVideo: { type: 'invoke', channel: 'app:get-welcome-video' },
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
