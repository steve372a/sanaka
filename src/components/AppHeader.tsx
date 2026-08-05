import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sortable from 'sortablejs';
import { machineRoute } from '../lib/routes';
import { makeWorkspaceMachineItems, resolveWorkspaceSelection } from '../lib/machine';
import { parseSakaContent } from '../lib/saka';
import { useAppStore } from '../store/AppStore';
import { isSameMachinePath } from '../lib/machinePath';
import { usePresence } from '../hooks/usePresence';
import { useListReorderAnimation } from '../hooks/useListReorderAnimation';
import { useT } from '../hooks/useT';
import { ExportMachineDialog } from './ExportMachineDialog';
import { ConnectVncDialog } from './ConnectVncDialog';
import type { ExternalVncSession, WebModeState } from '../types/electron';
import logoUrl from '../../assets/icons/fish.png';

const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);

const MoreIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <path d="M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill="currentColor" />
    <path d="M19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill="currentColor" />
    <path d="M5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill="currentColor" />
  </svg>
);

interface SidebarIconProps {
  name: 'plus' | 'machine' | 'home' | 'settings' | 'about';
}

function SidebarIcon({ name }: SidebarIconProps) {
  if (name === 'plus') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    );
  }

  if (name === 'machine') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 12l10 5 10-5" opacity="0.75" />
        <path d="M2 17l10 5 10-5" opacity="0.5" />
      </svg>
    );
  }

  if (name === 'home') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    );
  }

  if (name === 'settings') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

interface AppHeaderProps {
  onLogoClick?: (position: { x: number; y: number }) => void;
}

