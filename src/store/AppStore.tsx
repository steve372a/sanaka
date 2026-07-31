import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { defaultSettings } from '../domain/defaults';
import {
  appSettingsSchema,
  recentEntrySchema,
  type AppSettings,
  type DiskImageFormat,
  type MachineDraft,
  type RecentEntry,
  type SakaMachine,
  type SakaTemplate,
  type TemplateCatalogEntry
} from '../domain/schemas';
import type { RuntimeMachineState, UpdateAvailableEvent, UpdateCheckResult, UpdateCurrentInfo } from '../types/electron';
import { builtInTemplates, createMachineFromTemplate, createMachineFromTemplateDocument, normalizeMachineCompatibility } from '../domain/templates';
import { resources } from '../i18n/resources';
import { makeRecentEntry } from '../lib/machine';
import type { FullscreenTransitionOrigin, FullscreenTransitionState, FullscreenTransitionType } from '../lib/fullscreenTransition';
import { parseSakaContent, sanitizeMachineName, serializeSakaMachine } from '../lib/saka';

function normalizeSettingsForMainline(settings: AppSettings): AppSettings {
  return {
    ...settings,
    webMode: {
      port: Number.isInteger(settings.webMode?.port) ? settings.webMode.port : 25895
    },
    runtimeDefaults: {
      ...settings.runtimeDefaults,
      displayFrontend: 'sanaka',
      displayBackendHint: 'vnc'
    },
    templateCatalog: settings.templateCatalog.map((entry) => ({
      ...entry,
      label: entry.key === 'win11' && entry.label === 'Windows 10/11' ? 'Windows 10' : entry.label,
      defaultFrontend: 'sanaka'
    }))
  };
}

export function getUniqueMachineTitle(title: string, existingTitles: string[]): string {
  const normalizedExisting = existingTitles.map(t => t.trim().toLowerCase());
  if (!normalizedExisting.includes(title.trim().toLowerCase())) {
    return title;
  }
  const match = title.match(/^(.*?)\s+(\d+)$/);
  let base = title;
  let startIdx = 2;
  if (match) {
    const candidateBase = match[1];
    const numStr = match[2];
    const num = parseInt(numStr, 10);
    if (numStr.length === 1 || normalizedExisting.includes(candidateBase.trim().toLowerCase())) {
      base = candidateBase;
      startIdx = num;
    }
  }
  let index = startIdx;
  while (normalizedExisting.includes(`${base} ${index}`.trim().toLowerCase())) {
    index++;
  }
  return `${base} ${index}`;
}

export function getDefaultNewMachineTitle(existingTitles: string[]): string {
  const base = '新虚拟机';
  const normalizedExisting = existingTitles.map((title) => title.trim().toLowerCase());

  if (!normalizedExisting.includes(base.toLowerCase())) {
    return base;
  }

  let index = 1;
  while (normalizedExisting.includes(`${base} ${index}`.toLowerCase())) {
    index += 1;
  }

  return `${base} ${index}`;
}

function inferDiskFormatFromPath(filePath: string): DiskImageFormat {
  const ext = filePath.split('.').pop()?.toLowerCase() || 'raw';
  const formatMap: Record<string, DiskImageFormat> = {
    qcow2: 'qcow2',
    qed: 'qed',
    qcow: 'qcow',
    vmdk: 'vmdk',
    vhd: 'vpc',
    vpc: 'vpc',
    vdi: 'vdi',
    img: 'raw',
    raw: 'raw'
  };
  return formatMap[ext] || 'raw';
}

function buildManagedDiskFileName(disk: SakaMachine['disks'][number]) {
  const fileName = disk.path.split(/[/\\]/).pop() || disk.id;
  return fileName.replace(/^Disks[/\\]/, '');
}

async function materializeManagedDisks(machine: SakaMachine, bundlePath: string) {
  const nextMachine = structuredClone(machine);

  for (let index = 0; index < nextMachine.disks.length; index += 1) {
    const disk = nextMachine.disks[index];
    if (disk.storage_mode !== 'managed' || !disk.pending_create) {
      continue;
    }

    const fileName = buildManagedDiskFileName(disk);
    const lastDot = fileName.lastIndexOf('.');
    const name = lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
    const format = disk.format || inferDiskFormatFromPath(fileName);
    const result = await window.electronAPI.disks.prepareManaged({
      bundlePath,
      diskId: disk.id,
      name,
      size: disk.pending_create.size,
      unit: disk.pending_create.unit,
      format,
      options: {
        preallocate: disk.image_options?.preallocate ?? false
      }
    });

    if (!result.ok || !result.relativePath) {
      throw new Error(result.error || 'Failed to create the managed disk image.');
    }

    nextMachine.disks[index] = {
      ...disk,
      path: result.relativePath,
      format,
      storage_mode: 'managed',
      source_path: '',
      image_options: disk.image_options,
      pending_create: undefined
    };
  }

  return nextMachine;
}

function hasPendingManagedDisks(machine: SakaMachine) {
  return machine.disks.some((disk) => disk.storage_mode === 'managed' && disk.pending_create);
}

interface ActivityItem {
  id: string;
  title: string;
  description: string;
  time: string;
}

interface StartMachineActionResult {
  ok: boolean;
  machinePath: string;
  machineId?: string;
}

