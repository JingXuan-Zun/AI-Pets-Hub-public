import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const actual = require('../electron/windowManager/windowTopmostPolicy.cjs').createWindowTopmostPolicy;

export function exerciseTopmostPolicy(factory = actual) {
  const results: unknown[] = [];
  for (const diagnostic of [false, true]) {
    for (const active of [false, true]) {
      for (const failure of [undefined, 'top', 'workspaces', 'front']) {
        run(diagnostic, active, failure);
      }
    }
  }
  return results;

  function run(diagnostic: boolean, active: boolean, failure?: string) {
    const calls: unknown[][] = [];
    const error = new Error('native failure');
    const cache = new WeakMap();
    let failNext = failure;
    function record(name: string, ...args: unknown[]) {
      calls.push([name, ...args]);
      if (failNext === name) { failNext = undefined; throw error; }
    }
    function window(id: string) {
      return {
        top: false, visible: true, destroyed: false,
        isDestroyed() { record('destroyed', id); return this.destroyed; },
        isAlwaysOnTop() { record('queryTop', id); return this.top; },
        setAlwaysOnTop(value: boolean, ...args: unknown[]) { record('top', id, value, ...args); this.top = value; },
        setVisibleOnAllWorkspaces(...args: unknown[]) { record('workspaces', id, ...args); },
        isVisible() { record('visible', id); return this.visible; },
        moveTop() { record('front', id); },
      };
    }
    const main = window('main'), other = window('other');
    let chat: any = window('chat'), settings: any = window('settings');
    const keep = factory({
      getChatWindow: () => { record('chat'); return chat; },
      getSettingsWindow: () => { record('settings'); return settings; },
      getIsAgentDesktopExecutionActive: () => { record('active'); return active; },
      topmostStateByWindow: cache, MAIN_TOPMOST_RELATIVE_LEVEL: 7, TOPMOST_WINDOW_LEVEL: 'screen-saver',
      DISABLE_SETTINGS_TOPMOST_FOR_GRAPH_DIAGNOSTICS: diagnostic,
    });
    function step(label: string, fn: () => unknown) {
      const offset = calls.length;
      let outcome = 'ok';
      try { assert.equal(fn(), undefined); } catch (caught) { assert.equal(caught, error); outcome = 'native-error'; }
      const events = calls.slice(offset);
      results.push([diagnostic, active, failure ?? null, label, outcome, events, cache.get(main) ?? null]);
      return { events, outcome };
    }
    step('initial', () => keep(main, undefined, { bringToFront: true }));
    step('retry after native failure', () => keep(main));
    const hit = step('cache hit and front', () => keep(main, 7, { bringToFront: true }));
    assert.equal(hit.events.some(([name]) => name === 'top' || name === 'workspaces'), false);
    assert.ok(hit.events.some(([name]) => name === 'front'));
    step('changed relative level', () => keep(main, 9));
    step('changed native level', () => keep(main, 9, { topmostLevel: 'pop-up-menu' }));
    main.top = false;
    const restored = step('external topmost loss', () => keep(main, 9, { topmostLevel: 'pop-up-menu' }));
    assert.ok(restored.events.some(([name]) => name === 'top'));
    main.visible = false;
    assert.equal(step('hidden front', () => keep(main, 9, { topmostLevel: 'pop-up-menu', bringToFront: true }))
      .events.some(([name]) => name === 'front'), false);
    step('other window owns independent cache', () => keep(other));
    assert.notEqual(cache.get(main), cache.get(other));
    chat.top = true; settings.top = true;
    cache.set(chat, { relativeLevel: 1 }); cache.set(settings, { relativeLevel: 1 });
    step('chat opts out', () => keep(chat)); step('settings opts out', () => keep(settings));
    assert.equal(chat.top, false); assert.equal(settings.top, false);
    assert.equal(cache.has(chat), false); assert.equal(cache.has(settings), false);
    chat = main;
    step('live chat identity', () => keep(main));
    assert.equal(cache.has(main), false); assert.equal(main.top, false);
    chat = null; settings = null;
    step('main restored after identity change', () => keep(main));
    main.destroyed = true;
    assert.deepEqual(step('destroyed window', () => keep(main)).events, [['destroyed', 'main']]);
    assert.deepEqual(step('null window', () => keep(null)).events, []);
    assert.deepEqual(step('undefined window', () => keep(undefined)).events, []);
    main.destroyed = false;
    (main as any).isAlwaysOnTop = undefined;
    const noQuery = step('missing native topmost query', () => keep(main));
    assert.ok(noQuery.events.some(([name]) => name === 'top'));
    (main as any).moveTop = undefined;
    main.visible = true;
    step('missing moveTop', () => keep(main, 7, { bringToFront: true }));
  }
}

const results = exerciseTopmostPolicy();
console.log(`Window topmost policy smoke passed (${results.length} recorded steps, cache and native failures).`);
