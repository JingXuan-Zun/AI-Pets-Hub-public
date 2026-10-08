import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const ownershipStateSource = fs.readFileSync('electron/windowManager/windowOwnershipStateAdapters.cjs', 'utf8');

const require = createRequire(import.meta.url);
const actual = require('../electron/windowManager/trayConfiguration.cjs').createTrayConfigurator;
export function exerciseTrayConfiguration(factory = actual) {
  const outputs: unknown[] = [];
  for (const state of ['null', 'hidden', 'visible']) for (const swapped of [false, true])
    for (const traySwap of [false, true]) for (const initiallyQuitting of [false, true]) run({ state, swapped, traySwap, initiallyQuitting });
  for (const failure of ['getTray', 'tooltip', 'build', 'context', 'on']) run({ state: 'hidden' }, failure);
  for (const [action, failures] of Object.entries({ show: ['show'], settings: ['settings'], hide: ['hide'], quit: ['mark', 'quit'], double: ['getMain', 'visible', 'show'] }))
    for (const failure of failures) run({ state: 'hidden' }, failure, action);
  run({ state: 'visible' }, 'hide', 'double');
  for (const race of ['visible', 'mark', 'build']) run({ state: 'hidden' }, undefined, undefined, race);
  return outputs;
  function run(config: any, failure?: string, onlyAction?: string, race?: string) {
    const calls: any[][] = [], error = new Error('tray dependency error'), token = {}, menus: any[][] = [];
    let currentTray: any, currentMain: any, doubleClick: (() => unknown) | undefined, quitting = Boolean(config.initiallyQuitting), active = false, configuring = false, reads = 0;
    const step = (name: string, value?: unknown) => { calls.push([name, value]); if (failure === name) throw error;
      if (race === name) { if (name === 'visible') currentMain = otherMain; if (name === 'mark') currentMain = null; if (name === 'build') currentTray = otherTray; } };
    function tray(id: string) { return { id, setToolTip(value: string) { step('tooltip', { id, value }); },
      setContextMenu(value: unknown) { assert.equal(value, token); step('context', id); },
      on(event: string, callback: () => unknown) { assert.equal(event, 'double-click'); step('on', id); doubleClick = callback; } }; }
    function window(id: string) { return { id, isVisible() { step('visible', id); return config.state === 'visible'; }, isDestroyed() { throw new Error('unexpected destruction check'); } }; }
    const selfTray = tray('selfTray'), otherTray = tray('otherTray'), selfMain = window('selfMain'), otherMain = window('otherMain');
    currentTray = selfTray; currentMain = selfMain;
    const deps = { getTray() { reads++; step('getTray', currentTray.id); return currentTray; },
      getMainWindow() { reads++; step('getMain', currentMain?.id ?? null); return currentMain; },
      markQuitting() { step('mark'); quitting = true; }, Menu: { buildFromTemplate(template: any[]) {
        assert.deepEqual(template.map(item => item.label ?? item.type), ['显示宠物', '打开设置', '隐藏到后台', 'separator', '退出']);
        assert.equal(template[3].click, undefined); for (const index of [0, 1, 2, 4]) assert.equal(typeof template[index].click, 'function');
        menus.push(template); step('build', template.map(item => item.label ?? item.type)); if (config.traySwap) currentTray = otherTray; return token;
      } }, app: { quit() { assert.equal(quitting, true); step('quit'); return token; } },
      showMainWindow() { step('show'); return token; }, openSettingsWindow() { step('settings'); return token; }, hideMainWindow() { step('hide'); return token; },
    };
    const configure = factory(deps); assert.deepEqual(calls, []); assert.equal(reads, 0);
    let caughtName: string | undefined;
    try {
      for (let round = 0; round < (failure ? 1 : 2); round++) {
        currentTray = selfTray; currentMain = config.state === 'null' ? null : config.swapped || round ? otherMain : selfMain;
        configuring = true; const start = calls.length; assert.equal(configure(), undefined); configuring = false;
        assert.deepEqual(calls.slice(start).map(c => c[0]), ['getTray', 'tooltip', 'getTray', 'build', 'context', 'getTray', 'on']);
        assert.equal(calls.slice(start).find(c => c[0] === 'context')?.[1], 'selfTray', 'menu receiver is read before template construction');
        assert.equal(calls.at(-1)?.[1], config.traySwap || race === 'build' ? 'otherTray' : 'selfTray');
        if (round) { assert.notEqual(menus[0], menus[1]); assert.notEqual(menus[0][0].click, menus[1][0].click); }
        active = true;
        const actions: Record<string, () => unknown> = { show: menus.at(-1)![0].click, settings: menus.at(-1)![1].click,
          hide: menus.at(-1)![2].click, quit: menus.at(-1)![4].click, double: doubleClick! };
        for (const action of onlyAction ? [onlyAction] : Object.keys(actions)) {
          const at = calls.length; const returned = actions[action](); assert.equal(returned, ['show', 'settings', 'hide'].includes(action) ? token : undefined);
          if (action === 'quit') assert.deepEqual(calls.slice(at).map(c => c[0]), ['mark', 'quit']);
          if (action === 'double' && !race) assert.deepEqual(calls.slice(at).map(c => c[0]), config.state === 'null' ? ['getMain'] : ['getMain', 'getMain', 'visible', config.state === 'visible' ? 'hide' : 'show']);
        }
        active = false;
      }
    } catch (caught) { assert.ok(failure); assert.equal(caught, error); assert.equal(calls.at(-1)?.[0], failure); caughtName = (caught as Error).name; }
    assert.equal(Boolean(caughtName), Boolean(failure)); outputs.push({ config, failure, onlyAction, race, calls, quitting, caughtName, configuring, active });
  }
}
const root = fs.readFileSync('electron/windowManager.cjs', 'utf8');
assert.match((root + ownershipStateSource), /getTray: \(\) => managerState\.tray, getMainWindow: \(\) => managerState\.mainWindow/);
assert.match(ownershipStateSource, /markQuitting: \(\) => \{ managerState\.isQuitting = true; \}/);
assert.match(fs.readFileSync('electron/windowManager/trayConfiguration.cjs', 'utf8'), /\.\.\.windowOwnershipState\.trayOwnership, Menu, app/);
assert.match(fs.readFileSync('electron/windowManager/windowManagerActions.cjs', 'utf8'), /managerState\.tray = new Tray\(resolveTrayIcon\(\)\);\s*configureTray\(\);/);
console.log(`Tray configuration smoke passed (${exerciseTrayConfiguration().length} scenarios; fresh menus, live tray/window, return identities, quit ordering and errors).`);
