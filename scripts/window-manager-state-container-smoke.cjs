const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const ts = require('typescript');
const { createWindowManagerState } = require('../electron/windowManager/windowManagerState.cjs');

const entry = path.resolve(__dirname, '../electron/windowManager.cjs');
const requireEntry = createRequire(entry);
const source = fs.readFileSync(entry, 'utf8');
const first = createWindowManagerState(), second = createWindowManagerState();
const names = Object.keys(first);
assert.equal(names.length, 41);
assert.equal(Object.hasOwn(first, 'isAgentDesktopExecutionActive'), false);
assert.deepEqual(Object.keys(second), names);
for (const name of names) {
  if (first[name] instanceof WeakMap) {
    assert.ok(second[name] instanceof WeakMap);
    assert.notEqual(first[name], second[name]);
    const key = {}; first[name].set(key, 'first'); assert.equal(second[name].has(key), false);
  } else if (Array.isArray(first[name])) {
    assert.deepEqual(first[name], []); assert.notEqual(first[name], second[name]);
    first[name].push('first'); assert.deepEqual(second[name], []);
  } else assert.equal(first[name], second[name]);
}

const tree = text => ts.createSourceFile(entry, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const factory = root => root.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === 'createWindowManager');
const printer = ts.createPrinter({ removeComments: true });
function canonicalFactory(text) {
  const root = tree(text);
  const transformed = ts.transform(factory(root), [context => {
    function visit(node) {
      if (ts.isVariableStatement(node) && node.declarationList.declarations.every(declaration =>
        ts.isIdentifier(declaration.name) && (names.includes(declaration.name.text) || declaration.name.text === 'managerState'))) return undefined;
      if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'managerState') {
        assert.ok(names.includes(node.name.text)); return ts.factory.createIdentifier(node.name.text);
      }
      if (ts.isShorthandPropertyAssignment(node)) return ts.factory.createPropertyAssignment(node.name, node.name);
      return ts.visitEachChild(node, visit, context);
    }
    return node => ts.visitNode(node, visit);
  }]);
  try {
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard,
      printer.printNode(ts.EmitHint.Unspecified, transformed.transformed[0], root));
    const tokens = [];
    for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) tokens.push([kind, scanner.getTokenText()]);
    return JSON.stringify(tokens);
  }
  finally { transformed.dispose(); }
}
const baselinePath = process.argv[2];
if (baselinePath) {
  const baseline = fs.readFileSync(baselinePath, 'utf8'), oldTree = tree(baseline);
  assert.equal(canonicalFactory(source), canonicalFactory(baseline), 'All remaining root composition, API and execution AST must remain equivalent');
  const declarations = factory(oldTree).body.statements.filter(ts.isVariableStatement)
    .flatMap(statement => [...statement.declarationList.declarations]).filter(declaration => names.includes(declaration.name.getText(oldTree)));
  assert.deepEqual(declarations.map(declaration => declaration.name.getText(oldTree)), names);
  const stateTree = tree(fs.readFileSync(path.resolve(__dirname, '../electron/windowManager/windowManagerState.cjs'), 'utf8'));
  const stateFactory = stateTree.statements.find(ts.isFunctionDeclaration);
  const properties = stateFactory.body.statements.find(ts.isReturnStatement).expression.properties;
  for (let index = 0; index < names.length; index++) {
    assert.equal(printer.printNode(ts.EmitHint.Expression, declarations[index].initializer, oldTree),
      printer.printNode(ts.EmitHint.Expression, properties[index].initializer, stateTree), 'Original initializer: ' + names[index]);
  }
}

const states = [], bindings = [], effects = [];
const nativeAction = () => { effects.push('native'); throw new Error('Unexpected native action'); };
const moduleObject = { exports: {} };
const electron = { app: {}, BrowserWindow: nativeAction, Menu: {}, Tray: nativeAction,
  nativeImage: { createFromPath: nativeAction }, screen: {}, shell: {} };
vm.runInNewContext(source, { module: moduleObject, exports: moduleObject.exports, __dirname: path.dirname(entry),
  process, console, URL, setTimeout, clearTimeout, setInterval, clearInterval,
  require(id) {
    if (id === 'electron') return electron;
    if (id === './windowsDwmBorderService.cjs') return { disableDwmSystemBorderForWindow: nativeAction };
    if (id === './ipcSenderGuard.cjs') return { openExternalSafely: nativeAction };
    if (id === './windowManager/windowManagerState.cjs') return { createWindowManagerState() {
      const state = createWindowManagerState(); states.push(state); return state;
    } };
    const actual = requireEntry(id);
    if (!id.startsWith('./windowManager/')) return actual;
    return Object.fromEntries(Object.entries(actual).map(([name, value]) => [name,
      typeof value === 'function' && name.startsWith('create') ? (...args) => {
        bindings.push({ state: states.at(-1), args }); return value(...args);
      } : value]));
  },
}, { filename: entry });
const managers = [false, true].flatMap(isDev => [undefined, 'persist:test'].map(sessionPartition =>
  moduleObject.exports.createWindowManager({ isDev, sessionPartition, captureService: {} })));
assert.equal(states.length, 4); assert.deepEqual(effects, []);
const getters = [], setters = [];
function collect(value, state, depth = 0) {
  if (depth > 2 || value === process || value === path || value === electron) return;
  if (typeof value === 'function') {
    const text = value.toString();
    const get = text.match(/^\(\)\s*=>\s*managerState\.(\w+)$/);
    const set = text.match(/^\((\w+)\)\s*=>\s*\{\s*managerState\.(\w+)\s*=\s*\1;\s*\}$/);
    if (get) getters.push({ value, state, name: get[1] });
    if (set) setters.push({ value, state, name: set[2] });
  } else if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of Object.keys(value)) collect(value[key], state, depth + 1);
  }
}
for (const binding of bindings) for (const argument of binding.args) collect(argument, binding.state);
assert.ok(getters.length >= 100); assert.ok(setters.length >= 80);
for (const getter of getters) {
  const original = getter.state[getter.name], marker = { getter: getter.name };
  getter.state[getter.name] = marker;
  assert.equal(getter.value(), marker, 'Getter must read live state: ' + getter.name);
  getter.state[getter.name] = original;
}
for (const setter of setters) {
  const original = setter.state[setter.name], marker = { setter: setter.name };
  const peers = states.filter(state => state !== setter.state).map(state => state[setter.name]);
  setter.value(marker); assert.equal(setter.state[setter.name], marker);
  assert.deepEqual(states.filter(state => state !== setter.state).map(state => state[setter.name]), peers);
  setter.state[setter.name] = original;
}
for (let index = 0; index < managers.length; index++) {
  const manager = managers[index], state = states[index];
  manager.setQuitting(true); assert.equal(state.isQuitting, true);
  const shared = { interactiveDialogueActive: false, config: { settings: {} } };
  manager.setSharedState(shared); assert.equal(manager.getSharedState(), shared);
  assert.equal(state.latestSharedState, shared);
  assert.equal(manager.getMainWindow(), null); assert.equal(manager.getChatWindow(), null); assert.equal(manager.getSettingsWindow(), null);
  assert.deepEqual([...manager.getShellRendererWindows()], []);
  manager.dispose();
}
assert.deepEqual(effects, [], 'Construction and empty-window state operations must remain lazy');
console.log(`Window state container passed: 41 original fields, independent arrays/WeakMaps, 4 actual-root instances, ${getters.length} live getter and ${setters.length} isolated setter bindings${baselinePath ? ', original initializer/root AST equivalence' : ''}; no native actions.`);
