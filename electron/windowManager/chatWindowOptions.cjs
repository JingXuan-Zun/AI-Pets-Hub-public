function createChatWindowOptionsBuilder({
  getBrowserWindowIconOptions, path, baseDirectory, sessionPartition,
}) {
  return function buildChatWindowOptions(initialBounds, initialLimits) {
    return {
      ...initialBounds,
      ...getBrowserWindowIconOptions(),
      minWidth: initialLimits.minWidth,
      minHeight: initialLimits.minHeight,
      maxWidth: initialLimits.maxWidth,
      maxHeight: initialLimits.maxHeight,
      frame: false,
      // Transparent so the renderer can draw rounded glass corners. Resizing
      // goes through StandaloneWindowResizeHandles + setBounds (same as the
      // settings window); native resize on a transparent window flickers.
      transparent: true,
      hasShadow: false,
      thickFrame: false,
      resizable: false,
      show: false,
      skipTaskbar: false,
      alwaysOnTop: false,
      autoHideMenuBar: true,
      backgroundColor: '#00000000',
      title: 'AI Desktop Pet Chat',
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
module.exports = { createChatWindowOptionsBuilder };
