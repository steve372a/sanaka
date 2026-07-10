export type DisplayFrontend = 'sanaka' | 'spice' | 'vnc';
export type DisplayBackendHint = 'spice' | 'vnc';

export interface OpenedSakaFile {
  path: string;
  configPath: string;
  previewPath?: string;
  content: string;
  legacySingleFile?: boolean;
}

export interface PickedPath {
  path: string;
}

export type DiskImageFormat = 'qcow2' | 'qed' | 'qcow' | 'vmdk' | 'vpc' | 'vdi' | 'raw';
export type DiskSizeUnit = 'MB' | 'GB';
export type DiskStorageMode = 'managed' | 'external';
export type SharedFolderMode = 'readonly' | 'readwrite';
export type ClipboardBridgeMode = 'text';

export interface DiskImageInfo {
  path: string;
  format: DiskImageFormat;
  virtualSize: number;
  actualSize: number;
  backingFile?: string;
}

export interface CreateDiskImageRequest {
  path?: string;
  name?: string;
  directory?: string;
  size: number;
  unit: DiskSizeUnit;
  format: DiskImageFormat;
  options?: {
    preallocate?: boolean;
    backingFile?: string;
    backingFormat?: DiskImageFormat;
  };
}

export interface PrepareManagedDiskRequest {
  bundlePath: string;
  diskId: string;
  name: string;
  size: number;
  unit: DiskSizeUnit;
  format: DiskImageFormat;
  options?: {
    preallocate?: boolean;
  };
}

export interface PrepareManagedDiskResult extends DiskImageMutationResult {
  relativePath?: string;
}

export interface ResizeDiskImageRequest {
  path: string;
  newSize: number;
  unit: DiskSizeUnit;
  shrink?: boolean;
}

export interface ConvertDiskImageRequest {
  sourcePath: string;
  sourceFormat?: DiskImageFormat;
  targetFormat: DiskImageFormat;
  targetPath?: string;
  options?: {
    compression?: boolean;
    sparse?: boolean;
    preallocate?: boolean;
    backingFile?: string;
    backingFormat?: DiskImageFormat;
  };
}

export interface DiskImageMutationResult {
  ok: boolean;
  path?: string;
  info?: DiskImageInfo;
  error?: string;
}

export interface ReclaimDiskSpaceResult extends DiskImageMutationResult {
  reclaimedBytes?: number;
}

export interface AppMetadata {
  name: string;
  version: string;
  platform: string;
  arch: string;
  userDataPath: string;
  documentsPath: string;
  defaultMachineDirectory: string;
}

export interface WebModeState {
  active: boolean;
  url: string | null;
  localUrl: string | null;
  networkUrl: string | null;
  host: string;
  port: number | null;
  startedAt: string | null;
  localOnly: boolean;
}

export interface ExternalVncSession {
  id: string;
  type: 'external-vnc';
  host: string;
  port: number;
  displayAddress: string;
  status: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error' | 'closed';
  createdAt: string;
  updatedAt: string;
  lastError: string | null;
  hasPassword: boolean;
  activeConnections: number;
  websocketPath?: string;
  websocketUrl?: string | null;
  localWebsocketUrl?: string | null;
  networkWebsocketUrl?: string | null;
}

export interface CreateExternalVncSessionRequest {
  address?: string;
  host?: string;
  port?: number;
  password?: string;
}

export interface SharedFolderConfig {
  enabled: boolean;
  hostPath: string;
  mode: SharedFolderMode;
  shareName: string;
}

export interface ClipboardBridgeConfig {
  enabled: boolean;
  mode: ClipboardBridgeMode;
  autoConnect: boolean;
}

export interface QemuBinaryAvailability {
  name: string;
  found: boolean;
  path: string | null;
  version: string | null;
}

export interface SharedFolderEnvironment {
  available: boolean;
  backend: 'smb';
  smbdPath?: string | null;
  version?: string | null;
  installHint?: string;
  reason?: string | null;
}

export interface QemuEnvironment {
  checkedAt: string;
  platform: string;
  arch: string;
  available: boolean;
  availableSystemTargets: string[];
  accelerators: string[];
  installHint: string;
  searchRoots?: string[];
  sharedFolders?: {
    smb: SharedFolderEnvironment;
  };
  binaries: {
    x86_64: QemuBinaryAvailability;
    aarch64: QemuBinaryAvailability;
    i386: QemuBinaryAvailability;
    arm: QemuBinaryAvailability;
    riscv64: QemuBinaryAvailability;
    ppc: QemuBinaryAvailability;
    ppc64: QemuBinaryAvailability;
    qemuImg: QemuBinaryAvailability;
    [key: string]: QemuBinaryAvailability;
  };
}

