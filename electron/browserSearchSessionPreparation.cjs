const path = require('path');
const { resolveBrowserPath, resolveBrowserLabel } = require('./browserSearchDiscovery.cjs');
const { resolveDebugPort } = require('./browserSearchRules.cjs');

function resolveBrowserSessionOptions(app, settings = {}) {
  const browserPath = resolveBrowserPath(settings.browserSearchBrowserPath);
  const port = resolveDebugPort(settings.browserSearchDebugPort);
  const browserLabel = resolveBrowserLabel(browserPath);
  const profilePath = path.join(app.getPath('userData'), 'browser-search-profile');

  return {
    browserLabel,
    browserPath,
    port,
    profilePath,
  };
}

async function ensureControlBrowserSession(dependencies, settings = {}, request = {}) {
  const sessionOptions = dependencies.resolveBrowserSessionOptions(settings);
  if (!sessionOptions.browserPath) {
    return {
      ok: false,
      error: 'Chrome or Edge was not found. Set the browser executable path in System settings.',
      ...sessionOptions,
    };
  }

  const sessionResult = await dependencies.ensureBrowserSession(sessionOptions);
  const forceOpenBrowser = Boolean(settings.browserSearchForceOpenBrowser || request.forceOpen || request.forceOpenBrowser);
  if (sessionResult.blockedByManualClose && !forceOpenBrowser) {
    return {
      ok: false,
      blockedByManualClose: true,
      error: 'The controlled browser was manually closed. Use forceOpen if the user explicitly wants to reopen it.',
      ...sessionOptions,
    };
  }

  if (sessionResult.blockedByManualClose && forceOpenBrowser) {
    dependencies.clearManualCloseRequest();
    await dependencies.ensureBrowserSession(sessionOptions);
  }

  return {
    ok: true,
    sessionResult,
    ...sessionOptions,
  };
}

function createBrowserSessionPreparation({ app, ensureBrowserSession, clearManualCloseRequest }) {
  const resolveOptions = (settings) => resolveBrowserSessionOptions(app, settings);
  const dependencies = { resolveBrowserSessionOptions: resolveOptions, ensureBrowserSession, clearManualCloseRequest };
  return {
    resolveBrowserSessionOptions: resolveOptions,
    ensureControlBrowserSession: (settings, request) => ensureControlBrowserSession(dependencies, settings, request),
  };
}

module.exports = { createBrowserSessionPreparation };
