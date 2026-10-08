function createSettingsWindowOptionsBuilder({
  getBrowserWindowIconOptions, SETTINGS_PANEL_WINDOW_BOUNDS, path, baseDirectory, sessionPartition,
}) {
  return function buildSettingsWindowOptions(initialBounds) {
    return {
      ...initialBounds,
      ...getBrowserWindowIconOptions(),
      minWidth: SETTINGS_PANEL_WINDOW_BOUNDS.minWidth,
      minHeight: SETTINGS_PANEL_WINDOW_BOUNDS.minHeight,
      frame: false,
      transparent: true,
      hasShadow: false,
      thickFrame: false,
      // Resizing is implemented by StandaloneWindowResizeHandles + setBounds.
      // Leaving native resize enabled makes Windows repaint a competing edge
      // during drag, which causes the right border to flicker.
      resizable: false,
      show: false,
      skipTaskbar: false,
      alwaysOnTop: false,
      focusable: true,
      autoHideMenuBar: true,
      backgroundColor: '#00000000',
      title: 'AI Desktop Pet Settings',
      webPreferences: {
        backgroundThrottling: false,
        preload: path.join(baseDirectory, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        ...(sessionPartition ? { partition: sessionPartition } : {}),
      },
    };
  };
}

module.exports = { createSettingsWindowOptionsBuilder };
