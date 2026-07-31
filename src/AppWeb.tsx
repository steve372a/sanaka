import { useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AboutDialog } from './components/AboutDialog';
import { AboutPage } from './components/AboutPage';
import { AppHeaderWeb } from './components/AppHeaderWeb';
import { MobileBottomNav } from './components/MobileBottomNav';
import { UpdateReminder } from './components/UpdateReminder';
import { FullscreenTransition } from './components/FullscreenTransition';
import { Toast } from './components/Toast';
import { usePresence } from './hooks/usePresence';
import { getElementTransitionOrigin } from './lib/fullscreenTransition';
import { machineRoute } from './lib/routes';
import { HomePage } from './pages/HomePage';
import { MachineBuilderPage } from './pages/MachineBuilderPage';
import { MachineConsolePage } from './pages/MachineConsolePage';
import { MachineDetailsPage } from './pages/MachineDetailsPage';
import { SettingsPage } from './pages/SettingsPage';
import { VncViewerPage } from './pages/VncViewerPage';
import { MachineFilesPage } from './pages/MachineFilesPage';
import { useAppStore } from './store/AppStore';
import { useT } from './hooks/useT';
import { useAccentColor } from './hooks/useAccentColor';
import { WEB_RESTRICTION_EVENT } from './lib/webMode';
import { WelcomeDialog } from './components/WelcomeDialog';
import { claimWelcomeForSession } from './lib/welcomeSession';

