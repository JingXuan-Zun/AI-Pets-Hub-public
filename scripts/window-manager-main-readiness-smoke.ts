import { expandMainWindowLifecycleSource } from './windowManagerAuxiliaryAssemblySource.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const lifecycleStateSource = fs.readFileSync('electron/windowManager/mainWindowLifecycleStateAdapters.cjs', 'utf8');
const require = createRequire(import.meta.url);
const actual = require('../electron/windowManager/mainWindowReadiness.cjs').createMainWindowReadinessGate;

export function exerciseMainReadiness(factory = actual) {
  const outputs: unknown[] = [];
  for (const window of ['null', 'destroyed', 'normal']) for (const can of [false, true])
    for (const ready of [false, true]) for (const timer of [null, 0, 'pending', { id: 'timer' }])
      for (const reason of [undefined, null, 'avatar']) for (const method of ['show', 'mark']) {
        run({ window, can, ready, timer, reason, method });
      }
  const normal = { window: 'normal', can: true, ready: false, timer: 'pending', reason: 'avatar', method: 'mark' };
  for (const failure of ['window', 'destroyed', 'ready', 'setReady', 'reset', 'log', 'timer', 'clear', 'setTimer', 'can', 'show']) {
    run(normal, failure);
  }
  for (const failure of ['window', 'destroyed', 'can', 'ready', 'show']) run({ ...normal, ready: true, method: 'show' }, failure);
  run({ ...normal, can: false, method: 'show' }, 'log');
  for (const race of ['destroySwapsWindow', 'logClearsWindow', 'logDestroysWindow', 'logUnlocksElectron',
    'clearSwapsTimer', 'resetClearsWindow', 'showReplacesWindow', 'readyUnlocksElectron']) {
    run({ ...normal, can: race === 'logUnlocksElectron' || race === 'readyUnlocksElectron' ? false : normal.can }, undefined, race);
  }
  return JSON.parse(JSON.stringify(outputs));

  function run(config: any, failure?: string, race?: string) {
    const calls: unknown[][] = [], error = new Error('main readiness dependency error');
    let ready = config.ready, can = config.can, timer: any = config.timer, count = 7, destroyed = config.window === 'destroyed';
    let current: any, thrown = false;
    const step = (name: string, value?: unknown) => {
      calls.push([name, value]);
      if (name === failure) throw error;
      if (race === 'logClearsWindow' && name === 'log') current = null;
      if (race === 'logDestroysWindow' && name === 'log') destroyed = true;
      if (race === 'logUnlocksElectron' && name === 'log') can = true;
      if (race === 'clearSwapsTimer' && name === 'clear') timer = 'newer';
      if (race === 'resetClearsWindow' && name === 'reset') current = null;
      if (race === 'showReplacesWindow' && name === 'show') current = other;
      if (race === 'readyUnlocksElectron' && name === 'ready') can = true;
    };
    function window(id: string) {
      const win = { id, isDestroyed() { assert.equal(this, win); step('destroyed', id);
        if (race === 'destroySwapsWindow') current = other; return destroyed; } };
      return win;
    }
    const self = window('self'), other = window('other'); current = config.window === 'null' ? null : self;
    const deps = {
      getMainWindow() { step('window', current?.id ?? null); return current; },
      getCanShow() { step('can', can); return can; },
      getRendererReadyToShow() { step('ready', ready); return ready; },
      setRendererReadyToShow(value: boolean) { step('setReady', value); ready = value; },
      resetStartupRecoveryCount() { step('reset'); count = 0; },
      getReadyFallbackTimer() { step('timer', timer); return timer; },
      setReadyFallbackTimer(value: unknown) { step('setTimer', value); timer = value; },
      logWindowEvent(message: string) { step('log', message); },
      clearTimeout(value: unknown) { step('clear', value); },
      showMainWindow() { step('show'); return 'ignored-return'; },
    };
    const api = factory(deps);
    assert.deepEqual(calls, [], 'factory creation must not read state or perform actions');
    const invoke = config.method === 'show' ? api.showMainWindowWhenReady : api.markMainWindowReadyToShow;
    try {
      assert.equal(invoke(config.reason), undefined);
      if (!failure && !race && config.window === 'normal') {
        if (config.method === 'mark') {
          assert.equal(ready, true); assert.equal(count, config.ready ? 7 : 0);
          assert.equal(timer, config.timer ? null : config.timer);
          assert.equal(calls.filter(c => c[0] === 'show').length, can ? 1 : 0);
          assert.deepEqual(calls.filter(c => c[0] === 'clear').map(c => c[1]), config.timer ? [config.timer] : []);
          const readyLog = calls.find(c => c[0] === 'log' && String(c[1]).includes('renderer ready to show'));
          if (!config.ready) assert.equal(readyLog?.[1], `main-window: renderer ready to show reason=${config.reason === undefined ? 'renderer' : config.reason}`);
          const resets = calls.filter(c => c[0] === 'reset').length;
          assert.equal(api.markMainWindowReadyToShow('repeat'), undefined);
          assert.equal(calls.filter(c => c[0] === 'reset').length, resets, 'duplicate readiness must not reset the recovery count again');
        } else {
          assert.equal(ready, config.ready); assert.equal(count, 7); assert.equal(timer, config.timer);
          assert.equal(calls.filter(c => c[0] === 'show').length, can && ready ? 1 : 0);
          if (!can || !ready) assert.equal(calls.at(-1)?.[1], `main-window: waiting to show reason=${config.reason} electronReady=${can} rendererReady=${ready}`);
        }
        // A later call must read the new authoritative window and both readiness flags.
        current = other; can = true; ready = true;
        const at = calls.length; assert.equal(api.showMainWindowWhenReady('latest'), undefined);
        assert.deepEqual(calls[at], ['window', 'other']); assert.deepEqual(calls.at(-1), ['show', undefined]);
      }
      if (!failure && !race && config.window !== 'normal') {
        assert.equal(ready, config.ready); assert.equal(count, 7); assert.equal(timer, config.timer);
        assert.ok(calls.every(c => c[0] === 'window' || c[0] === 'destroyed'));
      }
    } catch (caught) {
      assert.ok(failure); assert.equal(caught, error); assert.equal(calls.at(-1)?.[0], failure); thrown = true;
    }
    assert.equal(thrown, Boolean(failure)); outputs.push({ config, failure, race, calls, ready, can, timer, count, window: current?.id ?? null, thrown });
  }
}

