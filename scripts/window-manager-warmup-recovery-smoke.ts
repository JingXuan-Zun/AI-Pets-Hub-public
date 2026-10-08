import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const actual = createRequire(import.meta.url)('../electron/windowManager/mainInteractiveLayerWarmup.cjs').createMainInteractiveLayerWarmup;
export function exerciseWarmupRecovery(factory = actual) {
  const results: unknown[] = [];
  for (const platform of ['win32', 'linux']) for (const separated of [false, true]) for (const completed of [false, true])
  for (const window of ['live', 'missing', 'destroyed', 'hidden', 'no-shape', 'no-ignore']) for (const requested of [false, true])
  for (const regions of [false, true]) for (const applied of [false, true]) for (const diagnostics of [false, true])
  for (const timer of ['unref', 'plain', 'null']) results.push(run({ platform, separated, completed, window, requested, regions, applied, diagnostics, timer }));
  for (const race of ['replacement', 'missing', 'destroyed', 'regions', 'native-replacement', 'immediate'])
  for (const applied of [false, true]) for (const diagnostics of [false, true]) results.push(run({ race, applied, diagnostics }));
  for (const failure of ['warm-null', 'completed', 'platform', 'main', 'destroyed', 'visible', 'requested', 'regions',
    'set-completed', 'shape', 'set-applied', 'ignore', 'set-pointer', 'log', 'timeout', 'restore-set', 'restore-get', 'unref', 'apply-shape', 'pointer', 'applied'])
  for (const phase of ['warm', 'restore-empty', 'restore-regions']) results.push(run({ failure, phase, diagnostics: true, applied: true }));
  return results;
  function run(input: any) {
    const config = { platform: 'win32', separated: false, completed: false, window: 'live', requested: true,
      regions: false, applied: false, diagnostics: false, timer: 'unref', ...input };
    const calls: unknown[][] = [], errors: string[] = [], callbacks: (() => unknown)[] = [];
    const error = new Error('warmup dependency'); error.stack = 'Error: warmup dependency';
    let completed = config.completed, regions = config.regions, applied = config.applied, pointer = true;
    let restore: any = { id: 'initial' }, warm: any = 'initial', failure: string | undefined, replaced = false;
    const id = (value: any) => value?.id ?? value;
    function step(name: string, ...values: unknown[]) {
      calls.push([name, ...values]); if (failure === name) throw error;
      if (config.race === 'native-replacement' && name === 'shape' && !replaced) { current = replacement; replaced = true; }
    }
    function makeWindow(name: string, kind = 'live'): any {
      return { isDestroyed: () => { step('destroyed', name); return kind === 'destroyed'; },
        isVisible: () => { step('visible', name); return kind !== 'hidden'; },
        setShape: kind === 'no-shape' ? undefined : (value: unknown) => step('shape', name, value),
        setIgnoreMouseEvents: kind === 'no-ignore' ? undefined : (...values: unknown[]) => step('ignore', name, ...values) };
    }
    const replacement = makeWindow('replacement');
    let current = config.window === 'missing' ? null : makeWindow('initial', config.window);
    const timer = config.timer === 'null' ? null : config.timer === 'plain' ? { id: 'timer' }
      : { id: 'timer', unref() { assert.equal(this, timer); step('unref'); } };
    const api = factory({
      warmupState: {
        setWarmupTimer: (value: unknown) => { step('warm-null', value); warm = value; },
        getCompleted: () => { step('completed'); return completed; },
        setCompleted: (value: boolean) => { step('set-completed', value); completed = value; },
        setRestoreTimer: (value: unknown) => { step('restore-set', id(value)); restore = value; },
        getRestoreTimer: () => { step('restore-get'); return restore; },
      },
      nativeShapeState: {
        getRegions: () => { step('regions'); return regions ? [{ region: true }] : []; },
        getApplied: () => { step('applied'); return applied; },
        setApplied: (value: boolean) => { step('set-applied', value); applied = value; },
        getRequestedPointerPassthrough: () => { step('requested'); return config.requested; },
        setPointerPassthrough: (value: boolean) => { step('set-pointer', value); pointer = value; },
      },
      getMainWindow: () => { step('main'); return current; }, getPlatform: () => { step('platform'); return config.platform; },
      applyInteractiveWindowShape: () => step('apply-shape'), applyPointerPassthroughState: () => step('pointer'),
      logWindowEvent: (message: string) => step('log', message), pointerDiagnosticsEnabled: config.diagnostics,
      USE_SEPARATE_RENDER_AND_INPUT_WINDOWS: config.separated, MAIN_INTERACTIVE_LAYER_WARMUP_REGION: { x: 0, y: 0, width: 1, height: 1 },
      MAIN_INTERACTIVE_LAYER_WARMUP_RESTORE_DELAY_MS: 180,
      setTimeout: (callback: () => unknown, delay: number) => {
        assert.equal(callback.name, 'restoreMainInteractiveLayerWarmup'); assert.equal(delay, 180);
        step('timeout', delay); callbacks.push(callback); if (config.race === 'immediate') callback(); return timer;
      },
    });
    assert.deepEqual(calls, [], 'assembly must not read state or operate windows');
    assert.deepEqual(Object.keys(api), ['warmMainInteractiveLayer']);
    const invoke = (label: string, fn: () => unknown) => {
      try { assert.equal(fn(), undefined); } catch (caught) {
        assert.ok(caught === error || caught instanceof TypeError); errors.push(label + (caught === error ? ':dependency' : ':TypeError'));
      }
    };
    if (config.phase === 'warm') failure = config.failure;
    invoke('warm', api.warmMainInteractiveLayer);
    if (!config.failure && config.platform === 'win32' && !config.separated && !config.completed && config.window === 'live' && config.requested && !config.regions) {
      assert.equal(completed, true); assert.equal(callbacks.length, 1);
      assert.equal(warm, null); assert.equal(pointer, false);
    }
    invoke('repeat', api.warmMainInteractiveLayer);
    if (config.phase?.startsWith('restore')) { failure = config.failure; regions = config.phase === 'restore-regions'; }
    if (config.race === 'replacement') current = replacement;
    if (config.race === 'missing') current = null;
    if (config.race === 'destroyed') current = makeWindow('destroyed', 'destroyed');
    if (config.race === 'regions') regions = true;
    for (const callback of callbacks) invoke('restore', callback);
    return { calls, errors, completed, regions, applied, pointer, warm: id(warm), restore: id(restore), callbacks: callbacks.length };
  }
}

