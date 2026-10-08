function getAreaPickerThumbnailSize(dependencies, displays = dependencies.screen.getAllDisplays()) {
  const { screen, getFullDisplayBounds, AREA_PICKER_MAX_PREVIEW_WIDTH, AREA_PICKER_MAX_PREVIEW_HEIGHT } = dependencies;

  const safeDisplays = Array.isArray(displays) && displays.length ? displays : screen.getAllDisplays();
  const maxWidth = Math.max(
    1,
    ...safeDisplays.map((display) => {
      const bounds = getFullDisplayBounds(display);
      const scaleFactor = Number.isFinite(display.scaleFactor) && display.scaleFactor > 0
        ? display.scaleFactor
        : 1;
      return Math.round((bounds.width || 0) * scaleFactor);
    }),
  );
  const maxHeight = Math.max(
    1,
    ...safeDisplays.map((display) => {
      const bounds = getFullDisplayBounds(display);
      const scaleFactor = Number.isFinite(display.scaleFactor) && display.scaleFactor > 0
        ? display.scaleFactor
        : 1;
      return Math.round((bounds.height || 0) * scaleFactor);
    }),
  );

  return {
    width: Math.min(AREA_PICKER_MAX_PREVIEW_WIDTH, maxWidth),
    height: Math.min(AREA_PICKER_MAX_PREVIEW_HEIGHT, maxHeight),
  };
}

function getVirtualWorkAreaBounds(dependencies) {
  const { screen, getTargetDisplay } = dependencies;

  const displays = screen.getAllDisplays();

  if (!displays.length) {
    const display = screen.getPrimaryDisplay();
    return {
      display,
      x: display.workArea.x,
      y: display.workArea.y,
      width: display.workArea.width,
      height: display.workArea.height,
    };
  }

  const left = Math.min(...displays.map((display) => display.workArea.x));
  const top = Math.min(...displays.map((display) => display.workArea.y));
  const right = Math.max(...displays.map((display) => display.workArea.x + display.workArea.width));
  const bottom = Math.max(...displays.map((display) => display.workArea.y + display.workArea.height));

  return {
    display: getTargetDisplay(),
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function getVirtualDisplayBounds(dependencies) {
  const { screen, getFullDisplayBounds } = dependencies;

  const displays = screen.getAllDisplays();

  if (!displays.length) {
    const display = screen.getPrimaryDisplay();
    const bounds = getFullDisplayBounds(display);
    return {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    };
  }

  const left = Math.min(...displays.map((display) => getFullDisplayBounds(display).x));
  const top = Math.min(...displays.map((display) => getFullDisplayBounds(display).y));
  const right = Math.max(...displays.map((display) => {
    const bounds = getFullDisplayBounds(display);
    return bounds.x + bounds.width;
  }));
  const bottom = Math.max(...displays.map((display) => {
    const bounds = getFullDisplayBounds(display);
    return bounds.y + bounds.height;
  }));

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function createCaptureAreaGeometry(dependencies) {
  return {
    getAreaPickerThumbnailSize: getAreaPickerThumbnailSize.bind(null, dependencies),
    getVirtualWorkAreaBounds: getVirtualWorkAreaBounds.bind(null, dependencies),
    getVirtualDisplayBounds: getVirtualDisplayBounds.bind(null, dependencies),
  };
}

module.exports = { createCaptureAreaGeometry };
