import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const lifecycleStateSource = fs.readFileSync('electron/windowManager/mainWindowLifecycleStateAdapters.cjs', 'utf8');

const actualFactory = createRequire(import.meta.url)('../electron/windowManager/windowManagerDisposal.cjs').createWindowManagerDisposer;
export function exerciseWindowManagerDisposal(factory = actualFactory) {
const outcomes: unknown[] = [];
for (const proxyKind of ['missing', 'destroyed', 'live']) for (const trayKind of ['missing', 'destroyed', 'live'])
for (const ready of [null, 0, 'ready']) for (const refresh of [null, 0, 'refresh']) {
  const expected = ['guard', 'warmup', 'idle', 'hide'];
  if (proxyKind === 'live') expected.push('proxy-destroy');
  if (ready) expected.push('clear-ready', 'set-ready');
  if (refresh) expected.push('clear-refresh', 'set-refresh');
  if (trayKind === 'live') expected.push('tray-destroy');
  expected.push('set-tray');
  for (const failure of [undefined, ...expected]) {
    const calls: string[] = [], error = new Error('native failure');
    const step = (name: string) => { calls.push(name); if (name === failure) throw error; };
    let readyTimer = ready, refreshTimer = refresh, proxyDestroyed = proxyKind === 'destroyed', trayDestroyed = trayKind === 'destroyed';
    const proxy = proxyKind === 'missing' ? null : {
      isDestroyed: () => proxyDestroyed, destroy: () => { step('proxy-destroy'); proxyDestroyed = true; },
    };
    let tray = trayKind === 'missing' ? null : {
      isDestroyed: () => trayDestroyed, destroy: () => { step('tray-destroy'); trayDestroyed = true; },
    };
    const dispose = factory({
      stopMainTopmostGuard: () => step('guard'), clearMainInteractiveLayerWarmupTimers: () => step('warmup'),
      clearPostDragInputProxyIdleDestroyTimer: () => step('idle'),
      hidePostDragInputProxy: (reason: string, force: boolean) => {
        assert.equal(reason, 'window-manager-dispose'); assert.equal(force, true); step('hide');
      },
      getInputProxyWindow: () => proxy, getReadyFallbackTimer: () => readyTimer,
      setReadyFallbackTimer: (value: null) => { step('set-ready'); readyTimer = value; },
      getDisplayRefreshTimer: () => refreshTimer,
      setDisplayRefreshTimer: (value: null) => { step('set-refresh'); refreshTimer = value; },
      getTray: () => tray, setTray: (value: null) => { step('set-tray'); tray = value; },
      clearTimeout: (value: string) => step(`clear-${value}`),
    });
    assert.deepEqual(calls, [], 'assembly must not dispose eagerly');
    let firstCalls: string[] = [];
    if (failure) {
      assert.throws(dispose, (caught: unknown) => caught === error);
      assert.deepEqual(calls, expected.slice(0, expected.indexOf(failure) + 1)); firstCalls = [...calls];
    } else {
      assert.equal(dispose(), undefined); assert.deepEqual(calls, expected); firstCalls = [...calls];
      assert.equal(readyTimer, ready ? null : ready); assert.equal(refreshTimer, refresh ? null : refresh);
      assert.equal(tray, null);
      calls.length = 0; dispose();
      assert.deepEqual(calls, ['guard', 'warmup', 'idle', 'hide', 'set-tray']);
    }
    outcomes.push({proxyKind, trayKind, ready, refresh, failure: failure ?? null, firstCalls, calls, readyTimer, refreshTimer, proxyDestroyed, trayDestroyed, trayPresent: Boolean(tray)});
  }
}
return outcomes;
}
const cases = exerciseWindowManagerDisposal().length;
const root = fs.readFileSync('electron/windowManager.cjs', 'utf8');
const disposalSource = fs.readFileSync('electron/windowManager/windowManagerDisposal.cjs', 'utf8');
for (const binding of [
  'getInputProxyWindow: () => managerState.postDragInputProxyWindow',
  'getReadyFallbackTimer: () => managerState.mainWindowRendererReadyFallbackTimer',
  'setReadyFallbackTimer: (timer) => { managerState.mainWindowRendererReadyFallbackTimer = timer; }',
  'getDisplayRefreshTimer: () => managerState.settingsWindowDisplayRefreshTimer',
  'setDisplayRefreshTimer: (timer) => { managerState.settingsWindowDisplayRefreshTimer = timer; }',
  'getTray: () => managerState.tray, setTray: (value) => { managerState.tray = value; }',
]) assert.ok((disposalSource + lifecycleStateSource).includes(binding), binding);
assert.ok(root.includes('const dispose = createWindowManagerStateDisposer({'));
assert.ok(fs.readFileSync('electron/windowManager/windowManagerDisposal.cjs', 'utf8').split('\n').length <= 300);
console.log(`Window manager disposal smoke passed (${cases} resource, timer, repeated-disposal and failure-order cases).`);
