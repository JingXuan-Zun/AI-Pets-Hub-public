const { createBrowserSessionLifecycle } = require('./browserSearchSessionLifecycle.cjs');
const { createBrowserSessionPreparation } = require('./browserSearchSessionPreparation.cjs');
const { createBrowserPageController } = require('./browserSearchPageController.cjs');
const { createBrowserControlDispatcher } = require('./browserSearchControlDispatcher.cjs');
const { createBrowserSearchExecution } = require('./browserSearchExecution.cjs');
const { extractTextFromDocumentLike } = require('./browserSearchPageText.cjs');
const { isExecutableFile, getBrowserSearchCandidateRoots, buildBrowserCandidateDescriptors, getDetectedBrowserCandidates, resolveBrowserLabel } = require('./browserSearchDiscovery.cjs');

function createBrowserSearchService({ app, log }) {
  const { ensureBrowserSession, getSessionState, closeSession, clearManualCloseRequest } = createBrowserSessionLifecycle();

  function detect(settings = {}) {
    const configuredPath = typeof settings.browserSearchBrowserPath === 'string'
      ? settings.browserSearchBrowserPath.trim()
      : '';
    const candidates = buildBrowserCandidateDescriptors();
    const resolvedPath = isExecutableFile(configuredPath)
      ? configuredPath
      : (candidates.find((candidate) => candidate.exists)?.path || '');

    return {
      ok: Boolean(resolvedPath),
      browserLabel: resolveBrowserLabel(resolvedPath),
      candidates,
      configuredPath,
      configuredPathValid: Boolean(configuredPath && isExecutableFile(configuredPath)),
      resolvedPath,
      scannedRootCount: getBrowserSearchCandidateRoots().length,
      detectedCount: candidates.filter((candidate) => candidate.exists).length,
    };
  }

  const { resolveBrowserSessionOptions, ensureControlBrowserSession } = createBrowserSessionPreparation({
    app,
    ensureBrowserSession,
    clearManualCloseRequest,
  });

  const controlBrowserPage = createBrowserPageController({ ensureControlBrowserSession, resolveBrowserSessionOptions });

  const search = createBrowserSearchExecution({ app, log, ensureBrowserSession, clearManualCloseRequest });

  const controlBrowser = createBrowserControlDispatcher({ getSessionState, search, controlBrowserPage });

  function dispose() {
    closeSession();
  }

  return {
    control: controlBrowser,
    detect,
    closeSession,
    dispose,
    getSessionState,
    search,
  };
}

module.exports = {
  createBrowserSearchService,
  extractTextFromDocumentLike,
  getDetectedBrowserCandidates,
};
