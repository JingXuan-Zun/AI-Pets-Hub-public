import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const actual = createRequire(import.meta.url)('../electron/windowManager/pointerPassthroughRequests.cjs').createPointerPassthroughRequester;
export function exercisePointerRequests(factory = actual) {
const outcomes: unknown[] = [];
for (const diagnostics of [false, true]) for (const windowKind of ['missing', 'destroyed', 'live'])
for (const input of [false, true, null, 0, 'request', {}]) for (const applied of [false, true])
for (const dragging of [false, true]) {
  const expected = ['set-request'];
  if (diagnostics && windowKind !== 'missing') expected.push('window-check');
  if (diagnostics && windowKind === 'live') expected.push('requested', 'applied', 'shape', 'regions', 'drag', 'retained', 'log');
  expected.push('apply');
  for (const failure of [undefined, ...expected]) {
    let requested: unknown = 'initial';
    const calls: string[] = [], messages: string[] = [], error = new Error('request failure');
    const step = (name: string) => { calls.push(name); if (name === failure) throw error; };
    const win = windowKind === 'missing' ? null : {
      isDestroyed: () => { step('window-check'); return windowKind === 'destroyed'; },
    };
    const request = factory({
      nativeShapeState: {
        getRequestedPointerPassthrough: () => { step('requested'); return requested; },
        getPointerPassthrough: () => { step('applied'); return applied; },
        getApplied: () => { step('shape'); return !applied; },
        getRegions: () => { step('regions'); return [{}, {}]; },
      },
      setRequestedPointerPassthrough: (value: boolean) => { step('set-request'); requested = value; },
      getMainWindow: () => win,
      getPetDragNativeShapeActive: () => { step('drag'); return dragging; },
      isPetDragFullWindowShapeRetained: () => { step('retained'); return !dragging; },
      pointerDiagnosticsEnabled: diagnostics,
      logWindowEvent: (message: string) => { step('log'); messages.push(message); },
      applyPointerPassthroughState: () => { step('apply'); assert.equal(requested, Boolean(input)); return 'native-result'; },
    });
    assert.deepEqual(calls, [], 'assembly must not read or apply native state');
    if (failure) {
      assert.throws(() => request(input), (caught: unknown) => caught === error);
      assert.deepEqual(calls, expected.slice(0, expected.indexOf(failure) + 1));
      assert.equal(requested, failure === 'set-request' ? 'initial' : Boolean(input));
    } else {
      assert.equal(request(input), undefined); assert.deepEqual(calls, expected);
      assert.deepEqual(messages, diagnostics && windowKind === 'live' ? [
        `DRAG-TRACE-V2 pointer-request requested=${Boolean(input)} applied=${applied} shapeApplied=${!applied} shapeRegions=2 session=${dragging} retained=${!dragging}`,
      ] : []);
      calls.length = 0; request(input);
      assert.deepEqual(calls, expected, 'repeated requests must still apply immediately');
    }
    outcomes.push({ diagnostics, windowKind, input: typeof input === "object" && input !== null ? "object" : input, applied, dragging, failure, calls: [...calls], messages, requested });
  }
}
  return outcomes;
}
const outcomes = exercisePointerRequests();
const root = fs.readFileSync('electron/windowManager.cjs', 'utf8');
assert.ok(fs.readFileSync('electron/windowManager/pointerPassthroughRequests.cjs', 'utf8').includes('nativeShapeState, setRequestedPointerPassthrough: (ignore) => { managerState.requestedPointerPassthrough = ignore; }'));
assert.ok(fs.readFileSync('electron/windowManager/pointerPassthroughRequests.cjs', 'utf8').includes('getMainWindow: () => managerState.mainWindow, getPetDragNativeShapeActive: () => managerState.petDragNativeShapeActive'));
assert.ok(root.indexOf('= createInteractiveShapeControllers(') < root.indexOf('= createWindowStatePointerPassthroughRequester('));
assert.ok(root.indexOf('= createWindowStatePointerPassthroughRequester(') < root.indexOf('= createMainWindowLifecycleControllers('));
assert.ok(fs.readFileSync('electron/windowManager/windowManagerPublicApi.cjs', 'utf8').includes('setPointerPassthrough: setWindowPointerPassthrough'));
assert.ok(fs.readFileSync('electron/windowManager/pointerPassthroughRequests.cjs', 'utf8').split('\n').length <= 300);
console.log(`Pointer request smoke passed (${outcomes.length} immediate/repeated requests, diagnostic gating, exact logs and failure-order cases).`);
