import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const file = 'electron/windowManager/nativeShapeControllers.cjs';
const source = fs.readFileSync(file, 'utf8');
const stages = ['createMainWindowNativeShape', 'createMainInteractiveLayerWarmup'];
for (const failedStage of [undefined, ...stages]) {
  const calls: string[] = [], error = new Error('native shape assembly dependency');
  const dependencies: Record<string, any> = Object.fromEntries([
    'getMainWindow', 'getPlatform', 'getIsAgentDesktopExecutionActive', 'getInputProxyRegionCount',
    'isFullWindowInteractiveShape', 'isPetDragFullWindowShapeRetained', 'summarizeInteractiveRegion', 'logWindowEvent', 'setTimeout',
  ].map((name) => [name, () => { throw new Error(`must not eagerly invoke ${name}`); }]));
  dependencies.nativeShapeState = { owner: 'root-native' }; dependencies.warmupState = { owner: 'root-warmup' };
  const outputs: Record<string, () => never> = {};
  const modules = Object.fromEntries(stages.map((name, index) => [name, (input: Record<string, unknown>) => {
    calls.push(name);
    for (const [key, value] of Object.entries(input)) {
      if (key in dependencies) assert.equal(value, dependencies[key]);
      if (key in outputs) assert.equal(value, outputs[key]);
    }
    if (name === failedStage) throw error;
    const keys = index === 0 ? ['canApplyInteractiveWindowShape', 'applyInteractiveWindowShape', 'applyPointerPassthroughState']
      : ['warmMainInteractiveLayer'];
    return Object.fromEntries(keys.map((key) => {
      const fn = () => { throw new Error(`must not eagerly invoke ${key}`); }; outputs[key] = fn; return [key, fn];
    }));
  }]));
  const module = { exports: {} as any };
  vm.runInNewContext(source, { module, require: () => modules }, { filename: file });
  assert.deepEqual(calls, []);
  let caught: unknown, result: Record<string, unknown> = {};
  try { result = module.exports.createNativeShapeControllers(dependencies); } catch (value) { caught = value; }
  assert.equal(caught, failedStage ? error : undefined);
  assert.deepEqual(calls, failedStage ? stages.slice(0, stages.indexOf(failedStage) + 1) : stages);
  if (!failedStage) {
    assert.equal(Object.keys(result).length, 4);
    for (const [key, value] of Object.entries(result)) assert.equal(value, outputs[key]);
  }
}
assert.ok(source.split('\n').length <= 300);
const root = fs.readFileSync('electron/windowManager.cjs', 'utf8');
assert.match(root, /require\('\.\/windowManager\/nativeShapeControllers\.cjs'\)/);
assert.match(root, /isPetDragFullWindowShapeRetained: \(\) => isPetDragFullWindowShapeRetained\(\)/);
assert.ok(root.indexOf('= createNativeShapeControllers(') < root.indexOf('= createWindowResourceMessagingControllers('));
assert.ok(root.indexOf('= createNativeShapeControllers(') < root.indexOf('= createPostDragInputProxyStateLifecycle('));
assert.ok(root.indexOf('= createPostDragInputProxyStateLifecycle(') < root.indexOf('= createInteractiveShapeControllers('));
console.log('Native shape assembly smoke passed (original native/warmup order, state/controller identity, lazy queries and lifecycle ordering).');
