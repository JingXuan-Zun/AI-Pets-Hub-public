function createMainWindowPresentationEventRegistrar({
  getMainWindow, getIsQuitting, pointerDiagnosticsEnabled,
  hideMainWindow, logWindowEvent, applyPostDragInputProxyRegions, scheduleWindowStackOnTop,
}) {
  return function attachMainWindowPresentationEvents() {
    getMainWindow().on('close', (event) => {
      if (getIsQuitting()) {
        return;
      }
      event.preventDefault();
      hideMainWindow();
    });
    getMainWindow().on('show', () => {
      if (pointerDiagnosticsEnabled) {
        logWindowEvent(`main-window: show focused=${getMainWindow()?.isFocused?.() ?? false}`);
      }
      applyPostDragInputProxyRegions();
      scheduleWindowStackOnTop();
    });
    getMainWindow().on('restore', () => scheduleWindowStackOnTop());
    getMainWindow().on('focus', () => {
      if (pointerDiagnosticsEnabled) {
        logWindowEvent('main-window: focus');
      }
    });
    getMainWindow().on('blur', () => {
      if (pointerDiagnosticsEnabled) {
        logWindowEvent('main-window: blur');
      }
      scheduleWindowStackOnTop();
    });
    getMainWindow().on('move', () => scheduleWindowStackOnTop());
    getMainWindow().on('resize', () => scheduleWindowStackOnTop());
  };
}
module.exports = { createMainWindowPresentationEventRegistrar };
