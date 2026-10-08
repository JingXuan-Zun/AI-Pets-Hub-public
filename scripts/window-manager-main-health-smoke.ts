import { expandMainWindowLifecycleSource } from './windowManagerAuxiliaryAssemblySource.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const lifecycleStateSource = fs.readFileSync('electron/windowManager/mainWindowLifecycleStateAdapters.cjs', 'utf8');
const require = createRequire(import.meta.url);
const actual = require('../electron/windowManager/mainWindowHealth.cjs').createMainWindowHealthPresenter;

export async function exerciseMainHealth(factory = actual) {
  const outputs: unknown[] = [];
  const normal = { window: 'normal', contents: 'normal', recovery: false, loading: false, outcome: 'resolve', handle: 'object', reason: 'again', rejection: 'error' };
  for (const window of ['null', 'destroyed', 'normal']) for (const contents of ['null', 'destroyed', 'normal'])
    for (const recovery of [false, true]) for (const loading of ['missing', false, true]) for (const reason of [undefined, null, 'again']) {
      await run({ ...normal, window, contents, recovery, loading, reason });
    }
  for (const outcome of ['resolve', 'reject', 'throw', 'timeout', 'thenable', 'deferred-resolve', 'deferred-reject'])
    for (const handle of ['null', 'zero', 'object']) for (const reason of [undefined, null, 'again']) await run({ ...normal, outcome, handle, reason });
  for (const failure of ['window', 'wDestroyed', 'contents', 'webDestroyed', 'recovery', 'loadingGet', 'loading']) await run(normal, failure);
  await run({ ...normal, window: 'null' }, 'create');
  await run({ ...normal, contents: 'null' }, 'recreate');
  await run({ ...normal, loading: true }, 'loadingShow');
  for (const failure of ['execGet', 'exec', 'timer', 'show']) await run(normal, failure);
  await run({ ...normal, outcome: 'deferred-resolve' }, 'timer');
  await run({ ...normal, outcome: 'thenable' }, 'then');
  for (const failure of ['log', 'recover', 'clear']) await run({ ...normal, outcome: failure === 'clear' ? 'resolve' : 'reject' }, failure);
  for (const rejection of ['null', 'string', 'falsy', 'getter']) await run({ ...normal, outcome: 'reject', rejection });
  await run({ ...normal, outcome: 'reject', rejection: 'getter' }, 'errorMessage');
  await run({ ...normal, outcome: 'reject', rejection: 'falsy' }, 'errorString');
  await run({ ...normal, loading: true, reason: 'coercion' }, 'reasonString');
  await run({ ...normal, outcome: 'reject', reason: 'coercion' }, 'reasonString');
  for (const race of ['destroySwapsWindow', 'contentsSwapsWindow', 'loadingSwapsWindow', 'execSwapsWindow', 'timerSwapsWindow',
    'pendingSwapsWindow', 'pendingDestroysWindow', 'pendingClearsWindow', 'logSwapsWindow', 'recoverSwapsWindow',
    'successBeforeTimeout', 'timeoutBeforeSuccess', 'timeoutThenLateSuccess', 'successThenLateTimeout', 'overlappingCalls']) {
    await run({ ...normal, outcome: ['logSwapsWindow', 'recoverSwapsWindow'].includes(race) ? 'reject'
      : race.startsWith('pending') || ['successBeforeTimeout', 'timeoutBeforeSuccess', 'timeoutThenLateSuccess', 'overlappingCalls'].includes(race) ? 'deferred-resolve' : normal.outcome }, undefined, race);
  }
  await run({ ...normal, loading: 'truthy' }, undefined, undefined, true);
  await run({ ...normal, contents: 'missing-method' }, undefined, undefined, true);
  return JSON.parse(JSON.stringify(outputs));

  async function run(config: any, failure?: string, race?: string, nativeError = false) {
    const calls: unknown[][] = [], callbacks: Array<() => void> = [], handles: any[] = [];
    const requests: Array<{ resolve: (value: unknown) => void; reject: (value: unknown) => void }> = [];
    const error = new Error('health dependency failure'), probeError = new Error('probe failed');
    let current: any, recovery = config.recovery, destroyed = config.window === 'destroyed';
    let result: any, rejected: any, rejectionIdentity: unknown;
    const step = (name: string, value?: unknown) => {
      calls.push([name, value]); if (name === failure) throw error;
      if ((race === 'destroySwapsWindow' && name === 'wDestroyed') || (race === 'contentsSwapsWindow' && name === 'contents')
        || (race === 'loadingSwapsWindow' && name === 'loading') || (race === 'execSwapsWindow' && name === 'exec')
        || (race === 'timerSwapsWindow' && name === 'timer') || (race === 'logSwapsWindow' && name === 'log')
        || (race === 'recoverSwapsWindow' && name === 'recover')) current = other;
    };
    const probeRejection = config.rejection === 'null' ? null : config.rejection === 'string' ? 'probe string'
      : config.rejection === 'falsy' ? { message: '', toString() { step('errorString'); return 'fallback rejection'; } }
        : config.rejection === 'getter' ? { get message() { step('errorMessage'); return 'custom rejection'; } } : probeError;
    function contents(id: string) {
      const wc = {
        id,
        isDestroyed: config.contents === 'missing-method' ? undefined : function(this: unknown) { assert.equal(this, wc); step('webDestroyed', id); return config.contents === 'destroyed'; },
        get isLoadingMainFrame(): any {
          step('loadingGet', id); return config.loading === 'missing' ? undefined : config.loading === 'truthy' ? true
            : function(this: unknown) { assert.equal(this, wc); step('loading', id); return config.loading; };
        },
        get executeJavaScript() {
          step('execGet', id);
          return function(this: unknown, code: string, userGesture: boolean) {
            assert.equal(this, wc); assert.equal(code, 'document.readyState'); assert.equal(userGesture, true); step('exec', id);
            if (config.outcome === 'throw') throw probeError;
            if (config.outcome === 'reject') return Promise.reject(probeRejection);
            if (config.outcome === 'thenable') return { then(resolve: (value: unknown) => void) { step('then', id); resolve('complete'); } };
            if (config.outcome === 'timeout' || config.outcome.startsWith('deferred')) return new Promise((resolve, reject) => requests.push({ resolve, reject }));
            return Promise.resolve('complete');
          };
        },
      };
      return wc;
    }
    const selfContents = contents('self'), otherContents = contents('other');
    function window(id: string, wc: unknown) {
      const win = { id, isDestroyed() { assert.equal(this, win); step('wDestroyed', id); return destroyed; },
        get webContents() { step('contents', id); return config.contents === 'null' ? null : wc; } };
      return win;
    }
    const self = window('self', selfContents), other = window('other', otherContents);
    current = config.window === 'null' ? null : self;
    const deps = {
      getMainWindow() { step('window', current?.id ?? null); return current; },
      getRendererRecoveryInProgress() { step('recovery', recovery); return recovery; },
      createWindow() { step('create'); return 'ignored'; },
      recreateMainWindow(reason: string) { step('recreate', reason); return false; },
      showMainWindowWhenReady(reason: string) { step('loadingShow', reason); return 'ignored'; },
      showMainWindow() { step('show', current?.id ?? null); return 'ignored'; },
      logWindowEvent(message: string) { step('log', message); },
      recoverMainWindowRenderer(wc: any, details: unknown) {
        assert.ok(wc === selfContents || wc === otherContents); step('recover', { id: wc.id, details }); return false;
      },
      setTimeout(callback: () => void, delay: number) {
        step('timer', delay); assert.equal(delay, 1500); callbacks.push(callback);
        const handle = config.handle === 'null' ? null : config.handle === 'zero' ? 0
          : { id: 'timer-' + callbacks.length, get unref() { assert.fail('health timeout must not acquire an unref operation'); } };
        handles.push(handle); return handle;
      },
      clearTimeout(handle: any) { assert.ok(handles.includes(handle)); step('clear', handle.id); },
      MAIN_WINDOW_RENDERER_HEALTH_TIMEOUT_MS: 1500,
    };
    const show = factory(deps); assert.deepEqual(calls, [], 'factory must not read state or start probes');
    assert.equal(show.name, 'showOrRecoverMainWindow'); assert.equal(show.length, 0);
    const reason = config.reason === 'coercion' ? { toString() { step('reasonString'); return 'coerced'; } } : config.reason;
    const promise = show(reason); assert.ok(promise instanceof Promise);
    const settled = promise.then((value: unknown) => { result = value; }, (caught: any) => {
      rejectionIdentity = caught; rejected = { name: caught?.name, message: caught?.message };
    });
    if (race === 'overlappingCalls') {
      assert.equal(requests.length, 1); current = other;
      const second = show('second'); assert.ok(second instanceof Promise); assert.notEqual(second, promise);
      const secondSettled = second.then((value: unknown) => value);
      assert.equal(requests.length, 2); assert.equal(callbacks.length, 2);
      callbacks[0](); requests[1].resolve('complete'); await settled;
      const secondResult = await secondSettled; assert.equal(result, 'recovering'); assert.equal(secondResult, 'shown');
      assert.deepEqual(calls.filter(c => c[0] === 'clear').map(c => c[1]), ['timer-1', 'timer-2']);
      assert.deepEqual(calls.find(c => c[0] === 'recover')?.[1], { id: 'self', details: { reason: 'again-unresponsive' } });
      result = [result, secondResult];
    } else {
      if (requests.length) {
        assert.ok(!calls.some(c => c[0] === 'show' || c[0] === 'recover'), 'pending probe must defer display/recovery');
        if (race === 'pendingSwapsWindow') { current = other; recovery = true; }
        if (race === 'pendingDestroysWindow') destroyed = true;
        if (race === 'pendingClearsWindow') current = null;
        if (config.outcome === 'timeout' || race === 'timeoutBeforeSuccess' || race === 'timeoutThenLateSuccess') {
          if (callbacks.length) callbacks[0]();
          if (race === 'timeoutBeforeSuccess') requests[0].resolve('complete');
        } else if (config.outcome === 'deferred-reject') requests[0].reject(probeRejection);
        else {
          requests[0].resolve('complete');
          if (race === 'successBeforeTimeout') callbacks[0]();
        }
      }
      await settled;
      const beforeLate = calls.length;
      if (race === 'successThenLateTimeout' && callbacks.length) callbacks[0]();
      if (race === 'timeoutThenLateSuccess') requests[0].resolve('late');
      await Promise.resolve(); await Promise.resolve();
      assert.equal(calls.length, beforeLate, 'settled race must not run display or recovery a second time');
    }
    const caughtFailures = ['execGet', 'exec', 'timer', 'show', 'then'];
    const shouldReject = nativeError || Boolean(failure && !caughtFailures.includes(failure));
    assert.equal(Boolean(rejected), shouldReject);
    if (shouldReject) {
      if (nativeError) assert.equal(rejectionIdentity instanceof TypeError, true);
      else assert.equal(rejectionIdentity, error);
    } else if (!race) {
      const expected = config.window !== 'normal' ? 'created' : config.contents === 'null' || config.contents === 'destroyed' ? 'recreated'
        : config.recovery || config.loading === true ? 'loading'
          : (failure && !(failure === 'timer' && config.outcome === 'resolve')) || ['reject', 'throw', 'timeout', 'deferred-reject'].includes(config.outcome) ? 'recovering' : 'shown';
      assert.equal(result, expected);
      const label = config.reason === undefined ? 'manual' : config.reason;
      if (expected === 'recreated') assert.deepEqual(calls.at(-1), ['recreate', `${label}-web-contents-unavailable`]);
      if (expected === 'loading') assert.deepEqual(calls.at(-1), ['loadingShow', `${label}-loading`]);
      if (expected === 'recovering') {
        assert.deepEqual(calls.find(c => c[0] === 'recover')?.[1], { id: 'self', details: { reason: `${label}-unresponsive` } });
        const message = failure ? error.message : config.outcome === 'timeout' ? 'main renderer health check timed out'
          : config.rejection === 'null' ? 'null' : config.rejection === 'string' ? 'probe string'
            : config.rejection === 'falsy' ? 'fallback rejection' : config.rejection === 'getter' ? 'custom rejection' : probeError.message;
        assert.deepEqual(calls.find(c => c[0] === 'log'), ['log', `main-window: renderer health check failed reason=${label} error=${message}`]);
      }
    }
    if (race === 'successBeforeTimeout' || race?.startsWith('pending')) assert.equal(result, 'shown');
    if (race === 'timeoutBeforeSuccess' || race === 'timeoutThenLateSuccess') assert.equal(result, 'recovering');
    if (race === 'logSwapsWindow' || race === 'recoverSwapsWindow') assert.deepEqual(calls.find(c => c[0] === 'recover')?.[1], { id: 'self', details: { reason: 'again-unresponsive' } });
    assert.equal(calls.filter(c => c[0] === 'clear').length, handles.filter(Boolean).length, 'each truthy local timeout must be cleared even on rejection');
    if (handles.some(Boolean)) assert.equal(calls.at(-1)?.[0], 'clear');
    outputs.push({ config, failure, race, nativeError, calls, result, rejected, recovery, destroyed, window: current?.id ?? null });
  }
}

