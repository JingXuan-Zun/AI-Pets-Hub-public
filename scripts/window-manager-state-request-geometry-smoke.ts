import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { exercisePointerRequests } from './window-manager-pointer-request-smoke.ts';
import { exerciseInteractiveGeometry } from './window-manager-interactive-geometry-smoke.ts';
const require = createRequire(import.meta.url);
const parse = (text: string) => ts.createSourceFile('windowManager.cjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const printer = ts.createPrinter({ removeComments: true });
function tokens(node: ts.Node, tree: ts.SourceFile) {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, printer.printNode(ts.EmitHint.Unspecified, node, tree)), result = [];
  for (let k = scanner.scan(); k !== ts.SyntaxKind.EndOfFileToken; k = scanner.scan()) result.push([k, scanner.getTokenText()]);
  return JSON.stringify(result);
}
const specs = [
  { file: 'mainWindowInteractiveGeometry', name: 'createMainWindowStateInteractiveGeometry', lower: 'createMainWindowInteractiveGeometry', bindings: ['isFullWindowInteractiveShape', 'createFullWindowInteractiveRegion'],
    reference: 'return createMainWindowInteractiveGeometry({ getMainWindow: () => managerState.mainWindow, });', callbacks: ['getMainWindow'] },
  { file: 'pointerPassthroughRequests', name: 'createWindowStatePointerPassthroughRequester', lower: 'createPointerPassthroughRequester', bindings: ['setWindowPointerPassthrough'],
    reference: `return createPointerPassthroughRequester({
      nativeShapeState, setRequestedPointerPassthrough: (ignore) => { managerState.requestedPointerPassthrough = ignore; },
      getMainWindow: () => managerState.mainWindow, getPetDragNativeShapeActive: () => managerState.petDragNativeShapeActive,
      isPetDragFullWindowShapeRetained, pointerDiagnosticsEnabled, logWindowEvent, applyPointerPassthroughState,
    });`, callbacks: ['setRequestedPointerPassthrough', 'getMainWindow', 'getPetDragNativeShapeActive'] },
];
const rootTree = parse(fs.readFileSync('electron/windowManager.cjs', 'utf8'));
function binding(tree: ts.SourceFile, target: string) {
  const owner = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'createWindowManager') as ts.FunctionDeclaration;
  const found = owner.body!.statements.filter(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.initializer && ts.isCallExpression(d.initializer) && d.initializer.expression.getText(tree) === target));
  assert.equal(found.length, 1); return found[0] as ts.VariableStatement;
}
let stateCases = 0;
const assemblies: Record<string, { actual: Function; reference: Function; production: any }> = {};
for (const spec of specs) {
  const path = 'electron/windowManager/' + spec.file + '.cjs', tree = parse(fs.readFileSync(path, 'utf8'));
  const phase = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === spec.name) as ts.FunctionDeclaration;
  const returned = phase.body!.statements.find(ts.isReturnStatement)!.expression!;
  const refTree = parse(spec.reference);
  assert.equal(tokens(returned, tree), tokens((refTree.statements[0] as ts.ReturnStatement).expression!, refTree), 'Original call AST: ' + spec.name);
  const params = (phase.parameters[0].name as ts.ObjectBindingPattern).elements.map(n => n.name.getText(tree));
  const compile = (body: string) => new Function('deps', spec.lower, 'const {' + params.join(',') + '}=deps;' + body);
  const actual = compile(phase.getText(tree) + ';return ' + spec.name + '(deps);'), reference = compile(spec.reference);
  assemblies[spec.file] = { actual, reference, production: require('../' + path) };
  const declaration = binding(rootTree, spec.name).declarationList.declarations[0];
  assert.deepEqual(ts.isObjectBindingPattern(declaration.name) ? declaration.name.elements.map(n => n.name.getText(rootTree)) : [declaration.name.getText(rootTree)], spec.bindings);
  const options = ((declaration.initializer as ts.CallExpression).arguments[0] as ts.ObjectLiteralExpression).properties;
  assert.deepEqual(options.map(n => n.name!.getText(rootTree)), params);
  for (const n of options) assert.ok(ts.isShorthandPropertyAssignment(n), 'Exact root dependency references');
  if (process.argv[2]) {
    const oldTree = parse(fs.readFileSync(process.argv[2], 'utf8'));
    assert.equal(tokens(binding(oldTree, spec.lower).declarationList.declarations[0].initializer!, oldTree), tokens(returned, tree));
  }
  function exercise(assemble: Function) {
    const outcomes = [];
    for (const callback of spec.callbacks) for (const mode of ['undefined', 'null', 'false', 'number', 'string', 'object', 'symbol', 'read-error', 'write-error']) {
      const marker = {}, error = new Error(mode), reads: string[] = [], writes: unknown[] = [];
      const value: any = mode === 'undefined' ? undefined : mode === 'null' ? null : mode === 'false' ? false : mode === 'number' ? 2 : mode === 'string' ? '2' : mode === 'symbol' ? Symbol('value') : marker;
      const state = new Proxy({}, { get(_t, key) { reads.push(String(key)); if (mode === 'read-error') throw error; return value; }, set(_t, key, value) { writes.push([String(key), value === marker ? 'marker' : value]); if (mode === 'write-error') throw error; return true; } });
      const deps: any = Object.fromEntries(params.map(key => [key, () => marker])); deps.managerState = state; let captured: any;
      assert.equal(assemble(deps, (input: any) => { captured = input; return marker; }), marker); assert.deepEqual(reads, []); assert.deepEqual(writes, []);
      for (const key of params.filter(key => key !== 'managerState')) assert.equal(captured[key], deps[key]);
      let returned: any, caught: any; try { returned = captured[callback](marker); } catch (e) { caught = e; }
      outcomes.push({ callback, mode, reads, writes, returned: returned === marker ? 'marker' : typeof returned === 'symbol' ? 'symbol' : returned, caught: caught === error ? 'original-error' : caught?.constructor.name });
    }
    return outcomes;
  }
  const outcomes = exercise(actual); assert.deepEqual(outcomes, exercise(reference)); stateCases += outcomes.length;
  for (const assemble of [actual, reference]) {
    const error = new Error('constructor'); assert.throws(() => assemble({ managerState: {} }, () => { throw error; }), e => e === error);
    const left: any = {}, right: any = {}, capture = (state: any) => assemble({ managerState: state }, (input: any) => input);
    const first = capture(left), second = capture(right), win = {}; left.mainWindow = win; assert.equal(first.getMainWindow(), win); assert.equal(second.getMainWindow(), undefined);
    right.mainWindow = {}; assert.equal(second.getMainWindow(), right.mainWindow);
    if (first.setRequestedPointerPassthrough) { first.setRequestedPointerPassthrough(true); assert.equal(left.requestedPointerPassthrough, true); assert.equal(right.requestedPointerPassthrough, undefined); left.petDragNativeShapeActive = true; assert.equal(first.getPetDragNativeShapeActive(), true); }
  }
}
if (process.argv[2]) {
  function remaining(tree: ts.SourceFile) {
    const owner = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'createWindowManager')!;
    const transformed = ts.transform(owner, [context => {
      function visit(node: ts.Node): ts.VisitResult<ts.Node> {
        if (ts.isVariableStatement(node) && node.declarationList.declarations.some(d => d.initializer && ts.isCallExpression(d.initializer) && specs.some(s => [s.name, s.lower].includes(d.initializer!.expression.getText(tree))))) return undefined;
        return ts.visitEachChild(node, visit, context);
      }
      return node => ts.visitNode(node, visit) as typeof node;
    }]);
    try { return tokens(transformed.transformed[0], tree); } finally { transformed.dispose(); }
  }
  assert.equal(remaining(rootTree), remaining(parse(fs.readFileSync(process.argv[2], 'utf8'))));
}
function executeGeometry(assemble: Function) {
  return exerciseInteractiveGeometry((deps: any) => {
    let accesses = 0;
    const managerState = { get mainWindow() { accesses++; return deps.getMainWindow(); } };
    const api = assemble({ ...deps, managerState }); assert.equal(accesses, 0); return api;
  });
}
function executeRequests(assemble: Function) {
  return exercisePointerRequests((deps: any) => {
    let accesses = 0;
    const managerState = { get mainWindow() { accesses++; return deps.getMainWindow(); }, get petDragNativeShapeActive() { accesses++; return deps.getPetDragNativeShapeActive(); }, set requestedPointerPassthrough(value: any) { accesses++; deps.setRequestedPointerPassthrough(value); } };
    const api = assemble({ ...deps, managerState }); assert.equal(accesses, 0); return api;
  });
}
const geometry = assemblies.mainWindowInteractiveGeometry, requests = assemblies.pointerPassthroughRequests;
const geometries = executeGeometry((deps: any) => geometry.actual(deps, geometry.production.createMainWindowInteractiveGeometry));
assert.deepEqual(geometries, executeGeometry((deps: any) => geometry.reference(deps, geometry.production.createMainWindowInteractiveGeometry)));
assert.deepEqual(geometries, executeGeometry(geometry.production.createMainWindowStateInteractiveGeometry));
const pointers = executeRequests((deps: any) => requests.actual(deps, requests.production.createPointerPassthroughRequester));
assert.deepEqual(pointers, executeRequests((deps: any) => requests.reference(deps, requests.production.createPointerPassthroughRequester)));
assert.deepEqual(pointers, executeRequests(requests.production.createWindowStatePointerPassthroughRequester));
console.log(`State request/geometry assembly passed: ${stateCases} state/error cases, return/error identity and independent owners; ${geometries.length} geometry + ${pointers.length} request cases${process.argv[2] ? ', original calls and remaining root AST' : ''}.`);
