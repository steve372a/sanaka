import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppWeb } from './AppWeb';
import { AppStoreProvider } from './store/AppStore';
import './styles/app.css';
import './styles/settings-qemu.css';
import './styles/toast.css';
import './styles/console-mobile.css';
import './styles/update-download.css';
import './styles/builder-floating-save.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppStoreProvider>
      <AppWeb />
    </AppStoreProvider>
  </React.StrictMode>
);
