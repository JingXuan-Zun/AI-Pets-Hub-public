import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const ownershipStateSource = fs.readFileSync('electron/windowManager/windowOwnershipStateAdapters.cjs', 'utf8');

const require = createRequire(import.meta.url);
const actual = require('../electron/windowManager/auxiliaryWindowControls.cjs');

export async function exerciseAuxiliaryControls(factories = actual) {
  const outputs: unknown[] = [];
  for (const kind of ['settings', 'chat']) for (const state of ['missing', 'destroyed', 'live']) {
    for (const failure of [undefined, 'get', 'destroyed', 'hide']) runClose(kind, state, failure);
    for (const race of ['replace', 'clear']) runClose(kind, state, undefined, race);
  }
  for (const state of ['missing', 'destroyed', 'live']) {
    runChat(state);
    for (const failure of ['get', 'destroyed', 'reuse', 'bounds', 'limits', 'options', 'construct', 'set', 'log', 'top', 'events', 'load']) runChat(state, failure);
  }
  for (const race of ['destroyed', 'bounds', 'limits', 'options', 'construct', 'set', 'log', 'top', 'events']) runChat('destroyed', undefined, race);
  for (const result of ['missing', 'destroyed', 'live']) for (const mode of ['value', 'promise', 'thenable', 'delayed']) await runSettings(result, mode);
  for (const failure of ['ensure', 'reject', 'destroyed', 'show', 'report']) await runSettings('live', 'promise', failure);
  for (const value of [undefined, null, false, 0, 'failure']) await runSettings('live', 'promise', 'reject', value);
  await runSettings('live', 'delayed', undefined, undefined, true);
  await runConcurrentSettings();
  return outputs;

  function runClose(kind: string, state: string, failure?: string, race?: string) {
    const calls: string[] = [], error = new Error('close failure'); let current: any, thrown: unknown;
    const step = (name: string) => { calls.push(name); if (failure === name) throw error; };
    const other = { isDestroyed() { return false; }, hide() { assert.equal(this, other); step('other.hide'); } };
    const win = { isDestroyed() { assert.equal(this, win); step('destroyed'); if (race) current = race === 'clear' ? null : other; return state === 'destroyed'; },
      hide() { assert.equal(this, win); step('hide'); } };
    current = state === 'missing' ? null : win;
    const get = () => { step('get'); return current; };
    const deps = kind === 'settings' ? { getSettingsWindow: get } : { getChatWindow: get };
    const controls = kind === 'settings' ? factories.createSettingsWindowControls(deps) : factories.createChatWindowControls(deps);
    assert.deepEqual(calls, []);
    try { assert.equal(controls[kind === 'settings' ? 'closeSettingsWindow' : 'closeChatWindow'](), undefined); } catch (caught) { thrown = caught; }
    if (thrown) assert.ok(thrown === error || (race === 'clear' && thrown instanceof TypeError));
    if (!failure && !race) assert.deepEqual(calls, state === 'missing' ? ['get'] : ['get', 'get', 'destroyed', ...(state === 'live' ? ['get', 'hide'] : [])]);
    outputs.push({ kind, state, failure, race, calls, thrown: thrown === error ? 'dependency' : thrown ? 'TypeError' : null });
  }

  function runChat(state: string, failure?: string, race?: string) {
    const calls: any[][] = [], error = new Error('chat failure'); let current: any, thrown: unknown, constructed: any;
    const bounds = {}, limits = {}, options = {};
    const other = window('other', false), old = window('old', state === 'destroyed'); current = state === 'missing' ? null : old;
    function step(name: string, value?: unknown) { calls.push([name, value]); if (failure === name) throw error; if (race === name) current = other; }
    function window(id: string, destroyed: boolean) { const win = { id, isDestroyed() { assert.equal(this, win); step('destroyed', id); return destroyed; } }; return win; }
    const deps = {
      getChatWindow() { step('get', current?.id ?? null); return current; },
      setChatWindow(win: any) { assert.equal(win, constructed); step('set', win.id); current = race === 'set' ? other : win; },
      presentReusedChatWindow() { step('reuse'); return 'ignored'; },
      getChatPanelWindowBounds() { step('bounds'); return bounds; },
      getResolvedChatPanelWindowLimits() { step('limits'); return limits; },
      buildChatWindowOptions(b: unknown, l: unknown) { assert.equal(b, bounds); assert.equal(l, limits); step('options'); return options; },
      BrowserWindow: function(this: any, value: unknown) { assert.ok(new.target); assert.equal(value, options); step('construct'); this.id = 'new'; this.isDestroyed = () => false; constructed = this; },
      attachLoadLogging(win: any, label: string) { assert.equal(label, 'chat-window'); step('log', win.id); },
      scheduleKeepWindowOnTop(win: any, level: number) { assert.equal(level, 7); step('top', win.id); },
      AUX_TOPMOST_RELATIVE_LEVEL: 7, attachChatWindowEvents() { step('events'); },
      loadRenderer(win: any, query: unknown) { assert.deepEqual(query, { desktop: '1', panel: 'chat' }); step('load', win.id); return 'ignored'; },
    };
    const controls = factories.createChatWindowControls(deps); assert.deepEqual(calls, []);
    for (let round = 0; round < 2; round++) {
      if (round) current = other;
      try { assert.equal(controls.openChatWindow(), undefined); } catch (caught) { assert.equal(caught, error); thrown = caught; break; }
      if (!failure && !race && !round) assert.deepEqual(calls.filter(c => c[0] !== 'get').map(c => c[0]), state === 'live' ? ['destroyed', 'reuse'] : [...(state === 'destroyed' ? ['destroyed'] : []), 'bounds', 'limits', 'options', 'construct', 'set', 'log', 'top', 'events', 'load']);
    }
    if (thrown) assert.equal(calls.at(-1)?.[0], failure);
    if (race && ['set', 'log', 'top', 'events'].includes(race)) {
      const pivot = calls.findIndex(c => c[0] === race);
      for (const [name, id] of calls.slice(pivot + 1)) if (['get', 'log', 'top', 'load'].includes(name)) assert.equal(id, 'other');
    }
    outputs.push({ state, failure, race, calls, current: current?.id ?? null, thrown: Boolean(thrown) });
  }

  async function runSettings(result: string, mode: string, failure?: string, rejection?: unknown, replace = false) {
    const calls: any[][] = [], error = new Error('settings failure'); let current = 'old', settle: ((value: unknown) => void) | undefined, thrown: unknown;
    const win = { isDestroyed() { assert.equal(this, win); calls.push(['destroyed']); if (failure === 'destroyed') throw error; return result === 'destroyed'; } };
    const value = result === 'missing' ? null : win;
    const controls = factories.createSettingsWindowControls({
      ensureSettingsWindowReady() {
        calls.push(['ensure']); if (failure === 'ensure') throw error;
        if (failure === 'reject' || failure === 'report') return Promise.reject(rejection);
        if (mode === 'delayed') return new Promise(resolve => { settle = resolve; });
        if (mode === 'thenable') return { then(resolve: (v: unknown) => void) { calls.push(['then']); resolve(value); } };
        return mode === 'promise' ? Promise.resolve(value) : value;
      },
      showSettingsWindow() { calls.push(['show', current]); if (failure === 'show') throw error; return 'ignored'; },
      reportOpenSettingsError(caught: unknown) { assert.equal(caught, ['reject', 'report'].includes(failure ?? '') ? rejection : error); calls.push(['report', caught === error ? 'dependency' : caught instanceof Error ? 'error' : caught]); if (failure === 'report') throw error; },
    });
    assert.deepEqual(calls, []); const pending = controls.openSettingsWindow(); assert.ok(pending instanceof Promise);
    assert.deepEqual(calls, failure === 'ensure' ? [['ensure'], ['report', 'dependency']] : [['ensure']], 'ready values yield; synchronous ensure errors are reported immediately');
    if (mode === 'delayed') { if (replace) current = 'replacement'; settle!(value); }
    try { assert.equal(await pending, undefined); } catch (caught) { assert.equal(caught, error); thrown = caught; }
    assert.equal(Boolean(thrown), failure === 'report');
    if (!failure) assert.deepEqual(calls.map(c => c[0]), ['ensure', ...(mode === 'thenable' ? ['then'] : []), ...(result === 'missing' ? [] : ['destroyed']), ...(result === 'live' ? ['show'] : [])]);
    if (replace) assert.deepEqual(calls.at(-1), ['show', 'replacement']);
    outputs.push({ result, mode, failure, replace, calls, thrown: Boolean(thrown) });
  }

  async function runConcurrentSettings() {
    const calls: string[] = [], resolves: ((value: unknown) => void)[] = []; let current = 'old';
    const controls = factories.createSettingsWindowControls({
      ensureSettingsWindowReady() { calls.push('ensure'); return new Promise(resolve => resolves.push(resolve)); },
      showSettingsWindow() { calls.push('show:' + current); }, reportOpenSettingsError() { assert.fail('unexpected report'); },
    });
    const first = controls.openSettingsWindow(), second = controls.openSettingsWindow(); assert.notEqual(first, second);
    current = 'second'; resolves[1]({ isDestroyed: () => false }); await second;
    current = 'first'; resolves[0]({ isDestroyed: () => false }); await first;
    assert.deepEqual(calls, ['ensure', 'ensure', 'show:second', 'show:first']); outputs.push({ concurrent: calls });
  }
}

