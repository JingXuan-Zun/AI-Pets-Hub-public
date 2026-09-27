import { PetConfig } from './types';

export const MIN_ACTIVITY_AREA_SCALE = 30;
export const MAX_ACTIVITY_AREA_SCALE = 100;
export const MAX_ACTIVITY_AREA_WIDTH = 7680;
export const MAX_ACTIVITY_AREA_HEIGHT = 4320;

export function clampActivityAreaScale(value: number) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 55;
  }

  return Math.max(MIN_ACTIVITY_AREA_SCALE, Math.min(MAX_ACTIVITY_AREA_SCALE, Math.round(numericValue)));
}

export function clampActivityAreaDimension(value: number, maxValue: number) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(0, Math.min(maxValue, Math.round(numericValue)));
}

export function deriveActivityAreaScaleFromSize(
  width: number,
  height: number,
  referenceWidth: number,
  referenceHeight: number,
) {
  if (width <= 0 || height <= 0 || referenceWidth <= 0 || referenceHeight <= 0) {
    return MIN_ACTIVITY_AREA_SCALE;
  }

  const areaRatio = (width * height) / (referenceWidth * referenceHeight);
  return clampActivityAreaScale(Math.sqrt(areaRatio) * 100);
}

export function resolveActivityAreaSize(
  referenceWidth: number,
  referenceHeight: number,
  settings: PetConfig['settings'],
) {
  const safeReferenceWidth = Math.max(1, Math.round(referenceWidth));
  const safeReferenceHeight = Math.max(1, Math.round(referenceHeight));
  const scale = clampActivityAreaScale(settings.activityAreaScale) / 100;
  const fallbackWidth = Math.max(1, Math.round(safeReferenceWidth * scale));
  const fallbackHeight = Math.max(1, Math.round(safeReferenceHeight * scale));
  const manualWidth = settings.activityAreaManual
    ? clampActivityAreaDimension(settings.activityAreaWidth, MAX_ACTIVITY_AREA_WIDTH)
    : 0;
  const manualHeight = settings.activityAreaManual
    ? clampActivityAreaDimension(settings.activityAreaHeight, MAX_ACTIVITY_AREA_HEIGHT)
    : 0;

  const resolvedWidth = settings.activityAreaManual && manualWidth > 0 ? manualWidth : fallbackWidth;
  const resolvedHeight = settings.activityAreaManual && manualHeight > 0 ? manualHeight : fallbackHeight;

  return {
    width: Math.max(1, Math.min(MAX_ACTIVITY_AREA_WIDTH, resolvedWidth)),
    height: Math.max(1, Math.min(MAX_ACTIVITY_AREA_HEIGHT, resolvedHeight)),
  };
}
