const { createPostDragInputProxyStateAdapter } = require('./windowInteractionStateAdapters.cjs');
const { createInputProxyIdleLifecycle } = require('./inputProxyIdleLifecycle.cjs');
const { createInputProxyRegionApplier } = require('./inputProxyRegionApplication.cjs');
const { createInputProxyWindowCreator } = require('./inputProxyWindowCreation.cjs');

function createPostDragInputProxyLifecycle({
  proxyState, getMainWindow, BrowserWindow, path, baseDirectory, sessionPartition,
  disableDwmSystemBorderForWindow, keepWindowOnTop, logWindowEvent, pointerDiagnosticsEnabled,
  createInteractiveRegionsSignature, summarizeInteractiveRegion,
  TOPMOST_WINDOW_LEVEL, POST_DRAG_INPUT_PROXY_TOPMOST_RELATIVE_LEVEL, POST_DRAG_INPUT_PROXY_IDLE_DESTROY_MS,
  setTimeout, clearTimeout,
}) {
  const { clearPostDragInputProxyIdleDestroyTimer, hidePostDragInputProxy } = createInputProxyIdleLifecycle({
    proxyState, clearTimeout, setTimeout, pointerDiagnosticsEnabled, logWindowEvent, POST_DRAG_INPUT_PROXY_IDLE_DESTROY_MS,
  });
  const applyPostDragInputProxyRegions = createInputProxyRegionApplier({
    proxyState, getMainWindow, clearPostDragInputProxyIdleDestroyTimer, hidePostDragInputProxy,
    keepWindowOnTop, POST_DRAG_INPUT_PROXY_TOPMOST_RELATIVE_LEVEL, pointerDiagnosticsEnabled,
    logWindowEvent, summarizeInteractiveRegion, createInteractiveRegionsSignature,
  });
  const ensurePostDragInputProxyWindow = createInputProxyWindowCreator({
    proxyState, getMainWindow, BrowserWindow, path, baseDirectory, sessionPartition, disableDwmSystemBorderForWindow,
    pointerDiagnosticsEnabled, logWindowEvent, TOPMOST_WINDOW_LEVEL, POST_DRAG_INPUT_PROXY_TOPMOST_RELATIVE_LEVEL,
    applyPostDragInputProxyRegions, clearPostDragInputProxyIdleDestroyTimer, hidePostDragInputProxy,
  });
  return { clearPostDragInputProxyIdleDestroyTimer, hidePostDragInputProxy, applyPostDragInputProxyRegions, ensurePostDragInputProxyWindow };
}

function createPostDragInputProxyStateLifecycle({
  managerState, BrowserWindow, path, baseDirectory,
  sessionPartition, disableDwmSystemBorderForWindow, keepWindowOnTop, logWindowEvent,
  pointerDiagnosticsEnabled, createInteractiveRegionsSignature, summarizeInteractiveRegion, TOPMOST_WINDOW_LEVEL,
  POST_DRAG_INPUT_PROXY_TOPMOST_RELATIVE_LEVEL, POST_DRAG_INPUT_PROXY_IDLE_DESTROY_MS, setTimeout, clearTimeout,
}) {
  const postDragInputProxyState = createPostDragInputProxyStateAdapter(managerState);
  const controllers = createPostDragInputProxyLifecycle({
    proxyState: postDragInputProxyState, getMainWindow: () => managerState.mainWindow, BrowserWindow,
    path, baseDirectory, sessionPartition,
    disableDwmSystemBorderForWindow, keepWindowOnTop, logWindowEvent,
    pointerDiagnosticsEnabled, createInteractiveRegionsSignature, summarizeInteractiveRegion,
    TOPMOST_WINDOW_LEVEL, POST_DRAG_INPUT_PROXY_TOPMOST_RELATIVE_LEVEL, POST_DRAG_INPUT_PROXY_IDLE_DESTROY_MS,
    setTimeout, clearTimeout,
  });
  return { postDragInputProxyState, ...controllers };
}

module.exports = { createPostDragInputProxyLifecycle, createPostDragInputProxyStateLifecycle };