export function AppHeader({ onLogoClick }: AppHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    draft,
    recents,
    settings,
    setTheme,
    openAboutDialog,
    openSakaByPath,
    renameMachine,
    duplicateMachine,
    reorderRecents,
    setDeleteTarget,
    setStartError,
    highlightedMachinePath
  } = useAppStore();
  const t = useT();
  const logoRef = useRef<HTMLButtonElement>(null);
  const isBuilder = location.pathname === '/machines/new';
  const isSettings = location.pathname === '/settings';
  const workspace = resolveWorkspaceSelection(makeWorkspaceMachineItems(recents, draft), location.pathname, location.search, draft);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: typeof workspace.items[0] } | null>(null);
  const [renameTarget, setRenameTarget] = useState<typeof workspace.items[0] | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [exportMachine, setExportMachine] = useState<{
    id: string;
    title: string;
    author?: string;
    path?: string;
    disks?: Array<{ id: string; name: string; path: string }>;
  } | null>(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [connectVncOpen, setConnectVncOpen] = useState(false);
  const [openingWebMode, setOpeningWebMode] = useState(false);
  const [stoppingWebMode, setStoppingWebMode] = useState(false);
  const [copyingWebModeUrl, setCopyingWebModeUrl] = useState(false);
  const [webModeCopied, setWebModeCopied] = useState(false);
  const [webModeState, setWebModeState] = useState<WebModeState | null>(null);
  const [showWebModeInfo, setShowWebModeInfo] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const machineListRef = useRef<HTMLDivElement>(null);
  const sortableRef = useRef<Sortable | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const renameModal = usePresence(Boolean(renameTarget));
  useListReorderAnimation(
    machineListRef,
    workspace.items.map((item) => item.path ?? item.id),
    isDragging
  );

  useEffect(() => {
    let cancelled = false;

    void window.electronAPI.app.getWebModeState().then((state) => {
      if (!cancelled) {
        setWebModeState(state);
      }
    }).catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!moreMenuOpen) {
      return () => undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!moreMenuRef.current?.contains(event.target as Node)) {
        setMoreMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMoreMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [moreMenuOpen]);

  // Initialize Sortable for drag-and-drop
  useEffect(() => {
    if (!machineListRef.current || workspace.items.length === 0) {
      return () => undefined;
    }

    sortableRef.current = Sortable.create(machineListRef.current, {
      animation: settings.reduceMotion ? 0 : 200,
      delay: 500,
      delayOnTouchOnly: true,
      touchStartThreshold: 5,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      onStart: () => {
        setIsDragging(true);
      },
      onEnd: (evt) => {
        setIsDragging(false);
        if (evt.oldIndex !== evt.newIndex) {
          const newOrder = sortableRef.current?.toArray() ?? [];
          void reorderRecents(newOrder.filter(Boolean) as string[]);
        }
      }
    });

    return () => {
      sortableRef.current?.destroy();
      sortableRef.current = null;
    };
  }, [workspace.items.length, recents, settings.reduceMotion]);

  const navClass = (active: boolean, flash: boolean) => {
    const classNames = ['workspace-sidebar__item'];
    if (active) {
      classNames.push('workspace-sidebar__item--active');
    }
    if (flash) {
      classNames.push('workspace-sidebar__item--flash');
    }
    return classNames.join(' ');
  };
  const utilityClass = (active: boolean) => (active ? 'workspace-sidebar__utility workspace-sidebar__utility--active' : 'workspace-sidebar__utility');

  const handleContextMenu = (e: React.MouseEvent, item: typeof workspace.items[0]) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      item
    });
  };

  const handleInfo = (item: typeof workspace.items[0]) => {
    setContextMenu(null);
    navigate(item.path ? machineRoute(item.id, item.path) : '/');
  };

  const handleRenameClick = (item: typeof workspace.items[0]) => {
    setContextMenu(null);
    setRenameTarget(item);
    setRenameValue(item.title);
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget || !renameTarget.path || !renameValue.trim()) return;
    const success = await renameMachine(renameTarget.path, renameValue.trim());
    if (success) {
      setRenameTarget(null);
    }
  };

  const handleOpenFolder = async (item: typeof workspace.items[0]) => {
    setContextMenu(null);
    if (item.path) {
      await window.electronAPI.files.openPath(item.path);
    }
  };

  const handleDuplicate = async (item: typeof workspace.items[0]) => {
    setContextMenu(null);
    if (item.path) {
      await duplicateMachine(item.path);
    }
  };

  const handleExport = async (item: typeof workspace.items[0]) => {
    setContextMenu(null);
    if (!item.path) {
      return;
    }

    if (draft && isSameMachinePath(draft.filePath, item.path)) {
      setExportMachine({
        id: item.id,
        title: draft.machine.title,
        author: draft.machine.author,
        path: item.path,
        disks: draft.machine.disks.map((disk) => ({
          id: disk.id,
          name: disk.path.split(/[/\\]/).pop() || disk.id,
          path: disk.path
        }))
      });
      return;
    }

    try {
      const opened = await window.electronAPI.files.readSaka(item.path);
      if (!opened) {
        setExportMachine({
          id: item.id,
          title: item.title,
          author: item.author,
          path: item.path
        });
        return;
      }

      const parsed = parseSakaContent(opened.content);
      if (parsed.kind !== 'machine') {
        setExportMachine({
          id: item.id,
          title: item.title,
          author: item.author,
          path: item.path
        });
        return;
      }

      setExportMachine({
        id: parsed.id,
        title: parsed.title,
        author: parsed.author || undefined,
        path: item.path,
        disks: parsed.disks.map((disk) => ({
          id: disk.id,
          name: disk.path.split(/[/\\]/).pop() || disk.id,
          path: disk.path
        }))
      });
    } catch {
      setExportMachine({
        id: item.id,
        title: item.title,
        author: item.author,
        path: item.path
      });
    }
  };

  const handleDeleteClick = (item: typeof workspace.items[0]) => {
    setContextMenu(null);
    if (item.path) {
      setDeleteTarget({ path: item.path, title: item.title });
    }
  };

  const handleLogoClick = (e: React.MouseEvent) => {
    if (onLogoClick && logoRef.current) {
      const rect = logoRef.current.getBoundingClientRect();
      onLogoClick({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      });
    } else {
      navigate('/');
    }
  };

  const handleOpenWebMode = async () => {
    setMoreMenuOpen(false);
    if (openingWebMode) {
      return;
    }

    setOpeningWebMode(true);
    try {
      const state = await window.electronAPI.app.openWebMode();
      setWebModeState(state);
    } catch (error) {
      const detail = error instanceof Error ? error.message.trim() : String(error || '').trim();
      setStartError({
        title: t('app.webModeErrorTitle'),
        description: t('app.webModeErrorDescription'),
        detail: detail || undefined
      });
    } finally {
      setOpeningWebMode(false);
    }
  };

  const handleOpenConnectVnc = () => {
    setMoreMenuOpen(false);
    setConnectVncOpen(true);
  };

  const handleVncConnected = (session: ExternalVncSession) => {
    setConnectVncOpen(false);
    navigate(`/viewer/vnc/${encodeURIComponent(session.id)}`);
  };

  const handleOpenWebModeInBrowser = async () => {
    if (!webModeState?.url) {
      return;
    }

    try {
      await window.electronAPI.app.openExternal(webModeState.url);
    } catch (error) {
      const detail = error instanceof Error ? error.message.trim() : String(error || '').trim();
      setStartError({
        title: t('app.webModeOpenBrowserErrorTitle'),
        description: t('app.webModeOpenBrowserErrorDescription'),
        detail: detail || undefined
      });
    }
  };

  const handleCopyWebModeUrl = async () => {
    if (!webModeState?.url || copyingWebModeUrl) {
      return;
    }

    setCopyingWebModeUrl(true);
    try {
      await navigator.clipboard.writeText(webModeState.url);
      setWebModeCopied(true);
      window.setTimeout(() => {
        setWebModeCopied(false);
      }, 2000);
      setMoreMenuOpen(false);
    } catch (error) {
      const detail = error instanceof Error ? error.message.trim() : String(error || '').trim();
      setStartError({
        title: t('app.webModeCopyErrorTitle'),
        description: t('app.webModeCopyErrorDescription'),
        detail: detail || undefined
      });
    } finally {
      setCopyingWebModeUrl(false);
    }
  };

  const handleOpenWebModeInfo = async () => {
    try {
      const state = await window.electronAPI.app.getWebModeState();
      setWebModeState(state);
      setShowWebModeInfo(true);
      setMoreMenuOpen(false);
    } catch (error) {
      const detail = error instanceof Error ? error.message.trim() : String(error || '').trim();
      setStartError({
        title: t('app.webModeStatusErrorTitle'),
        description: t('app.webModeStatusErrorDescription'),
        detail: detail || undefined
      });
    }
  };

  const handleStopWebMode = async () => {
    if (stoppingWebMode) {
      return;
    }

    setStoppingWebMode(true);
    try {
      await window.electronAPI.app.stopWebMode();
      const state = await window.electronAPI.app.getWebModeState();
      setWebModeState(state);
      setShowWebModeInfo(false);
      setMoreMenuOpen(false);
    } catch (error) {
      const detail = error instanceof Error ? error.message.trim() : String(error || '').trim();
      setStartError({
        title: t('app.webModeStopErrorTitle'),
        description: t('app.webModeStopErrorDescription'),
        detail: detail || undefined
      });
    } finally {
      setStoppingWebMode(false);
    }
  };

  const webModeActive = Boolean(webModeState?.active && webModeState?.url);

  return (
    <>
      <aside className="app-sidebar">
        <button
          ref={logoRef}
          className="workspace-brand"
          type="button"
          aria-label="Sanaka"
          title="Sanaka"
          onClick={handleLogoClick}
        >
          <img className="workspace-brand__logo" src={logoUrl} alt="" />
          <span className="workspace-brand__text">
            <strong>Sanaka</strong>
            <small>{t('app.tagline')}</small>
          </span>
        </button>

        <div className="workspace-sidebar__section">
          <button
            className={isBuilder ? 'workspace-sidebar__create workspace-sidebar__create--active' : 'workspace-sidebar__create'}
            type="button"
            aria-label={t('home.sidebarCreate')}
            title={t('home.sidebarCreate')}
            onClick={() => navigate(`/machines/new?template=win11&fresh=${Date.now()}`)}
          >
            <span className="workspace-sidebar__icon">
              <SidebarIcon name="plus" />
            </span>
            <span className="workspace-sidebar__text">{t('home.sidebarCreate')}</span>
          </button>
        </div>

        <div className="workspace-sidebar__section workspace-sidebar__section--machines">
          <div className="workspace-sidebar__label">{t('home.recentMachines')}</div>
          <nav ref={machineListRef} className="workspace-sidebar__list" aria-label={t('home.recentMachines')}>
            {workspace.items.length === 0 ? (
              <div className="workspace-sidebar__empty">{t('home.sidebarEmpty')}</div>
            ) : (
              workspace.items.map((item) => (
                <button
                  key={`${item.id}:${item.path ?? item.source}`}
                  data-id={item.path ?? item.id}
                  data-list-motion-key={item.path ?? item.id}
                  className={navClass(
                    workspace.primary?.id === item.id && workspace.primary?.path === item.path,
                    Boolean(item.path && item.path === highlightedMachinePath)
                  ) + (item.missing ? ' workspace-sidebar__item--missing' : '') + (isDragging ? ' workspace-sidebar__item--dragging' : '')}
                  type="button"
                  aria-label={item.title}
                  title={item.missing ? t('home.machineMissing') : item.title}
                  disabled={item.missing}
                  onClick={() => {
                    if (!item.missing && !isDragging) {
                      if (item.path) {
                        void openSakaByPath(item.path, { refreshRecents: false }).then((result) => {
                          if (result) {
                            navigate(machineRoute(result.machineId, result.path));
                          }
                        });
                        return;
                      }
                      navigate(item.source === 'draft' ? '/machines/new' : '/');
                    }
                  }}
                  onContextMenu={(e) => !item.missing && handleContextMenu(e, item)}
                >
                  <span className={`workspace-sidebar__icon workspace-sidebar__icon--machine${item.missing ? ' workspace-sidebar__icon--missing' : ''}`}>
                    <SidebarIcon name="machine" />
                  </span>
                  <span className={`workspace-sidebar__item-copy${item.missing ? ' workspace-sidebar__item-copy--missing' : ''}`}>
                    <strong>{item.title}</strong>
                    <small>{item.templateLabel ?? t('common.machine')}</small>
                    {item.author && (
                      <small style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                        作者：{item.author}
                      </small>
                    )}
                  </span>
                  <span className={item.dirty ? 'workspace-sidebar__item-state workspace-sidebar__item-state--dirty' : 'workspace-sidebar__item-state'}>
                    {item.dirty ? t('common.dirtyShort') : item.missing ? t('home.machineMissing') : t('home.cardStatusSaved')}
                  </span>
                </button>
              ))
            )}
          </nav>
        </div>

        <div className="workspace-sidebar__spacer" />

        <div className="workspace-sidebar__section workspace-sidebar__section--footer">
          <div className="sidebar-footer-tools" ref={moreMenuRef}>
            <div className="sidebar-theme-toggle">
              <button
                className={settings.theme === 'light' ? 'sidebar-theme-toggle__btn sidebar-theme-toggle__btn--active' : 'sidebar-theme-toggle__btn'}
                type="button"
                aria-label={t('settings.light')}
                title={t('settings.light')}
                onClick={() => void setTheme('light')}
              >
                <SunIcon />
              </button>
              <button
                className={settings.theme === 'dark' ? 'sidebar-theme-toggle__btn sidebar-theme-toggle__btn--active' : 'sidebar-theme-toggle__btn'}
                type="button"
                aria-label={t('settings.dark')}
                title={t('settings.dark')}
                onClick={() => void setTheme('dark')}
              >
                <MoonIcon />
              </button>
              <div className="sidebar-theme-divider" aria-hidden="true" />
              <button
                className="sidebar-theme-toggle__btn"
                type="button"
                aria-label={t('app.more')}
                title={t('app.more')}
                aria-haspopup="true"
                aria-expanded={moreMenuOpen}
                onClick={() => setMoreMenuOpen((v) => !v)}
              >
                <MoreIcon />
              </button>
            </div>
            {moreMenuOpen && (
              <div className="sidebar-more-menu__dropdown" role="menu">
                <button
                  className="sidebar-more-menu__item"
                  type="button"
                  role="menuitem"
                  disabled={openingWebMode}
                  onClick={() => void handleOpenWebMode()}
                >
                  {openingWebMode ? t('app.openingWebMode') : t('app.openWebMode')}
                </button>
                <button
                  className="sidebar-more-menu__item"
                  type="button"
                  role="menuitem"
                  onClick={handleOpenConnectVnc}
                >
                  {t('app.connectVnc')}
                </button>
                <button
                  className="sidebar-more-menu__item"
                  type="button"
                  role="menuitem"
                  disabled={!webModeActive || copyingWebModeUrl}
                  onClick={() => void handleCopyWebModeUrl()}
                >
                  {webModeCopied ? t('app.webModeCopied') : t('app.copyWebModeUrl')}
                </button>
                <button
                  className="sidebar-more-menu__item"
                  type="button"
                  role="menuitem"
                  onClick={() => void handleOpenWebModeInfo()}
                >
                  {t('app.viewWebModeInfo')}
                </button>
                <button
                  className="sidebar-more-menu__item sidebar-more-menu__item--danger"
                  type="button"
                  role="menuitem"
                  disabled={!webModeActive || stoppingWebMode}
                  onClick={() => void handleStopWebMode()}
                >
                  {stoppingWebMode ? t('app.stoppingWebMode') : t('app.stopWebMode')}
                </button>
              </div>
            )}
          </div>
          <nav className="workspace-sidebar__utilities" aria-label="Application utilities">
            <button className={utilityClass(location.pathname === '/')} type="button" aria-label={t('home.sidebarHome')} title={t('home.sidebarHome')} onClick={() => navigate('/')}>
              <span className="workspace-sidebar__icon">
                <SidebarIcon name="home" />
              </span>
              <span className="workspace-sidebar__text">{t('home.sidebarHome')}</span>
            </button>
            <button className={utilityClass(isSettings)} type="button" aria-label={t('home.sidebarSettings')} title={t('home.sidebarSettings')} onClick={() => navigate('/settings')}>
              <span className="workspace-sidebar__icon">
                <SidebarIcon name="settings" />
              </span>
              <span className="workspace-sidebar__text">{t('home.sidebarSettings')}</span>
            </button>
            <button className="workspace-sidebar__utility" type="button" aria-label={t('home.sidebarAbout')} title={t('home.sidebarAbout')} onClick={openAboutDialog}>
              <span className="workspace-sidebar__icon">
                <SidebarIcon name="about" />
              </span>
              <span className="workspace-sidebar__text">{t('home.sidebarAbout')}</span>
            </button>
          </nav>
        </div>
      </aside>

      {showWebModeInfo && (
        <div className="modal-backdrop modal-backdrop--visible" role="presentation" onClick={() => setShowWebModeInfo(false)}>
          <div className="modal-card modal-card--visible web-mode-info-modal" role="dialog" aria-modal="true" aria-labelledby="web-mode-info-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="web-mode-info-title" style={{ margin: '0 0 10px 0', fontSize: '1.2rem' }}>
              {t('app.webModeInfoTitle')}
            </h2>
            <p className="muted" style={{ margin: '0 0 18px 0', fontSize: '0.9rem', lineHeight: '1.6' }}>
              {webModeActive ? t('app.webModeInfoRunning') : t('app.webModeInfoStopped')}
            </p>
            <div className="web-mode-info-grid">
              <div className="web-mode-info-row">
                <span className="web-mode-info-row__label">{t('app.webModeStatusLabel')}</span>
                <span className="web-mode-info-row__value">{webModeActive ? t('app.webModeStatusRunning') : t('app.webModeStatusStopped')}</span>
              </div>
              <div className="web-mode-info-row">
                <span className="web-mode-info-row__label">{t('app.webModeUrlLabel')}</span>
                <code className="web-mode-info-row__code">{webModeState?.url || t('app.webModeUnavailable')}</code>
              </div>
              {webModeState?.localUrl && (
                <div className="web-mode-info-row">
                  <span className="web-mode-info-row__label">Local URL</span>
                  <code className="web-mode-info-row__code">{webModeState.localUrl}</code>
                </div>
              )}
              {webModeState?.networkUrl && (
                <div className="web-mode-info-row">
                  <span className="web-mode-info-row__label">LAN URL</span>
                  <code className="web-mode-info-row__code">{webModeState.networkUrl}</code>
                </div>
              )}
              <div className="web-mode-info-row">
                <span className="web-mode-info-row__label">{t('app.webModeHostLabel')}</span>
                <code className="web-mode-info-row__code">{webModeState?.host || '127.0.0.1'}</code>
              </div>
              <div className="web-mode-info-row">
                <span className="web-mode-info-row__label">{t('app.webModePortLabel')}</span>
                <code className="web-mode-info-row__code">{webModeState?.port != null ? String(webModeState.port) : t('app.webModeUnavailable')}</code>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px' }}>
              <button
                className="button button--secondary"
                type="button"
                disabled={!webModeActive || copyingWebModeUrl}
                onClick={() => void handleCopyWebModeUrl()}
              >
                {webModeCopied ? t('app.webModeCopied') : t('app.copyWebModeUrl')}
              </button>
              <button
                className="button button--secondary"
                type="button"
                disabled={!webModeActive}
                onClick={() => void handleOpenWebModeInBrowser()}
              >
                {t('app.openWebModeInBrowser')}
              </button>
              <button className="button button--secondary" type="button" onClick={() => setShowWebModeInfo(false)}>
                {t('app.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {contextMenu && (
        <div
          className="context-menu-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'transparent'
          }}
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu(null);
          }}
        >
          <div
            className="context-menu"
            style={{
              position: 'fixed',
              left: `${contextMenu.x}px`,
              top: `${contextMenu.y}px`,
              zIndex: 100000
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="context-menu__item" type="button" onClick={() => handleInfo(contextMenu.item)}>
              <span className="context-menu__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </span>
              <span>{settings.language === 'zh-CN' ? '属性' : 'Properties'}</span>
            </button>
            {contextMenu.item.path && (
              <>
                <button className="context-menu__item" type="button" onClick={() => handleRenameClick(contextMenu.item)}>
                  <span className="context-menu__icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                  </span>
                  <span>{settings.language === 'zh-CN' ? '重命名' : 'Rename'}</span>
                </button>
                <button className="context-menu__item" type="button" onClick={() => handleOpenFolder(contextMenu.item)}>
                  <span className="context-menu__icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                  </span>
                  <span>{settings.language === 'zh-CN' ? '打开机器文件夹' : 'Open Folder'}</span>
                </button>
                <button className="context-menu__item" type="button" onClick={() => handleExport(contextMenu.item)}>
                  <span className="context-menu__icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </span>
                  <span>{settings.language === 'zh-CN' ? '导出虚拟机' : 'Export Machine'}</span>
                </button>
                <button className="context-menu__item" type="button" onClick={() => handleDuplicate(contextMenu.item)}>
                  <span className="context-menu__icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </span>
                  <span>{settings.language === 'zh-CN' ? '复制副本' : 'Duplicate'}</span>
                </button>
                <button className="context-menu__item context-menu__item--danger" type="button" onClick={() => handleDeleteClick(contextMenu.item)}>
                  <span className="context-menu__icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  </span>
                  <span>{settings.language === 'zh-CN' ? '删除' : 'Delete'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {renameModal.mounted && (
        <div className={renameModal.visible ? 'modal-backdrop modal-backdrop--visible' : 'modal-backdrop'} role="presentation" onClick={() => setRenameTarget(null)}>
          <div className={renameModal.visible ? 'modal-card modal-card--visible' : 'modal-card'} role="dialog" aria-modal="true" aria-labelledby="rename-modal-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="rename-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 10px 0', fontSize: '1.25rem' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '24px', height: '24px', color: 'var(--primary-strong)' }}>
                <path d="M11.5 15H18" />
                <path d="M16 4h4v4" />
                <path d="M20 4L12.5 11.5" />
                <path d="M7 8H4v12h12v-3" />
              </svg>
              {settings.language === 'zh-CN' ? '重命名虚拟机' : 'Rename Machine'}
            </h2>
            <form onSubmit={handleRenameSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <label className="field" htmlFor="rename-input" style={{ width: '100%' }}>
                <span className="field__label">{t('builder.labels.name')}</span>
                <input
                  id="rename-input"
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  autoFocus
                  required
                />
              </label>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button className="button button--secondary" type="button" onClick={() => setRenameTarget(null)}>
                  {t('app.cancel')}
                </button>
                <button className="button button--primary" type="submit">
                  {t('app.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {exportMachine && (
        <ExportMachineDialog
          open={Boolean(exportMachine)}
          onClose={() => setExportMachine(null)}
          machine={exportMachine}
        />
      )}

      <ConnectVncDialog
        open={connectVncOpen}
        onClose={() => setConnectVncOpen(false)}
        onConnected={handleVncConnected}
      />
    </>
  );
}
