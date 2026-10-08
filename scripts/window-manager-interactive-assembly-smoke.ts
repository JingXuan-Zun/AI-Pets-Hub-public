import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { interactionScenarioConfigs, readManagerSource, runInteractionScenario } from './windowManagerInteractionHarness.ts';

const file = 'electron/windowManager/interactiveShapeControllers.cjs';
const source = fs.readFileSync(file, 'utf8');
const stages = ['createPetDragShapeHold', 'createPostDragInputProxyRouting', 'createInteractiveRegionRequests', 'createPetDragNativeShapeSession'];
const exportKeys = [
  ['isPetDragFullWindowShapeRetained', 'clearPetDragFullWindowShapeHoldTimer', 'ensurePetDragFullWindowInteractiveShape',
    'schedulePetDragFullWindowShapeHoldExpiry', 'scheduleNativeShapeRefreshAfterPetDragHold'],
  ['setPostDragInputProxyRegions', 'flushPostDragInputProxyPendingRegions', 'requestPostDragInputProxyRegions', 'forwardPostDragInputProxyEvent'],
  ['setInteractiveRegions'], ['setPetDragNativeShapeActive'],
];
for (const failedStage of [undefined, ...stages]) verifyAssembly(failedStage);

function verifyAssembly(failedStage?: string) {
  const calls: string[] = [], outputs = new Map<string, () => never>();
  const error = new Error('interactive assembly dependency');
  const dependencies: Record<string, unknown> = Object.fromEntries([
    'getMainWindow', 'getCurrentTime', 'getPetDragNativeShapeActive', 'isFullWindowInteractiveShape',
    'createFullWindowInteractiveRegion', 'createInteractiveRegionsSignature', 'summarizeInteractiveRegion',
    'applyInteractiveWindowShape', 'applyPointerPassthroughState', 'hidePostDragInputProxy', 'logWindowEvent',
    'setTimeout', 'clearTimeout', 'normalizeInteractiveRegions', 'normalizeInteractiveRegionSource',
    'ensurePostDragInputProxyWindow', 'applyPostDragInputProxyRegions', 'canApplyInteractiveWindowShape',
  ].map((name) => [name, () => { throw new Error(`must not eagerly invoke ${name}`); }]));
  dependencies.shapeState = { owner: 'root-shape' }; dependencies.proxyState = { owner: 'root-proxy' };
  const modules = Object.fromEntries(stages.map((name, index) => [name, (input: Record<string, unknown>) => {
    calls.push(name);
    for (const [key, value] of Object.entries(input)) {
      if (key in dependencies) assert.equal(value, dependencies[key], `${name} retains state/getter ${key}`);
      if (outputs.has(key)) assert.equal(value, outputs.get(key), `${name} retains earlier controller ${key}`);
    }
    if (failedStage === name) throw error;
    const result = Object.fromEntries(exportKeys[index].map((key) => {
      const fn = () => { throw new Error(`must not eagerly invoke ${key}`); };
      outputs.set(key, fn); return [key, fn];
    }));
    return index < 2 ? result : result[exportKeys[index][0]];
  }]));
  const module = { exports: {} as any };
  vm.runInNewContext(source, { module, require: () => modules }, { filename: file });
  assert.deepEqual(calls, []);
  let caught: unknown, result: Record<string, unknown> = {};
  try { result = module.exports.createInteractiveShapeControllers(dependencies); } catch (value) { caught = value; }
  assert.equal(caught, failedStage ? error : undefined);
  assert.deepEqual(calls, failedStage ? stages.slice(0, stages.indexOf(failedStage) + 1) : stages);
  if (!failedStage) {
    assert.equal(Object.keys(result).length, 4);
    for (const [key, value] of Object.entries(result)) assert.equal(value, outputs.get(key));
  }
}

assert.ok(source.split('\n').length <= 300);
const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
for (const fn of parsed.statements.filter(ts.isFunctionDeclaration)) {
  assert.ok(parsed.getLineAndCharacterOfPosition(fn.end).line
    - parsed.getLineAndCharacterOfPosition(fn.getStart()).line + 1 <= 50);
}
const root = readManagerSource();
assert.match(root, /require\('\.\/windowManager\/interactiveShapeControllers\.cjs'\)/);
assert.ok(root.indexOf('= createInteractiveShapeControllers(') > root.indexOf('= createPostDragInputProxyStateLifecycle('));
assert.match(root, /isPetDragFullWindowShapeRetained: \(\) => isPetDragFullWindowShapeRetained\(\)/);
const flagsCall = '} = resolveWindowManagerRuntimeFlags(process);';
assert.ok(root.includes(flagsCall));
// Exercise the preserved older native-shape path only in this recording harness.
const legacy = root.replace(flagsCall, '} = { ...resolveWindowManagerRuntimeFlags(process), USE_SEPARATE_RENDER_AND_INPUT_WINDOWS: false };');
for (const config of interactionScenarioConfigs.filter(({ platform }) => platform === 'win32')) {
  const trace = await runInteractionScenario(legacy, config);
  assert.deepEqual(trace.filter((line) => line.startsWith('error ') || line.startsWith('timer-error')), []);
  assert.ok(trace.some((line) => line.startsWith('win1.setShape')), 'legacy path must exercise main-window native shape');
}
console.log('Interactive assembly smoke passed (four stages, state/controller identity, failure order, budgets and four legacy-shape configurations).');
