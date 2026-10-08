function createMainWindowInteractiveSizeReader({ getMainWindow }) {
  function getMainWindowInteractiveRegionSize() {
    if (!getMainWindow() || getMainWindow().isDestroyed()) {
      return null;
    }

    const bounds = typeof getMainWindow().getContentBounds === 'function'
      ? getMainWindow().getContentBounds()
      : getMainWindow().getBounds();
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
      return null;
    }

    return {
      height: Math.round(bounds.height),
      width: Math.round(bounds.width),
    };
  }
  return getMainWindowInteractiveRegionSize;
}

function createMainWindowInteractiveGeometry({ getMainWindow }) {
  const getMainWindowInteractiveRegionSize = createMainWindowInteractiveSizeReader({ getMainWindow });

  function isFullWindowInteractiveShape(regions) {
    if (!Array.isArray(regions) || regions.length !== 1) {
      return false;
    }

    return isFullWindowInteractiveRegion(regions[0]);
  }

  function isFullWindowInteractiveRegion(region) {
    const size = getMainWindowInteractiveRegionSize();
    if (!region || !size) {
      return false;
    }

    return region.x === 0
      && region.y === 0
      && region.width >= Math.max(1, size.width - 2)
      && region.height >= Math.max(1, size.height - 2);
  }

  function createFullWindowInteractiveRegion() {
    const size = getMainWindowInteractiveRegionSize();
    if (!size) {
      return null;
    }

    return {
      height: Math.max(1, size.height),
      width: Math.max(1, size.width),
      x: 0,
      y: 0,
    };
  }

  return { isFullWindowInteractiveShape, createFullWindowInteractiveRegion };
}

function createMainWindowStateInteractiveGeometry({ managerState }) {
  return createMainWindowInteractiveGeometry({
    getMainWindow: () => managerState.mainWindow,
  });
}

module.exports = { createMainWindowInteractiveGeometry, createMainWindowStateInteractiveGeometry };
