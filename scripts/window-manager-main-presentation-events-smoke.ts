import { expandMainWindowLifecycleSource } from './windowManagerAuxiliaryAssemblySource.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const actual = require('../electron/windowManager/mainWindowPresentationEvents.cjs').createMainWindowPresentationEventRegistrar;
const events = ['close', 'show', 'restore', 'focus', 'blur', 'move', 'resize'];
export function exerciseMainWindowPresentationEvents(factory = actual) {
  const outputs: unknown[] = [];
  for (const diagnostics of [false, true]) for (const quitting of [false, true])
    for (const focused of ['null', 'missing', 'undefined', 'false', 'true', 'object']) for (const swapped of [false, true]) run({ diagnostics, quitting, focused, swapped });
  for (const event of events) run({ diagnostics: true, focused: 'true' }, 'register:' + event);
  for (const [event, failures] of Object.entries({ close: ['quitting', 'prevent', 'hide'], show: ['window', 'focusGetter', 'focused', 'log', 'proxy', 'stack'],
    restore: ['stack'], focus: ['log'], blur: ['log', 'stack'], move: ['stack'], resize: ['stack'] })) for (const failure of failures) run({ diagnostics: true, focused: 'true' }, failure, event);
  for (const race of ['focused', 'prevent', 'log']) run({ diagnostics: true, focused: 'true' }, undefined, undefined, race);
  return outputs;
  function run(config: any, failure?: string, onlyEvent?: string, race?: string) {
    const calls: any[][] = [], error = new Error('presentation event dependency error'), callbacks = new Map<string, (...args: any[]) => any>();
    let active = false, current: any, quitting = Boolean(config.quitting), reads = 0; const token = {};
    const step = (name: string, value?: unknown) => { calls.push([name, value]); if (active && name === failure) throw error;
      if (active && race === name) { if (name === 'prevent') quitting = true; else current = other; } };
    function window(id: string) { const w = { id, on(event: string, callback: any) { step('register:' + event, id); callbacks.set(event, callback); if (failure === 'register:' + event) throw error; },
      get isFocused(): any { step('focusGetter', id); return config.focused === 'missing' ? undefined : function(this: any) {
        assert.equal(this, w); step('focused', id); return config.focused === 'object' ? { focus: true } : config.focused === 'undefined' ? undefined : config.focused === 'true'; }; } }; return w; }
    const self = window('self'), other = window('other'); current = self;
    const deps = { getMainWindow() { reads++; if (active) step('window', current?.id ?? null); return current; }, getIsQuitting() { step('quitting', quitting); return quitting; },
      pointerDiagnosticsEnabled: config.diagnostics, hideMainWindow() { step('hide'); }, logWindowEvent(message: string) { step('log', message); },
      applyPostDragInputProxyRegions() { step('proxy', current?.id ?? null); }, scheduleWindowStackOnTop() { step('stack'); return token; } };
    const attach = factory(deps); assert.deepEqual(calls, []); assert.equal(reads, 0); let registrationFailed = false;
    try { assert.equal(attach(), undefined); } catch (caught) { assert.equal(caught, error); registrationFailed = true; }
    if (registrationFailed) { assert.ok(failure); assert.deepEqual(calls.map(c => c[0]), events.slice(0, events.indexOf(failure.slice(9)) + 1).map(e => 'register:' + e)); }
    else {
      assert.deepEqual(calls.map(c => c[0]), events.map(e => 'register:' + e)); calls.length = 0; active = true;
      for (let round = 0; round < (onlyEvent ? 1 : 2); round++) {
        quitting = round ? !config.quitting : Boolean(config.quitting); current = config.focused === 'null' ? null : config.swapped || round ? other : self;
        for (const event of onlyEvent ? [onlyEvent] : events) {
          const start = calls.length, wasQuitting = quitting; let caughtName: string | undefined;
          try { const returned = callbacks.get(event)!({ preventDefault() { step('prevent'); } });
            assert.equal(returned, ['restore', 'move', 'resize'].includes(event) ? token : undefined);
          } catch (caught) { assert.ok(failure); assert.equal(caught, error); assert.equal(calls.at(-1)?.[0], failure); caughtName = (caught as Error).name; }
          if (failure) assert.equal(caughtName, 'Error');
          if (!failure) {
            const names = calls.slice(start).map(c => c[0]);
            if (event === 'close') assert.deepEqual(names, wasQuitting ? ['quitting'] : ['quitting', 'prevent', 'hide']);
            if (!config.diagnostics && event === 'show') assert.deepEqual(names, ['proxy', 'stack']);
            if (event === 'focus') assert.deepEqual(names, config.diagnostics ? ['log'] : []);
            if (event === 'blur') assert.deepEqual(names, config.diagnostics ? ['log', 'stack'] : ['stack']);
            if (['restore', 'move', 'resize'].includes(event)) assert.deepEqual(names, ['stack']);
            if (config.diagnostics && event === 'show') assert.equal(calls.slice(start).find(c => c[0] === 'log')?.[1],
              `main-window: show focused=${config.focused === 'object' ? '[object Object]' : config.focused === 'true'}`);
          }
          calls.push(['result', { event, round, caughtName }]);
        }
      }
    }
    outputs.push({ config, failure, onlyEvent, race, calls, registrationFailed });
  }
}
const root = expandMainWindowLifecycleSource(fs.readFileSync('electron/windowManager.cjs', 'utf8'));
assert.match(fs.readFileSync('electron/windowManager/mainWindowCreationControllers.cjs', 'utf8'), /getMainWindow: \(\) => managerState\.mainWindow, getIsQuitting: \(\) => managerState\.isQuitting, pointerDiagnosticsEnabled/);
assert.match(root, /hideMainWindow,\s*logWindowEvent,\s*applyPostDragInputProxyRegions,\s*scheduleWindowStackOnTop/);
const creation = fs.readFileSync('electron/windowManager/mainWindowCreation.cjs', 'utf8');
const assembly=fs.readFileSync('electron/windowManager/mainWindowCreationControllers.cjs','utf8');
assert.match(assembly, /scheduleMainWindowRendererReadyFallback, attachMainWindowLoadEvents, attachMainWindowPresentationEvents,/);
assert.match(creation, /attachMainWindowLoadEvents\(\);\s*attachMainWindowPresentationEvents\(\);\s*if \(isDev/);
console.log(`Main presentation events smoke passed (${exerciseMainWindowPresentationEvents().length} scenarios; two event rounds, diagnostics, current window and errors).`);