interface AppStoreValue {
  ready: boolean;
  settings: AppSettings;
  recents: RecentEntry[];
  draft: MachineDraft | null;
  appMeta: Awaited<ReturnType<typeof window.electronAPI.app.getMetadata>> | null;
  aboutOpen: boolean;
  openAboutDialog: () => void;
  activity: ActivityItem[];
  messages: Record<string, unknown>;
  templates: TemplateCatalogEntry[];
  initialize: () => Promise<void>;
  setLanguage: (language: AppSettings['language']) => Promise<void>;
  setTheme: (theme: AppSettings['theme']) => Promise<void>;
  setReduceMotion: (reduceMotion: boolean) => Promise<void>;
  setAboutOpen: (open: boolean) => void;
  createDraftFromTemplateKey: (templateKey: string) => Promise<void>;
  applyTemplateSelection: (templateKey: string) => Promise<void>;
  updateDraft: (updater: (machine: SakaMachine) => SakaMachine) => void;
  saveDraft: (mode?: 'save' | 'saveAs', overrideTitle?: string) => Promise<string | null>;
  openSakaByPath: (
    filePath: string,
    options?: { refreshRecents?: boolean }
  ) => Promise<{ kind: 'machine' | 'template'; machineId: string; path?: string } | null>;
  openSakaDialog: () => Promise<{ kind: 'machine' | 'template'; machineId: string; path?: string } | null>;
  persistSettings: (next: AppSettings) => Promise<void>;
  importTemplateFromDialog: () => Promise<{ ok: boolean; message?: string }>;
  updateTemplateCatalog: (updater: (catalog: TemplateCatalogEntry[]) => TemplateCatalogEntry[]) => Promise<void>;
  createDraftFromDisk: () => Promise<{ machineId: string } | null>;
  deleteMachine: (machinePath: string) => Promise<boolean>;
  runtimeEnvironment: Awaited<ReturnType<typeof window.electronAPI.runtime.getRuntimeEnvironment>> | null;
  runtimeMachines: Awaited<ReturnType<typeof window.electronAPI.runtime.listRunningMachines>>;
  runningMachines: string[];
  getRuntimeStateForMachine: (machineId: string) => RuntimeMachineState | undefined;
  startMachine: (machinePath: string) => Promise<StartMachineActionResult>;
  stopMachine: (id: string) => Promise<boolean>;
  forceStopMachine: (id: string) => Promise<boolean>;
  transition: FullscreenTransitionState;
  triggerTransition: (type: FullscreenTransitionType, action: () => void | Promise<void>, origin?: FullscreenTransitionOrigin) => void;
  deleteTarget: { path: string; title: string } | null;
  setDeleteTarget: (target: { path: string; title: string } | null) => void;
  startError: { title: string; description: string; detail?: string } | null;
  setStartError: (target: { title: string; description: string; detail?: string } | null) => void;
  renameMachine: (machinePath: string, newTitle: string) => Promise<boolean>;
  duplicateMachine: (machinePath: string) => Promise<boolean>;
  reorderRecents: (orderedPaths: string[]) => Promise<void>;
  highlightedMachinePath: string | null;
  updateCurrentInfo: UpdateCurrentInfo | null;
  updateLastCheck: UpdateCheckResult | null;
  updateReminder: UpdateAvailableEvent | null;
  dismissUpdateReminder: () => void;
  checkForUpdates: (options?: { silent?: boolean }) => Promise<UpdateCheckResult>;
  skipUpdateVersion: (version: string) => Promise<boolean>;
  openUpdatePage: (url: string) => Promise<void>;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

function makeActivity(title: string, description: string): ActivityItem {
  return {
    id: `act-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    description,
    time: new Date().toISOString()
  };
}

function formatStartError(language: AppSettings['language'], error: string) {
  return {
    title: language === 'zh-CN' ? '启动失败' : 'Start Failed',
    description: language === 'zh-CN' ? '无法启动虚拟机。下面是 QEMU 返回的原始错误。' : 'Could not start the virtual machine. The raw QEMU error is shown below.',
    detail: error || undefined
  };
}

function formatGenericError(language: AppSettings['language'], error: unknown, fallbackZh: string, fallbackEn: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }
  return language === 'zh-CN' ? fallbackZh : fallbackEn;
}

async function readTemplateByKey(settings: AppSettings, templateKey: string) {
  const builtIn = builtInTemplates.find((template) => template.template.key === templateKey);
  if (builtIn) return builtIn;
  const imported = settings.templateCatalog.find((entry) => entry.key === templateKey && entry.source === 'imported' && entry.path);
  if (!imported?.path) return null;
  const opened = await window.electronAPI.files.readSaka(imported.path);
  if (!opened) return null;
  const parsed = parseSakaContent(opened.content);
  return parsed.kind === 'template' ? parsed : null;
}

async function sanitizeImportedTemplateDocument(template: SakaTemplate) {
  const nextTemplate: SakaTemplate = structuredClone(template);

  const [isoExists, floppyExists] = await Promise.all([
    nextTemplate.media?.iso ? window.electronAPI.files.pathExists(nextTemplate.media.iso) : Promise.resolve(false),
    nextTemplate.media?.floppy ? window.electronAPI.files.pathExists(nextTemplate.media.floppy) : Promise.resolve(false)
  ]);

  if (nextTemplate.media?.iso && !isoExists) {
    nextTemplate.media.iso = '';
  }

  if (nextTemplate.media?.floppy && !floppyExists) {
    nextTemplate.media.floppy = '';
  }

  nextTemplate.sharing = {
    enabled: false,
    hostPath: '',
    mode: 'readwrite',
    shareName: 'qemu'
  };

  return nextTemplate;
}

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [recents, setRecents] = useState<RecentEntry[]>([]);
  const [draft, setDraft] = useState<MachineDraft | null>(null);
  const [appMeta, setAppMeta] = useState<Awaited<ReturnType<typeof window.electronAPI.app.getMetadata>> | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [highlightedMachinePath, setHighlightedMachinePath] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [runtimeEnvironment, setRuntimeEnvironment] = useState<Awaited<ReturnType<typeof window.electronAPI.runtime.getRuntimeEnvironment>> | null>(null);
  const [runtimeMachines, setRuntimeMachines] = useState<Awaited<ReturnType<typeof window.electronAPI.runtime.listRunningMachines>>>([]);
  const [transition, setTransition] = useState<FullscreenTransitionState>({ active: false, type: 'launch', origin: null, phase: 'covering' });
  const transitionRunRef = useRef(0);
  const [deleteTarget, setDeleteTarget] = useState<{ path: string; title: string } | null>(null);
  const [startError, setStartError] = useState<{ title: string; description: string; detail?: string } | null>(null);
  const [updateCurrentInfo, setUpdateCurrentInfo] = useState<UpdateCurrentInfo | null>(null);
  const [updateLastCheck, setUpdateLastCheck] = useState<UpdateCheckResult | null>(null);
  const [updateReminder, setUpdateReminder] = useState<UpdateAvailableEvent | null>(null);

  const initialize = useCallback(async () => {
    const [loadedSettings, loadedRecents, meta, environment, machines, updaterInfo] = await Promise.all([
      window.electronAPI.settings.load(),
      window.electronAPI.recents.list(),
      window.electronAPI.app.getMetadata(),
      window.electronAPI.runtime.getRuntimeEnvironment(),
      window.electronAPI.runtime.listRunningMachines(),
      window.electronAPI.updater.getCurrentInfo()
    ]);

    const parsedSettings = appSettingsSchema.safeParse(loadedSettings).success ? normalizeSettingsForMainline(appSettingsSchema.parse(loadedSettings)) : defaultSettings;
    const nextSettings = parsedSettings.defaultSaveDirectory
      ? parsedSettings
      : {
          ...parsedSettings,
          defaultSaveDirectory: meta.defaultMachineDirectory
        };
    const nextRecents = recentEntrySchema.array().safeParse(loadedRecents).success ? recentEntrySchema.array().parse(loadedRecents) : [];
    if (nextSettings.defaultSaveDirectory !== parsedSettings.defaultSaveDirectory) {
      await window.electronAPI.settings.save(nextSettings);
    }
    setSettings(nextSettings);
    setRecents(nextRecents);
    setAppMeta(meta);
    setRuntimeEnvironment(environment);
    setRuntimeMachines(machines);
    setUpdateCurrentInfo(updaterInfo);
    document.body.classList.toggle('platform-darwin', meta.platform === 'darwin');
    document.documentElement.setAttribute('data-theme', nextSettings.theme);
    document.documentElement.setAttribute('data-reduced-motion', String(nextSettings.reduceMotion));
    setReady(true);
  }, []);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    const runtimeApi = window.electronAPI.runtime;
    if (!runtimeApi) {
      return () => undefined;
    }

    const dispose = runtimeApi.onRuntimeEvent((event) => {
      if (event.environment) {
        setRuntimeEnvironment(event.environment);
      }

      if (event.state) {
        const nextState = event.state;
        setRuntimeMachines((current) => {
          const others = current.filter((item) => item.machineId !== nextState.machineId);
          // Keep stopped machines in the list so UI can show "stopped" status correctly
          // Remove only after a delay to allow UI to reflect the final state
          if (nextState.status === 'stopped') {
            // Keep stopped state for 3 seconds then remove
            setTimeout(() => {
              setRuntimeMachines((latest) =>
                latest.filter((item) => item.machineId !== nextState.machineId || item.status !== 'stopped')
              );
            }, 3000);
          }
          return [...others, nextState].sort((left, right) => left.machineId.localeCompare(right.machineId));
        });
      }
    });

    return () => {
      dispose();
    };
  }, []);

  useEffect(() => {
    const updaterApi = window.electronAPI.updater;
    if (!updaterApi) {
      return () => undefined;
    }

    const dispose = updaterApi.onUpdateAvailable((event) => {
      setUpdateReminder(event);
      setUpdateCurrentInfo({
        currentVersion: event.currentVersion,
        currentChannel: event.currentChannel,
        skippedVersion: event.skippedVersion
      });
      setUpdateLastCheck({
        currentVersion: event.currentVersion,
        currentChannel: event.currentChannel,
        latest: event.manifest,
        hasUpdate: true,
        skippedVersion: event.skippedVersion
      });
    });

    return () => {
      dispose();
    };
  }, []);

  const persistSettings = useCallback(async (next: AppSettings) => {
    const parsed = normalizeSettingsForMainline(appSettingsSchema.parse(next));
    setSettings(parsed);
    await window.electronAPI.settings.save(parsed);
  }, []);

  const dismissUpdateReminder = useCallback(() => {
    setUpdateReminder(null);
  }, []);

  const checkForUpdates = useCallback(async (options: { silent?: boolean } = {}) => {
    const result = await window.electronAPI.updater.checkForUpdates(options);
    setUpdateCurrentInfo({
      currentVersion: result.currentVersion,
      currentChannel: result.currentChannel,
      skippedVersion: result.skippedVersion
    });
    setUpdateLastCheck(result);
    if (!result.hasUpdate && !options.silent) {
      setUpdateReminder(null);
    }
    return result;
  }, []);

  const skipUpdateVersion = useCallback(async (version: string) => {
    if (!version) return false;
    const result = await window.electronAPI.updater.skipVersion(version);
    setUpdateCurrentInfo((current) =>
      current
        ? {
            ...current,
            skippedVersion: result.skippedVersion
          }
        : current
    );
    setUpdateLastCheck((current) =>
      current
        ? {
            ...current,
            skippedVersion: result.skippedVersion
          }
        : current
    );
    setUpdateReminder((current) => (current?.manifest.version === version ? null : current));
    return true;
  }, []);

  const openUpdatePage = useCallback(async (url: string) => {
    if (!url) return;
    await window.electronAPI.updater.openUpdatePage(url);
  }, []);

  const setLanguage = useCallback(
    async (language: AppSettings['language']) => {
      await persistSettings({ ...settings, language });
    },
    [persistSettings, settings]
  );

  const setTheme = useCallback(
    async (theme: AppSettings['theme']) => {
      document.documentElement.setAttribute('data-theme', theme);
      await persistSettings({ ...settings, theme });
    },
    [persistSettings, settings]
  );

  const setReduceMotion = useCallback(
    async (reduceMotion: boolean) => {
      document.documentElement.setAttribute('data-reduced-motion', String(reduceMotion));
      await persistSettings({ ...settings, reduceMotion });
    },
    [persistSettings, settings]
  );

  const pushRecent = useCallback(async (entry: RecentEntry) => {
    const next = (await window.electronAPI.recents.push(entry)) as RecentEntry[];
    const parsed = recentEntrySchema.array().parse(next);
    setRecents(parsed);
  }, []);

  const reorderRecents = useCallback(async (orderedPaths: string[]) => {
    const next = (await window.electronAPI.recents.reorder(orderedPaths)) as RecentEntry[];
    const parsed = recentEntrySchema.array().parse(next);
    setRecents(parsed);
  }, []);

  const flashMachineInSidebar = useCallback((machinePath: string) => {
    setHighlightedMachinePath(machinePath);
    window.setTimeout(() => {
      setHighlightedMachinePath((current) => (current === machinePath ? null : current));
    }, 2000);
  }, []);

  const openAboutDialog = useCallback(() => {
    window.requestAnimationFrame(() => {
      setAboutOpen(true);
    });
  }, []);

  const createDraftFromTemplateKey = useCallback(async (templateKey: string) => {
    const template = await readTemplateByKey(settings, templateKey);
    const normalizedTemplate = template ? await sanitizeImportedTemplateDocument(template) : null;
    const machine = normalizedTemplate ? createMachineFromTemplateDocument(normalizedTemplate) : createMachineFromTemplate(templateKey);
    const existingTitles = recents.map((r) => r.title);
    machine.title = getDefaultNewMachineTitle(existingTitles);
    setDraft({ machine, dirty: true });
    setActivity((current) => [
      makeActivity(
        settings.language === 'zh-CN' ? '已创建草稿' : 'Draft Created',
        settings.language === 'zh-CN' ? `已从 ${machine.template.label} 创建新的虚拟机。` : `Started a new machine from ${machine.template.label}.`
      ),
      ...current
    ]);
  }, [settings, recents]);

  const applyTemplateSelection = useCallback(
    async (templateKey: string) => {
      const template = await readTemplateByKey(settings, templateKey);
      if (!template || !draft) return;
      const nextMachine = createMachineFromTemplateDocument(await sanitizeImportedTemplateDocument(template));
      nextMachine.id = draft.machine.id;
      nextMachine.title = draft.machine.title || nextMachine.title;
      nextMachine.description = draft.machine.description;
      nextMachine.author = draft.machine.author;
      nextMachine.created_with = draft.machine.created_with;
      nextMachine.created_at = draft.machine.created_at;
      nextMachine.updated_at = new Date().toISOString();
      nextMachine.meta = structuredClone(draft.machine.meta);
      setDraft({ ...draft, machine: nextMachine, dirty: true });
      setActivity((current) => [
        makeActivity(
          settings.language === 'zh-CN' ? '已更新模板' : 'Template Updated',
          settings.language === 'zh-CN' ? `已切换到 ${template.template.label} 模板。` : `Switched the current draft to ${template.template.label}.`
        ),
        ...current
      ]);
    },
    [draft, settings]
  );

  const updateDraft = useCallback((updater: (machine: SakaMachine) => SakaMachine) => {
    setDraft((current) => {
      if (!current) return current;
      const nextMachine = updater(structuredClone(current.machine));
      nextMachine.updated_at = new Date().toISOString();
      return {
        ...current,
        machine: nextMachine,
        dirty: true
      };
    });
  }, []);

  const saveDraft = useCallback(
    async (mode: 'save' | 'saveAs' = 'save', overrideTitle?: string) => {
      if (!draft) return null;
      try {
        const machineToSave = overrideTitle
          ? { ...draft.machine, title: overrideTitle }
          : draft.machine;
        const initialContent = serializeSakaMachine(machineToSave);
        const initialResult =
          mode === 'saveAs'
            ? await window.electronAPI.files.saveSakaAs(sanitizeMachineName(machineToSave), initialContent)
            : draft.filePath && !draft.legacySingleFile
              ? await window.electronAPI.files.saveSaka(draft.filePath, initialContent)
              : await window.electronAPI.files.createMachineBundle({
                  machineName: machineToSave.title,
                  fallbackName: machineToSave.id,
                  content: initialContent
                });
        if (!initialResult?.path) return null;

        const materializedMachine = await materializeManagedDisks(machineToSave, initialResult.path);
        const titleAfterSave = initialResult.machineName ?? materializedMachine.title;
        const updatedMachine = {
          ...materializedMachine,
          title: titleAfterSave,
          updated_at: new Date().toISOString()
        };
        const needsFinalRewrite =
          hasPendingManagedDisks(machineToSave) ||
          titleAfterSave !== machineToSave.title;
        const finalResult = needsFinalRewrite
          ? await window.electronAPI.files.saveSaka(initialResult.path, serializeSakaMachine(updatedMachine))
          : initialResult;

        const nextDraft = {
          filePath: finalResult.path,
          configPath: finalResult.configPath,
          previewPath: draft.previewPath,
          legacySingleFile: false,
          dirty: false,
          machine: updatedMachine
        };
        setDraft(nextDraft);
        await pushRecent(makeRecentEntry(updatedMachine, finalResult.path, draft.previewPath));
        setActivity((current) => [
          makeActivity(
            settings.language === 'zh-CN' ? '已保存虚拟机' : 'Machine Saved',
            settings.language === 'zh-CN' ? '虚拟机已保存。' : 'Machine saved.'
          ),
          ...current
        ]);
        return finalResult.path;
      } catch (error) {
        setActivity((current) => [
          makeActivity(
            settings.language === 'zh-CN' ? '保存失败' : 'Save Failed',
            error instanceof Error
              ? error.message
              : settings.language === 'zh-CN'
                ? '无法保存当前虚拟机。'
                : 'Could not save the current machine.'
          ),
          ...current
        ]);
        return null;
      }
    },
    [draft, pushRecent, settings.language]
  );

  const openSakaPayload = useCallback(
    async (
      opened: Awaited<ReturnType<typeof window.electronAPI.files.readSaka>> | null,
      options: { refreshRecents?: boolean } = {}
    ) => {
      if (!opened) return null;
      const parsed = parseSakaContent(opened.content);
      if (parsed.kind === 'template') {
        const existing = settings.templateCatalog.find((entry) => entry.key === parsed.template.key);
        if (!existing) {
          const nextSettings = {
            ...settings,
            templateCatalog: [
              ...settings.templateCatalog,
              {
                key: parsed.template.key,
                label: parsed.template.label,
                source: 'imported' as const,
                enabled: true,
                order: settings.templateCatalog.length,
                defaultFrontend: 'sanaka' as const,
                path: opened.path
              }
            ]
          };
          await persistSettings(nextSettings);
        }
        const machine = createMachineFromTemplateDocument(await sanitizeImportedTemplateDocument(parsed));
        const existingTitles = recents.map((r) => r.title);
        machine.title = getDefaultNewMachineTitle(existingTitles);
        setDraft({ machine, dirty: true });
        setActivity((current) => [
          makeActivity(
            settings.language === 'zh-CN' ? '已打开模板' : 'Template Opened',
            settings.language === 'zh-CN' ? `已从 ${parsed.title} 创建新的虚拟机草稿。` : `Started a new machine draft from ${parsed.title}.`
          ),
          ...current
        ]);
        return { kind: 'template' as const, machineId: machine.id, path: opened.path };
      }
      const normalizedMachine = normalizeMachineCompatibility(parsed);
      setDraft({
        machine: normalizedMachine,
        filePath: opened.path,
        configPath: opened.configPath,
        previewPath: opened.previewPath,
        legacySingleFile: opened.legacySingleFile,
        dirty: false
      });
      setActivity((current) => [
        makeActivity(
          settings.language === 'zh-CN' ? '已打开虚拟机' : 'Machine Opened',
          settings.language === 'zh-CN' ? `已打开 ${normalizedMachine.title}。` : `Opened ${normalizedMachine.title}.`
        ),
        ...current
      ]);
      if (options.refreshRecents !== false) {
        await pushRecent(makeRecentEntry(normalizedMachine, opened.path, opened.previewPath));
      }
      flashMachineInSidebar(opened.path);
      return { kind: 'machine' as const, machineId: normalizedMachine.id, path: opened.path };
    },
    [flashMachineInSidebar, persistSettings, pushRecent, settings, recents]
  );

  const openSakaByPath = useCallback(
    async (filePath: string, options: { refreshRecents?: boolean } = {}) => {
      try {
        const opened = await window.electronAPI.files.readSaka(filePath);
        if (!opened) {
          const next = (await window.electronAPI.recents.remove(filePath)) as RecentEntry[];
          const parsed = recentEntrySchema.array().parse(next);
          setRecents(parsed);
          setActivity((current) => [
            makeActivity(
              settings.language === 'zh-CN' ? '虚拟机不可用' : 'Machine Unavailable',
              settings.language === 'zh-CN' ? '该虚拟机文件不存在，已从最近列表移除。' : 'This machine no longer exists and was removed from recents.'
            ),
            ...current
          ]);
          if (draft?.filePath === filePath) {
            setDraft(null);
          }
          return null;
        }
        return openSakaPayload(opened, options);
      } catch (error) {
        setActivity((current) => [
          makeActivity(
            settings.language === 'zh-CN' ? '打开失败' : 'Open Failed',
            formatGenericError(settings.language, error, '无法打开该 SVM/Sanaka 文件。', 'Could not open the selected SVM/Sanaka file.')
          ),
          ...current
        ]);
        return null;
      }
    },
    [draft?.filePath, openSakaPayload, settings.language]
  );

  const openSakaDialog = useCallback(async () => openSakaPayload(await window.electronAPI.files.openMachineBundle()), [openSakaPayload]);

  const importTemplateFromDialog = useCallback(async () => {
    try {
      const opened = await window.electronAPI.files.openSaka();
      if (!opened) return { ok: false };
      const parsed = parseSakaContent(opened.content);
      if (parsed.kind !== 'template') {
        const message =
          settings.language === 'zh-CN'
            ? '选中的 .svm 文件不是模板，不能导入到模板列表。'
            : 'The selected .svm file is not a template and cannot be imported into the template list.';
        setActivity((current) => [
          makeActivity(
            settings.language === 'zh-CN' ? '导入失败' : 'Import Failed',
            message
          ),
          ...current
        ]);
        return { ok: false, message };
      }
      const existing = settings.templateCatalog.find((entry) => entry.key === parsed.template.key);
      const catalog = existing
        ? settings.templateCatalog.map((entry) =>
            entry.key === parsed.template.key
              ? { ...entry, label: parsed.template.label, source: 'imported' as const, path: opened.path }
              : entry
          )
        : [
            ...settings.templateCatalog,
            {
              key: parsed.template.key,
              label: parsed.template.label,
              source: 'imported' as const,
              enabled: true,
              order: settings.templateCatalog.length,
              defaultFrontend: 'sanaka' as const,
              path: opened.path
            }
          ];
      await persistSettings({ ...settings, templateCatalog: catalog });
      setActivity((current) => [
        makeActivity(
          settings.language === 'zh-CN' ? '已导入模板' : 'Template Imported',
          settings.language === 'zh-CN' ? `已导入 ${parsed.title}。` : `Imported ${parsed.title}.`
        ),
        ...current
      ]);
      return {
        ok: true,
        message: settings.language === 'zh-CN' ? `已导入 ${parsed.title}。` : `Imported ${parsed.title}.`
      };
    } catch (error) {
      const message = formatGenericError(settings.language, error, '无法导入该 SVM 模板。', 'Could not import the selected SVM template.');
      setActivity((current) => [
        makeActivity(
          settings.language === 'zh-CN' ? '导入失败' : 'Import Failed',
          message
        ),
        ...current
      ]);
      return { ok: false, message };
    }
  }, [persistSettings, settings]);

  const updateTemplateCatalog = useCallback(
    async (updater: (catalog: TemplateCatalogEntry[]) => TemplateCatalogEntry[]) => {
      const next = updater(structuredClone(settings.templateCatalog));
      await persistSettings({ ...settings, templateCatalog: next.map((item, index) => ({ ...item, order: index })) });
    },
    [persistSettings, settings]
  );

  const createDraftFromDisk = useCallback(async () => {
    const picked = await window.electronAPI.dialogs.pickDisk();
    if (!picked?.path) return null;
    const machine = createMachineFromTemplate('custom');
    const fallbackTitle = settings.language === 'zh-CN' ? '已导入磁盘' : 'Imported Disk';
    const fileName = picked.path.split(/[/\\]/).pop() ?? fallbackTitle;
    const title = fileName.replace(/\.[^.]+$/, '') || fallbackTitle;
    const existingTitles = recents.map((r) => r.title);
    machine.title = getUniqueMachineTitle(title, existingTitles);
    machine.description = settings.language === 'zh-CN' ? '从现有磁盘镜像创建。' : 'Created from an existing disk image.';
    machine.disks = [
      {
        id: `disk-${Date.now()}`,
        path: picked.path,
        format: inferDiskFormatFromPath(picked.path),
        interface: 'virtio',
        boot: true,
        readonly: false,
        storage_mode: 'external',
        source_path: ''
      }
    ];
    setDraft({ machine, dirty: true });
    setActivity((current) => [
      makeActivity(
        settings.language === 'zh-CN' ? '已导入磁盘' : 'Disk Imported',
        settings.language === 'zh-CN' ? `已从 ${machine.title} 创建新的虚拟机草稿。` : `Started a new machine draft from ${machine.title}.`
      ),
      ...current
    ]);
    return { machineId: machine.id };
  }, [settings.language, recents]);

  const deleteMachine = useCallback(
    async (machinePath: string) => {
      if (!machinePath) return false;
      const exists = await window.electronAPI.files.pathExists(machinePath);
      try {
        if (exists) {
          await window.electronAPI.files.trashMachineBundle(machinePath);
        }
        const next = (await window.electronAPI.recents.remove(machinePath)) as RecentEntry[];
        const parsed = recentEntrySchema.array().parse(next);
        setRecents(parsed);
        setDraft((current) => (current?.filePath === machinePath ? null : current));
        setActivity((current) => [
          makeActivity(
            settings.language === 'zh-CN' ? '已删除虚拟机' : 'Machine Deleted',
            settings.language === 'zh-CN' ? '虚拟机已移到废纸篓。' : 'Machine moved to the trash.'
          ),
          ...current
        ]);
        return true;
      } catch {
        setActivity((current) => [
          makeActivity(
            settings.language === 'zh-CN' ? '删除失败' : 'Delete Failed',
            settings.language === 'zh-CN'
              ? '无法移动到废纸篓，请确认这台虚拟机是否仍存在。'
              : 'Could not move this machine to the trash. Check whether it still exists.'
          ),
          ...current
        ]);
        return false;
      }
    },
    [settings.language]
  );

  const startMachine = useCallback(
    async (machinePath: string): Promise<StartMachineActionResult> => {
      if (!machinePath) {
        return {
          ok: false,
          machinePath
        };
      }
      setStartError(null);
      let resolvedMachinePath = machinePath;

      if (draft?.filePath === machinePath && draft.dirty) {
        const savedPath = await saveDraft('save');
        if (!savedPath) {
          setActivity((current) => [
            makeActivity(
              settings.language === 'zh-CN' ? '启动失败' : 'Start Failed',
              settings.language === 'zh-CN' ? '无法先保存当前虚拟机配置。' : 'Could not save the current machine configuration before starting.'
            ),
            ...current
          ]);
          return {
            ok: false,
            machinePath: resolvedMachinePath
          };
        }
        resolvedMachinePath = savedPath;
      }

      const result = await window.electronAPI.runtime.startMachine(resolvedMachinePath);
      if (result.state) {
        const nextState = result.state;
        setRuntimeMachines((current) => {
          const others = current.filter((item) => item.machineId !== nextState.machineId);
          if (nextState.status === 'stopped') {
            return others;
          }
          return [...others, nextState];
        });
      }
      if (!result.ok && result.error) {
        setStartError(formatStartError(settings.language, result.error));
        setActivity((current) => [
          makeActivity(
            settings.language === 'zh-CN' ? '启动失败' : 'Start Failed',
            result.error ?? (settings.language === 'zh-CN' ? '无法启动虚拟机。' : 'Could not start the virtual machine.')
          ),
          ...current
        ]);
      }
      return {
        ok: result.ok,
        machinePath: resolvedMachinePath,
        machineId: result.state?.machineId
      };
    },
    [draft?.dirty, draft?.filePath, saveDraft, settings.language]
  );

  const stopMachine = useCallback(
    async (id: string) => {
      const result = await window.electronAPI.runtime.stopMachine(id);
      if (!result.ok && result.error) {
        setActivity((current) => [
          makeActivity(
            settings.language === 'zh-CN' ? '关机失败' : 'Stop Failed',
            result.error ?? (settings.language === 'zh-CN' ? '无法关闭虚拟机。' : 'Could not stop the virtual machine.')
          ),
          ...current
        ]);
      }
      return result.ok;
    },
    [settings.language]
  );

  const forceStopMachine = useCallback(
    async (id: string) => {
      const result = await window.electronAPI.runtime.forceStopMachine(id);
      if (result.ok) {
        setRuntimeMachines((current) => current.filter((item) => item.machineId !== id));
      }
      if (!result.ok && result.error) {
        setActivity((current) => [
          makeActivity(
            settings.language === 'zh-CN' ? '强制停止失败' : 'Force Stop Failed',
            result.error ?? (settings.language === 'zh-CN' ? '无法强制停止虚拟机。' : 'Could not force stop the virtual machine.')
          ),
          ...current
        ]);
      }
      return result.ok;
    },
    [settings.language]
  );

  const triggerTransition = useCallback((type: FullscreenTransitionType, action: () => void | Promise<void>, origin?: FullscreenTransitionOrigin) => {
    const run = transitionRunRef.current + 1;
    transitionRunRef.current = run;
    const viewportWidth = Math.max(window.innerWidth, 1);
    const viewportHeight = Math.max(window.innerHeight, 1);
    const normalizedOrigin = origin && origin.size > 0
      ? origin
      : { x: viewportWidth / 2, y: viewportHeight / 2, size: 64 };
    const reducedMotion = settings.reduceMotion || (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
    const coverDuration = reducedMotion ? 100 : 680;

    setTransition({ active: true, type, origin: normalizedOrigin, phase: 'covering' });
    window.setTimeout(() => {
      void Promise.resolve()
        .then(action)
        .catch(() => undefined)
        .finally(() => {
          if (transitionRunRef.current !== run) return;
          setTransition({ active: true, type, origin: normalizedOrigin, phase: 'revealing' });
          window.setTimeout(() => {
            if (transitionRunRef.current !== run) return;
            setTransition({ active: false, type: 'launch', origin: null, phase: 'covering' });
          }, reducedMotion ? 120 : 360);
        });
    }, coverDuration);
  }, [settings.reduceMotion]);

  const renameMachine = useCallback(
    async (machinePath: string, newTitle: string) => {
      if (!machinePath || !newTitle.trim()) return false;
      try {
        const sanitized = newTitle.trim();
        const opened = await window.electronAPI.files.readSaka(machinePath);
        if (!opened) return false;
        const parsed = parseSakaContent(opened.content) as SakaMachine;
        parsed.title = sanitized;
        const content = serializeSakaMachine(parsed);

        const parentDir = machinePath.substring(0, Math.max(machinePath.lastIndexOf('/'), machinePath.lastIndexOf('\\')));
        const newFolderName = process.platform === 'darwin' ? `${sanitized}.saka` : sanitized;
        const newPath = `${parentDir}/${newFolderName}`;

        let finalPath = machinePath;
        if (newPath !== machinePath) {
          await window.electronAPI.files.renamePath(machinePath, newPath);
          finalPath = newPath;
        }

        await window.electronAPI.files.saveSaka(finalPath, content);

        const updatedRecents = recents.map((item) => {
          if (item.path === machinePath) {
            return {
              ...item,
              title: sanitized,
              path: finalPath,
              updatedAt: new Date().toISOString()
            };
          }
          return item;
        });
        setRecents(updatedRecents);

        await window.electronAPI.recents.push({
          id: parsed.id,
          title: sanitized,
          path: finalPath,
          kind: 'machine',
          templateLabel: parsed.template.label,
          updatedAt: new Date().toISOString(),
          status: 'saved'
        });

        setDraft((current) => {
          if (current && current.filePath === machinePath) {
            return {
              ...current,
              filePath: finalPath,
              configPath: `${finalPath}/machine.svm`,
              machine: {
                ...current.machine,
                title: sanitized
              }
            };
          }
          return current;
        });

        setActivity((current) => [
          makeActivity(
            settings.language === 'zh-CN' ? '已重命名虚拟机' : 'Machine Renamed',
            settings.language === 'zh-CN' ? `虚拟机已重命名为 ${sanitized}。` : `Machine renamed to ${sanitized}.`
          ),
          ...current
        ]);

        return true;
      } catch {
        return false;
      }
    },
    [recents, settings.language]
  );

  const duplicateMachine = useCallback(
    async (machinePath: string) => {
      if (!machinePath) return false;
      try {
        const opened = await window.electronAPI.files.readSaka(machinePath);
        if (!opened) return false;
        const parsed = parseSakaContent(opened.content) as SakaMachine;

        const existingTitles = recents.map((r) => r.title);
        const duplicateTitle = getUniqueMachineTitle(`${parsed.title} Copy`, existingTitles);

        parsed.title = duplicateTitle;
        parsed.id = `machine-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
        const content = serializeSakaMachine(parsed);

        const parentDir = machinePath.substring(0, Math.max(machinePath.lastIndexOf('/'), machinePath.lastIndexOf('\\')));
        const newFolderName = process.platform === 'darwin' ? `${duplicateTitle}.saka` : duplicateTitle;
        const newPath = `${parentDir}/${newFolderName}`;

        await window.electronAPI.files.copyPath(machinePath, newPath);
        await window.electronAPI.files.saveSaka(newPath, content);

        const entry = {
          id: parsed.id,
          title: duplicateTitle,
          path: newPath,
          kind: 'machine' as const,
          templateLabel: parsed.template.label,
          updatedAt: new Date().toISOString(),
          status: 'saved' as const
        };

        const nextRecents = (await window.electronAPI.recents.push(entry)) as RecentEntry[];
        setRecents(nextRecents);

        setActivity((current) => [
          makeActivity(
            settings.language === 'zh-CN' ? '已复制虚拟机' : 'Machine Duplicated',
            settings.language === 'zh-CN' ? `已复制虚拟机副本 ${duplicateTitle}。` : `Machine duplicated as ${duplicateTitle}.`
          ),
          ...current
        ]);

        return true;
      } catch {
        return false;
      }
    },
    [recents, settings.language]
  );

  const runningMachines = useMemo(
    () => runtimeMachines.filter((entry) => entry.status === 'running' || entry.status === 'starting').map((entry) => entry.machineId),
    [runtimeMachines]
  );

  const getRuntimeStateForMachine = useCallback(
    (machineId: string): RuntimeMachineState | undefined => runtimeMachines.find((entry) => entry.machineId === machineId),
    [runtimeMachines]
  );

  const value = useMemo<AppStoreValue>(
    () => ({
      ready,
      settings,
      recents,
      draft,
      appMeta,
      aboutOpen,
      openAboutDialog,
      activity,
      messages: resources[settings.language],
      templates: [...settings.templateCatalog].sort((a, b) => a.order - b.order),
      initialize,
      setLanguage,
      setTheme,
      setReduceMotion,
      setAboutOpen,
      createDraftFromTemplateKey,
      applyTemplateSelection,
      updateDraft,
      saveDraft,
      openSakaByPath,
      openSakaDialog,
      persistSettings,
      importTemplateFromDialog,
      updateTemplateCatalog,
      createDraftFromDisk,
      deleteMachine,
      runtimeEnvironment,
      runtimeMachines,
      runningMachines,
      getRuntimeStateForMachine,
      startMachine,
      stopMachine,
      forceStopMachine,
      transition,
      triggerTransition,
      deleteTarget,
      setDeleteTarget,
      startError,
      setStartError,
      renameMachine,
      duplicateMachine,
      reorderRecents,
      highlightedMachinePath,
      updateCurrentInfo,
      updateLastCheck,
      updateReminder,
      dismissUpdateReminder,
      checkForUpdates,
      skipUpdateVersion,
      openUpdatePage
    }),
    [
      aboutOpen,
      openAboutDialog,
      activity,
      appMeta,
      applyTemplateSelection,
      createDraftFromTemplateKey,
      draft,
      importTemplateFromDialog,
      initialize,
      openSakaByPath,
      openSakaDialog,
      ready,
      recents,
      saveDraft,
      setLanguage,
      setTheme,
      setReduceMotion,
      settings,
      updateDraft,
      updateTemplateCatalog,
      persistSettings,
      createDraftFromDisk,
      deleteMachine,
      runtimeEnvironment,
      runtimeMachines,
      runningMachines,
      getRuntimeStateForMachine,
      startMachine,
      stopMachine,
      forceStopMachine,
      transition,
      triggerTransition,
      deleteTarget,
      startError,
      renameMachine,
      duplicateMachine,
      reorderRecents,
      highlightedMachinePath,
      updateCurrentInfo,
      updateLastCheck,
      updateReminder,
      dismissUpdateReminder,
      checkForUpdates,
      skipUpdateVersion,
      openUpdatePage
    ]
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore() {
  const store = useContext(AppStoreContext);
  if (!store) {
    throw new Error('useAppStore must be used within AppStoreProvider');
  }
  return store;
}
