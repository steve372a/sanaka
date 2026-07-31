import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Checkbox } from './Checkbox';
import { Toast } from './Toast';
import { WebFilePickerDialog } from './WebFileBrowser';
import { getWebResourceDisplayName, isExternalWebResource, isWebMode, showWebModificationNotice } from '../lib/webMode';
import { useT } from '../hooks/useT';
import type { DiskInterface } from '../domain/schemas';

// 镜像格式选项
const imageFormats = [
  { value: 'qcow2', label: 'QCOW2 (QEMU)' },
  { value: 'qed', label: 'QED (QEMU Enhanced)' },
  { value: 'qcow', label: 'QCOW (Legacy)' },
  { value: 'vmdk', label: 'VMDK (VMware)' },
  { value: 'vpc', label: 'VHD (Virtual PC)' },
  { value: 'vdi', label: 'VDI (VirtualBox)' },
  { value: 'raw', label: 'IMG (Raw)' }
] as const;

type ImageFormat = typeof imageFormats[number]['value'];
type CapacityUnit = 'MB' | 'GB';
type TabType = 'import' | 'browse' | 'create' | 'manage';

interface DiskImageInfo {
  id: string;
  path: string;
  name: string;
  format: ImageFormat;
  virtualSize: number;
  actualSize: number;
  unit: CapacityUnit;
}

type DiskStorageMode = 'managed' | 'external';

interface MachineDiskDraft {
  id: string;
  path: string;
  format?: ImageFormat;
  interface: DiskInterface;
  boot: boolean;
  readonly: boolean;
  storage_mode?: DiskStorageMode;
  source_path?: string;
  image_options?: {
    compression?: boolean;
    sparse?: boolean;
    preallocate?: boolean;
  };
  pending_create?: {
    size: number;
    unit: CapacityUnit;
  };
}

interface DiskImageManagerProps {
  isOpen: boolean;
  onClose: () => void;
  existingDisks: MachineDiskDraft[];
  onDisksChange: (disks: MachineDiskDraft[]) => void;
  defaultInterface: DiskInterface;
  bundlePath?: string;
  rawQemuValues?: boolean;
}

interface DiskEditorState {
  resizeSize: string;
  resizeUnit: CapacityUnit;
  convertFormat: ImageFormat;
  compression: boolean;
  sparse: boolean;
  preallocate: boolean;
  dirty: boolean;
  busy?: 'resize' | 'convert' | 'reclaim' | 'apply';
  error?: string;
  success?: string;
}

// Custom Select Component
interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  rawValues?: boolean;
}

const ChevronDownIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter" width="12" height="12">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

