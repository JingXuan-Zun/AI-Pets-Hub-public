import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const factory = createRequire(import.meta.url)('../electron/windowManager/agentDesktopExecutionPolicy.cjs').createAgentDesktopExecutionPolicy;
let cases = 0;
for (const initial of [false, true]) for (const requested of [false, true, null, 0, 'active'])
for (const mainKind of ['missing', 'destroyed', 'live']) for (const chatKind of ['missing', 'destroyed', 'live'])
for (const settingsKind of ['missing', 'destroyed', 'live']) {
  const next = Boolean(requested), expected: string[] = [];
  if (initial !== next) {
    expected.push('set-active');
    for (const [name, kind] of [['main', mainKind], ['chat', chatKind], ['settings', settingsKind]]) {
      if (kind !== 'missing') expected.push(`${name}-check`);
    }
    if (next) {
      if (chatKind === 'live') expected.push('chat-topmost', 'chat-cache');
      if (settingsKind === 'live') expected.push('settings-topmost', 'settings-cache');
    } else expected.push('shape');
    expected.push('pointer');
    if (!next) expected.push('main-topmost', 'aux-topmost');
  }
  for (const failure of [undefined, ...expected]) {
    let active = initial;
    const calls: string[] = [], error = new Error('dependency failure');
    const step = (name: string) => { calls.push(name); if (name === failure) throw error; };
    const makeWindow = (name: string, kind: string) => kind === 'missing' ? null : {
      name, isDestroyed: () => { step(`${name}-check`); return kind === 'destroyed'; },
      setAlwaysOnTop: (value: boolean) => { assert.equal(value, false); assert.equal(active, next); step(`${name}-topmost`); },
      setFocusable: () => assert.fail('focus must remain available'),
      setIgnoreMouseEvents: () => assert.fail('auxiliary input must remain available'),
    };
    const main = makeWindow('main', mainKind), chat = makeWindow('chat', chatKind), settings = makeWindow('settings', settingsKind);
    const apply = factory({
      getIsActive: () => active, setIsActive: (value: boolean) => { step('set-active'); active = value; },
      getMainWindow: () => main, getChatWindow: () => chat, getSettingsWindow: () => settings,
      topmostStateByWindow: { delete: (win: { name: string }) => step(`${win.name}-cache`) },
      applyInteractiveWindowShape: () => step('shape'), applyPointerPassthroughState: () => step('pointer'),
      keepWindowOnTop: (win: unknown, level: number) => { assert.equal(win, main); assert.equal(level, 7); step('main-topmost'); },
      keepAuxWindowsOnTop: () => step('aux-topmost'), MAIN_TOPMOST_RELATIVE_LEVEL: 7,
    });
    assert.deepEqual(calls, []);
    if (failure) {
      assert.throws(() => apply(requested), (caught: unknown) => caught === error);
      assert.deepEqual(calls, expected.slice(0, expected.indexOf(failure) + 1));
      assert.equal(active, failure === 'set-active' ? initial : next);
    } else {
      assert.equal(apply(requested), undefined); assert.equal(active, next); assert.deepEqual(calls, expected);
      calls.length = 0; apply(requested); assert.deepEqual(calls, [], 'same state must have no window effects');
    }
    cases++;
  }
}
// A native callback can replace the main window during the transition. The
// policy must use the current identity when deciding which windows to demote.
let currentMain: unknown = null, active = false;
const calls: string[] = [];
const chat = { isDestroyed: () => false, setAlwaysOnTop: () => { currentMain = settings; calls.push('chat'); } };
const settings = { isDestroyed: () => false, setAlwaysOnTop: () => assert.fail('current main must be excluded') };
const apply = factory({
  getIsActive: () => active, setIsActive: (value: boolean) => { active = value; },
  getMainWindow: () => currentMain, getChatWindow: () => chat, getSettingsWindow: () => settings,
  topmostStateByWindow: { delete: () => calls.push('cache') }, applyPointerPassthroughState: () => calls.push('pointer'),
});
apply(true); assert.deepEqual(calls, ['chat', 'cache', 'pointer']);
const root = fs.readFileSync('electron/windowManager.cjs', 'utf8');
assert.ok(root.includes('getIsActive: () => isAgentDesktopExecutionActive'));
assert.ok(root.includes('setIsActive: (active) => { isAgentDesktopExecutionActive = active; }'));
assert.ok(root.includes('const setAgentDesktopExecutionActive = createAgentDesktopExecutionPolicy({'));
assert.ok(fs.readFileSync('electron/windowManager/agentDesktopExecutionPolicy.cjs', 'utf8').split('\n').length <= 300);
console.log(`Agent execution policy smoke passed (${cases} transition, live-window and failure-order cases + main replacement race).`);
