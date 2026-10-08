import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readModuleProjectFunction } from './projectModuleSource.mjs';

const require = createRequire(import.meta.url);
const actualFactory = require('../electron/windowManager/windowLoadLogging.cjs').createWindowLoadLogging;
const events = ['did-start-loading', 'did-stop-loading', 'did-finish-load', 'did-fail-load', 'dom-ready', 'closed'];
export function exerciseWindowLoadLogging(factory = actualFactory) {
  const outputs: unknown[] = [];
  for (const logger of ['function', 'undefined', 'null', 'false', 'number', 'string', 'object']) {
    for (const window of ['null', 'undefined', 'destroyed', 'alive']) {
      for (const label of ['main-window', '', undefined]) outputs.push(exercise(logger, window, label));
    }
  }
  for (const failure of ['destroyed', ...events.map(event => `register:${event}`), 'url', 'log']) {
    outputs.push(exercise('function', 'alive', 'failure-window', failure));
  }
  // One adapter captures its original logger, and distinct adapters do not share it.
  const first: unknown[] = [], second: unknown[] = [];
  const options = { log: (message: unknown) => { first.push(message); } };
  const api = factory(options); options.log = message => { second.push(message); };
  api.logWindowEvent('original'); factory(options).logWindowEvent('other');
  assert.deepEqual(first, ['original']); assert.deepEqual(second, ['other']);
  outputs.push({ first, second });
  return outputs;

  function exercise(logger: string, window: string, label: unknown, failure?: string) {
    const calls: unknown[][] = [], messages: unknown[] = [];
    const listeners = new Map<string, ((...args: unknown[]) => void)[]>();
    const error = new Error('original load logging error');
    const step = (name: string, ...args: unknown[]) => {
      calls.push([name, ...args]); if (name === failure) throw error;
    };
    const log = logger === 'function' ? (message: unknown) => { step('log', message); messages.push(message); }
      : ({ undefined, null: null, false: false, number: 42, string: 'logger', object: {} } as Record<string, unknown>)[logger];
    const api = factory({ log });
    assert.deepEqual(calls, [], 'constructing the adapter must not query a window or write logs');
    assert.deepEqual(Object.keys(api).sort(), ['attachLoadLogging', 'logWindowEvent']);
    let url = 'file:///first/index.html', destroyed = window === 'destroyed';
    const register = (event: string, callback: (...args: unknown[]) => void) => {
      step(`register:${event}`); listeners.set(event, [...(listeners.get(event) ?? []), callback]);
    };
    const win = window === 'null' ? null : window === 'undefined' ? undefined : {
      isDestroyed() { step('destroyed'); return destroyed; },
      webContents: { on: register, getURL() { step('url', url); return url; } }, on: register,
    };
    let failed = false;
    try {
      api.attachLoadLogging(win, label);
      if (window === 'alive') {
        assert.deepEqual(calls, [['destroyed'], ...events.map(event => [`register:${event}`])]);
        assert.equal(messages.length, 0, 'registering listeners must not emit logs');
        // Changing URL/destruction after registration must preserve event-time reads and callbacks.
        for (let round = 0; round < 2; round++) {
          url = round ? 'http://127.0.0.1:3000/?panel=settings' : '';
          destroyed = true;
          for (const event of events) {
            const previous = calls.length;
            for (const callback of listeners.get(event) ?? []) callback({}, -3, 'aborted', 'validated-url', round === 0);
            assert.equal(calls.slice(previous).filter(call => call[0] === 'url').length,
              ['did-stop-loading', 'did-finish-load', 'dom-ready'].includes(event) ? 1 : 0);
          }
        }
        if (logger === 'function') assert.deepEqual(messages, [0, 1].flatMap(round => {
          const currentUrl = round ? 'http://127.0.0.1:3000/?panel=settings' : '';
          return [`${label}: did-start-loading`, `${label}: did-stop-loading ${currentUrl}`,
            `${label}: did-finish-load ${currentUrl}`,
            `${label}: did-fail-load code=-3 mainFrame=${round === 0} url=validated-url error=aborted`,
            `${label}: dom-ready ${currentUrl}`, `${label}: closed`];
        }));
        else assert.deepEqual(messages, []);
        // Calling twice retains the original on() behavior; no implicit deduplication/removal.
        api.attachLoadLogging({ ...win, isDestroyed: () => false }, label);
        assert.ok([...listeners.values()].every(value => value.length === 2));
      } else assert.equal(listeners.size, 0);
      const token = {}; api.logWindowEvent(token);
      if (logger === 'function') assert.equal(messages.at(-1), token);
    } catch (caught) {
      assert.ok(failure); assert.equal(caught, error); assert.equal(calls.at(-1)?.[0], failure); failed = true;
    }
    assert.equal(failed, Boolean(failure));
    return JSON.parse(JSON.stringify({ logger, window, label, failure, calls, messages,
      listeners: [...listeners].map(([event, callbacks]) => [event, callbacks.length]), failed }));
  }
}
const manager = readModuleProjectFunction('electron/windowManager.cjs', 'createWindowManager');
assert.match(manager, /const \{ logWindowEvent, attachLoadLogging \} = createWindowLoadLogging\(\{ log \}\)/u);
assert.equal(exerciseWindowLoadLogging().length, 94);
console.log('Window load logging smoke passed (94 cases; lazy registration/order/live URLs/repeated events/logger isolation/errors).');
