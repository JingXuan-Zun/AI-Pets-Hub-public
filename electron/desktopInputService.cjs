const { createDesktopInputExecutor } = require('./desktopInputExecution.cjs');
const { createMouseClickSendInput, createMouseClickFallback, createMouseClickCompletion } = require('./desktopInputMouseClick.cjs');
const { createMouseTouchInjection, createMouseTouchDiagnostics } = require('./desktopInputMouseTouch.cjs');
const { createMouseKeyboardFallback, createMouseResultDiagnostics } = require('./desktopInputMouseResult.cjs');
const { renderScriptFragments } = require('./desktopInputScriptFragments.cjs');
const { createMouseInputPreflight } = require('./desktopInputMousePreflight.cjs');
const { createMouseInputPositionCheck, createMouseInputPositionRecovery } = require('./desktopInputMousePosition.cjs');
const { prepareMouseInput } = require('./desktopInputMousePreparation.cjs');
const { createMoveMouseScript, createDragScript } = require('./desktopInputPointerScripts.cjs');
const { createTextScript, createSendKeysScript, createHotkeyScript } = require('./desktopInputKeyboardScripts.cjs');
const { createBaseInputPowerShell } = require('./desktopInputBaseScript.cjs');
const { createDesktopInputPowerShellRunner } = require('./desktopInputPowerShellRunner.cjs');
const { createDesktopInputCoordinateAdapter } = require('./desktopInputCoordinates.cjs');

const { execFile } = require('child_process');
const { mkdtempSync, rmSync, writeFileSync } = require('fs');
const { tmpdir } = require('os');
const { join } = require('path');

const DESKTOP_INPUT_TIMEOUT_MS = 5000;

const runPowerShellScript = createDesktopInputPowerShellRunner({
  Buffer, execFile, mkdtempSync, rmSync, writeFileSync, tmpdir, join, DESKTOP_INPUT_TIMEOUT_MS,
});

function createMouseEventScript(options) {
  const prepared = prepareMouseInput(options);
  if (!prepared) return null;

  return createBaseInputPowerShell(renderScriptFragments(String.raw,
    createMouseInputPreflight(options, prepared),
    createMouseInputPositionCheck(options, prepared),
    createMouseInputPositionRecovery(options, prepared),
    createMouseClickSendInput(prepared),
    createMouseClickFallback(prepared),
    createMouseTouchInjection(prepared),
    createMouseTouchDiagnostics(),
    createMouseClickCompletion(prepared),
    createMouseKeyboardFallback(prepared),
    createMouseResultDiagnostics(options, prepared),
  ));
}



function createDesktopInputScript(action, request) {
  switch (action) {
    case 'move_mouse':
      return createMoveMouseScript(request);
    case 'click':
    case 'double_click':
    case 'right_click':
      return createMouseEventScript({
        ...request,
        action,
        button: action === 'right_click' ? 'right' : request.button,
      });
    case 'drag':
      return createDragScript(request);
    case 'type_text':
      return createTextScript(request);
    case 'send_keys':
      return createSendKeysScript(request);
    case 'hotkey':
      return createHotkeyScript(request);
    default:
      return null;
  }
}

function createDesktopInputService({ log, screen } = {}) {
  const createNativeScreenInputRequest = createDesktopInputCoordinateAdapter({ log, screen });

  const executeDesktopInput = createDesktopInputExecutor({
    log, process, createNativeScreenInputRequest, createDesktopInputScript, runPowerShellScript, DESKTOP_INPUT_TIMEOUT_MS,
  });

  return {
    executeDesktopInput,
    _createNativeScreenInputRequest: createNativeScreenInputRequest,
  };
}

module.exports = {
  createDesktopInputService,
  _createDesktopInputScript: createDesktopInputScript,
};
