import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const ownershipStateSource = fs.readFileSync('electron/windowManager/windowOwnershipStateAdapters.cjs', 'utf8');

const require = createRequire(import.meta.url);
const actual = require('../electron/windowManager/settingsWindowLifecycle.cjs');

export async function exerciseSettingsLifecycle(factories = actual) {
  const outputs: unknown[] = [];
  for (const state of ['missing', 'destroyed', 'live']) for (const applied of [false, true]) for (const deferred of [false, true]) create(state, applied, deferred);
  for (const failure of ['read', 'destroyed', 'bounds', 'options', 'construct', 'write', 'log', 'dwm', 'then', 'applied', 'reason', 'logEvent', 'top', 'events', 'load']) create('destroyed', false, false, failure);
  for (const race of ['destroyed', 'bounds', 'options', 'construct', 'write', 'log', 'dwm', 'then', 'top', 'events', 'load']) create('destroyed', false, true, undefined, race);
  create('live', false, false, undefined, 'destroyed');
  for (const state of ['missing', 'destroyed', 'live']) for (const cached of [false, true]) for (const next of ['missing', 'destroyed', 'ready', 'loading']) {
    for (const outcome of ['window', 'closed', 'reject']) for (const replaced of [false, true]) await ready(state, cached, next, outcome, replaced);
  }
  for (const failure of ['read', 'readPromise', 'create', 'nextDestroyed', 'contents', 'loading', 'wait', 'finally', 'write', 'clear']) await ready('missing', false, 'loading', 'window', false, failure);
  await ready('live', false, 'loading', 'window', false, undefined, true);
  for (const state of ['missing', 'destroyed', 'live']) for (const outcome of ['window', 'closed', 'reject']) await preload(state, outcome);
  for (const failure of ['read', 'destroyed', 'create', 'wait']) preloadError(failure);
  return outputs;

  function create(state: string, applied: boolean, deferred: boolean, failure?: string, race?: string) {
    const calls: any[][] = [], error = new Error('creation error'); let current: any, constructed: any, callback: any, result: any, thrown: any;
    const bounds = {}, options = {}, other = { id: 'other', isDestroyed: () => false };
    const step = (name: string, value?: unknown) => { calls.push([name, value]); if (failure === name) throw error; if (race === name) current = other; };
    const old = { id: 'old', isDestroyed() { assert.equal(this, old); step('destroyed'); return state === 'destroyed'; } }; current = state === 'missing' ? null : old;
    const response = { get applied() { step('applied'); return applied; }, get reason() { step('reason'); return 'unsupported'; } };
    const deps = {
      getSettingsWindow() { step('read', current?.id ?? null); return current; },
      setSettingsWindow(win: any) { assert.equal(win, constructed); step('write', win.id); current = race === 'write' ? other : win; },
      getSettingsPanelWindowBounds() { step('bounds'); return bounds; },
      buildSettingsWindowOptions(value: unknown) { assert.equal(value, bounds); step('options'); return options; },
      BrowserWindow: function(this: any, value: unknown) { assert.ok(new.target); assert.equal(value, options); step('construct'); this.id = 'new'; constructed = this; },
      attachLoadLogging(win: any, label: string) { assert.equal(win, constructed); assert.equal(label, 'settings-window'); step('log', win.id); },
      disableDwmSystemBorderForWindow(win: any) { assert.equal(win, constructed); step('dwm', win.id); const promise = { then(cb: any) { assert.equal(this, promise); step('then'); callback = cb; if (!deferred) cb(response); return 'ignored'; } }; return promise; },
      logWindowEvent(message: string) { assert.equal(message, 'settings-window: DWM border disable skipped reason=unsupported'); step('logEvent', message); },
      scheduleKeepWindowOnTop(win: any, level: number) { assert.equal(win, constructed); assert.equal(level, 7); step('top', win.id); },
      AUX_TOPMOST_RELATIVE_LEVEL: 7, attachSettingsWindowEvents(win: any) { assert.equal(win, constructed); step('events', win.id); },
      loadRenderer(win: any, query: unknown) { assert.equal(win, constructed); assert.deepEqual(query, { desktop: '1', panel: 'settings' }); step('load', win.id); },
    };
    const run = factories.createSettingsWindowCreator(deps); assert.deepEqual(calls, []);
    try { result = run(); if (deferred) callback?.(response); } catch (caught) { assert.equal(caught, error); thrown = caught; }
    assert.equal(Boolean(thrown), calls.some(c => c[0] === failure));
    if (!failure && state !== 'live') { assert.equal(result, constructed); assert.equal(calls.filter(c => c[0] === 'construct').length, 1); }
    if (!failure && state === 'live') assert.equal(result, race ? other : old);
    outputs.push({ state, applied, deferred, failure, race, calls, returned: result?.id ?? null, current: current?.id ?? null, threw: Boolean(thrown) });
  }

  async function ready(state: string, cached: boolean, next: string, outcome: string, replaced: boolean, failure?: string, swapAtDestroy = false) {
    const calls: any[][] = [], error = new Error('readiness error'); let current: any, stored: any, thrown: any, result: any, pending: any;
    let resolve!: (value: unknown) => void, reject!: (reason: unknown) => void;
    const base = new Promise((yes, no) => { resolve = yes; reject = no; });
    const replacement = Promise.resolve('replacement'), cache = Promise.resolve('cached'); stored = cached ? cache : null;
    const step = (name: string, value?: unknown) => { calls.push([name, value]); if (failure === name) throw error; };
    const old = { id: 'old', isDestroyed() { assert.equal(this, old); step('destroyed'); if (swapAtDestroy) current = replacementWindow; return state === 'destroyed'; } };
    const replacementWindow = { id: 'replacement', isDestroyed: () => false };
    const contents = { isLoadingMainFrame() { assert.equal(this, contents); step('loading'); return next === 'loading'; } };
    const win = { id: 'new', isDestroyed() { assert.equal(this, win); step('nextDestroyed'); return next === 'destroyed'; }, get webContents() { step('contents'); return contents; } };
    current = state === 'missing' ? null : old;
    const deps = {
      getSettingsWindow() { step('read', current?.id ?? null); return current; },
      getReadyPromise() { step('readPromise', stored === null ? 'null' : stored === cache ? 'cached' : stored === replacement ? 'replacement' : 'pending'); return stored; },
      setReadyPromise(value: unknown) { step(value === null ? 'clear' : 'write'); stored = value; },
      createSettingsWindow() { step('create'); current = next === 'missing' ? null : win; return current; },
      waitForSettingsWindowLoad(value: unknown) { assert.equal(value, win); step('wait'); if (failure === 'finally') return { finally() { step('finally'); } }; return base; },
    };
    const controls = factories.createSettingsWindowReadiness(deps); assert.deepEqual(calls, []);
    try {
      pending = controls.ensureSettingsWindowReady();
      if (!cached && state !== 'live' && next === 'loading') {
        assert.equal(stored, pending); assert.equal(controls.ensureSettingsWindowReady(), pending, 'pending Promise identity must be retained');
        if (replaced) stored = replacement;
        if (outcome === 'reject') reject(error); else resolve(outcome === 'closed' ? null : win);
      }
      result = await pending;
    } catch (caught) { assert.equal(caught, error); thrown = caught; }
    if (failure === 'write') { resolve(win); await Promise.resolve(); await Promise.resolve(); }
    if (!failure) {
      if (cached) { assert.equal(pending, cache); assert.equal(result, 'cached'); assert.equal(stored, cache); }
      else if (state === 'live') { assert.equal(result, swapAtDestroy ? replacementWindow : old); assert.equal(stored, null); }
      else if (next === 'loading') { assert.equal(Boolean(thrown), outcome === 'reject'); if (!thrown) assert.equal(result, outcome === 'closed' ? null : win); assert.equal(stored, replaced ? replacement : null); }
      else { assert.equal(result, next === 'ready' ? win : null); assert.equal(stored, null); }
    } else assert.ok(thrown);
    outputs.push({ state, cached, next, outcome, replaced, failure, swapAtDestroy, calls, returned: result?.id ?? result ?? null, stored: stored === null ? 'null' : stored === cache ? 'cached' : stored === replacement ? 'replacement' : 'pending', threw: Boolean(thrown) });
  }

  async function preload(state: string, outcome: string) {
    const calls: string[] = []; let stored: any = null;
    const win = { isDestroyed: () => state === 'destroyed', webContents: { isLoadingMainFrame: () => true } };
    const controls = factories.createSettingsWindowReadiness({
      getSettingsWindow: () => state === 'missing' ? null : win, getReadyPromise: () => stored, setReadyPromise: (value: any) => { stored = value; },
      createSettingsWindow() { calls.push('create'); return { isDestroyed: () => false, webContents: { isLoadingMainFrame: () => true } }; },
      waitForSettingsWindowLoad() { calls.push('wait'); return outcome === 'reject' ? Promise.reject(new Error('load failed')) : Promise.resolve(outcome === 'closed' ? null : win); },
    });
    assert.equal(controls.preloadSettingsWindow(), undefined);
    if (stored) await stored.catch(() => {});
    await Promise.resolve(); assert.equal(stored, null);
    assert.deepEqual(calls, state === 'live' ? [] : ['create', 'wait']); outputs.push({ preload: true, state, outcome, calls });
  }

  function preloadError(failure: string) {
    const error = new Error('preload synchronous failure'), calls: string[] = [];
    const step = (name: string) => { calls.push(name); if (name === failure) throw error; };
    const win = { isDestroyed() { step('destroyed'); return true; }, webContents: { isLoadingMainFrame: () => true } };
    const controls = factories.createSettingsWindowReadiness({
      getSettingsWindow() { step('read'); return win; }, getReadyPromise: () => null, setReadyPromise() { assert.fail('unexpected assignment'); },
      createSettingsWindow() { step('create'); return { isDestroyed: () => false, webContents: win.webContents }; },
      waitForSettingsWindowLoad() { step('wait'); return Promise.resolve(win); },
    });
    assert.throws(() => controls.preloadSettingsWindow(), caught => caught === error);
    assert.equal(calls.at(-1), failure); outputs.push({ preloadError: failure, calls });
  }
}

const root = fs.readFileSync('electron/windowManager.cjs', 'utf8');
assert.match((root + ownershipStateSource), /getSettingsWindow: \(\) => managerState\.settingsWindow, setSettingsWindow: \(win\) => \{ managerState\.settingsWindow = win; \}/);
assert.match((root + ownershipStateSource), /getReadyPromise: \(\) => managerState\.settingsWindowReadyPromise/);
assert.match((root + ownershipStateSource), /setReadyPromise: \(promise\) => \{ managerState\.settingsWindowReadyPromise = promise; \}/);
assert.match(root, /ensureSettingsWindowReady: \(\) => ensureSettingsWindowReady\(\)/);
const assembly=fs.readFileSync('electron/windowManager/settingsWindowControllers.cjs','utf8');
assert.ok(assembly.indexOf('= createSettingsWindowCreator(') > assembly.indexOf('= createSettingsWindowOptionsBuilder('));
assert.ok(assembly.indexOf('= createSettingsWindowReadiness(') > assembly.indexOf('= createSettingsWindowCreator('));
console.log(`Settings window lifecycle smoke passed (${(await exerciseSettingsLifecycle()).length} scenarios).`);
