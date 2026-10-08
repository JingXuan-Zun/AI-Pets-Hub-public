const { listDevToolsPages, selectBrowserPage, formatBrowserPage } = require('./browserSearchPages.cjs');
const { openBrowserControlPage } = require('./browserSearchOpenPage.cjs');
const { focusBrowserControlPage } = require('./browserSearchFocusPage.cjs');
const { readBrowserControlPage } = require('./browserSearchReadPage.cjs');

async function controlSelectedBrowserPage(action, request, port, browserLabel, pages) {
  if (action === 'list_tabs') {
    return {
      action,
      browserLabel,
      ok: true,
      pageCount: pages.length,
      pages: pages.map(formatBrowserPage),
    };
  }

  const page = selectBrowserPage(pages, request);
  if (!page) {
    return {
      action,
      browserLabel,
      ok: false,
      error: 'No matching controlled browser tab was found.',
      pageCount: pages.length,
    };
  }

  if (action === 'focus_tab') {
    return focusBrowserControlPage(action, browserLabel, port, page, pages);
  }

  return readBrowserControlPage(action, browserLabel, page, pages);
}

function createBrowserPageController({ ensureControlBrowserSession, resolveBrowserSessionOptions }) {
  return async function controlBrowserPage(action, request, settings) {
    const session = action === 'open_url'
      ? await ensureControlBrowserSession(settings, request)
      : resolveBrowserSessionOptions(settings);
    if (session.ok === false) {
      return {
        ...session,
        action,
      };
    }

    const port = session.port;
    const browserLabel = session.browserLabel;

    if (action === 'open_url') {
      return openBrowserControlPage(action, request, port, browserLabel);
    }

    let pages = [];
    try {
      pages = await listDevToolsPages(port);
    } catch (error) {
      return {
        action,
        browserLabel,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        pageCount: 0,
      };
    }
    return controlSelectedBrowserPage(action, request, port, browserLabel, pages);
  };
}

module.exports = { createBrowserPageController };
