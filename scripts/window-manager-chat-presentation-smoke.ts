import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const actual = require('../electron/windowManager/chatWindowPresentation.cjs').createChatWindowReusePresenter;
export function exerciseChatWindowPresentation(factory = actual) {
  const outputs: unknown[] = [];
  for (const minimized of [false, true]) for (const race of [undefined, 'constraints', 'bounds', 'resolve', 'show', 'restore', 'focus']) run(minimized, undefined, race);
  for (const failure of ['get', 'constraints', 'bounds', 'resolve', 'setBounds', 'show', 'minimized', 'restore', 'focus', 'top', 'stack', 'notify', 'broadcast']) run(true, failure);
  return outputs;
  function run(minimized: boolean, failure?: string, race?: string) {
    const calls: any[][] = [], error = new Error('reuse dependency error');
    let current: any, isMinimized = minimized; const bounds = {}, resolved = {};
    const step = (name: string, value?: unknown) => { calls.push([name, value]); if (failure === name) throw error; if (race === name) current = other; };
    function window(id: string) { return { id, getBounds() { step('bounds', id); return bounds; },
      setBounds(value: unknown) { assert.equal(value, resolved); step('setBounds', id); }, show() { step('show', id); },
      isMinimized() { step('minimized', id); return isMinimized; }, restore() { step('restore', id); }, focus() { step('focus', id); } }; }
    const self = window('self'), other = window('other'); current = self;
    const deps = { getChatWindow() { step('get', current.id); return current; },
      applyChatWindowSizeConstraints(win: any) { step('constraints', win.id); },
      getResolvedChatPanelWindowBounds(value: unknown) { assert.equal(value, bounds); step('resolve'); return resolved; },
      scheduleKeepWindowOnTop(win: any, level: number, options: unknown) { assert.equal(level, 7); step('top', { id: win.id, options }); },
      AUX_TOPMOST_RELATIVE_LEVEL: 7, scheduleWindowStackOnTop() { step('stack'); },
      notifyChatWindowState() { step('notify'); }, broadcastSharedState() { step('broadcast'); },
    };
    const present = factory(deps); assert.deepEqual(calls, []); let threw = false;
    for (let round = 0; round < 2; round++) {
      if (round) { current = other; isMinimized = !minimized; }
      const start = calls.length;
      try { assert.equal(present(), undefined); }
      catch (caught) { assert.equal(caught, error); assert.equal(calls.at(-1)?.[0], failure); threw = true; break; }
      assert.deepEqual(calls.slice(start).map(c => c[0]).filter(n => n !== 'get'),
        ['constraints', 'bounds', 'resolve', 'setBounds', 'show', 'minimized', ...(isMinimized ? ['restore'] : []), 'focus', 'top', 'stack', 'notify', 'broadcast']);
      assert.deepEqual(calls.at(-4)?.[1]?.options, { bringToFront: true });
      if (race && ['constraints', 'show', 'restore'].includes(race)) {
        const pivot = calls.findIndex(c => c[0] === race);
        const laterWindowActions = calls.slice(pivot + 1).filter(c => ['get', 'bounds', 'setBounds', 'show', 'minimized', 'restore', 'focus'].includes(c[0]));
        if (pivot >= 0) assert.ok(laterWindowActions.every(c => c[1] === 'other'));
      }
    }
    assert.equal(threw, Boolean(failure)); outputs.push({ minimized, failure, race, calls, threw });
  }
}
const root = fs.readFileSync('electron/windowManager.cjs', 'utf8');
assert.match(root, /= createAuxiliaryWindowContentControllers\(/);
const assembly=fs.readFileSync('electron/windowManager/chatWindowControllers.cjs','utf8');
assert.match(assembly, /getChatWindow, applyChatWindowSizeConstraints, getResolvedChatPanelWindowBounds/);
const controls = fs.readFileSync('electron/windowManager/auxiliaryWindowControls.cjs', 'utf8');
assert.match(assembly, /createChatWindowControls\(\{[\s\S]*?presentReusedChatWindow,/);
assert.match(controls, /if \(getChatWindow\(\) && !getChatWindow\(\).isDestroyed\(\)\) \{\s*presentReusedChatWindow\(\);\s*return;/);
console.log(`Chat reuse presentation smoke passed (${exerciseChatWindowPresentation().length} scenarios with two calls for normal cases).`);
