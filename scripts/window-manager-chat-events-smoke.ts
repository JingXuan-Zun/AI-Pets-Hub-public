import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
const ownershipStateSource = fs.readFileSync('electron/windowManager/windowOwnershipStateAdapters.cjs', 'utf8');

const require = createRequire(import.meta.url);
const actual = require('../electron/windowManager/chatWindowEvents.cjs').createChatWindowEventRegistrar;
const registrations = ['ready-to-show', 'open-handler', 'did-finish-load', 'close', 'show', 'hide', 'focus', 'restore', 'move', 'resize', 'closed'];
export function exerciseChatWindowEvents(factory = actual) {
  const outputs: unknown[] = [];
  for (const state of ['null', 'destroyed', 'normal']) for (const quitting of [false, true])
    for (const replaced of [false, true]) for (const race of [false, true]) run({ state, quitting, replaced, race });
  for (const event of registrations) run({ state: 'normal' }, 'register:' + event);
  for (const [event, failures] of Object.entries({ 'ready-to-show': ['get', 'destroyed', 'constraints', 'bounds', 'resolve', 'setBounds', 'windowShow', 'windowFocus', 'top', 'stack'],
    'open-handler': ['external'], 'did-finish-load': ['broadcast'], close: ['quitting', 'prevent', 'windowHide'],
    show: ['notify', 'broadcast', 'sync', 'stack', 'top'], hide: ['notify', 'stack'], focus: ['top'], restore: ['top'], move: ['top'], resize: ['sync', 'top'], closed: ['clear', 'notify'] })) {
    for (const failure of failures) run({ state: 'normal' }, failure, event);
  }
  return outputs;
  function run(config: any, failure?: string, onlyEvent?: string) {
    const calls: any[][] = [], callbacks = new Map<string, { once: boolean; callback: (...args: any[]) => any }>();
    const error = new Error('chat event failure'); let current: any, quitting = Boolean(config.quitting); let active = false;
    const resultToken = {};
    const step = (name: string, value?: unknown) => { calls.push([name, value]); if (name === failure && active) throw error; };
    function register(event: string, callback: (...args: any[]) => any, once: boolean, id: string) {
      step('register:' + event, { once, id }); callbacks.set(event, { callback, once });
      if (failure === 'register:' + event) throw error;
    }
    function win(id: string) { return {
      id, once: (event: string, callback: any) => register(event, callback, true, id),
      on: (event: string, callback: any) => register(event, callback, false, id),
      isDestroyed() { step('destroyed', id); return config.state === 'destroyed'; },
      getBounds() { step('bounds', id); if (config.race) current = other; return bounds; },
      setBounds(value: unknown) { assert.equal(value, resolved); step('setBounds', id); },
      show() { step('windowShow', id); }, focus() { step('windowFocus', id); }, hide() { step('windowHide', id); },
      webContents: { setWindowOpenHandler: (callback: any) => register('open-handler', callback, false, id),
        once: (event: string, callback: any) => register(event, callback, true, id) },
    }; }
    const bounds = {}, resolved = {}, self = win('self'), other = win('other'), shell = {};
    current = self;
    const deps = { getChatWindow() { if (active) step('get', current?.id ?? null); return current; },
      getIsQuitting() { step('quitting', quitting); return quitting; }, clearChatWindow() { step('clear'); current = null; },
      applyChatWindowSizeConstraints(w: any) { step('constraints', w?.id); }, getResolvedChatPanelWindowBounds(value: unknown) { assert.equal(value, bounds); step('resolve'); return resolved; },
      scheduleKeepWindowOnTop(w: any, level: number, options: unknown) { assert.equal(level, 7); step('top', { id: w?.id, options }); return resultToken; },
      AUX_TOPMOST_RELATIVE_LEVEL: 7, scheduleWindowStackOnTop() { step('stack'); },
      openExternalSafely(s: unknown, url: string) { assert.equal(s, shell); step('external', url); }, shell,
      broadcastSharedState() { step('broadcast'); }, notifyChatWindowState() { step('notify'); }, syncInteractiveChatWindowBounds() { step('sync'); },
    };
    const attach = factory(deps); assert.deepEqual(calls, []); let registrationFailed = false;
    try { assert.equal(attach(), undefined); } catch (caught) { assert.equal(caught, error); registrationFailed = true; }
    if (registrationFailed) { assert.ok(failure?.startsWith('register:')); assert.deepEqual(calls.map(c => c[0]), registrations.slice(0, registrations.indexOf(failure.slice(9)) + 1).map(e => 'register:' + e)); }
    else {
      assert.deepEqual(calls.map(c => c[0]), registrations.map(e => 'register:' + e));
      for (const [event, entry] of callbacks) assert.equal(entry.once, ['ready-to-show', 'did-finish-load'].includes(event));
      calls.length = 0; active = true;
      for (let round = 0; round < (onlyEvent ? 1 : 2); round++) {
        quitting = round ? !config.quitting : Boolean(config.quitting);
        current = config.state === 'null' ? null : config.replaced || round ? other : self;
        for (const event of onlyEvent ? [onlyEvent] : registrations) {
          const entry = callbacks.get(event); if (!entry) continue;
          if (entry.once) callbacks.delete(event);
          const start = calls.length; let caughtName: string | undefined;
          try {
            const returned = entry.callback(event === 'open-handler' ? { url: 'https://example.test/' } : { preventDefault() { step('prevent'); } });
            if (event === 'open-handler') assert.deepEqual(returned, { action: 'deny' });
            else if (['focus', 'restore', 'move'].includes(event)) assert.equal(returned, resultToken);
            else assert.equal(returned, undefined);
          } catch (caught) {
            if (failure) { assert.equal(caught, error); assert.equal(calls.at(-1)?.[0], failure); }
            else { assert.ok(event === 'close' && current === null && !quitting); assert.ok(caught instanceof TypeError); }
            caughtName = (caught as Error).name;
          }
          if (failure) assert.equal(caughtName, 'Error');
          const names = calls.slice(start).map(c => c[0]).filter(n => n !== 'get');
          if (!failure && event === 'show') assert.deepEqual(names, ['notify', 'broadcast', 'sync', 'stack', 'top']);
          if (!failure && event === 'hide') assert.deepEqual(names, ['notify', 'stack']);
          if (!failure && event === 'resize') assert.deepEqual(names, ['sync', 'top']);
          if (!failure && event === 'closed') { assert.deepEqual(names, ['clear', 'notify']); assert.equal(current, null); }
          calls.push(['result', { event, round, caughtName }]);
        }
      }
    }
    outputs.push({ config, failure, onlyEvent, calls, registrationFailed, current: current?.id ?? null });
  }
}
const outputs = exerciseChatWindowEvents();
const root = fs.readFileSync('electron/windowManager.cjs', 'utf8');
assert.match((root + ownershipStateSource), /getIsQuitting: \(\) => managerState\.isQuitting/);
assert.match((root + ownershipStateSource), /clearChatWindow: \(\) => \{ managerState\.chatWindow = null; \}/);
const controls = fs.readFileSync('electron/windowManager/auxiliaryWindowControls.cjs', 'utf8');
const assembly=fs.readFileSync('electron/windowManager/chatWindowControllers.cjs','utf8');
assert.match(assembly, /getChatWindow, getIsQuitting, clearChatWindow/);
assert.match(assembly, /createChatWindowControls\(\{[\s\S]*?scheduleKeepWindowOnTop, AUX_TOPMOST_RELATIVE_LEVEL, attachChatWindowEvents, loadRenderer,/);
assert.match(controls, /scheduleKeepWindowOnTop\(getChatWindow\(\), AUX_TOPMOST_RELATIVE_LEVEL\);\s*attachChatWindowEvents\(\);\s*loadRenderer\(getChatWindow\(\), \{ desktop: '1', panel: 'chat' \}\)/);
console.log(`Chat window events smoke passed (${outputs.length} scenarios; once/on, fresh window reads, ordering, errors).`);
