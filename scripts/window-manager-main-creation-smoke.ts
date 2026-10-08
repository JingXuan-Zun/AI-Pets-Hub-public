import { expandMainWindowLifecycleSource } from './windowManagerAuxiliaryAssemblySource.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { loadWindowManager } from './window-manager-initialization-smoke';
const ownershipStateSource = fs.readFileSync('electron/windowManager/windowOwnershipStateAdapters.cjs', 'utf8');

const lifecycleStateSource = fs.readFileSync('electron/windowManager/mainWindowLifecycleStateAdapters.cjs', 'utf8');

const require = createRequire(import.meta.url);
const actual = require('../electron/windowManager/mainWindowCreation.cjs').createMainWindowCreator;
const stages = ['read0', 'can', 'recovery', 'ready', 'options', 'construct', 'assign', 'read1', 'logging',
  'stack0', 'resize', 'stack1', 'guard', 'pointer', 'proxy', 'read2', 'move', 'read3', 'resize-event',
  'fallback', 'load-events', 'presentation-events', 'env', 'read4', 'contents', 'devtools', 'read5', 'load'];

export function exerciseMainCreation(factory = actual) {
  const outputs: unknown[] = [];
  for (const windowKind of ['none', 'live', 'destroyed']) for (const separate of [false, true]) {
    for (const isDev of [false, true]) for (const env of [undefined, '0', '1', 1]) {
      for (let flags = 0; flags < 8; flags++) run(windowKind, separate, isDev, env, flags);
    }
  }
  for (const failure of stages) run('none', true, true, '1', 7, failure);
  for (const failure of ['read0', 'read1', 'destroyed', 'show']) run('live', true, true, '1', 7, failure);
  run('destroyed', true, true, '1', 7, 'destroyed');
  run('none', true, true, '1', 7, 'event-apply');
  for (const race of stages) run('none', true, true, '1', 7, undefined, race);
  for (const race of ['read0', 'read1', 'destroyed', 'show']) run('live', true, true, '1', 7, undefined, race);
  for (const race of ['logging', 'proxy', 'move', 'contents']) run('none', true, true, '1', 7, undefined, race, true);
  return outputs;

  function run(windowKind: string, separate: boolean, isDev: boolean, initialEnv: unknown, flags: number,
    failure?: string, race?: string, clear = false) {
    const calls: any[][] = [], events: { name: string; win: any; callback: () => unknown }[] = [];
    const error = new Error('creation dependency'), windowOptions = { token: 'options' };
    let readIndex = 0, stackIndex = 0, sequence = 0, env = initialEnv, envReads = 0;
    let can = Boolean(flags & 1), recovery = Boolean(flags & 2), ready = Boolean(flags & 4);
    let current: any, replaced: any;
    const snapshots: unknown[] = [];
    function step(name: string, value?: unknown) {
      calls.push([name, value]);
      if (name === failure) throw error;
      if (name === race) current = clear ? null : replaced;
    }
    function window(id: string, destroyed: boolean) {
      const contents = { openDevTools(options: unknown) {
        assert.equal(this, contents); assert.deepEqual(options, { mode: 'detach' }); step('devtools', id); return 'ignored';
      } };
      const win = {
        id, destroyed,
        isDestroyed() { assert.equal(this, win); step('destroyed', id); return win.destroyed; },
        on(name: string, callback: () => unknown) {
          assert.equal(this, win); assert.ok(name === 'move' || name === 'resize');
          step(name === 'move' ? 'move' : 'resize-event', id); events.push({ name, win, callback }); return win;
        },
        get webContents() { step('contents', id); return contents; },
      };
      return win;
    }
    replaced = window('replacement', false);
    current = windowKind === 'none' ? null : window('initial', windowKind === 'destroyed');
    const deps = {
      getMainWindow() { const win = current; step('read' + readIndex++, win?.id ?? null); return win; },
      setMainWindow(win: any) { step('assign', win.id); current = win; },
      setCanShow(value: boolean) { assert.equal(value, false); step('can', value); can = value; },
      setRendererRecoveryInProgress(value: boolean) { assert.equal(value, false); step('recovery', value); recovery = value; },
      setRendererReadyToShow(value: boolean) { assert.equal(value, false); step('ready', value); ready = value; },
      showOrRecoverMainWindow(reason: string) {
        assert.equal(reason, 'create-existing-window'); step('show', reason);
        return { get then() { assert.fail('creation does not consume the recovery result'); } };
      },
      BrowserWindow: function BrowserWindow(options: unknown) {
        assert.ok(new.target); assert.equal(options, windowOptions); step('construct', options); return window('created' + sequence++, false);
      },
      buildMainWindowOptions() { assert.equal(can, false); assert.equal(recovery, false); assert.equal(ready, false); step('options'); return windowOptions; },
      attachLoadLogging(win: any, label: string) { assert.equal(label, 'main-window'); step('logging', win?.id ?? null); },
      scheduleWindowStackOnTop() { step('stack' + stackIndex++); },
      resizeWindowForSettings(open: boolean) { assert.equal(open, false); step('resize', open); },
      startMainTopmostGuard() { step('guard'); },
      setWindowPointerPassthrough(value: boolean) { assert.equal(value, true); step('pointer', value); },
      USE_SEPARATE_RENDER_AND_INPUT_WINDOWS: separate,
      ensurePostDragInputProxyWindow() { step('proxy'); },
      applyPostDragInputProxyRegions() { step('event-apply', current?.id ?? null); return 'event-result'; },
      scheduleMainWindowRendererReadyFallback() { step('fallback'); },
      attachMainWindowLoadEvents() { step('load-events'); },
      attachMainWindowPresentationEvents() { step('presentation-events'); },
      isDev,
      getOpenDevTools() { envReads++; step('env', env); return env; },
      loadRenderer(win: any) { step('load', win?.id ?? null); return 'ignored renderer result'; },
    };
    const create = factory(deps); assert.deepEqual(calls, []); assert.equal(create.name, 'createWindow'); assert.equal(create.length, 0);
    let caughtKind: string | undefined;
    for (let round = 0; round < (failure || race ? 1 : 2); round++) {
      if (round) {
        current = window('round-two', windowKind === 'destroyed');
        if (windowKind === 'none') current = null;
        can = Boolean(flags & 1); recovery = Boolean(flags & 2); ready = Boolean(flags & 4);
        env = initialEnv === '1' ? '0' : '1';
      }
      readIndex = 0; stackIndex = 0; const start = calls.length, priorEvents = events.length, priorEnvReads = envReads;
      try { assert.equal(create(), undefined); }
      catch (caught) {
        if (caught === error) caughtKind = 'dependency';
        else { assert.ok(clear); assert.ok(caught instanceof TypeError); caughtKind = 'TypeError'; }
      }
      if (!caughtKind && !race) {
        const created = windowKind !== 'live';
        assert.equal(can, created ? false : Boolean(flags & 1));
        assert.equal(recovery, created ? false : Boolean(flags & 2));
        assert.equal(ready, created ? false : Boolean(flags & 4));
        assert.equal(envReads - priorEnvReads, created && isDev ? 1 : 0);
        assert.equal(events.length - priorEvents, created && separate ? 2 : 0);
        if (!created) assert.deepEqual(calls.slice(start).map(call => call[0]), ['read0', 'read1', 'destroyed', 'show']);
        else {
          const names = ['read0', ...(windowKind === 'destroyed' ? ['read1', 'destroyed'] : []),
            'can', 'recovery', 'ready', 'options', 'construct', 'assign', 'read', 'logging',
            'stack0', 'resize', 'stack1', 'guard', 'pointer',
            ...(separate ? ['proxy', 'read', 'move', 'read', 'resize-event'] : []),
            'fallback', 'load-events', 'presentation-events', ...(isDev ? ['env'] : []),
            ...(isDev && env === '1' ? ['read', 'contents', 'devtools'] : []), 'read', 'load'];
          assert.deepEqual(calls.slice(start).map(call => /^read\d+$/.test(call[0]) && call[0] !== 'read0'
            && !(windowKind === 'destroyed' && call[0] === 'read1') ? 'read' : call[0]), names);
        }
      }
      if (caughtKind) break;
    }
    if (failure && failure !== 'event-apply') {
      assert.equal(caughtKind, 'dependency'); assert.equal(calls.at(-1)?.[0], failure);
    }
    if (clear) {
      assert.equal(caughtKind, race === 'contents' ? undefined : 'TypeError');
      if (race === 'contents') {
        assert.ok(calls.some(call => call[0] === 'devtools'));
        assert.deepEqual(calls.at(-1), ['load', null]);
      }
    }
    snapshots.push({ can, recovery, ready, current: current?.id ?? null, caughtKind });
    current = window('event-current', false);
    for (const event of events) {
      try { assert.equal(event.callback(), 'event-result'); }
      catch (caught) { assert.equal(caught, error); assert.equal(failure, 'event-apply'); caughtKind = 'dependency'; }
    }
    if (failure === 'event-apply') assert.equal(caughtKind, 'dependency');
    assert.equal(caughtKind === 'dependency', Boolean(failure));
    outputs.push({ windowKind, separate, isDev, initialEnv, flags, failure, race, clear, calls, snapshots,
      events: events.map(event => ({ name: event.name, window: event.win.id })), caughtKind });
  }
}

