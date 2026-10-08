import { expandWindowPresentationTraySource } from './windowManagerAuxiliaryAssemblySource.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { exerciseWarmupTimers } from './window-manager-warmup-timers-smoke.ts';
import { exerciseMainPresentation } from './window-manager-main-presentation-smoke.ts';

const require = createRequire(import.meta.url);
const presentation = require('../electron/windowManager/mainWindowPresentation.cjs');
const warmup = require('../electron/windowManager/mainInteractiveWarmupTimers.cjs').createMainInteractiveWarmupTimers;
const adapter = require('../electron/windowManager/mainWindowLifecycleStateAdapters.cjs').createMainInteractiveWarmupTimerStateAdapter;
const name = 'createMainWindowPresentationControllers', calls = ['createMainInteractiveWarmupTimers', 'createMainWindowPresenter'];
const names = ['clearMainInteractiveLayerWarmupTimers', 'scheduleMainInteractiveLayerWarmup', 'showMainWindow'];
const parse = (text: string) => ts.createSourceFile('windowManager.cjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const hash = (text: string) => crypto.createHash('sha256').update(text).digest('hex');
const printer = ts.createPrinter({ removeComments: true });
function tokens(node: ts.Node, tree: ts.SourceFile) {
  const transformed = ts.transform(node, [context => {
    function visit(node: ts.Node): ts.VisitResult<ts.Node> {
      if (ts.isPropertyAssignment(node) && ['getPlatform', 'setTimeout', 'clearTimeout'].includes(node.name.getText(tree)) && ts.isArrowFunction(node.initializer)) {
        const key = node.name.getText(tree), expected = key === 'getPlatform' ? '() => process.platform' : key === 'setTimeout' ? '(callback, delay) => setTimeout(callback, delay)' : '(timer) => clearTimeout(timer)';
        assert.equal(node.initializer.getText(tree), expected); return ts.factory.createShorthandPropertyAssignment(key);
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
const rootText = expandWindowPresentationTraySource(fs.readFileSync('electron/windowManager.cjs', 'utf8'));
const tree = parse(fs.readFileSync('electron/windowManager/mainWindowPresentation.cjs', 'utf8'));
const factory = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name) as ts.FunctionDeclaration;
const moved = factory.body!.statements.filter(ts.isVariableStatement);
const callDigest = hash(JSON.stringify(moved.map(node => tokens(node, tree)))); assert.equal(callDigest, '62491a96ed7ad2fab9d44840422e02af9e1f906609f4ce58dc4f76c04b3919ab');
const controlled = new Function('deps', ...calls, 'createMainInteractiveWarmupTimerStateAdapter', factory.getText(tree) + ';return ' + name + '(deps);');
let original: Function | undefined;
if (process.argv[2]) {
  const oldTree = parse(fs.readFileSync(process.argv[2], 'utf8'));
  const oldFactory = oldTree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'createWindowManager') as ts.FunctionDeclaration;
  const declarations = oldFactory.body!.statements.filter(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => declaration.initializer && ts.isCallExpression(declaration.initializer) && calls.includes(declaration.initializer.expression.getText(oldTree))));
  assert.equal(callDigest, hash(JSON.stringify(declarations.map(node => tokens(node, oldTree)))));
  const parameters = (factory.parameters[0].name as ts.ObjectBindingPattern).elements.map(node => node.name.getText(tree));
  const compile = new Function('deps', ...calls, 'createMainInteractiveWarmupTimerStateAdapter', 'process', 'const {' + parameters.join(',') + '}=deps;'
    + declarations.map(node => node.getText(oldTree)).join('\n') + ';return {' + names.join(',') + '};');
  original = (deps: any, ...constructors: any[]) => compile(deps, ...constructors, { get platform() { return deps.getPlatform(); } });
  function canonical(text: string) {
    const tree = parse(text), factory = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'createWindowManager')!;
    const transformed = ts.transform(factory, [context => {
      function visit(node: ts.Node): ts.VisitResult<ts.Node> {
        if (ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => declaration.initializer && ts.isCallExpression(declaration.initializer)
          && [...calls, name].includes(declaration.initializer.expression.getText(tree)))) return undefined;
        return ts.visitEachChild(node, visit, context);
      }
      return node => ts.visitNode(node, visit) as typeof node;
    }]);
    try { return hash(tokens(transformed.transformed[0], tree)); } finally { transformed.dispose(); }
  }
  assert.equal(canonical(rootText), canonical(oldTree.text), 'Remaining root composition, API and order');
}
function stateFor(deps: any, getters: Record<string, string>, setters: Record<string, string>) {
  let accesses = 0;
  return { get accesses() { return accesses; }, state: new Proxy({}, {
    get(_target, key) { accesses++; assert.ok(typeof key === 'string' && key in getters); return deps[getters[key as string]](); },
    set(_target, key, value) { accesses++; assert.ok(typeof key === 'string' && key in setters); deps[setters[key as string]](value); return true; },
  }) };
}
function exercise(assemble: Function) {
  const warm = exerciseWarmupTimers((deps: any) => {
    const owner = stateFor(deps, { mainInteractiveLayerWarmupCompleted: 'getWarmupCompleted', mainInteractiveLayerWarmupTimer: 'getWarmupTimer', mainInteractiveLayerWarmupRestoreTimer: 'getRestoreTimer' },
      { mainInteractiveLayerWarmupTimer: 'setWarmupTimer', mainInteractiveLayerWarmupRestoreTimer: 'setRestoreTimer' });
    const api = assemble({ ...deps, managerState: owner.state }, warmup, presentation.createMainWindowPresenter, adapter);
    assert.equal(owner.accesses, 0); return { clearMainInteractiveLayerWarmupTimers: api.clearMainInteractiveLayerWarmupTimers, scheduleMainInteractiveLayerWarmup: api.scheduleMainInteractiveLayerWarmup };
  });
  const show = exerciseMainPresentation((deps: any) => {
    const owner = stateFor(deps, { mainWindow: 'getMainWindow', mainWindowRendererReadyFallbackTimer: 'getReadyFallbackTimer' }, { mainWindowRendererReadyFallbackTimer: 'setReadyFallbackTimer' });
    const api = assemble({ ...deps, managerState: owner.state }, () => ({ clearMainInteractiveLayerWarmupTimers() {}, scheduleMainInteractiveLayerWarmup: deps.scheduleMainInteractiveLayerWarmup }), presentation.createMainWindowPresenter, adapter);
    assert.equal(owner.accesses, 0); return api.showMainWindow;
  });
  return { warm, show };
}
const outcomes = exercise(controlled); if (original) assert.deepEqual(outcomes, exercise(original));
assert.deepEqual(outcomes, { warm: exerciseWarmupTimers(), show: exerciseMainPresentation() });
const realWarm = exerciseWarmupTimers((deps: any) => {
  const owner = stateFor(deps, { mainInteractiveLayerWarmupCompleted: 'getWarmupCompleted', mainInteractiveLayerWarmupTimer: 'getWarmupTimer', mainInteractiveLayerWarmupRestoreTimer: 'getRestoreTimer' },
    { mainInteractiveLayerWarmupTimer: 'setWarmupTimer', mainInteractiveLayerWarmupRestoreTimer: 'setRestoreTimer' });
  const api = presentation[name]({ ...deps, managerState: owner.state }); assert.equal(owner.accesses, 0);
  return { clearMainInteractiveLayerWarmupTimers: api.clearMainInteractiveLayerWarmupTimers, scheduleMainInteractiveLayerWarmup: api.scheduleMainInteractiveLayerWarmup };
});
assert.deepEqual(realWarm, outcomes.warm);
for (const failure of ['none', ...calls]) {
  const order: string[] = [], error = new Error('presentation constructor'), outputs = Object.fromEntries(names.map(key => [key, () => key]));
  const constructors = calls.map((call, index) => () => { order.push(call); if (failure === call) throw error; return index ? outputs.showMainWindow : { clearMainInteractiveLayerWarmupTimers: outputs.clearMainInteractiveLayerWarmupTimers, scheduleMainInteractiveLayerWarmup: outputs.scheduleMainInteractiveLayerWarmup }; });
  let caught, result: any; try { result = controlled({ managerState: {} }, ...constructors, adapter); } catch (failure) { caught = failure; }
  assert.equal(caught, failure === 'none' ? undefined : error); assert.deepEqual(order, failure === calls[0] ? [calls[0]] : calls);
  if (result) { assert.deepEqual(Object.keys(result), names); for (const key of names) assert.equal(result[key], outputs[key]); }
}
const digest = hash(JSON.stringify(outcomes)); assert.equal(digest, 'aab3e274e45a53f6e5d4a4efeaaab0c633894fd9e0ead4531b7d851279ae9002');
const rootTree = parse(rootText), bindings: ts.VariableDeclaration[] = [];
function inspect(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.initializer && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(rootTree) === name) bindings.push(node);
  ts.forEachChild(node, inspect);
}
inspect(rootTree); assert.equal(bindings.length, 1); assert.deepEqual((bindings[0].name as ts.ObjectBindingPattern).elements.map(node => node.name.getText(rootTree)), names);
const options = ((bindings[0].initializer as ts.CallExpression).arguments[0] as ts.ObjectLiteralExpression).properties;
assert.deepEqual(options.map(node => node.name!.getText(rootTree)), (factory.parameters[0].name as ts.ObjectBindingPattern).elements.map(node => node.name.getText(tree)));
for (const property of options) tokens(property, rootTree);
console.log(`Presentation assembly passed: ${outcomes.warm.length} warmup + ${outcomes.show.length} presentation + 3 constructor cases; calls ${callDigest}; behavior ${digest}${original ? ', original calls and remaining root AST' : ''}.`);
