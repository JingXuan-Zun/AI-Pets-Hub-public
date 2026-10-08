import { expandMainWindowLifecycleSource } from './windowManagerAuxiliaryAssemblySource.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const parse = (text: string) => ts.createSourceFile('windowManager.cjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const name = 'createMainWindowStateCreationControllers', lower = 'createMainWindowCreationControllers';
const moduleTree = parse(fs.readFileSync('electron/windowManager/mainWindowCreationControllers.cjs', 'utf8'));
const phase = moduleTree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name) as ts.FunctionDeclaration;
const returned = phase.body!.statements.find(ts.isReturnStatement)!.expression as ts.CallExpression;
const printer = ts.createPrinter({ removeComments: true });
function canonical(node: ts.Node, tree: ts.SourceFile) {
  const transformed = ts.transform(node, [context => {
    function visit(node: ts.Node): ts.VisitResult<ts.Node> {
      if (ts.isPropertyAssignment(node) && node.name.getText(tree) === 'baseDirectory' && node.initializer.getText(tree) === '__dirname') return ts.factory.createShorthandPropertyAssignment('baseDirectory');
      if (ts.isPropertyAssignment(node) && node.name.getText(tree) === 'getOpenDevTools' && ts.isArrowFunction(node.initializer)) { assert.equal(node.initializer.getText(tree), '() => process.env.DESKTOP_PET_OPEN_DEVTOOLS'); return ts.factory.createShorthandPropertyAssignment('getOpenDevTools'); }

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
const compile = (body: string) => new Function('deps', lower, 'const {' + params.join(',') + '}=deps;' + body);
const actual = compile(phase.getText(moduleTree) + ';return ' + name + '(deps);');
const originalBody = "return createMainWindowCreationControllers({\ngetMainWindow: () => managerState.mainWindow,\ngetIsQuitting: () => managerState.isQuitting,\npointerDiagnosticsEnabled,\nhideMainWindow,\nlogWindowEvent,\napplyPostDragInputProxyRegions,\nscheduleWindowStackOnTop,\nmarkMainWindowCanShow: () => { managerState.mainWindowCanShow = true; },\ngetRendererRecoveryInProgress: () => managerState.mainWindowRendererRecoveryInProgress,\nshowMainWindowWhenReady,\nopenExternalSafely,\nshell,\nnotifySettingsWindowState,\nnotifyChatWindowState,\nbroadcastSharedState,\ncaptureService,\ngetShellRendererWindows,\nrecoverMainWindowRenderer,\nCOMPACT_WINDOW_BOUNDS,\ngetBrowserWindowIconOptions,\npath,\nbaseDirectory,\nsessionPartition,\n...windowOwnershipState.mainCreation,\nshowOrRecoverMainWindow,\nBrowserWindow,\nattachLoadLogging,\nresizeWindowForSettings,\nstartMainTopmostGuard,\nsetWindowPointerPassthrough,\nUSE_SEPARATE_RENDER_AND_INPUT_WINDOWS,\nensurePostDragInputProxyWindow,\nscheduleMainWindowRendererReadyFallback,\nisDev,\ngetOpenDevTools,\nloadRenderer,\n});";
const reference = compile(originalBody);
assert.equal(canonical(returned, moduleTree), canonical((parse(originalBody).statements[0] as ts.ReturnStatement).expression!, parse(originalBody)));
const rootText = expandMainWindowLifecycleSource(fs.readFileSync('electron/windowManager.cjs', 'utf8')), rootTree = parse(rootText);
function binding(tree: ts.SourceFile, target: string) {
  const factory = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'createWindowManager') as ts.FunctionDeclaration;
  return factory.body!.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(d => d.initializer && ts.isCallExpression(d.initializer) && d.initializer.expression.getText(tree) === target)) as ts.VariableStatement;
}
const rootBinding = binding(rootTree, name); assert.ok(rootBinding);
const declaration = rootBinding.declarationList.declarations[0];
assert.equal(declaration.name.getText(rootTree), 'createWindow');
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
const callbacks = ['getMainWindow', 'getIsQuitting', 'markMainWindowCanShow', 'getRendererRecoveryInProgress'];
function exercise(assemble: Function) {
  const outcomes = [];
  for (const callback of callbacks) for (const mode of ['undefined', 'null', 'false', 'number', 'string', 'object', 'symbol', 'read-error', 'write-error', 'coercion-error']) {
    const marker = {}, writes: unknown[] = [], reads: unknown[] = [], error = new Error(mode);
    const value: any = mode === 'undefined' ? undefined : mode === 'null' ? null : mode === 'false' ? false : mode === 'number' ? 2 : mode === 'string' ? '2' : mode === 'symbol' ? Symbol('value') : mode === 'coercion-error' ? { valueOf() { throw error; } } : marker;
    const state = new Proxy({}, { get(_target, key) { reads.push(String(key)); if (mode === 'read-error') throw error; return value; }, set(_target, key, value) { writes.push([String(key), value === marker ? 'marker' : value]); if (mode === 'write-error') throw error; return true; } });
    const deps: any = Object.fromEntries(params.map(key => [key, () => marker])); deps.managerState = state; deps.windowOwnershipState = { mainCreation: { setMainWindow: () => marker, setCanShow: () => marker, setRendererRecoveryInProgress: () => marker, setRendererReadyToShow: () => marker } };
    let captured: any; const result = assemble(deps, (input: any) => { captured = input; return marker; });
    assert.equal(result, marker); assert.deepEqual(reads, []); assert.deepEqual(writes, []);
    for (const key of params.filter(key => !['managerState', 'windowOwnershipState'].includes(key))) assert.equal(captured[key], deps[key], key);
    for (const [key, value] of Object.entries(deps.windowOwnershipState.mainCreation)) assert.equal(captured[key], value);
    let returned: any, caught: any; try { returned = captured[callback](marker); } catch (e) { caught = e; }
    outcomes.push({ callback, mode, reads, writes: writes.map(([key, value]: any) => [key, typeof value === 'symbol' ? 'symbol' : value]), returned: returned === marker ? 'marker' : returned === value && mode === 'coercion-error' ? 'coercion-value' : typeof returned === 'symbol' ? 'symbol' : returned, caught: caught === error ? 'original-error' : caught?.constructor.name });
  }
  return outcomes;
}
const outcomes = exercise(actual); assert.deepEqual(outcomes, exercise(reference));
for (const assemble of [actual, reference]) {
  const error = new Error('lower constructor'); assert.throws(() => assemble({ managerState: {}, windowOwnershipState: { mainCreation: {} } }, () => { throw error; }), e => e === error);
  const left: any = { mainWindow: {} }, right: any = { mainWindow: {} };
  const capture = (state: any) => assemble({ managerState: state, windowOwnershipState: { mainCreation: {} } }, (input: any) => input);
  const first = capture(left), second = capture(right); first.markMainWindowCanShow(); assert.equal(left.mainWindowCanShow, true); assert.equal(right.mainWindowCanShow, undefined); assert.equal(second.getMainWindow(), right.mainWindow);
  right.mainWindow = {}; assert.equal(second.getMainWindow(), right.mainWindow); left.isQuitting = true; assert.equal(first.getIsQuitting(), true);
}
console.log(`State creation assembly passed: ${outcomes.length} state/error cases, forwarding, return/error identity, independent live owners, root development-tools callback${process.argv[2] ? ', original call and remaining root AST' : ''}.`);
