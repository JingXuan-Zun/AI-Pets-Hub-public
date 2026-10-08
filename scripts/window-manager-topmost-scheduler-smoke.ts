import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const actual = require('../electron/windowManager/windowTopmostScheduler.cjs').createWindowTopmostScheduler;

export function exerciseTopmostScheduler(factory = actual) {
  const outputs: unknown[] = [];
  for (const windowKind of ['window', 'null', 'undefined']) {
    for (const level of [undefined, null, 0, 9]) {
      for (const optionsKind of ['default', 'null', 'false', 'object']) {
        run(windowKind, level, optionsKind);
      }
    }
  }
  for (const failure of ['top0', 'timer0', 'timer250', 'top1', 'top2']) {
    run('window', 9, 'object', failure);
  }
  run('window', undefined, 'default', undefined, 'reverse');
  run('window', 0, 'object', undefined, 'synchronous');
  run('window', 0, 'object', 'top1', 'synchronous');
  return outputs;

  function run(windowKind: string, level: unknown, optionsKind: string, failure?: string, mode = 'deferred') {
    const calls: unknown[][] = [], seenOptions: unknown[] = [], error = new Error('scheduler dependency');
    let topIndex = 0, failures = 0;
    const pending: { callback: () => unknown; delay: number }[] = [];
    let currentWindow: any = windowKind === 'window' ? { id: 'initial' } : windowKind === 'null' ? null : undefined;
    let passedWindow: any, passedOptions: any;
    const deps = {
      MAIN_TOPMOST_RELATIVE_LEVEL: 7,
      keepWindowOnTop(win: unknown, actualLevel: unknown, options: any) {
        assert.equal(win, passedWindow, 'callbacks retain the supplied window');
        assert.equal(actualLevel, level === undefined ? 7 : level);
        if (optionsKind === 'default') {
          assert.deepEqual(options, {});
          if (topIndex % 3 === 0) {
            assert.ok(!seenOptions.includes(options), 'each invocation gets fresh default options');
            seenOptions.push(options);
          } else assert.equal(options, seenOptions.at(-1));
        } else assert.equal(options, passedOptions, 'options are passed by reference');
        const name = 'top' + topIndex++;
        calls.push([name, (win as any)?.id ?? null, actualLevel, options && typeof options === 'object' ? { ...options } : options]);
        if (name === failure) throw error;
        return 'ignored topmost result';
      },
      setTimeout(callback: () => unknown, delay: number) {
        const name = 'timer' + delay;
        calls.push([name]);
        if (name === failure) throw error;
        assert.ok(delay === 0 || delay === 250);
        pending.push({ callback, delay });
        if (mode === 'synchronous') assert.equal(callback(), 'ignored topmost result');
        return { unref() { assert.fail('original scheduler does not unref'); } };
      },
    };
    const api = factory(deps);
    assert.deepEqual(calls, [], 'factory does not read windows or create timers');
    assert.equal(api.scheduleKeepWindowOnTop.length, 1);
    for (let round = 0; round < (failure ? 1 : 2); round++) {
      topIndex = 0; pending.length = 0;
      passedWindow = currentWindow;
      passedOptions = optionsKind === 'object' ? { bringToFront: true } : optionsKind === 'null' ? null : optionsKind === 'false' ? false : undefined;
      const start = calls.length;
      let returned = false;
      try {
        assert.equal(api.scheduleKeepWindowOnTop(currentWindow, level, passedOptions), undefined);
        returned = true;
      } catch (caught) {
        assert.equal(caught, error); failures++;
        assert.equal(calls.at(-1)?.[0], failure);
      }
      if (!failure || ['top1', 'top2'].includes(failure) && mode !== 'synchronous') {
        assert.equal(returned, true);
        assert.deepEqual(calls.slice(start).map(call => call[0]), mode === 'synchronous'
          ? ['top0', 'timer0', 'top1', 'timer250', 'top2'] : ['top0', 'timer0', 'timer250']);
        assert.deepEqual(pending.map(timer => timer.delay), [0, 250]);
      } else {
        assert.equal(returned, false);
        const expected: Record<string, string[]> = {
          top0: ['top0'], timer0: ['top0', 'timer0'], timer250: ['top0', 'timer0', 'timer250'],
          top1: ['top0', 'timer0', 'top1'],
        };
        assert.deepEqual(calls.slice(start).map(call => call[0]), expected[failure!]);
      }
      currentWindow = { id: 'replacement' };
      if (passedWindow) passedWindow.id = 'mutated';
      if (optionsKind === 'object') passedOptions.bringToFront = false;
      if (mode !== 'synchronous') {
        const timers = mode === 'reverse' ? [...pending].reverse() : pending;
        for (const timer of timers) {
          try { assert.equal(timer.callback(), 'ignored topmost result'); }
          catch (caught) { assert.equal(caught, error); failures++; }
        }
        for (const call of calls.slice(start).filter(call => /^top[12]$/.test(String(call[0])))) {
          assert.equal(call[1], passedWindow ? 'mutated' : null);
          if (optionsKind === 'object') assert.deepEqual(call[3], { bringToFront: false });
        }
      }
    }
    assert.equal(failures, failure ? 1 : 0);
    outputs.push({ windowKind, level, optionsKind, failure, mode, calls, failures });
  }
}

const root = fs.readFileSync('electron/windowManager.cjs', 'utf8');
const assembly = fs.readFileSync('electron/windowManager/windowPlacementControllers.cjs', 'utf8');
assert.match(root, /TOPMOST_GUARD_INTERVAL_MS,\s*setTimeout: \(callback, delay\) => setTimeout\(callback, delay\)/);
assert.match(assembly, /keepWindowOnTop, MAIN_TOPMOST_RELATIVE_LEVEL, setTimeout/);
assert.ok(assembly.indexOf('= createWindowTopmostScheduler(') < assembly.indexOf('= createAuxWindowTopmostScheduler('));
assert.ok(assembly.indexOf('= createWindowTopmostScheduler(') < assembly.indexOf('= createWindowStackTopmost('));
assert.doesNotMatch(root, /function scheduleKeepWindowOnTop\(/);
console.log(`Topmost scheduler smoke passed (${exerciseTopmostScheduler().length} scenarios).`);
