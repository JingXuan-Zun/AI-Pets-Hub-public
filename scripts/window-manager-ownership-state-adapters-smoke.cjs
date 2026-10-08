const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const { createWindowOwnershipStateAdapters: actual } = require('../electron/windowManager/windowOwnershipStateAdapters.cjs');
const { createWindowManagerState } = require('../electron/windowManager/windowManagerState.cjs');
const specs = [
  ['mainCreation', 'createMainWindowCreationControllers', ['setMainWindow', 'setCanShow', 'setRendererRecoveryInProgress', 'setRendererReadyToShow']],
  ['chatOwnership', 'createChatWindowControllers', ['getChatWindow', 'setChatWindow', 'getWasInteractive', 'setWasInteractive']],
  ['chatClosing', 'createChatWindowControllers', ['getIsQuitting', 'clearChatWindow']],
  ['settingsOwnership', 'createSettingsWindowControllers', ['getSettingsWindow', 'setSettingsWindow', 'getIsQuitting', 'clearSettingsWindow', 'clearSettingsWindowReadyPromise']],
  ['settingsReadiness', 'createSettingsWindowControllers', ['getReadyPromise', 'setReadyPromise']],
  ['trayOwnership', 'createTrayConfigurator', ['getTray', 'getMainWindow', 'markQuitting']],
];
const entry = path.resolve(__dirname, '../electron/windowManager.cjs');
const source = (() => {
  let root = require('./windowManagerStateAssemblySource.cjs').expandWindowManagerStateSource(fs.readFileSync(entry, 'utf8'));
  root = require('./windowManagerAuxiliaryAssemblySource.mjs').expandAuxiliaryWindowContentSource(root);
  root = require('./windowManagerAuxiliaryAssemblySource.mjs').expandMainWindowLifecycleSource(root);
  root = require('./windowManagerAuxiliaryAssemblySource.mjs').expandWindowPresentationTraySource(root);
  for (const [file, name] of [['auxiliaryWindowCreationControllers', 'createAuxiliaryWindowCreationControllers'], ['mainWindowCreationControllers', 'createMainWindowStateCreationControllers'], ['trayConfiguration', 'createSettingsTrayControllers'], ['chatWindowControllers', 'createChatWindowOwnershipControllers'], ['settingsWindowControllers', 'createSettingsWindowOwnershipControllers']]) {
    const tree = ts.createSourceFile(entry, root, ts.ScriptTarget.Latest, true);
    const moduleText = fs.readFileSync(path.resolve(__dirname, '../electron/windowManager/' + file + '.cjs'), 'utf8');
    const moduleTree = ts.createSourceFile(entry, moduleText, ts.ScriptTarget.Latest, true);
    const phase = moduleTree.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === name);
    const owner = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createWindowManager');
    const binding = owner.body.statements.find(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.initializer && ts.isCallExpression(d.initializer) && d.initializer.expression.getText(tree) === name));
    assert.ok(binding && phase, 'Actual root phase: ' + name);
    const expanded = ['trayConfiguration', 'auxiliaryWindowCreationControllers'].includes(file) ? phase.body.statements.filter(ts.isVariableStatement).map(n => n.getText(moduleTree)).join('\n')
      : 'const ' + binding.declarationList.declarations[0].name.getText(tree) + ' = ' + phase.body.statements.find(ts.isReturnStatement).expression.getText(moduleTree) + ';';
    root = root.slice(0, binding.getStart(tree)) + expanded + root.slice(binding.end);
  }
  return root;
})();
const parse = text => ts.createSourceFile(entry, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const baselinePath = process.argv[2], originalGroups = new Map();
let original;
if (baselinePath) {
  const baseline = fs.readFileSync(baselinePath, 'utf8'), tree = parse(baseline), calls = new Map();
  function collect(node) {
    if (ts.isCallExpression(node) && specs.some(([, caller]) => node.expression.getText(tree) === caller)) calls.set(node.expression.getText(tree), node.arguments[0]);
    ts.forEachChild(node, collect);
  }
  collect(tree);
  const groupTexts = specs.map(([name, caller, keys]) => {
    const properties = calls.get(caller).properties.filter(prop => keys.includes(prop.name?.getText(tree)));
    assert.deepEqual(properties.map(prop => prop.name.getText(tree)), keys);
    originalGroups.set(name, properties);
    return name + ':{' + properties.map(prop => prop.getText(tree)).join(',') + '}';
  });
  original = new Function('managerState', 'return {' + groupTexts.join(',') + '};');
  const printer = ts.createPrinter({ removeComments: true });
  function tokens(text) {
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, text), result = [];
    for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) result.push([kind, scanner.getTokenText()]);
    return JSON.stringify(result);
  }
  const moduleTree = parse(fs.readFileSync(path.resolve(__dirname, '../electron/windowManager/windowOwnershipStateAdapters.cjs'), 'utf8'));
  const returned = moduleTree.statements.find(ts.isFunctionDeclaration).body.statements.find(ts.isReturnStatement).expression;
  for (const [name] of specs) {
    const moved = returned.properties.find(prop => prop.name.getText(moduleTree) === name).initializer;
    const old = ts.factory.createObjectLiteralExpression(ts.factory.createNodeArray(originalGroups.get(name), true));
    assert.equal(hash(tokens(printer.printNode(ts.EmitHint.Expression, moved, moduleTree))), hash(tokens(printer.printNode(ts.EmitHint.Expression, old, tree))), 'Original ownership group: ' + name);
  }
  function canonical(text, restore) {
    const root = parse(text), factory = root.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === 'createWindowManager');
    const transformed = ts.transform(factory, [context => {
      function visit(node) {
        if (restore && ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => declaration.name.getText(root) === 'windowOwnershipState')) return undefined;
        if (restore && ts.isObjectLiteralExpression(node)) {
          const properties = node.properties.flatMap(property => {
            if (ts.isSpreadAssignment(property) && ts.isPropertyAccessExpression(property.expression) && property.expression.expression.getText(root) === 'windowOwnershipState') {
              assert.ok(originalGroups.has(property.expression.name.text)); return [...originalGroups.get(property.expression.name.text)];
            }
            return [ts.visitNode(property, visit)];
          });
          return ts.factory.updateObjectLiteralExpression(node, ts.factory.createNodeArray(properties, node.properties.hasTrailingComma));
        }
        return ts.visitEachChild(node, visit, context);
      }
      return node => ts.visitNode(node, visit);
    }]);
    try { return hash(tokens(printer.printNode(ts.EmitHint.Unspecified, transformed.transformed[0], root))); }
    finally { transformed.dispose(); }
  }
  assert.equal(canonical(source, true), canonical(baseline, false), 'Remaining root composition and expanded ownership property order');
}

