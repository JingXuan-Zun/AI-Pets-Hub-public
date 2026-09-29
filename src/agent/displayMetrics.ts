export interface DisplayMetricSize {
  height: number;
  width: number;
}

export interface DisplayMetricRect extends DisplayMetricSize {
  x: number;
  y: number;
}

function normalizeNumber(value: unknown, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue)
    ? Math.round(numericValue)
    : fallback;
}

function normalizePositiveNumber(value: unknown, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0
    ? Math.round(numericValue)
    : fallback;
}

function normalizePositiveScale(value: unknown, fallback = 1) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0
    ? numericValue
    : fallback;
}

function useNativeSizeWhenClose(scaledSize: number, nativeSize: number) {
  return Math.abs(scaledSize - nativeSize) <= 2
    ? nativeSize
    : scaledSize;
}

export function getDisplayLogicalSize(display: DesktopPetDisplayLike): DisplayMetricSize {
  return {
    height: normalizePositiveNumber(display.height, 1),
    width: normalizePositiveNumber(display.width, 1),
  };
}

export function getDisplayWorkAreaSize(display: DesktopPetDisplayLike): DisplayMetricSize {
  const logicalSize = getDisplayLogicalSize(display);
  return {
    height: normalizePositiveNumber(display.workAreaHeight, logicalSize.height),
    width: normalizePositiveNumber(display.workAreaWidth, logicalSize.width),
  };
}

export function getDisplayPhysicalSize(display: DesktopPetDisplayLike): DisplayMetricSize {
  const logicalSize = getDisplayLogicalSize(display);
  const scaleFactor = normalizePositiveScale(display.scaleFactor);
  return {
    height: normalizePositiveNumber(display.nativeHeight, Math.round(logicalSize.height * scaleFactor)),
    width: normalizePositiveNumber(display.nativeWidth, Math.round(logicalSize.width * scaleFactor)),
  };
}

export function getDisplayPhysicalPosition(display: DesktopPetDisplayLike) {
  const scaleFactor = normalizePositiveScale(display.scaleFactor);
  return {
    x: normalizeNumber(display.nativeX, normalizeNumber(display.x) * scaleFactor),
    y: normalizeNumber(display.nativeY, normalizeNumber(display.y) * scaleFactor),
  };
}

export function getDisplayLogicalPosition(display: DesktopPetDisplayLike) {
  return {
    x: normalizeNumber(display.x),
    y: normalizeNumber(display.y),
  };
}

export function getDisplayDesktopIconCoordinateViewport(display: DesktopPetDisplayLike): DisplayMetricRect {
  const logicalPosition = getDisplayLogicalPosition(display);
  const physicalPosition = getDisplayPhysicalPosition(display);
  const physicalSize = getDisplayPhysicalSize(display);
  const workAreaSize = getDisplayWorkAreaSize(display);
  const scaleFactor = normalizePositiveScale(display.scaleFactor);
  const scaledWidth = Math.max(1, Math.round(workAreaSize.width * scaleFactor));
  const scaledHeight = Math.max(1, Math.round(workAreaSize.height * scaleFactor));
  const workAreaX = normalizeNumber(display.workAreaX, logicalPosition.x);
  const workAreaY = normalizeNumber(display.workAreaY, logicalPosition.y);

  return {
    height: useNativeSizeWhenClose(scaledHeight, physicalSize.height),
    width: useNativeSizeWhenClose(scaledWidth, physicalSize.width),
    x: Math.round(physicalPosition.x + (workAreaX - logicalPosition.x) * scaleFactor),
    y: Math.round(physicalPosition.y + (workAreaY - logicalPosition.y) * scaleFactor),
  };
}

export function formatDisplaySize(size: DisplayMetricSize) {
  return `${size.width} x ${size.height}`;
}

export function formatDisplayRect(rect: DisplayMetricRect) {
  return `${rect.width} x ${rect.height}，起点 (${rect.x}, ${rect.y})`;
}

export function formatDisplayResolutionSummary(display: DesktopPetDisplayLike) {
  const physicalSize = getDisplayPhysicalSize(display);
  const logicalSize = getDisplayLogicalSize(display);
  const workAreaSize = getDisplayWorkAreaSize(display);
  const scaleFactor = Number(display.scaleFactor);
  const scaleText = Number.isFinite(scaleFactor) && scaleFactor > 0
    ? `，缩放 ${scaleFactor}`
    : '';

  return [
    `物理分辨率 ${formatDisplaySize(physicalSize)}`,
    `逻辑区域 ${formatDisplaySize(logicalSize)}`,
    `工作区 ${formatDisplaySize(workAreaSize)}${scaleText}`,
  ].join('，');
}
