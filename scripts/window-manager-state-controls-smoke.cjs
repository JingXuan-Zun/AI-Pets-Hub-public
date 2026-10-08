const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const { createWindowManagerStateControls: actual } = require('../electron/windowManager/windowManagerStateControls.cjs');
const names = ['getMainWindow', 'getSettingsWindow', 'getChatWindow', 'getShellRendererWindows', 'setQuitting', 'setSharedState', 'getSharedState'];
const entry = path.resolve(__dirname, '../electron/windowManager.cjs');
const source = require('./windowManagerStateAssemblySource.cjs').expandWindowManagerStateSource(fs.readFileSync(entry, 'utf8'));
const parse = text => ts.createSourceFile(entry, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const baselinePath = process.argv[2];
let original;
if (baselinePath) {
  const baseline = fs.readFileSync(baselinePath, 'utf8'), tree = parse(baseline);
  const rootFactory = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === 'createWindowManager');
  const methods = rootFactory.body.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name.text));
  assert.equal(methods.length, 7);
  original = new Function('dependencies', 'const {managerState,syncInteractiveChatWindowBounds,broadcastSharedState}=dependencies;'
    + methods.map(node => node.getText(tree)).join('\n') + '\nreturn {' + names.join(',') + '};');
  const printer = ts.createPrinter({ removeComments: true });
  function tokens(text) {
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, text), result = [];
    for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) result.push([kind, scanner.getTokenText()]);
    return JSON.stringify(result);
  }
  const moduleTree = parse(fs.readFileSync(path.resolve(__dirname, '../electron/windowManager/windowManagerStateControls.cjs'), 'utf8'));
  const newFactory = moduleTree.statements.find(ts.isFunctionDeclaration);
  for (const method of methods) {
    const moved = newFactory.body.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === method.name.text);
    assert.equal(hash(tokens(printer.printNode(ts.EmitHint.Unspecified, moved, moduleTree))),
      hash(tokens(printer.printNode(ts.EmitHint.Unspecified, method, tree))), 'Original state method: ' + method.name.text);
  }
  function canonical(text) {
    const root = parse(text), factory = root.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === 'createWindowManager');
    const transformed = ts.transform(factory, [context => {
      function visit(node) {
        if (ts.isFunctionDeclaration(node) && names.includes(node.name?.text)) return undefined;
        if (ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration =>
          ts.isCallExpression(declaration.initializer) && declaration.initializer.expression.getText(root) === 'createWindowManagerStateControls')) return undefined;
        return ts.visitEachChild(node, visit, context);
      }
      return node => ts.visitNode(node, visit);
    }]);
    try { return hash(tokens(printer.printNode(ts.EmitHint.Unspecified, transformed.transformed[0], root))); }
    finally { transformed.dispose(); }
  }
  assert.equal(canonical(source), canonical(baseline), 'Remaining root composition, execution and public API AST');
}

const values = () => [undefined, null, false, 0, '', NaN, { marker: 'object' }, ['item'], Symbol('fixture'), 'value'];
const encode = value => value === undefined ? '<undefined>' : typeof value === 'symbol' ? '<symbol>'
  : Number.isNaN(value) ? '<NaN>' : value;
