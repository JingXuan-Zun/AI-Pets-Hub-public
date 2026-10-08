function createCaptureWindowBounds({ captureService, SETTINGS_PANEL_WINDOW_BOUNDS }) {
  function getCompactWindowBounds() {
    const display = captureService.getTargetDisplay();
    const virtualBounds = captureService.getVirtualDisplayBounds();
    const fallbackBounds = captureService.getFullDisplayBounds(display);
    const bounds = virtualBounds && virtualBounds.width > 0 && virtualBounds.height > 0
      ? virtualBounds
      : fallbackBounds;

    return {
      display,
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    };
  }

  function getSettingsWindowBounds() {
    return getCompactWindowBounds();
  }

  function getSettingsPanelWindowBounds() {
    const display = captureService.getTargetDisplay();
    const width = Math.min(SETTINGS_PANEL_WINDOW_BOUNDS.width, display.workArea.width);
    const height = Math.min(SETTINGS_PANEL_WINDOW_BOUNDS.height, display.workArea.height);
    const x = Math.round(display.workArea.x + (display.workArea.width - width) / 2);
    const y = Math.round(display.workArea.y + (display.workArea.height - height) / 2);

    return {
      x,
      y,
      width,
      height,
    };
  }
  return { getCompactWindowBounds, getSettingsWindowBounds, getSettingsPanelWindowBounds };
}

module.exports = { createCaptureWindowBounds };
