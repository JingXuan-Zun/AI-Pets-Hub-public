function createScreenToPetConverter({ screen, logMessage }) {
  function screenToPetCoordinate(point) {
    if (
      screen
      && typeof screen.screenToDipPoint === 'function'
      && Number.isFinite(point?.x)
      && Number.isFinite(point?.y)
    ) {
      try {
        const convertedPoint = screen.screenToDipPoint({
          x: Math.round(point.x),
          y: Math.round(point.y),
        });
        if (
          convertedPoint
          && Number.isFinite(convertedPoint.x)
          && Number.isFinite(convertedPoint.y)
        ) {
          return {
            x: convertedPoint.x,
            y: convertedPoint.y,
          };
        }
      } catch (error) {
        logMessage('desktop icon coordinate conversion failed', error?.stack || error);
      }
    }

    return point;
  }
  return screenToPetCoordinate;
}

function createPetToScreenConverter({ screen, logMessage }) {
  function petToScreenCoordinate(point) {
    if (
      screen
      && typeof screen.dipToScreenPoint === 'function'
      && Number.isFinite(point?.x)
      && Number.isFinite(point?.y)
    ) {
      try {
        const convertedPoint = screen.dipToScreenPoint({
          x: Math.round(point.x),
          y: Math.round(point.y),
        });
        if (
          convertedPoint
          && Number.isFinite(convertedPoint.x)
          && Number.isFinite(convertedPoint.y)
        ) {
          return {
            x: convertedPoint.x,
            y: convertedPoint.y,
          };
        }
      } catch (error) {
        logMessage('desktop icon reverse coordinate conversion failed', error?.stack || error);
      }
    }

    return point;
  }
  return petToScreenCoordinate;
}

function createDesktopIconCoordinateAttacher({ screenToPetCoordinate }) {
  function attachDesktopIconCoordinateSpaces(icon) {
    if (!icon) {
      return null;
    }

    const topLeft = screenToPetCoordinate({ x: icon.x, y: icon.y });
    const bottomRight = screenToPetCoordinate({
      x: icon.x + icon.width,
      y: icon.y + icon.height,
    });
    const center = screenToPetCoordinate({ x: icon.centerX, y: icon.centerY });

    const nativeScreenIcon = {
      ...icon,
      coordinateSpace: 'native-screen',
      desktopGridCellHeight: icon.desktopGridCellHeight,
      desktopGridCellWidth: icon.desktopGridCellWidth,
      nativeScreenCenterX: Math.round(icon.centerX),
      nativeScreenCenterY: Math.round(icon.centerY),
      nativeScreenHeight: Math.max(1, Math.round(icon.height)),
      nativeScreenWidth: Math.max(1, Math.round(icon.width)),
      nativeScreenX: Math.round(icon.x),
      nativeScreenY: Math.round(icon.y),
    };

    return {
      ...nativeScreenIcon,
      dipCenterX: Math.round(center.x),
      dipCenterY: Math.round(center.y),
      dipHeight: Math.max(1, Math.round(Math.abs(bottomRight.y - topLeft.y))),
      dipWidth: Math.max(1, Math.round(Math.abs(bottomRight.x - topLeft.x))),
      dipX: Math.round(topLeft.x),
      dipY: Math.round(topLeft.y),
    };
  }
  return attachDesktopIconCoordinateSpaces;
}

function selectDesktopIconCoordinateSpace(icon, coordinateSpace = 'dip') {
  if (!icon) {
    return null;
  }

  if (coordinateSpace === 'native-screen') {
    return {
      ...icon,
      centerX: icon.nativeScreenCenterX ?? icon.centerX,
      centerY: icon.nativeScreenCenterY ?? icon.centerY,
      coordinateSpace: 'native-screen',
      desktopGridCellHeight: icon.desktopGridCellHeight,
      desktopGridCellWidth: icon.desktopGridCellWidth,
      height: icon.nativeScreenHeight ?? icon.height,
      width: icon.nativeScreenWidth ?? icon.width,
      x: icon.nativeScreenX ?? icon.x,
      y: icon.nativeScreenY ?? icon.y,
    };
  }

  return {
    ...icon,
    centerX: icon.dipCenterX ?? icon.centerX,
    centerY: icon.dipCenterY ?? icon.centerY,
    coordinateSpace: 'dip',
    desktopGridCellHeight: icon.desktopGridCellHeight,
    desktopGridCellWidth: icon.desktopGridCellWidth,
    height: icon.dipHeight ?? icon.height,
    width: icon.dipWidth ?? icon.width,
    x: icon.dipX ?? icon.x,
    y: icon.dipY ?? icon.y,
  };
}

function normalizeDesktopIconCoordinateSpaceOption(value) {
  return value === 'native-screen' ? 'native-screen' : 'dip';
}

function createDesktopIconGeometry(dependencies) {
  const screenToPetCoordinate = createScreenToPetConverter(dependencies);
  const petToScreenCoordinate = createPetToScreenConverter(dependencies);
  const attachDesktopIconCoordinateSpaces = createDesktopIconCoordinateAttacher({ screenToPetCoordinate });
  return { petToScreenCoordinate, attachDesktopIconCoordinateSpaces, selectDesktopIconCoordinateSpace, normalizeDesktopIconCoordinateSpaceOption };
}

module.exports = { createDesktopIconGeometry };
