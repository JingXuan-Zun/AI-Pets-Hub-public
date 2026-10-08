const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const file = require.resolve('../electron/areaPickerBorderWindow.cjs');
const rootFile = require.resolve('../electron/areaPickerService.cjs');
const source = fs.readFileSync(file, 'utf8'), tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
assert.ok(source.split('\n').length <= 300);
function budgets(n) {
  if (ts.isFunctionLike(n) && n.body) assert.ok(tree.getLineAndCharacterOfPosition(n.end).line - tree.getLineAndCharacterOfPosition(n.getStart(tree)).line + 1 <= 50);
  ts.forEachChild(n, budgets);
}
budgets(tree);
let oldFunction;
if (process.argv[2]) {
  const old = fs.readFileSync(process.argv[2], 'utf8'), t = ts.createSourceFile(rootFile, old, ts.ScriptTarget.Latest, true);
  const factory = t.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'createAreaPickerService');
  oldFunction = factory.body.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'createPersistentAreaBorderWindow').getText(t);
  function retained(text) {
    const t = ts.createSourceFile(rootFile, text, ts.ScriptTarget.Latest, true);
    const statements = t.statements.filter(n => !n.getText(t).includes("require('./areaPickerBorderWindow.cjs')")).map(n => {
      if (!ts.isFunctionDeclaration(n) || n.name?.text !== 'createAreaPickerService') return n;
      const body = ts.factory.updateBlock(n.body, n.body.statements.filter(n => !(ts.isFunctionDeclaration(n) && n.name?.text === 'createPersistentAreaBorderWindow') && !(ts.isVariableStatement(n) && n.getText(t).includes('createAreaBorderWindow('))));
      return ts.factory.updateFunctionDeclaration(n, n.modifiers, n.asteriskToken, n.name, n.typeParameters, n.parameters, n.type, body);
    });
    return ts.createPrinter().printFile(ts.factory.updateSourceFile(t, statements));
  }
  assert.equal(retained(fs.readFileSync(rootFile, 'utf8')), retained(old), 'Other selection/border/lifecycle/public API statements unchanged');
}
async function run(stage, events, relativeLevel, level, original) {
  const trace = [], failure = Error('controlled border window failure'); let created, options;
  class Window {
    constructor(value) {
      trace.push(['create', value]); options = value; if (stage === 'create') throw failure;
      created = this; this.webContents = new EventEmitter();
      const once = this.webContents.once;
      this.webContents.once = function(event, callback) { trace.push(['once', event]); if (stage === 'once') throw failure; return once.call(this, event, callback); };
    }
    setIgnoreMouseEvents(...args) { assert.equal(this, created); trace.push(['ignore', ...args]); if (stage === 'ignore') throw failure; }
    loadURL(value) { assert.equal(this, created); trace.push(['load', value]); if (stage === 'load-sync') throw failure; return stage === 'load-reject' ? Promise.reject(failure) : Promise.resolve(); }
  }
  const windowManager = { keepWindowOnTop(win, ...args) { assert.equal(this, windowManager); assert.equal(win, created); trace.push(['top', ...args]); if (stage === 'top') throw failure; } };
  function refreshPersistentAreaBorder() { trace.push(['refresh']); if (stage === 'refresh') throw failure; }
  let factory;
  if (original) factory = new Function('BrowserWindow', 'windowManager', 'refreshPersistentAreaBorder', 'PERSISTENT_AREA_BORDER_TOPMOST_RELATIVE_LEVEL', 'AREA_PICKER_TOPMOST_WINDOW_LEVEL', oldFunction + '\nreturn createPersistentAreaBorderWindow;')(Window, windowManager, refreshPersistentAreaBorder, relativeLevel, level);
  else factory = () => require(file).createPersistentAreaBorderWindow({ BrowserWindow: Window, windowManager, refreshPersistentAreaBorder, topmostRelativeLevel: relativeLevel, topmostLevel: level });
  let returned = false, error;
  try { const result = factory(); assert.equal(result, created); returned = true; } catch (e) { assert.equal(e, failure); error = e.message; }
  for (let i = 0; i < events && created; i++) {
    try { created.webContents.emit('did-finish-load'); } catch (e) { assert.equal(e, failure); trace.push(['refresh-error', e.message]); }
  }
  await Promise.resolve();
  if (returned) {
    assert.equal(options.transparent, true); assert.equal(options.focusable, false); assert.equal(options.show, false);
    assert.equal(options.thickFrame, false); assert.equal(options.webPreferences.devTools, false);
    assert.ok(trace.some(row => row[0] === 'ignore' && row[1] === true && row[2].forward === true));
    const html = decodeURIComponent(trace.find(row => row[0] === 'load')[1].split(',')[1]);
    assert.ok(html.includes('--border-width: 2px;')); assert.ok(html.includes('background: transparent;'));
  }
  assert.ok(trace.filter(row => row[0] === 'refresh').length <= 1, 'Load listener remains once');
  return { returned, error, trace };
}
async function main() {
  const hash = crypto.createHash('sha256'); let cases = 0;
  for (const stage of ['normal', 'create', 'ignore', 'top', 'once', 'load-sync', 'load-reject', 'refresh']) for (const events of [0, 1, 2])
    for (const relative of [4, 0, 'custom']) for (const level of ['pop-up-menu', 'screen-saver']) {
      const actual = await run(stage, events, relative, level, false);
      if (oldFunction) assert.deepEqual(actual, await run(stage, events, relative, level, true));
      hash.update(JSON.stringify(actual) + '\n'); cases++;
    }
  const fingerprint = hash.digest('hex');
  assert.equal(fingerprint, 'fd1dfeae9ae36505c9a8d74b372402f03ec31ffdfbbf7d5be1245294fd41503c', 'Reviewed HTML/options/window sequence and failure behavior');
  console.log('Area border window passed: ' + cases + ' configuration/creation/call-order/load/refresh/error cases; controlled windows.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
