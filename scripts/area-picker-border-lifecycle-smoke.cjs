const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const file = require.resolve('../electron/areaPickerBorderLifecycle.cjs');
const rootFile = require.resolve('../electron/areaPickerService.cjs');
const source = fs.readFileSync(file, 'utf8'), tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
assert.ok(source.split('\n').length <= 300);
function budgets(n) { if (ts.isFunctionLike(n) && n.body) assert.ok(tree.getLineAndCharacterOfPosition(n.end).line - tree.getLineAndCharacterOfPosition(n.getStart(tree)).line + 1 <= 50); ts.forEachChild(n, budgets); }
budgets(tree);
const names = ['destroyPersistentAreaBorder', 'hidePersistentAreaBorder', 'ensurePersistentAreaBorderWindow', 'updatePersistentAreaBorderThickness', 'showPersistentAreaBorder', 'refreshPersistentAreaBorder', 'syncPersistentAreaBorderFromSettingsAction'];
const variableNames = ['persistentAreaBorderWindow', 'persistentAreaCaptureOptions', 'createPersistentAreaBorderWindow'];
let oldBody;
if (process.argv[2]) {
  const old = fs.readFileSync(process.argv[2], 'utf8'), t = ts.createSourceFile(rootFile, old, ts.ScriptTarget.Latest, true);
  const factory = t.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'createAreaPickerService');
  function selected(n, t) { return ts.isFunctionDeclaration(n) && names.includes(n.name?.text) || ts.isVariableStatement(n) && (n.getText(t).includes('createPersistentAreaBorderRules(') || n.declarationList.declarations.some(d => variableNames.includes(d.name.getText(t)))); }
  oldBody = factory.body.statements.filter(n => selected(n, t)).map(n => n.getText(t)).join('\n');
  assert.ok(oldBody.includes('function showPersistentAreaBorder'));
  function retained(text) {
    const t = ts.createSourceFile(rootFile, text, ts.ScriptTarget.Latest, true);
    const statements = t.statements.filter(n => !/require\('\.\/areaPickerBorder(?:Window|Rules|Lifecycle).cjs'\)/.test(n.getText(t))).map(n => {
      if (!ts.isFunctionDeclaration(n) || n.name?.text !== 'createAreaPickerService') return n;
      const body = ts.factory.updateBlock(n.body, n.body.statements.filter(n => !selected(n, t) && !(ts.isVariableStatement(n) && n.getText(t).includes('createPersistentAreaBorderLifecycle('))));
      return ts.factory.updateFunctionDeclaration(n, n.modifiers, n.asteriskToken, n.name, n.typeParameters, n.parameters, n.type, body);
    });
    return ts.createPrinter().printFile(ts.factory.updateSourceFile(t, statements)).replace('getPersistentAreaBorderWindow: () => persistentAreaBorderWindow', 'getPersistentAreaBorderWindow');
  }
  assert.equal(retained(fs.readFileSync(rootFile, 'utf8')), retained(old), 'Other selection, window stack, shortcuts and API unchanged except border getter wiring');
}
async function run(sequence, stage, initialLoading, original) {
  const trace = [], windows = [], failure = Error('controlled lifecycle failure'); let loading = initialLoading, basis = -1920;
  class Window {
    constructor(options) {
      trace.push(['create', options]); if (stage === 'create') throw failure;
      this.id = windows.length; windows.push(this); this.visible = false; this.dead = false; this.webContents = new EventEmitter();
      this.webContents.isLoadingMainFrame = () => loading;
      this.webContents.executeJavaScript = (...args) => { trace.push(['script', this.id, ...args]); if (stage === 'script-sync') throw failure; return stage === 'script-reject' ? Promise.reject(failure) : Promise.resolve(); };
    }
    isDestroyed() { trace.push(['dead?', this.id]); return this.dead; }
    isVisible() { trace.push(['visible?', this.id]); return this.visible; }
    setIgnoreMouseEvents(...args) { trace.push(['ignore', this.id, ...args]); }
    loadURL(url) { trace.push(['load', this.id, url]); return Promise.resolve(); }
    setBounds(...args) { trace.push(['bounds', this.id, ...args]); if (stage === 'bounds') throw failure; }
    showInactive() { trace.push(['show', this.id]); if (stage === 'show') throw failure; this.visible = true; }
    hide() { trace.push(['hide', this.id]); if (stage === 'hide') throw failure; this.visible = false; }
    destroy() { trace.push(['destroy', this.id]); if (stage === 'destroy') throw failure; this.dead = true; }
  }
  const deps = { BrowserWindow: Window,
    captureService: { getVirtualDisplayBounds() { trace.push(['virtual']); return { x: basis, y: -80 }; } },
    screen: { getDisplayMatching(rect) { trace.push(['matching', rect]); return { scaleFactor: 1.5 }; } },
    windowManager: { keepWindowOnTop(win, ...args) { trace.push(['top', win.id, ...args]); }, scheduleKeepWindowOnTop(win, ...args) { trace.push(['schedule', win.id, ...args]); if (stage === 'schedule') throw failure; } },
    topmostRelativeLevel: 4, topmostLevel: 'pop-up-menu',
  };
  let create;
  if (original) create = () => new Function('captureService', 'screen', 'BrowserWindow', 'windowManager', 'createPersistentAreaBorderRules', 'createAreaBorderWindow', 'PERSISTENT_AREA_BORDER_TOPMOST_RELATIVE_LEVEL', 'AREA_PICKER_TOPMOST_WINDOW_LEVEL', oldBody + '\nreturn {destroyPersistentAreaBorder,refreshPersistentAreaBorder,syncPersistentAreaBorderFromSettingsAction,getPersistentAreaBorderWindow:()=>persistentAreaBorderWindow};')(deps.captureService, deps.screen, Window, deps.windowManager, require('../electron/areaPickerBorderRules.cjs').createPersistentAreaBorderRules, require('../electron/areaPickerBorderWindow.cjs').createPersistentAreaBorderWindow, 4, 'pop-up-menu');
  else create = () => require(file).createPersistentAreaBorderLifecycle(deps);
  const api = create(), second = create(), options = { mode: 'area', cropRect: { x: 10.5, y: 8, width: 120, height: 80 } };
  for (const step of sequence) {
    try {
      if (step === 'show') api.syncPersistentAreaBorderFromSettingsAction({ type: 'preview-capture-options', options });
      else if (step === 'refresh') { basis += 100; options.cropRect.x += 10; api.refreshPersistentAreaBorder(); }
      else if (step === 'hide') api.syncPersistentAreaBorderFromSettingsAction({ type: 'stop-screen-capture' });
      else if (step === 'invalid') api.syncPersistentAreaBorderFromSettingsAction({ type: 'start-screen-capture', options: { mode: 'area', cropRect: { width: 7, height: 8 } } });
      else if (step === 'destroy') api.destroyPersistentAreaBorder();
      else if (step === 'dead' && windows.length) windows.at(-1).dead = true;
      else if (step === 'loaded' && windows.length) { loading = false; windows.at(-1).webContents.emit('did-finish-load'); }
      else if (step === 'ignored') for (const action of [null, false, 'start-screen-capture', {}, { type: 'unknown' }]) api.syncPersistentAreaBorderFromSettingsAction(action);
    } catch (error) { assert.equal(error, failure); trace.push(['error', error.message]); }
    trace.push(['window', api.getPersistentAreaBorderWindow()?.id ?? null]);
    assert.equal(second.getPersistentAreaBorderWindow(), null, 'Border state is isolated by instance');
  }
  await Promise.resolve(); return trace;
}
async function main() {
  const hash = crypto.createHash('sha256'); let cases = 0;
  const sequences = [[], ['ignored', 'refresh', 'hide', 'destroy'], ['show', 'refresh', 'show'], ['show', 'loaded', 'loaded'], ['show', 'hide', 'loaded', 'refresh', 'show'], ['show', 'invalid', 'refresh'], ['show', 'dead', 'show'], ['show', 'destroy', 'refresh', 'show', 'destroy']];
  for (const sequence of sequences) for (const stage of ['normal', 'create', 'bounds', 'script-sync', 'script-reject', 'show', 'schedule', 'hide', 'destroy']) for (const loading of [false, true]) {
    const actual = await run(sequence, stage, loading, false);
    if (oldBody) assert.deepEqual(actual, await run(sequence, stage, loading, true));
    hash.update(JSON.stringify(actual) + '\n'); cases++;
  }
  const fingerprint = hash.digest('hex');
  assert.equal(fingerprint, 'd1574c3583e35749f9ed83111a685e09faf8b3385c30d6f0cb862271837d0a21', 'Reviewed border state transitions and call/error order');
  console.log('Area border lifecycle passed: ' + cases + ' sequence/loading/reuse/destroy/refresh/error/instance cases; real rules and window helper, controlled Electron.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
