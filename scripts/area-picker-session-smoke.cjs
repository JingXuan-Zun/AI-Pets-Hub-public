const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const crypto = require('node:crypto');
const file = require.resolve('../electron/areaPickerSelectionSession.cjs'), rootFile = require.resolve('../electron/areaPickerService.cjs');
const source = fs.readFileSync(file, 'utf8'), tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
assert.ok(source.split('\n').length <= 300);
function budgets(n) { if (ts.isFunctionLike(n) && n.body) assert.ok(tree.getLineAndCharacterOfPosition(n.end).line - tree.getLineAndCharacterOfPosition(n.getStart(tree)).line + 1 <= 50); ts.forEachChild(n, budgets); }
budgets(tree);
const fields = { areaPickerWindow: 'window', pendingAreaPickerPromise: 'promise', pendingAreaPickerResolver: 'resolver', pendingAreaPickerContext: 'context', pendingAreaPickerContextSignature: 'contextSignature', areaPickerRendererContextSignature: 'rendererSignature' };
const names = ['resolveAreaPickerSelection', 'openAreaPickerWindow'];
let oldFunctions;
if (process.argv[2]) {
  const old = fs.readFileSync(process.argv[2], 'utf8'), t = ts.createSourceFile(rootFile, old, ts.ScriptTarget.Latest, true);
  const factory = t.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'createAreaPickerService');
  oldFunctions = factory.body.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name?.text)).map(n => n.getText(t)).join('\n');
  for (const [old, field] of Object.entries(fields)) oldFunctions = oldFunctions.replace(new RegExp('\\b' + old + '\\b', 'g'), 'state.' + field);
  function retained(text) {
    const t = ts.createSourceFile(rootFile, text, ts.ScriptTarget.Latest, true);
    const statements = t.statements.filter(n => !/require\('\.\/areaPicker(?:Geometry|SelectionSession).cjs'\)/.test(n.getText(t))).map(n => {
      if (!ts.isFunctionDeclaration(n) || n.name?.text !== 'createAreaPickerService') return n;
      const body = ts.factory.updateBlock(n.body, n.body.statements.filter(n => !(ts.isFunctionDeclaration(n) && names.includes(n.name?.text)) && !(ts.isVariableStatement(n) && (n.declarationList.declarations.some(d => Object.hasOwn(fields, d.name.getText(t)) || d.name.getText(t) === 'pickerState') || n.getText(t).includes('createAreaPickerSelectionSession(')))));
      return ts.factory.updateFunctionDeclaration(n, n.modifiers, n.asteriskToken, n.name, n.typeParameters, n.parameters, n.type, body);
    });
    let printed = ts.createPrinter().printFile(ts.factory.updateSourceFile(t, statements));
    for (const [old, field] of Object.entries(fields)) printed = printed.replace(new RegExp('(?<![./])\\b' + old + '\\b', 'g'), 'pickerState.' + field);
    return printed;
  }
  assert.equal(retained(fs.readFileSync(rootFile, 'utf8')), retained(old), 'Other window/context/shortcut/border/stack/public API statements unchanged except state ownership');
}
async function run(contextMode, windowMode, loading, stage, completion, original) {
  const trace = [], timers = [], failure = Error('controlled session failure');
  const state = { window: null, promise: null, resolver: null, context: null, contextSignature: '', rendererSignature: '' };
  const context = { virtualBounds: contextMode === 'no-bounds' ? null : { x: -1920, y: -80, width: 3840, height: 1200 }, displays: contextMode === 'empty' ? [] : [{ id: 'left', x: -1920, y: -80, width: 1920, height: 1080 }] };
  const win = { isDestroyed() { trace.push(['dead']); return windowMode === 'dead'; }, hide() { trace.push(['hide']); if (stage === 'hide') throw failure; }, webContents: { isLoadingMainFrame() { trace.push(['loading']); return loading; } } };
  function operation(name) { return () => { trace.push([name]); if (stage === name) throw failure; }; }
  let api;
  const deps = {
    captureService: { async buildAreaPickerContext() { trace.push(['context']); if (stage === 'context') throw failure; return context; } },
    registerAreaPickerEscapeShortcut: operation('register'), unregisterAreaPickerEscapeShortcut: operation('unregister'),
    broadcastAreaPickerContext: operation('broadcast'), showAreaPickerWindow: operation('show'), restoreAuxWindowStack: operation('restore'),
    ensureAreaPickerWindow() { trace.push(['ensure']); if (stage === 'ensure') throw failure; if (windowMode === 'none' || contextMode === 'no-bounds') return null; api.state.window = win; return win; },
    scheduleRestore(callback) { trace.push(['timer', 0]); timers.push(callback); },
  };
  if (original) api = new Function('state', 'captureService', 'registerAreaPickerEscapeShortcut', 'unregisterAreaPickerEscapeShortcut', 'ensureAreaPickerWindow', 'broadcastAreaPickerContext', 'showAreaPickerWindow', 'restoreAuxWindowStack', 'getAreaPickerContextSignature', 'setTimeout', oldFunctions + '\nreturn {state,resolveAreaPickerSelection,openAreaPickerWindow};')(state, deps.captureService, deps.registerAreaPickerEscapeShortcut, deps.unregisterAreaPickerEscapeShortcut, deps.ensureAreaPickerWindow, deps.broadcastAreaPickerContext, deps.showAreaPickerWindow, deps.restoreAuxWindowStack, require('../electron/areaPickerGeometry.cjs').getAreaPickerContextSignature, (callback, ms) => { assert.equal(ms, 0); deps.scheduleRestore(callback); });
  else {
    api = require(file).createAreaPickerSelectionSession(deps);
    assert.notEqual(api.state, require(file).createAreaPickerSelectionSession(deps).state, 'Session state is independent');
  }
  let settled = 0;
  function observe(promise) { promise.then(value => { trace.push(['result', value]); settled++; }, error => { assert.equal(error, failure); trace.push(['open-error', error.message]); settled++; }); }
  async function flush() { for (let i = 0; i < 6; i++) await Promise.resolve(); }
  observe(api.openAreaPickerWindow()); await flush();
  observe(api.openAreaPickerWindow()); await flush();
  const selection = completion === 'submit' ? { sourceId: 'controlled', cropRect: { x: 0, y: 0, width: 8, height: 8 } } : null;
  if (stage === 'resolver' && api.state.resolver) api.state.resolver = () => { throw failure; };
  try { api.resolveAreaPickerSelection(selection); } catch (error) { assert.equal(error, failure); trace.push(['resolve-error', error.message]); }
  await flush();
  assert.equal(api.state.promise, null); assert.equal(api.state.resolver, null, 'Cleanup precedes possible unregister/hide/resolver errors');
  for (const callback of timers) { try { callback(); } catch (error) { assert.equal(error, failure); trace.push(['timer-error', error.message]); } }
  return { trace, settled, hasContext: api.state.context === context, contextSignature: api.state.contextSignature, rendererSignature: api.state.rendererSignature };
}
async function main() {
  const hash = crypto.createHash('sha256'); let cases = 0;
  for (const context of ['valid', 'empty', 'no-bounds']) for (const window of ['live', 'dead', 'none']) for (const loading of [false, true])
    for (const stage of ['normal', 'context', 'register', 'ensure', 'broadcast', 'show', 'unregister', 'hide', 'resolver', 'restore']) for (const completion of ['submit', 'cancel']) {
      const actual = await run(context, window, loading, stage, completion, false);
      if (oldFunctions) assert.deepEqual(actual, await run(context, window, loading, stage, completion, true));
      hash.update(JSON.stringify(actual) + '\n'); cases++;
    }
  const fingerprint = hash.digest('hex');
  assert.equal(fingerprint, 'cd09aa13072d7ebb5dee43b4602337bedb3e35c57c8650e341b0ca8f76b2eae1', 'Reviewed pending/open/complete/cancel/error/timer behavior');
  console.log('Area selection session passed: ' + cases + ' context/window/loading/repeat-open/submit/cancel/error/timer cases; controlled dependencies.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
