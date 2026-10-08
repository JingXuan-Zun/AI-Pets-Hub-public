const { normalizeNumber, normalizeDesktopInputCoordinateSpace } = require('./desktopInputRules.cjs');

function convertDipPointToNativeScreenPoint({ log, screen }, point) {
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
          x: Math.round(convertedPoint.x),
          y: Math.round(convertedPoint.y),
        };
      }
    } catch (error) {
      log?.('desktop input coordinate conversion failed', error?.stack || error);
    }
  }

  return {
    x: Math.round(point.x),
    y: Math.round(point.y),
  };
}

function resolveInputNativeScreenPoint({ convertDipPointToNativeScreenPoint }, request, xKeys, yKeys) {
  let x = null;
  let y = null;
  for (const key of xKeys) {
    const value = normalizeNumber(request?.[key]);
    if (value !== null) {
      x = value;
      break;
    }
  }
  for (const key of yKeys) {
    const value = normalizeNumber(request?.[key]);
    if (value !== null) {
      y = value;
      break;
    }
  }
  if (x === null || y === null) {
    return null;
  }

  if (normalizeDesktopInputCoordinateSpace(request?.coordinateSpace) === 'native-screen') {
    return { x, y };
  }

  return convertDipPointToNativeScreenPoint({ x, y });
}

function createNativeScreenInputRequest({ resolveInputNativeScreenPoint }, action, request) {
  const nextRequest = {
    ...request,
    coordinateSpace: 'native-screen',
  };
  if (action === 'drag') {
    const fromPoint = resolveInputNativeScreenPoint(
      request,
      ['fromX', 'x', 'fromNativeScreenX', 'nativeScreenX'],
      ['fromY', 'y', 'fromNativeScreenY', 'nativeScreenY'],
    );
    const toPoint = resolveInputNativeScreenPoint(
      request,
      ['toX', 'targetX', 'endX', 'toNativeScreenX'],
      ['toY', 'targetY', 'endY', 'toNativeScreenY'],
    );
    if (!fromPoint || !toPoint) {
      return nextRequest;
    }

    return {
      ...nextRequest,
      fromNativeScreenX: fromPoint.x,
      fromNativeScreenY: fromPoint.y,
      toNativeScreenX: toPoint.x,
      toNativeScreenY: toPoint.y,
    };
  }

  const point = resolveInputNativeScreenPoint(
    request,
    ['x', 'nativeScreenX'],
    ['y', 'nativeScreenY'],
  );
  return point
    ? {
        ...nextRequest,
        nativeScreenX: point.x,
        nativeScreenY: point.y,
      }
    : nextRequest;
}

function createDesktopInputCoordinateAdapter(dependencies) {
  const convert = convertDipPointToNativeScreenPoint.bind(null, dependencies);
  const resolve = resolveInputNativeScreenPoint.bind(null, { convertDipPointToNativeScreenPoint: convert });
  return createNativeScreenInputRequest.bind(null, { resolveInputNativeScreenPoint: resolve });
}

module.exports = { createDesktopInputCoordinateAdapter };
