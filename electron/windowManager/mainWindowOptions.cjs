function createMainWindowOptionsBuilder({
  COMPACT_WINDOW_BOUNDS, getBrowserWindowIconOptions, path, baseDirectory, sessionPartition,
}) {
  return function buildMainWindowOptions() {
    return {
      width: COMPACT_WINDOW_BOUNDS.width,
      height: COMPACT_WINDOW_BOUNDS.height,
      ...getBrowserWindowIconOptions(),
      minWidth: COMPACT_WINDOW_BOUNDS.minWidth,
      minHeight: COMPACT_WINDOW_BOUNDS.minHeight,
      maxWidth: COMPACT_WINDOW_BOUNDS.maxWidth,
      maxHeight: COMPACT_WINDOW_BOUNDS.maxHeight,
      frame: false,
      transparent: true,
      // The desktop pet uses pointer hit regions only; chat/settings inputs live
      // in their own focusable windows. Prevent the first pet click from
      // activating the full transparent overlay and rebuilding its DWM surface.
      focusable: false,
      hasShadow: false,
      resizable: true,
      show: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      autoHideMenuBar: true,
      backgroundColor: '#00000000',
      title: 'AI Desktop Pet',
      webPreferences: {
        preload: path.join(baseDirectory, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        ...(sessionPartition ? { partition: sessionPartition } : {}),
      },
    };
  };
}
module.exports = { createMainWindowOptionsBuilder };