export interface RuntimeSharedFolderState {
  enabled: boolean;
  active: boolean;
  backend: 'smb';
  hostPath?: string;
  guestAddress?: string;
  guestPath?: string;
  guestUrl?: string;
  mode?: SharedFolderMode;
  pendingRestart?: boolean;
  warning?: string | null;
  installHint?: string | null;
}

export interface RuntimeClipboardBridgeState {
  enabled: boolean;
  active: boolean;
  connected: boolean;
  status: 'idle' | 'waiting' | 'connected' | 'error';
  textOnly: true;
  listenPort?: number;
  bootstrapPort?: number;
  sessionId?: string | null;
  machineMac?: string | null;
  pendingGuestConnection?: boolean;
  guestToolInstalledKnown?: boolean;
  hostAddress?: string;
  lastError?: string | null;
  configPath?: string | null;
}

export interface RuntimeMachineState {
  machineId: string;
  bundlePath: string;
  configPath: string;
  pid: number;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'resetting' | 'paused';
  startedAt: string;
  arch: string;
  displayFrontend: DisplayFrontend;
  displayBackend: 'vnc' | 'spice';
  displayPort: number;
  displayWebSocketPort?: number;
  qmpSocketPath: string | null;
  qmpTcpPort?: number | null;
  logPath: string;
  exitCode: number | null;
  lastError: string | null;
  machineMac?: string;
  sharedFolder?: RuntimeSharedFolderState;
  clipboardBridge?: RuntimeClipboardBridgeState;
}

export type QemuArgSource = 'controlled' | 'custom';

export type ControlledQemuBindingKey =
  | 'machine.title'
  | 'system.machine_type'
  | 'system.memory_mib'
  | 'system.cpu_cores'
  | 'system.accelerator'
  | 'system.boot_order'
  | 'system.sound_card'
  | 'display.gpu'
  | 'network.mode'
  | 'network.card'
  | 'peripherals.usb_tablet';

export interface QemuArgItem {
  id: string;
  raw: string;
  source: QemuArgSource;
  bindingKey?: ControlledQemuBindingKey;
  editable: boolean;
}

export interface FullQemuCommandArgItem {
  id: string;
  raw: string;
  isCustom: boolean;
  editable: boolean;
  removable?: boolean;
  bindingKey?: ControlledQemuBindingKey;
  editPrefix?: string;
  customIndex?: number;
}

export interface RuntimeWebAudioState {
  enabled: boolean;
  captureFilePath: string;
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
}

export interface RuntimeCommandPreview {
  machineId: string;
  bundlePath: string;
  configPath: string;
  binaryPath: string;
  args: string[];
  commandLine: string;
  accelerator: string;
  display: {
    frontend: DisplayFrontend;
    backend: 'vnc' | 'spice';
    port: number;
    websocketPort?: number;
  };
  qmp: {
    transport: 'unix' | 'tcp';
    path: string | null;
    host: string | null;
    port: number | null;
  };
  environment: QemuEnvironment;
}

export interface RuntimeEvent {
  type:
    | 'machine-starting'
    | 'machine-running'
    | 'machine-updated'
    | 'machine-resetting'
    | 'machine-stopping'
    | 'machine-stopped'
    | 'machine-error'
    | 'environment-updated';
  at: string;
  machineId?: string;
  state?: RuntimeMachineState | null;
  error?: string | null;
  environment?: QemuEnvironment;
}

export interface StartMachineResult {
  ok: boolean;
  alreadyRunning?: boolean;
  error?: string;
  state?: RuntimeMachineState | null;
}

export interface StopMachineResult {
  ok: boolean;
  error?: string;
  state?: RuntimeMachineState | null;
}

export interface ChangeMediaRequest {
  machineId: string;
  isoPath: string;
  drive?: 'cdrom' | 'floppy';
}

export interface ResetMachineRequest {
  machineId: string;
  mode?: 'hard' | 'soft';
}

export interface CreateMachineBundlePayload {
  machineName: string;
  fallbackName: string;
  content: string;
}

