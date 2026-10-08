const { createControlWindowScript } = require('./controlWindowScript.cjs');

function createWindowControlOperation({ createMoveWindowNativeDisplayHint, runPowerShellScript, normalizeWindowMoveBounds, nativeScreenRectToDipRect, normalizeDisplayRect, findDisplayForBounds }) {
  function normalizeWindowControlState(value) {
    const text = String(value || '').trim().toLowerCase().replace(/[-\s]+/gu, '_');
    if (!text) {
      return '';
    }

    if (text === 'minimize' || text === 'minimized') {
      return 'minimized';
    }

    if (text === 'maximize' || text === 'maximized') {
      return 'maximized';
    }

    if (text === 'restore' || text === 'restored' || text === 'normal') {
      return 'normal';
    }

    return '';
  }

  function normalizeWindowControlSnap(value) {
    const text = String(value || '').trim().toLowerCase().replace(/[\s_]+/gu, '-');
    return [
      'left',
      'right',
      'top',
      'bottom',
      'top-left',
      'top-right',
      'bottom-left',
      'bottom-right',
      'center',
    ].includes(text)
      ? text
      : '';
  }

  function getFiniteRequestNumber(request, keys) {
    for (const key of keys) {
      const value = Number(request?.[key]);
      if (Number.isFinite(value)) {
        return Math.round(value);
      }
    }

    return null;
  }

  async function controlWindow(request = {}) {
    const query = String(request?.query || request?.target || request?.title || request?.processName || request?.name || '').trim();
    const requestedPid = Number(request?.pid);
    const requestedHwnd = Number(request?.hwnd || request?.windowHandle);
    const hasPid = Number.isFinite(requestedPid) && requestedPid > 0;
    const hasHwnd = Number.isFinite(requestedHwnd) && requestedHwnd > 0;
    const fallbackToActiveWindow = typeof request?.fallbackToActiveWindow === 'boolean'
      ? request.fallbackToActiveWindow
      : (!query && !hasPid && !hasHwnd);
    const targetHint = createMoveWindowNativeDisplayHint(request);
    const state = normalizeWindowControlState(request?.windowState || request?.state || request?.mode);
    const snap = normalizeWindowControlSnap(request?.snap || request?.snapPosition || request?.placement);
    const x = getFiniteRequestNumber(request, ['x', 'left']);
    const y = getFiniteRequestNumber(request, ['y', 'top']);
    const width = getFiniteRequestNumber(request, ['width', 'w']);
    const height = getFiniteRequestNumber(request, ['height', 'h']);
    const coordinateSpace = String(request?.coordinateSpace || '').trim().toLowerCase() === 'display'
      ? 'display'
      : 'native-screen';
    const hasBoundsChange = x !== null || y !== null || width !== null || height !== null;
    const hasDisplayTarget = Boolean(targetHint.requestedDisplay || targetHint.targetRole || targetHint.targetIndex || targetHint.targetDisplayText);
    const hasOperation = Boolean(state || snap || hasBoundsChange || hasDisplayTarget);

    if (!hasOperation) {
      return {
        ok: false,
        controlled: false,
        error: 'Window control operation is empty.',
        query,
      };
    }

    if (!query && !hasPid && !hasHwnd && !fallbackToActiveWindow) {
      return {
        ok: false,
        controlled: false,
        error: 'Window control query is empty.',
        query,
      };
    }

    if (process.platform !== 'win32') {
      return {
        ok: false,
        controlled: false,
        error: 'Window control is currently only implemented on Windows.',
        query,
      };
    }

    const payload = {
      coordinateSpace,
      fallbackToActiveWindow,
      height,
      hwnd: hasHwnd ? Math.round(requestedHwnd) : 0,
      pid: hasPid ? Math.round(requestedPid) : 0,
      query,
      snap,
      state,
      targetDisplayText: targetHint.targetDisplayText,
      targetIndex: targetHint.targetIndex,
      targetRole: targetHint.targetRole,
      width,
      x,
      y,
    };

    const script = createControlWindowScript({ payload });

    try {
      const stdout = await runPowerShellScript(script, 4200);
      const parsed = JSON.parse(String(stdout || '{}').trim() || '{}');
      const nativeFromBounds = normalizeWindowMoveBounds(parsed?.fromBounds);
      const nativeToBounds = normalizeWindowMoveBounds(parsed?.toBounds);
      const nativeTargetBounds = normalizeWindowMoveBounds(parsed?.targetBounds);
      const fromBounds = nativeScreenRectToDipRect(nativeFromBounds);
      const toBounds = nativeScreenRectToDipRect(nativeToBounds);
      const targetBounds = nativeScreenRectToDipRect(nativeTargetBounds);
      const fromDisplay = findDisplayForBounds(fromBounds);
      const toDisplay = findDisplayForBounds(toBounds);
      const targetDisplay = parsed?.targetDisplay && typeof parsed.targetDisplay === 'object'
        ? parsed.targetDisplay
        : null;
      const targetDisplayBounds = normalizeDisplayRect(targetDisplay?.bounds);
      const targetDisplayWorkArea = normalizeDisplayRect(targetDisplay?.workArea) || targetDisplayBounds;
      const targetDisplayDeviceName = typeof targetDisplay?.deviceName === 'string' ? targetDisplay.deviceName : '';

      return {
        ok: Boolean(parsed?.ok),
        controlled: Boolean(parsed?.controlled),
        stateChanged: Boolean(parsed?.stateChanged),
        boundsChanged: Boolean(parsed?.boundsChanged),
        requestedState: typeof parsed?.requestedState === 'string' ? parsed.requestedState : '',
        requestedSnap: typeof parsed?.requestedSnap === 'string' ? parsed.requestedSnap : '',
        beforeState: typeof parsed?.beforeState === 'string' ? parsed.beforeState : '',
        afterState: typeof parsed?.afterState === 'string' ? parsed.afterState : '',
        error: typeof parsed?.error === 'string' ? parsed.error : undefined,
        fromBounds,
        fromDisplayId: fromDisplay?.id ?? null,
        fromDisplayLabel: fromDisplay?.label ?? null,
        hwnd: Number.isFinite(Number(parsed?.hwnd)) ? Math.round(Number(parsed.hwnd)) : undefined,
        matchCount: Number.isFinite(Number(parsed?.matchCount)) ? Math.round(Number(parsed.matchCount)) : 0,
        matchReason: typeof parsed?.matchReason === 'string' ? parsed.matchReason : undefined,
        nativeCoordinateSpace: nativeToBounds || nativeTargetBounds ? 'native-screen' : null,
        nativeFromBounds,
        nativeTargetBounds,
        nativeToBounds,
        pid: Number.isFinite(Number(parsed?.pid)) ? Math.round(Number(parsed.pid)) : undefined,
        processName: typeof parsed?.processName === 'string' ? parsed.processName : undefined,
        query,
        reason: typeof parsed?.reason === 'string' ? parsed.reason : undefined,
        targetBounds,
        targetDisplay: targetDisplay ? {
          bounds: targetDisplayBounds,
          id: targetDisplayDeviceName,
          label: targetDisplayDeviceName || undefined,
          primary: Boolean(targetDisplay.primary),
          workArea: targetDisplayWorkArea,
        } : null,
        targetDisplayId: targetDisplayDeviceName,
        targetDisplayLabel: targetDisplayDeviceName || undefined,
        title: typeof parsed?.title === 'string' ? parsed.title : undefined,
        toBounds,
        toDisplayId: toDisplay?.id ?? null,
        toDisplayLabel: toDisplay?.label ?? null,
      };
    } catch (error) {
      return {
        ok: false,
        controlled: false,
        error: error instanceof Error ? error.message : String(error),
        query,
      };
    }
  }
  return { controlWindow };
}

module.exports = { createWindowControlOperation };
