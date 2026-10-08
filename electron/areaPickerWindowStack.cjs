function restoreAuxWindowStack(state, windowManager, mainRelativeLevel, auxRelativeLevel) {
  const getSettingsWindow = () => windowManager.getSettingsWindow();
  const getChatWindow = () => windowManager.getChatWindow();
  const getMainWindow = () => windowManager.getMainWindow();
  state.reduced = false;
  if (getSettingsWindow() && !getSettingsWindow().isDestroyed() && getSettingsWindow().isVisible()) {
    getSettingsWindow().focus();
    windowManager.scheduleKeepWindowOnTop(getSettingsWindow(), auxRelativeLevel, { bringToFront: true });
  } else if (getChatWindow() && !getChatWindow().isDestroyed() && getChatWindow().isVisible()) {
    getChatWindow().focus();
    windowManager.scheduleKeepWindowOnTop(getChatWindow(), auxRelativeLevel, { bringToFront: true });
  } else if (getMainWindow() && !getMainWindow().isDestroyed() && getMainWindow().isVisible()) {
    windowManager.scheduleKeepWindowOnTop(getMainWindow(), mainRelativeLevel, { bringToFront: true });
  }

  windowManager.scheduleWindowStackOnTop();
}

function reduceAuxWindowTopmostForAreaPicker(state, windowManager, mainRelativeLevel, auxRelativeLevel) {
  const getSettingsWindow = () => windowManager.getSettingsWindow();
  const getChatWindow = () => windowManager.getChatWindow();
  if (state.reduced) {
    return;
  }

  state.reduced = true;

  if (getSettingsWindow() && !getSettingsWindow().isDestroyed() && getSettingsWindow().isVisible()) {
    getSettingsWindow().setAlwaysOnTop(false);
  }

  if (getChatWindow() && !getChatWindow().isDestroyed() && getChatWindow().isVisible()) {
    getChatWindow().setAlwaysOnTop(false);
  }
}

function createAreaPickerWindowStack({ windowManager, mainRelativeLevel, auxRelativeLevel }) {
  const state = { reduced: false };
  return {
    restoreAuxWindowStack: () => restoreAuxWindowStack(state, windowManager, mainRelativeLevel, auxRelativeLevel),
    reduceAuxWindowTopmostForAreaPicker: () => reduceAuxWindowTopmostForAreaPicker(state, windowManager, mainRelativeLevel, auxRelativeLevel),
  };
}

module.exports = { createAreaPickerWindowStack };
