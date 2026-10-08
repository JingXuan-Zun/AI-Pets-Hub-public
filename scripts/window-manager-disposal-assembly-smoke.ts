import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { exerciseWindowManagerDisposal } from './window-manager-disposal-smoke.ts';

const require = createRequire(import.meta.url);
const disposal = require('../electron/windowManager/windowManagerDisposal.cjs');
const name = 'createWindowManagerStateDisposer';
const parse = (text: string) => ts.createSourceFile('windowManager.cjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const hash = (text: string) => crypto.createHash('sha256').update(text).digest('hex');
const printer = ts.createPrinter({ removeComments: true });
function tokens(node: ts.Node, tree: ts.SourceFile) {
  const transformed = ts.transform(node, [context => {
    function visit(node: ts.Node): ts.VisitResult<ts.Node> {
      if (ts.isPropertyAssignment(node) && node.name.getText(tree) === 'clearTimeout' && ts.isArrowFunction(node.initializer)) {
        assert.equal(node.initializer.getText(tree), '(timer) => clearTimeout(timer)');
        return ts.factory.createShorthandPropertyAssignment('clearTimeout');
      }
      return ts.visitEachChild(node, visit, context);
    }
    return node => ts.visitNode(node, visit) as typeof node;
  }]);
  try {
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, printer.printNode(ts.EmitHint.Unspecified, transformed.transformed[0], tree));
    const result: unknown[] = [];
    for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) result.push([kind, scanner.getTokenText()]);
    return JSON.stringify(result);
  } finally { transformed.dispose(); }
}
const rootText = fs.readFileSync('electron/windowManager.cjs', 'utf8');
const tree = parse(fs.readFileSync('electron/windowManager/windowManagerDisposal.cjs', 'utf8'));
const factory = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name) as ts.FunctionDeclaration;
const call = (factory.body!.statements[0] as ts.ReturnStatement).expression!;
const callDigest = hash(tokens(call, tree)); assert.equal(callDigest, 'd263db5ae03b9fd5c48103c482c3387e35f66a21248956d8f7b6b7dd7d90a1c1');
let original: ((deps: any) => () => void) | undefined;
if (process.argv[2]) {
  const oldTree = parse(fs.readFileSync(process.argv[2], 'utf8'));
  const oldFactory = oldTree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'createWindowManager') as ts.FunctionDeclaration;
  const decl = oldFactory.body!.statements.filter(ts.isVariableStatement).flatMap(node => [...node.declarationList.declarations])
    .find(node => node.initializer && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(oldTree) === 'createWindowManagerDisposer')!;
  assert.equal(callDigest, hash(tokens(decl.initializer!, oldTree)));
  original = new Function('deps', 'const {managerState,stopMainTopmostGuard,clearMainInteractiveLayerWarmupTimers,clearPostDragInputProxyIdleDestroyTimer,hidePostDragInputProxy,clearTimeout,createWindowManagerDisposer}=deps;return ' + decl.initializer!.getText(oldTree) + ';') as (deps: any) => () => void;
  function canonical(text: string) {
    const tree = parse(text), factory = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'createWindowManager')!;
    const transformed = ts.transform(factory, [context => {
      function visit(node: ts.Node): ts.VisitResult<ts.Node> {
        if (ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => declaration.initializer && ts.isCallExpression(declaration.initializer)
          && ['createWindowManagerDisposer', name].includes(declaration.initializer.expression.getText(tree)))) return undefined;
        return ts.visitEachChild(node, visit, context);
      }
      return node => ts.visitNode(node, visit) as typeof node;
    }]);
    try { return hash(tokens(transformed.transformed[0], tree)); } finally { transformed.dispose(); }
  }
  assert.equal(canonical(rootText), canonical(oldTree.text), 'Remaining root execution, API and order');
}
function adapted(factory: (deps: any) => () => void) {
  return (deps: any) => {
    const getters: Record<string, string> = { postDragInputProxyWindow: 'getInputProxyWindow', mainWindowRendererReadyFallbackTimer: 'getReadyFallbackTimer', settingsWindowDisplayRefreshTimer: 'getDisplayRefreshTimer', tray: 'getTray' };
    const setters: Record<string, string> = { mainWindowRendererReadyFallbackTimer: 'setReadyFallbackTimer', settingsWindowDisplayRefreshTimer: 'setDisplayRefreshTimer', tray: 'setTray' };
    let accesses = 0;
    const managerState = new Proxy({}, { get(_target, key) { accesses++; assert.ok(typeof key === 'string' && key in getters); return deps[getters[key as string]](); },
      set(_target, key, value) { accesses++; assert.ok(typeof key === 'string' && key in setters); deps[setters[key as string]](value); return true; } });
    const dispose = factory({ ...deps, ...disposal, managerState }); assert.equal(accesses, 0, 'No eager cleanup or state reads');
    return dispose;
  };
}
const matrix = exerciseWindowManagerDisposal(adapted(disposal[name]));
assert.equal(matrix.length, 648); assert.deepEqual(matrix, exerciseWindowManagerDisposal());
if (original) assert.deepEqual(matrix, exerciseWindowManagerDisposal(adapted(original)));
function stateErrors(factory: (deps: any) => () => void) {
  return ['none', 'get:postDragInputProxyWindow', 'get:mainWindowRendererReadyFallbackTimer', 'set:mainWindowRendererReadyFallbackTimer',
    'get:settingsWindowDisplayRefreshTimer', 'set:settingsWindowDisplayRefreshTimer', 'get:tray', 'set:tray'].map(failure => {
    const calls: unknown[] = [], error = new Error('state access failure');
    const step = (name: string, ...args: unknown[]) => { calls.push([name, ...args]); if (name === failure) throw error; };
    const proxy = { isDestroyed: () => false, destroy() { step('destroy-proxy'); } }, tray = { isDestroyed: () => false, destroy() { step('destroy-tray'); } };
    const state: any = { postDragInputProxyWindow: proxy, mainWindowRendererReadyFallbackTimer: 'ready', settingsWindowDisplayRefreshTimer: 'refresh', tray };
    const managerState = new Proxy(state, { get(target, key) { step('get:' + String(key)); return target[key]; }, set(target, key, value) { step('set:' + String(key), value); target[key] = value; return true; } });
    const dispose = factory({ ...disposal, managerState, stopMainTopmostGuard() { step('guard'); }, clearMainInteractiveLayerWarmupTimers() { step('warmup'); },
      clearPostDragInputProxyIdleDestroyTimer() { step('idle'); }, hidePostDragInputProxy(reason: string, force: boolean) { step('hide', reason, force); state.postDragInputProxyWindow = null; }, clearTimeout(timer: any) { step('clear', timer); } });
    assert.deepEqual(calls, []); let caught; try { assert.equal(dispose(), undefined); } catch (failure) { caught = failure; }
    assert.equal(caught, failure === 'none' ? undefined : error); assert.ok(!calls.some((call: any) => call[0] === 'destroy-proxy'), 'Read proxy after hide replaces it');
    return { failure, calls, ready: state.mainWindowRendererReadyFallbackTimer, refresh: state.settingsWindowDisplayRefreshTimer, trayCleared: state.tray === null };
  });
}
const errors = stateErrors(disposal[name]); if (original) assert.deepEqual(errors, stateErrors(original));
const digest = hash(JSON.stringify({ matrix, errors })); assert.equal(digest, 'f17f37344f293aabab7f31bd4951fb4fddd25a351df18617f580bac5c747ab69');
const rootTree = parse(rootText), bindings: ts.VariableDeclaration[] = [];
function inspect(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.initializer && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(rootTree) === name) bindings.push(node);
  ts.forEachChild(node, inspect);
}
inspect(rootTree); assert.equal(bindings.length, 1); assert.equal(bindings[0].name.getText(rootTree), 'dispose');
const options = ((bindings[0].initializer as ts.CallExpression).arguments[0] as ts.ObjectLiteralExpression).properties;
assert.deepEqual(options.map(node => node.name!.getText(rootTree)), ['managerState', 'stopMainTopmostGuard', 'clearMainInteractiveLayerWarmupTimers', 'clearPostDragInputProxyIdleDestroyTimer', 'hidePostDragInputProxy', 'clearTimeout']);
assert.equal(options.at(-1)!.getText(rootTree), 'clearTimeout: (timer) => clearTimeout(timer)');
console.log(`Disposal assembly passed: ${matrix.length} cleanup + ${errors.length} state error/race cases; calls ${callDigest}; behavior ${digest}${original ? ', original callbacks and remaining root AST' : ''}.`);
