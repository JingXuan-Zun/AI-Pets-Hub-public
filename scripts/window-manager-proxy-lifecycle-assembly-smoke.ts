import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const source = fs.readFileSync('electron/windowManager/postDragInputProxyLifecycle.cjs', 'utf8');
const stages = ['createInputProxyIdleLifecycle', 'createInputProxyRegionApplier', 'createInputProxyWindowCreator'];
for (const failure of [undefined, ...stages]) {
  const calls: string[] = [], outputs: Record<string, unknown> = {}, error = new Error('assembly failure');
  const dependencies = Object.fromEntries([
    'proxyState', 'getMainWindow', 'BrowserWindow', 'path', 'baseDirectory', 'sessionPartition',
    'disableDwmSystemBorderForWindow', 'keepWindowOnTop', 'logWindowEvent', 'pointerDiagnosticsEnabled',
    'createInteractiveRegionsSignature', 'summarizeInteractiveRegion', 'TOPMOST_WINDOW_LEVEL',
    'POST_DRAG_INPUT_PROXY_TOPMOST_RELATIVE_LEVEL', 'POST_DRAG_INPUT_PROXY_IDLE_DESTROY_MS', 'setTimeout', 'clearTimeout',
  ].map(key => [key, () => assert.fail(`must not eagerly use ${key}`)]));
  const modules = Object.fromEntries(stages.map((name, index) => [name, (input: Record<string, unknown>) => {
    calls.push(name);
    for (const [key, value] of Object.entries(input)) assert.equal(value, key in outputs ? outputs[key] : dependencies[key]);
    if (name === failure) throw error;
    const keys = index === 0 ? ['clearPostDragInputProxyIdleDestroyTimer', 'hidePostDragInputProxy']
      : index === 1 ? ['applyPostDragInputProxyRegions'] : ['ensurePostDragInputProxyWindow'];
    for (const key of keys) outputs[key] = () => assert.fail(`must not eagerly call ${key}`);
    return index === 0 ? Object.fromEntries(keys.map(key => [key, outputs[key]])) : outputs[keys[0]];
  }]));
  const module = { exports: {} as any };
  vm.runInNewContext(source, { module, require: () => modules });
  let result: any, caught: unknown;
  try { result = module.exports.createPostDragInputProxyLifecycle(dependencies); } catch (error) { caught = error; }
  assert.equal(caught, failure ? error : undefined);
  assert.deepEqual(calls, failure ? stages.slice(0, stages.indexOf(failure) + 1) : stages);
  if (!failure) {
    assert.equal(Object.keys(result).length, 4);
    for (const [key, value] of Object.entries(result)) assert.equal(value, outputs[key]);
  }
}
const factory = createRequire(import.meta.url)('../electron/windowManager/postDragInputProxyLifecycle.cjs').createPostDragInputProxyLifecycle;
export function exerciseProxyIdleLifecycle(actualFactory = factory) {
  const outputs: unknown[] = [];
  for (const windowKind of ['missing', 'destroyed', 'live']) for (const initialActive of [false, true])
  for (const force of [false, true]) for (const diagnostics of [false, true]) for (const initialTimer of [null, 0, 'idle'])
  for (const race of ['same', 'visible', 'active', 'missing', 'destroyed', 'replacement']) {
    const calls: unknown[][] = [];
    let regions: unknown[] = ['regions'], pending: unknown = ['pending'], signature = 'shape';
    let timer: any = initialTimer, active = initialActive, visible = true, destroyed = windowKind === 'destroyed';
    let callback: (() => void) | undefined;
    const win = { isDestroyed: () => destroyed, isVisible: () => visible,
      hide: () => { calls.push(['hide']); visible = false; }, destroy: () => calls.push(['destroy-original']) };
    const replacement = { isDestroyed: () => false, isVisible: () => false, destroy: () => calls.push(['destroy-replacement']) };
    let current: any = windowKind === 'missing' ? null : win;
    const api = actualFactory({
      proxyState: {
        getWindow: () => current, getPointerActive: () => active, getIdleDestroyTimer: () => timer,
        setIdleDestroyTimer: (value: unknown) => { calls.push(['timer', value === null ? null : 'new']); timer = value; },
        setRegions: (value: unknown[]) => { calls.push(['regions']); regions = value; },
        setPendingRegions: (value: unknown) => { calls.push(['pending']); pending = value; },
        setShapeSignature: (value: string) => { calls.push(['signature']); signature = value; },
      },
      pointerDiagnosticsEnabled: diagnostics, logWindowEvent: (message: string) => calls.push(['log', message]),
      POST_DRAG_INPUT_PROXY_IDLE_DESTROY_MS: 5000, clearTimeout: (value: unknown) => calls.push(['clear', value]),
      setTimeout: (fn: () => void, delay: number) => {
        assert.equal(delay, 5000); calls.push(['schedule', delay]); callback = fn;
        return { unref: () => calls.push(['unref']) };
      },
    });
    assert.deepEqual(calls, []);
    api.hidePostDragInputProxy('audit', force);
    if (initialActive && !force) { assert.deepEqual(calls, []); assert.deepEqual(regions, ['regions']); }
    else { assert.equal(regions.length, 0); assert.equal(pending, null); assert.equal(signature, ''); }
    const shouldSchedule = windowKind === 'live' && !initialActive;
    assert.equal(Boolean(callback), shouldSchedule);
    if (callback) {
      if (race === 'visible') visible = true;
      if (race === 'active') active = true;
      if (race === 'missing') current = null;
      if (race === 'destroyed') destroyed = true;
      if (race === 'replacement') current = replacement;
      callback(); assert.equal(timer, null);
      const destroys = calls.filter(call => String(call[0]).startsWith('destroy'));
      assert.deepEqual(destroys, race === 'same' ? [['destroy-original']] : race === 'replacement' ? [['destroy-replacement']] : []);
    }
    outputs.push({ windowKind, initialActive, force, diagnostics, initialTimer, race, calls, regions, pending, signature, timer: timer === null || timer === 0 || typeof timer === 'string' ? timer : 'new' });
  }
  return outputs;
}
console.log(`Proxy lifecycle assembly passed (three stages, state/controller identity, failures and ${exerciseProxyIdleLifecycle().length} hide/idle timer races).`);
