import { useNavigate } from 'react-router-dom';
import { WebFileBrowser } from '../components/WebFileBrowser';
import { useAppStore } from '../store/AppStore';
import { useT } from '../hooks/useT';

const BackIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg>
);

export function MachineFilesPage() {
  const navigate = useNavigate();
  const { draft } = useAppStore();
  const t = useT();
  const machineRef = draft?.filePath || '';

  return (
    <div className="page machine-files-page">
      <header className="machine-files-page__header">
        <button className="icon-button machine-files-page__back" type="button" title={t('app.back')} onClick={() => navigate(-1)}>
          <BackIcon />
        </button>
        <div>
          <span className="machine-files-page__eyebrow">{draft?.machine.title}</span>
          <h1>{t('webFiles.title')}</h1>
          <p>{t('webFiles.subtitle')}</p>
        </div>
      </header>
      {machineRef ? <WebFileBrowser machineRef={machineRef} /> : <div className="empty-inline">{t('webFiles.loadFailed')}</div>}
    </div>
  );
}
