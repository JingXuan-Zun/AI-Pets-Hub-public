import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const actual = createRequire(import.meta.url)('../electron/windowManager/postDragInputProxyRouting.cjs').createPostDragInputProxyRouting;
export function exerciseProxyRouting(factory = actual) {
  const results: unknown[] = [];
  for (const separated of [false, true]) for (const pointer of [false, true]) for (const drag of [false, true])
  for (const retained of [false, true]) for (const diagnostics of [false, true]) for (const region of ['empty', 'local', 'full'])
  for (const window of ['live', 'missing-main', 'destroyed-main', 'missing-proxy', 'destroyed-proxy', 'wrong-sender'])
  for (const type of ['mouseDown', 'mouseMove', 'mouseUp', 'mouseWheel', 'unsupported', 'null']) {
    results.push(run({ separated, pointer, drag, retained, diagnostics, region, window, type }));
  }
  for (const failure of ['normalize', 'full', 'pointer', 'drag', 'pending', 'set-pending', 'set-regions', 'regions',
    'hide', 'ensure', 'apply', 'log', 'main', 'proxy', 'destroyed', 'bounds', 'input', 'set-pointer', 'send', 'retained'])
  for (const type of ['mouseDown', 'mouseUp', 'mouseWheel']) for (const region of ['empty', 'local', 'full']) {
    results.push(run({ separated: true, pointer: true, drag: false, retained: false, diagnostics: true, region, window: 'live', type, failure }));
  }
  return results;
  function run(config: any) {
    const calls: unknown[][] = [], errors: string[] = [], error = new Error('routing dependency');
    let pointer = config.pointer, drag = config.drag, pending: any = [{ pending: true }], regions: any = [{ previous: true }];
    const step = (name: string, ...values: unknown[]) => { calls.push([name, ...values]); if (config.failure === name) throw error; };
    const proxy = { isDestroyed: () => { step('destroyed', 'proxy'); return config.window === 'destroyed-proxy'; }, webContents: {} };
    const main = { isDestroyed: () => { step('destroyed', 'main'); return config.window === 'destroyed-main'; },
      getContentBounds: () => { step('bounds'); return { width: 100, height: 80 }; },
      webContents: { sendInputEvent: (event: unknown) => step('input', event), send: (...values: unknown[]) => step('send', ...values) } };
    const dependencies = {
      proxyState: {
        getWindow: () => { step('proxy'); return config.window === 'missing-proxy' ? null : proxy; },
        getPointerActive: () => { step('pointer'); return pointer; },
        setPointerActive: (value: boolean) => { step('set-pointer', value); pointer = value; },
        getPendingRegions: () => { step('pending'); return pending; },
        setPendingRegions: (value: unknown) => { step('set-pending', value); pending = value; },
        getRegions: () => { step('regions'); return regions; }, setRegions: (value: unknown) => { step('set-regions', value); regions = value; },
      },
      getMainWindow: () => { step('main'); return config.window === 'missing-main' ? null : main; },
      getPetDragNativeShapeActive: () => { step('drag'); return drag; },
      normalizeInteractiveRegions: (value: unknown) => { step('normalize', value); return value; },
      isFullWindowInteractiveShape: (value: any[]) => { step('full', value); return value[0]?.full; },
      isPetDragFullWindowShapeRetained: () => { step('retained'); return config.retained; },
      hidePostDragInputProxy: (reason: string) => step('hide', reason), ensurePostDragInputProxyWindow: () => step('ensure'),
      applyPostDragInputProxyRegions: () => step('apply'), logWindowEvent: (message: string) => step('log', message),
      pointerDiagnosticsEnabled: config.diagnostics, USE_SEPARATE_RENDER_AND_INPUT_WINDOWS: config.separated,
    };
    const api = factory(dependencies);
    assert.deepEqual(calls, [], 'assembly must not query state or operate windows');
    assert.deepEqual(Object.keys(api), ['setPostDragInputProxyRegions', 'flushPostDragInputProxyPendingRegions',
      'requestPostDragInputProxyRegions', 'forwardPostDragInputProxyEvent']);
    const invoke = (label: string, fn: () => unknown) => { try { assert.equal(fn(), undefined); } catch (caught) { assert.equal(caught, error); errors.push(label); } };
    const next = config.region === 'empty' ? [] : [{ full: config.region === 'full', x: 2, y: 3, width: 12, height: 15 }];
    invoke('set', () => api.setPostDragInputProxyRegions(next));
    invoke('repeat', () => api.setPostDragInputProxyRegions(next));
    invoke('flush-active', () => api.flushPostDragInputProxyPendingRegions('active'));
    const event = config.type === 'null' ? null : { type: config.type, x: -10, y: 200, deltaX: '3', deltaY: '5', button: 'invalid', clickCount: 7, movementX: '2', movementY: -3 };
    const sender = config.window === 'wrong-sender' ? {} : proxy.webContents;
    invoke('event', () => api.forwardPostDragInputProxyEvent(sender, event));
    if (!config.failure && config.window === 'live' && ['mouseDown', 'mouseMove', 'mouseUp', 'mouseWheel'].includes(config.type)) {
      const output = calls.find(call => call[0] === 'input')?.[1] as any;
      assert.equal(output.x, 0); assert.equal(output.y, 79);
      if (config.type === 'mouseWheel') { assert.equal(output.deltaX, 3); assert.equal(output.deltaY, -5); }
      else { assert.equal(output.button, 'left'); assert.equal(output.clickCount, 3); assert.equal(output.movementX, 2); }
      if (config.type === 'mouseUp') assert.equal(pointer, false);
      if (config.type === 'mouseDown') assert.equal(pointer, true);
    }
    pointer = false; drag = false;
    invoke('flush-ended', () => api.flushPostDragInputProxyPendingRegions('ended'));
    invoke('flush-repeat', () => api.flushPostDragInputProxyPendingRegions('ended'));
    invoke('refresh', () => api.requestPostDragInputProxyRegions('probe'));
    return { calls, errors, pointer, pending, regions };
  }
}

