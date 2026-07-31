import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { StatusChip } from '../components/Field';
import { useT } from '../hooks/useT';
import { checkMachinePaths, makeWorkspaceMachineItems, resolveWorkspaceSelection } from '../lib/machine';
import { machineRoute } from '../lib/routes';
import { useAppStore } from '../store/AppStore';
import type { WorkspaceMachineItem } from '../domain/schemas';
import { MachineDetailsPage } from './MachineDetailsPage';

function statusLabel(
  status: string | undefined,
  t: ReturnType<typeof useT>
): string {
  switch (status) {
    case 'starting':
      return t('common.states.starting');
    case 'running':
      return t('common.states.running');
    case 'stopping':
      return t('common.states.stopping');
    case 'stopped':
      return t('common.states.stopped');
    default:
      return t('common.notStarted');
  }
}

function statusTone(status: string | undefined): 'success' | undefined {
  if (status === 'running') return 'success';
  if (status === 'starting' || status === 'stopping') return undefined;
  return undefined;
}

// 虚拟机卡片组件
interface MachineCardProps {
  item: WorkspaceMachineItem;
  onClick: () => void;
  status?: string;
  isRunning?: boolean;
}

function MachineCard({ item, onClick, status, isRunning }: MachineCardProps) {
  const t = useT();
  const { getRuntimeStateForMachine } = useAppStore();
  const runtimeState = getRuntimeStateForMachine(item.id);
  const machineStatus = runtimeState?.status;
  const running = machineStatus === 'running' || machineStatus === 'starting';

  return (
    <button
      className={`machine-list-card ${item.missing ? 'machine-list-card--missing' : ''}`}
      type="button"
      onClick={onClick}
      disabled={item.missing}
    >
      <div className="machine-list-card__icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 12l10 5 10-5" opacity="0.75" />
          <path d="M2 17l10 5 10-5" opacity="0.5" />
        </svg>
      </div>
      <div className="machine-list-card__content">
        <div className="machine-list-card__title">{item.title}</div>
        <div className="machine-list-card__subtitle">
          {item.templateLabel ?? t('common.machine')}
          {item.author && <span className="machine-list-card__author"> · {item.author}</span>}
        </div>
      </div>
      <div className="machine-list-card__status">
        <StatusChip tone={statusTone(machineStatus)}>
          {statusLabel(machineStatus, t)}
        </StatusChip>
      </div>
      {running && <div className="machine-list-card__indicator" />}
    </button>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    draft,
    recents,
    openSakaDialog,
    openSakaByPath,
    createDraftFromDisk,
    getRuntimeStateForMachine,
    deleteMachine
  } = useAppStore();
  const t = useT();
  const baseItems = useMemo(
    () => makeWorkspaceMachineItems(recents, draft),
    [draft, recents]
  );
  const [checkedItems, setCheckedItems] = useState<WorkspaceMachineItem[]>([]);
  const [pathsChecked, setPathsChecked] = useState(false);
  const [openingPath, setOpeningPath] = useState<string | null>(null);
  const [failedPath, setFailedPath] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPathsChecked(false);
    void (async () => {
      const result = await checkMachinePaths(baseItems);
      if (!cancelled) {
        setCheckedItems(result);
        setPathsChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, [baseItems]);

  const workspace = useMemo(
    () => resolveWorkspaceSelection(checkedItems, location.pathname, location.search, draft),
    [checkedItems, location.pathname, location.search, draft]
  );

  const primaryMachine = workspace.primary;

  useEffect(() => {
    const targetPath = primaryMachine?.path;
    if (!pathsChecked || !targetPath || primaryMachine.missing || draft?.filePath === targetPath || failedPath === targetPath || openingPath === targetPath) {
      return undefined;
    }

    setOpeningPath(targetPath);
    void openSakaByPath(targetPath).then((result) => {
      setOpeningPath((current) => (current === targetPath ? null : current));
      setFailedPath(result ? null : targetPath);
    });
    return undefined;
  }, [draft?.filePath, failedPath, openSakaByPath, openingPath, pathsChecked, primaryMachine]);

  useEffect(() => {
    if (failedPath && primaryMachine?.path !== failedPath) setFailedPath(null);
  }, [failedPath, primaryMachine?.path]);

  const handleOpenConfig = async () => {
    const result = await openSakaDialog();
    if (!result) return;
    navigate(result.kind === 'machine' ? machineRoute(result.machineId, result.path) : '/machines/new');
  };

  const handleImportDisk = async () => {
    const result = await createDraftFromDisk();
    if (!result) return;
    navigate('/machines/new');
  };

  const handleMachineClick = (item: WorkspaceMachineItem) => {
    if (item.missing) return;
    navigate(item.path ? machineRoute(item.id, item.path) : '/');
  };

  const handleDeleteMissing = async () => {
    if (!primaryMachine?.path) return;
    await deleteMachine(primaryMachine.path);
    navigate('/');
  };

  // 小屏幕：显示虚拟机列表
  const renderMachineList = () => (
    <div className="machine-list">
      <div className="machine-list__header">
        <h1 className="machine-list__title">{t('home.recentMachines')}</h1>
        <span className="machine-list__count">{workspace.items.length}</span>
      </div>
      {workspace.items.length === 0 ? (
        <div className="machine-list__empty">
          <div className="home-empty-state__content">
            <strong>{t('home.emptyTitle')}</strong>
            <p>{t('home.emptyDescription')}</p>
            <div className="home-empty-state__actions">
              <button className="button button--primary" type="button" onClick={() => navigate('/machines/new')}>
                {t('app.create')}
              </button>
              <button className="button button--secondary" type="button" onClick={handleOpenConfig}>
                {t('app.openTemplate')}
              </button>
            </div>
            <button className="button button--ghost button--inline" type="button" onClick={handleImportDisk}>
              {t('app.importDisk')}
            </button>
          </div>
        </div>
      ) : (
        <div className="machine-list__grid">
          {workspace.items.map((item) => (
            <MachineCard
              key={`${item.id}:${item.path ?? item.source}`}
              item={item}
              onClick={() => handleMachineClick(item)}
            />
          ))}
        </div>
      )}
    </div>
  );

  const renderDesktopLayout = () => {
    if (primaryMachine && draft?.filePath === primaryMachine.path) {
      return <MachineDetailsPage />;
    }

    if (!pathsChecked) {
      return <div className="page-loading">{t('common.loading')}</div>;
    }

    if (!primaryMachine) {
      return (
        <div className="page page--home">
          <section className="home-empty-state" aria-label={t('home.emptyTitle')}>
            <div className="home-empty-state__content">
              <strong>{t('home.emptyTitle')}</strong>
              <p>{t('home.emptyDescription')}</p>
              <div className="home-empty-state__actions">
                <button className="button button--primary" type="button" onClick={() => navigate('/machines/new')}>
                  {t('app.create')}
                </button>
                <button className="button button--secondary" type="button" onClick={handleOpenConfig}>
                  {t('app.openTemplate')}
                </button>
              </div>
              <button className="button button--ghost button--inline" type="button" onClick={handleImportDisk}>
                {t('app.importDisk')}
              </button>
            </div>
          </section>
        </div>
      );
    }

    if (primaryMachine.missing || failedPath === primaryMachine.path) {
      return (
        <div className="page page--home">
          <div className="machine-missing-state">
            <div className="machine-missing-state__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <p className="machine-missing-state__text">{t('home.machineMissing')}</p>
            <button className="button button--danger" type="button" onClick={handleDeleteMissing}>
              {t('home.machineMissingDelete')}
            </button>
          </div>
        </div>
      );
    }

    return <div className="page-loading">{t('common.loading')}</div>;
  };

  return (
    <>
      {/* 小屏幕：显示虚拟机列表 */}
      <div className="mobile-machine-list">
        {renderMachineList()}
      </div>
      <div className="desktop-layout">
        {renderDesktopLayout()}
      </div>
    </>
  );
}
