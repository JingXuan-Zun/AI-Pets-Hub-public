function createMainWindowSettingsResizer({
  getMainWindow, getSettingsWindowBounds, getCompactWindowBounds, scheduleWindowStackOnTop,
}) {
  return function resizeWindowForSettings(isOpen) {
    if (!getMainWindow()) {
      return;
    }

    const nextBounds = isOpen ? getSettingsWindowBounds() : getCompactWindowBounds();

    getMainWindow().setMinimumSize(nextBounds.width, nextBounds.height);
    getMainWindow().setMaximumSize(nextBounds.width, nextBounds.height);
    getMainWindow().setBounds({
      x: nextBounds.x,
      y: nextBounds.y,
      width: nextBounds.width,
      height: nextBounds.height,
    });
    scheduleWindowStackOnTop();
  };
}

function createMainWindowCenterResizer({
  getMainWindow, getSettingsWindowBounds, getCompactWindowBounds, captureService, scheduleWindowStackOnTop,
}) {
  return function resizeWindowAroundCurrentCenter(isOpen) {
    if (!getMainWindow()) {
      return;
    }

    const nextBounds = isOpen ? getSettingsWindowBounds() : getCompactWindowBounds();
    const currentBounds = getMainWindow().getBounds();
    const displayBounds = captureService.getVirtualDisplayBounds();
    const centerX = currentBounds.x + currentBounds.width / 2;
    const centerY = currentBounds.y + currentBounds.height / 2;
    const nextX = Math.round(Math.max(
      displayBounds.x,
      Math.min(displayBounds.x + displayBounds.width - nextBounds.width, centerX - nextBounds.width / 2),
    ));
    const nextY = Math.round(Math.max(
      displayBounds.y,
      Math.min(displayBounds.y + displayBounds.height - nextBounds.height, centerY - nextBounds.height / 2),
    ));

    getMainWindow().setMinimumSize(nextBounds.width, nextBounds.height);
    getMainWindow().setMaximumSize(nextBounds.width, nextBounds.height);
    getMainWindow().setBounds({
      x: nextX,
      y: nextY,
      width: nextBounds.width,
      height: nextBounds.height,
    });
    scheduleWindowStackOnTop();
  };
}

module.exports = { createMainWindowSettingsResizer, createMainWindowCenterResizer };
