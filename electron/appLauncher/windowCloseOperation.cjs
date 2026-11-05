const { createCloseWindowScript } = require('./closeWindowScript.cjs');
const { resolveWindowQueryAliases } = require('./windowsAppChineseAliases.cjs');

function createWindowCloseOperation({ runPowerShellScript }) {
  async function closeWindow(request = {}) {
    const query = String(request?.query || request?.target || request?.title || request?.processName || request?.name || '').trim();
    const requestedPid = Number(request?.pid);
    const requestedHwnd = Number(request?.hwnd || request?.windowHandle);
    const hasPid = Number.isFinite(requestedPid) && requestedPid > 0;
    const hasHwnd = Number.isFinite(requestedHwnd) && requestedHwnd > 0;

    if (!query && !hasPid && !hasHwnd) {
      return {
        ok: false,
        closed: false,
        error: 'Window close query is empty.',
        query,
      };
    }

    if (process.platform !== 'win32') {
      return {
        ok: false,
        closed: false,
        error: 'Window closing is currently only implemented on Windows.',
        query,
      };
    }

    const run = async (text) => JSON.parse(String(await runPowerShellScript(createCloseWindowScript({ query: text, hasPid, requestedPid, hasHwnd, requestedHwnd }), 3600) || '{}').trim() || '{}');

    try {
      let parsed = await run(query);
      // “记事本” when the window is titled “… - Notepad”: try the app's English window name.
      for (const alias of resolveWindowQueryAliases(query)) {
        if (parsed?.closed || !/no-window-match/iu.test(String(parsed?.reason || parsed?.error || ''))) break;
        parsed = await run(alias);
      }
      return {
        ok: Boolean(parsed?.ok),
        closed: Boolean(parsed?.closed),
        error: typeof parsed?.error === 'string' ? parsed.error : undefined,
        hwnd: Number.isFinite(Number(parsed?.hwnd)) ? Math.round(Number(parsed.hwnd)) : undefined,
        matchCount: Number.isFinite(Number(parsed?.matchCount)) ? Math.round(Number(parsed.matchCount)) : 0,
        matchReason: typeof parsed?.matchReason === 'string' ? parsed.matchReason : undefined,
        pid: Number.isFinite(Number(parsed?.pid)) ? Math.round(Number(parsed.pid)) : undefined,
        processName: typeof parsed?.processName === 'string' ? parsed.processName : undefined,
        query,
        reason: typeof parsed?.reason === 'string' ? parsed.reason : undefined,
        stillProcessWindow: Boolean(parsed?.stillProcessWindow),
        stillWindow: Boolean(parsed?.stillWindow),
        title: typeof parsed?.title === 'string' ? parsed.title : undefined,
      };
    } catch (error) {
      return {
        ok: false,
        closed: false,
        error: error instanceof Error ? error.message : String(error),
        query,
      };
    }
  }
  return { closeWindow };
}

module.exports = { createWindowCloseOperation };