const root = fs.readFileSync('electron/windowManager.cjs', 'utf8');
assert.match((root + fs.readFileSync('electron/windowManager/trayConfiguration.cjs', 'utf8')), /getSettingsWindow: \(\) => managerState\.settingsWindow, ensureSettingsWindowReady/);
assert.match(root, /showSettingsWindow: \(\) => showSettingsWindow\(\)/);
assert.match(root, /reportOpenSettingsError: \(error\) => console.error\('Failed to open settings window:', error\)/);
assert.match((root + ownershipStateSource), /getChatWindow: \(\) => managerState\.chatWindow, setChatWindow: \(win\) => \{ managerState\.chatWindow = win; \}/);
const trayAssembly = fs.readFileSync('electron/windowManager/trayConfiguration.cjs', 'utf8');
assert.ok(trayAssembly.indexOf('= createSettingsWindowControls(') < trayAssembly.indexOf('= createTrayConfigurator('));
const assembly=fs.readFileSync('electron/windowManager/chatWindowControllers.cjs','utf8');
assert.ok(assembly.indexOf('= createChatWindowControls(') > assembly.indexOf('= createChatWindowEventRegistrar('));
console.log(`Auxiliary window controls smoke passed (${(await exerciseAuxiliaryControls()).length} scenarios).`);
