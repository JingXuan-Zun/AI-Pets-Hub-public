import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
const lifecycleStateSource = fs.readFileSync('electron/windowManager/mainWindowLifecycleStateAdapters.cjs', 'utf8');
const require = createRequire(import.meta.url);
const actual = require('../electron/windowManager/mainWindowLoadEvents.cjs').createMainWindowLoadEventRegistrar;
const registrations = ['ready-to-show', 'open-handler', 'did-finish-load', 'did-fail-load'];
export function exerciseMainWindowLoadEvents(factory = actual) {
  const outputs: unknown[] = [];
  for (const state of ['null', 'destroyed', 'hidden', 'visible']) for (const recovery of [false, true])
    for (const mainFrame of [false, true, undefined]) for (const code of [-3, -2, 0, '-3']) for (const swapped of [false, true]) run({ state, recovery, mainFrame, code, swapped });
  for (const event of registrations) run({ state: 'hidden', mainFrame: true, code: -2 }, 'register:' + event);
  for (const [event, failures] of Object.entries({ 'ready-to-show': ['getWindow', 'destroyed', 'mark', 'ready'],
    'open-handler': ['external'], 'did-finish-load': ['getWindow', 'destroyed', 'visible', 'mark', 'ready', 'settings', 'chat', 'shared', 'stack', 'windows', 'environment'],
    'did-fail-load': ['recovery', 'log', 'getWindow', 'recover'] })) for (const failure of failures) run({ state: 'hidden', mainFrame: true, code: -2 }, failure, event);
  for (const race of ['destroyed', 'ready', 'log', 'windows']) run({ state: 'hidden', mainFrame: true, code: -2 }, undefined, undefined, race);
  return outputs;
  function run(config: any, failure?: string, onlyEvent?: string, race?: string) {
    const calls: any[][] = [], error = new Error('load event dependency error'); let active = false, canShow = false, current: any, recovery = Boolean(config.recovery);
    const callbacks = new Map<string, { once: boolean; callback: (...args: any[]) => any }>();
    const step = (name: string, value?: unknown) => { calls.push([name, value]); if (active && failure === name) throw error;
      if (active && race === name) { if (name === 'windows') windows = newerWindows; else current = other; } };
    function register(event: string, callback: any, once: boolean, id: string) { step('register:' + event, { once, id }); callbacks.set(event, { callback, once }); if (failure === 'register:' + event) throw error; }
    function window(id: string) { return { id, once: (event: string, callback: any) => register(event, callback, true, id),
      isDestroyed() { step('destroyed', id); return config.state === 'destroyed'; }, isVisible() { step('visible', id); return config.state === 'visible'; },
      webContents: { id, setWindowOpenHandler: (callback: any) => register('open-handler', callback, false, id),
        once: (event: string, callback: any) => register(event, callback, true, id), on: (event: string, callback: any) => register(event, callback, false, id) } }; }
    const self = window('self'), other = window('other'), shell = {}; current = self;
    let windows: any[] = [self]; const newerWindows = [other];
    const deps = { getMainWindow() { if (active) step('getWindow', current?.id ?? null); return current; },
      markMainWindowCanShow() { step('mark'); canShow = true; }, getRendererRecoveryInProgress() { step('recovery', recovery); return recovery; },
      showMainWindowWhenReady(reason: string) { assert.ok(canShow); step('ready', reason); },
      openExternalSafely(s: unknown, url: string) { assert.equal(s, shell); step('external', url); }, shell,
      notifySettingsWindowState() { step('settings'); }, notifyChatWindowState() { step('chat'); }, broadcastSharedState() { step('shared'); },
      scheduleWindowStackOnTop() { step('stack'); }, getShellRendererWindows() { step('windows'); return windows; },
      captureService: { scheduleDisplayEnvironmentBroadcast(payload: any) { assert.equal(payload.windows, windows); assert.equal(payload.includeCaptureSources, false); step('environment', { ...payload, windows: payload.windows.map((w: any) => w.id) }); } },
      logWindowEvent(message: string) { step('log', message); }, recoverMainWindowRenderer(contents: any, details: unknown) { step('recover', { id: contents.id, details }); },
    };
    const attach = factory(deps); assert.deepEqual(calls, []); let registrationFailed = false;
    try { assert.equal(attach(), undefined); } catch (caught) { assert.equal(caught, error); registrationFailed = true; }
    if (registrationFailed) { assert.ok(failure); assert.deepEqual(calls.map(c => c[0]), registrations.slice(0, registrations.indexOf(failure.slice(9)) + 1).map(e => 'register:' + e)); }
    else {
      assert.deepEqual(calls.map(c => c[0]), registrations.map(e => 'register:' + e));
      for (const [event, entry] of callbacks) assert.equal(entry.once, ['ready-to-show', 'did-finish-load'].includes(event));
      calls.length = 0; active = true;
      for (let round = 0; round < (onlyEvent ? 1 : 2); round++) {
        current = config.state === 'null' ? null : config.swapped || round ? other : self; recovery = round ? !config.recovery : Boolean(config.recovery);
        for (const event of onlyEvent ? [onlyEvent] : registrations) {
          const entry = callbacks.get(event); if (!entry) continue; if (entry.once) callbacks.delete(event);
          const start = calls.length; let caughtName: string | undefined;
          try { const result = event === 'open-handler' ? entry.callback({ url: 'https://example.test/' }) : event === 'did-fail-load'
            ? entry.callback({}, config.code, 'network failure', 'https://load.test/', config.mainFrame) : entry.callback();
            if (event === 'open-handler') assert.deepEqual(result, { action: 'deny' }); else assert.equal(result, undefined);
          } catch (caught) { if (failure) { assert.equal(caught, error); assert.equal(calls.at(-1)?.[0], failure); }
            else { assert.equal(event, 'did-fail-load'); assert.equal(current, null); assert.ok(caught instanceof TypeError); } caughtName = (caught as Error).name; }
          if (failure) assert.equal(caughtName, 'Error');
          const names = calls.slice(start).map(c => c[0]).filter(n => n !== 'getWindow');
          if (!failure && !race && event === 'did-finish-load') assert.deepEqual(names, [
            ...(config.state === 'null' ? [] : ['destroyed']), ...(config.state === 'hidden' || config.state === 'visible' ? ['visible'] : []),
            ...(config.state === 'hidden' ? ['mark', 'ready'] : []), 'settings', 'chat', 'shared', 'stack', 'windows', 'environment']);
          if (!failure && event === 'did-fail-load' && (!config.mainFrame || config.code === -3)) assert.deepEqual(names, []);
          calls.push(['result', { event, round, caughtName, canShow }]);
        }
      }
    }
    outputs.push({ config, failure, onlyEvent, race, calls, registrationFailed, canShow });
  }
}
const root = fs.readFileSync('electron/windowManager.cjs', 'utf8');
assert.match(root, /getMainWindow: \(\) => managerState\.mainWindow/); assert.match((root + lifecycleStateSource), /markMainWindowCanShow: \(\) => \{ managerState\.mainWindowCanShow = true; \}/);
assert.match((root + lifecycleStateSource), /getRendererRecoveryInProgress: \(\) => managerState\.mainWindowRendererRecoveryInProgress/);
const creation = fs.readFileSync('electron/windowManager/mainWindowCreation.cjs', 'utf8');
const assembly=fs.readFileSync('electron/windowManager/mainWindowCreationControllers.cjs','utf8');
assert.match(assembly, /scheduleMainWindowRendererReadyFallback, attachMainWindowLoadEvents, attachMainWindowPresentationEvents,/);
assert.match(creation, /scheduleMainWindowRendererReadyFallback\(\);\s*attachMainWindowLoadEvents\(\);\s*attachMainWindowPresentationEvents\(\);/);
console.log(`Main load events smoke passed (${exerciseMainWindowLoadEvents().length} scenarios; fresh state, once/on, recovery guards and errors).`);
