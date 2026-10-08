const { createWindowBoundsResolver } = require('./windowBoundsResolver.cjs');
const { createWindowIconResolver } = require('./windowIconResolver.cjs');

function createWindowResourceResolvers({
  captureService, screen, getSharedState,
  SETTINGS_PANEL_WINDOW_BOUNDS, CHAT_PANEL_WINDOW_BOUNDS, INTERACTIVE_CHAT_PANEL_WINDOW_BOUNDS, INTERACTIVE_CHAT_PANEL_CENTER_Y_RATIO,
  nativeImage, path, processRef, baseDirectory,
}) {
  const bounds = createWindowBoundsResolver({
    captureService, screen, getSharedState, SETTINGS_PANEL_WINDOW_BOUNDS, CHAT_PANEL_WINDOW_BOUNDS, INTERACTIVE_CHAT_PANEL_WINDOW_BOUNDS, INTERACTIVE_CHAT_PANEL_CENTER_Y_RATIO,
  });
  const icons = createWindowIconResolver({
    nativeImage, path, processRef, baseDirectory,
  });
  return { ...bounds, ...icons };
}

module.exports = { createWindowResourceResolvers };
