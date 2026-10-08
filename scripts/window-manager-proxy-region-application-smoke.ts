import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const actual = require('../electron/windowManager/postDragInputProxyLifecycle.cjs').createPostDragInputProxyLifecycle;
const scenarios = [
  'normal', 'same-bounds', 'changed-x', 'changed-y', 'changed-width', 'changed-height',
  'cached-shape', 'visible-proxy', 'show-fallback', 'live-regions',
  'no-proxy', 'destroyed-proxy', 'not-ready', 'empty-regions', 'no-main', 'destroyed-main', 'hidden-main',
  'fail:main-bounds', 'fail:proxy-bounds', 'fail:set-bounds', 'fail:signature', 'fail:set-shape',
  'fail:show-inactive', 'fail:topmost', 'fail:log', 'fail:clear-timer',
];

export function exerciseProxyRegionApplication(factory = actual) {
  const results: unknown[] = [];
  for (const diagnostics of [false, true]) {
    for (const scenario of scenarios) results.push(runScenario(factory, diagnostics, scenario));
  }
  return results;
}

function runScenario(factory: any, diagnostics: boolean, scenario: string) {
  const calls: unknown[][] = [];
  const error = new Error('proxy dependency failed');
  error.stack = 'Error: proxy dependency failed';
  let failure = scenario.startsWith('fail:') ? scenario.slice(5) : undefined;
  function record(name: string, ...args: unknown[]) {
    calls.push([name, ...args]);
    if (failure === name) { failure = undefined; throw error; }
  }
  const mainBounds = { x: 10, y: -20, width: 400, height: 300 };
  let bounds = scenario === 'same-bounds' ? { ...mainBounds } : { x: 0, y: 0, width: 200, height: 100 };
  if (scenario.startsWith('changed-')) {
    bounds = { ...mainBounds };
    bounds[scenario.slice(8) as keyof typeof bounds] += 1;
  }
  let regions = scenario === 'empty-regions' ? [] : [{ x: 5, y: 6, width: 40, height: 30 }];
  const signature = (value: unknown) => JSON.stringify(value);
  let shapeSignature = scenario === 'cached-shape' ? signature(regions) : '';
  let visible = scenario === 'visible-proxy';
  let idleTimer: any = { unref: () => record('unref') };
  let pending: unknown = ['pending'];
  const main = {
    isDestroyed: () => { record('main-destroyed'); return scenario === 'destroyed-main'; },
    isVisible: () => { record('main-visible'); return scenario !== 'hidden-main'; },
    getBounds: () => {
      record('main-bounds');
      if (scenario === 'live-regions') regions = [{ x: 7, y: 8, width: 20, height: 10 }];
      return mainBounds;
    },
  };
  const proxy: any = {
    isDestroyed: () => { record('proxy-destroyed'); return scenario === 'destroyed-proxy'; },
    getBounds: () => { record('proxy-bounds'); return bounds; },
    setBounds: (value: typeof bounds) => { record('set-bounds', { ...value }); assert.equal(value, mainBounds); bounds = { ...value }; },
    setShape: (value: typeof regions) => { record('set-shape', [...value]); assert.equal(value, regions); },
    isVisible: () => { record('proxy-visible'); return visible; },
    showInactive: () => { record('show-inactive'); visible = true; },
    show: () => { record('show'); visible = true; },
    hide: () => { record('hide'); visible = false; },
  };
  if (scenario === 'show-fallback') proxy.showInactive = undefined;
  const proxyState = {
    getWindow: () => { record('get-proxy'); return scenario === 'no-proxy' ? null : proxy; },
    getReady: () => { record('ready'); return scenario !== 'not-ready'; },
    getRegions: () => { record('regions'); return regions; },
    setRegions: (value: typeof regions) => { record('set-regions', value); regions = value; },
    getShapeSignature: () => { record('get-signature'); return shapeSignature; },
    setShapeSignature: (value: string) => { record('cache-signature', value); shapeSignature = value; },
    getIdleDestroyTimer: () => { record('get-timer'); return idleTimer; },
    setIdleDestroyTimer: (value: any) => { record('set-timer', value === null ? null : 'timer'); idleTimer = value; },
    getPointerActive: () => { record('pointer-active'); return false; },
    setPendingRegions: (value: unknown) => { record('pending-regions', value); pending = value; },
  };
  const api = factory({
    proxyState, getMainWindow: () => { record('get-main'); return scenario === 'no-main' ? null : main; },
    pointerDiagnosticsEnabled: diagnostics,
    createInteractiveRegionsSignature: (value: typeof regions) => { record('signature', [...value]); return signature(value); },
    summarizeInteractiveRegion: (value: unknown) => { record('summary', value); return signature(value); },
    keepWindowOnTop: (win: unknown, level: number, options: unknown) => { assert.equal(win, proxy); record('topmost', level, options); },
    logWindowEvent: (message: string) => record('log', message),
    clearTimeout: () => record('clear-timer'),
    setTimeout: (_callback: unknown, delay: number) => { record('schedule', delay); return { unref: () => record('unref') }; },
    POST_DRAG_INPUT_PROXY_TOPMOST_RELATIVE_LEVEL: 5, POST_DRAG_INPUT_PROXY_IDLE_DESTROY_MS: 1000,
  });
  assert.deepEqual(calls, [], 'factory construction has no native or state effects');
  assert.equal(api.applyPostDragInputProxyRegions(), undefined);
  const first = [...calls];
  const guarded = ['no-proxy', 'destroyed-proxy', 'not-ready', 'empty-regions', 'no-main', 'destroyed-main', 'hidden-main'].includes(scenario);
  if (guarded) {
    assert.equal(first.some(([name]) => ['clear-timer', 'set-bounds', 'set-shape', 'show', 'show-inactive', 'topmost'].includes(name as string)), false);
  } else if (scenario.startsWith('fail:') && (scenario !== 'fail:log' || diagnostics)) {
    assert.ok(first.some(([name]) => name === 'hide'));
    assert.equal(shapeSignature, ''); assert.ok(Array.isArray(regions)); assert.equal(regions.length, 0); assert.equal(pending, null);
  } else {
    assert.equal(shapeSignature, signature(regions));
    assert.equal(first.some(([name]) => name === 'set-shape'), scenario !== 'cached-shape');
    assert.equal(first.some(([name]) => name === 'set-bounds'), scenario !== 'same-bounds');
    assert.equal(first.some(([name]) => name === 'topmost'), scenario !== 'visible-proxy');
    calls.length = 0;
    api.applyPostDragInputProxyRegions();
    assert.equal(calls.some(([name]) => ['set-bounds', 'set-shape', 'topmost'].includes(name as string)), false, 'unchanged geometry is cached');
  }
  return [diagnostics, scenario, first, [...calls], { regions, shapeSignature, visible, bounds, pending }];
}

const results = exerciseProxyRegionApplication();
console.log(`Proxy region application smoke passed (${results.length} scenarios; guards, bounds, shape cache, failures).`);