const results = exerciseProxyRouting();
const source = fs.readFileSync('electron/windowManager/postDragInputProxyRouting.cjs', 'utf8');
for (const failure of [undefined, 'regions', 'forward']) {
  const calls: string[] = [], error = new Error('assembly');
  const dependencies = { proxyState: {}, getMainWindow: () => { throw new Error('no eager query'); } };
  const regionRouting = Object.fromEntries(['setPostDragInputProxyRegions', 'flushPostDragInputProxyPendingRegions', 'requestPostDragInputProxyRegions']
    .map(name => [name, () => { throw new Error('no eager action'); }]));
  const forward = () => { throw new Error('no eager forward'); };
  const module = { exports: {} as any };
  vm.runInNewContext(source, { module, require: () => ({
    createInputProxyRegionRouting: (input: unknown) => { calls.push('regions'); assert.equal(input, dependencies); if (failure === 'regions') throw error; return regionRouting; },
    createInputProxyEventForwarder: (input: any) => {
      calls.push('forward'); assert.equal(input.proxyState, dependencies.proxyState); assert.equal(input.getMainWindow, dependencies.getMainWindow);
      for (const [key, value] of Object.entries(regionRouting)) assert.equal(input[key], value);
      if (failure === 'forward') throw error; return forward;
    },
  }) });
  let result: any, caught: unknown;
  try { result = module.exports.createPostDragInputProxyRouting(dependencies); } catch (value) { caught = value; }
  assert.equal(caught, failure ? error : undefined);
  assert.deepEqual(calls, failure === 'regions' ? ['regions'] : ['regions', 'forward']);
  if (!failure) {
    for (const [key, value] of Object.entries(regionRouting)) assert.equal(result[key], value);
    assert.equal(result.forwardPostDragInputProxyEvent, forward);
  }
}
console.log(`Proxy routing passed (${results.length} region/pointer/window/event/error cases; shared state, lazy stages and return identities).`);
