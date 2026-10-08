const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const crypto = require('node:crypto');
const file = require.resolve('../electron/areaPickerContextSync.cjs'), rootFile = require.resolve('../electron/areaPickerService.cjs');
const source = fs.readFileSync(file, 'utf8'), tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
assert.ok(source.split('\n').length <= 300);
function budgets(n) { if (ts.isFunctionLike(n) && n.body) assert.ok(tree.getLineAndCharacterOfPosition(n.end).line - tree.getLineAndCharacterOfPosition(n.getStart(tree)).line + 1 <= 50); ts.forEachChild(n, budgets); }
budgets(tree);
const names = ['syncAreaPickerWindowBounds', 'broadcastAreaPickerContext', 'showAreaPickerWindow'];
let oldFunctions;
if (process.argv[2]) {
  const old = fs.readFileSync(process.argv[2], 'utf8'), t = ts.createSourceFile(rootFile, old, ts.ScriptTarget.Latest, true);
  const factory = t.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'createAreaPickerService');
  oldFunctions = factory.body.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name?.text)).map(n => n.getText(t)).join('\n')
    .replace(/\bareaPickerWindow\b/g, 'state.window').replace(/\bpendingAreaPickerContext\b/g, 'state.context').replace(/\bareaPickerRendererContextSignature\b/g, 'state.rendererSignature').replace(/\bpendingAreaPickerContextSignature\b/g, 'state.contextSignature');
  function retained(text) {
    const t = ts.createSourceFile(rootFile, text, ts.ScriptTarget.Latest, true);
    const statements = t.statements.filter(n => !n.getText(t).includes("require('./areaPickerContextSync.cjs')")).map(n => {
      if (!ts.isFunctionDeclaration(n) || n.name?.text !== 'createAreaPickerService') return n;
      const filtered = n.body.statements.filter(n => !(ts.isFunctionDeclaration(n) && names.includes(n.name?.text)) && !(ts.isVariableStatement(n) && (n.getText(t).includes('createAreaPickerContextSync(') || n.declarationList.declarations.some(d => d.name.getText(t) === 'pickerState'))));
      const transformed = filtered.map(n => {
        if (!ts.isVariableStatement(n) || !n.getText(t).includes('createAreaPickerWindowController(')) return n;
        const d = n.declarationList.declarations[0], call = d.initializer, argument = call.arguments[0];
        const properties = argument.properties.filter(p => p.name?.getText(t) !== 'state');
        const updatedCall = ts.factory.updateCallExpression(call, call.expression, call.typeArguments, [ts.factory.updateObjectLiteralExpression(argument, properties)]);
        return ts.factory.updateVariableStatement(n, n.modifiers, ts.factory.updateVariableDeclarationList(n.declarationList, [ts.factory.updateVariableDeclaration(d, d.name, d.exclamationToken, d.type, updatedCall)]));
      });
      return ts.factory.updateFunctionDeclaration(n, n.modifiers, n.asteriskToken, n.name, n.typeParameters, n.parameters, n.type, ts.factory.updateBlock(n.body, transformed));
    });
    return ts.createPrinter().printFile(ts.factory.updateSourceFile(t, statements));
  }
  assert.equal(retained(fs.readFileSync(rootFile, 'utf8')), retained(old), 'Other pending selection, shortcut, border, window and public API statements unchanged');
}
function run(windowMode, contextMode, loading, sameSignature, changedBounds, stage, original) {
  const trace = [], failure = Error('controlled context sync failure');
  const bounds = { x: -1920, y: -80, width: 3840, height: 1200 };
  const context = contextMode === 'none' ? null : contextMode === 'no-bounds' ? {} : { virtualBounds: bounds };
  const state = { window: null, context, rendererSignature: sameSignature ? 'current' : 'prior', contextSignature: 'current' };
  const win = {
    isDestroyed() { trace.push(['dead']); return windowMode === 'dead'; },
    getBounds() { trace.push(['getBounds']); if (stage === 'bounds-read') throw failure; const current = { ...bounds }; if (changedBounds !== 'same') current[changedBounds] = 0; return current; },
    setBounds(value) { assert.equal(value, bounds); trace.push(['setBounds', { ...value }]); if (stage === 'bounds-write') throw failure; },
    show() { trace.push(['show']); if (stage === 'show') throw failure; }, focus() { trace.push(['focus']); if (stage === 'focus') throw failure; },
    webContents: { isLoadingMainFrame() { trace.push(['loading']); return loading; }, send(channel, value) { assert.equal(value, context); trace.push(['send', channel]); if (stage === 'send') throw failure; } },
  };
  state.window = windowMode === 'none' ? null : win;
  const windowManager = { keepWindowOnTop(value, ...args) { assert.equal(this, windowManager); assert.equal(value, win); trace.push(['top', ...args]); if (stage === 'top') throw failure; } };
  function reduceAuxWindowTopmostForAreaPicker() { trace.push(['reduce']); if (stage === 'reduce') throw failure; }
  let api;
  if (original) api = new Function('state', 'windowManager', 'reduceAuxWindowTopmostForAreaPicker', 'AREA_PICKER_TOPMOST_RELATIVE_LEVEL', 'AREA_PICKER_TOPMOST_WINDOW_LEVEL', oldFunctions + '\nreturn {syncAreaPickerWindowBounds,broadcastAreaPickerContext,showAreaPickerWindow};')(state, windowManager, reduceAuxWindowTopmostForAreaPicker, 5, 'pop-up-menu');
  else api = require(file).createAreaPickerContextSync({ state, windowManager, reduceAuxWindowTopmostForAreaPicker, topmostRelativeLevel: 5, topmostLevel: 'pop-up-menu' });
  for (const operation of ['syncAreaPickerWindowBounds', 'broadcastAreaPickerContext', 'broadcastAreaPickerContext', 'showAreaPickerWindow', 'mutate', 'broadcastAreaPickerContext']) {
    try {
      if (operation === 'mutate') state.contextSignature = 'changed';
      else api[operation]();
    } catch (error) { assert.equal(error, failure); trace.push(['error', operation, error.message]); }
    trace.push(['signature', state.rendererSignature]);
  }
  if (stage === 'send') assert.equal(state.rendererSignature, sameSignature ? 'current' : 'prior', 'Failed send must not mark context broadcast');
  return trace;
}
function main() {
  const hash = crypto.createHash('sha256'); let cases = 0;
  for (const window of ['none', 'dead', 'live']) for (const context of ['none', 'no-bounds', 'valid']) for (const loading of [false, true]) for (const signature of [false, true]) for (const bounds of ['same', 'x', 'y', 'width', 'height'])
    for (const stage of ['normal', 'bounds-read', 'bounds-write', 'send', 'reduce', 'show', 'focus', 'top']) {
      const actual = run(window, context, loading, signature, bounds, stage, false);
      if (oldFunctions) assert.deepEqual(actual, run(window, context, loading, signature, bounds, stage, true));
      hash.update(JSON.stringify(actual) + '\n'); cases++;
    }
  const fingerprint = hash.digest('hex');
  assert.equal(fingerprint, 'b04f5b0a5f5f952754519540f15418409b7e4b723c5454edf9b1209dd3abf00c', 'Reviewed bounds/broadcast/dedup/show/error order');
  console.log('Area context sync passed: ' + cases + ' bounds/context/loading/dedup/show/error cases; controlled APIs.');
}
try { main(); } catch (error) { console.error(error); process.exitCode = 1; }
