const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const rootFile = path.resolve(__dirname, '../electron/captureService.cjs');
const environmentFile = path.resolve(__dirname, '../electron/capture/displayEnvironment.cjs');
const schedulerFile = path.resolve(__dirname, '../electron/capture/broadcastScheduler.cjs');
const { createCaptureDisplayEnvironment } = require(environmentFile);
const { createCaptureBroadcastScheduler } = require(schedulerFile);
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const names = ['getDisplayEnvironment', 'broadcastDisplayEnvironment', 'scheduleDisplayEnvironmentBroadcast', 'scheduleCaptureSourceRefreshBroadcast', 'dispose'];
let oldFactory;
if (baseline) {
  const ast = ts.createSourceFile(rootFile, baseline, ts.ScriptTarget.Latest, true);
  const root = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCaptureService');
  const declarations = names.map(name => root.body.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === name).getText(ast)).join('\n');
  oldFactory = new Function('dependencies', `const { normalizeCaptureSourceTypes, getDisplayListWithNativeBounds, getCaptureSourceListWithOptions,
    isCaptureSourceCacheFresh, getLiveRendererWindows, getRendererWindows, console, clearTimeout, setTimeout,
    DISPLAY_ENVIRONMENT_BROADCAST_DELAY_MS, CAPTURE_SOURCE_REFRESH_DELAY_MS, invalidateCaptureSourceCache } = dependencies;
    const settingsWindowProvider = dependencies.getSettingsWindow;
    let displayEnvironmentBroadcastTimer = null, captureSourceRefreshTimer = null;
    ${declarations}\nreturn { ${names.join(',')} };`);
}

function createApi(dependencies, original) {
  if (original) return oldFactory(dependencies);
  const environment = createCaptureDisplayEnvironment(dependencies);
  const scheduler = createCaptureBroadcastScheduler({ ...dependencies, broadcastDisplayEnvironment: environment.broadcastDisplayEnvironment });
  return { ...environment, ...scheduler, dispose() { scheduler.disposeBroadcastTimers(); dependencies.invalidateCaptureSourceCache(); } };
}

function fixture(original) {
  const trace = [], timers = new Map(); let sequence = 0, windowState = 'visible', fresh = false, failure = '';
  const displays = [{ id: '1' }], sources = [{ id: 'screen:1' }];
  function makeWindow(id) {
    const webContents = { send(channel, value) { assert.strictEqual(this, webContents); trace.push(['send', id, channel, value]); if (failure === 'send') throw Error('send'); } };
    return { id, webContents, isDestroyed() { trace.push(['destroyed', id]); if (windowState === 'throw') throw Error('window'); return windowState === 'dead'; },
      isVisible() { trace.push(['visible', id]); return windowState !== 'hidden'; } };
  }
  const settings = makeWindow('settings'), other = makeWindow('other');
  const dependencies = {
    DISPLAY_ENVIRONMENT_BROADCAST_DELAY_MS: 120, CAPTURE_SOURCE_REFRESH_DELAY_MS: 420,
    normalizeCaptureSourceTypes(types) { trace.push(['normalize', types]); return types || ['screen', 'window']; },
    async getDisplayListWithNativeBounds() { trace.push(['displays']); if (failure === 'display') throw Error('display'); return displays; },
    async getCaptureSourceListWithOptions(options) { trace.push(['sources', options]); if (failure === 'source') throw Error('source'); return sources; },
    isCaptureSourceCacheFresh(types) { trace.push(['fresh', types, fresh]); if (failure === 'fresh') throw Error('fresh'); return fresh; },
    getLiveRendererWindows(windows) { trace.push(['live']); return windows.filter(window => window && !window.isDestroyed()); },
    getRendererWindows() { trace.push(['windows']); return [settings, other]; },
    getSettingsWindow() { trace.push(['settings', windowState]); return windowState === 'null' ? null : settings; },
    console: { error(...args) { trace.push(['error', ...args.map(value => value instanceof Error ? value.message : value)]); } },
    setTimeout(callback, delay) { trace.push(['set', ++sequence, delay]); if (failure === 'set') throw Error('set'); timers.set(sequence, callback); return sequence; },
    clearTimeout(id) { trace.push(['clear', id]); if (failure === 'clear') throw Error('clear'); timers.delete(id); },
    invalidateCaptureSourceCache() { trace.push(['invalidate']); },
  };
  const api = createApi(dependencies, original); assert.deepEqual(trace, [], 'Assembly does not query or schedule');
  return { api, trace, timers, settings, other, displays, sources, configure(state, nextFresh, nextFailure = '') { windowState = state; fresh = nextFresh; failure = nextFailure; } };
}

