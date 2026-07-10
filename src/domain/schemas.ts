import { z } from 'zod';

export const displayFrontendSchema = z.enum(['sanaka', 'spice', 'vnc']);
export const displayBackendHintSchema = z.enum(['spice', 'vnc']);
export const languageSchema = z.enum(['zh-CN', 'en-US']);
export const diskImageFormatSchema = z.enum(['qcow2', 'qed', 'qcow', 'vmdk', 'vpc', 'vdi', 'raw']);
export const diskStorageModeSchema = z.enum(['managed', 'external']);
export const diskSizeUnitSchema = z.enum(['MB', 'GB']);
export const diskInterfaceSchema = z.enum(['ide', 'scsi', 'sata', 'virtio']);
export const sharedFolderModeSchema = z.enum(['readonly', 'readwrite']);
export const clipboardBridgeModeSchema = z.enum(['text']);
export const guestArchSchema = z.enum(['none', 'x86_64', 'i386', 'aarch64', 'arm', 'riscv64', 'ppc', 'ppc64']);
export const acceleratorSchema = z.enum(['none', 'tcg', 'mttcg', 'kvm', 'hax', 'whpx', 'hvf']);
export const accentColorPresetSchema = z.enum(['purple', 'blue', 'orange', 'white', 'green']);

export const accentColorCustomSchema = z.object({
  lightPrimary: z.string(),
  lightSurface: z.string(),
  darkPrimary: z.string(),
  darkSurface: z.string()
});

export const accentColorTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  custom: accentColorCustomSchema
});

export const templateCatalogEntrySchema = z.object({
  key: z.string(),
  label: z.string(),
  source: z.enum(['builtin', 'imported']),
  enabled: z.boolean(),
  order: z.number(),
  defaultFrontend: displayFrontendSchema.optional(),
  path: z.string().optional()
});

export const appSettingsSchema = z.object({
  language: languageSchema,
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  defaultSaveDirectory: z.string(),
  webMode: z
    .object({
      port: z.number().int().min(1).max(65535).default(25895)
    })
    .default({ port: 25895 }),
  runtimeDefaults: z.object({
    displayFrontend: displayFrontendSchema,
    displayBackendHint: displayBackendHintSchema
  }),
  templateCatalog: z.array(templateCatalogEntrySchema),
  updates: z
    .object({
      skippedVersion: z.string().default('')
    })
    .default({ skippedVersion: '' }),
  experimental: z.object({
    brandedHero: z.boolean(),
    advancedConsole: z.boolean(),
    protocolInspector: z.boolean()
  }),
  accentColor: z
    .object({
      mode: z.enum(['preset', 'custom']),
      preset: accentColorPresetSchema.default('purple'),
      custom: accentColorCustomSchema.default({
        lightPrimary: '#C678FF',
        lightSurface: '#F7EFFF',
        darkPrimary: '#D4A3FF',
        darkSurface: '#2E1F3F'
      }),
      templates: z.array(accentColorTemplateSchema).default([])
    })
    .default({
      mode: 'preset',
      preset: 'purple',
      custom: {
        lightPrimary: '#C678FF',
        lightSurface: '#F7EFFF',
        darkPrimary: '#D4A3FF',
        darkSurface: '#2E1F3F'
      },
      templates: []
    })
});

export const recentEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  path: z.string(),
  kind: z.enum(['machine', 'template']),
  author: z.string().optional(),
  templateLabel: z.string().optional(),
  previewImageUrl: z.string().optional(),
  updatedAt: z.string(),
  status: z.enum(['saved', 'template'])
});

export const sakaMachineSchema = z.object({
  format_version: z.literal(1),
  kind: z.literal('machine'),
  id: z.string(),
  title: z.string(),
  description: z.string().optional().default(''),
  author: z.string().optional().default(''),
  created_with: z.string().optional().default('Sanaka 0.1'),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  template: z.object({
    key: z.string(),
    label: z.string()
  }),
  meta: z
    .object({
      notes: z.string().optional().default(''),
      tags: z.array(z.string()).optional().default([])
    })
    .optional()
    .default({ notes: '', tags: [] }),
  system: z.object({
    arch: guestArchSchema,
    machine_type: z.string().default(''),
    accelerator: acceleratorSchema,
    boot_order: z.enum(['none', 'cdrom', 'disk', 'floppy']),
    uefi: z.boolean().default(false),
    memory_mib: z.number().int().min(64).max(262144).default(2048),
    cpu_cores: z.number().int().min(1).max(64).default(2),
    sound_card: z.string().default('intel-hda')
  }),
  media: z.object({
    iso: z.string().optional().default(''),
    floppy: z.string().optional().default('')
  }),
  disks: z.array(
    z.object({
      id: z.string(),
      path: z.string(),
      format: diskImageFormatSchema.optional(),
      interface: diskInterfaceSchema,
      boot: z.boolean().default(false),
      readonly: z.boolean().optional().default(false),
      storage_mode: diskStorageModeSchema.optional().default('external'),
      source_path: z.string().optional().default(''),
      image_options: z
        .object({
          compression: z.boolean().default(false),
          sparse: z.boolean().default(false),
          preallocate: z.boolean().default(false)
        })
        .optional(),
      pending_create: z
        .object({
          size: z.number().positive(),
          unit: diskSizeUnitSchema
        })
        .optional()
    })
  ),
  network: z.object({
    enabled: z.boolean(),
    mode: z.enum(['user', 'bridge']),
    card: z.string()
  }),
  sharing: z.object({
    enabled: z.boolean().default(false),
    hostPath: z.string().default(''),
    mode: sharedFolderModeSchema.default('readwrite'),
    shareName: z.string().default('qemu')
  }),
  integration: z.object({
    clipboard: z.object({
      enabled: z.boolean().default(false),
      mode: clipboardBridgeModeSchema.default('text'),
      autoConnect: z.boolean().default(true)
    })
  }).default({
    clipboard: {
      enabled: false,
      mode: 'text',
      autoConnect: true
    }
  }),
  display: z.object({
    frontend: displayFrontendSchema,
    gpu: z.string(),
    sanaka: z
      .object({
        backend: displayBackendHintSchema.default('vnc'),
        scale_mode: z.enum(['fit', 'stretch']).default('fit'),
        clipboard: z.boolean().default(true)
      })
      .optional(),
    spice: z
      .object({
        address: z.string().default('127.0.0.1'),
        port: z.number().int().default(5930),
        clipboard: z.boolean().default(true),
        audio: z.boolean().default(true)
      })
      .optional(),
    vnc: z
      .object({
        address: z.string().default('127.0.0.1'),
        port: z.number().int().default(5901),
        password: z.string().default('')
      })
      .optional()
  }),
  peripherals: z.object({
    usb_tablet: z.boolean().default(true)
  }),
  advanced: z.object({
    audio_backend: z.enum(['auto', 'spice', 'pipewire', 'pulseaudio', 'coreaudio', 'directsound']).default('auto'),
    qemu_args: z.string().default(''),
    firmware: z
      .object({
        code_path: z.string().default(''),
        vars_path: z.string().default('')
      })
      .optional()
  })
});

