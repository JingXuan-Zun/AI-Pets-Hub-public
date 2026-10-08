function createWindowStackTopmost({
  getMainWindow, getInputProxyWindow, MAIN_TOPMOST_RELATIVE_LEVEL, POST_DRAG_INPUT_PROXY_TOPMOST_RELATIVE_LEVEL,
  keepWindowOnTop, keepAuxWindowsOnTop, keepPersistentAreaBorderOnTop, keepAreaPickerOnTop,
  scheduleKeepWindowOnTop, scheduleAuxWindowsOnTop, schedulePersistentAreaBorderOnTop, scheduleAreaPickerOnTop,
}) {
  function keepWindowStackOnTop() {
    keepWindowOnTop(getMainWindow(), MAIN_TOPMOST_RELATIVE_LEVEL, { bringToFront: true });
    keepWindowOnTop(getInputProxyWindow(), POST_DRAG_INPUT_PROXY_TOPMOST_RELATIVE_LEVEL, {
      bringToFront: true,
    });
    keepAuxWindowsOnTop();
    keepPersistentAreaBorderOnTop();
    keepAreaPickerOnTop();
  }

  function scheduleWindowStackOnTop() {
    scheduleKeepWindowOnTop(getMainWindow(), MAIN_TOPMOST_RELATIVE_LEVEL, { bringToFront: true });
    scheduleKeepWindowOnTop(
      getInputProxyWindow(),
      POST_DRAG_INPUT_PROXY_TOPMOST_RELATIVE_LEVEL,
      { bringToFront: true },
    );
    scheduleAuxWindowsOnTop();
    schedulePersistentAreaBorderOnTop();
    scheduleAreaPickerOnTop();
  }

  return { keepWindowStackOnTop, scheduleWindowStackOnTop };
}

module.exports = { createWindowStackTopmost };