const source = fs.readFileSync('electron/windowManager/mainInteractiveLayerWarmup.cjs', 'utf8');
for (const failed of [false, true]) {
  const error = new Error('recovery assembly'); let received: any;
  const dependencies = Object.fromEntries(['warmupState', 'nativeShapeState', 'getMainWindow', 'getPlatform', 'applyInteractiveWindowShape',
    'applyPointerPassthroughState', 'logWindowEvent', 'pointerDiagnosticsEnabled', 'USE_SEPARATE_RENDER_AND_INPUT_WINDOWS']
    .map(key => [key, () => { throw new Error('no eager dependency'); }]));
  const module = { exports: {} as any };
  vm.runInNewContext(source, { module, require: () => ({ createMainInteractiveLayerWarmupRecovery: (input: any) => {
    received = input; if (failed) throw error;
    return { canWarmMainInteractiveLayer: () => { throw new Error('no eager guard'); }, restoreMainInteractiveLayerWarmup: () => { throw new Error('no eager restore'); } };
  } }) });
  let caught: unknown, result: any;
  try { result = module.exports.createMainInteractiveLayerWarmup(dependencies); } catch (value) { caught = value; }
  assert.equal(caught, failed ? error : undefined);
  for (const [key, value] of Object.entries(dependencies)) assert.equal(received[key], value);
  if (!failed) assert.equal(typeof result.warmMainInteractiveLayer, 'function');
}
const results = exerciseWarmupRecovery();
console.log(`Warmup recovery passed (${results.length} eligibility/native/error/timer/window-race cases; lazy assembly and shared state).`);
