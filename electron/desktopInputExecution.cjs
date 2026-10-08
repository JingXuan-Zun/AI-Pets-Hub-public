const { normalizeDesktopInputAction } = require('./desktopInputRules.cjs');

async function executeDesktopInput(dependencies, request = {}) {
  const { log, process, createNativeScreenInputRequest, createDesktopInputScript, runPowerShellScript, DESKTOP_INPUT_TIMEOUT_MS } = dependencies;
  const action = normalizeDesktopInputAction(request?.action ?? request?.inputAction ?? request?.operation);
  if (!action) {
    return {
      ok: false,
      error: 'Unsupported desktop input action.',
      supportedActions: ['move_mouse', 'click', 'double_click', 'right_click', 'type_text', 'send_keys', 'hotkey', 'drag'],
    };
  }

  if (process.platform !== 'win32') {
    return {
      ok: false,
      action,
      error: 'Desktop input primitives are currently only implemented on Windows.',
    };
  }

  const nativeScreenRequest = createNativeScreenInputRequest(action, request);
  const script = createDesktopInputScript(action, nativeScreenRequest);
  if (!script) {
    return {
      ok: false,
      action,
      error: 'Missing or invalid desktop input parameters.',
    };
  }

  try {
    const stdout = await runPowerShellScript(script, DESKTOP_INPUT_TIMEOUT_MS);
    const parsed = JSON.parse(String(stdout || '{}').trim() || '{}');
    log?.('desktop input executed', {
      action,
      coordinateSpace: 'native-screen',
      ok: Boolean(parsed?.ok),
    });
    return {
      ...parsed,
      action,
      ok: Boolean(parsed?.ok),
    };
  } catch (error) {
    return {
      ok: false,
      action,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function createDesktopInputExecutor(dependencies) {
  return executeDesktopInput.bind(null, dependencies);
}

module.exports = { createDesktopInputExecutor };
