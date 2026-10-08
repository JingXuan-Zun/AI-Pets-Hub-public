const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const file = require.resolve('../electron/areaPickerWindow.cjs'), rootFile = require.resolve('../electron/areaPickerService.cjs');
const source = fs.readFileSync(file, 'utf8'), tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
assert.ok(source.split('\n').length <= 300);
function budgets(n) { if (ts.isFunctionLike(n) && n.body) assert.ok(tree.getLineAndCharacterOfPosition(n.end).line - tree.getLineAndCharacterOfPosition(n.getStart(tree)).line + 1 <= 50); ts.forEachChild(n, budgets); }
budgets(tree);
let oldFunction;
if (process.argv[2]) {
  const old = fs.readFileSync(process.argv[2], 'utf8'), t = ts.createSourceFile(rootFile, old, ts.ScriptTarget.Latest, true);
  const factory = t.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'createAreaPickerService');
  oldFunction = factory.body.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'ensureAreaPickerWindow').getText(t)
    .replace(/\bareaPickerWindow\b/g, 'state.window').replace(/\bpendingAreaPickerContext\b/g, 'state.context').replace(/\bpendingAreaPickerResolver\b/g, 'state.resolver').replace(/\bareaPickerRendererContextSignature\b/g, 'state.rendererSignature');
  function retained(text) {
    const t = ts.createSourceFile(rootFile, text, ts.ScriptTarget.Latest, true);
    const statements = t.statements.filter(n => !/require\('(?:path|\.\/areaPickerWindow.cjs)'\)/.test(n.getText(t))).map(n => {
      if (!ts.isFunctionDeclaration(n) || n.name?.text !== 'createAreaPickerService') return n;
      const body = ts.factory.updateBlock(n.body, n.body.statements.filter(n => !(ts.isFunctionDeclaration(n) && n.name?.text === 'ensureAreaPickerWindow') && !(ts.isVariableStatement(n) && n.getText(t).includes('createAreaPickerWindowController('))));
      return ts.factory.updateFunctionDeclaration(n, n.modifiers, n.asteriskToken, n.name, n.typeParameters, n.parameters, n.type, body);
    });
    return ts.createPrinter().printFile(ts.factory.updateSourceFile(t, statements));
  }
  assert.equal(retained(fs.readFileSync(rootFile, 'utf8')), retained(old), 'Other border, selection, shortcut, window stack and public API statements unchanged');
}
function run(initial, contextMode, eventMode, pending, quitting, stage, original) {
  const trace = [], windows = [], failure = Error('controlled picker window failure'); let initializing = false;
  class Window extends EventEmitter {
    constructor(options) {
      super(); trace.push(['create', options]); if (stage === 'create' && !initializing) throw failure;
      this.id = windows.length; windows.push(this); this.dead = false; this.webContents = new EventEmitter();
      const once = this.webContents.once;
      this.webContents.once = function(event, callback) { trace.push(['web-once', event]); return once.call(this, event, callback); };
    }
    isDestroyed() { trace.push(['dead?', this.id]); return this.dead; }
    once(event, callback) { trace.push(['once', event]); return super.once(event, callback); }
    on(event, callback) { trace.push(['on', event]); return super.on(event, callback); }
  }
  const state = { window: null, context: contextMode === 'none' ? null : contextMode === 'no-bounds' ? {} : { virtualBounds: { x: -1920, y: -80, width: 3840, height: 1200 } }, resolver: pending ? () => {} : null, rendererSignature: 'prior' };
  if (initial !== 'none') { initializing = true; state.window = new Window({ fixture: 'existing' }); initializing = false; state.window.dead = initial === 'dead'; trace.length = 0; }
  function operation(name) { return (...args) => { trace.push([name, ...args.map(v => v instanceof Window ? v.id : v)]); if (stage === name) throw failure; }; }
  const deps = { state, BrowserWindow: Window, isQuitting: () => { trace.push(['quitting']); return quitting; },
    syncAreaPickerWindowBounds: operation('sync'), broadcastAreaPickerContext: operation('broadcast'), showAreaPickerWindow: operation('show'),
    resolveAreaPickerSelection: operation('resolve'), unregisterAreaPickerEscapeShortcut: operation('unregister'), loadRenderer: operation('renderer'),
    windowManager: { scheduleKeepWindowOnTop: operation('schedule'), keepWindowOnTop: operation('top') },
    topmostRelativeLevel: 5, topmostLevel: 'pop-up-menu' };
  let ensure;
  if (original) ensure = new Function('state', 'BrowserWindow', 'windowManager', 'syncAreaPickerWindowBounds', 'broadcastAreaPickerContext', 'showAreaPickerWindow', 'resolveAreaPickerSelection', 'unregisterAreaPickerEscapeShortcut', 'loadRenderer', 'isQuitting', 'AREA_PICKER_TOPMOST_RELATIVE_LEVEL', 'AREA_PICKER_TOPMOST_WINDOW_LEVEL', 'path', '__dirname', oldFunction + '\nreturn ensureAreaPickerWindow;')(state, Window, deps.windowManager, deps.syncAreaPickerWindowBounds, deps.broadcastAreaPickerContext, deps.showAreaPickerWindow, deps.resolveAreaPickerSelection, deps.unregisterAreaPickerEscapeShortcut, deps.loadRenderer, deps.isQuitting, 5, 'pop-up-menu', path, path.dirname(rootFile));
  else ensure = require(file).createAreaPickerWindowController(deps);
  let result, error;
  try { result = ensure(); } catch (e) { assert.equal(e, failure); error = e.message; }
  const win = windows.at(-1);
  if (win) {
    if (eventMode === 'stale') state.window = { fixture: 'replacement' };
    if (eventMode === 'dead') win.dead = true;
    for (const event of ['did-finish-load', 'did-finish-load', 'ready-to-show', 'ready-to-show', 'close', 'show', 'closed']) {
      try {
        if (event === 'did-finish-load') win.webContents.emit(event);
        else if (event === 'close') win.emit(event, { preventDefault: operation('prevent') });
        else win.emit(event);
      } catch (e) { assert.equal(e, failure); trace.push(['event-error', event, e.message]); }
    }
  }
  if (initial === 'live' && stage !== 'sync') assert.equal(result, win, 'Live window is reused even without context');
  if (initial !== 'live' && contextMode !== 'valid') assert.equal(result, null);
  return { result: result?.id ?? null, error, stateWindow: state.window?.id ?? state.window?.fixture ?? null, signature: state.rendererSignature, trace };
}
function main() {
  const hash = crypto.createHash('sha256'); let cases = 0;
  for (const initial of ['none', 'live', 'dead']) for (const context of ['none', 'no-bounds', 'valid']) for (const events of ['normal', 'stale', 'dead']) for (const pending of [false, true]) for (const quitting of [false, true])
    for (const stage of ['normal', 'create', 'sync', 'schedule', 'renderer', 'broadcast', 'show', 'resolve', 'unregister', 'top']) {
      const actual = run(initial, context, events, pending, quitting, stage, false);
      if (oldFunction) assert.deepEqual(actual, run(initial, context, events, pending, quitting, stage, true));
      hash.update(JSON.stringify(actual) + '\n'); cases++;
    }
  const fingerprint = hash.digest('hex');
  assert.equal(fingerprint, 'a82255de539d945786f45108cf364fd00232078745c9f798adf1979faef72ee5', 'Reviewed picker window options/events/stale/quit/error behavior');
  console.log('Area picker window passed: ' + cases + ' reuse/context/loading/stale/closed/quitting/error cases; controlled windows.');
}
try { main(); } catch (error) { console.error(error); process.exitCode = 1; }
