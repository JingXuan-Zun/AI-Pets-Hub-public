const path = require('path');
const { resolveBrowserPath, resolveBrowserLabel } = require('./browserSearchDiscovery.cjs');
const { resolveDebugPort, buildSearchUrl } = require('./browserSearchRules.cjs');
const { navigateOrOpenTarget } = require('./browserSearchNavigation.cjs');
const { extractPageText } = require('./browserSearchPageText.cjs');

function prepareSearch(query, settings, app) {
  const normalizedQuery = String(query || '').trim();
  if (!normalizedQuery) {
    return { ok: false, error: 'Search query is empty.' };
  }
  const browserPath = resolveBrowserPath(settings.browserSearchBrowserPath);
  if (!browserPath) {
    return {
      ok: false,
      error: 'Chrome or Edge was not found. Set the browser executable path in System settings.',
    };
  }
  const port = resolveDebugPort(settings.browserSearchDebugPort);
  const browserLabel = resolveBrowserLabel(browserPath);
  const searchUrl = buildSearchUrl(normalizedQuery, settings, browserLabel);
  const profilePath = path.join(app.getPath('userData'), 'browser-search-profile');
  const forceOpenBrowser = Boolean(settings.browserSearchForceOpenBrowser);
  return { normalizedQuery, browserPath, port, browserLabel, searchUrl, profilePath, forceOpenBrowser };
}

async function prepareSearchSession(options, { log, ensureBrowserSession, clearManualCloseRequest }) {
  const { normalizedQuery, browserPath, browserLabel, port, profilePath, forceOpenBrowser } = options;
  log?.('browser-search launch', { browserLabel, port, query: normalizedQuery.slice(0, 80) });
  const sessionResult = await ensureBrowserSession({ browserPath, browserLabel, port, profilePath });
  if (sessionResult.blockedByManualClose && !forceOpenBrowser) {
    return {
      ok: false,
      browserLabel,
      error: 'The browser was manually closed. Reopen it from the system browser search controls or force this query.',
    };
  }
  if (sessionResult.blockedByManualClose && forceOpenBrowser) {
    clearManualCloseRequest();
    await ensureBrowserSession({ browserPath, browserLabel, port, profilePath });
  }
  return null;
}

async function readSearchResult(options, settings) {
  const { normalizedQuery, browserLabel, port, searchUrl } = options;
  const forceNewPage = Boolean(settings.browserSearchForceNewPage);
  const createdTarget = await navigateOrOpenTarget(port, searchUrl, forceNewPage);
  const targetWebSocketUrl = createdTarget?.webSocketDebuggerUrl;
  const targetUrl = createdTarget?.url && createdTarget.url !== 'about:blank'
    ? createdTarget.url
    : searchUrl;
  if (!targetWebSocketUrl) {
    return {
      ok: false,
      browserLabel,
      opened: true,
      query: normalizedQuery,
      url: targetUrl,
      error: 'The browser page opened, but no readable DevTools page was found.',
    };
  }
  const text = await extractPageText(targetWebSocketUrl);
  if (!text) {
    return {
      ok: false,
      browserLabel,
      opened: true,
      query: normalizedQuery,
      url: targetUrl,
      error: 'The browser page opened, but no usable text was extracted.',
    };
  }
  return { ok: true, browserLabel, query: normalizedQuery, text, url: targetUrl };
}

function createBrowserSearchExecution({ app, log, ensureBrowserSession, clearManualCloseRequest }) {
  const sessionDependencies = { log, ensureBrowserSession, clearManualCloseRequest };
  return async function search(query, settings = {}) {
    const options = prepareSearch(query, settings, app);
    if (options.ok === false) return options;
    const errorResult = await prepareSearchSession(options, sessionDependencies);
    if (errorResult) return errorResult;
    return readSearchResult(options, settings);
  };
}

module.exports = { createBrowserSearchExecution };
