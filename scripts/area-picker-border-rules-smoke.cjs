const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const crypto = require('node:crypto');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const file = require.resolve('../electron/areaPickerBorderRules.cjs');
const rootFile = require.resolve('../electron/areaPickerService.cjs');
const source = fs.readFileSync(file, 'utf8');
const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
assert.ok(source.split('\n').length <= 300);
function budgets(n) {
  if (ts.isFunctionLike(n) && n.body) assert.ok(tree.getLineAndCharacterOfPosition(n.end).line - tree.getLineAndCharacterOfPosition(n.getStart(tree)).line + 1 <= 50);
  ts.forEachChild(n, budgets);
}
budgets(tree);
const names = ['resolvePersistentAreaBorderRect', 'resolvePersistentAreaBorderThickness'];
let oldFunctions, oldRoot;
if (process.argv[2]) {
  oldRoot = fs.readFileSync(process.argv[2], 'utf8');
  const t = ts.createSourceFile(rootFile, oldRoot, ts.ScriptTarget.Latest, true);
  const factory = t.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'createAreaPickerService');
  oldFunctions = factory.body.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name.text)).map(n => n.getText(t)).join('\n');
  assert.ok(oldFunctions.includes('function resolvePersistentAreaBorderRect'));
  function retained(text) {
    const t = ts.createSourceFile(rootFile, text, ts.ScriptTarget.Latest, true);
    const statements = t.statements.filter(n => !n.getText(t).includes("require('./areaPickerBorderRules.cjs')") && !n.getText(t).startsWith('const PERSISTENT_AREA_BORDER_THICKNESS_PX')).map(n => {
      if (!ts.isFunctionDeclaration(n) || n.name?.text !== 'createAreaPickerService') return n;
      const body = ts.factory.updateBlock(n.body, n.body.statements.filter(n => !(ts.isFunctionDeclaration(n) && names.includes(n.name?.text)) && !(ts.isVariableStatement(n) && n.getText(t).includes('createPersistentAreaBorderRules('))));
      return ts.factory.updateFunctionDeclaration(n, n.modifiers, n.asteriskToken, n.name, n.typeParameters, n.parameters, n.type, body);
    });
    return ts.createPrinter().printFile(ts.factory.updateSourceFile(t, statements));
  }
  assert.equal(retained(fs.readFileSync(rootFile, 'utf8')), retained(oldRoot), 'All window, shortcut, native script, pending selection and public API statements unchanged');
}
function api(deps, original) {
  if (original) return new Function('captureService', 'screen', 'PERSISTENT_AREA_BORDER_THICKNESS_PX', oldFunctions + '\nreturn {resolvePersistentAreaBorderRect,resolvePersistentAreaBorderThickness};')(deps.captureService, deps.screen, 3);
  return require(file).createPersistentAreaBorderRules(deps);
}
function rectCase(width, height, basis, position, mode, stage, original) {
  const trace = [], failure = Error('controlled rule failure');
  const crop = {}, options = {};
  for (const [key, value] of Object.entries({ width, height, x: position, y: position })) Object.defineProperty(crop, key, { get() { trace.push(['crop', key]); if (stage === key) throw failure; return value; } });
  for (const [key, value] of Object.entries({ mode, cropRect: crop, cropBasisX: basis, cropBasisY: basis })) Object.defineProperty(options, key, { get() { trace.push(['options', key]); return value; } });
  const captureService = { getVirtualDisplayBounds() { assert.equal(this, captureService); trace.push(['bounds']); if (stage === 'bounds') throw failure; return { x: -1920, y: -80 }; } };
  let result, error;
  try { result = api({ captureService, screen: {} }, original).resolvePersistentAreaBorderRect(options); }
  catch (e) { assert.equal(e, failure); error = e.message; }
  if (mode !== 'area') { assert.equal(result, null); assert.equal(trace.length, 1); }
  return { result, error, trace };
}
function thicknessCase(rectMode, scale, stage, original) {
  const trace = [], failure = Error('controlled display failure');
  const rect = rectMode === 'null' ? null : {};
  if (rect) for (const [key, value] of Object.entries({ x: -15.5, y: -7.8, width: rectMode === 'nan' ? NaN : rectMode === 'small' ? -2 : 12.5, height: 7.5 })) Object.defineProperty(rect, key, { get() { trace.push(['rect', key]); if (stage === 'rect') throw failure; return value; } });
  const matched = {};
  Object.defineProperty(matched, 'scaleFactor', { get() { trace.push(['scale']); if (stage === 'scale') throw failure; return scale; } });
  const screen = { getDisplayMatching(value) { assert.equal(this, screen); trace.push(['matching', value]); if (stage === 'matching') throw failure; return matched; } };
  const result = api({ captureService: {}, screen }, original).resolvePersistentAreaBorderThickness(rect);
  assert.ok(Number.isInteger(result) && result >= 1);
  if (rectMode === 'null' || stage !== 'normal') assert.equal(result, 3);
  return { result, trace };
}
async function rootCase(original) {
  const trace = []; let basis = -1920;
  class Window extends EventEmitter {
    constructor(options) { super(); this.visible = false; this.destroyed = false; trace.push(['create', options]); this.webContents = new EventEmitter(); this.webContents.isLoadingMainFrame = () => false; this.webContents.executeJavaScript = async (...args) => trace.push(['script', ...args]); }
    setIgnoreMouseEvents(...args) { trace.push(['ignore', ...args]); }
    loadURL(value) { trace.push(['load', value]); return Promise.resolve(); }
    isDestroyed() { return this.destroyed; }
    isVisible() { return this.visible; }
    setBounds(...args) { trace.push(['setBounds', ...args]); }
    showInactive() { this.visible = true; trace.push(['showInactive']); }
    hide() { this.visible = false; trace.push(['hide']); }
    destroy() { this.destroyed = true; trace.push(['destroy']); }
  }
  const module = { exports: {} }, screen = { getDisplayMatching: rect => { trace.push(['matching', rect]); return { scaleFactor: 1.5 }; } };
  new Function('require', 'module', '__dirname', original ? oldRoot : fs.readFileSync(rootFile, 'utf8'))(id => {
    if (id === 'electron') return { BrowserWindow: Window, globalShortcut: {}, screen };
    if (id === 'path') return path;
    if (id === './areaPickerGeometry.cjs') return require('../electron/areaPickerGeometry.cjs');
    if (id === './areaPickerBorderRules.cjs') return require(file);
    if (id === './areaPickerBorderWindow.cjs') return require('../electron/areaPickerBorderWindow.cjs');
    if (id === './areaPickerBorderLifecycle.cjs') return require('../electron/areaPickerBorderLifecycle.cjs');
    if (id === './areaPickerWindow.cjs') return require('../electron/areaPickerWindow.cjs');
    if (id === './areaPickerWindowStack.cjs') return require('../electron/areaPickerWindowStack.cjs');
    if (id === './areaPickerEscapeShortcut.cjs') return require('../electron/areaPickerEscapeShortcut.cjs');
    if (id === './areaPickerContextSync.cjs') return require('../electron/areaPickerContextSync.cjs');
    if (id === './areaPickerSelectionSession.cjs') return require('../electron/areaPickerSelectionSession.cjs');
    if (id === './areaPickerInteractionAssembly.cjs') return require('../electron/areaPickerInteractionAssembly.cjs');
    throw Error('Unexpected dependency ' + id);
  }, module, path.dirname(rootFile));
  const service = module.exports.createAreaPickerService({ captureService: { getVirtualDisplayBounds: () => ({ x: basis, y: -80 }) }, windowManager: { keepWindowOnTop: (...args) => trace.push(['top', args[1], args[2]]), scheduleKeepWindowOnTop: (...args) => trace.push(['schedule', args[1], args[2]]) } });
  const options = { mode: 'area', cropRect: { x: 10.4, y: 20.5, width: 120, height: 80 } };
  service.syncPersistentAreaBorderFromSettingsAction({ type: 'preview-capture-options', options });
  assert.ok(service.getPersistentAreaBorderWindow());
  basis = -1600; service.refreshPersistentAreaBorder();
  const bounds = trace.filter(row => row[0] === 'setBounds');
  assert.deepEqual(bounds.map(row => row[1].x), [-1910, -1590]);
  assert.ok(trace.some(row => row[0] === 'script' && row[1].includes("'2px'")));
  service.syncPersistentAreaBorderFromSettingsAction({ type: 'stop-screen-capture' });
  service.refreshPersistentAreaBorder(); assert.equal(trace.filter(row => row[0] === 'setBounds').length, 2);
  service.syncPersistentAreaBorderFromSettingsAction({ type: 'start-screen-capture', options: { mode: 'area', cropRect: { width: 7, height: 80 } } });
  assert.equal(trace.filter(row => row[0] === 'create').length, 1);
  service.dispose(); assert.equal(service.getPersistentAreaBorderWindow(), null);
  return trace;
}
async function main() {
  const hash = crypto.createHash('sha256'); let cases = 0;
  for (const width of [7.4, 7.5, 10.6, '9', NaN, Infinity]) for (const height of [7, 8, '12', NaN]) for (const basis of [undefined, 0, -1600, '12', Infinity])
    for (const position of [-10.5, '3', null]) for (const mode of ['area', 'screen']) for (const stage of ['normal', 'bounds', 'width', 'x']) {
      const actual = rectCase(width, height, basis, position, mode, stage, false);
      if (oldFunctions) assert.deepEqual(actual, rectCase(width, height, basis, position, mode, stage, true));
      hash.update(JSON.stringify(actual) + '\n'); cases++;
    }
  for (const rect of ['null', 'normal', 'small', 'nan']) for (const scale of [undefined, null, 0, 1, 1.25, 1.5, 2, 3, '2', NaN, Infinity]) for (const stage of ['normal', 'rect', 'matching', 'scale']) {
    const actual = thicknessCase(rect, scale, stage, false);
    if (oldFunctions) assert.deepEqual(actual, thicknessCase(rect, scale, stage, true));
    hash.update(JSON.stringify(actual) + '\n'); cases++;
  }
  const root = await rootCase(false); if (oldRoot) assert.deepEqual(root, await rootCase(true)); hash.update(JSON.stringify(root));
  const fingerprint = hash.digest('hex');
  assert.equal(fingerprint, 'df6d98e8a2195939ce4d8481fc44ace32fba35885fd61eaea826cb84160ccf78', 'Reviewed geometry/DPI/getter/error/window-call behavior');
  console.log('Area border rules passed: ' + cases + ' geometry/DPI/getter/error cases and real-root border integration; no native IO.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
