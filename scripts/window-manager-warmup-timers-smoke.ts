import { expandWindowPresentationTraySource } from './windowManagerAuxiliaryAssemblySource.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { readModuleProjectFunction } from './projectModuleSource.mjs';
import { loadWindowManager } from './window-manager-initialization-smoke';
const lifecycleStateSource = fs.readFileSync('electron/windowManager/mainWindowLifecycleStateAdapters.cjs', 'utf8');

const require = createRequire(import.meta.url);
const actual = require('../electron/windowManager/mainInteractiveWarmupTimers.cjs').createMainInteractiveWarmupTimers;

export function exerciseWarmupTimers(factory = actual) {
  const outputs: unknown[] = [];
  for (const platform of ['win32', 'darwin', undefined]) for (const enabled of [false, true]) {
    for (const completed of [false, true]) for (const warm of ['null', 'zero', 'occupied']) {
      for (const restore of ['null', 'zero', 'occupied']) schedule(platform, enabled, completed, warm, restore, 'normal');
    }
  }
  for (const returned of ['plain', 'zero', 'null', 'undefined', 'non-function']) schedule('win32', true, false, 'null', 'null', returned);
  const stages = ['platform', 'completed', 'warm-get0', 'restore-get0', 'timeout', 'warm-set', 'warm-get1',
    'unref-get0', 'warm-get2', 'unref-get1', 'unref', 'warm-callback'];
  for (const failure of stages) schedule('win32', true, false, 'null', 'null', 'normal', failure);
  for (const race of stages.filter(stage => stage !== 'warm-callback')) schedule('win32', true, false, 'null', 'null', 'normal', undefined, race);
  schedule('win32', true, false, 'null', 'null', 'normal', undefined, 'immediate');
  schedule('win32', true, false, 'null', 'null', 'normal', 'warm-callback', 'immediate');
  for (const warm of ['null', 'zero', 'false', 'empty', 'undefined', 'occupied']) {
    for (const restore of ['null', 'zero', 'false', 'empty', 'undefined', 'occupied']) clear(warm, restore);
  }
  for (const failure of ['warm-get0', 'warm-get1', 'clear-warm', 'warm-null', 'restore-get0', 'restore-get1', 'clear-restore', 'restore-null']) clear('occupied', 'occupied', failure);
  for (const race of ['warm-get0', 'warm-get1', 'clear-warm', 'warm-null', 'restore-get0', 'restore-get1', 'clear-restore', 'restore-null']) clear('occupied', 'occupied', undefined, race);
  return outputs;

  function initial(kind: string, name: string): any {
    return kind === 'occupied' ? { id: name } : kind === 'zero' ? 0 : kind === 'false' ? false : kind === 'empty' ? '' : kind === 'undefined' ? undefined : null;
  }
  function id(value: any) { return value?.id ?? value; }
  function schedule(platform: string | undefined, enabled: boolean, initialCompleted: boolean,
    initialWarm: string, initialRestore: string, returned: string, failure?: string, race?: string) {
    const calls: any[][] = [], callbacks: (() => unknown)[] = [], error = new Error('warmup scheduling dependency');
    let warm: any = initial(initialWarm, 'initial-warm'), restore: any = initial(initialRestore, 'initial-restore'), completed = initialCompleted;
    let reads = 0, restoreReads = 0, unrefReads = 0, thrown: any;
    const replacement = { id: 'replacement', unref() { step('replacement-unref'); } };
    function step(name: string, value?: unknown) {
      calls.push([name, value]); if (name === failure) throw error;
      if (name === race) { warm = replacement; restore = { id: 'replacement-restore' }; }
    }
    const normal = { id: 'normal', get unref() {
      step('unref-get' + unrefReads++);
      return function(this: any) { assert.equal(this, normal); step('unref', this.id); };
    } };
    const value = returned === 'normal' ? normal : returned === 'plain' ? { id: 'plain' }
      : returned === 'non-function' ? { id: 'non-function', unref: 7 } : returned === 'zero' ? 0 : returned === 'null' ? null : undefined;
    const deps = {
      getPlatform() { step('platform', platform); return platform; }, PREWARM_MAIN_INTERACTIVE_LAYER: enabled,
      getWarmupCompleted() { step('completed', completed); return completed; },
      getWarmupTimer() { const value = warm; step('warm-get' + reads++, id(value)); return value; },
      setWarmupTimer(value: any) { step('warm-set', id(value)); warm = value; },
      getRestoreTimer() { const value = restore; step('restore-get' + restoreReads++, id(value)); return value; },
      setRestoreTimer(value: any) { step('restore-set', id(value)); restore = value; },
      warmMainInteractiveLayer() { step('warm-callback'); warm = null; completed = true; restore = { id: 'callback-restore' }; return 'warm-result'; },
      MAIN_INTERACTIVE_LAYER_WARMUP_DELAY_MS: 137,
      setTimeout(callback: () => unknown, delay: number) {
        assert.equal(callback, deps.warmMainInteractiveLayer); assert.equal(delay, 137);
        step('timeout', delay); callbacks.push(callback); if (race === 'immediate') assert.equal(callback(), 'warm-result'); return value;
      },
      clearTimeout(timer: any) { step('clear', id(timer)); },
    };
    const controls = factory(deps); assert.deepEqual(calls, []);
    try {
      assert.equal(controls.scheduleMainInteractiveLayerWarmup(), undefined);
      const beforeRepeat = callbacks.length;
      assert.equal(controls.scheduleMainInteractiveLayerWarmup(), undefined);
      if (!failure && !race) {
        const active = platform === 'win32' && enabled && !initialCompleted && initialWarm !== 'occupied' && initialRestore !== 'occupied';
        assert.equal(beforeRepeat, active ? 1 : 0);
        assert.equal(callbacks.length, active ? returned === 'zero' ? 2 : 1 : 0);
      }
      for (const callback of callbacks) assert.equal(callback(), 'warm-result');
      if (callbacks.length) {
        const count = callbacks.length;
        assert.equal(controls.scheduleMainInteractiveLayerWarmup(), undefined);
        assert.equal(callbacks.length, count, 'completed callback prevents scheduling');
      }
      assert.equal(controls.clearMainInteractiveLayerWarmupTimers(), undefined);
      assert.equal(controls.clearMainInteractiveLayerWarmupTimers(), undefined);
    } catch (caught) { assert.ok(caught === error || caught instanceof TypeError); thrown = caught; }
    if (thrown === error) assert.equal(calls.at(-1)?.[0], failure);
    assert.equal(thrown === error, Boolean(failure));
    if (!failure && !race && platform === 'win32' && enabled && !initialCompleted && initialWarm !== 'occupied' && initialRestore !== 'occupied') {
      assert.equal(thrown instanceof TypeError, returned === 'null' || returned === 'undefined');
    }
    outputs.push({ kind: 'schedule', platform, enabled, initialCompleted, initialWarm, initialRestore, returned, failure, race,
      calls, warm: id(warm), restore: id(restore), completed, callbacks: callbacks.length,
      thrown: thrown === error ? 'dependency' : thrown ? 'TypeError' : null });
  }
  function clear(initialWarm: string, initialRestore: string, failure?: string, race?: string) {
    const calls: any[][] = [], error = new Error('warmup cleanup dependency');
    let warm = initial(initialWarm, 'initial-warm'), restore = initial(initialRestore, 'initial-restore'), reads = 0, restoreReads = 0, thrown: any;
    function step(name: string, value?: unknown) {
      calls.push([name, value]); if (name === failure) throw error;
      if (name === race) { warm = { id: 'replacement-warm' }; restore = { id: 'replacement-restore' }; }
    }
    const deps = {
      getPlatform() { assert.fail('cleanup does not read platform'); }, PREWARM_MAIN_INTERACTIVE_LAYER: false,
      getWarmupCompleted() { assert.fail('cleanup does not read completion'); },
      getWarmupTimer() { const value = warm; step('warm-get' + reads++, id(value)); return value; },
      setWarmupTimer(value: any) { assert.equal(value, null); step('warm-null'); warm = value; },
      getRestoreTimer() { const value = restore; step('restore-get' + restoreReads++, id(value)); return value; },
      setRestoreTimer(value: any) { assert.equal(value, null); step('restore-null'); restore = value; },
      warmMainInteractiveLayer() { assert.fail('cleanup does not invoke warmup'); },
      MAIN_INTERACTIVE_LAYER_WARMUP_DELAY_MS: 137, setTimeout() { assert.fail('cleanup does not schedule'); },
      clearTimeout(timer: any) { step(String(timer.id).includes('warm') ? 'clear-warm' : 'clear-restore', id(timer)); },
    };
    const controls = factory(deps); assert.deepEqual(calls, []);
    try { assert.equal(controls.clearMainInteractiveLayerWarmupTimers(), undefined); assert.equal(controls.clearMainInteractiveLayerWarmupTimers(), undefined); }
    catch (caught) { assert.equal(caught, error); assert.equal(calls.at(-1)?.[0], failure); thrown = caught; }
    assert.equal(Boolean(thrown), Boolean(failure));
    if (!failure && !race) {
      assert.equal(warm, initialWarm === 'occupied' ? null : initial(initialWarm, 'unused'));
      assert.equal(restore, initialRestore === 'occupied' ? null : initial(initialRestore, 'unused'));
      assert.deepEqual(calls.filter(call => call[0].startsWith('clear')).map(call => call[0]),
        [...(initialWarm === 'occupied' ? ['clear-warm'] : []), ...(initialRestore === 'occupied' ? ['clear-restore'] : [])]);
    }
    outputs.push({ kind: 'clear', initialWarm, initialRestore, failure, race, calls, warm: id(warm), restore: id(restore), thrown: Boolean(thrown) });
  }
}