const TrashIcon = ({ style }: { style?: React.CSSProperties }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

const AlertIcon = ({ style }: { style?: React.CSSProperties }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

function ConsoleLayout() {
  return (
    <div className="app-shell app-shell--console">
      <div className="app-shell__window">
        <div className="app-dragbar app-dragbar--full" aria-hidden="true" />
        <main className="app-shell__content app-shell__content--console">
          <MachineConsolePage />
        </main>
      </div>
    </div>
  );
}

function VncViewerLayout() {
  return (
    <div className="app-shell app-shell--console">
      <div className="app-shell__window">
        <div className="app-dragbar app-dragbar--full" aria-hidden="true" />
        <main className="app-shell__content app-shell__content--console">
          <Routes>
            <Route path="/viewer/vnc/:sessionId" element={<VncViewerPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function MainLayout() {
  const navigate = useNavigate();
  const {
    ready,
    settings,
    persistSettings,
    aboutOpen,
    setAboutOpen,
    deleteTarget,
    setDeleteTarget,
    deleteMachine,
    triggerTransition,
    updateReminder,
    dismissUpdateReminder,
    skipUpdateVersion,
    openUpdatePage,
    startError,
    setStartError
  } = useAppStore();
  const t = useT();
  useAccentColor();
  const deleteModal = usePresence(Boolean(deleteTarget));
  const startErrorModal = usePresence(Boolean(startError));
  const activeStartError = startError;
  const [aboutPageOpen, setAboutPageOpen] = useState(false);
  const [logoClickPosition, setLogoClickPosition] = useState({ x: 0, y: 0 });
  const [restrictionMessage, setRestrictionMessage] = useState('');
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  useEffect(() => {
    if (!ready || !claimWelcomeForSession()) return;
    if (settings.showWelcomeOnStartup) setWelcomeOpen(true);
  }, [ready, settings.showWelcomeOnStartup]);

  const handleNeverRemind = async () => {
    setWelcomeOpen(false);
    await persistSettings({ ...settings, showWelcomeOnStartup: false });
  };

  useEffect(() => {
    const handleRestriction = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      setRestrictionMessage(detail?.message || '网页版不能修改此项目。');
    };
    window.addEventListener(WEB_RESTRICTION_EVENT, handleRestriction);
    return () => window.removeEventListener(WEB_RESTRICTION_EVENT, handleRestriction);
  }, []);

  const handleConfirmDelete = async (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!deleteTarget) return;
    const path = deleteTarget.path;
    const origin = getElementTransitionOrigin(event.currentTarget);
    setDeleteTarget(null);
    triggerTransition('delete', async () => {
      await deleteMachine(path);
      navigate('/');
    }, origin);
  };

  const handleLogoClick = (position: { x: number; y: number }) => {
    setLogoClickPosition(position);
    setAboutPageOpen(true);
  };

  if (!ready) {
    return <div className="page-loading">{t('common.loading')}</div>;
  }

  return (
    <>
      <div className="app-shell app-shell--web">
        <div className="app-shell__window">
          <div className="app-dragbar app-dragbar--sidebar" aria-hidden="true" />
          <div className="app-shell__surface">
            <AppHeaderWeb onLogoClick={handleLogoClick} />
            <main className="app-shell__content">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/machines/new" element={<MachineBuilderPage />} />
                <Route path="/machines/:machineId" element={<MachineDetailsPage />} />
                <Route path="/machines/:machineId/files" element={<MachineFilesPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </div>
      </div>
      {/* 移动端底部导航栏 */}
      <MobileBottomNav />
      <AboutPage isOpen={aboutPageOpen} onClose={() => setAboutPageOpen(false)} clickPosition={logoClickPosition} />
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <WelcomeDialog open={welcomeOpen} onClose={() => setWelcomeOpen(false)} onNeverRemind={() => void handleNeverRemind()} />
      <Toast
        message={restrictionMessage}
        visible={Boolean(restrictionMessage)}
        onClose={() => setRestrictionMessage('')}
      />
      <UpdateReminder
        reminder={updateReminder}
        onDismiss={dismissUpdateReminder}
        onSkip={skipUpdateVersion}
        onOpenPage={openUpdatePage}
      />
      {deleteModal.mounted && (
        <div className={deleteModal.visible ? 'modal-backdrop modal-backdrop--visible' : 'modal-backdrop'} role="presentation" onClick={() => setDeleteTarget(null)}>
          <div className={deleteModal.visible ? 'modal-card modal-card--visible' : 'modal-card'} role="dialog" aria-modal="true" aria-labelledby="delete-confirm-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="delete-confirm-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--danger)', margin: '0 0 10px 0', fontSize: '1.25rem' }}>
              <TrashIcon style={{ width: '24px', height: '24px' }} />
              {t('details.deleteTitle')}
            </h2>
            <p className="muted" style={{ margin: '0 0 24px 0', fontSize: '0.88rem', lineHeight: '1.5' }}>
              {t('details.deleteConfirm')}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="button button--secondary" type="button" onClick={() => setDeleteTarget(null)}>
                {t('app.cancel')}
              </button>
              <button className="button button--danger" type="button" onClick={(event) => void handleConfirmDelete(event)}>
                {t('details.deleteMachine')}
              </button>
            </div>
          </div>
        </div>
      )}

      {startErrorModal.mounted && (
        <div className={startErrorModal.visible ? 'modal-backdrop modal-backdrop--visible' : 'modal-backdrop'} role="presentation" onClick={() => setStartError(null)}>
          <div className={startErrorModal.visible ? 'modal-card modal-card--visible' : 'modal-card'} role="dialog" aria-modal="true" aria-labelledby="start-error-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="start-error-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--danger)', margin: '0 0 10px 0', fontSize: '1.25rem' }}>
              <AlertIcon style={{ width: '24px', height: '24px' }} />
              {activeStartError?.title}
            </h2>
            <p className="muted" style={{ margin: '0 0 24px 0', fontSize: '0.88rem', lineHeight: '1.5' }}>
              {activeStartError?.description}
            </p>
            {activeStartError?.detail && (
              <div className="runtime-detail-card">
                <div className="runtime-detail-card__label">
                  QEMU / Runtime
                </div>
                <div className="runtime-detail-card__body">
                  {activeStartError.detail}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="button button--secondary" type="button" onClick={() => setStartError(null)}>
                {t('app.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function RoutedShellWeb() {
  const location = useLocation();
  const isConsole = location.pathname.endsWith('/console');
  const isViewer = location.pathname.startsWith('/viewer/');
  const { transition } = useAppStore();

  return (
    <>
      {isConsole ? <ConsoleLayout /> : isViewer ? <VncViewerLayout /> : <MainLayout />}
      {transition.active ? (
        <FullscreenTransition type={transition.type} origin={transition.origin} phase={transition.phase} />
      ) : null}
    </>
  );
}

export function AppWeb() {
  return (
    <HashRouter>
      <RoutedShellWeb />
    </HashRouter>
  );
}
