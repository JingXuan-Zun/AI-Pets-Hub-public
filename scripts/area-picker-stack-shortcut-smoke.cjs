const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const crypto = require('node:crypto');
const rootFile = require.resolve('../electron/areaPickerService.cjs');
const stackFile = require.resolve('../electron/areaPickerWindowStack.cjs'), shortcutFile = require.resolve('../electron/areaPickerEscapeShortcut.cjs');
for (const file of [stackFile, shortcutFile]) {
  const s = fs.readFileSync(file, 'utf8'), t = ts.createSourceFile(file, s, ts.ScriptTarget.Latest, true);
  assert.ok(s.split('\n').length <= 300);
  function visit(n) { if (ts.isFunctionLike(n) && n.body) assert.ok(t.getLineAndCharacterOfPosition(n.end).line - t.getLineAndCharacterOfPosition(n.getStart(t)).line + 1 <= 50); ts.forEachChild(n, visit); }
  visit(t);
}
const names = ['restoreAuxWindowStack', 'reduceAuxWindowTopmostForAreaPicker', 'registerAreaPickerEscapeShortcut', 'unregisterAreaPickerEscapeShortcut'];
const variables = ['getSettingsWindow', 'getChatWindow', 'getMainWindow', 'areaPickerEscapeShortcutRegistered', 'areaPickerReducedAuxTopmost'];
let oldFunctions;
if (process.argv[2]) {
  const old = fs.readFileSync(process.argv[2], 'utf8'), t = ts.createSourceFile(rootFile, old, ts.ScriptTarget.Latest, true);
  const factory = t.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'createAreaPickerService');
  oldFunctions = Object.fromEntries(factory.body.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name?.text)).map(n => [n.name.text, n.getText(t)]));
  function retained(text) {
    const t = ts.createSourceFile(rootFile, text, ts.ScriptTarget.Latest, true);
    const statements = t.statements.filter(n => !/require\('\.\/areaPicker(?:WindowStack|EscapeShortcut).cjs'\)/.test(n.getText(t))).map(n => {
      if (!ts.isFunctionDeclaration(n) || n.name?.text !== 'createAreaPickerService') return n;
      const body = ts.factory.updateBlock(n.body, n.body.statements.filter(n => !(ts.isFunctionDeclaration(n) && names.includes(n.name?.text)) && !(ts.isVariableStatement(n) && (n.declarationList.declarations.some(d => variables.includes(d.name.getText(t))) || /createAreaPicker(?:WindowStack|EscapeShortcut)\(/.test(n.getText(t))))));
      return ts.factory.updateFunctionDeclaration(n, n.modifiers, n.asteriskToken, n.name, n.typeParameters, n.parameters, n.type, body);
    });
    return ts.createPrinter().printFile(ts.factory.updateSourceFile(t, statements));
  }
  assert.equal(retained(fs.readFileSync(rootFile, 'utf8')), retained(old), 'Other selection/window/border/public API statements unchanged');
}
function stackCase(statuses, stage, sequence, original) {
  const trace = [], failure = Error('controlled stack failure');
  const windows = statuses.map((status, i) => status === 'none' ? null : {
    isDestroyed() { trace.push(['dead', i]); return status === 'dead'; },
    isVisible() { trace.push(['visible', i]); return status === 'visible'; },
    focus() { trace.push(['focus', i]); if (stage === 'focus') throw failure; },
    setAlwaysOnTop(value) { assert.equal(value, false); trace.push(['reduce', i]); if (stage === 'reduce') throw failure; },
  });
  const windowManager = { scheduleKeepWindowOnTop(win, ...args) { trace.push(['schedule', windows.indexOf(win), ...args]); if (stage === 'schedule') throw failure; }, scheduleWindowStackOnTop() { trace.push(['stack']); if (stage === 'stack') throw failure; } };
  for (const [i, key] of ['getSettingsWindow', 'getChatWindow', 'getMainWindow'].entries()) windowManager[key] = function() { assert.equal(this, windowManager); trace.push(['get', i]); if (stage === 'get' + i) throw failure; return windows[i]; };
  let api;
  if (original) api = new Function('windowManager', 'MAIN_TOPMOST_RELATIVE_LEVEL', 'AUX_TOPMOST_RELATIVE_LEVEL', `let areaPickerReducedAuxTopmost=false; const getSettingsWindow=()=>windowManager.getSettingsWindow(), getChatWindow=()=>windowManager.getChatWindow(), getMainWindow=()=>windowManager.getMainWindow();\n${oldFunctions.restoreAuxWindowStack}\n${oldFunctions.reduceAuxWindowTopmostForAreaPicker}\nreturn {restoreAuxWindowStack,reduceAuxWindowTopmostForAreaPicker};`)(windowManager, 1, 3);
  else api = require(stackFile).createAreaPickerWindowStack({ windowManager, mainRelativeLevel: 1, auxRelativeLevel: 3 });
  for (const op of sequence) {
    try { api[op === 'restore' ? 'restoreAuxWindowStack' : 'reduceAuxWindowTopmostForAreaPicker'](); }
    catch (e) { assert.equal(e, failure); trace.push(['error', e.message]); }
  }
  return trace;
}
function shortcutCase(registerMode, unregisterFails, pending, original) {
  const trace = [], failure = Error('controlled shortcut failure'); let callback, resolver = pending ? () => {} : null;
  const globalShortcut = {
    register(key, fn) { assert.equal(this, globalShortcut); trace.push(['register', key]); if (registerMode === 'throw') throw failure; callback = fn; return registerMode === 'true' ? true : registerMode === 'false' ? false : undefined; },
    unregister(key) { assert.equal(this, globalShortcut); trace.push(['unregister', key]); if (unregisterFails) throw failure; },
  };
  function resolveAreaPickerSelection(value) { assert.equal(value, null); trace.push(['cancel']); resolver = null; }
  let api;
  if (original) api = new Function('globalShortcut', 'resolveAreaPickerSelection', 'AREA_PICKER_ESCAPE_ACCELERATOR', `let areaPickerEscapeShortcutRegistered=false; const holder=arguments[3];\n${oldFunctions.registerAreaPickerEscapeShortcut.replace(/pendingAreaPickerResolver/g, 'holder.getResolver()')}\n${oldFunctions.unregisterAreaPickerEscapeShortcut}\nreturn {registerAreaPickerEscapeShortcut,unregisterAreaPickerEscapeShortcut};`)(globalShortcut, resolveAreaPickerSelection, 'Esc', { getResolver: () => resolver });
  else api = require(shortcutFile).createAreaPickerEscapeShortcut({ globalShortcut, accelerator: 'Esc', getPendingResolver: () => resolver, resolveAreaPickerSelection });
  api.unregisterAreaPickerEscapeShortcut(); api.registerAreaPickerEscapeShortcut(); api.registerAreaPickerEscapeShortcut();
  callback?.(); callback?.(); api.unregisterAreaPickerEscapeShortcut(); api.unregisterAreaPickerEscapeShortcut();
  api.registerAreaPickerEscapeShortcut(); api.unregisterAreaPickerEscapeShortcut();
  return trace;
}
function main() {
  const hash = crypto.createHash('sha256'); let stacks = 0, shortcuts = 0;
  for (const settings of ['none', 'dead', 'hidden', 'visible']) for (const chat of ['none', 'dead', 'hidden', 'visible']) for (const main of ['none', 'dead', 'hidden', 'visible'])
    for (const stage of ['normal', 'get0', 'get1', 'get2', 'focus', 'reduce', 'schedule', 'stack']) for (const sequence of [['reduce', 'reduce', 'restore', 'reduce'], ['restore', 'restore'], ['reduce']]) {
      const actual = stackCase([settings, chat, main], stage, sequence, false);
      if (oldFunctions) assert.deepEqual(actual, stackCase([settings, chat, main], stage, sequence, true));
      hash.update(JSON.stringify(actual) + '\n'); stacks++;
    }
  for (const register of ['true', 'false', 'undefined', 'throw']) for (const fails of [false, true]) for (const pending of [false, true]) {
    const actual = shortcutCase(register, fails, pending, false);
    if (oldFunctions) assert.deepEqual(actual, shortcutCase(register, fails, pending, true));
    hash.update(JSON.stringify(actual) + '\n'); shortcuts++;
  }
  const fingerprint = hash.digest('hex');
  assert.equal(fingerprint, 'f2ae2fb3813b37ee03cc8a292cf0c64fae03e367080b31a9351b55153613e213', 'Reviewed priority/getter/error/shortcut/cancellation behavior');
  console.log('Area stack/shortcut passed: ' + stacks + ' window priority/state/error cases and ' + shortcuts + ' registration/cancellation/failure sequences; controlled APIs.');
}
try { main(); } catch (error) { console.error(error); process.exitCode = 1; }
