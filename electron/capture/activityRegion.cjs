function clampAreaScale(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 55;
  }

  return Math.max(30, Math.min(100, Math.round(numericValue)));
}

function getTargetDisplay({ screen }, activityRegionConfig) {
  if (activityRegionConfig.displayId !== 'primary') {
    const matchedDisplay = screen.getAllDisplays().find(
      (display) => String(display.id) === String(activityRegionConfig.displayId),
    );
    if (matchedDisplay) {
      return matchedDisplay;
    }
  }

  return screen.getPrimaryDisplay();
}

function updateActivityRegion(activityRegionConfig, config) {
    const previousDisplayId = activityRegionConfig.displayId;

    if (config && typeof config === 'object') {
      if (typeof config.displayId === 'string' && config.displayId.trim()) {
        activityRegionConfig.displayId = config.displayId;
      }

      if (typeof config.areaScale !== 'undefined') {
        activityRegionConfig.areaScale = clampAreaScale(config.areaScale);
      }
    }

    return {
      didDisplayChange: activityRegionConfig.displayId !== previousDisplayId,
      config: { ...activityRegionConfig },
    };
  }

function createCaptureActivityRegion(dependencies) {
  const config = { displayId: 'primary', areaScale: 55 };
  return {
    clampAreaScale: clampAreaScale.bind(null),
    getTargetDisplay: getTargetDisplay.bind(null, dependencies, config),
    updateActivityRegion: updateActivityRegion.bind(null, config),
  };
}

module.exports = { createCaptureActivityRegion };
