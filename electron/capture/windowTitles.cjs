function readOwnCaptureWindowTitles({ BrowserWindow, normalizeCaptureSourceTitle }) {
  return new Set(
    BrowserWindow.getAllWindows()
      .filter((win) => win && !win.isDestroyed())
      .map((win) => normalizeCaptureSourceTitle(win.getTitle()))
      .filter(Boolean),
  );
}

function createOwnCaptureWindowTitleReader(dependencies) {
  return readOwnCaptureWindowTitles.bind(null, dependencies);
}

module.exports = { createOwnCaptureWindowTitleReader };
