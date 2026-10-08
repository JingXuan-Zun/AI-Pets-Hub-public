function createWindowTopmostScheduler({ keepWindowOnTop, MAIN_TOPMOST_RELATIVE_LEVEL, setTimeout }) {
  function scheduleKeepWindowOnTop(win, relativeLevel = MAIN_TOPMOST_RELATIVE_LEVEL, options = {}) {
    keepWindowOnTop(win, relativeLevel, options);
    setTimeout(() => keepWindowOnTop(win, relativeLevel, options), 0);
    setTimeout(() => keepWindowOnTop(win, relativeLevel, options), 250);
  }

  return { scheduleKeepWindowOnTop };
}

module.exports = { createWindowTopmostScheduler };
