const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const rootFile = path.resolve(__dirname, '../electron/captureService.cjs');
const assemblyFile = path.resolve(__dirname, '../electron/capture/environmentAssembly.cjs');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const returned = ['getDisplayEnvironment', 'broadcastDisplayEnvironment', 'scheduleDisplayEnvironmentBroadcast', 'scheduleCaptureSourceRefreshBroadcast', 'setSettingsWindowProvider', 'dispose'];
const names = ['getRendererWindows', 'getLiveRendererWindows', 'setSettingsWindowProvider', 'dispose'];
const factories = ['createCaptureDisplayEnvironment', 'createCaptureBroadcastScheduler'];
let oldFactory;
function moved(n, ast) {
  return ts.isFunctionDeclaration(n) && names.includes(n.name.text)
    || ts.isVariableStatement(n) && (n.getText(ast).startsWith('let settingsWindowProvider =') || factories.some(name => n.getText(ast).includes('= ' + name + '(')));
}
if (baseline) {
  const ast = ts.createSourceFile(rootFile, baseline, ts.ScriptTarget.Latest, true);
  const root = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCaptureService');
  const nodes = root.body.statements.filter(n => moved(n, ast));
  assert.equal(nodes.length, 7);
  oldFactory = deps => new Function('dependencies', 'const { ' + Object.keys(deps).join(',') + ' } = dependencies;\n' + nodes.map(n => n.getText(ast)).join('\n') + '\nreturn { ' + returned.join(',') + ' };')(deps);
}
function run(failure, original) {
  const trace = [], labels = new WeakMap(), created = [], schedulers = [];
  function label(key, value) { labels.set(value, key); return value; }
  const window = label('window', {}), replacement = label('replacement', {});
  const deps = { DISPLAY_ENVIRONMENT_BROADCAST_DELAY_MS: 120, CAPTURE_SOURCE_REFRESH_DELAY_MS: 420 };
  for (const key of ['console', 'BrowserWindow']) deps[key] = label(key, {});
  deps.BrowserWindow.getAllWindows = function () { assert.strictEqual(this, deps.BrowserWindow); trace.push(['windows']); return [window]; };
  for (const key of ['normalizeCaptureSourceTypes', 'getDisplayListWithNativeBounds', 'getCaptureSourceListWithOptions', 'isCaptureSourceCacheFresh', 'clearTimeout', 'setTimeout']) deps[key] = label(key, () => { throw Error('Unexpected eager call'); });
  deps.getSettingsWindow = label('initialProvider', () => { trace.push(['initialProvider']); return window; });
  deps.invalidateCaptureSourceCache = label('invalidateCaptureSourceCache', () => { trace.push(['invalidate']); if (failure === 'invalidate') throw Error(failure); });
  function normalize(value) {
    if (value && labels.has(value)) return labels.get(value);
    if (typeof value === 'function') return '[function:' + value.name + ']';
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalize(v)]));
    return value;
  }
  const imports = {};
  for (const [name, fields, mod] of [
    ['createCaptureDisplayEnvironment', returned.slice(0, 2), 'displayEnvironment'],
    ['createCaptureBroadcastScheduler', ['scheduleDisplayEnvironmentBroadcast', 'scheduleCaptureSourceRefreshBroadcast', 'disposeBroadcastTimers'], 'broadcastScheduler'],
  ]) {
    const factory = options => {
      trace.push([name, normalize(options)]);
      if (failure === name) throw Error(failure);
      if (mod === 'broadcastScheduler') schedulers.push(options);
      else {
        assert.strictEqual(options.getRendererWindows()[0], window);
        const live = { isDestroyed: () => false }, dead = { isDestroyed: () => true };
        assert.deepEqual(options.getLiveRendererWindows([null, live, dead]), [live]);
        assert.deepEqual(options.getLiveRendererWindows(null), []);
      }
      const output = Object.fromEntries(fields.map(key => [key, label(key, () => { trace.push([key]); if (failure === 'clear' && key === 'disposeBroadcastTimers') throw Error(failure); })]));
      created.push(output); return output;
    };
    imports['./' + mod + '.cjs'] = { [name]: factory }; deps[name] = factory;
  }
  const module = { exports: {} };
  new Function('require', 'module', fs.readFileSync(assemblyFile, 'utf8'))(id => { assert.ok(imports[id]); return imports[id]; }, module);
  const create = original ? oldFactory : module.exports.createCaptureEnvironmentAssembly;
  const outputs = [], live = [];
  for (let i = 0; i < 2; i++) {
    try {
      const value = create(deps); live.push(value); assert.deepEqual(Object.keys(value), returned);
      const env = created.at(-2), scheduler = created.at(-1);
      for (const key of returned.slice(0, 2)) assert.strictEqual(value[key], env[key]);
      for (const key of returned.slice(2, 4)) assert.strictEqual(value[key], scheduler[key]);
      outputs.push(normalize(value));
    } catch (error) { assert.equal(error.message, failure); outputs.push({ error: error.message }); }
  }
  if (live.length === 2) {
    for (const key of returned) assert.notStrictEqual(live[0][key], live[1][key]);
    assert.strictEqual(schedulers[0].getSettingsWindow(), window);
    live[0].setSettingsWindowProvider(() => replacement);
    assert.strictEqual(schedulers[0].getSettingsWindow(), replacement);
    assert.strictEqual(schedulers[1].getSettingsWindow(), window);
    for (const value of [null, {}, 0, 'provider']) {
      live[0].setSettingsWindowProvider(value); assert.equal(schedulers[0].getSettingsWindow(), null);
    }
    live[0].setSettingsWindowProvider(() => { throw Error('provider'); });
    assert.throws(() => schedulers[0].getSettingsWindow(), /provider/);
    for (const api of live) for (let i = 0; i < 2; i++) {
      const before = trace.length;
      try { api.dispose(); assert.equal(failure, ''); } catch (error) { assert.equal(error.message, failure); }
      assert.deepEqual(trace.slice(before), failure === 'clear' ? [['disposeBroadcastTimers']] : [['disposeBroadcastTimers'], ['invalidate']]);
    }
  }
  const expected = failure === factories[0] ? factories.slice(0, 1) : factories;
  assert.deepEqual(trace.filter(entry => factories.includes(entry[0])).map(entry => entry[0]), [...expected, ...expected]);
  return { trace, outputs };
}
async function flush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
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
  if (!baseline) return;
  function retained(source, original) {
    const ast = ts.createSourceFile(rootFile, source, ts.ScriptTarget.Latest, true);
    const root = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCaptureService');
    return root.body.statements.filter(n => original ? !moved(n, ast) : !(ts.isVariableStatement(n) && n.getText(ast).includes('= createCaptureEnvironmentAssembly('))).map(n => n.getText(ast));
  }
  assert.deepEqual(retained(fs.readFileSync(rootFile, 'utf8'), false), retained(baseline, true));
}
async function main() {
  structure(); let cases = 0;
  for (const failure of ['', ...factories, 'clear', 'invalidate']) {
    const actual = run(failure, false); if (baseline) assert.deepEqual(actual, run(failure, true)); cases++;
  }
  const actual = await runRoot(false); if (baseline) assert.deepEqual(actual, await runRoot(true));
  console.log('Capture environment assembly passed: ' + cases + ' two-instance wiring/provider/disposal scenarios and controlled real-root baseline.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
