function createAuxWindowTopmostActions({
  getSettingsWindow, getChatWindow, getAreaPickerWindow, getPersistentAreaBorderWindow, keepWindowOnTop,
  AUX_TOPMOST_RELATIVE_LEVEL, AREA_PICKER_TOPMOST_RELATIVE_LEVEL,
  PERSISTENT_AREA_BORDER_TOPMOST_RELATIVE_LEVEL, AREA_PICKER_TOPMOST_WINDOW_LEVEL,
}) {
  function keepAuxWindowsOnTop() {
    keepWindowOnTop(getSettingsWindow(), AUX_TOPMOST_RELATIVE_LEVEL);
    keepWindowOnTop(getChatWindow(), AUX_TOPMOST_RELATIVE_LEVEL);
  }
  function keepAreaPickerOnTop() {
    keepWindowOnTop(getAreaPickerWindow(), AREA_PICKER_TOPMOST_RELATIVE_LEVEL, {
      topmostLevel: AREA_PICKER_TOPMOST_WINDOW_LEVEL,
    });
  }
  function keepPersistentAreaBorderOnTop() {
    keepWindowOnTop(getPersistentAreaBorderWindow(), PERSISTENT_AREA_BORDER_TOPMOST_RELATIVE_LEVEL, {
      topmostLevel: AREA_PICKER_TOPMOST_WINDOW_LEVEL,
    });
  }
  return { keepAuxWindowsOnTop, keepAreaPickerOnTop, keepPersistentAreaBorderOnTop };
}

function createAuxWindowTopmostScheduler({
  getSettingsWindow, getChatWindow, getAreaPickerWindow, getPersistentAreaBorderWindow, scheduleKeepWindowOnTop,
  AUX_TOPMOST_RELATIVE_LEVEL, AREA_PICKER_TOPMOST_RELATIVE_LEVEL,
  PERSISTENT_AREA_BORDER_TOPMOST_RELATIVE_LEVEL, AREA_PICKER_TOPMOST_WINDOW_LEVEL,
}) {
  function scheduleAuxWindowsOnTop() {
    scheduleKeepWindowOnTop(getSettingsWindow(), AUX_TOPMOST_RELATIVE_LEVEL);
    scheduleKeepWindowOnTop(getChatWindow(), AUX_TOPMOST_RELATIVE_LEVEL);
  }
  function scheduleAreaPickerOnTop() {
    scheduleKeepWindowOnTop(getAreaPickerWindow(), AREA_PICKER_TOPMOST_RELATIVE_LEVEL, {
      topmostLevel: AREA_PICKER_TOPMOST_WINDOW_LEVEL,
    });
  }
  function schedulePersistentAreaBorderOnTop() {
    scheduleKeepWindowOnTop(getPersistentAreaBorderWindow(), PERSISTENT_AREA_BORDER_TOPMOST_RELATIVE_LEVEL, {
      topmostLevel: AREA_PICKER_TOPMOST_WINDOW_LEVEL,
    });
  }
  return { scheduleAuxWindowsOnTop, scheduleAreaPickerOnTop, schedulePersistentAreaBorderOnTop };
}

module.exports = { createAuxWindowTopmostActions, createAuxWindowTopmostScheduler };
