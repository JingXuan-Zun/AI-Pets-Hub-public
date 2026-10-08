const { normalizeSearchText } = require('./appSearchMatching.cjs');

function createWindowMoveGeometry({ getDisplaySnapshots }) {
  function normalizeDisplayRect(rect) {
    const x = Number(rect?.x);
    const y = Number(rect?.y);
    const width = Number(rect?.width);
    const height = Number(rect?.height);
    if (
      !Number.isFinite(x)
      || !Number.isFinite(y)
      || !Number.isFinite(width)
      || !Number.isFinite(height)
      || width <= 0
      || height <= 0
    ) {
      return null;
    }

    return {
      height: Math.round(height),
      width: Math.round(width),
      x: Math.round(x),
      y: Math.round(y),
    };
  }

  function getDisplayResultSummary(display) {
    if (!display) {
      return null;
    }

    return {
      bounds: normalizeDisplayRect(display.bounds),
      id: display.id,
      index: display.index,
      label: display.label,
      primary: display.primary,
      scaleFactor: display.scaleFactor,
      workArea: normalizeDisplayRect(display.workArea) || normalizeDisplayRect(display.bounds),
    };
  }

  function resolveMoveWindowTargetDisplay(request = {}) {
    const displays = getDisplaySnapshots();
    const requestedDisplayId = String(request?.displayId || request?.targetDisplayId || request?.screenId || '').trim();
    const requestedDisplay = String(
      request?.targetDisplay
      || request?.display
      || request?.displayTarget
      || request?.screen
      || request?.screenTarget
      || '',
    ).trim();
    const normalizedTarget = normalizeSearchText(requestedDisplay);
    const normalizedDisplayId = requestedDisplayId.toLowerCase();

    if (displays.length === 0) {
      return {
        display: null,
        displays,
        reason: 'no-display-snapshots',
      };
    }

    if (requestedDisplayId) {
      const byId = displays.find((display) => String(display.id).toLowerCase() === normalizedDisplayId);
      if (byId) {
        return { display: byId, displays, reason: 'display-id' };
      }
    }

    if (!requestedDisplay) {
      return {
        display: null,
        displays,
        reason: 'missing-target-display',
      };
    }

    if (normalizedTarget === 'primary' || normalizedTarget === normalizeSearchText('\u4e3b\u5c4f')) {
      return {
        display: displays.find((display) => display.primary) || displays[0],
        displays,
        reason: 'primary',
      };
    }

    if (
      normalizedTarget === 'secondary'
      || normalizedTarget === 'second'
      || normalizedTarget === 'external'
      || normalizedTarget === normalizeSearchText('\u526f\u5c4f')
      || normalizedTarget === normalizeSearchText('\u7b2c\u4e8c\u5c4f')
      || normalizedTarget === normalizeSearchText('\u5176\u4ed6\u5c4f')
    ) {
      return {
        display: displays.find((display) => !display.primary) || null,
        displays,
        reason: 'secondary',
      };
    }

    const numericIndex = Number(requestedDisplay);
    if (Number.isInteger(numericIndex) && numericIndex > 0) {
      const byOneBasedIndex = displays.find((display) => display.index === numericIndex - 1);
      if (byOneBasedIndex) {
        return { display: byOneBasedIndex, displays, reason: 'display-index' };
      }
    }

    const byText = displays.find((display) => {
      const idText = normalizeSearchText(display.id);
      const labelText = normalizeSearchText(display.label);
      const indexText = normalizeSearchText(`display${display.index + 1}`);
      return Boolean(
        normalizedTarget
        && (
          idText === normalizedTarget
          || labelText === normalizedTarget
          || labelText.includes(normalizedTarget)
          || normalizedTarget.includes(labelText)
          || indexText === normalizedTarget
        ),
      );
    });

    return {
      display: byText || null,
      displays,
      reason: byText ? 'display-text-match' : 'display-not-found',
    };
  }

  function normalizeWindowMoveBounds(bounds) {
    const rect = normalizeDisplayRect(bounds);
    return rect && rect.width > 0 && rect.height > 0 ? rect : null;
  }

  function createMoveWindowNativeDisplayHint(request = {}) {
    const requestedDisplayId = String(request?.displayId || request?.targetDisplayId || request?.screenId || '').trim();
    const requestedDisplay = String(
      request?.targetDisplay
      || request?.display
      || request?.displayTarget
      || request?.screen
      || request?.screenTarget
      || '',
    ).trim();
    const normalizedTarget = normalizeSearchText(requestedDisplay || requestedDisplayId);
    const numericIndex = Number(requestedDisplay);
    let targetIndex = Number.isInteger(numericIndex) && numericIndex > 0 ? numericIndex : 0;
    let targetRole = '';

    if (normalizedTarget === 'primary' || normalizedTarget === normalizeSearchText('\u4e3b\u5c4f')) {
      targetRole = 'primary';
    } else if (
      normalizedTarget === 'secondary'
      || normalizedTarget === 'second'
      || normalizedTarget === 'external'
      || normalizedTarget === normalizeSearchText('\u526f\u5c4f')
      || normalizedTarget === normalizeSearchText('\u7b2c\u4e8c\u5c4f')
      || normalizedTarget === normalizeSearchText('\u5176\u4ed6\u5c4f')
    ) {
      targetRole = 'secondary';
    }

    if (!targetRole && !targetIndex) {
      const resolvedTarget = resolveMoveWindowTargetDisplay(request);
      if (resolvedTarget.display) {
        if (resolvedTarget.display.primary) {
          targetRole = 'primary';
        } else if (resolvedTarget.displays.filter((display) => !display.primary).length === 1) {
          targetRole = 'secondary';
        } else {
          targetIndex = resolvedTarget.display.index + 1;
        }
      }
    }

    return {
      requestedDisplay: requestedDisplay || requestedDisplayId,
      targetDisplayText: targetRole || targetIndex ? '' : (requestedDisplay || requestedDisplayId),
      targetIndex,
      targetRole,
    };
  }
  return { normalizeDisplayRect, getDisplayResultSummary, resolveMoveWindowTargetDisplay, normalizeWindowMoveBounds, createMoveWindowNativeDisplayHint };
}

module.exports = { createWindowMoveGeometry };
