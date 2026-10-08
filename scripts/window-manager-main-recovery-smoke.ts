import { expandMainWindowLifecycleSource } from './windowManagerAuxiliaryAssemblySource.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const lifecycleStateSource = fs.readFileSync('electron/windowManager/mainWindowLifecycleStateAdapters.cjs', 'utf8');
const require = createRequire(import.meta.url);
const actual = require('../electron/windowManager/mainWindowRecovery.cjs');

export function exerciseMainRecovery(factories = actual) {
  const outputs: unknown[] = [];
  for (const quit of [false, true]) for (const window of ['null', 'destroyed', 'normal'])
    for (const matching of [false, true]) for (const recovery of [false, true])
      for (const reason of ['default', 'null', 'clean', 'crash', 'zero', 'coercion'])
        for (const webDestroyed of ['missing', false, true]) for (const reload of ['normal', 'throw', 'finish']) {
          run({ quit, window, matching, recovery, reason, webDestroyed, reload, method: 'recover' });
        }
  const normal = { quit: false, window: 'normal', matching: true, recovery: false, reason: 'crash', webDestroyed: false, reload: 'normal', method: 'recover' };
  for (const quit of [false, true]) for (const window of ['null', 'destroyed', 'normal']) run({ ...normal, quit, window, method: 'recreate' });
  for (const failure of ['quit', 'window', 'wDestroyed', 'contents', 'recovery', 'webDestroyGet', 'webDestroyed',
    'setRecoveryStart', 'logBegin', 'hideProxy', 'hide', 'ready', 'can', 'fallback', 'onceFinish', 'onceFail']) run(normal, failure);
  for (const failure of ['reasonGet', 'reasonString']) run({ ...normal, reason: 'coercion' }, failure);
  run(normal, 'reload');
  run({ ...normal, reload: 'throw' }, 'logError');
  for (const failure of ['setRecoveryFinish', 'logFinish']) run(normal, failure);
  for (const failure of ['setRecoveryFinish', 'logFinish']) run({ ...normal, reload: 'finish' }, failure);
  for (const failure of ['quit', 'logRecreate', 'hideProxy', 'window', 'wDestroyed', 'destroy', 'clearWindow', 'create']) run({ ...normal, method: 'recreate' }, failure);
  for (const race of ['logSwapsWindow', 'hideProxySwapsWindow', 'hideSwapsWindow', 'fallbackSwapsWindow',
    'onceSwapsWindow', 'reloadSwapsWindow', 'logQuits', 'failFirst', 'oldCallbackDuringNewRecovery', 'destroySwapsWindow', 'reloadFailsAfterFinish',
    'onceFiresFinish', 'webDestroyQuits', 'reasonSwapsWindow', 'completionAfterWindowCleared']) {
    run({ ...normal, method: race === 'destroySwapsWindow' ? 'recreate' : 'recover',
      webDestroyed: race === 'webDestroyQuits' ? true : normal.webDestroyed,
      reason: race === 'reasonSwapsWindow' ? 'coercion' : normal.reason,
      reload: race === 'logQuits' ? 'throw' : race === 'reloadFailsAfterFinish' ? 'finish-throw' : normal.reload }, undefined, race);
  }
  return JSON.parse(JSON.stringify(outputs));

  function run(config: any, failure?: string, race?: string) {
    const calls: unknown[][] = [], callbacks: Array<{ event: string; callback: () => void; id: string }> = [];
    const error = new Error('recovery dependency failure'); error.stack = 'fixed dependency failure stack';
    const reloadError = new Error('reload failed'); reloadError.stack = 'fixed reload failure stack';
    let quit = config.quit, recovery = config.recovery, ready = true, can = false, current: any, thrown = false, result: unknown;
    const step = (name: string, value?: unknown) => {
      calls.push([name, value]); if (name === failure) throw error;
      if ((race === 'logSwapsWindow' && name === 'logBegin') || (race === 'hideProxySwapsWindow' && name === 'hideProxy')
        || (race === 'hideSwapsWindow' && name === 'hide') || (race === 'fallbackSwapsWindow' && name === 'fallback')
        || (race === 'onceSwapsWindow' && name === 'onceFinish') || (race === 'reloadSwapsWindow' && name === 'reload')
        || (race === 'destroySwapsWindow' && name === 'destroy')
        || (race === 'reasonSwapsWindow' && name === 'reasonGet')) current = other;
      if (race === 'logQuits' && name === 'logBegin') quit = true;
      if (race === 'webDestroyQuits' && name === 'webDestroyed') quit = true;
    };
    function contents(id: string) {
      const wc = {
        id,
        get isDestroyed(): any {
          step('webDestroyGet', id);
          return config.webDestroyed === 'missing' ? undefined : function(this: unknown) {
            assert.equal(this, wc); step('webDestroyed', id); return config.webDestroyed;
          };
        },
        once(event: string, callback: () => void) {
          assert.equal(this, wc); step(event === 'did-finish-load' ? 'onceFinish' : 'onceFail', id);
          callbacks.push({ event, callback, id });
          if (race === 'onceFiresFinish' && event === 'did-finish-load') callback();
          return wc;
        },
        reloadIgnoringCache() {
          assert.equal(this, wc); step('reload', id);
          if (config.reload === 'finish' || config.reload === 'finish-throw') callbacks[0].callback();
          if (config.reload === 'throw' || config.reload === 'finish-throw') throw reloadError;
        },
      };
      return wc;
    }
    const selfContents = contents('self'), otherContents = contents('other');
    function window(id: string, wc: unknown) {
      const win = {
        id,
        isDestroyed() { assert.equal(this, win); step('wDestroyed', id); return config.window === 'destroyed'; },
        get webContents() { step('contents', id); return wc; },
        hide() { assert.equal(this, win); step('hide', id); },
        destroy() { assert.equal(this, win); step('destroy', id); },
      };
      return win;
    }
    const self = window('self', selfContents), other = window('other', otherContents);
    current = config.window === 'null' ? null : self;
    const deps = {
      getIsQuitting() { step('quit', quit); return quit; },
      getMainWindow() { step('window', current?.id ?? null); return current; },
      clearMainWindow() { step('clearWindow'); current = null; },
      getRendererRecoveryInProgress() { step('recovery', recovery); return recovery; },
      setRendererRecoveryInProgress(value: boolean) { step(value ? 'setRecoveryStart' : 'setRecoveryFinish'); recovery = value; },
      setRendererReadyToShow(value: boolean) { step('ready', value); ready = value; },
      markMainWindowCanShow() { step('can'); can = true; },
      logWindowEvent(message: string) {
        const name = message.includes('recreate reason=') ? 'logRecreate' : message.includes('recovery begin') ? 'logBegin'
          : message.includes('recovery error=') ? 'logError' : 'logFinish'; step(name, message);
      },
      hidePostDragInputProxy(reason: string, force: boolean) { assert.equal(reason, 'main-renderer-recovery'); assert.equal(force, true); step('hideProxy'); },
      createWindow() { assert.equal(current, null); step('create'); current = window('created', selfContents); recovery = false; ready = false; can = false; return current; },
      scheduleMainWindowRendererReadyFallback() { step('fallback'); },
    };
    const recreate = factories.createMainWindowRecreator(deps);
    const recover = factories.createMainWindowRendererRecovery({ ...deps, recreateMainWindow: recreate });
    assert.deepEqual(calls, [], 'factory construction must not read or write owner state');
    assert.equal(recreate.name, 'recreateMainWindow'); assert.equal(recover.name, 'recoverMainWindowRenderer');
    const details = config.reason === 'default' ? undefined : config.reason === 'null' ? null
      : config.reason === 'coercion' ? { get reason() { step('reasonGet'); return { toString() { step('reasonString'); return 'coerced'; } }; } }
        : { reason: config.reason === 'clean' ? 'clean-exit' : config.reason === 'zero' ? 0 : 'crash' };
    try {
      result = config.method === 'recreate' ? recreate('manual') : recover(config.matching ? selfContents : otherContents, details);
      if (!failure && !race) {
        const eligible = config.method === 'recreate' ? !config.quit : !config.quit && config.window === 'normal'
          && config.matching && !config.recovery && config.reason !== 'clean';
        assert.equal(result, eligible);
        if (eligible && config.method === 'recover') {
          const reason = ['default', 'null', 'zero'].includes(config.reason) ? 'unknown' : config.reason === 'coercion' ? 'coerced' : 'crash';
          if (config.webDestroyed !== true) assert.deepEqual(calls.find(c => c[0] === 'logBegin'), ['logBegin', `main-window: renderer recovery begin reason=${reason}`]);
          if (config.webDestroyed === true || config.reload === 'throw') {
            assert.deepEqual(calls.find(c => c[0] === 'logRecreate'), ['logRecreate', `main-window: recreate reason=${reason}-${config.webDestroyed === true ? 'web-contents-destroyed' : 'reload-failed'}`]);
          }
        }
        if (!eligible) {
          assert.equal(current, config.window === 'null' ? null : self); assert.equal(recovery, config.recovery); assert.equal(ready, true); assert.equal(can, false);
          assert.ok(!calls.some(c => ['hide', 'hideProxy', 'reload', 'create', 'setRecoveryStart', 'clearWindow'].includes(String(c[0]))));
        } else if (config.method === 'recreate' || config.webDestroyed === true || config.reload === 'throw') {
          assert.equal(current.id, 'created'); assert.equal(recovery, false);
          assert.deepEqual(calls.slice(-2).map(c => c[0]), ['clearWindow', 'create']);
        } else {
          assert.equal(ready, false); assert.equal(can, true); assert.equal(recovery, config.reload !== 'finish');
          const steps = calls.map(c => c[0]);
          assert.ok(steps.indexOf('hideProxy') < steps.indexOf('reload'));
          assert.ok(steps.indexOf('setRecoveryStart') < steps.indexOf('logBegin'));
          assert.deepEqual(callbacks.map(c => c.event), ['did-finish-load', 'did-fail-load']);
        }
      }
      if (race === 'oldCallbackDuringNewRecovery') {
        recovery = false; assert.equal(recover(selfContents, { reason: 'next' }), true); assert.equal(recovery, true);
        callbacks[0].callback(); assert.equal(recovery, false, 'original old callback writes the current recovery flag');
        callbacks[2].callback(); callbacks[1].callback(); callbacks[3].callback();
        assert.equal(calls.filter(c => c[0] === 'logFinish').length, 2);
      } else if (callbacks.length) {
        if (race === 'completionAfterWindowCleared') current = null;
        const order = race === 'failFirst' ? [1, 0, 1] : [0, 1, 0];
        for (const index of order) assert.equal(callbacks[index].callback(), undefined);
        assert.equal(calls.filter(c => c[0] === 'logFinish').length, failure === 'setRecoveryFinish' && config.reload === 'finish' ? 0 : 1, 'completion side effects must happen at most once');
        if (race === 'failFirst') assert.match(String(calls.find(c => c[0] === 'logFinish')?.[1]), /load-failed reason=/);
      }
      if (failure === 'reload' || (['setRecoveryFinish', 'logFinish'].includes(failure ?? '') && config.reload === 'finish')) {
        assert.ok(calls.some(c => c[0] === 'logError' && String(c[1]).includes(error.stack!)));
      }
    } catch (caught) { assert.ok(failure); assert.equal(caught, error); assert.equal(calls.at(-1)?.[0], failure); thrown = true; }
    const caughtInsideReload = failure === 'reload' || (['setRecoveryFinish', 'logFinish'].includes(failure ?? '') && config.reload === 'finish');
    assert.equal(thrown, Boolean(failure && !caughtInsideReload));
    outputs.push({ config, failure, race, calls, result, quit, recovery, ready, can, window: current?.id ?? null, thrown });
  }
}

