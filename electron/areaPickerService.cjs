const { createAreaPickerInteractionAssembly } = require('./areaPickerInteractionAssembly.cjs');
const { createPersistentAreaBorderLifecycle } = require('./areaPickerBorderLifecycle.cjs');
const { BrowserWindow, globalShortcut, screen } = require('electron');

const AREA_PICKER_TOPMOST_WINDOW_LEVEL = 'pop-up-menu';
const MAIN_TOPMOST_RELATIVE_LEVEL = 1;
const AUX_TOPMOST_RELATIVE_LEVEL = 3;
const PERSISTENT_AREA_BORDER_TOPMOST_RELATIVE_LEVEL = 4;
const AREA_PICKER_TOPMOST_RELATIVE_LEVEL = 5;
const AREA_PICKER_ESCAPE_ACCELERATOR = 'Esc';
function createAreaPickerService(options) {
  const {
    captureService,
    isQuitting,
    loadRenderer,
    windowManager,
  } = options;

  const { destroyPersistentAreaBorder, refreshPersistentAreaBorder, syncPersistentAreaBorderFromSettingsAction, getPersistentAreaBorderWindow } = createPersistentAreaBorderLifecycle({
    captureService, screen, BrowserWindow, windowManager,
    topmostRelativeLevel: PERSISTENT_AREA_BORDER_TOPMOST_RELATIVE_LEVEL,
    topmostLevel: AREA_PICKER_TOPMOST_WINDOW_LEVEL,
  });

const { state: pickerState, resolveAreaPickerSelection, openAreaPickerWindow, unregisterAreaPickerEscapeShortcut } = createAreaPickerInteractionAssembly({
    captureService, windowManager, globalShortcut, BrowserWindow, loadRenderer, isQuitting,
    mainRelativeLevel: MAIN_TOPMOST_RELATIVE_LEVEL, auxRelativeLevel: AUX_TOPMOST_RELATIVE_LEVEL,
    accelerator: AREA_PICKER_ESCAPE_ACCELERATOR,
    topmostRelativeLevel: AREA_PICKER_TOPMOST_RELATIVE_LEVEL,
    topmostLevel: AREA_PICKER_TOPMOST_WINDOW_LEVEL,
    scheduleRestore: (callback) => setTimeout(callback, 0),
  });

  async function openNativeAreaPickerWindow() {
  return openAreaPickerWindow();
}

  function dispose() {
    unregisterAreaPickerEscapeShortcut();
    if (pickerState.resolver) {
      resolveAreaPickerSelection(null);
    }
    destroyPersistentAreaBorder();
  }

  return {
    cancelAreaPickerSelection: () => resolveAreaPickerSelection(null),
    dispose,
    getAreaPickerContext: () => pickerState.context,
    getAreaPickerWindow: () => pickerState.window,
    getPersistentAreaBorderWindow,
    openNativeAreaPickerWindow,
    refreshPersistentAreaBorder,
    submitAreaPickerSelection: (selection) => resolveAreaPickerSelection(selection ?? null),
    syncPersistentAreaBorderFromSettingsAction,
  };
}

module.exports = {
  createAreaPickerService,
};