async function flush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }

async function runEnvironment(include, prefer, force, thumbnails, fresh, types, failure, original) {
  const f = fixture(original); f.configure('visible', fresh, failure);
  let value, error;
  try { value = await f.api.getDisplayEnvironment({ includeCaptureSources: include, preferCachedCaptureSources: prefer,
    forceRefreshCaptureSources: force, includeCaptureThumbnails: thumbnails, captureSourceTypes: types }); }
  catch (caught) { error = caught.message; }
  if (value) {
    assert.strictEqual(value.displays, f.displays);
    if (include) assert.strictEqual(value.captureSources, f.sources); else assert.deepEqual(value.captureSources, []);
    assert.equal(value.captureSourcesPending, include && prefer && !fresh);
  }
  return { value, error, trace: f.trace };
}

async function runBroadcast(selection, failure, original) {
  const f = fixture(original); f.configure('visible', false, failure);
  const windows = selection === 'empty' ? [] : selection === 'explicit' ? [null, f.settings] : selection === 'invalid' ? {} : undefined;
  await f.api.broadcastDisplayEnvironment({ windows, includeCaptureSources: true });
  if (selection === 'empty') assert.ok(!f.trace.some(x => x[0] === 'displays'));
  if (failure && selection !== 'empty') assert.ok(f.trace.some(x => x[0] === 'error'));
  return f.trace;
}

async function runScheduler(initial, final, force, beforeFresh, afterFresh, delay, original) {
  const f = fixture(original); f.configure(initial, beforeFresh); const errors = [];
  for (let i = 0; i < 2; i++) {
    try { f.api.scheduleCaptureSourceRefreshBroadcast(delay, { force }); }
    catch (error) { errors.push(error.message); }
  }
  f.configure(final, afterFresh);
  for (const [id, callback] of [...f.timers]) {
    f.timers.delete(id); try { callback(); } catch (error) { errors.push(error.message); }
  }
  await flush(); f.api.dispose(); f.api.dispose(); return { trace: f.trace, errors, remaining: [...f.timers.keys()] };
}

async function runGeneral(failure, original) {
  const f = fixture(original); const errors = [];
  f.api.scheduleDisplayEnvironmentBroadcast({ includeCaptureSources: false });
  f.configure('visible', false, failure);
  try { f.api.scheduleDisplayEnvironmentBroadcast({ delayMs: 0, windows: [f.other], includeCaptureSources: true }); }
  catch (error) { errors.push(error.message); }
  f.configure('visible', false);
  for (const [id, callback] of [...f.timers]) { f.timers.delete(id); callback(); }
  await flush(); f.api.dispose(); return { trace: f.trace, errors };
}

async function runRoot(original) {
  const trace = [], timers = new Map(); let id = 0, visible = true;
  const display = { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1040 }, scaleFactor: 1 };
  const win = { isDestroyed: () => false, isVisible: () => visible, webContents: { send(channel, value) { trace.push(['send', channel, value]); } } };
  const electron = { app: {}, BrowserWindow: { getAllWindows: () => [win] }, screen: { getAllDisplays: () => [display], getPrimaryDisplay: () => display },
    desktopCapturer: { async getSources(options) { trace.push(['capture', options]); return [{ id: 'screen:1', display_id: '1', name: 'Primary',
      thumbnail: { isEmpty: () => false, getSize: () => ({ width: 240, height: 135 }), toDataURL: () => 'image' } }]; } } };
  const loaded = new Map();
  function load(file) {
    if (loaded.has(file)) return loaded.get(file).exports;
    const module = { exports: {} }; loaded.set(file, module);
    new Function('require', 'module', 'exports', 'process', 'Date', 'setTimeout', 'clearTimeout', file === rootFile && original ? baseline : fs.readFileSync(file, 'utf8'))(name => {
      if (name === 'electron') return electron;
      if (name === 'child_process') return { execFile() { throw Error('Unexpected native call'); } };
      if (name === 'fs') return {}; if (name === 'path') return path;
      assert.ok(name.startsWith('./')); return load(path.resolve(path.dirname(file), name));
    }, module, module.exports, { platform: 'linux' }, { now: () => 100 }, (callback, delay) => { trace.push(['set', ++id, delay]); timers.set(id, callback); return id; },
      timer => { trace.push(['clear', timer]); timers.delete(timer); }); return module.exports;
  }
  const { createCaptureService } = load(rootFile); const first = createCaptureService({ getSettingsWindow: () => win }), second = createCaptureService();
  const keys = Object.keys(first);
  first.scheduleDisplayEnvironmentBroadcast({ includeCaptureSources: false }); first.scheduleDisplayEnvironmentBroadcast({ includeCaptureSources: true });
  first.scheduleCaptureSourceRefreshBroadcast(); second.scheduleDisplayEnvironmentBroadcast({ includeCaptureSources: false });
  for (const [timer, callback] of [...timers]) { timers.delete(timer); callback(); } await flush();
  await first.broadcastDisplayEnvironment({ windows: [win], includeCaptureSources: false });
  visible = false; first.scheduleCaptureSourceRefreshBroadcast(0, { force: true });
  first.setSettingsWindowProvider(() => null); first.scheduleCaptureSourceRefreshBroadcast(0, { force: true });
  first.scheduleDisplayEnvironmentBroadcast(); first.dispose(); second.dispose(); assert.equal(timers.size, 0);
  return { trace, keys };
}