const root = expandMainWindowLifecycleSource(fs.readFileSync('electron/windowManager.cjs', 'utf8'));
for (const binding of ['getIsQuitting: () => managerState.isQuitting', 'getMainWindow: () => managerState.mainWindow', 'clearMainWindow: () => { managerState.mainWindow = null; }',
  'getRendererRecoveryInProgress: () => managerState.mainWindowRendererRecoveryInProgress',
  'setRendererRecoveryInProgress: (active) => { managerState.mainWindowRendererRecoveryInProgress = active; }',
  'setRendererReadyToShow: (ready) => { managerState.mainWindowRendererReadyToShow = ready; }', 'markMainWindowCanShow: () => { managerState.mainWindowCanShow = true; }',
  'createWindowForRecovery: () => createWindow()']) assert.ok((root + lifecycleStateSource + fs.readFileSync('electron/windowManager/mainWindowRecoveryControllers.cjs', 'utf8')).includes(binding));
const assembly=fs.readFileSync('electron/windowManager/mainWindowRecoveryControllers.cjs','utf8');
assert.match(assembly,/scheduleMainWindowRendererReadyFallback: \(\) => scheduleMainWindowRendererReadyFallback\(\)/);
const recreateStart = assembly.indexOf('const recreateMainWindow = createMainWindowRecreator(');
const recoverStart = assembly.indexOf('const recoverMainWindowRenderer = createMainWindowRendererRecovery(');
const start=root.indexOf('= createMainWindowStateRecoveryControllers(');
assert.ok(start > root.indexOf('const { logWindowEvent, attachLoadLogging }'));
assert.ok(recoverStart > recreateStart && recoverStart < assembly.indexOf('const scheduleMainWindowRendererReadyFallback ='));
assert.ok(start < root.indexOf('= createMainWindowStateCreationControllers('));
assert.equal(exerciseMainRecovery().length, 1349);
console.log('Main recovery smoke passed (1296 recovery + 6 recreate cases, 32 dependency errors, 15 state/callback races).');