const actualRoot = fs.readFileSync('electron/windowManager.cjs', 'utf8');
const root = expandMainWindowLifecycleSource(actualRoot);
const start = root.indexOf('const createWindow = createMainWindowStateCreationControllers(');
const assembly=fs.readFileSync('electron/windowManager/mainWindowCreationControllers.cjs','utf8');
assert.ok(assembly.indexOf('= createMainWindowCreator(') > assembly.indexOf('const buildMainWindowOptions ='));
assert.ok(start > root.indexOf('= createMainWindowStateRecoveryControllers('));
assert.ok(assembly.indexOf('= createMainWindowCreator(') > assembly.indexOf('const attachMainWindowPresentationEvents ='));
assert.equal((root.match(/createWindowFor(?:Recovery|Health): \(\) => createWindow\(\)/g) ?? []).length, 2);
assert.match((root + ownershipStateSource), /setMainWindow: \(win\) => \{ managerState\.mainWindow = win; \}/);
assert.match(((root + lifecycleStateSource) + ownershipStateSource), /setCanShow: \(value\) => \{ managerState\.mainWindowCanShow = value; \}/);
assert.match(((root + lifecycleStateSource) + ownershipStateSource), /setRendererRecoveryInProgress: \(value\) => \{ managerState\.mainWindowRendererRecoveryInProgress = value; \}/);
assert.match(((root + lifecycleStateSource) + ownershipStateSource), /setRendererReadyToShow: \(value\) => \{ managerState\.mainWindowRendererReadyToShow = value; \}/);
assert.match(root, /getOpenDevTools: \(\) => process.env.DESKTOP_PET_OPEN_DEVTOOLS/);
assert.match(fs.readFileSync('electron/windowManager/windowManagerPublicApi.cjs', 'utf8'), /createMainWindow: createWindow/);
console.log(`Main window creation smoke passed (${exerciseMainCreation().length} scenarios).`);