const root = expandMainWindowLifecycleSource(fs.readFileSync('electron/windowManager.cjs', 'utf8'));
for (const binding of [
  'getMainWindow: () => managerState.mainWindow', 'getCanShow: () => managerState.mainWindowCanShow',
  'getRendererReadyToShow: () => managerState.mainWindowRendererReadyToShow',
  'setRendererReadyToShow: (ready) => { managerState.mainWindowRendererReadyToShow = ready; }',
  'resetStartupRecoveryCount: () => { managerState.mainWindowRendererStartupRecoveryCount = 0; }',
  'getReadyFallbackTimer: () => managerState.mainWindowRendererReadyFallbackTimer',
  'setReadyFallbackTimer: (timer) => { managerState.mainWindowRendererReadyFallbackTimer = timer; }',
  'logWindowEvent, showMainWindow', 'clearTimeout: (timer) => clearTimeout(timer)',
]) assert.ok((root + lifecycleStateSource + fs.readFileSync('electron/windowManager/mainWindowRecoveryControllers.cjs', 'utf8')).includes(binding), `missing authoritative state binding: ${binding}`);
const start = root.indexOf('= createMainWindowStateRecoveryControllers(');
assert.ok(start > root.indexOf('const { logWindowEvent, attachLoadLogging }'));
const assembly=fs.readFileSync('electron/windowManager/mainWindowRecoveryControllers.cjs','utf8');
const controllerBody=assembly.slice(assembly.indexOf('function createMainWindowRecoveryControllers('));
assert.ok(controllerBody.indexOf('= createMainWindowReadinessGate(') < controllerBody.indexOf('= createMainWindowRecoveryCycle('));
assert.ok(start < root.indexOf('= createMainWindowStateCreationControllers('));
assert.ok(start < root.indexOf('= createAuxiliaryWindowContentControllers('));
assert.equal(exerciseMainReadiness().length, 313);
console.log('Main window readiness smoke passed (288 matrix + 17 dependency errors + 8 state changes).');