function exercise(factory) {
  const outcomes = [];
  for (const [group, , keys] of specs) for (const name of keys) for (const mode of ['undefined', 'null', 'false', 'zero', 'string', 'object', 'symbol', 'read-error', 'write-error']) {
    const trace = [], error = new Error('fixture ownership error'), writes = new Map();
    const value = mode === 'undefined' ? undefined : mode === 'null' ? null : mode === 'false' ? false : mode === 'zero' ? 0 : mode === 'object' ? { marker: 'identity' } : mode === 'symbol' ? Symbol('fixture') : 'value';
    const encode = item => item === undefined ? '<undefined>' : typeof item === 'symbol' ? '<symbol>' : item;
    const state = new Proxy({}, {
      get(_target, key) { trace.push(['get', key]); if (mode === 'read-error') throw error; return value; },
      set(_target, key, assigned) { trace.push(['set', key, encode(assigned)]); if (mode === 'write-error') throw error; writes.set(key, assigned); return true; },
    });
    const groups = factory(state); assert.deepEqual(trace, [], 'Creating ownership callbacks must not access state');
    assert.deepEqual(Object.keys(groups), specs.map(([key]) => key));
    assert.deepEqual(Object.keys(groups[group]), keys);
    let result, caught; try { result = groups[group][name](value); } catch (failure) { caught = failure; }
    assert.ok(caught === undefined || caught === error);
    if (!caught && name.startsWith('get')) assert.equal(result, value);
    if (!caught && name.startsWith('set')) { assert.equal(result, undefined); assert.equal([...writes.values()][0], value); }
    outcomes.push({ group, name, mode, trace, result: encode(result), error: Boolean(caught) });
  }
  return outcomes;
}
const results = exercise(actual), digest = hash(JSON.stringify(results));
if (original) assert.deepEqual(results, exercise(original));
const expectedDigest = 'b027281f48eb0aacb1ea3213725c906932e911bfdd214cace81ff129627941cd';
assert.equal(digest, expectedDigest, 'Original ownership read/write/null/boolean/error contract');
const rootTree = parse(source), wiring = new Map(), used = [], initializations = [];
function inspect(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(rootTree) === 'windowOwnershipState') initializations.push(node);
  if (ts.isCallExpression(node) && specs.some(([, caller]) => node.expression.getText(rootTree) === caller)) {
    const caller = node.expression.getText(rootTree), keys = [];
    for (const property of node.arguments[0].properties) {
      if (ts.isSpreadAssignment(property)) {
        assert.equal(property.expression.expression.getText(rootTree), 'windowOwnershipState');
        const group = property.expression.name.text;
        assert.equal(specs.find(([name]) => name === group)[1], caller, 'Ownership group belongs to its original caller');
        used.push(group); keys.push(...specs.find(([name]) => name === group)[2]);
      } else keys.push(property.name.getText(rootTree));
    }
    wiring.set(caller, keys);
  }
  ts.forEachChild(node, inspect);
}
inspect(rootTree); assert.equal(initializations.length, 1);
assert.equal(initializations[0].initializer.expression.getText(rootTree), 'createWindowOwnershipStateAdapters');
assert.equal(initializations[0].initializer.arguments.length, 1);
assert.equal(initializations[0].initializer.arguments[0].getText(rootTree), 'managerState');
assert.deepEqual(used.sort(), specs.map(([name]) => name).sort());
const wiringDigest = hash(JSON.stringify([...wiring]));
if (baselinePath) {
  const tree = parse(fs.readFileSync(baselinePath, 'utf8')), oldWiring = new Map();
  function collect(node) {
    if (ts.isCallExpression(node) && specs.some(([, caller]) => node.expression.getText(tree) === caller)) oldWiring.set(node.expression.getText(tree), node.arguments[0].properties.map(prop => prop.name.getText(tree)));
    ts.forEachChild(node, collect);
  }
  collect(tree); assert.deepEqual([...wiring], [...oldWiring]);
}
const expectedWiringDigest = 'f61b3223f5ce06740285b06efffcc4b7ac097fcbe887f30d5e99b397a98ec9d1';
assert.equal(wiringDigest, expectedWiringDigest, 'Original caller option key order');
const state = createWindowManagerState(), peerState = createWindowManagerState(), groups = actual(state), peer = actual(peerState);
const window = { marker: 'window' }, promise = Promise.resolve({ marker: 'ready' });
groups.mainCreation.setMainWindow(window); assert.equal(groups.trayOwnership.getMainWindow(), window);
groups.chatOwnership.setChatWindow(window); assert.equal(groups.chatOwnership.getChatWindow(), window);
groups.chatClosing.clearChatWindow(); assert.equal(groups.chatOwnership.getChatWindow(), null);
groups.settingsOwnership.setSettingsWindow(window); assert.equal(groups.settingsOwnership.getSettingsWindow(), window);
groups.settingsReadiness.setReadyPromise(promise); assert.equal(groups.settingsReadiness.getReadyPromise(), promise);
groups.settingsOwnership.clearSettingsWindowReadyPromise(); assert.equal(groups.settingsReadiness.getReadyPromise(), null);
groups.trayOwnership.markQuitting(); assert.equal(groups.chatClosing.getIsQuitting(), true); assert.equal(groups.settingsOwnership.getIsQuitting(), true);
assert.equal(peer.trayOwnership.getMainWindow(), null); assert.equal(peer.settingsReadiness.getReadyPromise(), null); assert.equal(peer.chatClosing.getIsQuitting(), false);
console.log(`Window ownership state adapters passed: ${results.length} cases; ${digest}; wiring ${wiringDigest}; window/Promise identity, closing aliases and instance isolation${baselinePath ? ', original object/expanded root AST equivalence' : ''}.`);
