import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

// Runs the real window manager against recording fake native windows,
// controlled timers and a controlled clock. The trace lists every native
// window call, log line and timer operation, so two manager sources can be
// compared by behavior instead of by source text.
export const managerPath = path.resolve('electron/windowManager.cjs');
const realRequire = createRequire(managerPath);

export interface InteractionScenarioConfig {
  platform: 'win32' | 'linux';
  diagnostics: boolean;
  prewarm: boolean;
}

type Handler = (...args: unknown[]) => unknown;

function stableError(message: string) {
  const error = new Error(message);
  error.stack = `Error: ${message}`;
  return error;
}

function describe(value: unknown): unknown {
  if (typeof value === 'function') return '[fn]';
  if (value && typeof value === 'object' && (value as { __fakeId?: string }).__fakeId) {
    return `[${(value as { __fakeId: string }).__fakeId}]`;
  }
  if (Array.isArray(value)) return value.map(describe);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, describe(entry)]));
  }
  return value;
}

export async function runInteractionScenario(source: string, config: InteractionScenarioConfig) {
  const trace: string[] = [];
  const record = (line: string) => trace.push(line);
  let now = 1_000;
  let timerSeq = 0;
  const timers = new Map<number, { due: number; callback: Handler; interval: number | null }>();
  const createHandle = (id: number) => ({ __timerId: id, unref() { record(`timer#${id}.unref`); } });
  const fakeSetTimeout = (callback: Handler, delay = 0) => {
    const id = ++timerSeq;
    timers.set(id, { due: now + Number(delay || 0), callback, interval: null });
    record(`setTimeout#${id}(${delay})`);
    return createHandle(id);
  };
  const fakeSetInterval = (callback: Handler, delay = 0) => {
    const id = ++timerSeq;
    timers.set(id, { due: now + Number(delay || 0), callback, interval: Number(delay || 0) });
    record(`setInterval#${id}(${delay})`);
    return createHandle(id);
  };
  const fakeClear = (handle: { __timerId?: number } | null | undefined) => {
    record(`clearTimer#${handle?.__timerId ?? String(handle)}`);
    if (handle?.__timerId) timers.delete(handle.__timerId);
  };
  const advanceClock = (ms: number) => {
    const target = now + ms;
    for (;;) {
      const next = [...timers.entries()]
        .filter(([, timer]) => timer.due <= target)
        .sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0];
      if (!next) break;
      const [id, timer] = next;
      now = timer.due;
      if (timer.interval === null) timers.delete(id);
      else timer.due = now + Math.max(1, timer.interval);
      record(`fire#${id}@${now}`);
      try { timer.callback(); } catch (error) { record(`timer-error#${id} ${(error as Error).message}`); }
    }
    now = target;
  };
  class FakeDate extends Date {
    static now() { return now; }
  }

  const windows: Array<Record<string, any>> = [];
  let windowSeq = 0;
  let proxyWindowCount = 0;
  let proxySetShapeCount = 0;
  function createFakeWebContents(owner: string) {
    const handlers: Array<[string, Handler, boolean]> = [];
    const state = { id: `${owner}.wc`, handlers };
    const target: Record<string, unknown> = {
      __fakeId: state.id,
      on(event: string, handler: Handler) { record(`${state.id}.on(${event})`); handlers.push([event, handler, false]); },
      once(event: string, handler: Handler) { record(`${state.id}.once(${event})`); handlers.push([event, handler, true]); },
      getURL() { record(`${state.id}.getURL()`); return `fake://${owner}`; },
      send(...args: unknown[]) { record(`${state.id}.send(${JSON.stringify(describe(args))})`); },
      sendInputEvent(...args: unknown[]) { record(`${state.id}.sendInputEvent(${JSON.stringify(describe(args))})`); },
      emit(event: string, ...args: unknown[]) {
        for (const entry of [...handlers]) {
          if (entry[0] !== event) continue;
          if (entry[2]) handlers.splice(handlers.indexOf(entry), 1);
          entry[1](...args);
        }
      },
    };
    return new Proxy(target, {
      get(object, key) {
        if (key in object) return object[key as string];
        if (typeof key === 'symbol') return undefined;
        return (...args: unknown[]) => { record(`${state.id}.${String(key)}(${JSON.stringify(describe(args))})`); return undefined; };
      },
    });
  }

  class FakeBrowserWindow {
    constructor(options: Record<string, unknown>) {
      const id = `win${++windowSeq}`;
      const isProxy = options?.title === 'AI Desktop Pet Input Proxy';
      const proxyOrdinal = isProxy ? ++proxyWindowCount : 0;
      record(`new BrowserWindow ${id} ${JSON.stringify(describe(options))}`);
      const bounds = {
        x: Number(options?.x ?? 0), y: Number(options?.y ?? 0),
        width: Number(options?.width ?? 400), height: Number(options?.height ?? 300),
      };
      const handlers: Array<[string, Handler, boolean]> = [];
      const state = { destroyed: false, visible: false, top: false };
      const webContents = createFakeWebContents(id);
      const target: Record<string, unknown> = {
        __fakeId: id,
        __title: String(options?.title ?? ''),
        webContents,
        on(event: string, handler: Handler) { record(`${id}.on(${event})`); handlers.push([event, handler, false]); },
        once(event: string, handler: Handler) { record(`${id}.once(${event})`); handlers.push([event, handler, true]); },
        emit(event: string, ...args: unknown[]) {
          for (const entry of [...handlers]) {
            if (entry[0] !== event) continue;
            if (entry[2]) handlers.splice(handlers.indexOf(entry), 1);
            entry[1](...args);
          }
        },
        isDestroyed() { record(`${id}.isDestroyed()`); return state.destroyed; },
        isVisible() { record(`${id}.isVisible()`); return state.visible; },
        isAlwaysOnTop() { record(`${id}.isAlwaysOnTop()`); return state.top; },
        getBounds() { record(`${id}.getBounds()`); return { ...bounds }; },
        getContentBounds() { record(`${id}.getContentBounds()`); return { ...bounds }; },
        setBounds(next: typeof bounds) { record(`${id}.setBounds(${JSON.stringify(next)})`); Object.assign(bounds, next); },
        setAlwaysOnTop(flag: boolean, ...rest: unknown[]) { record(`${id}.setAlwaysOnTop(${JSON.stringify([flag, ...rest])})`); state.top = Boolean(flag); },
        show() { record(`${id}.show()`); state.visible = true; },
        showInactive() { record(`${id}.showInactive()`); state.visible = true; },
        hide() { record(`${id}.hide()`); state.visible = false; },
        destroy() {
          record(`${id}.destroy()`);
          state.destroyed = true;
          (target.emit as Handler)('closed');
        },
        loadURL(url: string) {
          record(`${id}.loadURL(${String(url).slice(0, 400)})`);
          return proxyOrdinal === 2 ? Promise.reject(stableError('fake proxy load failure')) : Promise.resolve();
        },
        setShape(regions: unknown) {
          record(`${id}.setShape(${JSON.stringify(describe([regions]))})`);
          if (isProxy && ++proxySetShapeCount === 3) throw stableError('fake proxy shape failure');
        },
        loadFile(file: string, options?: unknown) { record(`${id}.loadFile(${path.basename(String(file))} ${JSON.stringify(describe(options))})`); return Promise.resolve(); },
      };
      const proxy = new Proxy(target, {
        get(object, key) {
          if (key in object) return object[key as string];
          if (typeof key === 'symbol') return undefined;
          return (...args: unknown[]) => { record(`${id}.${String(key)}(${JSON.stringify(describe(args))})`); return undefined; };
        },
      });
      windows.push(proxy);
      return proxy;
    }
  }

  const display = { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1040 }, scaleFactor: 1 };
  const captureService = new Proxy({
    getTargetDisplay: () => display,
    getVirtualDisplayBounds: () => ({ ...display.bounds }),
    getFullDisplayBounds: () => ({ ...display.bounds }),
  } as Record<string, unknown>, {
    get(object, key) {
      if (key in object) return object[key as string];
      return (...args: unknown[]) => { record(`capture.${String(key)}(${JSON.stringify(describe(args))})`); return Promise.resolve(); };
    },
  });
  const unavailable = (name: string) => () => { throw new Error(`unexpected native action: ${name}`); };
  const electron = {
    app: { quit: () => record('app.quit()') },
    BrowserWindow: FakeBrowserWindow,
    Menu: { buildFromTemplate: unavailable('menu') },
    Tray: unavailable('Tray'),
    nativeImage: { createFromPath: () => ({ isEmpty: () => true, resize: () => ({}) }) },
    screen: { getAllDisplays: () => [display], getPrimaryDisplay: () => display },
    shell: { openExternal: unavailable('external') },
  };
  const env: Record<string, string> = {};
  if (config.diagnostics) {
    env.DESKTOP_PET_POINTER_DIAGNOSTICS = '1';
    env.DESKTOP_PET_LOCAL_TEST = '1';
    env.DESKTOP_PET_LOCAL_TEST_DEBUG_MODEL_PATH = ' models/a.model3.json ';
    env.DESKTOP_PET_LOCAL_TEST_DRAG_DELTA_X = '12';
    env.DESKTOP_PET_LOCAL_TEST_DRAG_STEP_THRESHOLD_PX = ' 3 ';
    env.DESKTOP_PET_LIVE2D_DRAG_PROBE = '1';
  }
  if (!config.prewarm) env.DESKTOP_PET_PREWARM_INTERACTIVE_LAYER = '0';
  const fakeProcess = { platform: config.platform, env, argv: ['electron', '.'], versions: process.versions, resourcesPath: '', execPath: process.execPath };
  const sandboxModule = { exports: {} as any };
  vm.runInNewContext(source, {
    module: sandboxModule, exports: sandboxModule.exports, __dirname: path.dirname(managerPath),
    process: fakeProcess, console, URL, URLSearchParams, Date: FakeDate,
    setTimeout: fakeSetTimeout, clearTimeout: fakeClear, setInterval: fakeSetInterval, clearInterval: fakeClear,
    require(name: string) {
      if (name === 'electron') return electron;
      if (name === './windowsDwmBorderService.cjs') {
        return { disableDwmSystemBorderForWindow: (win: unknown) => { record(`dwm(${JSON.stringify(describe(win))})`); return Promise.resolve({ applied: false, reason: 'fake' }); } };
      }
      if (name === './ipcSenderGuard.cjs') return { openExternalSafely: unavailable('external') };
      return realRequire(name);
    },
  }, { filename: managerPath });

  const pending: Array<[string, () => unknown]> = [];
  const step = (label: string, action: () => unknown) => { pending.push([label, action]); };
  const advance = (ms: number) => { pending.push([`advance ${ms}`, () => advanceClock(ms)]); };
  const manager = sandboxModule.exports.createWindowManager({
    isDev: false, log: (message: string) => record(`log ${message}`), captureService,
    areaPickerService: { getAreaPickerWindow: () => null, getPersistentAreaBorderWindow: () => null },
    sessionPartition: 'persist:harness',
  });
  const mainWindow = () => manager.getMainWindow();
  const proxyWindow = () => [...windows].reverse().find((win) => win.__title === 'AI Desktop Pet Input Proxy') ?? null;
  const region = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

  step('create main window', () => manager.createMainWindow());
  step('main ready-to-show', () => mainWindow()?.emit('ready-to-show'));
  step('main did-finish-load', () => mainWindow()?.webContents.emit('did-finish-load'));
  step('renderer ready', () => manager.markMainWindowReadyToShow('harness'));
  step('proxy did-finish-load', () => proxyWindow()?.webContents.emit('did-finish-load'));
  step('main show event', () => mainWindow()?.emit('show'));
  advance(700);
  step('pointer passthrough on', () => manager.setPointerPassthrough(true));
  step('pet regions', () => manager.setInteractiveRegions([region(10, 20, 100, 120), region(150, 40, 60, 60)], { source: 'pet' }));
  step('same pet regions', () => manager.setInteractiveRegions([region(10, 20, 100, 120), region(150, 40, 60, 60)], { source: 'pet' }));
  step('render proxy regions', () => manager.setInteractiveRegions([region(5, 5, 40, 40)], { source: 'render-input-proxy' }));
  step('post-drag proxy regions', () => manager.setInteractiveRegions([region(6, 6, 30, 30)], { source: 'post-drag-input-proxy' }));
  step('pointer passthrough off', () => manager.setPointerPassthrough(false));
  step('empty regions during interaction', () => manager.setInteractiveRegions([], { source: 'pet' }));
  step('drag start', () => manager.setPetDragNativeShapeActive(true));
  step('drag restart same', () => manager.setPetDragNativeShapeActive(true));
  step('full-window drag regions', () => manager.setInteractiveRegions([region(0, 0, 400, 300)], { source: 'pet-drag' }));
  step('real full-window drag regions', () => manager.setInteractiveRegions([region(0, 0, 1920, 1080)], { source: 'pet-drag' }));
  step('full-window proxy regions', () => manager.setInteractiveRegions([region(0, 0, 1919, 1079)], { source: 'render-input-proxy' }));
  step('main move event', () => mainWindow()?.emit('move'));
  step('bounded regions during drag', () => manager.setInteractiveRegions([region(20, 30, 80, 90)], { source: 'pet-drag' }));
  step('proxy mouseDown', () => manager.forwardPostDragInputProxyEvent(proxyWindow()?.webContents, { type: 'mouseDown', x: 12.4, y: 900, button: 'right', clickCount: 7, movementX: 2 }));
  step('proxy mouseMove', () => manager.forwardPostDragInputProxyEvent(proxyWindow()?.webContents, { type: 'mouseMove', x: -5, y: 4 }));
  step('proxy unsupported', () => manager.forwardPostDragInputProxyEvent(proxyWindow()?.webContents, { type: 'keyDown', x: 1, y: 1 }));
  step('proxy wrong sender', () => manager.forwardPostDragInputProxyEvent(mainWindow()?.webContents, { type: 'mouseDown', x: 1, y: 1 }));
  step('proxy wheel', () => manager.forwardPostDragInputProxyEvent(proxyWindow()?.webContents, { type: 'mouseWheel', x: 3, y: 3, deltaX: 1, deltaY: 120 }));
  step('drag end', () => manager.setPetDragNativeShapeActive(false));
  step('proxy mouseUp', () => manager.forwardPostDragInputProxyEvent(proxyWindow()?.webContents, { type: 'mouseUp', x: 40, y: 40 }));
  step('proxy regions after pointer', () => manager.setInteractiveRegions([region(8, 8, 20, 20)], { source: 'render-input-proxy' }));
  step('regions after drag', () => manager.setInteractiveRegions([region(30, 30, 50, 50)], { source: 'pet' }));
  advance(40);
  step('regions inside hold', () => manager.setInteractiveRegions([region(31, 31, 50, 50)], { source: 'pet' }));
  advance(800);
  step('regions after hold', () => manager.setInteractiveRegions([region(32, 32, 50, 50)], { source: 'pet' }));
  step('second drag start', () => manager.setPetDragNativeShapeActive(true));
  step('second drag end without regions', () => manager.setPetDragNativeShapeActive(false));
  advance(800);
  step('third drag start', () => manager.setPetDragNativeShapeActive(true));
  step('third drag bounded regions', () => manager.setInteractiveRegions([region(40, 40, 30, 30)], { source: 'pet' }));
  step('third drag end', () => manager.setPetDragNativeShapeActive(false));
  advance(800);
  step('fourth drag start', () => manager.setPetDragNativeShapeActive(true));
  step('resize main during drag', () => mainWindow()?.setBounds({ x: 0, y: 0, width: 2400, height: 1300 }));
  step('fourth drag end bounded', () => manager.setPetDragNativeShapeActive(false));
  step('restore main size', () => manager.setSettingsOpen(false));
  advance(800);
  step('agent execution on', () => manager.setAgentDesktopExecutionActive(true));
  step('agent execution on again', () => manager.setAgentDesktopExecutionActive(true));
  step('regions during agent execution', () => manager.setInteractiveRegions([region(33, 33, 50, 50)], { source: 'pet' }));
  step('agent execution off', () => manager.setAgentDesktopExecutionActive(false));
  step('keep main on top', () => manager.keepWindowOnTop(mainWindow(), 1));
  step('keep main on top cached', () => manager.keepWindowOnTop(mainWindow(), 1));
  step('keep main on top new level', () => manager.keepWindowOnTop(mainWindow(), 2, { bringToFront: true, topmostLevel: 'pop-up-menu' }));
  step('keep null window', () => manager.keepWindowOnTop(null));
  step('open chat window', () => manager.openChatWindow());
  step('keep chat window', () => manager.keepWindowOnTop(manager.getChatWindow(), 3));
  step('empty regions', () => manager.setInteractiveRegions([], { source: 'pet' }));
  step('pointer passthrough on again', () => manager.setPointerPassthrough(true));
  advance(5_200);
  step('recreate proxy with failing load', () => {
    manager.setInteractiveRegions([region(9, 9, 22, 22)], { source: 'render-input-proxy' });
    manager.setInteractiveRegions([region(9, 9, 22, 22)], { source: 'post-drag-input-proxy' });
  });
  step('hide main window', () => manager.hideMainWindow());
  advance(5_200);
  step('dispose', () => manager.dispose());
  advance(10_000);
  for (const [label, action] of pending) {
    record(`== ${label}`);
    try { action(); } catch (error) { record(`error ${(error as Error).message}`); }
    await new Promise((resolve) => setImmediate(resolve));
  }
  return trace;
}

export function readManagerSource() {
  return fs.readFileSync(managerPath, 'utf8');
}

export const interactionScenarioConfigs: InteractionScenarioConfig[] = (['win32', 'linux'] as const)
  .flatMap((platform) => [false, true].flatMap((diagnostics) => [true, false].map((prewarm) => ({ platform, diagnostics, prewarm }))));
