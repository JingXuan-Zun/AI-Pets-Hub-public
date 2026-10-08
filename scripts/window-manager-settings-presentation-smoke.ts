import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readModuleProjectFile } from './projectModuleSource.mjs';
const require = createRequire(import.meta.url);
const actual = require('../electron/windowManager/settingsWindowPresentation.cjs').createSettingsWindowPresenter;

export function exerciseSettingsWindowPresentation(factory = actual) {
  const outputs: unknown[] = [];
  for (const state of ['null', 'destroyed', 'normal'])
    for (const visible of [false, true]) for (const difference of [-1, 0, 1, 2, 3])
      for (const minimized of [false, true]) for (const loading of [false, true])
        for (const correctUrl of [false, true]) for (const diagnostic of [false, true])
          for (const mainState of ['null', 'destroyed', 'normal']) {
            run({ state, visible, difference, minimized, loading, correctUrl, diagnostic, mainState });
          }
  const full = { state: 'normal', visible: true, difference: 0, minimized: true,
    loading: false, correctUrl: false, diagnostic: true, mainState: 'normal' };
  for (const failure of ['destroyed', 'visible', 'bounds', 'getBounds', 'setBounds', 'minimized',
    'restore', 'loading', 'url', 'getURL', 'log', 'load', 'show', 'focus', 'mainDestroyed',
    'mainHide', 'top', 'stack', 'notify']) run(full, failure);
  run({ ...full, correctUrl: true }, 'refresh');
  run({ ...full, urlText: '' });
  for (const race of ['getBounds', 'restore', 'show', 'mainDestroyed']) run(full, undefined, race);
  return outputs;

  function run(config: any, failure?: string, race?: string) {
    const calls: any[][] = [], error = new Error('presentation dependency error');
    const nextBounds = { x: -1280, y: 50, width: 900, height: 700 };
    const currentBounds = { ...nextBounds };
    if (config.difference >= 0) currentBounds[['x', 'y', 'width', 'height'][config.difference] as keyof typeof currentBounds]++;
    let current: any, main: any;
    const step = (name: string, id?: string, value?: unknown) => {
      calls.push([name, id, value]);
      if (failure === name) throw error;
      if (race === name) { if (name === 'mainDestroyed') main = otherMain; else current = other; }
    };
    function window(id: string) {
      return {
        isDestroyed() { step('destroyed', id); return config.state === 'destroyed'; },
        isVisible() { step('visible', id); return config.visible; },
        getBounds() { step('getBounds', id); return currentBounds; },
        setBounds(bounds: unknown) { assert.equal(bounds, nextBounds); step('setBounds', id); },
        isMinimized() { step('minimized', id); return config.minimized; },
        restore() { step('restore', id); }, show() { step('show', id); }, focus() { step('focus', id); },
        webContents: {
          isLoadingMainFrame() { step('loading', id); return config.loading; },
          getURL() { step('getURL', id); return config.urlText ?? 'https://unexpected.example/settings'; },
        },
      };
    }
    const win = window('self'), other = window('other');
    function mainWindow(id: string) { return {
      isDestroyed() { step('mainDestroyed', id); return config.mainState === 'destroyed'; },
      hide() { step('mainHide', id); },
    }; }
    const mainWin = mainWindow('main'), otherMain = mainWindow('otherMain');
    current = config.state === 'null' ? null : win;
    main = config.mainState === 'null' ? null : mainWin;
    const deps = {
      getSettingsWindow: () => current, getMainWindow: () => main,
      getSettingsPanelWindowBounds: () => { step('bounds'); return nextBounds; },
      isSettingsWindowAtSettingsPanelUrl: (w: any) => { step('url', w === win ? 'self' : 'other'); return config.correctUrl; },
      logWindowEvent: (message: string) => step('log', undefined, message),
      loadRenderer: (w: any, query: unknown) => step('load', w === win ? 'self' : 'other', query),
      HIDE_MAIN_WINDOW_FOR_GRAPH_DIAGNOSTICS: config.diagnostic,
      scheduleKeepWindowOnTop: (w: any, level: number, options: unknown) => {
        assert.equal(level, 7); step('top', w === win ? 'self' : 'other', options);
      },
      AUX_TOPMOST_RELATIVE_LEVEL: 7,
      scheduleWindowStackOnTop: () => step('stack'), notifySettingsWindowState: () => step('notify'),
      scheduleSettingsWindowContentRefresh: () => step('refresh'),
    };
    const show = factory(deps);
    assert.deepEqual(calls, [], 'factory must not read windows or perform actions');
    let threw = false;
    try { assert.equal(show(), undefined); } catch (caught) { assert.equal(caught, error); threw = true; }
    assert.equal(threw, Boolean(failure));
    if (!failure && !race) {
      const expected: string[] = [];
      if (config.state !== 'null') expected.push('destroyed');
      if (config.state === 'normal') {
        expected.push('visible', 'bounds', 'getBounds');
        if (config.difference >= 0) expected.push('setBounds');
        expected.push('minimized'); if (config.minimized) expected.push('restore');
        expected.push('loading'); if (!config.loading) expected.push('url');
        if (!config.loading && !config.correctUrl) expected.push('getURL', 'log', 'load');
        expected.push('show', 'focus');
        if (config.diagnostic && config.mainState !== 'null') {
          expected.push('mainDestroyed'); if (config.mainState === 'normal') expected.push('mainHide');
        }
        expected.push('top', 'stack', 'notify');
        if (config.visible && (config.loading || config.correctUrl)) expected.push('refresh');
      }
      assert.deepEqual(calls.map(c => c[0]), expected);
      if (calls.some(c => c[0] === 'load')) {
        assert.deepEqual(calls.find(c => c[0] === 'load')?.[2], { desktop: '1', panel: 'settings' });
        assert.equal(calls.find(c => c[0] === 'log')?.[2],
          `settings-window: reloading unexpected URL ${config.urlText === '' ? '<empty>' : 'https://unexpected.example/settings'}`);
      }
    }
    if (race) {
      const pivot = calls.findIndex(c => c[0] === race);
      const later = calls.slice(pivot + 1);
      const actions = later.filter(c => ['setBounds', 'minimized', 'restore', 'loading', 'url', 'getURL', 'load', 'show', 'focus', 'top'].includes(c[0]));
      if (race !== 'mainDestroyed') assert.ok(actions.every(c => c[1] === 'other'), 'later operations must read the latest window');
      else assert.equal(later.find(c => c[0] === 'mainHide')?.[1], 'otherMain');
    }
    outputs.push({ config, failure, race, calls, threw });
  }
}
const outputs = exerciseSettingsWindowPresentation();
const root = readModuleProjectFile('electron/windowManager.cjs');
assert.match(root, /getSettingsWindow:\s*\(\)\s*=>\s*managerState\.settingsWindow/);
assert.match(root, /getMainWindow:\s*\(\)\s*=>\s*managerState\.mainWindow/);
const wiring = root.match(/const showSettingsWindow = createSettingsWindowPresenter\(\{([\s\S]*?)\n  \}\);/);
assert.ok(wiring);
for (const name of ['getSettingsPanelWindowBounds', 'isSettingsWindowAtSettingsPanelUrl',
  'logWindowEvent', 'loadRenderer', 'HIDE_MAIN_WINDOW_FOR_GRAPH_DIAGNOSTICS',
  'scheduleKeepWindowOnTop', 'AUX_TOPMOST_RELATIVE_LEVEL', 'scheduleWindowStackOnTop',
  'notifySettingsWindowState', 'scheduleSettingsWindowContentRefresh']) {
  assert.match(wiring[1], new RegExp('\\b' + name + '\\s*,'), 'root must inject original ' + name);
}
console.log(`window-manager-settings-presentation-smoke passed (${outputs.length} scenarios)`);

