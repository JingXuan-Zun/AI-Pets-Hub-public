import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { installRendererRuntimeLogging } from './frontendRuntimeLogger';
import { installRendererEventLoopDiagnostics } from './rendererEventLoopDiagnostics';
import { initializeControlCenterUsageTracking } from './controlCenterUsage';
import './index.css';

const rootElement = document.getElementById('root');
const panelMode = typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search).get('panel')
  : null;
const isDesktopShell = typeof window !== 'undefined'
  && Boolean(window.desktopPetShell?.desktopMode);
const isTransparentShell = isDesktopShell && (
  panelMode === null
  || panelMode === ''
  || panelMode === 'area-picker'
  || panelMode === 'settings'
  || panelMode === 'chat'
);

if (isTransparentShell && typeof document !== 'undefined') {
  document.documentElement.style.background = 'transparent';
  document.body.classList.add('desktop-shell');
  document.body.style.background = 'transparent';

  if (rootElement) {
    rootElement.style.background = 'transparent';
  }
}

function renderFatalError(error: unknown) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  if (!rootElement) {
    return;
  }

  rootElement.innerHTML = `
    <div style="min-height:100vh;background:#FBF5FA;color:#3A2A45;padding:24px;font-family:ui-monospace,Consolas,monospace;">
      <div style="max-width:960px;margin:0 auto;border:1px solid #EEDDEA;background:#FFFFFF;padding:20px;border-radius:16px;box-shadow:0 4px 12px rgba(158,84,140,0.08);">
        <div style="color:#D4518E;font-size:12px;letter-spacing:.2em;text-transform:uppercase;">Render Error</div>
        <h1 style="margin:12px 0 16px;font-size:24px;font-family:system-ui,sans-serif;color:#3A2A45;">页面没有正常挂载</h1>
        <pre style="white-space:pre-wrap;word-break:break-word;margin:0;padding:16px;background:#F7F0F6;border-radius:12px;border:1px solid #EEDDEA;color:#7A6585;">${message}</pre>
      </div>
    </div>
  `;
}

function renderLoadingShell() {
  if (!rootElement) {
    return;
  }

  if (isTransparentShell) {
    rootElement.innerHTML = '<div style="min-height:100vh;background:transparent;"></div>';
    return;
  }

  rootElement.innerHTML = `
    <div style="min-height:100vh;background:#FBF5FA;color:#3A2A45;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;">
      <div style="display:flex;align-items:center;gap:12px;padding:18px 22px;border:1px solid #EEDDEA;background:#FFFFFF;border-radius:16px;box-shadow:0 4px 12px rgba(158,84,140,0.08);">
        <div style="width:10px;height:10px;border-radius:9999px;background:#D4518E;box-shadow:0 0 12px rgba(212,81,142,0.40);"></div>
        <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#7A6585;">正在加载面板</div>
      </div>
    </div>
  `;
}

function loadAppModule() {
  switch (panelMode) {
    case 'settings':
      return import('./SettingsWindowApp.tsx');
    case 'chat':
      return import('./ChatWindowApp.tsx');
    case 'area-picker':
      return import('./DesktopAreaPickerApp.tsx');
    default:
      return import('./App.tsx');
  }
}

if (panelMode) {
  renderLoadingShell();
}

installRendererRuntimeLogging();
installRendererEventLoopDiagnostics();
initializeControlCenterUsageTracking();

loadAppModule()
  .then(({ default: App }) => {
    if (!rootElement) {
      throw new Error('Root element "#root" was not found.');
    }

    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  })
  .catch((error) => {
    console.error('Failed to render app:', error);
    renderFatalError(error);
  });
