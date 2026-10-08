const { createInspectWindowUiScript } = require('./inspectWindowUiScript.cjs');
const { createInvokeWindowUiScript } = require('./invokeWindowUiScript.cjs');

function createWindowUiAutomation({ runPowerShellScript }) {
  async function inspectWindowUi(request = {}) {
    if (process.platform !== 'win32') {
      return {
        controls: [],
        error: 'Window UI inspection is currently only implemented on Windows.',
        matchedControls: [],
        ok: false,
        window: null,
      };
    }

    const query = String(request?.query || request?.target || request?.name || request?.title || request?.processName || '').trim();
    const targetText = String(request?.targetText || request?.text || request?.label || '').trim();
    const targetDescription = String(request?.targetDescription || request?.description || request?.element || '').trim();
    const rawHwnd = Number(request?.hwnd || request?.windowHandle || request?.handle || 0);
    const limit = Math.max(1, Math.min(200, Math.round(Number(request?.limit ?? 80))));
    const maxDepth = Math.max(1, Math.min(10, Math.round(Number(request?.maxDepth ?? 5))));
    const payloadBase64 = Buffer.from(JSON.stringify({
      hwnd: Number.isFinite(rawHwnd) ? Math.round(rawHwnd) : 0,
      limit,
      maxDepth,
      query,
      targetDescription,
      targetText,
    }), 'utf8').toString('base64');

    const script = createInspectWindowUiScript({ payloadBase64 });

    try {
      const stdout = await runPowerShellScript(script, 4500);
      const parsed = JSON.parse(String(stdout || '{}').trim() || '{}');
      return {
        controlCount: Number.isFinite(Number(parsed?.controlCount)) ? Math.round(Number(parsed.controlCount)) : 0,
        controls: Array.isArray(parsed?.controls) ? parsed.controls : [],
        error: typeof parsed?.error === 'string' ? parsed.error : undefined,
        matchedControls: Array.isArray(parsed?.matchedControls) ? parsed.matchedControls : [],
        ok: Boolean(parsed?.ok),
        query,
        targetDescription,
        targetText,
        window: parsed?.window ?? null,
      };
    } catch (error) {
      return {
        controls: [],
        error: error instanceof Error ? error.message : String(error),
        matchedControls: [],
        ok: false,
        query,
        targetDescription,
        targetText,
        window: null,
      };
    }
  }

  async function invokeWindowUi(request = {}) {
    if (process.platform !== 'win32') {
      return {
        control: null,
        error: 'Window UI invoke is currently only implemented on Windows.',
        invoked: false,
        ok: false,
        uiAction: 'invoke',
        window: null,
      };
    }

    const query = String(request?.query || request?.target || request?.title || request?.processName || '').trim();
    const targetText = String(request?.targetText || request?.text || request?.label || request?.name || '').trim();
    const targetDescription = String(request?.targetDescription || request?.description || request?.element || '').trim();
    const automationId = String(request?.automationId || request?.id || '').trim();
    const controlType = String(request?.controlType || request?.type || '').trim();
    const rawUiAction = String(request?.uiAction || request?.uiaAction || request?.controlAction || request?.pattern || 'invoke').trim().toLowerCase().replace(/[-\s]+/g, '_');
    const uiAction = {
      check: 'toggle',
      click: 'invoke',
      collapse_control: 'collapse',
      expand_control: 'expand',
      focus_control: 'focus',
      invoke_pattern: 'invoke',
      keyboard_focus: 'focus',
      select_item: 'select',
      set_focus: 'focus',
      set_text: 'set_value',
      set_value_pattern: 'set_value',
      uncheck: 'toggle',
      value: 'set_value',
    }[rawUiAction] || rawUiAction || 'invoke';
    const value = request?.value ?? request?.textValue ?? request?.inputValue ?? '';
    const rawHwnd = Number(request?.hwnd || request?.windowHandle || request?.handle || 0);
    const rawX = Number(request?.x ?? request?.centerX ?? request?.fallbackX);
    const rawY = Number(request?.y ?? request?.centerY ?? request?.fallbackY);
    if (!targetText && !automationId && (!Number.isFinite(rawX) || !Number.isFinite(rawY))) {
      return {
        candidates: [],
        control: null,
        error: 'Window UI invoke needs targetText, automationId, or a native-screen point.',
        invoked: false,
        ok: false,
        query,
        targetText,
        uiAction,
        window: null,
      };
    }

    const limit = Math.max(1, Math.min(250, Math.round(Number(request?.limit ?? 120))));
    const maxDepth = Math.max(1, Math.min(10, Math.round(Number(request?.maxDepth ?? 6))));
    const payloadBase64 = Buffer.from(JSON.stringify({
      automationId,
      controlType,
      hwnd: Number.isFinite(rawHwnd) ? Math.round(rawHwnd) : 0,
      limit,
      maxDepth,
      query,
      targetDescription,
      targetText,
      uiAction,
      value,
      x: Number.isFinite(rawX) ? Math.round(rawX) : null,
      y: Number.isFinite(rawY) ? Math.round(rawY) : null,
    }), 'utf8').toString('base64');

    const script = createInvokeWindowUiScript({ payloadBase64 });

    try {
      const stdout = await runPowerShellScript(script, 4500);
      const parsed = JSON.parse(String(stdout || '{}').trim() || '{}');
      return {
        candidates: Array.isArray(parsed?.candidates) ? parsed.candidates : [],
        control: parsed?.control ?? null,
        error: typeof parsed?.error === 'string' ? parsed.error : undefined,
        invoked: Boolean(parsed?.invoked),
        method: typeof parsed?.method === 'string' ? parsed.method : undefined,
        ok: Boolean(parsed?.ok),
        query,
        resolvedAction: typeof parsed?.resolvedAction === 'string' ? parsed.resolvedAction : undefined,
        targetText,
        uiAction,
        window: parsed?.window ?? null,
      };
    } catch (error) {
      return {
        candidates: [],
        control: null,
        error: error instanceof Error ? error.message : String(error),
        invoked: false,
        ok: false,
        query,
        resolvedAction: undefined,
        targetText,
        uiAction,
        window: null,
      };
    }
  }
  return { inspectWindowUi, invokeWindowUi };
}

module.exports = { createWindowUiAutomation };
