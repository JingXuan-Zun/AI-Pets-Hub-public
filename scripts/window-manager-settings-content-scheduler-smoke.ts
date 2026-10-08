import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const actual = require('../electron/windowManager/settingsWindowContentScheduler.cjs').createSettingsWindowContentScheduler;
export function exerciseSettingsContentScheduler(factory = actual) {
  const outputs: unknown[] = [];
  for (const time of [-1, 0, 4999, 5000, 5001, 10000, NaN]) for (const at of [0, 100, '0', NaN]) {
    for (const display of [false, true, undefined]) for (const capture of [false, true, 'forced']) run(time, at, display, capture);
  }
  for (const options of [undefined, {}, null, false, 0, 'options', [], () => {}]) run(6000, 0, false, false, undefined, undefined, options, true);
  for (const failure of ['capture', 'display', 'clock', 'read', 'write', 'refresh']) run(6000, 0, false, true, failure);
  for (const race of ['capture', 'display', 'clock', 'read', 'write', 'refresh']) run(6000, 0, false, true, undefined, race);
  return outputs;
  function run(time: number, initialAt: unknown, display: unknown, capture: unknown, failure?: string, race?: string, supplied?: unknown, useSupplied = false) {
    const calls: any[][] = [], error = new Error('cooldown dependency error'); let currentTime = time, at: any = initialAt, threw: any, failed = false;
    const step = (name: string, value?: unknown) => {
      calls.push([name, value]); if (failure === name) { failed = true; throw error; }
      if (race === name) { if (['capture', 'display', 'read'].includes(name)) currentTime = 10000; else at = 9000; }
    };
    const options = { get forceCaptureSourceRefresh() { step('capture'); return capture; }, get forceDisplayRefresh() { step('display'); return display; } };
    const deps = { getCurrentTime() { step('clock', currentTime); return currentTime; }, getContentRefreshAt() { step('read', at); return at; },
      setContentRefreshAt(value: unknown) { step('write', value); at = value; }, refreshSettingsWindowContent(force: unknown) { step('refresh', force); return 'ignored'; },
      SETTINGS_WINDOW_CONTENT_REFRESH_COOLDOWN_MS: 5000 };
    const schedule = factory(deps); assert.deepEqual(calls, []);
    for (let round = 0; round < 2; round++) {
      const start = calls.length, beforeAt = at;
      try { assert.equal(useSupplied ? schedule(supplied) : schedule(options), undefined); }
      catch (caught) { assert.ok(caught === error || (supplied === null && caught instanceof TypeError)); threw = caught; break; }
      if (!failure && !race && !useSupplied) {
        const shouldRefresh = !(!display && (time - Number(beforeAt)) <= 5000);
        assert.deepEqual(calls.slice(start).map(c => c[0]), ['capture', 'display', 'clock', ...(!display ? ['read'] : []), ...(shouldRefresh ? ['write', 'refresh'] : [])]);
        if (shouldRefresh) { assert.equal(at, time); assert.equal(calls.at(-1)?.[1], capture); }
      }
      if (round === 0 && !failure && !race && !useSupplied) { at = 100; currentTime = time; }
    }
    assert.equal(threw === error, failed);
    if (failure === 'refresh') assert.equal(at, time, 'timestamp must remain updated when refresh throws');
    if (threw === error) assert.equal(calls.at(-1)?.[0], failure);
    outputs.push({ time, initialAt, display, capture, failure, race, useSupplied, supplied: typeof supplied === 'function' ? 'function' : supplied, calls, at, threw: threw === error ? 'dependency' : threw ? 'TypeError' : null });
  }
}
const root = fs.readFileSync('electron/windowManager.cjs', 'utf8');
assert.match(fs.readFileSync('electron/windowManager/settingsPresentationControllers.cjs', 'utf8'), /getContentRefreshAt: \(\) => managerState\.settingsWindowContentRefreshAt/);
assert.match(fs.readFileSync('electron/windowManager/settingsPresentationControllers.cjs', 'utf8'), /setContentRefreshAt: \(value\) => \{ managerState\.settingsWindowContentRefreshAt = value; \}/);
assert.match(root, /getCurrentTime: \(\) => Date.now\(\)/);
assert.match(root, /refreshSettingsWindowContent: \(force\) => refreshSettingsWindowContent\(force\)/);
const assembly = fs.readFileSync('electron/windowManager/settingsPresentationControllers.cjs', 'utf8');
assert.ok(assembly.indexOf('= createSettingsWindowContentScheduler(') < assembly.indexOf('= createSettingsWindowPresenter('));
assert.match(root, /createSettingsStatePresentationControllers\(\{/);
console.log(`Settings content scheduler smoke passed (${exerciseSettingsContentScheduler().length} scenarios).`);
