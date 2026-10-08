import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const actual = require('../electron/windowManager/postDragInputProxyLifecycle.cjs').createPostDragInputProxyLifecycle;
const scenarios = ['create', 'reuse', 'replace-destroyed', 'no-main', 'destroyed-main', 'negative-bounds',
  'dwm-skipped', 'closed', 'stale-closed', 'stale-ready', 'load-failed',
  'fail:constructor', 'fail:opacity', 'fail:dwm', 'fail:topmost', 'fail:workspaces', 'fail:load'];

export function exerciseProxyCreation(factory = actual) {
  const results: unknown[] = [];
  for (const partition of [undefined, '', 'persist:proxy']) {
    for (const diagnostics of [false, true]) {
      for (const scenario of scenarios) results.push(runCreation(factory, partition, diagnostics, scenario));
    }
  }
  return results;
}

function runCreation(factory: any, partition: string | undefined, diagnostics: boolean, scenario: string) {
  const calls: unknown[][] = [];
  const error = new Error('proxy creation failure');
  error.stack = 'Error: proxy creation failure';
  const record = (name: string, ...args: unknown[]) => {
    calls.push([name, ...args]);
    if (scenario === `fail:${name}`) throw error;
  };
  let current: any = null, ready = true, pointerActive = true;
  let idleTimer: any = 'idle-timer';
  let regions: unknown = ['original'], pending: unknown = ['pending'], signature = 'original';
  const handlers = new Map<string, () => void>();
  let loaded: ((error: Error) => void) | undefined, dwm: ((value: unknown) => void) | undefined;
  let options: any;
  const created: any = {
    id: 'created', isDestroyed: () => { record('proxy-destroyed'); return false; },
    isVisible: () => false,
    setOpacity: (value: unknown) => record('opacity', value),
    setAlwaysOnTop: (...args: unknown[]) => record('topmost', ...args),
    setVisibleOnAllWorkspaces: (...args: unknown[]) => record('workspaces', ...args),
    webContents: { once: (event: string, fn: () => void) => { record('once', event); handlers.set(event, fn); } },
    on: (event: string, fn: () => void) => { record('on', event); handlers.set(event, fn); },
    loadURL: (url: string) => { record('load', url); return { catch: (fn: typeof loaded) => { loaded = fn; } }; },
    hide: () => record('hide'),
  };
  const mainBounds = scenario === 'negative-bounds'
    ? { x: -1920, y: -100, width: 500, height: 600 } : { x: 20, y: 30, width: 400, height: 300 };
  const main = {
    isDestroyed: () => { record('main-destroyed'); return scenario === 'destroyed-main'; },
    getBounds: () => { record('bounds'); return mainBounds; },
    isVisible: () => false,
  };
  if (scenario === 'reuse' || scenario === 'replace-destroyed') {
    current = { id: 'previous', isDestroyed: () => { record('previous-destroyed'); return scenario === 'replace-destroyed'; } };
  }
  const previous = current;
  const proxyState = {
    getWindow: () => { record('get-window'); return current; },
    setWindow: (value: any) => { record('set-window', value?.id ?? null); current = value; },
    getReady: () => ready, setReady: (value: boolean) => { record('ready', value); ready = value; },
    getPointerActive: () => pointerActive, setPointerActive: (value: boolean) => { record('pointer', value); pointerActive = value; },
    getIdleDestroyTimer: () => { record('get-timer'); return idleTimer; },
    setIdleDestroyTimer: (value: any) => { record('set-timer', value === null ? null : 'scheduled'); idleTimer = value; },
    getRegions: () => regions, setRegions: (value: unknown) => { record('regions', value); regions = value; },
    setPendingRegions: (value: unknown) => { record('pending', value); pending = value; },
    setShapeSignature: (value: string) => { record('signature', value); signature = value; },
  };
  const api = factory({
    proxyState, getMainWindow: () => { record('get-main'); return scenario === 'no-main' ? null : main; },
    BrowserWindow: function(value: unknown) { record('constructor', value); options = value; return created; },
    path: { join: (...args: string[]) => { record('join', ...args); return path.win32.join(...args); } },
    baseDirectory: 'C:\\proxy-fixture', sessionPartition: partition,
    disableDwmSystemBorderForWindow: (win: unknown) => {
      assert.equal(win, created); record('dwm'); return { then: (fn: typeof dwm) => { dwm = fn; } };
    },
    logWindowEvent: (message: string) => record('log', message), pointerDiagnosticsEnabled: diagnostics,
    clearTimeout: () => record('clear-timer'),
    setTimeout: (_fn: unknown, ms: number) => { record('timer', ms); return { unref: () => record('unref') }; },
    TOPMOST_WINDOW_LEVEL: 'screen-saver', POST_DRAG_INPUT_PROXY_TOPMOST_RELATIVE_LEVEL: 5,
    POST_DRAG_INPUT_PROXY_IDLE_DESTROY_MS: 1000,
  });
  assert.deepEqual(calls, [], 'factory does not create windows');
  let result: unknown, failed = false;
  try { result = api.ensurePostDragInputProxyWindow(); } catch (caught) { assert.equal(caught, error); failed = true; }
  assert.equal(failed, scenario.startsWith('fail:'));
  if (!failed) {
    if (scenario === 'reuse') { assert.equal(result, previous); assert.equal(options, undefined); }
    else if (scenario === 'no-main' || scenario === 'destroyed-main') { assert.equal(result, null); assert.equal(options, undefined); }
    else {
      assert.equal(result, created); assert.equal(current, created);
      assert.equal(ready, false); assert.equal(pointerActive, false);
      assert.equal(options.opacity, 0.01); assert.equal(options.focusable, false); assert.equal(options.show, false);
      assert.equal(options.webPreferences.contextIsolation, true); assert.equal(options.webPreferences.nodeIntegration, false);
      assert.equal(options.webPreferences.partition, partition || undefined);
      assert.equal(options.webPreferences.preload, path.win32.join('C:\\proxy-fixture', 'postDragInputProxyPreload.cjs'));
      for (const key of ['x', 'y', 'width', 'height']) assert.equal(options[key], mainBounds[key as keyof typeof mainBounds]);
      dwm?.({ applied: scenario !== 'dwm-skipped', reason: 'fixture' });
      if (scenario.startsWith('stale-')) current = previous;
      if (scenario === 'closed' || scenario === 'stale-closed') handlers.get('closed')?.();
      else if (scenario === 'load-failed') loaded?.(error);
      else handlers.get('did-finish-load')?.();
      if (scenario === 'closed') {
        assert.equal(current, null); assert.equal(ready, false); assert.equal(signature, ''); assert.equal(pending, null);
      } else if (scenario === 'stale-ready') assert.equal(ready, false);
      else if (scenario === 'stale-closed') assert.equal(signature, 'original');
      else if (scenario === 'load-failed') assert.equal(signature, '');
      else assert.equal(ready, true);
    }
  }
  return [partition ?? null, diagnostics, scenario, calls, { failed, result: (result as any)?.id ?? result ?? null,
    current: current?.id ?? null, ready, pointerActive, regions, pending, signature, timer: idleTimer === null ? null : 'present' }];
}

const results = exerciseProxyCreation();
console.log(`Proxy creation smoke passed (${results.length} cases; options, native order, lifecycle and failures).`);
