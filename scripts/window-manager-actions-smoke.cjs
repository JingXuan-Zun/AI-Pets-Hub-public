const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const ts = require('typescript');
const { createWindowManagerActions: actual } = require('../electron/windowManager/windowManagerActions.cjs');
const names = ['hideMainWindow', 'createTray', 'setSettingsOpen'];
const parse = text => ts.createSourceFile('windowManager.cjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const printer = ts.createPrinter({ removeComments: true });
function tokens(node, tree) {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, printer.printNode(ts.EmitHint.Unspecified, node, tree));
  const result = [];
  for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) result.push([kind, scanner.getTokenText()]);
  return JSON.stringify(result);
}
const rootSource = require('./windowManagerStateAssemblySource.cjs').expandWindowManagerStateSource(fs.readFileSync('electron/windowManager.cjs', 'utf8'));
const moduleTree = parse(fs.readFileSync('electron/windowManager/windowManagerActions.cjs', 'utf8'));
const newFactory = moduleTree.statements.find(ts.isFunctionDeclaration);
function methods(factory) {
  return names.map(name => factory.body.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === name)
    ?? factory.body.statements.flatMap(node => ts.isVariableStatement(node) ? [...node.declarationList.declarations] : []).find(node => node.name.getText() === name)?.initializer);
}
const methodDigest = hash(JSON.stringify(methods(newFactory).map(node => tokens(node, moduleTree))));
let original;
if (process.argv[2]) {
  const oldSource = fs.readFileSync(process.argv[2], 'utf8'), tree = parse(oldSource);
  const factory = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === 'createWindowManager');
  const oldMethods = factory.body.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name.text));
  const settings = factory.body.statements.find(ts.isReturnStatement).expression.properties.find(node => node.name.getText(tree) === 'setSettingsOpen').initializer;
  assert.equal(methodDigest, hash(JSON.stringify([...oldMethods, settings].map(node => tokens(node, tree)))));
  original = new Function('dependencies', 'const {managerState,hidePostDragInputProxy,Tray,resolveTrayIcon,configureTray,resizeWindowForSettings}=dependencies;'
    + oldMethods.map(node => node.getText(tree)).join('\n') + ';const setSettingsOpen=' + settings.getText(tree) + ';return {hideMainWindow,createTray,setSettingsOpen};');
  function canonical(text) {
    const tree = parse(text), factory = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === 'createWindowManager');
    const transformed = ts.transform(factory, [context => {
      function visit(node) {
        if (ts.isFunctionDeclaration(node) && names.includes(node.name?.text)) return undefined;
        if (ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => ts.isCallExpression(declaration.initializer)
          && declaration.initializer.expression.getText(tree) === 'createWindowManagerActions')) return undefined;
        if (ts.isPropertyAssignment(node) && node.name.getText(tree) === 'setSettingsOpen') return ts.factory.createShorthandPropertyAssignment('setSettingsOpen');
        return ts.visitEachChild(node, visit, context);
      }
      return node => ts.visitNode(node, visit);
    }]);
    try { return hash(tokens(transformed.transformed[0], tree)); } finally { transformed.dispose(); }
  }
  assert.equal(canonical(rootSource), canonical(oldSource), 'Remaining root execution and public API');
}
function exercise(factory) {
  const outcomes = [];
  for (const kind of ['null', 'false', 'alive', 'destroyed']) for (const failure of ['none', 'read-first', 'read-second', 'proxy', 'hide-get', 'hide-call']) for (const mutation of ['none', 'replace', 'null']) {
    const calls = [], error = new Error('hide failure'); let reads = 0;
    const window = id => ({ id, destroyed: kind === 'destroyed', get hide() {
      calls.push(['hide-get', id]); if (failure === 'hide-get') throw error;
      return function () { assert.equal(this.id, id); calls.push(['hide-call', id]); if (failure === 'hide-call') throw error; return 'ignored'; };
    } });
    const state = { mainWindow: kind === 'null' ? null : kind === 'false' ? false : window('original') };
    const api = factory({ managerState: new Proxy(state, { get(target, key) {
      calls.push(['read', key]); reads++; if (failure === (reads === 1 ? 'read-first' : 'read-second')) throw error; return target[key];
    } }), hidePostDragInputProxy(reason, destroy) {
      calls.push(['proxy', reason, destroy]); if (failure === 'proxy') throw error;
      if (mutation === 'replace') state.mainWindow = window('replacement'); if (mutation === 'null') state.mainWindow = null;
    } });
    assert.deepEqual(calls, [], 'Construction must not touch dependencies');
    let caught; try { assert.equal(api.hideMainWindow(), undefined); } catch (error) { caught = error; }
    if (caught) assert.ok(caught === error || (mutation === 'null' && caught instanceof TypeError));
    if (kind === 'null' || kind === 'false') assert.deepEqual(calls, [['read', 'mainWindow']]);
    if (failure === 'none' && mutation === 'none' && kind === 'alive') assert.deepEqual(calls,
      [['read', 'mainWindow'], ['proxy', 'main-window-hidden', true], ['read', 'mainWindow'], ['hide-get', 'original'], ['hide-call', 'original']]);
    outcomes.push({ action: 'hide', kind, failure, mutation, calls, error: caught?.name ?? null });
  }
  for (const failure of ['none', 'icon', 'construct', 'write', 'configure']) for (const mutation of ['none', 'replace', 'null']) {
    const calls = [], error = new Error('tray failure'), state = { tray: null }, created = { id: 'created' };
    const api = factory({ managerState: new Proxy(state, { set(target, key, value) {
      calls.push(['write', key, value.id]); if (failure === 'write') throw error; target[key] = value; return true;
    } }), resolveTrayIcon() { calls.push(['icon']); if (failure === 'icon') throw error; return created; },
    Tray: function (icon) { assert.equal(icon, created); calls.push(['construct', icon.id]); if (failure === 'construct') throw error; return created; },
    configureTray() { calls.push(['configure', state.tray?.id]); assert.equal(state.tray, created); if (mutation === 'replace') state.tray = { id: 'replacement' }; if (mutation === 'null') state.tray = null; if (failure === 'configure') throw error; return 'ignored'; } });
    assert.deepEqual(calls, []); let caught; try { assert.equal(api.createTray(), undefined); } catch (failure) { caught = failure; }
    assert.equal(caught, failure === 'none' ? undefined : error);
    if (failure === 'none') assert.deepEqual(calls, [['icon'], ['construct', 'created'], ['write', 'tray', 'created'], ['configure', 'created']]);
    outcomes.push({ action: 'tray', failure, mutation, calls, tray: state.tray?.id ?? null, error: Boolean(caught) });
  }
  for (const [index, value] of [undefined, null, false, true, 0, '', NaN, {}, [], Symbol('value'), 'open'].entries()) for (const failure of ['none', 'write', 'resize']) {
    const calls = [], error = new Error('settings failure'), state = { isShellSettingsOpen: 'before' };
    const api = factory({ managerState: new Proxy(state, { set(target, key, value) {
      calls.push(['write', key, value]); if (failure === 'write') throw error; target[key] = value; return true;
    } }), resizeWindowForSettings(open) { assert.equal(state.isShellSettingsOpen, Boolean(value)); calls.push(['resize', open]); if (failure === 'resize') throw error; return 'ignored'; } });
    assert.deepEqual(calls, []); let caught; try { assert.equal(api.setSettingsOpen(value), undefined); } catch (failure) { caught = failure; }
    assert.equal(caught, failure === 'none' ? undefined : error);
    assert.deepEqual(calls, failure === 'write' ? [['write', 'isShellSettingsOpen', Boolean(value)]] : [['write', 'isShellSettingsOpen', Boolean(value)], ['resize', Boolean(value)]]);
    assert.equal(state.isShellSettingsOpen, failure === 'write' ? 'before' : Boolean(value));
    outcomes.push({ action: 'settings', index, failure, calls, state: state.isShellSettingsOpen });
  }
  return outcomes;
}
const outcomes = exercise(actual); if (original) assert.deepEqual(outcomes, exercise(original));
const digest = hash(JSON.stringify(outcomes));
assert.equal(methodDigest, 'bd3a68b827a5f23af32adaed78d4d1ab561f45698dc94f5a12062621759f129c');
assert.equal(digest, 'ae763dc8627ad4cc48772ed56ebcf4d96de49bfc4219addbd152d5da466de4ae');
const tree = parse(rootSource), bindings = [];
function visit(node) {
  if (ts.isVariableDeclaration(node) && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(tree) === 'createWindowManagerActions') bindings.push(node);
  ts.forEachChild(node, visit);
}
visit(tree); assert.equal(bindings.length, 1); assert.deepEqual(bindings[0].name.elements.map(node => node.name.getText(tree)), names);
const props = bindings[0].initializer.arguments[0].properties;
assert.deepEqual(props.map(node => node.name.getText(tree)), ['managerState', 'Tray', 'hidePostDragInputProxy', 'resolveTrayIcon', 'configureTray', 'resizeWindowForSettings']);
for (const prop of props.slice(2)) {
  assert.ok(ts.isArrowFunction(prop.initializer)); const arrow = prop.initializer;
  assert.equal(arrow.body.expression.getText(tree), prop.name.getText(tree));
  assert.deepEqual(arrow.body.arguments.map(node => node.getText(tree)), arrow.parameters.map(node => node.name.getText(tree)));
}
const state = {}, peer = {}, api = actual({managerState: state, resizeWindowForSettings() {}});
const peerApi = actual({managerState: peer, resizeWindowForSettings() {}});
api.setSettingsOpen(true); peerApi.setSettingsOpen(false); assert.equal(state.isShellSettingsOpen, true); assert.equal(peer.isShellSettingsOpen, false);
console.log(`Window manager actions passed: ${outcomes.length} cases; methods ${methodDigest}; behavior ${digest}; late-bound wiring${original ? ', old/new methods and remaining root AST' : ''}.`);
