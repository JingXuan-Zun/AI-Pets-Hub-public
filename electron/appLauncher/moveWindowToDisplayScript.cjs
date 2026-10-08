const { windowMoveNativeInteropScript } = require('./windowMoveNativeInteropScript.cjs');
const { windowMoveMatchingScript } = require('./windowMoveMatchingScript.cjs');
const { windowMovePlacementScript } = require('./windowMovePlacementScript.cjs');
const { windowMoveVerificationScript } = require('./windowMoveVerificationScript.cjs');

function createMoveWindowToDisplayScript({ payload }) {
  return [
    String.raw`
$ErrorActionPreference = 'Stop'
$payload = @'
`,
    String.raw`${JSON.stringify(payload)}`,
    windowMoveNativeInteropScript,
    windowMoveMatchingScript,
    windowMovePlacementScript,
    windowMoveVerificationScript,
  ].join('');
}

module.exports = { createMoveWindowToDisplayScript };