const root = expandMainWindowLifecycleSource(fs.readFileSync('electron/windowManager.cjs', 'utf8'));
const assembly=fs.readFileSync('electron/windowManager/mainWindowRecoveryControllers.cjs','utf8');
const healthStart=assembly.indexOf('const showOrRecoverMainWindow = createMainWindowHealthPresenter({');
assert.ok(healthStart > assembly.indexOf('const recoverMainWindowRenderer ='));
assert.ok(healthStart > assembly.indexOf('= createMainWindowReadinessGate('));
const start = root.indexOf('= createMainWindowStateRecoveryControllers(');
assert.ok(start < root.indexOf('= createMainWindowStateCreationControllers('));
const bindings = root.slice(start, root.indexOf('= createMainWindowStateCreationControllers('));
for (const binding of ['getMainWindow: () => managerState.mainWindow', 'getRendererRecoveryInProgress: () => managerState.mainWindowRendererRecoveryInProgress',
  'createWindowForHealth: () => createWindow()', 'logWindowEvent, showMainWindow',
  'setTimeout: (callback, delay) => setTimeout(callback, delay)', 'clearTimeout: (timer) => clearTimeout(timer)',
  'MAIN_WINDOW_RENDERER_HEALTH_TIMEOUT_MS']) assert.ok((bindings + lifecycleStateSource).includes(binding));
assert.match(assembly,/createWindow, recreateMainWindow, showMainWindowWhenReady, showMainWindow/);
assert.match(assembly,/logWindowEvent, recoverMainWindowRenderer, setTimeout, clearTimeout/);
const creation = fs.readFileSync('electron/windowManager/mainWindowCreation.cjs', 'utf8');
assert.match(root, /const createWindow = createMainWindowStateCreationControllers\(/);
const creationAssembly=fs.readFileSync('electron/windowManager/mainWindowCreationControllers.cjs','utf8');
assert.match(creationAssembly, /showOrRecoverMainWindow, BrowserWindow, buildMainWindowOptions, attachLoadLogging,/);
assert.match(creation, /void showOrRecoverMainWindow\('create-existing-window'\)/);
const outputs = await exerciseMainHealth();
assert.equal(outputs.length, 269);
console.log('Main health smoke passed (162 branches, 63 probes, 23 dependency failures, 4 rejection values, 15 async races, 2 native errors).');
