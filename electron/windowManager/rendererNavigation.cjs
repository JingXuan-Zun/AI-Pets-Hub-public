const { buildRendererQuery } = require('./rendererQuery.cjs');

function createSettingsPanelUrlChecker({ isDev }) {
  function isSettingsWindowAtSettingsPanelUrl(win) {
    if (!win || win.isDestroyed()) {
      return false;
    }

    const currentUrl = win.webContents.getURL();
    if (!currentUrl) {
      return false;
    }

    try {
      const parsedUrl = new URL(currentUrl);
      if (parsedUrl.searchParams.get('panel') !== 'settings') {
        return false;
      }

      if (isDev) {
        return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
      }

      return parsedUrl.protocol === 'file:' && /(?:^|\/)index\.html$/iu.test(parsedUrl.pathname);
    } catch {
      return false;
    }
  }
  return isSettingsWindowAtSettingsPanelUrl;
}

function createRendererNavigation({ isDev, path, baseDirectory, logWindowEvent, queryOptions }) {
  const { live2DDragProbeEnabled } = queryOptions;

  const isSettingsWindowAtSettingsPanelUrl = createSettingsPanelUrlChecker({ isDev });

  function loadRenderer(win, query = { desktop: '1' }) {
    const nextQuery = buildRendererQuery(query, queryOptions);
    if (live2DDragProbeEnabled) {
      const label = !win || win.isDestroyed()
        ? 'destroyed-window'
        : (win.getTitle() || 'untitled-window');
      logWindowEvent(`loadRenderer: live2d drag probe enabled for ${label} query=${JSON.stringify(nextQuery)}`);
    }
    const navigation = (() => {
      if (isDev) {
        const searchParams = new URLSearchParams(nextQuery);
        return win.loadURL(`http://127.0.0.1:3000/?${searchParams.toString()}`);
      }

      return win.loadFile(path.join(baseDirectory, '..', 'dist', 'index.html'), {
        query: nextQuery,
      });
    })();

    if (navigation && typeof navigation.catch === 'function') {
      navigation.catch((error) => {
        const label = !win || win.isDestroyed()
          ? 'destroyed-window'
          : (win.getTitle() || 'untitled-window');
        logWindowEvent(`loadRenderer: failed for ${label} query=${JSON.stringify(nextQuery)} error=${error?.stack || error}`);
      });
    }
  }

  return { isSettingsWindowAtSettingsPanelUrl, loadRenderer };
}


function createWindowManagerRendererNavigation({
  isDev, path, baseDirectory, logWindowEvent,
  localTestQueryValues, pointerDiagnosticsEnabled, forceFullShapeOnDragEnabled, live2DDragProbeEnabled,
}) {
  return createRendererNavigation({
    isDev, path, baseDirectory, logWindowEvent,
    queryOptions: {
      ...localTestQueryValues,
      pointerDiagnosticsEnabled, forceFullShapeOnDragEnabled, live2DDragProbeEnabled,
    },
  });
}

module.exports = { createRendererNavigation, createWindowManagerRendererNavigation };
