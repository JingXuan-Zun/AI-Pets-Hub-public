function getDisplayScaleFactor(display) {
  return Number.isFinite(display?.scaleFactor) && display.scaleFactor > 0
    ? display.scaleFactor
    : 1;
}

function createFallbackNativeDisplayBounds(bounds, scaleFactor) {
  return {
    x: Math.round(bounds.x * scaleFactor),
    y: Math.round(bounds.y * scaleFactor),
    width: Math.max(1, Math.round(bounds.width * scaleFactor)),
    height: Math.max(1, Math.round(bounds.height * scaleFactor)),
  };
}

function getNativeDisplayMatchScore(display, nativeDisplay) {
  const scaleFactor = Number.isFinite(display.scaleFactor) && display.scaleFactor > 0
    ? display.scaleFactor
    : 1;
  const scaledDisplay = {
    x: Math.round(display.x * scaleFactor),
    y: Math.round(display.y * scaleFactor),
    width: Math.round(display.width * scaleFactor),
    height: Math.round(display.height * scaleFactor),
  };
  const logicalDisplay = {
    x: Math.round(display.x),
    y: Math.round(display.y),
    width: Math.round(display.width),
    height: Math.round(display.height),
  };
  const logicalSizeScore = Math.abs(nativeDisplay.width - logicalDisplay.width)
    + Math.abs(nativeDisplay.height - logicalDisplay.height);
  const scaledSizeScore = Math.abs(nativeDisplay.width - scaledDisplay.width)
    + Math.abs(nativeDisplay.height - scaledDisplay.height);
  const logicalPositionScore = Math.abs(nativeDisplay.x - logicalDisplay.x)
    + Math.abs(nativeDisplay.y - logicalDisplay.y);
  const scaledPositionScore = Math.abs(nativeDisplay.x - scaledDisplay.x)
    + Math.abs(nativeDisplay.y - scaledDisplay.y);
  const primaryPenalty = display.isPrimary === nativeDisplay.isPrimary ? 0 : 100000;

  return primaryPenalty
    + Math.min(logicalSizeScore, scaledSizeScore) * 10
    + Math.min(logicalPositionScore, scaledPositionScore);
}

function resolveNativeDisplayBounds(display, nativeDisplays, usedNativeDisplayIndexes) {
  if (!Array.isArray(nativeDisplays) || !nativeDisplays.length) {
    return null;
  }

  let bestIndex = -1;
  let bestScore = Number.POSITIVE_INFINITY;
  nativeDisplays.forEach((nativeDisplay, index) => {
    if (usedNativeDisplayIndexes.has(index)) {
      return;
    }

    const score = getNativeDisplayMatchScore(display, nativeDisplay);
    if (score < bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  });

  if (bestIndex < 0) {
    return null;
  }

  usedNativeDisplayIndexes.add(bestIndex);
  return nativeDisplays[bestIndex];
}

function getAreaPickerContextSignature(context) {
  if (!context || !context.virtualBounds) {
    return '';
  }

  const displaySignature = Array.isArray(context.displays)
    ? context.displays.map((display) => [
        display.id,
        display.sourceId,
        display.x,
        display.y,
        display.width,
        display.height,
      ].join(':'))
      .join('|')
    : '';

  return [
    context.virtualBounds.x,
    context.virtualBounds.y,
    context.virtualBounds.width,
    context.virtualBounds.height,
    displaySignature,
  ].join('::');
}

module.exports = {
  getDisplayScaleFactor,
  createFallbackNativeDisplayBounds,
  getNativeDisplayMatchScore,
  resolveNativeDisplayBounds,
  getAreaPickerContextSignature,
};
