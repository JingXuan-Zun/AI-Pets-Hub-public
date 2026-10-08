async function readDisplayEnvironment(dependencies, options = {}) {
  const { normalizeCaptureSourceTypes, getDisplayListWithNativeBounds, getCaptureSourceListWithOptions, isCaptureSourceCacheFresh } = dependencies;

  const {
    includeCaptureSources = true,
    preferCachedCaptureSources = false,
    forceRefreshCaptureSources = false,
    captureSourceTypes,
    includeCaptureThumbnails = false,
  } = options;
  const normalizedCaptureSourceTypes = normalizeCaptureSourceTypes(captureSourceTypes);
  const displays = await getDisplayListWithNativeBounds();

  return {
    displays,
    captureSources: includeCaptureSources
      ? await getCaptureSourceListWithOptions({
          forceRefresh: forceRefreshCaptureSources,
          preferCached: preferCachedCaptureSources,
          captureSourceTypes: normalizedCaptureSourceTypes,
          includeCaptureThumbnails,
        })
      : [],
    captureSourceTypesIncluded: includeCaptureSources
      ? normalizedCaptureSourceTypes
      : [],
    captureSourcesIncluded: includeCaptureSources,
    captureSourcesPending: includeCaptureSources
      ? (preferCachedCaptureSources && !isCaptureSourceCacheFresh(normalizedCaptureSourceTypes))
      : false,
  };
}

async function sendDisplayEnvironment(dependencies, options = {}) {
  const { getLiveRendererWindows, getRendererWindows, getDisplayEnvironment, console } = dependencies;

  const {
    windows = null,
    ...displayEnvironmentOptions
  } = options;
  const rendererWindows = Array.isArray(windows)
    ? getLiveRendererWindows(windows)
    : getRendererWindows();
  if (!rendererWindows.length) {
    return;
  }

  try {
    const displayEnvironment = await getDisplayEnvironment(displayEnvironmentOptions);
    rendererWindows.forEach((win) => {
      win.webContents.send('desktop-pet:display-environment-change', displayEnvironment);
    });
  } catch (error) {
    console.error('Failed to broadcast display environment:', error);
  }
}

function createCaptureDisplayEnvironment(dependencies) {
  const getDisplayEnvironment = readDisplayEnvironment.bind(null, dependencies);
  return {
    getDisplayEnvironment,
    broadcastDisplayEnvironment: sendDisplayEnvironment.bind(null, { ...dependencies, getDisplayEnvironment }),
  };
}

module.exports = { createCaptureDisplayEnvironment };