// Keep the real manager, health and recovery modules; replace only native creation.
const creationAssemblySource = assembly.replace("require('./mainWindowCreation.cjs')", `({
  createMainWindowCreator({setMainWindow, setCanShow, setRendererRecoveryInProgress, setRendererReadyToShow}) {
    let sequence = 0;
    return function createWindow() {
      setCanShow(false); setRendererRecoveryInProgress(false); setRendererReadyToShow(false);
      setMainWindow({sequence: sequence++, destroyed: false,
        isDestroyed() { return this.destroyed; }, destroy() { this.destroyed = true; },
        webContents: {isDestroyed() { return true; }},
      });
    };
  }
})`);
const lifecycleSource = fs.readFileSync('electron/windowManager/mainWindowLifecycleControllers.cjs', 'utf8')
  .replace("require('./mainWindowCreationControllers.cjs')", `(() => {
    const module = { exports: {} };
    ${creationAssemblySource}
    return module.exports;
  })()`);
const assemblySource = actualRoot.replace("require('./windowManager/mainWindowLifecycleControllers.cjs')", `(() => {
  const module = { exports: {} };
  ${lifecycleSource.replaceAll("require('./", "require('./windowManager/")}
  return module.exports;
})()`);
let assemblyCases = 0;
for (const isDev of [false, true]) for (const sessionPartition of [undefined, 'persist:test']) {
  const { api, effects } = loadWindowManager(assemblySource);
  const first = api.createWindowManager({ isDev, sessionPartition, captureService: {} });
  const second = api.createWindowManager({ isDev, sessionPartition, captureService: {} });
  for (const manager of [first, second]) {
    assert.equal(await manager.showOrRecoverMainWindow('assembly'), 'created');
    const initial = manager.getMainWindow(); assert.equal(initial.sequence, 0);
    assert.equal(await manager.showOrRecoverMainWindow('assembly'), 'recreated');
    assert.equal(initial.destroyed, true); assert.equal(manager.getMainWindow().sequence, 1);
    const recovered = manager.getMainWindow();
    assert.equal(manager.recoverMainWindowRenderer(recovered.webContents, { reason: 'assembly' }), true);
    assert.equal(recovered.destroyed, true); assert.equal(manager.getMainWindow().sequence, 2);
    assert.equal(manager.createMainWindow(), undefined); assert.equal(manager.getMainWindow().sequence, 3);
    assemblyCases++;
  }
  assert.deepEqual(effects, [], 'assembly checks must not run native actions');
}
console.log(`Main creation root wiring passed (${assemblyCases} managers; real health and recovery consumers).`);
