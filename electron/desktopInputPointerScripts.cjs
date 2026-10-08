const { createBaseInputPowerShell } = require('./desktopInputBaseScript.cjs');
const { createForegroundGuardPowerShell } = require('./desktopInputForegroundGuard.cjs');
const { normalizeNumber, normalizePositiveInteger } = require('./desktopInputRules.cjs');

const DESKTOP_INPUT_MAX_DRAG_STEPS = 32;

function createMoveMouseScript(options) {
  const x = normalizeNumber(options.nativeScreenX);
  const y = normalizeNumber(options.nativeScreenY);
  if (x === null || y === null) {
    return null;
  }

  return createBaseInputPowerShell(String.raw`
[void][DesktopPetInput]::SetCursorPos(${x}, ${y})
@{ ok = $true; action = 'move_mouse'; x = ${x}; y = ${y} } | ConvertTo-Json -Depth 4 -Compress
`);
}

function createDragScript(options) {
  const fromX = normalizeNumber(options.fromNativeScreenX);
  const fromY = normalizeNumber(options.fromNativeScreenY);
  const toX = normalizeNumber(options.toNativeScreenX);
  const toY = normalizeNumber(options.toNativeScreenY);
  if (fromX === null || fromY === null || toX === null || toY === null) {
    return null;
  }

  const steps = normalizePositiveInteger(options.steps, 12, DESKTOP_INPUT_MAX_DRAG_STEPS);
  return createBaseInputPowerShell(String.raw`
${createForegroundGuardPowerShell(options, 'drag')}
[void][DesktopPetInput]::SetCursorPos(${fromX}, ${fromY})
Start-Sleep -Milliseconds 80
[DesktopPetInput]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
for ($i = 1; $i -le ${steps}; $i++) {
  $x = [int](${fromX} + ((${toX} - ${fromX}) * $i / ${steps}))
  $y = [int](${fromY} + ((${toY} - ${fromY}) * $i / ${steps}))
  [void][DesktopPetInput]::SetCursorPos($x, $y)
  Start-Sleep -Milliseconds 20
}
[DesktopPetInput]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
@{ ok = $true; action = 'drag'; fromX = ${fromX}; fromY = ${fromY}; toX = ${toX}; toY = ${toY}; steps = ${steps} } | ConvertTo-Json -Depth 4 -Compress
`);
}

module.exports = { createMoveMouseScript, createDragScript };