function exercise(factory) {
  const outcomes = [];
  for (const value of values()) for (const failure of ['none', 'write', 'sync', 'broadcast']) for (const mutation of ['none', 'sync', 'broadcast']) {
    const calls = [], error = new Error('fixture state failure'), state = { latestSharedState: 'before' };
    const managerState = new Proxy(state, { set(target, key, assigned) {
      calls.push(['set', key, encode(assigned)]); if (failure === 'write') throw error; target[key] = assigned; return true;
    } });
    const api = factory({ managerState,
      syncInteractiveChatWindowBounds() { calls.push(['sync', encode(state.latestSharedState)]); if (mutation === 'sync') state.latestSharedState = 'sync-change'; if (failure === 'sync') throw error; },
      broadcastSharedState() { calls.push(['broadcast', encode(state.latestSharedState)]); if (mutation === 'broadcast') state.latestSharedState = 'broadcast-change'; if (failure === 'broadcast') throw error; },
    });
    assert.deepEqual(calls, [], 'Construction must stay lazy'); assert.deepEqual(Object.keys(api), names);
    let caught; try { api.setSharedState(value); } catch (caughtError) { caught = caughtError; }
    assert.equal(caught, failure === 'none' ? undefined : error);
    assert.equal(api.getSharedState(), state.latestSharedState, 'Live state identity including callback mutations');
    if (failure !== 'write' && mutation === 'none') assert.equal(state.latestSharedState, value ?? null);
    assert.deepEqual(calls.map(call => call[0]), failure === 'write' ? ['set'] : failure === 'sync' ? ['set', 'sync'] : ['set', 'sync', 'broadcast']);
    outcomes.push({ kind: 'shared', value: encode(value), failure, mutation, calls, state: encode(state.latestSharedState) });
  }
  for (const value of values()) for (const fail of [false, true]) {
    const calls = [], state = {}, error = new Error('fixture quitting write');
    const api = factory({ managerState: new Proxy(state, { set(target, key, assigned) {
      calls.push([key, assigned]); if (fail) throw error; target[key] = assigned; return true;
    } }) });
    let caught; try { api.setQuitting(value); } catch (failure) { caught = failure; }
    assert.equal(caught, fail ? error : undefined);
    if (!fail) assert.equal(state.isQuitting, Boolean(value));
    outcomes.push({ kind: 'quitting', value: encode(value), fail, calls });
  }
  for (const name of ['getMainWindow', 'getSettingsWindow', 'getChatWindow', 'getSharedState']) for (const value of values()) for (const fail of [false, true]) {
    const calls = [], error = new Error('fixture getter read'); let live = value;
    const api = factory({ managerState: new Proxy({}, { get(_target, key) { calls.push(key); if (fail) throw error; return live; } }) });
    assert.deepEqual(calls, []);
    let caught; try { assert.equal(api[name](), value); live = { marker: 'changed' }; assert.equal(api[name](), live); } catch (failure) { caught = failure; }
    assert.equal(caught, fail ? error : undefined);
    outcomes.push({ kind: 'getter', name, value: encode(value), fail, calls });
  }
  const kinds = ['null', 'false', 'alive', 'destroyed', 'getter-error', 'call-error'];
  for (const main of kinds) for (const settings of kinds) for (const chat of kinds) for (const readFailure of ['none', 'mainWindow', 'settingsWindow', 'chatWindow']) {
    const calls = [], error = new Error('fixture window filter'), state = {};
    for (const [name, kind] of [['mainWindow', main], ['settingsWindow', settings], ['chatWindow', chat]]) {
      state[name] = kind === 'null' ? null : kind === 'false' ? false : { id: name,
        get isDestroyed() { calls.push(['method', name]); if (kind === 'getter-error') throw error;
          return () => { calls.push(['destroyed', name]); if (kind === 'call-error') throw error; return kind === 'destroyed'; }; },
      };
    }
    const api = factory({ managerState: new Proxy(state, { get(target, key) { calls.push(['get', key]); if (key === readFailure) throw error; return target[key]; } }) });
    assert.deepEqual(calls, []);
    let result, caught; try { result = api.getShellRendererWindows(); } catch (failure) { caught = failure; }
    assert.ok(caught === undefined || caught === error);
    if (!caught) for (const window of result) assert.equal(window, state[window.id]);
    outcomes.push({ kind: 'filter', main, settings, chat, readFailure, calls, result: result?.map(window => window.id) ?? null, error: Boolean(caught) });
  }
  return outcomes;
}
const results = exercise(actual), digest = hash(JSON.stringify(results));
if (original) assert.deepEqual(results, exercise(original));
const expectedDigest = '59a373ac08116da85ee46af5dc1b9e78e9f7fd055e5ce2b839d5f3bf28618527';
assert.equal(digest, expectedDigest, 'Original public state/filter/synchronization contract');
const rootTree = parse(source), bindings = [];
function verifyBinding(node) {
  if (ts.isVariableDeclaration(node) && ts.isCallExpression(node.initializer)
    && node.initializer.expression.getText(rootTree) === 'createWindowManagerStateControls') bindings.push(node);
  ts.forEachChild(node, verifyBinding);
}
verifyBinding(rootTree); assert.equal(bindings.length, 1);
assert.deepEqual(bindings[0].name.elements.map(element => element.name.getText(rootTree)), names);
const options = bindings[0].initializer.arguments[0].properties;
assert.deepEqual(options.map(property => property.name.getText(rootTree)), ['managerState', 'syncInteractiveChatWindowBounds', 'broadcastSharedState']);
assert.ok(ts.isShorthandPropertyAssignment(options[0]));
for (const property of options.slice(1)) {
  assert.ok(ts.isArrowFunction(property.initializer)); assert.equal(property.initializer.parameters.length, 0);
  assert.ok(ts.isCallExpression(property.initializer.body));
  assert.equal(property.initializer.body.expression.getText(rootTree), property.name.getText(rootTree));
  assert.equal(property.initializer.body.arguments.length, 0, 'Late-bound callbacks keep original arguments');
}
const firstState = { mainWindow: null, latestSharedState: null, isQuitting: false }, peerState = { ...firstState };
const first = actual({ managerState: firstState, syncInteractiveChatWindowBounds() {}, broadcastSharedState() {} });
const peer = actual({ managerState: peerState, syncInteractiveChatWindowBounds() {}, broadcastSharedState() {} });
first.setSharedState({ marker: 'first' }); first.setQuitting(true);
assert.equal(peer.getSharedState(), null); assert.equal(peerState.isQuitting, false);
firstState.mainWindow = { marker: 'live' }; assert.equal(first.getMainWindow(), firstState.mainWindow); assert.equal(peer.getMainWindow(), null);
assert.ok(source.includes('syncInteractiveChatWindowBounds: () => syncInteractiveChatWindowBounds()'));
assert.ok(source.includes('broadcastSharedState: () => broadcastSharedState()'));
console.log(`Window state controls passed: ${results.length} cases; ${digest}; live window/state identity, filter order, sync/broadcast failures and instance isolation${baselinePath ? ', original method/root AST equivalence' : ''}.`);
