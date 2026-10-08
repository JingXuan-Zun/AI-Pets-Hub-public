import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadAppLauncherFixture } from './appLauncherFixture';
const require = createRequire(import.meta.url);
const { createWindowObservationGeometry } = require('../electron/appLauncher/windowObservationGeometry.cjs');
const { createWindowMoveGeometry } = require('../electron/appLauncher/windowMoveGeometry.cjs');
const { createWindowMoveOperation } = require('../electron/appLauncher/windowMoveOperation.cjs');
const { createWindowControlOperation } = require('../electron/appLauncher/windowControlOperation.cjs');
const { createWindowUiAutomation } = require('../electron/appLauncher/windowUiAutomation.cjs');
const { createWindowCloseOperation } = require('../electron/appLauncher/windowCloseOperation.cjs');
const { createWindowFocusOperation } = require('../electron/appLauncher/windowFocusOperation.cjs');
const display = { id: 1, label: 'Left', index: 0, primary: true, scaleFactor: 2,
  bounds: { x: -800, y: 0, width: 800, height: 600 }, workArea: { x: -800, y: 0, width: 800, height: 560 } };
const geometry = createWindowObservationGeometry({ screen: {
  getAllDisplays: () => [display], getPrimaryDisplay: () => display,
  screenToDipPoint: ({ x, y }: { x: number; y: number }) => ({ x: x / 2, y: y / 2 }),
}, logMessage: () => {} });
const moveGeometry = createWindowMoveGeometry(geometry);
const calls: Array<{ script: string; timeout: number | undefined }> = [];
let mode = 'success';
const fromBounds = { x: -800, y: 0, width: 400, height: 200 };
const toBounds = { x: -700, y: 50, width: 400, height: 200 };
const runPowerShellScript = async (script: string, timeout?: number) => {
  calls.push({ script, timeout });
  if (mode === 'throw') throw new Error('fixture execution failed');
  if (mode === 'invalid-json') return 'not json';
  return JSON.stringify({ ok: true, moved: true, controlled: true, closed: true, invoked: true, verified: true,
    hwnd: 456, pid: 123, fromBounds, toBounds, targetBounds: toBounds, targetDisplay: { bounds: display.bounds,
      workArea: display.workArea, deviceName: 'DISPLAY1', primary: true }, controls: [], matchedControls: [],
    control: { name: '打开' }, resolvedAction: 'invoke', window: { hwnd: 456 } });
};
const dependencies = { ...geometry, ...moveGeometry, runPowerShellScript };
const move = createWindowMoveOperation(dependencies);
const control = createWindowControlOperation(dependencies);
const ui = createWindowUiAutomation(dependencies);
const close = createWindowCloseOperation(dependencies);
const focus = createWindowFocusOperation({ ...dependencies,
  buildFocusCandidates: async () => ({ processNames: ['Fixture'], titleQueries: ['Fixture'] }),
});
if (process.platform === 'win32') {
  const moved = await move.moveWindowToDisplay({ hwnd: 456, targetDisplay: 'primary' });
  assert.equal(moved.ok, true, moved.error);
  assert.equal(moved.moved, true);
  assert.equal(moved.fromDisplayId, '1');
  assert.equal(moved.toDisplayId, '1');
  assert.deepEqual(moved.nativeFromBounds, fromBounds);
  assert.deepEqual(moved.toBounds, { x: -350, y: 25, width: 200, height: 100, coordinateSpace: 'dip' });
  assert.equal(moved.nativeCoordinateSpace, 'native-screen');
  const controlled = await control.controlWindow({ hwnd: 456, state: 'maximize' });
  assert.equal(controlled.ok, true, controlled.error);
  assert.equal(controlled.controlled, true);
  assert.equal(controlled.toDisplayId, '1');
  assert.deepEqual(controlled.nativeTargetBounds, toBounds);
  assert.deepEqual(controlled.targetBounds, moved.toBounds);
  const payload = JSON.parse(calls[1].script.match(/\$payload = @'\r?\n([\s\S]*?)\r?\n'@/u)?.[1] ?? '{}');
  assert.equal(payload.hwnd, 456);
  assert.equal(payload.state, 'maximized');
  assert.equal(payload.fallbackToActiveWindow, false);
  const text = "中 文'\"\n${literal}";
  assert.equal((await ui.invokeWindowUi({ targetText: '打开', uiAction: 'set_text', value: text, hwnd: 456 })).ok, true);
  const encoded = calls.at(-1)!.script.match(/FromBase64String\('([^']+)'\)/u)?.[1] ?? '';
  const uiPayload = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
  assert.equal(uiPayload.value, text);
  assert.equal(uiPayload.uiAction, 'set_value');
  assert.equal(uiPayload.hwnd, 456);
  assert.equal((await ui.inspectWindowUi({ query: 'Fixture', maxDepth: 99, limit: 999 })).ok, true);
  const inspectionPayload = JSON.parse(Buffer.from(calls.at(-1)!.script.match(/FromBase64String\('([^']+)'\)/u)![1], 'base64').toString('utf8'));
  assert.equal(inspectionPayload.maxDepth, 10);
  assert.equal(inspectionPayload.limit, 200);
  assert.equal((await close.closeWindow({ hwnd: 456 })).closed, true);
  assert.equal((await focus.focusWindow({ hwnd: 456 })).focusResolutionAttempts, 1);
  const beforeInvalid = calls.length;
  assert.equal((await ui.invokeWindowUi({})).ok, false);
  assert.equal((await move.moveWindowToDisplay({})).ok, false);
  assert.equal((await move.moveWindowToDisplay({ hwnd: 456 })).ok, false);
  assert.equal((await control.controlWindow({})).ok, false);
  assert.equal((await close.closeWindow({})).ok, false);
  assert.equal((await focus.focusWindow({})).ok, false);
  assert.equal(calls.length, beforeInvalid, 'invalid requests must not invoke the executor');
  for (mode of ['throw', 'invalid-json']) {
    assert.equal((await move.moveWindowToDisplay({ hwnd: 456, targetDisplay: 'primary' })).ok, false);
    assert.equal((await control.controlWindow({ hwnd: 456, state: 'maximize' })).ok, false);
    assert.equal((await ui.inspectWindowUi({})).ok, false);
    assert.equal((await ui.invokeWindowUi({ targetText: '打开' })).ok, false);
    assert.equal((await close.closeWindow({ hwnd: 456 })).ok, false);
    assert.equal((await focus.focusWindow({ hwnd: 456 })).ok, false);
  }
  // Exercise the public factory as well: valid helper exports alone do not prove
  // that its dependency assembly actually passes display lookup to operations.
  mode = 'success';
  const { createAppLauncherService } = loadAppLauncherFixture({
    'powerShellExecutor.cjs': { createPowerShellExecutor: () => ({ runPowerShellScript }) },
  });
  const service = createAppLauncherService({ screen: {
    getAllDisplays: () => [display], getPrimaryDisplay: () => display,
    screenToDipPoint: ({ x, y }: { x: number; y: number }) => ({ x: x / 2, y: y / 2 }),
  } });
  const publicMove = await service.moveWindowToDisplay({ hwnd: 456, targetDisplay: 'primary' });
  assert.equal(publicMove.ok, true, publicMove.error);
  assert.equal(publicMove.toDisplayId, '1');
  const publicControl = await service.controlWindow({ hwnd: 456, state: 'maximize' });
  assert.equal(publicControl.ok, true, publicControl.error);
  assert.equal(publicControl.toDisplayId, '1');
}
console.log('window operation module smoke: PASS (success projection, native/DIP display lookup, payloads, validation, execution/parse errors)');
