const { normalizeBrowserControlAction } = require('./browserSearchRules.cjs');

function createBrowserControlDispatcher({ getSessionState, search, controlBrowserPage }) {
  return async function controlBrowser(request = {}, settings = {}) {
    const action = normalizeBrowserControlAction(request?.action ?? request?.browserAction ?? request?.operation);
    if (!action) {
      return {
        ok: false,
        error: 'Unsupported browser control action.',
        supportedActions: ['open_url', 'search_web', 'read_page', 'focus_tab', 'list_tabs', 'status'],
      };
    }

    if (action === 'status') {
      return {
        ...getSessionState(),
        action,
        ok: true,
      };
    }

    if (action === 'search_web') {
      const query = String(request?.query || request?.target || '').trim();
      const result = await search(query, {
        ...settings,
        browserSearchForceNewPage: Boolean(request?.forceNewPage ?? settings.browserSearchForceNewPage),
      });
      return {
        ...result,
        action,
      };
    }
    return controlBrowserPage(action, request, settings);
  };
}

module.exports = { createBrowserControlDispatcher };
