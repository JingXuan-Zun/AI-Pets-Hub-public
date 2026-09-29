const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const {
  _createDesktopInputScript,
  createDesktopInputService,
} = require('../electron/desktopInputService.cjs');

const mainSource = readFileSync('electron/main.cjs', 'utf8');
assert.match(
  mainSource,
  /createDesktopInputService\(\{[\s\S]*screen,/u,
  'desktop input service should receive Electron screen for DIP-to-native-screen conversion',
);

let conversionCalls = 0;
const service = createDesktopInputService({
  screen: {
    dipToScreenPoint(point) {
      conversionCalls += 1;
      return {
        x: point.x * 2,
        y: point.y * 2,
      };
    },
  },
});

const nativeMoveRequest = service._createNativeScreenInputRequest('move_mouse', {
  action: 'move_mouse',
  coordinateSpace: 'dip',
  x: 120,
  y: 80,
});
assert.equal(conversionCalls, 1);
assert.equal(nativeMoveRequest.coordinateSpace, 'native-screen');
assert.equal(nativeMoveRequest.nativeScreenX, 240);
assert.equal(nativeMoveRequest.nativeScreenY, 160);

const nativeBypassRequest = service._createNativeScreenInputRequest('move_mouse', {
  action: 'move_mouse',
  coordinateSpace: 'native-screen',
  x: 120,
  y: 80,
});
assert.equal(conversionCalls, 1);
assert.equal(nativeBypassRequest.coordinateSpace, 'native-screen');
assert.equal(nativeBypassRequest.nativeScreenX, 120);
assert.equal(nativeBypassRequest.nativeScreenY, 80);

const dragRequest = service._createNativeScreenInputRequest('drag', {
  action: 'drag',
  coordinateSpace: 'dip',
  fromX: 10,
  fromY: 20,
  toX: 30,
  toY: 40,
});
assert.equal(conversionCalls, 3);
assert.deepEqual(
  {
    fromNativeScreenX: dragRequest.fromNativeScreenX,
    fromNativeScreenY: dragRequest.fromNativeScreenY,
    toNativeScreenX: dragRequest.toNativeScreenX,
    toNativeScreenY: dragRequest.toNativeScreenY,
  },
  {
    fromNativeScreenX: 20,
    fromNativeScreenY: 40,
    toNativeScreenX: 60,
    toNativeScreenY: 80,
  },
);

const moveScript = _createDesktopInputScript('move_mouse', nativeMoveRequest);
assert.match(
  moveScript,
  /SetCursorPos\(240, 160\)/u,
  'desktop input SetCursorPos should receive native-screen coordinates',
);

const clickScript = _createDesktopInputScript('click', {
  action: 'click',
  coordinateSpace: 'native-screen',
  nativeScreenX: 321,
  nativeScreenY: 654,
});
assert.match(
  clickScript,
  /SetCursorPos\(321, 654\)/u,
  'desktop click should move to native-screen coordinates before clicking',
);
assert.match(
  clickScript,
  /GetCursorPos\(\[ref\]\$point\)/u,
  'desktop click should verify the cursor reached the target point',
);
assert.match(
  clickScript,
  /SendInput\(1, @\(\$down\)/u,
  'desktop click should prefer SendInput for the mouse down event',
);
assert.match(
  clickScript,
  /mouse_event\(\$\{?downFlag\}?|mouse_event\(0x0002/u,
  'desktop click should keep mouse_event fallback for SendInput failure',
);
assert.match(
  clickScript,
  /cursorVerified/u,
  'desktop click result should report cursor verification evidence',
);
assert.match(
  clickScript,
  /backendName = 'DesktopInputBackend'/u,
  'desktop click result should identify the input backend',
);
assert.match(
  clickScript,
  /\$inputPlan = @\('SetCursorPos', 'SendInputDownUp'\)/u,
  'desktop click should expose the input backend execution plan',
);
assert.match(
  clickScript,
  /failureClassification/u,
  'desktop click should classify the input backend outcome',
);
assert.match(
  clickScript,
  /Get-DesktopPetInputForegroundSnapshot/u,
  'desktop click should capture foreground window diagnostics before and after input',
);
assert.match(
  clickScript,
  /TryIsProcessElevated/u,
  'desktop click should capture process elevation diagnostics for UIPI analysis',
);

const forcedFallbackClickScript = _createDesktopInputScript('click', {
  action: 'click',
  coordinateSpace: 'native-screen',
  forceMouseEventFallback: true,
  nativeScreenX: 321,
  nativeScreenY: 654,
});
assert.match(
  forcedFallbackClickScript,
  /\$sentDown -eq 1 -and \$sentUp -eq 1 -and -not \$true/u,
  'forced fallback click should run mouse_event even when SendInput reports success',
);
assert.match(
  forcedFallbackClickScript,
  /forceMouseEventFallback = \$true/u,
  'forced fallback click should report the compatibility mode in diagnostics',
);
assert.match(
  forcedFallbackClickScript,
  /mouse_event_supplement/u,
  'forced fallback click should expose mouse_event supplement in the input plan',
);

console.log('desktop input native-screen coordinate smoke ok');
