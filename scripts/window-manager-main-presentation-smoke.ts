import { expandWindowPresentationTraySource } from './windowManagerAuxiliaryAssemblySource.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const lifecycleStateSource = fs.readFileSync('electron/windowManager/mainWindowLifecycleStateAdapters.cjs', 'utf8');
const require = createRequire(import.meta.url);
const actual = require('../electron/windowManager/mainWindowPresentation.cjs').createMainWindowPresenter;

export function exerciseMainPresentation(factory = actual) {
  const outputs: unknown[] = [];
  for (const window of ['null', 'destroyed', 'normal']) for (const timer of [null, 0, 'pending', { id: 'timer' }])
    for (const inactive of ['none', 'method', 'truthy']) for (const minimized of [false, true]) run({ window, timer, inactive, minimized });
  const normal = { window: 'normal', timer: 'pending', inactive: 'method', minimized: true };
  for (const failure of ['window', 'destroyed', 'timer', 'clear', 'setTimer', 'inactiveGet', 'inactive', 'minimized', 'restore', 'top', 'stack', 'warmup']) run(normal, failure);
  run({ ...normal, inactive: 'none' }, 'show');
  for (const race of ['clearSwitchWindow', 'inactiveGetterSwitchWindow', 'showSwitchWindow', 'minimizedSwitchWindow',
    'restoreSwitchWindow', 'topSwitchWindow', 'clearSwitchTimer']) run(normal, undefined, race);
  return JSON.parse(JSON.stringify(outputs));

  function run(config: any, failure?: string, race?: string) {
    const calls: unknown[][] = [], optionReferences: object[] = [], error = new Error('main presentation dependency failure');
    let current: any, timer: any = config.timer, thrown = false;
    const step = (name: string, value?: unknown) => {
      calls.push([name, value]); if (name === failure) throw error;
      if ((race === 'clearSwitchWindow' && name === 'clear')
        || (race === 'inactiveGetterSwitchWindow' && name === 'inactiveGet')
        || (race === 'showSwitchWindow' && (name === 'show' || name === 'inactive'))
        || (race === 'minimizedSwitchWindow' && name === 'minimized')
        || (race === 'restoreSwitchWindow' && name === 'restore')
        || (race === 'topSwitchWindow' && name === 'top')) current = other;
      if (race === 'clearSwitchTimer' && name === 'clear') timer = 'newer';
    };
    function window(id: string) {
      const win = {
        id,
        isDestroyed() { assert.equal(this, win); step('destroyed', id); return config.window === 'destroyed'; },
        get showInactive(): any { step('inactiveGet', id); return config.inactive === 'none' ? undefined
          : config.inactive === 'truthy' ? true : function(this: unknown) { assert.equal(this, win); step('inactive', id); return 'ignored'; }; },
        show() { assert.equal(this, win); step('show', id); return 'ignored'; },
        isMinimized() { assert.equal(this, win); step('minimized', id); return config.minimized; },
        restore() { assert.equal(this, win); step('restore', id); return 'ignored'; },
      };
      return win;
    }
    const self = window('self'), other = window('other'); current = config.window === 'null' ? null : self;
    const deps = {
      getMainWindow() { step('window', current?.id ?? null); return current; },
      getReadyFallbackTimer() { step('timer', timer); return timer; },
      setReadyFallbackTimer(value: unknown) { step('setTimer', value); timer = value; },
      clearTimeout(value: unknown) { step('clear', value); },
      scheduleKeepWindowOnTop(win: unknown, level: number, options: object) {
        assert.equal(win, current); assert.equal(level, 1); assert.deepEqual(options, { bringToFront: true });
        optionReferences.push(options); step('top', { id: current.id, level, options }); return 'ignored';
      },
      MAIN_TOPMOST_RELATIVE_LEVEL: 1,
      scheduleWindowStackOnTop() { step('stack'); return 'ignored'; },
      scheduleMainInteractiveLayerWarmup() { step('warmup'); return 'ignored'; },
    };
    const show = factory(deps); assert.deepEqual(calls, [], 'factory must not read window state or perform actions');
    assert.equal(show.name, 'showMainWindow'); assert.equal(show.length, 0);
    try {
      assert.equal(show(), undefined);
      if (!failure && config.window === 'normal') {
        assert.equal(timer, config.timer ? null : config.timer);
        assert.deepEqual(calls.filter(c => c[0] === 'clear').map(c => c[1]), config.timer ? [config.timer] : []);
        assert.equal(calls.filter(c => c[0] === (config.inactive === 'method' ? 'inactive' : 'show')).length, 1);
        assert.equal(calls.filter(c => c[0] === 'restore').length, config.minimized ? 1 : 0);
        assert.deepEqual(calls.slice(-3).map(c => c[0]), ['top', 'stack', 'warmup']);
        current = other; timer = 'later'; const at = calls.length;
        assert.equal(show(), undefined); assert.deepEqual(calls[at], ['window', 'other']);
        assert.deepEqual(calls.filter(c => c[0] === 'clear').at(-1), ['clear', 'later']);
        assert.equal(optionReferences.length, 2); assert.notEqual(optionReferences[0], optionReferences[1]);
      } else if (!failure) {
        assert.equal(timer, config.timer); assert.ok(calls.every(c => c[0] === 'window' || c[0] === 'destroyed'));
      }
    } catch (caught) { assert.ok(failure); assert.equal(caught, error); assert.equal(calls.at(-1)?.[0], failure); thrown = true; }
    assert.equal(thrown, Boolean(failure)); outputs.push({ config, failure, race, calls, timer, window: current?.id ?? null, thrown });
  }
}

const root = expandWindowPresentationTraySource(fs.readFileSync('electron/windowManager.cjs', 'utf8'));
const start = root.indexOf('= createMainWindowPresentationControllers(');
assert.ok(start >= 0 && start < root.indexOf('= createSettingsTrayControllers('));
assert.ok(start < root.indexOf('= createMainWindowLifecycleControllers('));
const bindings = root.slice(start, root.indexOf('= createSettingsTrayControllers(')) + fs.readFileSync('electron/windowManager/mainWindowPresentation.cjs', 'utf8');
for (const binding of ['getMainWindow: () => managerState.mainWindow', 'getReadyFallbackTimer: () => managerState.mainWindowRendererReadyFallbackTimer',
  'setReadyFallbackTimer: (timer) => { managerState.mainWindowRendererReadyFallbackTimer = timer; }',
  'clearTimeout: (timer) => clearTimeout(timer)', 'scheduleKeepWindowOnTop, MAIN_TOPMOST_RELATIVE_LEVEL',
  'scheduleWindowStackOnTop, scheduleMainInteractiveLayerWarmup']) assert.ok((bindings + lifecycleStateSource).includes(binding));
assert.match(root, /showOrRecoverMainWindow,\s*showMainWindow,/);
assert.equal(exerciseMainPresentation().length, 92);
console.log('Main window presentation smoke passed (72 matrix + 13 dependency errors + 7 live state changes).');
