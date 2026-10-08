const { createFocusExistingAppWindowScript } = require('./focusExistingAppWindowScript.cjs');

function createWindowFocusOperation({ buildFocusCandidates, runPowerShellScript }) {
  async function focusExistingAppWindow(query, selectedApp, options = {}) {
    if (process.platform !== 'win32') {
      return {
        ok: false,
        reason: 'focus-existing-window-only-supported-on-windows',
      };
    }

    const requestedPid = Number(options?.pid);
    const requestedHwnd = Number(options?.hwnd ?? options?.windowHandle);
    const hasPid = Number.isFinite(requestedPid) && requestedPid > 0;
    const hasHwnd = Number.isFinite(requestedHwnd) && requestedHwnd > 0;
    const focusCandidates = await buildFocusCandidates(query, selectedApp);
    if (!hasHwnd && !hasPid && !focusCandidates.processNames.length && !focusCandidates.titleQueries.length) {
      return {
        ok: false,
        reason: 'empty-focus-candidates',
      };
    }

    const script = createFocusExistingAppWindowScript({ focusCandidates, hasPid, requestedPid, hasHwnd, requestedHwnd });

    try {
      const stdout = await runPowerShellScript(script);
      const parsed = JSON.parse(String(stdout || '{}').trim() || '{}');
      return {
        hwnd: Number.isFinite(Number(parsed?.hwnd)) ? Math.round(Number(parsed.hwnd)) : undefined,
        ok: Boolean(parsed?.ok),
        pid: Number.isFinite(Number(parsed?.pid)) ? Math.round(Number(parsed.pid)) : undefined,
        processName: typeof parsed?.processName === 'string' ? parsed.processName : undefined,
        reason: typeof parsed?.reason === 'string' ? parsed.reason : undefined,
        title: typeof parsed?.title === 'string' ? parsed.title : undefined,
        foregroundHwnd: Number.isFinite(Number(parsed?.foregroundHwnd)) ? Math.round(Number(parsed.foregroundHwnd)) : undefined,
        foregroundMatchesTarget: typeof parsed?.foregroundMatchesTarget === 'boolean' ? parsed.foregroundMatchesTarget : undefined,
        focusStatus: typeof parsed?.focusStatus === 'string' ? parsed.focusStatus : undefined,
        focusRequestAccepted: typeof parsed?.focusRequestAccepted === 'boolean' ? parsed.focusRequestAccepted : undefined,
        focusAttempts: Number.isFinite(Number(parsed?.focusAttempts)) ? Math.round(Number(parsed.focusAttempts)) : undefined,
        targetAlive: typeof parsed?.targetAlive === 'boolean' ? parsed.targetAlive : undefined,
      };
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async function focusWindow(request = {}) {
    const query = String(request?.query || request?.target || request?.title || request?.processName || request?.name || '').trim();
    const requestedPid = Number(request?.pid);
    const requestedHwnd = Number(request?.hwnd || request?.windowHandle);
    const hasPid = Number.isFinite(requestedPid) && requestedPid > 0;
    const hasHwnd = Number.isFinite(requestedHwnd) && requestedHwnd > 0;
    if (!query && !hasPid && !hasHwnd) {
      return {
        ok: false,
        error: 'Window focus target is empty.',
        query,
      };
    }

    let result = null;
    let focusResolutionAttempts = 0;
    const retryDelays = [0, 300, 1000, 3000];
    for (const retryDelay of retryDelays) {
      if (retryDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
      focusResolutionAttempts += 1;
      result = await focusExistingAppWindow(query, null, {
        hwnd: hasHwnd ? Math.round(requestedHwnd) : 0,
        pid: hasPid ? Math.round(requestedPid) : 0,
      });
      if (!/no-window-match/iu.test(String(result?.reason || result?.error || ''))) {
        break;
      }
    }
    return {
      ...result,
      focusResolutionAttempts,
      focusResolutionRetried: focusResolutionAttempts > 1,
      hwnd: result?.hwnd ?? (hasHwnd ? Math.round(requestedHwnd) : undefined),
      pid: result?.pid ?? (hasPid ? Math.round(requestedPid) : undefined),
      query,
    };
  }
  return { focusExistingAppWindow, focusWindow };
}

module.exports = { createWindowFocusOperation };
