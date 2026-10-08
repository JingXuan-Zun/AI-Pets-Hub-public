const path = require('path');
const { isBrowserCategoryQuery, uniqueCaseInsensitive } = require('./appSearchMatching.cjs');
const { getDetectedBrowserCandidates } = require('../browserSearchService.cjs');
const { createMoveWindowToDisplayScript } = require('./moveWindowToDisplayScript.cjs');

function createWindowMoveOperation({ createMoveWindowNativeDisplayHint, runPowerShellScript, normalizeWindowMoveBounds, nativeScreenRectToDipRect, normalizeDisplayRect, findDisplayForBounds }) {
  async function moveWindowToDisplay(request = {}) {
    const query = String(request?.query || request?.target || request?.title || request?.processName || request?.name || '').trim();
    const rawQueryCandidates = Array.isArray(request?.queryCandidates)
      ? request.queryCandidates
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 8)
      : [];
    const browserCategoryQueryRequested = rawQueryCandidates.some(isBrowserCategoryQuery)
      || isBrowserCategoryQuery(query);
    const browserQueryCandidates = browserCategoryQueryRequested
      ? getDetectedBrowserCandidates()
        .flatMap((candidate) => [
          candidate.browserLabel,
          candidate.path ? path.basename(candidate.path, path.extname(candidate.path)) : '',
        ])
        .filter(Boolean)
      : [];
    const queryCandidates = uniqueCaseInsensitive([
      ...rawQueryCandidates,
      ...browserQueryCandidates,
    ]).slice(0, 12);
    const requestedPid = Number(request?.pid);
    const requestedHwnd = Number(request?.hwnd || request?.windowHandle);
    const hasPid = Number.isFinite(requestedPid) && requestedPid > 0;
    const hasHwnd = Number.isFinite(requestedHwnd) && requestedHwnd > 0;
    const targetHint = createMoveWindowNativeDisplayHint(request);
    const position = String(request?.position || request?.placement || 'center').trim().toLowerCase() === 'top-left'
      ? 'top-left'
      : 'center';
    const preserveSize = request?.preserveSize !== false;
    const fallbackToActiveWindow = request?.fallbackToActiveWindow !== false;

    if (!query && !queryCandidates.length && !hasPid && !hasHwnd) {
      return {
        ok: false,
        moved: false,
        error: 'Window move query is empty.',
        query,
      };
    }

    if (!targetHint.requestedDisplay && !targetHint.targetRole && !targetHint.targetIndex && !targetHint.targetDisplayText) {
      return {
        ok: false,
        moved: false,
        error: 'Target display is empty.',
        query,
        reason: 'missing-target-display',
      };
    }

    if (process.platform !== 'win32') {
      return {
        ok: false,
        moved: false,
        error: 'Window moving is currently only implemented on Windows.',
        query,
      };
    }

    const payload = {
      hwnd: hasHwnd ? Math.round(requestedHwnd) : 0,
      pid: hasPid ? Math.round(requestedPid) : 0,
      fallbackToActiveWindow,
      position,
      preserveSize,
      query,
      queryCandidates,
      targetDisplayText: targetHint.targetDisplayText,
      targetIndex: targetHint.targetIndex,
      targetRole: targetHint.targetRole,
    };
    const script = createMoveWindowToDisplayScript({ payload });

    try {
      const stdout = await runPowerShellScript(script, 4200);
      const parsed = JSON.parse(String(stdout || '{}').trim() || '{}');
      const nativeFromBounds = normalizeWindowMoveBounds(parsed?.fromBounds);
      const nativeToBounds = normalizeWindowMoveBounds(parsed?.toBounds);
      const fromBounds = nativeScreenRectToDipRect(nativeFromBounds);
      const toBounds = nativeScreenRectToDipRect(nativeToBounds);
      const fromDisplay = findDisplayForBounds(fromBounds);
      const toDisplay = findDisplayForBounds(toBounds);
      const targetDisplay = parsed?.targetDisplay && typeof parsed.targetDisplay === 'object'
        ? parsed.targetDisplay
        : null;
      const targetDisplayBounds = normalizeDisplayRect(targetDisplay?.bounds);
      const targetDisplayWorkArea = normalizeDisplayRect(targetDisplay?.workArea) || targetDisplayBounds;
      const targetDisplayDeviceName = typeof targetDisplay?.deviceName === 'string' ? targetDisplay.deviceName : '';
      const verified = Boolean(parsed?.verified);

      return {
        ok: Boolean(parsed?.ok),
        moved: Boolean(parsed?.moved),
        verified,
        wasMaximized: Boolean(parsed?.wasMaximized),
        maximizedRestored: Boolean(parsed?.maximizedRestored),
        error: typeof parsed?.error === 'string' ? parsed.error : undefined,
        fromBounds,
        fromDisplayId: fromDisplay?.id ?? null,
        fromDisplayLabel: fromDisplay?.label ?? null,
        hwnd: Number.isFinite(Number(parsed?.hwnd)) ? Math.round(Number(parsed.hwnd)) : undefined,
        matchCount: Number.isFinite(Number(parsed?.matchCount)) ? Math.round(Number(parsed.matchCount)) : 0,
        matchReason: typeof parsed?.matchReason === 'string' ? parsed.matchReason : undefined,
        nativeCoordinateSpace: nativeToBounds ? 'native-screen' : null,
        nativeFromBounds,
        nativeToBounds,
        pid: Number.isFinite(Number(parsed?.pid)) ? Math.round(Number(parsed.pid)) : undefined,
        processName: typeof parsed?.processName === 'string' ? parsed.processName : undefined,
        query,
        queryCandidates: Array.isArray(parsed?.queryCandidates)
          ? parsed.queryCandidates.filter((item) => typeof item === 'string')
          : queryCandidates,
        reason: typeof parsed?.reason === 'string' ? parsed.reason : undefined,
        retryMoveAttempted: Boolean(parsed?.retryMoveAttempted),
        targetDisplay: targetDisplay ? {
          bounds: targetDisplayBounds,
          id: targetDisplayDeviceName,
          label: targetDisplayDeviceName || undefined,
          primary: Boolean(targetDisplay.primary),
          workArea: targetDisplayWorkArea,
        } : null,
        targetDisplayId: targetDisplayDeviceName,
        targetDisplayLabel: targetDisplayDeviceName || undefined,
        toBounds,
        toDisplayId: toDisplay?.id ?? null,
        toDisplayLabel: toDisplay?.label ?? null,
        title: typeof parsed?.title === 'string' ? parsed.title : undefined,
      };
    } catch (error) {
      return {
        ok: false,
        moved: false,
        error: error instanceof Error ? error.message : String(error),
        query,
      };
    }
  }
  return { moveWindowToDisplay };
}

module.exports = { createWindowMoveOperation };
