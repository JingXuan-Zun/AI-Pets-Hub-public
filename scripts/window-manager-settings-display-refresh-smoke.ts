import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const actual = require('../electron/windowManager/settingsWindowDisplayRefresh.cjs').createSettingsWindowDisplayRefreshScheduler;
export function exerciseSettingsDisplayRefresh(factory = actual) {
  const outputs: unknown[] = [];
  for (const state of ['null', 'destroyed', 'hidden', 'visible']) for (const timer of [null, 0, { id: 'old' }])
    for (const delay of [undefined, 0, -10, 'later']) for (const after of ['visible', 'hidden', 'destroyed', 'replaced']) {
      run({ state, timer, delay, after });
    }
  const base = { state: 'visible', timer: { id: 'old' }, delay: undefined, after: 'visible' };
  for (const failure of ['getWindow', 'destroyed', 'visible', 'getTimer', 'clear', 'timeout', 'setTimer', 'broadcast']) run(base, failure);
  for (const race of ['clearSwap', 'visibleSwap', 'immediate', 'doubleSchedule', 'callbackHidden', 'callbackDestroyed']) run(base, undefined, race);
  return outputs;

  function run(config: any, failure?: string, race?: string) {
    const calls: any[][] = [], callbacks: Array<() => void> = [], cancelled: unknown[] = [];
    const error = new Error('display refresh failure'); let timer: any = config.timer;
    let destroyed = config.state === 'destroyed', visible = config.state !== 'hidden';
    let current: any; let thrown = false; let broadcasts = 0;
    const step = (name: string, value?: unknown) => { calls.push([name, value]); if (name === failure) throw error; };
    const other = { id: 'other', isDestroyed() { step('otherDestroyed'); return false; }, isVisible() { step('otherVisible'); return true; } };
    const win = { id: 'self', isDestroyed() { step('destroyed'); return destroyed; },
      isVisible() { step('visible'); if (race === 'visibleSwap') current = other; return visible; } };
    current = config.state === 'null' ? null : win;
    const deps = {
      getSettingsWindow() { step('getWindow', current?.id ?? null); return current; },
      getDisplayRefreshTimer() { step('getTimer', timer); return timer; },
      setDisplayRefreshTimer(value: unknown) { step('setTimer', value); timer = value; },
      clearTimeout(value: unknown) { step('clear', value); cancelled.push(value); if (race === 'clearSwap') current = other; },
      setTimeout(callback: () => void, delay: unknown) {
        step('timeout', delay); callbacks.push(callback); if (race === 'immediate') callback();
        return { id: `timer-${callbacks.length}` };
      },
      SETTINGS_WINDOW_SHOW_DISPLAY_REFRESH_DELAY_MS: 80,
      captureService: { broadcastDisplayEnvironment(payload: any) {
        step('broadcast', { ...payload, windows: payload.windows.map((w: any) => w.id) });
        assert.equal(payload.includeCaptureSources, false); assert.equal(payload.preferCachedCaptureSources, true);
        assert.equal(payload.windows.length, 1); assert.equal(payload.windows[0], race === 'clearSwap' || race === 'visibleSwap' ? other : win);
        assert.equal(timer, null, 'callback clears the root timer before broadcasting'); broadcasts++;
        return { ignored: true };
      } },
    };
    const schedule = factory(deps); assert.deepEqual(calls, [], 'factory must perform no state reads or scheduling');
    try {
      assert.equal(schedule(config.delay), undefined);
      if (config.state !== 'visible') { assert.equal(timer, config.timer); assert.equal(callbacks.length, 0); }
      else {
        const handle = timer;
        assert.equal(callbacks.length, 1);
        assert.equal(calls.find(c => c[0] === 'timeout')?.[1], config.delay === undefined ? 80 : config.delay);
        assert.deepEqual(cancelled, config.timer ? [config.timer] : []);
        if (race === 'doubleSchedule') {
          assert.equal(schedule(17), undefined); assert.equal(callbacks.length, 2); assert.ok(cancelled.includes(handle));
          callbacks[0](); assert.equal(timer, null, 'original queued callback clears even a newer timer');
        }
        if (config.after === 'hidden' || race === 'callbackHidden') visible = false;
        if (config.after === 'destroyed' || race === 'callbackDestroyed') destroyed = true;
        if (config.after === 'replaced') current = other;
        assert.equal(callbacks.at(-1)!(), undefined); assert.equal(timer, null);
        if (!race) assert.equal(broadcasts, ['visible', 'replaced'].includes(config.after) ? 1 : 0);
        const callbackStart = calls.map(c => c[0]).lastIndexOf('setTimer');
        assert.ok(!calls.slice(callbackStart + 1).some(c => c[0] === 'getWindow'), 'callback must use scheduled window identity');
      }
    } catch (caught) { assert.ok(failure); assert.equal(caught, error); assert.equal(calls.at(-1)?.[0], failure); thrown = true; }
    assert.equal(thrown, Boolean(failure));
    outputs.push({ config, failure, race, calls, timer, cancelled, broadcasts, thrown });
  }
}
const outputs = exerciseSettingsDisplayRefresh();
const root = fs.readFileSync('electron/windowManager.cjs', 'utf8');
assert.match(root, /getSettingsWindow: \(\) => managerState\.settingsWindow/);
assert.match(fs.readFileSync('electron/windowManager/settingsPresentationControllers.cjs', 'utf8'), /getDisplayRefreshTimer: \(\) => managerState\.settingsWindowDisplayRefreshTimer/);
assert.match(fs.readFileSync('electron/windowManager/settingsPresentationControllers.cjs', 'utf8'), /setDisplayRefreshTimer: \(timer\) => \{ managerState\.settingsWindowDisplayRefreshTimer = timer; \}/);
assert.match(root, /setTimeout: \(callback, delay\) => setTimeout\(callback, delay\)/);
assert.match(root, /clearTimeout: \(timer\) => clearTimeout\(timer\)/);
assert.match(root, /captureService,\s*SETTINGS_WINDOW_SHOW_DISPLAY_REFRESH_DELAY_MS/);
const source = ts.createSourceFile('disposal.cjs', fs.readFileSync('electron/windowManager/windowManagerDisposal.cjs', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
let dispose: ts.FunctionDeclaration | ts.FunctionExpression | undefined;
function visit(node: ts.Node) { if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) && node.name?.text === 'dispose') dispose = node; ts.forEachChild(node, visit); }
visit(source); assert.ok(dispose);
const block = dispose.body!.statements.find(n => ts.isIfStatement(n) && n.expression.getText(source) === 'settingsWindowDisplayRefreshTimer');
assert.ok(block);
const disposal = new Function('clearTimeout', `let settingsWindowDisplayRefreshTimer = null; return { set: value => { settingsWindowDisplayRefreshTimer = value; }, read: () => settingsWindowDisplayRefreshTimer, run: () => { ${block.getText(source).replace("setDisplayRefreshTimer(null)", "settingsWindowDisplayRefreshTimer = null")} } };`);
for (const timer of [null, 0, { id: 'pending' }]) {
  const cleared: unknown[] = []; const owner = disposal((value: unknown) => cleared.push(value)); owner.set(timer); owner.run();
  assert.deepEqual(cleared, timer ? [timer] : []); assert.equal(owner.read(), timer ? null : timer);
  owner.run(); assert.equal(cleared.length, timer ? 1 : 0);
}
console.log(`Settings display refresh smoke passed (${outputs.length} scenarios + 3 root cleanup cases).`);
