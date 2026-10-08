import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { exerciseProxyIdleLifecycle } from './window-manager-proxy-lifecycle-assembly-smoke.ts';
import { exerciseProxyCreation } from './window-manager-proxy-creation-smoke.ts';
import { exerciseProxyRegionApplication } from './window-manager-proxy-region-application-smoke.ts';
const require = createRequire(import.meta.url);
const production = require('../electron/windowManager/postDragInputProxyLifecycle.cjs');
const adapter = require('../electron/windowManager/windowInteractionStateAdapters.cjs').createPostDragInputProxyStateAdapter;
const name = 'createPostDragInputProxyStateLifecycle', lower = 'createPostDragInputProxyLifecycle';
const parse = (text: string) => ts.createSourceFile('windowManager.cjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const moduleTree = parse(fs.readFileSync('electron/windowManager/postDragInputProxyLifecycle.cjs', 'utf8'));
const phase = moduleTree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name) as ts.FunctionDeclaration;
const variables = phase.body!.statements.filter(ts.isVariableStatement);
const params = (phase.parameters[0].name as ts.ObjectBindingPattern).elements.map(n => n.name.getText(moduleTree));
const printer = ts.createPrinter({ removeComments: true });
function canonical(node: ts.Node, tree: ts.SourceFile) {
  const transformed = ts.transform(node, [context => {
    function visit(node: ts.Node): ts.VisitResult<ts.Node> {
      if (ts.isPropertyAssignment(node)) {
        const key = node.name.getText(tree);
        if (key === 'baseDirectory' && node.initializer.getText(tree) === '__dirname') return ts.factory.createShorthandPropertyAssignment(key);
        if (['setTimeout', 'clearTimeout'].includes(key) && ts.isArrowFunction(node.initializer)) {
          assert.equal(node.initializer.getText(tree), key === 'setTimeout' ? '(callback, delay) => setTimeout(callback, delay)' : '(timer) => clearTimeout(timer)');
          return ts.factory.createShorthandPropertyAssignment(key);
        }
      }
      return ts.visitEachChild(node, visit, context);
    }
    return node => ts.visitNode(node, visit) as typeof node;
  }]);
  try {
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, printer.printNode(ts.EmitHint.Unspecified, transformed.transformed[0], tree)), result = [];
    for (let k = scanner.scan(); k !== ts.SyntaxKind.EndOfFileToken; k = scanner.scan()) result.push([k, scanner.getTokenText()]);
    return JSON.stringify(result);
  } finally { transformed.dispose(); }
}
const originalBody = "const postDragInputProxyState = createPostDragInputProxyStateAdapter(managerState);\nconst controllers = createPostDragInputProxyLifecycle({\nproxyState: postDragInputProxyState,\ngetMainWindow: () => managerState.mainWindow,\nBrowserWindow,\npath,\nbaseDirectory,\nsessionPartition,\ndisableDwmSystemBorderForWindow,\nkeepWindowOnTop,\nlogWindowEvent,\npointerDiagnosticsEnabled,\ncreateInteractiveRegionsSignature,\nsummarizeInteractiveRegion,\nTOPMOST_WINDOW_LEVEL,\nPOST_DRAG_INPUT_PROXY_TOPMOST_RELATIVE_LEVEL,\nPOST_DRAG_INPUT_PROXY_IDLE_DESTROY_MS,\nsetTimeout,\nclearTimeout,\n});\nreturn { postDragInputProxyState, ...controllers };";
const referenceTree = parse(originalBody);
assert.equal(canonical(phase.body!, moduleTree), canonical(ts.factory.createBlock([...referenceTree.statements], true), referenceTree), 'Original adapter and lifecycle assembly');
const compile = (body: string) => new Function('deps', lower, 'createPostDragInputProxyStateAdapter', 'const {' + params.join(',') + '}=deps;' + body);
const actual = compile(phase.getText(moduleTree) + ';return ' + name + '(deps);'), reference = compile(originalBody);
const rootText = fs.readFileSync('electron/windowManager.cjs', 'utf8'), rootTree = parse(rootText);
function binding(tree: ts.SourceFile, target: string) {
  const owner = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'createWindowManager') as ts.FunctionDeclaration;
  return owner.body!.statements.find(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.initializer && ts.isCallExpression(d.initializer) && d.initializer.expression.getText(tree) === target)) as ts.VariableStatement;
}
const rootBinding = binding(rootTree, name); assert.ok(rootBinding);
const names = ['postDragInputProxyState', 'clearPostDragInputProxyIdleDestroyTimer', 'hidePostDragInputProxy', 'applyPostDragInputProxyRegions', 'ensurePostDragInputProxyWindow'];
assert.deepEqual((rootBinding.declarationList.declarations[0].name as ts.ObjectBindingPattern).elements.map(n => n.name.getText(rootTree)), names);
const options = ((rootBinding.declarationList.declarations[0].initializer as ts.CallExpression).arguments[0] as ts.ObjectLiteralExpression).properties;
assert.deepEqual(options.map(n => n.name!.getText(rootTree)), params); for (const option of options) canonical(option, rootTree);
if (process.argv[2]) {
  const oldTree = parse(fs.readFileSync(process.argv[2], 'utf8')), oldBinding = binding(oldTree, lower);
  assert.equal(canonical(oldBinding.declarationList.declarations[0].initializer!, oldTree), canonical(variables[1].declarationList.declarations[0].initializer!, moduleTree));
  function remaining(tree: ts.SourceFile) {
    const owner = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'createWindowManager')!;
    const transformed = ts.transform(owner, [context => {
      function visit(node: ts.Node): ts.VisitResult<ts.Node> {
        if (ts.isVariableStatement(node) && node.declarationList.declarations.some(d => d.name.getText(tree) === 'postDragInputProxyState' || (d.initializer && ts.isCallExpression(d.initializer) && [name, lower].includes(d.initializer.expression.getText(tree))))) return undefined;
        return ts.visitEachChild(node, visit, context);
      }
      return node => ts.visitNode(node, visit) as typeof node;
    }]);
    try { return canonical(transformed.transformed[0], tree); } finally { transformed.dispose(); }
  }
  assert.equal(remaining(oldTree), remaining(rootTree), 'Remaining root composition');
}
function exercise(assemble: Function) {
  const callbacks = ['getMainWindow', ...Object.keys(adapter({}))], outcomes = [];
  for (const callback of callbacks) for (const mode of ['undefined', 'null', 'false', 'number', 'string', 'object', 'symbol', 'read-error', 'write-error']) {
    const marker = {}, error = new Error(mode), reads: string[] = [], writes: unknown[] = [];
    const value: any = mode === 'undefined' ? undefined : mode === 'null' ? null : mode === 'false' ? false : mode === 'number' ? 2 : mode === 'string' ? '2' : mode === 'symbol' ? Symbol('value') : marker;
    const state = new Proxy({}, { get(_t, key) { reads.push(String(key)); if (mode === 'read-error') throw error; return value; }, set(_t, key, value) { writes.push([String(key), value === marker ? 'marker' : value]); if (mode === 'write-error') throw error; return true; } });
    const deps: any = Object.fromEntries(params.map(key => [key, () => marker])); deps.managerState = state;
    const outputs = Object.fromEntries(names.slice(1).map(key => [key, () => marker])); let captured: any;
    const api = assemble(deps, (input: any) => { captured = input; return outputs; }, adapter);
    assert.deepEqual(reads, []); assert.deepEqual(writes, []); assert.equal(api.postDragInputProxyState, captured.proxyState);
    for (const key of params.filter(key => key !== 'managerState')) assert.equal(captured[key], deps[key], key);
    for (const key of names.slice(1)) assert.equal(api[key], outputs[key]);
    let returned: any, caught: any; try { returned = (callback === 'getMainWindow' ? captured.getMainWindow : api.postDragInputProxyState[callback])(marker); } catch (e) { caught = e; }
    outcomes.push({ callback, mode, reads, writes, returned: returned === marker ? 'marker' : typeof returned === 'symbol' ? 'symbol' : returned, caught: caught === error ? 'original-error' : caught?.constructor.name });
  }
  return outcomes;
}
const outcomes = exercise(actual); assert.deepEqual(outcomes, exercise(reference));
for (const assemble of [actual, reference]) {
  for (const failure of ['none', 'adapter', 'lifecycle']) {
    const calls: string[] = [], error = new Error(failure); let caught: any;
    try { assemble({ managerState: {} }, () => { calls.push('lifecycle'); if (failure === 'lifecycle') throw error; return {}; }, (state: any) => { calls.push('adapter'); if (failure === 'adapter') throw error; return adapter(state); }); } catch (e) { caught = e; }
    assert.equal(caught, failure === 'none' ? undefined : error); assert.deepEqual(calls, failure === 'adapter' ? ['adapter'] : ['adapter', 'lifecycle']);
  }
  const left: any = {}, right: any = {}, build = (state: any) => assemble({ managerState: state }, () => ({}), adapter).postDragInputProxyState;
  const first = build(left), second = build(right), win = {}; first.setWindow(win); assert.equal(first.getWindow(), win); assert.equal(second.getWindow(), undefined);
  right.postDragInputProxyWindow = win; assert.equal(second.getWindow(), win); first.setPointerActive(true); assert.equal(left.postDragInputProxyPointerActive, true); assert.equal(right.postDragInputProxyPointerActive, undefined);
}
function execution(assemble: Function) {
  const fields: Record<string, string> = { Window: 'postDragInputProxyWindow', Ready: 'postDragInputProxyReady', PointerActive: 'postDragInputProxyPointerActive', Regions: 'postDragInputProxyRegions', PendingRegions: 'postDragInputProxyPendingRegions', ShapeSignature: 'postDragInputProxyShapeSignature', IdleDestroyTimer: 'postDragInputProxyIdleDestroyTimer' };
  const build = (deps: any) => {
    const getters = Object.fromEntries(Object.entries(fields).map(([suffix, field]) => [field, 'get' + suffix]));
    const setters = Object.fromEntries(Object.entries(fields).map(([suffix, field]) => [field, 'set' + suffix])); let accesses = 0;
    const state = new Proxy({}, { get(_t, key) { accesses++; if (key === 'mainWindow') return deps.getMainWindow(); return deps.proxyState[getters[String(key)]](); }, set(_t, key, value) { accesses++; deps.proxyState[setters[String(key)]](value); return true; } });
    const api = assemble({ ...deps, managerState: state }); assert.equal(accesses, 0); return Object.fromEntries(names.slice(1).map(key => [key, api[key]]));
  };
  return { idle: exerciseProxyIdleLifecycle(build), creation: exerciseProxyCreation(build), regions: exerciseProxyRegionApplication(build) };
}
const executions = execution((deps: any) => actual(deps, production.createPostDragInputProxyLifecycle, adapter));
assert.deepEqual(executions, execution((deps: any) => reference(deps, production.createPostDragInputProxyLifecycle, adapter)));
assert.deepEqual(executions, execution(production.createPostDragInputProxyStateLifecycle));
console.log(`Proxy state lifecycle assembly passed: ${outcomes.length} state/error cases; adapter/lifecycle order, shared state and return identity; ${executions.idle.length} idle + ${executions.creation.length} creation + ${executions.regions.length} region cases${process.argv[2] ? ', original call and remaining root AST' : ''}.`);