function structure() {
  for (const file of [environmentFile, schedulerFile]) {
    const text = fs.readFileSync(file, 'utf8'), ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true); assert.ok(text.split('\n').length <= 300);
    function visit(n) { if (ts.isFunctionLike(n) && n.body) assert.ok(ast.getLineAndCharacterOfPosition(n.end).line - ast.getLineAndCharacterOfPosition(n.getStart(ast)).line + 1 <= 50); ts.forEachChild(n, visit); } visit(ast);
  }
  if (!baseline) return;
  function retained(source, original) {
    const ast = ts.createSourceFile(rootFile, source, ts.ScriptTarget.Latest, true);
    const root = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCaptureService');
    return root.body.statements.filter(n => original
      ? !(ts.isFunctionDeclaration(n) && names.includes(n.name.text))
        && !/^let (displayEnvironmentBroadcastTimer|captureSourceRefreshTimer) =/.test(n.getText(ast))
      : !(ts.isFunctionDeclaration(n) && n.name.text === 'dispose')
        && !n.getText(ast).startsWith('const { getDisplayEnvironment, broadcastDisplayEnvironment } =')
        && !n.getText(ast).startsWith('const { scheduleDisplayEnvironmentBroadcast, scheduleCaptureSourceRefreshBroadcast, disposeBroadcastTimers } ='))
      .map(n => n.getText(ast));
  }
  assert.deepEqual(retained(fs.readFileSync(rootFile, 'utf8'), false), retained(baseline, true));
}

async function main() {
  structure(); let cases = 0;
  for (const include of [false, true]) for (const prefer of [false, true]) for (const force of [false, true]) for (const thumbnails of [false, true])
    for (const fresh of [false, true]) for (const types of [undefined, ['screen'], ['window']]) for (const failure of ['', 'display', 'source', 'fresh']) {
      const args = [include, prefer, force, thumbnails, fresh, types, failure]; const actual = await runEnvironment(...args, false);
      if (baseline) assert.deepEqual(actual, await runEnvironment(...args, true)); cases++;
    }
  for (const selection of ['default', 'empty', 'explicit', 'invalid']) for (const failure of ['', 'display', 'source', 'send']) {
    const actual = await runBroadcast(selection, failure, false); if (baseline) assert.deepEqual(actual, await runBroadcast(selection, failure, true)); cases++;
  }
  for (const initial of ['null', 'dead', 'hidden', 'visible', 'throw']) for (const final of ['null', 'dead', 'hidden', 'visible', 'throw'])
    for (const force of [false, true]) for (const before of [false, true]) for (const after of [false, true]) for (const delay of [undefined, 0]) {
      const args = [initial, final, force, before, after, delay]; const actual = await runScheduler(...args, false);
      if (baseline) assert.deepEqual(actual, await runScheduler(...args, true)); cases++;
    }
  for (const failure of ['', 'set', 'clear']) { const actual = await runGeneral(failure, false); if (baseline) assert.deepEqual(actual, await runGeneral(failure, true)); cases++; }
  const actual = await runRoot(false); if (baseline) assert.deepEqual(actual, await runRoot(true)); cases++;
  console.log(`Capture environment/scheduler passed: ${cases} environment/send/timer/live-window/disposal and controlled-root scenarios.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
