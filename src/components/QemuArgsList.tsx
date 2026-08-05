import { useCallback, useEffect, useRef, useState } from 'react';
import type { SakaMachine } from '../domain/schemas';
import type { ControlledQemuBindingKey, FullQemuCommandArgItem, QemuArgItem } from '../types/electron';
import { isWebMode, showWebModificationNotice } from '../lib/webMode';

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const TriangleDownIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
    <polygon points="6,9 18,9 12,17" fill="currentColor" />
  </svg>
);

const TriangleUpIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
    <polygon points="6,15 18,15 12,7" fill="currentColor" />
  </svg>
);

interface ArgLine {
  id: string;
  raw: string;
  isCustom: boolean;
  editable: boolean;
  removable: boolean;
  bindingKey?: ControlledQemuBindingKey;
  editPrefix?: string;
  customIndex?: number;
}

interface QemuArgsListProps {
  machine: SakaMachine;
  onChange: (next: SakaMachine) => void;
  t: (key: string) => string;
}

function isFlagToken(raw: string): boolean {
  return String(raw || '').startsWith('-');
}

export function QemuArgsList({ machine, onChange, t }: QemuArgsListProps) {
  const customArgsLocked = isWebMode();
  const [args, setArgs] = useState<ArgLine[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const addTextareaRef = useRef<HTMLTextAreaElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const loadSequenceRef = useRef(0);

  const mapFullCommandArgs = useCallback((items: FullQemuCommandArgItem[]): ArgLine[] => {
    const tokenItems = (items || []).map((item, index) => ({
      id: item.id || `arg-${index}`,
      raw: item.raw,
      isCustom: item.isCustom,
      editable: Boolean(item.editable),
      removable: Boolean(item.removable),
      bindingKey: item.bindingKey,
      editPrefix: item.editPrefix,
      customIndex: item.customIndex
    }));

    const groupedItems: ArgLine[] = [];
    let index = 0;

    while (index < tokenItems.length) {
      const current = tokenItems[index];
      if (!current) {
        index += 1;
        continue;
      }

      if (index === 0 && !current.isCustom && !isFlagToken(current.raw)) {
        groupedItems.push(current);
        index += 1;
        continue;
      }

      if (current.isCustom) {
        const customGroup = [current];
        index += 1;
        while (index < tokenItems.length && tokenItems[index]?.isCustom && tokenItems[index]?.customIndex === current.customIndex) {
          customGroup.push(tokenItems[index]);
          index += 1;
        }

        groupedItems.push({
          id: `custom-group:${current.customIndex ?? current.id}`,
          raw: customGroup.map((item) => item.raw).join(' '),
          isCustom: true,
          editable: false,
          removable: true,
          customIndex: current.customIndex
        });
        continue;
      }

      const generatedGroup = [current];
      index += 1;
      while (index < tokenItems.length) {
        const next = tokenItems[index];
        if (!next || next.isCustom || isFlagToken(next.raw)) {
          break;
        }
        generatedGroup.push(next);
        index += 1;
      }

      const editableSource = generatedGroup.find((item) => item.editable && item.bindingKey);
      groupedItems.push({
        id: editableSource?.id || current.id,
        raw: generatedGroup.map((item) => item.raw).join(' '),
        isCustom: false,
        editable: Boolean(editableSource),
        removable: generatedGroup.some((item) => item.removable),
        bindingKey: editableSource?.bindingKey,
        editPrefix: editableSource?.editPrefix
      });
    }

    return groupedItems;
  }, []);

  const mapLegacyArgs = useCallback((items: QemuArgItem[]): ArgLine[] => {
    return (items || []).map((item, index) => ({
      id: `arg-${index}`,
      raw: item.raw,
      isCustom: item.source === 'custom',
      editable: Boolean(item.editable),
      removable: item.source === 'custom',
      bindingKey: item.bindingKey,
      editPrefix: item.bindingKey ? String(item.raw).split(' ')[0] : undefined
    }));
  }, []);

  const loadArgs = useCallback(
    async (nextMachine: SakaMachine) => {
      const requestSequence = ++loadSequenceRef.current;
      const runtime = window.electronAPI.runtime;
      if (runtime.getFullQemuCommand) {
        const result = await runtime.getFullQemuCommand(nextMachine);
        if (requestSequence !== loadSequenceRef.current) return;
        setArgs(mapFullCommandArgs(result.args || []));
        return;
      }
      if (runtime.buildQemuArgList) {
        const result = await runtime.buildQemuArgList(nextMachine);
        if (requestSequence !== loadSequenceRef.current) return;
        setArgs(mapLegacyArgs(result.args || []));
      }
    },
    [mapFullCommandArgs, mapLegacyArgs]
  );

  useEffect(() => {
    void loadArgs(machine);
    return () => {
      loadSequenceRef.current += 1;
    };
  }, [loadArgs, machine]);

  const refreshFromCustomArgs = useCallback(
    async (customArgs: string[]) => {
      const runtime = window.electronAPI.runtime;
      const customText = customArgs.join('\n');
      const nextMachine: SakaMachine = {
        ...machine,
        advanced: {
          ...machine.advanced,
          qemu_args: customText
        }
      };
      if (runtime.normalizeCustomQemuArgs) {
        const result = await runtime.normalizeCustomQemuArgs({
          machine,
          customArgs
        });
        onChange(result.machine);
        await loadArgs(result.machine);
        return;
      }
      if (runtime.getFullQemuCommand) {
        onChange(nextMachine);
        await loadArgs(nextMachine);
        return;
      }
      onChange(nextMachine);
    },
    [loadArgs, machine, onChange]
  );

  const currentCustomArgs = useCallback((): string[] => {
    return machine.advanced.qemu_args
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }, [machine]);

  const handleAdd = useCallback(() => {
    if (customArgsLocked) {
      showWebModificationNotice(t('builder.errors.webCustomArgsLocked'));
      return;
    }
    setIsAdding(true);
    setIsExpanded(true);
    setEditingId(null);
    setEditValue('');
    setError(null);
    setTimeout(() => addTextareaRef.current?.focus(), 0);
  }, [customArgsLocked, t]);

  const handleCancelAdd = useCallback(() => {
    setIsAdding(false);
    setEditingId(null);
    setEditValue('');
    setError(null);
  }, []);

  const handleCommitAdd = useCallback(async () => {
    const trimmed = editValue.trim();
    if (trimmed.length === 0) {
      handleCancelAdd();
      return;
    }
    const newLines = trimmed
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (newLines.length === 0) {
      handleCancelAdd();
      return;
    }
    const nextCustom = [...currentCustomArgs(), ...newLines];
    await refreshFromCustomArgs(nextCustom);
    setIsAdding(false);
    setEditValue('');
    setError(null);
  }, [editValue, currentCustomArgs, refreshFromCustomArgs, handleCancelAdd]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        void handleCommitAdd();
      } else if (event.key === 'Escape') {
        handleCancelAdd();
      }
    },
    [handleCommitAdd, handleCancelAdd]
  );

  const handleRemove = useCallback(
    async (customIndex: number | undefined) => {
      if (customArgsLocked) {
        showWebModificationNotice(t('builder.errors.webCustomArgsLocked'));
        return;
      }
      if (typeof customIndex !== 'number' || customIndex < 0) return;
      const nextCustom = currentCustomArgs().filter((_, i) => i !== customIndex);
      await refreshFromCustomArgs(nextCustom);
    },
    [currentCustomArgs, customArgsLocked, refreshFromCustomArgs, t]
  );

  const handleRemoveControlled = useCallback(
    async (item: ArgLine) => {
      if (!item.bindingKey) return;
      const runtime = window.electronAPI.runtime;
      if (!runtime.removeControlledQemuArg) return;
      const result = await runtime.removeControlledQemuArg({
        machine,
        bindingKey: item.bindingKey
      });
      if (!result.ok || !result.machine) {
        setError(t('builder.errors.invalidArgValue'));
        return;
      }
      onChange(result.machine);
      await loadArgs(result.machine);
      setError(null);
    },
    [loadArgs, machine, onChange, t]
  );

  const handleStartEdit = useCallback((item: ArgLine) => {
    if (!item.editable || !item.bindingKey || !item.editPrefix) return;
    setIsAdding(false);
    setEditingId(item.id);
    setEditValue(item.raw);
    setError(null);
    setTimeout(() => editInputRef.current?.focus(), 0);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditValue('');
    setError(null);
  }, []);

  const handleCommitEdit = useCallback(
    async (item: ArgLine) => {
      if (!item.bindingKey || !item.editPrefix) {
        handleCancelEdit();
        return;
      }
      const trimmed = editValue.trim();
      if (!trimmed) {
        setError(t('builder.errors.invalidArgValue'));
        return;
      }
      const runtime = window.electronAPI.runtime;
      if (!runtime.applyControlledQemuArgEdit) {
        handleCancelEdit();
        return;
      }
      const normalizedRaw = trimmed.startsWith('-') ? trimmed : `${item.editPrefix} ${trimmed}`;
      const result = await runtime.applyControlledQemuArgEdit({
        machine,
        bindingKey: item.bindingKey,
        raw: normalizedRaw
      });
      if (!result.ok || !result.machine) {
        setError(t('builder.errors.invalidArgValue'));
        return;
      }
      onChange(result.machine);
      await loadArgs(result.machine);
      setEditingId(null);
      setEditValue('');
      setError(null);
    },
    [editValue, handleCancelEdit, loadArgs, machine, onChange, t]
  );

  const handleEditKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>, item: ArgLine) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void handleCommitEdit(item);
      } else if (event.key === 'Escape') {
        handleCancelEdit();
      }
    },
    [handleCancelEdit, handleCommitEdit]
  );

  return (
    <div className="qemu-args-list">
      <div className="qemu-args-list__header">
        <span className="qemu-args-list__title">{t('builder.labels.advancedArgs')}</span>
        <button
          className="qemu-args-list__add-btn"
          type="button"
          onClick={handleAdd}
          aria-disabled={customArgsLocked}
          title={t('builder.actions.addArg')}
          aria-label={t('builder.actions.addArg')}
        >
          <PlusIcon />
          <span>{t('builder.actions.add')}</span>
        </button>
      </div>
      <div className="qemu-args-list__card">
        <div className="qemu-args-list__root">
          <button
            className="qemu-args-list__toggle"
            type="button"
            data-testid="qemu-args-toggle"
            aria-expanded={isExpanded}
            aria-label={isExpanded ? 'Collapse QEMU arguments' : 'Expand QEMU arguments'}
            title={isExpanded ? 'Collapse QEMU arguments' : 'Expand QEMU arguments'}
            onClick={() => setIsExpanded((prev) => !prev)}
          >
            {isExpanded ? <TriangleUpIcon /> : <TriangleDownIcon />}
          </button>
        </div>
        <div
          className={`qemu-args-list__second ${isExpanded ? 'qemu-args-list__second--expanded' : ''}`}
          aria-hidden={!isExpanded}
        >
          <div className="qemu-args-list__second-inner">
            <div className="qemu-args-list__list" role="list">
              {args.length === 0 ? (
                <div className="qemu-args-list__empty" role="listitem">
                  {t('builder.descriptions.advanced')}
                </div>
              ) : (
                args.map((item, index) => (
                  <div
                    key={item.id}
                    className={`qemu-args-list__row ${index === args.length - 1 ? 'qemu-args-list__row--last' : ''}`}
                    role="listitem"
                  >
                    {editingId === item.id ? (
                      <input
                        ref={editInputRef}
                        className="qemu-args-list__input"
                        type="text"
                        value={editValue}
                        aria-label={t('builder.labels.advancedArgs')}
                        onChange={(event) => setEditValue(event.target.value)}
                        onBlur={() => void handleCommitEdit(item)}
                        onKeyDown={(event) => handleEditKeyDown(event, item)}
                      />
                    ) : (
                      <code
                        className={`qemu-args-list__raw ${item.editable ? 'qemu-args-list__raw--editable' : ''}`}
                        onClick={() => handleStartEdit(item)}
                        role={item.editable ? 'button' : undefined}
                        tabIndex={item.editable ? 0 : -1}
                        onKeyDown={(event) => {
                          if (item.editable && (event.key === 'Enter' || event.key === ' ')) {
                            event.preventDefault();
                            handleStartEdit(item);
                          }
                        }}
                      >
                        {item.raw}
                      </code>
                    )}
                    {item.removable && (
                      <button
                        className="qemu-args-list__remove-btn"
                        type="button"
                        onClick={() => {
                          if (item.isCustom) {
                            void handleRemove(item.customIndex);
                            return;
                          }
                          void handleRemoveControlled(item);
                        }}
                        title={t('builder.actions.removeArg')}
                        aria-label={t('builder.actions.removeArg')}
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                ))
              )}
              {isAdding && (
                <div className="qemu-args-list__row qemu-args-list__row--last" role="listitem">
                  <textarea
                    ref={addTextareaRef}
                    className="qemu-args-list__textarea"
                    rows={1}
                    value={editValue}
                    aria-label={t('builder.actions.addArg')}
                    placeholder={t('builder.descriptions.advanced')}
                    onChange={(event) => setEditValue(event.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={() => void handleCommitAdd()}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {error && <div className="qemu-args-list__error">{error}</div>}
    </div>
  );
}