function CustomSelect({ value, options, onChange, placeholder = '请选择', rawValues = false }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const dropdown = isOpen ? (
    <div className="disk-image-manager__select-dropdown">
      {options.map((option) => (
        <div
          key={option.value}
          className={`disk-image-manager__select-option ${option.value === value ? 'disk-image-manager__select-option--selected' : ''}`}
          onClick={() => {
            onChange(option.value);
            setIsOpen(false);
          }}
        >
          <span className="disk-image-manager__checkmark">
            {option.value === value && <CheckIcon />}
          </span>
          <span>{rawValues ? option.value : option.label}</span>
        </div>
      ))}
    </div>
  ) : null;

  return (
    <div className="disk-image-manager__select" ref={containerRef}>
      <div
        className={`disk-image-manager__select-trigger ${isOpen ? 'disk-image-manager__select-trigger--open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{selectedOption ? (rawValues ? selectedOption.value : selectedOption.label) : placeholder}</span>
        <span className="disk-image-manager__select-arrow">
          <ChevronDownIcon />
        </span>
      </div>
      {dropdown}
    </div>
  );
}

// Icons
const ImportIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const CreateIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

const BrowseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    <line x1="12" y1="11" x2="12" y2="17" />
    <line x1="9" y1="14" x2="15" y2="14" />
  </svg>
);

const ManageIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
    <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
    <line x1="6" y1="6" x2="6.01" y2="6" />
    <line x1="6" y1="18" x2="6.01" y2="18" />
  </svg>
);

const DiskIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
    <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
    <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
    <line x1="6" y1="6" x2="6.01" y2="6" />
    <line x1="6" y1="18" x2="6.01" y2="18" />
  </svg>
);

const ExpandIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="16"
    height="16"
    style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const WarningIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const ResizeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
  </svg>
);

const ConvertIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

const CleanupIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

function inferFormatFromPath(filePath: string): ImageFormat {
  const ext = filePath.split('.').pop()?.toLowerCase() || 'raw';
  const formatMap: Record<string, ImageFormat> = {
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

function toDisplayCapacity(bytes: number) {
  if (bytes <= 0) {
    return { size: 0, unit: 'GB' as CapacityUnit };
  }
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) {
    return { size: Number(gb.toFixed(gb >= 10 ? 0 : 1)), unit: 'GB' as CapacityUnit };
  }
  return { size: Math.max(1, Math.round(bytes / (1024 ** 2))), unit: 'MB' as CapacityUnit };
}

function buildEditorState(image: DiskImageInfo, disk?: MachineDiskDraft): DiskEditorState {
  const capacity = image.virtualSize > 0 ? { size: image.virtualSize, unit: image.unit } : { size: 20, unit: 'GB' as CapacityUnit };
  return {
    resizeSize: String(capacity.size || 20),
    resizeUnit: capacity.unit,
    convertFormat: image.format,
    compression: disk?.image_options?.compression ?? false,
    sparse: disk?.image_options?.sparse ?? false,
    preallocate: disk?.image_options?.preallocate ?? false,
    dirty: false
  };
}

export function DiskImageManager({ isOpen, onClose, existingDisks, onDisksChange, defaultInterface, bundlePath, rawQemuValues = false }: DiskImageManagerProps) {
  const t = useT();
  const [activeTab, setActiveTab] = useState<TabType>('import');
  const [importedImages, setImportedImages] = useState<DiskImageInfo[]>([]);
  const [expandedImageId, setExpandedImageId] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [editorStates, setEditorStates] = useState<Record<string, DiskEditorState>>({});
  const [webPickerOpen, setWebPickerOpen] = useState(false);

  // Create new image state
  const [newImageName, setNewImageName] = useState('');
  const [newImageSize, setNewImageSize] = useState<number>(20);
  const [newImageUnit, setNewImageUnit] = useState<CapacityUnit>('GB');
  const [newImageFormat, setNewImageFormat] = useState<ImageFormat>('qcow2');
  const [newImagePreallocate, setNewImagePreallocate] = useState(false);

  // Active operation panel state
  const [activeOperation, setActiveOperation] = useState<string | null>(null);

  // Browse local images state
  const [localImages, setLocalImages] = useState<Array<{
    path: string;
    name: string;
    format: ImageFormat;
    virtualSize: number;
    actualSize: number;
    unit: CapacityUnit;
  }>>([]);
  const [selectedLocalImages, setSelectedLocalImages] = useState<Set<string>>(new Set());
  const [loadingLocal, setLoadingLocal] = useState(false);

  // Toast state
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setToastVisible(true);
  }, []);

  const hideToast = useCallback(() => {
    setToastVisible(false);
  }, []);

  // Advanced options state
  // Handle animation
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (activeTab !== 'browse' || !bundlePath) return;

    const loadLocalImages = async () => {
      setLoadingLocal(true);
      try {
        const result = await window.electronAPI.disks.listLocalImages(bundlePath);
        setLocalImages(result.images.map((img: { path: string; name: string; format: string; size: number; unit: string }) => ({
          path: img.path,
          name: img.name,
          format: inferFormatFromPath(img.path),
          virtualSize: img.size,
          actualSize: img.size,
          unit: img.unit as CapacityUnit
        })));
      } catch {
        setLocalImages([]);
      }
      setLoadingLocal(false);
    };

    void loadLocalImages();
  }, [activeTab, bundlePath]);

  useEffect(() => {
    let cancelled = false;

    const loadImages = async () => {
      const records = await Promise.all(
        existingDisks.map(async (disk) => {
          const isManaged = disk.storage_mode === 'managed';
          const resolvedPath = isManaged && bundlePath ? `${bundlePath}/${disk.path}`.replace(/\/+/g, '/') : disk.path;
          const fallbackCapacity = disk.pending_create ? { size: disk.pending_create.size, unit: disk.pending_create.unit } : { size: 0, unit: 'GB' as CapacityUnit };

          const base: DiskImageInfo = {
            id: disk.id,
            path: disk.path,
            name: getWebResourceDisplayName(disk.path) || 'unnamed',
            format: disk.format || inferFormatFromPath(disk.path),
            virtualSize: fallbackCapacity.size,
            actualSize: 0,
            unit: fallbackCapacity.unit
          };

          if (!isWebMode() && !disk.pending_create && resolvedPath) {
            try {
              const info = await window.electronAPI.disks.getInfo(resolvedPath);
              const virtualDisplay = toDisplayCapacity(info.virtualSize);
              const actualDisplay = toDisplayCapacity(info.actualSize);
              return {
                ...base,
                path: disk.path,
                format: info.format,
                virtualSize: virtualDisplay.size,
                actualSize: actualDisplay.size,
                unit: virtualDisplay.unit,
                actualUnit: actualDisplay.unit,
                resolvedPath
              } as DiskImageInfo & { actualUnit?: CapacityUnit; resolvedPath?: string };
            } catch {
              return {
                ...base,
                resolvedPath
              } as DiskImageInfo & { resolvedPath?: string };
            }
          }

          return {
            ...base,
            resolvedPath
          } as DiskImageInfo & { resolvedPath?: string };
        })
      );

      if (cancelled) return;

      setImportedImages(records as DiskImageInfo[]);
      setEditorStates((current) => {
        const next: Record<string, DiskEditorState> = {};
        for (const image of records) {
          const disk = existingDisks.find((entry) => entry.id === image.id);
          next[image.id] = current[image.id] ?? buildEditorState(image, disk);
        }
        return next;
      });
    };

    void loadImages();

    return () => {
      cancelled = true;
    };
  }, [existingDisks, bundlePath]);

  const handleImportImage = useCallback(async () => {
    if (isWebMode()) {
      if (!bundlePath) {
        showWebModificationNotice();
        return;
      }
      setWebPickerOpen(true);
      return;
    }
    const picked = await window.electronAPI.dialogs.pickDisk();
    if (!picked?.path) return;

    const detectedFormat = inferFormatFromPath(picked.path);

    const newImage: DiskImageInfo = {
      id: `disk-${Date.now()}`,
      path: picked.path,
      name: picked.path.split(/[/\\]/).pop() || 'unnamed',
      format: detectedFormat,
      virtualSize: 0,
      actualSize: 0,
      unit: 'GB'
    };

    setImportedImages(prev => [...prev, newImage]);

    const newDisk = {
      id: newImage.id,
      path: picked.path,
      format: detectedFormat,
      interface: defaultInterface,
      boot: existingDisks.length === 0,
      readonly: false,
      storage_mode: 'external' as const,
      source_path: '',
      image_options: {
        compression: false,
        sparse: false,
        preallocate: false
      }
    };
    onDisksChange([...existingDisks, newDisk]);
  }, [bundlePath, existingDisks, onDisksChange, defaultInterface]);

  const handleWebDiskSelected = useCallback((relativePath: string) => {
    const newDisk = {
      id: `disk-${Date.now()}`,
      path: relativePath,
      format: inferFormatFromPath(relativePath),
      interface: defaultInterface,
      boot: existingDisks.length === 0,
      readonly: false,
      storage_mode: 'managed' as const,
      source_path: '',
      image_options: { compression: false, sparse: false, preallocate: false }
    };
    onDisksChange([...existingDisks, newDisk]);
    setWebPickerOpen(false);
  }, [defaultInterface, existingDisks, onDisksChange]);

  const handleAddLocalImages = useCallback(() => {
    const imagesToAdd = localImages.filter(img => selectedLocalImages.has(img.path));
    const newDisks = imagesToAdd.map(img => ({
      id: `disk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      path: img.path,
      format: img.format,
      interface: defaultInterface,
      boot: existingDisks.length === 0 && img === imagesToAdd[0],
      readonly: false,
      storage_mode: 'managed' as const,
      source_path: '',
      image_options: {
        compression: false,
        sparse: false,
        preallocate: false
      }
    }));

    onDisksChange([...existingDisks, ...newDisks]);
    setSelectedLocalImages(new Set());
  }, [localImages, selectedLocalImages, existingDisks, onDisksChange, defaultInterface]);

  const handleCreateImage = useCallback(async () => {
    const normalizedName = newImageName.trim();
    if (!normalizedName) return;
    const fileExtension = newImageFormat === 'raw' ? 'img' : newImageFormat;
    const relativePath = `Disks/${normalizedName}.${fileExtension}`;
    const newImage: DiskImageInfo = {
      id: `disk-${Date.now()}`,
      path: relativePath,
      name: normalizedName,
      format: newImageFormat,
      virtualSize: newImageSize,
      actualSize: 0,
      unit: newImageUnit
    };

    setImportedImages(prev => [...prev, newImage]);

    const newDisk = {
      id: newImage.id,
      path: relativePath,
      format: newImageFormat,
      interface: defaultInterface,
      boot: existingDisks.length === 0,
      readonly: false,
      storage_mode: 'managed' as const,
      source_path: '',
      image_options: {
        compression: false,
        sparse: false,
        preallocate: newImagePreallocate
      },
      pending_create: {
        size: newImageSize,
        unit: newImageUnit
      }
    };
    onDisksChange([...existingDisks, newDisk]);

    setNewImageName('');
    setNewImageSize(20);
  }, [newImageName, newImageSize, newImageUnit, newImageFormat, existingDisks, onDisksChange, defaultInterface, newImagePreallocate]);

  const handleRemoveImage = useCallback((imageId: string) => {
    const disk = existingDisks.find((entry) => entry.id === imageId);
    if (isWebMode() && isExternalWebResource(disk?.path)) {
      showWebModificationNotice();
      return;
    }
    setImportedImages(prev => prev.filter(img => img.id !== imageId));
    onDisksChange(existingDisks.filter(disk => disk.id !== imageId));
  }, [existingDisks, onDisksChange]);

  const toggleExpand = useCallback((imageId: string) => {
    setExpandedImageId(prev => prev === imageId ? null : imageId);
  }, []);

  const updateEditorState = useCallback((imageId: string, updater: (current: DiskEditorState) => DiskEditorState) => {
    setEditorStates((current) => ({
      ...current,
      [imageId]: updater(current[imageId] ?? buildEditorState(importedImages.find((item) => item.id === imageId) ?? {
        id: imageId,
        path: '',
        name: '',
        format: 'qcow2',
        virtualSize: 20,
        actualSize: 0,
        unit: 'GB'
      }))
    }));
  }, [importedImages]);

  const applyImageOptions = useCallback((imageId: string) => {
    const disk = existingDisks.find((entry) => entry.id === imageId);
    if (isWebMode() && isExternalWebResource(disk?.path)) {
      showWebModificationNotice();
      return;
    }
    const state = editorStates[imageId];
    if (!state) return;
    onDisksChange(existingDisks.map((disk) => (
      disk.id === imageId
        ? {
            ...disk,
            image_options: {
              compression: state.compression,
              sparse: state.sparse,
              preallocate: state.preallocate
            }
          }
        : disk
    )));
    updateEditorState(imageId, (current) => ({
      ...current,
      dirty: false,
      success: '已应用当前高级选项。',
      error: undefined
    }));
  }, [editorStates, existingDisks, onDisksChange, updateEditorState]);

  const handleResizeImage = useCallback(async (image: DiskImageInfo) => {
    if (isWebMode()) {
      showWebModificationNotice();
      return;
    }
    const resolvedPath = (image as DiskImageInfo & { resolvedPath?: string }).resolvedPath;
    if (!resolvedPath) {
      updateEditorState(image.id, (current) => ({ ...current, error: '当前镜像还没有真实文件，暂时不能调整大小。', success: undefined }));
      return;
    }
    const state = editorStates[image.id];
    const nextSize = Number(state?.resizeSize);
    if (!Number.isFinite(nextSize) || nextSize <= 0) {
      updateEditorState(image.id, (current) => ({ ...current, error: '请输入有效的新容量。', success: undefined }));
      return;
    }

    updateEditorState(image.id, (current) => ({ ...current, busy: 'resize', error: undefined, success: undefined }));
    const result = await window.electronAPI.disks.resize({
      path: resolvedPath,
      newSize: nextSize,
      unit: state.resizeUnit
    });

    if (!result.ok || !result.info) {
      updateEditorState(image.id, (current) => ({ ...current, busy: undefined, error: result.error || '调整大小失败。', success: undefined }));
      return;
    }

    const virtualDisplay = toDisplayCapacity(result.info.virtualSize);
    const actualDisplay = toDisplayCapacity(result.info.actualSize);
    const oldSize = formatFileSize(image.virtualSize, image.unit);
    const newSize = formatFileSize(virtualDisplay.size, virtualDisplay.unit);
    setImportedImages((current) => current.map((entry) => (
      entry.id === image.id
        ? {
            ...entry,
            format: result.info?.format || entry.format,
            virtualSize: virtualDisplay.size,
            actualSize: actualDisplay.size,
            unit: virtualDisplay.unit,
            actualUnit: actualDisplay.unit
          } as DiskImageInfo
        : entry
    )));
    updateEditorState(image.id, (current) => ({
      ...current,
      busy: undefined,
      resizeSize: String(virtualDisplay.size),
      resizeUnit: virtualDisplay.unit,
      success: '镜像大小已更新。',
      error: undefined
    }));
    showToast(t('diskManager.toast.resized', { oldSize, newSize }));
  }, [editorStates, updateEditorState, showToast, t]);

  const handleConvertImage = useCallback(async (image: DiskImageInfo) => {
    if (isWebMode()) {
      showWebModificationNotice();
      return;
    }
    const resolvedPath = (image as DiskImageInfo & { resolvedPath?: string }).resolvedPath;
    if (!resolvedPath) {
      updateEditorState(image.id, (current) => ({ ...current, error: '当前镜像还没有真实文件，暂时不能转换格式。', success: undefined }));
      return;
    }
    const state = editorStates[image.id];
    if (!state || state.convertFormat === image.format) {
      updateEditorState(image.id, (current) => ({ ...current, error: '请选择不同的目标格式。', success: undefined }));
      return;
    }

    updateEditorState(image.id, (current) => ({ ...current, busy: 'convert', error: undefined, success: undefined }));
    const result = await window.electronAPI.disks.convert({
      sourcePath: resolvedPath,
      sourceFormat: image.format,
      targetFormat: state.convertFormat,
      options: {
        compression: state.compression,
        sparse: state.sparse,
        preallocate: state.preallocate
      }
    });

    if (!result.ok || !result.path || !result.info) {
      updateEditorState(image.id, (current) => ({ ...current, busy: undefined, error: result.error || '格式转换失败。', success: undefined }));
      return;
    }

    const nextRelativePath =
      image.path.includes('/') || image.path.includes('\\')
        ? `${image.path.replace(/[/\\][^/\\]+$/, '')}/${result.path.split(/[/\\]/).pop() || ''}`.replace(/\/+/g, '/')
        : result.path.split(/[/\\]/).pop() || image.path;

    onDisksChange(existingDisks.map((disk) => (
      disk.id === image.id
        ? {
            ...disk,
            path: nextRelativePath,
            format: state.convertFormat,
            image_options: {
              compression: state.compression,
              sparse: state.sparse,
              preallocate: state.preallocate
            }
          }
        : disk
    )));

    updateEditorState(image.id, (current) => ({
      ...current,
      busy: undefined,
      dirty: false,
      success: '镜像格式已转换。',
      error: undefined
    }));
    showToast(t('diskManager.toast.converted', { format: state.convertFormat.toUpperCase() }));
  }, [editorStates, existingDisks, onDisksChange, updateEditorState, showToast, t]);

  const handleReclaimSpace = useCallback(async (image: DiskImageInfo) => {
    if (isWebMode()) {
      showWebModificationNotice();
      return;
    }
    const resolvedPath = (image as DiskImageInfo & { resolvedPath?: string }).resolvedPath;
    if (!resolvedPath) {
      updateEditorState(image.id, (current) => ({ ...current, error: '当前镜像还没有真实文件，暂时不能回收空间。', success: undefined }));
      return;
    }

    updateEditorState(image.id, (current) => ({ ...current, busy: 'reclaim', error: undefined, success: undefined }));
    const result = await window.electronAPI.disks.reclaimSpace(resolvedPath);
    if (!result.ok || !result.info) {
      updateEditorState(image.id, (current) => ({ ...current, busy: undefined, error: result.error || '回收空间失败。', success: undefined }));
      return;
    }

    const virtualDisplay = toDisplayCapacity(result.info.virtualSize);
    const actualDisplay = toDisplayCapacity(result.info.actualSize);
    const reclaimedMB = result.reclaimedBytes ? Math.round(result.reclaimedBytes / (1024 * 1024)) : 0;
    setImportedImages((current) => current.map((entry) => (
      entry.id === image.id
        ? {
            ...entry,
            virtualSize: virtualDisplay.size,
            actualSize: actualDisplay.size,
            unit: virtualDisplay.unit,
            actualUnit: actualDisplay.unit
          } as DiskImageInfo
        : entry
    )));
    updateEditorState(image.id, (current) => ({
      ...current,
      busy: undefined,
      success: result.reclaimedBytes && result.reclaimedBytes > 0 ? '已回收无用空间。' : '检查完成，没有可回收的无用空间。',
      error: undefined
    }));
    if (reclaimedMB > 0) {
      showToast(t('diskManager.toast.reclaimed', { size: reclaimedMB }));
    }
  }, [updateEditorState, showToast, t]);

  const formatFileSize = (size: number, unit: CapacityUnit): string => {
    return `${size} ${unit}`;
  };

  const unitOptions: SelectOption[] = [
    { value: 'MB', label: 'MB' },
    { value: 'GB', label: 'GB' }
  ];

  const formatOptions: SelectOption[] = imageFormats.map(fmt => ({
    value: fmt.value,
    label: fmt.label
  }));

  if (!isVisible) return null;

  return (
    <div className={`disk-image-manager-overlay ${isOpen ? 'disk-image-manager-overlay--open' : ''}`} onClick={onClose}>
      <div className="disk-image-manager" onClick={e => e.stopPropagation()}>
        <div className="disk-image-manager__header">
          <h2>{t('diskManager.title')}</h2>
          <button className="button button--ghost" onClick={onClose} type="button">
            {t('app.close')}
          </button>
        </div>

        <div className="disk-image-manager__tabs">
          <button
            className={`disk-image-manager__tab ${activeTab === 'import' ? 'disk-image-manager__tab--active' : ''}`}
            onClick={() => setActiveTab('import')}
            type="button"
          >
            <ImportIcon />
            <span>{t('diskManager.tabs.import')}</span>
          </button>
          <button
            className={`disk-image-manager__tab ${activeTab === 'browse' ? 'disk-image-manager__tab--active' : ''}`}
            onClick={() => setActiveTab('browse')}
            type="button"
          >
            <BrowseIcon />
            <span>{t('diskManager.tabs.browse')}</span>
          </button>
          <button
            className={`disk-image-manager__tab ${activeTab === 'create' ? 'disk-image-manager__tab--active' : ''}`}
            onClick={() => setActiveTab('create')}
            type="button"
          >
            <CreateIcon />
            <span>{t('diskManager.tabs.create')}</span>
          </button>
          <button
            className={`disk-image-manager__tab ${activeTab === 'manage' ? 'disk-image-manager__tab--active' : ''}`}
            onClick={() => setActiveTab('manage')}
            type="button"
          >
            <ManageIcon />
            <span>{t('diskManager.tabs.manage')}</span>
          </button>
        </div>

        <div className="disk-image-manager__content">
          {activeTab === 'import' && (
            <div className="disk-image-manager__section disk-image-manager__tab-panel" key="import">
              <div className="disk-image-manager__intro">
                <h3>{t('diskManager.import.title')}</h3>
                <p>{t('diskManager.import.description')}</p>
              </div>

              <div className="disk-image-manager__formats">
                <span className="disk-image-manager__label">{t('diskManager.formats.supported')}</span>
                <div className="disk-image-manager__format-tags">
                  {imageFormats.map(fmt => (
                    <span key={fmt.value} className="format-tag">{fmt.label}</span>
                  ))}
                </div>
              </div>

              <button
                className="button button--primary disk-image-manager__action-btn"
                onClick={handleImportImage}
                type="button"
              >
                <ImportIcon />
                {t('diskManager.import.button')}
              </button>
            </div>
          )}

          {activeTab === 'browse' && (
            <div className="disk-image-manager__section disk-image-manager__tab-panel" key="browse">
              <div className="disk-image-manager__intro">
                <h3>{t('diskManager.browse.title')}</h3>
                <p>{t('diskManager.browse.description')}</p>
              </div>

              {!bundlePath ? (
                <div className="disk-image-manager__empty">
                  <DiskIcon />
                  <p>{t('diskManager.browse.noBundlePath')}</p>
                </div>
              ) : loadingLocal ? (
                <div className="disk-image-manager__loading">{t('common.loading')}</div>
              ) : localImages.length === 0 ? (
                <div className="disk-image-manager__empty">
                  <DiskIcon />
                  <p>{t('diskManager.browse.empty')}</p>
                </div>
              ) : (
                <>
                  <div className="disk-image-manager__local-list">
                    {localImages.map((image) => (
                      <div
                        key={image.path}
                        className={`disk-image-manager__local-item ${selectedLocalImages.has(image.path) ? 'disk-image-manager__local-item--selected' : ''}`}
                        onClick={() => {
                          setSelectedLocalImages(prev => {
                            const next = new Set(prev);
                            if (next.has(image.path)) {
                              next.delete(image.path);
                            } else {
                              next.add(image.path);
                            }
                            return next;
                          });
                        }}
                      >
                        <div className="disk-image-manager__local-checkbox">
                          {selectedLocalImages.has(image.path) && <CheckIcon />}
                        </div>
                        <div className="disk-image-manager__local-info">
                          <strong>{image.name}</strong>
                          <span>{image.format.toUpperCase()} · {formatFileSize(image.virtualSize, image.unit)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    className="button button--primary disk-image-manager__action-btn"
                    onClick={handleAddLocalImages}
                    disabled={selectedLocalImages.size === 0}
                    type="button"
                  >
                    {t('diskManager.browse.addSelected').replace('{{count}}', String(selectedLocalImages.size))}
                  </button>
                </>
              )}
            </div>
          )}

          {activeTab === 'create' && (
            <div className="disk-image-manager__section disk-image-manager__tab-panel" key="create">
              <div className="disk-image-manager__intro">
                <h3>{t('diskManager.create.title')}</h3>
                <p>{t('diskManager.create.description')}</p>
              </div>

              <div className="disk-image-manager__form">
                <div className="disk-image-manager__field">
                  <label>{t('diskManager.create.nameLabel')}</label>
                  <input
                    type="text"
                    value={newImageName}
                    onChange={(e) => setNewImageName(e.target.value)}
                    placeholder={t('diskManager.create.namePlaceholder')}
                  />
                </div>

                <div className="disk-image-manager__field-row">
                  <div className="disk-image-manager__field">
                    <label>{t('diskManager.create.sizeLabel')}</label>
                    <div className="disk-image-manager__size-input">
                      <input
                        type="number"
                        min={1}
                        value={newImageSize}
                        onChange={(e) => setNewImageSize(Math.max(1, Number(e.target.value)))}
                      />
                      <CustomSelect
                        value={newImageUnit}
                        options={unitOptions}
                        onChange={(value) => setNewImageUnit(value as CapacityUnit)}
                      />
                    </div>
                  </div>

                  <div className="disk-image-manager__field">
                    <label>{t('diskManager.create.formatLabel')}</label>
                    <CustomSelect
                      value={newImageFormat}
                      options={formatOptions}
                      rawValues={rawQemuValues}
                      onChange={(value) => setNewImageFormat(value as ImageFormat)}
                    />
                  </div>
                </div>
                <Checkbox
                  checked={newImagePreallocate}
                  onChange={setNewImagePreallocate}
                  label={t('diskManager.advanced.preallocate')}
                />
              </div>

              <button
                className="button button--primary disk-image-manager__action-btn"
                onClick={handleCreateImage}
                disabled={!newImageName.trim()}
                type="button"
              >
                <CreateIcon />
                {t('diskManager.create.button')}
              </button>
            </div>
          )}

          {activeTab === 'manage' && (
            <div className="disk-image-manager__section disk-image-manager__tab-panel" key="manage">
              <div className="disk-image-manager__intro">
                <h3>{t('diskManager.manage.title')}</h3>
                <p>{t('diskManager.manage.description')}</p>
              </div>

              {importedImages.length === 0 ? (
                <div className="disk-image-manager__empty">
                  <DiskIcon />
                  <p>{t('diskManager.manage.empty')}</p>
                </div>
              ) : (
                <div className="disk-image-manager__list">
                  {importedImages.map((image) => (
                    <div key={image.id} className="disk-image-item">
                      <div
                        className="disk-image-item__header"
                        onClick={() => toggleExpand(image.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && toggleExpand(image.id)}
                      >
                        <div className="disk-image-item__icon">
                          <DiskIcon />
                        </div>
                        <div className="disk-image-item__info">
                          <strong>{image.name}</strong>
                          <span className="disk-image-item__meta">
                            {image.format.toUpperCase()} · {formatFileSize(image.virtualSize, image.unit)}
                          </span>
                        </div>
                        <div className="disk-image-item__actions">
                          <button
                            className="button button--ghost button--icon"
                            aria-disabled={isWebMode() && isExternalWebResource(existingDisks.find((disk) => disk.id === image.id)?.path)}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveImage(image.id);
                            }}
                            type="button"
                            title={t('diskManager.manage.remove')}
                          >
                            <TrashIcon />
                          </button>
                          <span className="disk-image-item__expand">
                            <ExpandIcon expanded={expandedImageId === image.id} />
                          </span>
                        </div>
                      </div>

                      {expandedImageId === image.id && (
                        <div className="disk-image-item__details">
                          <div className="disk-image-item__section">
                            <h4>{t('diskManager.details.basicInfo')}</h4>
                            <div className="disk-image-item__info-grid">
                              <div className="info-row">
                                <span className="info-label">{t('diskManager.details.path')}</span>
                                <span className="info-value" title={getWebResourceDisplayName(image.path)}>{getWebResourceDisplayName(image.path)}</span>
                              </div>
                              <div className="info-row">
                                <span className="info-label">{t('diskManager.details.format')}</span>
                                <span className="info-value">{image.format.toUpperCase()}</span>
                              </div>
                              <div className="info-row">
                                <span className="info-label">{t('diskManager.details.virtualSize')}</span>
                                <span className="info-value">{formatFileSize(image.virtualSize, image.unit)}</span>
                              </div>
                              <div className="info-row">
                                <span className="info-label">{t('diskManager.details.actualSize')}</span>
                                <span className="info-value">{formatFileSize(image.actualSize, ((image as DiskImageInfo & { actualUnit?: CapacityUnit }).actualUnit || image.unit))}</span>
                              </div>
                            </div>
                          </div>

                          <div className="disk-image-item__section">
                            <h4>{t('diskManager.details.operations')}</h4>
                            <div className="disk-image-item__operations">
                              <CustomSelect
                                value={activeOperation || ''}
                                options={[
                                  { value: '', label: t('diskManager.selectOperation') },
                                  { value: 'resize', label: t('diskManager.operations.resize') },
                                  { value: 'convert', label: t('diskManager.operations.convert') },
                                  { value: 'cleanup', label: t('diskManager.operations.cleanup') }
                                ]}
                                onChange={(value) => setActiveOperation(value || null)}
                              />
                            </div>

                            {activeOperation === 'resize' && (
                              <div className="disk-image-item__operation-panel">
                                <div className="disk-image-item__operation-row">
                                  <input
                                    type="number"
                                    min={1}
                                    value={editorStates[image.id]?.resizeSize ?? ''}
                                    onChange={(event) => updateEditorState(image.id, (current) => ({
                                      ...current,
                                      resizeSize: event.target.value,
                                      error: undefined,
                                      success: undefined
                                    }))}
                                    placeholder={t('diskManager.create.sizeLabel')}
                                  />
                                  <div className="disk-image-manager__select--small">
                                    <CustomSelect
                                      value={editorStates[image.id]?.resizeUnit ?? 'GB'}
                                      options={unitOptions}
                                      onChange={(value) => updateEditorState(image.id, (current) => ({
                                        ...current,
                                        resizeUnit: value as CapacityUnit,
                                        error: undefined,
                                        success: undefined
                                      }))}
                                    />
                                  </div>
                                  <button
                                    className="button button--primary"
                                    type="button"
                                    onClick={() => void handleResizeImage(image)}
                                  >
                                    {editorStates[image.id]?.busy === 'resize' ? t('diskManager.processing') : t('diskManager.operations.resize')}
                                  </button>
                                </div>
                              </div>
                            )}

                            {activeOperation === 'convert' && (
                              <div className="disk-image-item__operation-panel">
                                <div className="disk-image-item__operation-row">
                                  <div className="disk-image-manager__select--medium">
                                    <CustomSelect
                                      value={editorStates[image.id]?.convertFormat ?? image.format}
                                      options={formatOptions}
                                      rawValues={rawQemuValues}
                                      onChange={(value) => updateEditorState(image.id, (current) => ({
                                        ...current,
                                        convertFormat: value as ImageFormat,
                                        error: undefined,
                                        success: undefined
                                      }))}
                                    />
                                  </div>
                                  <button
                                    className="button button--primary"
                                    type="button"
                                    onClick={() => void handleConvertImage(image)}
                                  >
                                    {editorStates[image.id]?.busy === 'convert' ? t('diskManager.processing') : t('diskManager.operations.convert')}
                                  </button>
                                </div>
                              </div>
                            )}

                            {activeOperation === 'cleanup' && (
                              <div className="disk-image-item__operation-panel">
                                <button
                                  className="button button--primary"
                                  type="button"
                                  onClick={() => void handleReclaimSpace(image)}
                                >
                                  {editorStates[image.id]?.busy === 'reclaim' ? t('diskManager.processing') : t('diskManager.operations.cleanup')}
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="disk-image-item__section">
                            <h4>{t('diskManager.details.advanced')}</h4>
                            <div className="disk-image-item__advanced">
                              <div className="disk-image-item__warning">
                                <WarningIcon />
                                <span>{t('diskManager.details.advancedWarning')}</span>
                              </div>
                              <div className="disk-image-manager__advanced-options">
                                <Checkbox
                                  checked={editorStates[image.id]?.compression ?? false}
                                  onChange={(checked) => updateEditorState(image.id, (current) => ({
                                    ...current,
                                    compression: checked,
                                    dirty: true,
                                    error: undefined,
                                    success: undefined
                                  }))}
                                  label={t('diskManager.advanced.compression')}
                                />
                                <Checkbox
                                  checked={editorStates[image.id]?.sparse ?? false}
                                  onChange={(checked) => updateEditorState(image.id, (current) => ({
                                    ...current,
                                    sparse: checked,
                                    dirty: true,
                                    error: undefined,
                                    success: undefined
                                  }))}
                                  label={t('diskManager.advanced.sparse')}
                                />
                                <Checkbox
                                  checked={editorStates[image.id]?.preallocate ?? false}
                                  onChange={(checked) => updateEditorState(image.id, (current) => ({
                                    ...current,
                                    preallocate: checked,
                                    dirty: true,
                                    error: undefined,
                                    success: undefined
                                  }))}
                                  label={t('diskManager.advanced.preallocate')}
                                />
                                <div className="disk-image-item__apply-row">
                                  <button
                                    className="button button--primary"
                                    type="button"
                                    onClick={() => {
                                      const state = editorStates[image.id];
                                      if (!state?.dirty) {
                                        updateEditorState(image.id, (current) => ({
                                          ...current,
                                          error: t('diskManager.noChanges')
                                        }));
                                        return;
                                      }
                                      if (state.busy) return;
                                      applyImageOptions(image.id);
                                    }}
                                  >
                                    {t('diskManager.apply')}
                                  </button>
                                  {editorStates[image.id]?.success ? (
                                    <span className="field__hint" style={{ color: 'var(--success)' }}>{editorStates[image.id]?.success}</span>
                                  ) : null}
                                  {editorStates[image.id]?.error ? (
                                    <span className="field__hint" style={{ color: 'var(--danger)' }}>{editorStates[image.id]?.error}</span>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {bundlePath && (
        <WebFilePickerDialog
          open={webPickerOpen}
          machineRef={bundlePath}
          directory="Disks"
          accept=".qcow2,.qed,.qcow,.vmdk,.vhd,.vpc,.vdi,.img,.raw"
          onSelect={handleWebDiskSelected}
          onClose={() => setWebPickerOpen(false)}
        />
      )}
      <Toast
        message={toastMessage}
        visible={toastVisible}
        onClose={hideToast}
      />
    </div>
  );
}
