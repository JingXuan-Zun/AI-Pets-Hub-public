import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const actual = createRequire(import.meta.url)('../electron/windowManager/petDragShapeHold.cjs').createPetDragShapeHold;
export function exerciseFullWindowShapeHold(factory = actual) {
  const outputs: unknown[] = [];
  for (const available of [false, true]) for (const cached of [false, true]) for (const initialApplied of [false, true])
  for (const currentFull of [false, true]) for (const diagnostics of [false, true]) for (const active of [false, true])
  for (const now of [99, 100, 101]) for (const failure of [undefined, 'active', 'time', 'create', 'signature', 'get-signature',
    'get-applied', 'is-full', 'set-regions', 'set-signature', 'summary', 'log', 'shape', 'pointer']) {
    const calls: unknown[][] = [], errors: string[] = [], error = new Error('hold failure'); error.stack = 'Error: hold failure';
    const fullRegion = { full: true }, initialRegions = [{ full: currentFull }];
    let regions = initialRegions, signature = cached ? 'full' : 'old', applied = initialApplied;
    const step = (name: string, ...args: unknown[]) => { calls.push([name, ...args]); if (name === failure) throw error; };
    const api = factory({
      shapeState: {
        getPetDragNativeShapeActive: () => { step('active'); return active; }, getHoldUntil: () => 100,
        getRegions: () => regions, getSignature: () => { step('get-signature'); return signature; },
        getApplied: () => { step('get-applied'); return applied; },
        setRegions: (value: typeof regions) => { step('set-regions', value); regions = value; },
        setSignature: (value: string) => { step('set-signature', value); signature = value; },
      },
      getCurrentTime: () => { step('time'); return now; },
      createFullWindowInteractiveRegion: () => { step('create'); return available ? fullRegion : null; },
      createInteractiveRegionsSignature: (value: unknown[]) => { assert.equal(value[0], fullRegion); step('signature'); return 'full'; },
      isFullWindowInteractiveShape: (value: any[]) => { step('is-full'); return value[0]?.full; },
      summarizeInteractiveRegion: (value: unknown) => { assert.equal(value, fullRegion); step('summary'); return 'full-region'; },
      logWindowEvent: (message: string) => step('log', message), pointerDiagnosticsEnabled: diagnostics,
      applyInteractiveWindowShape: () => { step('shape'); applied = true; }, applyPointerPassthroughState: () => step('pointer'),
    });
    assert.deepEqual(calls, []);
    try { assert.equal(api.isPetDragFullWindowShapeRetained(), active || now < 100); }
    catch (caught) { assert.equal(caught, error); errors.push('retention'); }
    const queryCalls = calls.slice(); calls.length = 0;
    if (!errors.length) assert.deepEqual(queryCalls.map(call => call[0]), active ? ['active'] : ['active', 'time']);
    try { assert.equal(api.ensurePetDragFullWindowInteractiveShape('audit'), undefined); }
    catch (caught) { assert.equal(caught, error); errors.push('ensure'); }
    if (!failure) {
      if (!available) { assert.deepEqual(calls, [['create']]); assert.equal(regions, initialRegions); }
      else {
        assert.equal(regions[0], fullRegion); assert.equal(signature, 'full');
        const shouldApply = !cached || !initialApplied || !currentFull;
        assert.equal(calls.filter(call => call[0] === 'shape').length, shouldApply ? 1 : 0);
        assert.equal(calls.at(-1)?.[0], 'pointer');
        const messages = calls.filter(call => call[0] === 'log').map(call => call[1]);
        assert.deepEqual(messages, diagnostics && shouldApply ? ['main-window: retained pet drag full-window shape reason=audit first=full-region'] : []);
      }
    }
    outputs.push({ available, cached, initialApplied, currentFull, diagnostics, active, now, failure,
      queryCalls, calls, errors, regions, signature, applied });
  }
  return outputs;
}
const source = fs.readFileSync('electron/windowManager/petDragShapeHold.cjs', 'utf8');
const stages = ['createPetDragFullWindowShape', 'createPetDragShapeRefresh', 'createPetDragShapeHoldTimers'];
for (const failure of [undefined, ...stages]) {
  const calls: string[] = [], outputs: Record<string, unknown> = {}, error = new Error('assembly failure');
  const dependencies = Object.fromEntries(['shapeState', 'getMainWindow', 'getCurrentTime', 'isFullWindowInteractiveShape',
    'createFullWindowInteractiveRegion', 'createInteractiveRegionsSignature', 'summarizeInteractiveRegion',
    'applyInteractiveWindowShape', 'applyPointerPassthroughState', 'hidePostDragInputProxy', 'logWindowEvent',
    'pointerDiagnosticsEnabled', 'setTimeout', 'clearTimeout'].map(key => [key, () => assert.fail(`no eager ${key}`)]));
  const modules = Object.fromEntries(stages.map((name, index) => [name, (input: Record<string, unknown>) => {
    calls.push(name); for (const [key, value] of Object.entries(input)) assert.equal(value, key in outputs ? outputs[key] : dependencies[key]);
    if (name === failure) throw error;
    const keys = index === 0 ? ['isPetDragFullWindowShapeRetained', 'ensurePetDragFullWindowInteractiveShape']
      : index === 1 ? ['takeDeferredShapeAfterPetDragHold', 'requestFreshShapeAfterPetDragHold', 'scheduleNativeShapeRefreshAfterPetDragHold']
        : ['clearPetDragFullWindowShapeHoldTimer', 'schedulePetDragFullWindowShapeHoldExpiry'];
    for (const key of keys) outputs[key] = () => assert.fail(`no eager ${key}`);
    return Object.fromEntries(keys.map(key => [key, outputs[key]]));
  }]));
  const module = { exports: {} as any }; vm.runInNewContext(source, { module, require: () => modules });
  let caught: unknown, result: any;
  try { result = module.exports.createPetDragShapeHold(dependencies); } catch (value) { caught = value; }
  assert.equal(caught, failure ? error : undefined); assert.deepEqual(calls, failure ? stages.slice(0, stages.indexOf(failure) + 1) : stages);
  if (!failure) {
    assert.equal(Object.keys(result).length, 5);
    for (const [key, value] of Object.entries(result)) assert.equal(value, outputs[key]);
  }
}
console.log(`Drag hold assembly passed (${exerciseFullWindowShapeHold().length} retention/full-shape/error cases, three stages, shared state and return identities).`);