export interface SavedMachineBundle {
  path: string;
  configPath: string;
  machineName?: string;
}

export interface TrashMachineBundleResult {
  ok: true;
}

export interface ExportMachineOptions {
  sourcePath: string;
  targetDir: string;
  name: string;
  author?: string;
  includeIso: boolean;
  selectedDisks: string[];
  packAsZip: boolean;
}

export interface ExportProgress {
  taskId: string;
  percent: number;
  phase:
    | 'preparing'
    | 'copying_config'
    | 'copying_iso'
    | 'copying_disks'
    | 'updating_metadata'
    | 'packing'
    | 'completed'
    | 'failed';
  detail?: string;
  estimatedSeconds?: number;
  error?: string;
}

export interface UpdateSharedFolderResult {
  ok: boolean;
  config?: SharedFolderConfig;
  pendingRestart?: boolean;
  state?: RuntimeMachineState | null;
  error?: string;
}

export interface ElectronApi {
  files: {
    openMachineBundle: () => Promise<OpenedSakaFile | null>;
    openSaka: () => Promise<OpenedSakaFile | null>;
    createMachineBundle: (payload: CreateMachineBundlePayload) => Promise<SavedMachineBundle>;
    readSaka: (filePath: string) => Promise<OpenedSakaFile | null>;
    saveSaka: (path: string, content: string) => Promise<SavedMachineBundle>;
    saveSakaAs: (defaultName: string, content: string) => Promise<SavedMachineBundle | null>;
    trashMachineBundle: (path: string) => Promise<TrashMachineBundleResult>;
    renamePath: (oldPath: string, newPath: string) => Promise<{ ok: true }>;
    copyPath: (srcPath: string, destPath: string) => Promise<{ ok: true }>;
    openPath: (path: string) => Promise<{ ok: true }>;
    pathExists: (path: string) => Promise<boolean>;
    openFolder: (path: string) => Promise<{ ok: true }>;
  };
  dialogs: {
    selectFolder: () => Promise<PickedPath | null>;
    pickDisk: () => Promise<PickedPath | null>;
    pickIso: () => Promise<PickedPath | null>;
    pickFirmwareCode: () => Promise<PickedPath | null>;
    pickFirmwareVars: () => Promise<PickedPath | null>;
  };
  disks: {
    getInfo: (imagePath: string) => Promise<DiskImageInfo>;
    create: (request: CreateDiskImageRequest) => Promise<DiskImageMutationResult>;
    prepareManaged: (request: PrepareManagedDiskRequest) => Promise<PrepareManagedDiskResult>;
    resize: (request: ResizeDiskImageRequest) => Promise<DiskImageMutationResult>;
    convert: (request: ConvertDiskImageRequest) => Promise<DiskImageMutationResult>;
    reclaimSpace: (imagePath: string) => Promise<ReclaimDiskSpaceResult>;
    listLocalImages: (bundlePath: string) => Promise<{
      images: Array<{
        path: string;
        name: string;
        format: string;
        size: number;
        unit: string;
      }>;
    }>;
  };
  settings: {
    load: () => Promise<unknown>;
    save: (settings: unknown) => Promise<unknown>;
  };
  recents: {
    list: () => Promise<unknown>;
    push: (entry: unknown) => Promise<unknown>;
    remove: (path: string) => Promise<unknown>;
    reorder: (paths: string[]) => Promise<unknown>;
  };
  runtime: {
    detectQemu: () => Promise<QemuEnvironment>;
    getRuntimeEnvironment: () => Promise<QemuEnvironment>;
    getSharedFolderEnvironment?: () => Promise<SharedFolderEnvironment>;
    buildQemuArgList?: (machine: import('../domain/schemas').SakaMachine) => Promise<{ args: QemuArgItem[] }>;
    getFullQemuCommand?: (machine: import('../domain/schemas').SakaMachine) => Promise<{ args: FullQemuCommandArgItem[] }>;
    applyControlledQemuArgEdit?: (payload: {
      machine: import('../domain/schemas').SakaMachine;
      bindingKey: ControlledQemuBindingKey;
      raw: string;
    }) => Promise<{ ok: boolean; machine?: import('../domain/schemas').SakaMachine; args?: QemuArgItem[]; error?: string }>;
    removeControlledQemuArg?: (payload: {
      machine: import('../domain/schemas').SakaMachine;
      bindingKey: ControlledQemuBindingKey;
    }) => Promise<{ ok: boolean; machine?: import('../domain/schemas').SakaMachine; args?: QemuArgItem[]; error?: string }>;
    normalizeCustomQemuArgs?: (payload: {
      machine: import('../domain/schemas').SakaMachine;
      customArgs: string[];
    }) => Promise<{ ok: boolean; machine: import('../domain/schemas').SakaMachine; args: QemuArgItem[] }>;
    previewMachineCommand: (bundlePath: string) => Promise<RuntimeCommandPreview>;
    startMachine: (bundlePath: string) => Promise<StartMachineResult>;
    stopMachine: (machineId: string) => Promise<StopMachineResult>;
    forceStopMachine: (machineId: string) => Promise<StopMachineResult>;
    resetMachine: (payload: ResetMachineRequest) => Promise<StopMachineResult>;
    changeMedia: (payload: ChangeMediaRequest) => Promise<StopMachineResult>;
    mountBundledTestNetIso?: (machineId: string) => Promise<StopMachineResult>;
    mountSanakaToolsIso?: (machineId: string) => Promise<StopMachineResult>;
    mountSanakaToolsLinuxIso?: (machineId: string) => Promise<StopMachineResult>;
    getMachineState: (machineId: string) => Promise<RuntimeMachineState | null>;
    getWebAudioState?: (machineId: string) => Promise<RuntimeWebAudioState | null>;
    listRunningMachines: () => Promise<RuntimeMachineState[]>;
    onRuntimeEvent: (handler: (payload: RuntimeEvent) => void) => () => void;
  };
  machine: {
    updateSharedFolder?: (machinePath: string, config: SharedFolderConfig) => Promise<UpdateSharedFolderResult>;
    updateClipboardBridge?: (machinePath: string, config: ClipboardBridgeConfig) => Promise<{
      ok: boolean;
      config?: ClipboardBridgeConfig;
      state?: RuntimeMachineState | null;
      error?: string;
    }>;
    exportMachine: (options: ExportMachineOptions) => Promise<string>;
    cancelExport: (taskId: string) => Promise<boolean>;
    onExportProgress: (handler: (payload: ExportProgress) => void) => () => void;
  };
  updater: {
    getCurrentInfo: () => Promise<UpdateCurrentInfo>;
    checkForUpdates: (options?: { silent?: boolean }) => Promise<UpdateCheckResult>;
    skipVersion: (version: string) => Promise<{ ok: true; skippedVersion: string }>;
    openUpdatePage: (url: string) => Promise<{ ok: true }>;
    onUpdateAvailable: (handler: (payload: UpdateAvailableEvent) => void) => () => void;
  };
  viewer?: {
    createExternalVncSession?: (request: CreateExternalVncSessionRequest) => Promise<ExternalVncSession>;
    getExternalVncSession?: (sessionId: string) => Promise<ExternalVncSession | null>;
    listExternalVncSessions?: () => Promise<ExternalVncSession[]>;
    closeExternalVncSession?: (sessionId: string) => Promise<{ ok: boolean; session?: ExternalVncSession; error?: string }>;
  };
  app: {
    getMetadata: () => Promise<AppMetadata>;
    openWebMode: () => Promise<WebModeState>;
    getWebModeState: () => Promise<WebModeState>;
    stopWebMode: () => Promise<{ ok: true }>;
    consumePendingSakaPaths: () => Promise<string[]>;
    openExternal: (url: string) => Promise<{ ok: true }>;
    onOpenSaka: (handler: (payload: { path: string }) => void) => () => void;
    onOpenAbout: (handler: () => void) => () => void;
    onOpenSettings: (handler: () => void) => () => void;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronApi;
  }
}

export interface UpdateCurrentInfo {
  currentVersion: string;
  currentChannel: 'release' | 'beta';
  skippedVersion?: string;
}

export interface UpdateManifest {
  version: string;
  channel: 'release' | 'beta';
  mandatory: boolean;
  pubDate?: string;
  url: string;
  title?: string;
  notes: string;
}

export interface UpdateCheckResult extends UpdateCurrentInfo {
  latest?: UpdateManifest;
  hasUpdate: boolean;
  error?: string;
}

export interface UpdateAvailableEvent extends UpdateCurrentInfo {
  source: 'automatic' | 'manual';
  manifest: UpdateManifest;
}
