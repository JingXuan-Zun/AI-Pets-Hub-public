import {
  MAX_ACTIVITY_AREA_HEIGHT,
  MAX_ACTIVITY_AREA_WIDTH,
  clampActivityAreaDimension,
  clampActivityAreaScale,
  deriveActivityAreaScaleFromSize,
  resolveActivityAreaSize,
} from '../../activityArea';
import { type PetConfig } from '../../types';
import { getDisplayPixelSize } from './settingsPanelLayout';
import { type ActivityDisplayOption } from './vision/types';

interface UseSettingsPanelActivityStateOptions {
  applyConfig: (newConfig: PetConfig) => void;
  availableDisplays: DesktopPetDisplayLike[];
  localConfig: PetConfig;
}

function formatDisplaySelectionLabel(
  displayId: PetConfig['settings']['activityDisplayId'] | PetConfig['settings']['interactiveDialogueDisplayId'],
  display: DesktopPetDisplayLike | null,
) {
  if (displayId === 'activity') {
    return '跟随活动屏';
  }

  if (displayId === 'primary') {
    return '主屏';
  }

  return display ? `屏幕 ${display.id}` : `屏幕 ${displayId}`;
}

export function useSettingsPanelActivityState({
  applyConfig,
  availableDisplays,
  localConfig,
}: UseSettingsPanelActivityStateOptions) {
  const activityAreaScale = Math.max(30, Math.min(100, localConfig.settings.activityAreaScale));
  const primaryDisplay = availableDisplays.find((display) => display.isPrimary) ?? availableDisplays[0] ?? null;
  const selectedDisplay =
    localConfig.settings.activityDisplayId === 'primary'
      ? primaryDisplay
      : availableDisplays.find((display) => display.id === localConfig.settings.activityDisplayId)
        ?? primaryDisplay
        ?? availableDisplays[0]
        ?? null;
  const interactiveDialogueDisplay =
    localConfig.settings.interactiveDialogueDisplayId === 'activity'
      ? selectedDisplay
      : localConfig.settings.interactiveDialogueDisplayId === 'primary'
        ? primaryDisplay
        : availableDisplays.find((display) => display.id === localConfig.settings.interactiveDialogueDisplayId)
          ?? primaryDisplay
          ?? availableDisplays[0]
          ?? null;
  const selectedDisplayPixels = getDisplayPixelSize(selectedDisplay);
  const selectedDisplayPixelWidth = selectedDisplayPixels.width;
  const selectedDisplayPixelHeight = selectedDisplayPixels.height;
  const activityDisplayOptions: ActivityDisplayOption[] = [
    {
      value: 'primary' as PetConfig['settings']['activityDisplayId'],
      tag: '主屏',
      title: primaryDisplay?.label || '主显示器',
      ...getDisplayPixelSize(primaryDisplay),
    },
    ...availableDisplays
      .filter((display) => !display.isPrimary)
      .map((display) => ({
        value: display.id as PetConfig['settings']['activityDisplayId'],
        tag: `屏幕 ${display.id}`,
        title: display.label || `显示器 ${display.id}`,
        ...getDisplayPixelSize(display),
      })),
  ];
  const interactiveDialogueDisplayOptions: ActivityDisplayOption[] = [
    {
      value: 'activity' as PetConfig['settings']['interactiveDialogueDisplayId'],
      tag: '跟随',
      title: '跟随活动屏幕',
      ...getDisplayPixelSize(selectedDisplay),
    },
    {
      value: 'primary' as PetConfig['settings']['interactiveDialogueDisplayId'],
      tag: '主屏',
      title: primaryDisplay?.label || '主显示器',
      ...getDisplayPixelSize(primaryDisplay),
    },
    ...availableDisplays
      .filter((display) => !display.isPrimary)
      .map((display) => ({
        value: display.id as PetConfig['settings']['interactiveDialogueDisplayId'],
        tag: `屏幕 ${display.id}`,
        title: display.label || `显示器 ${display.id}`,
        ...getDisplayPixelSize(display),
      })),
  ];
  const currentActivityDisplayLabel = formatDisplaySelectionLabel(
    localConfig.settings.activityDisplayId,
    selectedDisplay,
  );
  const currentInteractiveDialogueDisplayLabel = formatDisplaySelectionLabel(
    localConfig.settings.interactiveDialogueDisplayId,
    interactiveDialogueDisplay,
  );
  const virtualDisplayPreview = availableDisplays.length
    ? (() => {
      const left = Math.min(...availableDisplays.map((display) => display.x));
      const top = Math.min(...availableDisplays.map((display) => display.y));
      const right = Math.max(...availableDisplays.map((display) => display.x + display.width));
      const bottom = Math.max(...availableDisplays.map((display) => display.y + display.height));

      return {
        width: Math.max(1, Math.round(right - left)),
        height: Math.max(1, Math.round(bottom - top)),
      };
    })()
    : (selectedDisplay
      ? {
        width: Math.max(1, Math.round(selectedDisplay.width)),
        height: Math.max(1, Math.round(selectedDisplay.height)),
      }
      : null);
  const activityAreaPreview = localConfig.settings.activityAreaLimitEnabled
    ? (selectedDisplay
      ? resolveActivityAreaSize(selectedDisplayPixelWidth, selectedDisplayPixelHeight, localConfig.settings)
      : null)
    : virtualDisplayPreview;
  const activityAreaWidthValue = activityAreaPreview?.width ?? localConfig.settings.activityAreaWidth;
  const activityAreaHeightValue = activityAreaPreview?.height ?? localConfig.settings.activityAreaHeight;

  const updateActivityDisplay = (activityDisplayId: PetConfig['settings']['activityDisplayId']) => {
    applyConfig({
      ...localConfig,
      settings: {
        ...localConfig.settings,
        activityDisplayId,
      },
    });
  };

  const updateInteractiveDialogueDisplay = (
    interactiveDialogueDisplayId: PetConfig['settings']['interactiveDialogueDisplayId'],
  ) => {
    applyConfig({
      ...localConfig,
      settings: {
        ...localConfig.settings,
        interactiveDialogueDisplayId,
      },
    });
  };

  const updateActivityAreaScale = (value: number | number[]) => {
    const nextScale = clampActivityAreaScale(Array.isArray(value) ? value[0] : value);
    const referenceWidth = selectedDisplayPixelWidth;
    const referenceHeight = selectedDisplayPixelHeight;
    const nextWidth = referenceWidth > 0
      ? Math.round((referenceWidth * nextScale) / 100)
      : localConfig.settings.activityAreaWidth;
    const nextHeight = referenceHeight > 0
      ? Math.round((referenceHeight * nextScale) / 100)
      : localConfig.settings.activityAreaHeight;

    applyConfig({
      ...localConfig,
      settings: {
        ...localConfig.settings,
        activityAreaScale: nextScale,
        activityAreaManual: false,
        activityAreaWidth: nextWidth,
        activityAreaHeight: nextHeight,
      },
    });
  };

  const updateActivityAreaDimension = (dimension: 'width' | 'height', value: string) => {
    const parsedValue = Number(value);
    if (!Number.isFinite(parsedValue)) {
      return;
    }

    const clampedValue = clampActivityAreaDimension(
      parsedValue,
      dimension === 'width' ? MAX_ACTIVITY_AREA_WIDTH : MAX_ACTIVITY_AREA_HEIGHT,
    );
    const nextWidth = dimension === 'width'
      ? clampedValue
      : (activityAreaPreview?.width ?? localConfig.settings.activityAreaWidth);
    const nextHeight = dimension === 'height'
      ? clampedValue
      : (activityAreaPreview?.height ?? localConfig.settings.activityAreaHeight);

    applyConfig({
      ...localConfig,
      settings: {
        ...localConfig.settings,
        activityAreaManual: true,
        activityAreaWidth: nextWidth,
        activityAreaHeight: nextHeight,
        activityAreaScale: selectedDisplay
          ? deriveActivityAreaScaleFromSize(
            nextWidth,
            nextHeight,
            selectedDisplayPixelWidth,
            selectedDisplayPixelHeight,
          )
          : localConfig.settings.activityAreaScale,
      },
    });
  };

  const restoreActivityAreaAuto = () => {
    const referenceWidth = selectedDisplayPixelWidth;
    const referenceHeight = selectedDisplayPixelHeight;
    const nextWidth = referenceWidth > 0 ? Math.round((referenceWidth * activityAreaScale) / 100) : 0;
    const nextHeight = referenceHeight > 0 ? Math.round((referenceHeight * activityAreaScale) / 100) : 0;

    applyConfig({
      ...localConfig,
      settings: {
        ...localConfig.settings,
        activityAreaManual: false,
        activityAreaWidth: nextWidth,
        activityAreaHeight: nextHeight,
      },
    });
  };

  return {
    activityAreaHeightValue,
    activityAreaPreview,
    activityAreaScale,
    activityAreaWidthValue,
    activityDisplayOptions,
    currentActivityDisplayLabel,
    currentInteractiveDialogueDisplayLabel,
    interactiveDialogueDisplayOptions,
    restoreActivityAreaAuto,
    selectedDisplay,
    selectedDisplayPixelHeight,
    selectedDisplayPixelWidth,
    updateActivityAreaDimension,
    updateActivityAreaScale,
    updateActivityDisplay,
    updateInteractiveDialogueDisplay,
  };
}
