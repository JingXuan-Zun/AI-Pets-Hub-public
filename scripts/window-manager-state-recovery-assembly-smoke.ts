import { expandMainWindowLifecycleSource } from './windowManagerAuxiliaryAssemblySource.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const adapters = require('../electron/windowManager/mainWindowLifecycleStateAdapters.cjs');
const parse = (text: string) => ts.createSourceFile('windowManager.cjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const name = 'createMainWindowStateRecoveryControllers', lower = 'createMainWindowRecoveryControllers';
const moduleTree = parse(fs.readFileSync('electron/windowManager/mainWindowRecoveryControllers.cjs', 'utf8'));
const phase = moduleTree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name) as ts.FunctionDeclaration;
const returned = phase.body!.statements.find(ts.isReturnStatement)!.expression as ts.CallExpression;
const printer = ts.createPrinter({ removeComments: true });
function canonical(node: ts.Node, tree: ts.SourceFile) {
  const transformed = ts.transform(node, [context => {
    function visit(node: ts.Node): ts.VisitResult<ts.Node> {
      if (ts.isPropertyAssignment(node) && ['createWindowForRecovery', 'createWindowForHealth', 'setTimeout', 'clearTimeout'].includes(node.name.getText(tree)) && ts.isArrowFunction(node.initializer)) {
        const key = node.name.getText(tree), expected = key.startsWith('createWindow') ? '() => createWindow()' : key === 'setTimeout' ? '(callback, delay) => setTimeout(callback, delay)' : '(timer) => clearTimeout(timer)';
        assert.equal(node.initializer.getText(tree), expected);
        return ts.factory.createShorthandPropertyAssignment(key);
      }
      return ts.visitEachChild(node, visit, context);
    }
    return node => ts.visitNode(node, visit) as typeof node;
  }]);
  try {
    const text = printer.printNode(ts.EmitHint.Unspecified, transformed.transformed[0], tree);
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, text), result = [];
    for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) result.push([kind, scanner.getTokenText()]);
    return JSON.stringify(result);
  } finally { transformed.dispose(); }
}
const params = (phase.parameters[0].name as ts.ObjectBindingPattern).elements.map(node => node.name.getText(moduleTree));
const compile = (body: string) => new Function('deps', lower, 'createMainWindowReadinessStateAdapter', 'createMainWindowRecoveryStateAdapter', 'const {' + params.join(',') + '}=deps;' + body);
const actual = compile(phase.getText(moduleTree) + ';return ' + name + '(deps);');
const originalBody = `return createMainWindowRecoveryControllers({
  ...createMainWindowReadinessStateAdapter(managerState), logWindowEvent, showMainWindow,
  getIsQuitting: () => managerState.isQuitting, clearMainWindow: () => { managerState.mainWindow = null; },
  hidePostDragInputProxy, createWindowForRecovery, createWindowForHealth,
  ...createMainWindowRecoveryStateAdapter(managerState), setTimeout, clearTimeout,
  MAIN_WINDOW_RENDERER_READY_TIMEOUT_MS, MAIN_WINDOW_RENDERER_STARTUP_RECOVERY_LIMIT, MAIN_WINDOW_RENDERER_HEALTH_TIMEOUT_MS,
});`;
const reference = compile(originalBody);
assert.equal(canonical(returned, moduleTree), canonical((parse(originalBody).statements[0] as ts.ReturnStatement).expression!, parse(originalBody)));
const rootText = expandMainWindowLifecycleSource(fs.readFileSync('electron/windowManager.cjs', 'utf8')), rootTree = parse(rootText);
function binding(tree: ts.SourceFile, target: string) {
  const factory = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'createWindowManager') as ts.FunctionDeclaration;
  return factory.body!.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(d => d.initializer && ts.isCallExpression(d.initializer) && d.initializer.expression.getText(tree) === target)) as ts.VariableStatement;
}
const rootBinding = binding(rootTree, name); assert.ok(rootBinding);
const declaration = rootBinding.declarationList.declarations[0];
assert.deepEqual((declaration.name as ts.ObjectBindingPattern).elements.map(n => n.name.getText(rootTree)), ['showMainWindowWhenReady', 'markMainWindowReadyToShow', 'recoverMainWindowRenderer', 'scheduleMainWindowRendererReadyFallback', 'showOrRecoverMainWindow']);
const options = ((declaration.initializer as ts.CallExpression).arguments[0] as ts.ObjectLiteralExpression).properties;
assert.deepEqual(options.map(n => n.name!.getText(rootTree)), params);
for (const property of options) canonical(property, rootTree);
if (process.argv[2]) {
  const oldTree = parse(fs.readFileSync(process.argv[2], 'utf8')), oldBinding = binding(oldTree, lower);
  assert.equal(canonical((oldBinding.declarationList.declarations[0].initializer as ts.CallExpression), oldTree), canonical(returned, moduleTree));
  function remaining(tree: ts.SourceFile) {
    const text = tree.text, statement = binding(tree, tree === oldTree ? lower : name);
    const next = parse(text.slice(0, statement.getStart(tree)) + text.slice(statement.end));
    const factory = next.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'createWindowManager')!;
    return canonical(factory, next);
  }
  assert.equal(remaining(oldTree), remaining(rootTree), 'Remaining root composition unchanged');
}
const callbacks = ['getMainWindow', 'getCanShow', 'getRendererReadyToShow', 'setRendererReadyToShow', 'resetStartupRecoveryCount', 'getReadyFallbackTimer', 'setReadyFallbackTimer', 'getIsQuitting', 'clearMainWindow', 'getRendererRecoveryInProgress', 'setRendererRecoveryInProgress', 'markMainWindowCanShow', 'getStartupRecoveryCount', 'incrementStartupRecoveryCount'];
function exercise(assemble: Function) {
  const outcomes = [];
  for (const callback of callbacks) for (const mode of ['undefined', 'null', 'false', 'number', 'string', 'object', 'symbol', 'read-error', 'write-error', 'coercion-error']) {
    const marker = {}, writes: unknown[] = [], reads: unknown[] = [], error = new Error(mode);
    const value: any = mode === 'undefined' ? undefined : mode === 'null' ? null : mode === 'false' ? false : mode === 'number' ? 2 : mode === 'string' ? '2' : mode === 'symbol' ? Symbol('value') : mode === 'coercion-error' ? { valueOf() { throw error; } } : marker;
    const state = new Proxy({}, { get(_target, key) { reads.push(String(key)); if (mode === 'read-error') throw error; return value; }, set(_target, key, value) { writes.push([String(key), value === marker ? 'marker' : value]); if (mode === 'write-error') throw error; return true; } });
    const deps: any = Object.fromEntries(params.map(key => [key, () => marker])); deps.managerState = state;
    let captured: any; const result = assemble(deps, (input: any) => { captured = input; return marker; }, adapters.createMainWindowReadinessStateAdapter, adapters.createMainWindowRecoveryStateAdapter);
    assert.equal(result, marker); assert.deepEqual(reads, []); assert.deepEqual(writes, []);
    for (const key of params.filter(key => key !== 'managerState')) assert.equal(captured[key], deps[key], key);
    let returned: any, caught: any; try { returned = captured[callback](marker); } catch (e) { caught = e; }
    outcomes.push({ callback, mode, reads, writes: writes.map(([key, value]: any) => [key, typeof value === 'symbol' ? 'symbol' : value]), returned: returned === marker ? 'marker' : returned === value && mode === 'coercion-error' ? 'coercion-value' : typeof returned === 'symbol' ? 'symbol' : returned, caught: caught === error ? 'original-error' : caught?.constructor.name });
  }
  return outcomes;
}
const outcomes = exercise(actual); assert.deepEqual(outcomes, exercise(reference));
for (const assemble of [actual, reference]) {
  const error = new Error('lower constructor'); assert.throws(() => assemble({ managerState: {} }, () => { throw error; }, adapters.createMainWindowReadinessStateAdapter, adapters.createMainWindowRecoveryStateAdapter), e => e === error);
  const left: any = { mainWindow: {} }, right: any = { mainWindow: {} };
  const capture = (state: any) => assemble({ managerState: state }, (input: any) => input, adapters.createMainWindowReadinessStateAdapter, adapters.createMainWindowRecoveryStateAdapter);
  const first = capture(left), second = capture(right); first.clearMainWindow(); assert.equal(left.mainWindow, null); assert.equal(second.getMainWindow(), right.mainWindow);
  right.mainWindow = {}; assert.equal(second.getMainWindow(), right.mainWindow); left.isQuitting = true; assert.equal(first.getIsQuitting(), true);
}
console.log(`State recovery assembly passed: ${outcomes.length} state/error cases, forwarding, return/error identity, independent live owners, root deferred callbacks${process.argv[2] ? ', original call and remaining root AST' : ''}.`);
