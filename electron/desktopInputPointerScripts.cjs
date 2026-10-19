const { createBaseInputPowerShell } = require('./desktopInputBaseScript.cjs');
const { createForegroundGuardPowerShell } = require('./desktopInputForegroundGuard.cjs');
const { normalizeNumber, normalizePositiveInteger } = require('./desktopInputRules.cjs');

const DESKTOP_INPUT_MAX_DRAG_STEPS = 32;
const DESKTOP_INPUT_MAX_SCROLL_NOTCHES = 30;
const DESKTOP_INPUT_WHEEL_DELTA = 120;

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
  // Many apps (Explorer, games) only start a drag after the button has been held briefly.
  const holdMs = normalizePositiveInteger(options.holdMs, 150, 2000);
  return createBaseInputPowerShell(String.raw`
${createForegroundGuardPowerShell(options, 'drag')}
[void][DesktopPetInput]::SetCursorPos(${fromX}, ${fromY})
Start-Sleep -Milliseconds 80
[DesktopPetInput]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds ${holdMs}
for ($i = 1; $i -le ${steps}; $i++) {
  $x = [int](${fromX} + ((${toX} - ${fromX}) * $i / ${steps}))
  $y = [int](${fromY} + ((${toY} - ${fromY}) * $i / ${steps}))
  [void][DesktopPetInput]::SetCursorPos($x, $y)
  Start-Sleep -Milliseconds 20
}
Start-Sleep -Milliseconds 120
[DesktopPetInput]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
@{ ok = $true; action = 'drag'; fromX = ${fromX}; fromY = ${fromY}; toX = ${toX}; toY = ${toY}; steps = ${steps} } | ConvertTo-Json -Depth 4 -Compress
`);
}

/** Mouse wheel at a point: positive notches scroll up (or right), negative down (or left). */
function createScrollScript(options) {
  const x = normalizeNumber(options.nativeScreenX);
  const y = normalizeNumber(options.nativeScreenY);
  const notches = normalizeNumber(options.notches);
  if (x === null || y === null || !notches) {
    return null;
  }

  const clamped = Math.max(-DESKTOP_INPUT_MAX_SCROLL_NOTCHES, Math.min(DESKTOP_INPUT_MAX_SCROLL_NOTCHES, notches));
  const flag = options.horizontal ? '0x01000' : '0x0800';
  const direction = clamped > 0 ? 1 : -1;
  return createBaseInputPowerShell(String.raw`
${createForegroundGuardPowerShell(options, 'scroll')}
[void][DesktopPetInput]::SetCursorPos(${x}, ${y})
Start-Sleep -Milliseconds 60
for ($i = 1; $i -le ${Math.abs(clamped)}; $i++) {
  [DesktopPetInput]::mouse_event(${flag}, 0, 0, [uint32]${(direction * DESKTOP_INPUT_WHEEL_DELTA) >>> 0}, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 40
}
@{ ok = $true; action = 'scroll'; x = ${x}; y = ${y}; notches = ${clamped} } | ConvertTo-Json -Depth 4 -Compress
`);
}

module.exports = { createMoveMouseScript, createDragScript, createScrollScript };
