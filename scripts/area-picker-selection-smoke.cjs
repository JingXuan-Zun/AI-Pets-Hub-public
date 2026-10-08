const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const rootFile = require.resolve('../electron/areaPickerService.cjs');
const source = fs.readFileSync(rootFile, 'utf8');
const retired = ['getNativeAreaPickerPowerShellScript', 'getNativeAreaPickerPollingPowerShellScript'];
const t = ts.createSourceFile(rootFile, source, ts.ScriptTarget.Latest, true);
function absent(n) {
  if (ts.isIdentifier(n)) assert.ok(!retired.includes(n.text), 'Retired private template must stay absent');
  ts.forEachChild(n, absent);
}
absent(t);
assert.ok(!source.includes('createAreaSelectionFromRect'));
const ipc = fs.readFileSync(require.resolve('../electron/ipcHandlers.cjs'), 'utf8');
assert.ok(ipc.includes('areaPickerService.openNativeAreaPickerWindow()'), 'Production IPC area-picker path remains');
let oldSource;
if (require.main === module && process.argv[2]) {
  oldSource = fs.readFileSync(process.argv[2], 'utf8');
  const tree = ts.createSourceFile(rootFile, oldSource, ts.ScriptTarget.Latest, true), counts = new Map(retired.map(name => [name, 0]));
  function count(n) { if (ts.isIdentifier(n) && counts.has(n.text)) counts.set(n.text, counts.get(n.text) + 1); ts.forEachChild(n, count); }
  count(tree); assert.deepEqual([...counts.values()], [1, 1], 'Old private templates have declarations only');
  function retained(text) {
    const t = ts.createSourceFile(rootFile, text, ts.ScriptTarget.Latest, true);
    const statements = t.statements.map(n => {
      if (!ts.isFunctionDeclaration(n) || n.name?.text !== 'createAreaPickerService') return n;
      const body = ts.factory.updateBlock(n.body, n.body.statements.filter(n => !(ts.isFunctionDeclaration(n) && retired.includes(n.name?.text))));
      return ts.factory.updateFunctionDeclaration(n, n.modifiers, n.asteriskToken, n.name, n.typeParameters, n.parameters, n.type, body);
    });
    return ts.createPrinter().printFile(ts.factory.updateSourceFile(t, statements)).replace('createAreaSelectionFromRect, ', '');
  }
  assert.equal(retained(source), retained(oldSource), 'All production selection/window/border/API statements unchanged');
}
async function run(action, initiallyLoading, shortcutMode, empty, original) {
  const trace = [], windows = [], scheduled = [], context = { virtualBounds: { x: -1920, y: -80, width: 3840, height: 1200 }, displays: empty ? [] : [{ id: 'left', x: -1920, y: -80, width: 1920, height: 1080 }] };
  let loading = initiallyLoading, shortcut, builds = 0;
  class Window extends EventEmitter {
    constructor(options) {
      super(); this.bounds = { x: options.x, y: options.y, width: options.width, height: options.height }; this.destroyed = false;
      windows.push(this); trace.push(['create', options]); this.webContents = new EventEmitter();
      this.webContents.isLoadingMainFrame = () => loading;
      this.webContents.send = (...args) => trace.push(['send', ...args]);
    }
    isDestroyed() { return this.destroyed; }
    getBounds() { return { ...this.bounds }; }
    setBounds(value) { this.bounds = value; trace.push(['bounds', value]); }
    show() { trace.push(['show']); this.emit('show'); }
    hide() { trace.push(['hide']); }
    focus() { trace.push(['focus']); }
  }
  const globalShortcut = {
    register(key, callback) { trace.push(['register', key]); if (shortcutMode === 'throw') throw Error('controlled register failure'); if (shortcutMode === 'false') return false; shortcut = callback; return true; },
    unregister(key) { trace.push(['unregister', key]); shortcut = null; },
  };
  const module = { exports: {} };
  new Function('require', 'module', '__dirname', 'setTimeout', typeof original === 'string' ? original : original ? oldSource : source)(id => {
    if (id === 'electron') return { BrowserWindow: Window, globalShortcut, screen: {} };
    if (id === 'path') return path;
    if (id === './areaPickerGeometry.cjs') return require('../electron/areaPickerGeometry.cjs');
    if (id === './areaPickerBorderRules.cjs') return require('../electron/areaPickerBorderRules.cjs');
    if (id === './areaPickerBorderWindow.cjs') return require('../electron/areaPickerBorderWindow.cjs');
    if (id === './areaPickerBorderLifecycle.cjs') return require('../electron/areaPickerBorderLifecycle.cjs');
    if (id === './areaPickerWindow.cjs') return require('../electron/areaPickerWindow.cjs');
    if (id === './areaPickerWindowStack.cjs') return require('../electron/areaPickerWindowStack.cjs');
    if (id === './areaPickerEscapeShortcut.cjs') return require('../electron/areaPickerEscapeShortcut.cjs');
    if (id === './areaPickerContextSync.cjs') return require('../electron/areaPickerContextSync.cjs');
    if (id === './areaPickerSelectionSession.cjs') return require('../electron/areaPickerSelectionSession.cjs');
    if (id === './areaPickerInteractionAssembly.cjs') return require('../electron/areaPickerInteractionAssembly.cjs');
    throw Error('Unexpected dependency ' + id);
  }, module, path.dirname(rootFile), (callback, ms) => { assert.equal(ms, 0); scheduled.push(callback); return scheduled.length; });
  const service = module.exports.createAreaPickerService({
    captureService: { async buildAreaPickerContext() { builds++; trace.push(['context']); return context; } }, isQuitting: () => false,
    loadRenderer(win, params) { assert.equal(win, windows[0]); trace.push(['renderer', params]); },
    windowManager: { getSettingsWindow: () => null, getChatWindow: () => null, getMainWindow: () => null,
      keepWindowOnTop(win, ...args) { assert.equal(win, windows[0]); trace.push(['top', ...args]); },
      scheduleKeepWindowOnTop(win, ...args) { assert.equal(win, windows[0]); trace.push(['schedule-top', ...args]); },
      scheduleWindowStackOnTop() { trace.push(['restore-stack']); },
    },
  });
  assert.deepEqual(Object.keys(service), ['cancelAreaPickerSelection', 'dispose', 'getAreaPickerContext', 'getAreaPickerWindow', 'getPersistentAreaBorderWindow', 'openNativeAreaPickerWindow', 'refreshPersistentAreaBorder', 'submitAreaPickerSelection', 'syncPersistentAreaBorderFromSettingsAction']);
  const first = service.openNativeAreaPickerWindow();
  await Promise.resolve();
  if (empty) { assert.equal(await first, null); assert.equal(windows.length, 0); assert.equal(shortcut, undefined); return trace; }
  assert.equal(service.getAreaPickerContext(), context); assert.equal(windows.length, 1);
  const win = windows[0], second = service.openNativeAreaPickerWindow();
  assert.equal(windows.length, 1); assert.equal(builds, 1);
  loading = false; win.webContents.emit('did-finish-load'); win.emit('ready-to-show');
  const selection = { cropRect: { x: 4, y: 8, width: 120, height: 90 }, sourceId: 'controlled' };
  if (action === 'submit') service.submitAreaPickerSelection(selection);
  else if (action === 'cancel') service.cancelAreaPickerSelection();
  else if (action === 'escape') { if (shortcut) shortcut(); else service.cancelAreaPickerSelection(); }
  else if (action === 'close') { let prevented = false; win.emit('close', { preventDefault() { prevented = true; } }); assert.equal(prevented, true); }
  else if (action === 'closed') { win.destroyed = true; win.emit('closed'); }
  else service.dispose();
  assert.equal(await first, action === 'submit' ? selection : null);
  assert.equal(await second, action === 'submit' ? selection : null);
  for (const callback of scheduled.splice(0)) callback();
  assert.ok(trace.some(row => row[0] === 'restore-stack'));
  assert.equal(service.getAreaPickerWindow(), action === 'closed' ? null : win);
  service.dispose(); for (const callback of scheduled.splice(0)) callback();
  return trace;
}
async function main() {
  const hash = crypto.createHash('sha256'); let cases = 0;
  for (const action of ['submit', 'cancel', 'escape', 'close', 'closed', 'dispose']) for (const loading of [false, true]) for (const shortcut of ['normal', 'false', 'throw']) for (const empty of [false, true]) {
    const actual = await run(action, loading, shortcut, empty, false);
    if (oldSource) assert.deepEqual(actual, await run(action, loading, shortcut, empty, true));
    hash.update(JSON.stringify(actual) + '\n'); cases++;
  }
  const fingerprint = hash.digest('hex');
  assert.equal(fingerprint, '694d1e82bd625843be68682cf1822c58f9f5a8c12669750efc1b614fe7c7e566', 'Reviewed production selection/window/shortcut behavior');
  console.log('Area picker selection passed: ' + cases + ' loading/shortcut/empty/submit/cancel/close/dispose/reuse cases; actual root, controlled Electron.');
}
module.exports = { runSelection: run };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
