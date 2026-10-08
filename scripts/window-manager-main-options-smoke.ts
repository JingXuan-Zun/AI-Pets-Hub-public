import { expandMainWindowLifecycleSource } from './windowManagerAuxiliaryAssemblySource.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const actual = require('../electron/windowManager/mainWindowOptions.cjs').createMainWindowOptionsBuilder;
export function exerciseMainWindowOptions(factory = actual) {
  const outputs: unknown[] = [];
  for (const mode of ['normal', 'negative', 'undefined']) for (const partition of [undefined, null, '', false, 0, 'persist:main', 'temporary', '中文'])
    for (const icon of ['empty', 'normal', 'conflict', 'symbol']) run(mode, partition, icon);
  for (const failure of ['width', 'height', 'icon', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight', 'join']) run('normal', 'persist:main', 'normal', failure);
  for (const race of ['width', 'icon', 'minWidth']) run('normal', 'persist:main', 'normal', undefined, race);
  return JSON.parse(JSON.stringify(outputs));
  function run(mode: string, partition: unknown, icon: string, failure?: string, race?: string) {
    const calls: any[][] = [], error = new Error('main options dependency error');
    const marker = {}, symbol = Symbol('icon-extra'); let width: any = mode === 'undefined' ? undefined : mode === 'negative' ? -1 : 500;
    let height: any = mode === 'undefined' ? undefined : 600, minWidth = 1, minHeight = 2, iconName = 'first.ico';
    const step = (name: string, value?: unknown) => { calls.push([name, value]); if (name === failure) throw error; };
    const bounds = {
      get width() { step('width'); if (race === 'width') height = 777; return width; }, get height() { step('height'); return height; },
      get minWidth() { step('minWidth'); if (race === 'minWidth') minHeight = 999; return minWidth; },
      get minHeight() { step('minHeight'); return minHeight; }, get maxWidth() { step('maxWidth'); return 8192; }, get maxHeight() { step('maxHeight'); return 1248; },
    };
    const deps = { COMPACT_WINDOW_BOUNDS: bounds, getBrowserWindowIconOptions() {
      step('icon'); if (race === 'icon') { width = 888; minWidth = 3; }
      return icon === 'empty' ? {} : icon === 'conflict' ? { icon: iconName, width: 999, height: 888, minWidth: 999, focusable: true, transparent: false, webPreferences: marker, extra: marker }
        : icon === 'symbol' ? { icon: iconName, [symbol]: marker } : { icon: iconName };
    }, path: { join(...args: string[]) { step('join', args); return path.join(...args); } }, baseDirectory: 'D:\\app\\electron', sessionPartition: partition };
    const build = factory(deps); assert.deepEqual(calls, [], 'construction must not read dimensions, icon or path');
    const results: any[] = []; let threw = false;
    try {
      for (let round = 0; round < 2; round++) {
        if (round) { width = 1500; height = 1600; minWidth = 5; minHeight = 6; iconName = 'second.ico'; }
        const expectedWidth = width, expectedHeight = race === 'width' ? 777 : height;
        const result = build();
        assert.equal(result.width, icon === 'conflict' ? 999 : expectedWidth); assert.equal(result.height, icon === 'conflict' ? 888 : expectedHeight);
        assert.equal(result.minWidth, minWidth); assert.equal(result.minHeight, minHeight); assert.equal(result.maxWidth, 8192); assert.equal(result.maxHeight, 1248);
        for (const [key, value] of Object.entries({ frame: false, transparent: true, focusable: false, hasShadow: false, resizable: true, show: false,
          skipTaskbar: true, alwaysOnTop: true, autoHideMenuBar: true, backgroundColor: '#00000000', title: 'AI Desktop Pet' })) assert.equal(result[key], value);
        assert.deepEqual(result.webPreferences, { preload: path.join(deps.baseDirectory, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: false, ...(partition ? { partition } : {}) });
        if (icon === 'conflict') assert.equal(result.extra, marker); if (icon === 'symbol') assert.equal(result[symbol], marker);
        if (icon !== 'empty') assert.equal(result.icon, iconName);
        if (round) { assert.notEqual(result, results[0]); assert.notEqual(result.webPreferences, results[0].webPreferences); }
        results.push(result);
      }
      assert.deepEqual(calls.map(c => c[0]), Array.from({ length: 2 }, () => ['width', 'height', 'icon', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight', 'join']).flat());
    } catch (caught) { assert.ok(failure); assert.equal(caught, error); assert.equal(calls.at(-1)?.[0], failure); threw = true; }
    assert.equal(threw, Boolean(failure)); outputs.push({ mode, partition, icon, failure, race, calls, results, threw });
  }
}
const root = expandMainWindowLifecycleSource(fs.readFileSync('electron/windowManager.cjs', 'utf8'));
assert.match(root, /COMPACT_WINDOW_BOUNDS,\s*getBrowserWindowIconOptions,\s*path,\s*baseDirectory: __dirname,\s*sessionPartition,/);
const creation = fs.readFileSync('electron/windowManager/mainWindowCreation.cjs', 'utf8');
assert.match(root, /const createWindow = createMainWindowStateCreationControllers\(/);
const assembly=fs.readFileSync('electron/windowManager/mainWindowCreationControllers.cjs','utf8');
assert.match(assembly, /showOrRecoverMainWindow, BrowserWindow, buildMainWindowOptions, attachLoadLogging,/);
assert.match(creation, /setCanShow\(false\);\s*setRendererRecoveryInProgress\(false\);\s*setRendererReadyToShow\(false\);\s*setMainWindow\(new BrowserWindow\(buildMainWindowOptions\(\)\)\);\s*attachLoadLogging\(getMainWindow\(\), 'main-window'\)/);
console.log(`Main window options smoke passed (${exerciseMainWindowOptions().length} scenarios; normal cases run twice).`);