export const sakaTemplateSchema = z.object({
  format_version: z.literal(1),
  kind: z.literal('template'),
  id: z.string(),
  title: z.string(),
  description: z.string().optional().default(''),
  template: z.object({
    key: z.string(),
    label: z.string()
  }),
  system: sakaMachineSchema.shape.system,
  media: sakaMachineSchema.shape.media.optional().default({ iso: '', floppy: '' }),
  network: sakaMachineSchema.shape.network,
  sharing: sakaMachineSchema.shape.sharing.optional().default({
    enabled: false,
    hostPath: '',
    mode: 'readwrite',
    shareName: 'qemu'
  }),
  integration: sakaMachineSchema.shape.integration.optional().default({
    clipboard: {
      enabled: false,
      mode: 'text',
      autoConnect: true
    }
  }),
  display: sakaMachineSchema.shape.display,
  peripherals: sakaMachineSchema.shape.peripherals.optional().default({ usb_tablet: true }),
  advanced: sakaMachineSchema.shape.advanced.optional().default({ audio_backend: 'auto', qemu_args: '' })
});

export const consoleEventSchema = z.object({
  id: z.string(),
  level: z.enum(['info', 'success', 'warning']),
  message: z.string(),
  time: z.string()
});

export const consoleSessionStateSchema = z.object({
  status: z.enum(['booting', 'running', 'paused', 'disconnected']),
  connected: z.boolean(),
  muted: z.boolean(),
  fullscreen: z.boolean(),
  inputCaptured: z.boolean(),
  zoom: z.enum(['fit', '100%', '125%', '150%']),
  startedAt: z.string(),
  displayHint: z.string(),
  audioHint: z.string(),
  events: z.array(consoleEventSchema)
});

export type DisplayFrontend = z.infer<typeof displayFrontendSchema>;
export type DisplayBackendHint = z.infer<typeof displayBackendHintSchema>;
export type DiskImageFormat = z.infer<typeof diskImageFormatSchema>;
export type DiskStorageMode = z.infer<typeof diskStorageModeSchema>;
export type DiskSizeUnit = z.infer<typeof diskSizeUnitSchema>;
export type DiskInterface = z.infer<typeof diskInterfaceSchema>;
export type SharedFolderMode = z.infer<typeof sharedFolderModeSchema>;
export type ClipboardBridgeMode = z.infer<typeof clipboardBridgeModeSchema>;
export type AppSettings = z.infer<typeof appSettingsSchema>;
export type TemplateCatalogEntry = z.infer<typeof templateCatalogEntrySchema>;
export type RecentEntry = z.infer<typeof recentEntrySchema>;
export type SakaMachine = z.infer<typeof sakaMachineSchema>;
export type SakaTemplate = z.infer<typeof sakaTemplateSchema>;
export type ConsoleSessionState = z.infer<typeof consoleSessionStateSchema>;

export interface WorkspaceMachineItem {
  id: string;
  title: string;
  path?: string;
  author?: string;
  templateLabel?: string;
  previewImageUrl?: string;
  updatedAt: string;
  status: 'saved' | 'template' | 'draft';
  source: 'recent' | 'draft';
  dirty?: boolean;
  missing?: boolean;
}

export interface WorkspaceSelection {
  items: WorkspaceMachineItem[];
  primary: WorkspaceMachineItem | null;
}

export interface WorkspaceActionModel {
  id: 'create' | 'open' | 'import' | 'details' | 'console' | 'save';
  label: string;
  emphasis: 'primary' | 'secondary' | 'ghost';
}

export interface MachineDraft {
  machine: SakaMachine;
  filePath?: string;
  configPath?: string;
  previewPath?: string;
  legacySingleFile?: boolean;
  dirty: boolean;
}