const actualRoot = fs.readFileSync('electron/windowManager.cjs', 'utf8');
const root = expandWindowPresentationTraySource(actualRoot);
const start = root.indexOf('= createMainWindowPresentationControllers(');
assert.ok(start >= 0 && start < root.indexOf('= createSettingsTrayControllers('));
for (const binding of ['getPlatform: () => process.platform', 'getWarmupCompleted: () => managerState.mainInteractiveLayerWarmupCompleted',
  'getWarmupTimer: () => managerState.mainInteractiveLayerWarmupTimer', 'managerState.mainInteractiveLayerWarmupTimer = timer;',
  'getRestoreTimer: () => managerState.mainInteractiveLayerWarmupRestoreTimer', 'managerState.mainInteractiveLayerWarmupRestoreTimer = timer;',
  'warmMainInteractiveLayer, MAIN_INTERACTIVE_LAYER_WARMUP_DELAY_MS']) assert.ok((root + lifecycleStateSource).includes(binding));
assert.match(fs.readFileSync('electron/windowManager/windowManagerDisposal.cjs', 'utf8'), /function dispose\(\) \{\s*stopMainTopmostGuard\(\);\s*clearMainInteractiveLayerWarmupTimers\(\);/);
console.log(`Warmup timers smoke passed (${exerciseWarmupTimers().length} scenarios).`);

// Exercise the real root warm callback (no current window) and root dispose with controlled timers.
const phaseFactory = readModuleProjectFunction('electron/windowManager/mainWindowPresentation.cjs', 'createMainWindowPresentationControllers');
const presentationOverride = (`(() => {
  const {createMainWindowPresenter} = require('./windowManager/mainWindowPresentation.cjs');
  const {createMainInteractiveWarmupTimerStateAdapter} = require('./windowManager/mainWindowLifecycleStateAdapters.cjs');
  function createMainInteractiveWarmupTimers(deps) {
    const audit = {deps, callbacks: [], cleared: [], unref: 0}; warmupAudit.push(audit);
    const original = require('./windowManager/mainInteractiveWarmupTimers.cjs');
    audit.controls = original.createMainInteractiveWarmupTimers({...deps, getPlatform: () => 'win32', PREWARM_MAIN_INTERACTIVE_LAYER: true,
      setTimeout(callback, delay) { audit.callbacks.push(callback); return {id: audit.callbacks.length, unref() { audit.unref++; }}; },
      clearTimeout(timer) { audit.cleared.push(timer); },
    });
    return audit.controls;
  }
  ${phaseFactory}
  return {createMainWindowPresentationControllers};
})()`).replaceAll("require('./windowManager/", "require('./");
const combinedSource = fs.readFileSync('electron/windowManager/windowPresentationTrayControllers.cjs', 'utf8').replace("require('./mainWindowPresentation.cjs')", presentationOverride);
const assemblySource = `const warmupAudit = [];\n` + actualRoot.replace("require('./windowManager/windowPresentationTrayControllers.cjs')", `(() => {
  const module = { exports: {} };
  ${combinedSource.replaceAll("require('./", "require('./windowManager/")}
  return module.exports;
})()`) + '\nmodule.exports.warmupAudit = warmupAudit;';
assert.ok(assemblySource.includes(phaseFactory), 'Audit uses the actual presentation phase implementation');
let assemblies = 0;
for (const isDev of [false, true]) for (const sessionPartition of [undefined, 'persist:test']) {
  const { api, effects } = loadWindowManager(assemblySource);
  const managers = [api.createWindowManager({ isDev, sessionPartition, captureService: {} }),
    api.createWindowManager({ isDev, sessionPartition, captureService: {} })];
  for (let index = 0; index < managers.length; index++) {
    const audit = api.warmupAudit[index]; assert.equal(audit.deps.getWarmupTimer(), null); assert.equal(audit.deps.getRestoreTimer(), null);
    audit.controls.scheduleMainInteractiveLayerWarmup(); const first = audit.deps.getWarmupTimer();
    assert.equal(audit.callbacks.length, 1); assert.equal(audit.unref, 1);
    assert.equal(audit.callbacks[0].name, 'warmMainInteractiveLayer'); assert.equal(audit.callbacks[0](), undefined);
    assert.equal(audit.deps.getWarmupTimer(), null); assert.equal(audit.deps.getWarmupCompleted(), false);
    audit.controls.scheduleMainInteractiveLayerWarmup(); const second = audit.deps.getWarmupTimer(); assert.notEqual(first, second);
    const restore = {id: 'root-restore'}; audit.deps.setRestoreTimer(restore);
    managers[index].dispose(); assert.equal(audit.cleared[0], second); assert.equal(audit.cleared[1], restore);
    assert.equal(audit.deps.getWarmupTimer(), null); assert.equal(audit.deps.getRestoreTimer(), null);
    managers[index].dispose(); assert.equal(audit.cleared.length, 2); assemblies++;
  }
  assert.deepEqual(effects, []);
}
console.log(`Warmup root ownership/dispose passed (${assemblies} managers; real warm callback, controlled timers).`);
