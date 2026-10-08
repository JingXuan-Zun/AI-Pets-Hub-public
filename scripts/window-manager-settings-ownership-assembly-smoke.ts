import { expandAuxiliaryWindowCreationSource } from './windowManagerAuxiliaryAssemblySource.mjs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const parse = (text: string) => ts.createSourceFile('windowManager.cjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const name = 'createSettingsWindowOwnershipControllers', lower = 'createSettingsWindowControllers';
const moduleTree = parse(fs.readFileSync('electron/windowManager/settingsWindowControllers.cjs', 'utf8'));
const phase = moduleTree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name) as ts.FunctionDeclaration;
const returned = phase.body!.statements.find(ts.isReturnStatement)!.expression as ts.CallExpression;
const printer = ts.createPrinter({ removeComments: true });
function canonical(node: ts.Node, tree: ts.SourceFile) {
  const transformed = ts.transform(node, [context => {
    function visit(node: ts.Node): ts.VisitResult<ts.Node> {
      if (ts.isPropertyAssignment(node) && node.name.getText(tree) === 'baseDirectory' && node.initializer.getText(tree) === '__dirname') return ts.factory.createShorthandPropertyAssignment('baseDirectory');


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
const originalBody = "return createSettingsWindowControllers({\nopenExternalSafely,\nshell,\n...windowOwnershipState.settingsOwnership,\nbroadcastSharedState,\nscheduleSettingsWindowContentRefresh,\ndisableDwmSystemBorderForWindow,\nnotifySettingsWindowState,\nscheduleWindowStackOnTop,\nscheduleKeepWindowOnTop,\nAUX_TOPMOST_RELATIVE_LEVEL,\nHIDE_MAIN_WINDOW_FOR_GRAPH_DIAGNOSTICS,\nshowMainWindowWhenReady,\ngetBrowserWindowIconOptions,\nSETTINGS_PANEL_WINDOW_BOUNDS,\npath,\nbaseDirectory,\nsessionPartition,\ngetSettingsPanelWindowBounds,\nBrowserWindow,\nattachLoadLogging,\nlogWindowEvent,\nloadRenderer,\n...windowOwnershipState.settingsReadiness,\nwaitForSettingsWindowLoad,\n});";
const reference = compile(originalBody);
assert.equal(canonical(returned, moduleTree), canonical((parse(originalBody).statements[0] as ts.ReturnStatement).expression!, parse(originalBody)));
const rootText = expandAuxiliaryWindowCreationSource(fs.readFileSync('electron/windowManager.cjs', 'utf8')), rootTree = parse(rootText);
function binding(tree: ts.SourceFile, target: string) {
  const factory = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'createWindowManager') as ts.FunctionDeclaration;
  return factory.body!.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(d => d.initializer && ts.isCallExpression(d.initializer) && d.initializer.expression.getText(tree) === target)) as ts.VariableStatement;
}
const rootBinding = binding(rootTree, name); assert.ok(rootBinding);
const declaration = rootBinding.declarationList.declarations[0];
assert.deepEqual((declaration.name as ts.ObjectBindingPattern).elements.map(n => n.name.getText(rootTree)), ['ensureSettingsWindowReady', 'preloadSettingsWindow']);
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
const adapter = createRequire(import.meta.url)('../electron/windowManager/windowOwnershipStateAdapters.cjs').createWindowOwnershipStateAdapters;
const callbacks = ['getSettingsWindow', 'setSettingsWindow', 'getIsQuitting', 'clearSettingsWindow', 'clearSettingsWindowReadyPromise', 'getReadyPromise', 'setReadyPromise'];
function exercise(assemble: Function) {
  const outcomes = [];
  for (const callback of callbacks) for (const mode of ['undefined', 'null', 'false', 'number', 'string', 'object', 'symbol', 'read-error', 'write-error']) {
    const marker = {}, writes: unknown[] = [], reads: unknown[] = [], error = new Error(mode);
    const value: any = mode === 'undefined' ? undefined : mode === 'null' ? null : mode === 'false' ? false : mode === 'number' ? 2 : mode === 'string' ? '2' : mode === 'symbol' ? Symbol('value') : marker;
    const state = new Proxy({}, { get(_target, key) { reads.push(String(key)); if (mode === 'read-error') throw error; return value; }, set(_target, key, value) { writes.push([String(key), value === marker ? 'marker' : value]); if (mode === 'write-error') throw error; return true; } });
    const deps: any = Object.fromEntries(params.map(key => [key, () => marker])); deps.windowOwnershipState = adapter(state);
    let captured: any; assert.equal(assemble(deps, (input: any) => { captured = input; return marker; }), marker);
    assert.deepEqual(reads, []); assert.deepEqual(writes, []);
    for (const key of params.filter(key => key !== 'windowOwnershipState')) assert.equal(captured[key], deps[key], key);
    for (const group of ['settingsOwnership', 'settingsReadiness']) for (const [key, value] of Object.entries(deps.windowOwnershipState[group])) assert.equal(captured[key], value);
    let returned: any, caught: any; try { returned = captured[callback](marker); } catch (e) { caught = e; }
    outcomes.push({ callback, mode, reads, writes, returned: returned === marker ? 'marker' : typeof returned === 'symbol' ? 'symbol' : returned, caught: caught === error ? 'original-error' : caught?.constructor.name });
  }
  return outcomes;
}
const outcomes = exercise(actual); assert.deepEqual(outcomes, exercise(reference));
for (const assemble of [actual, reference]) {
  const error = new Error('lower constructor'); assert.throws(() => assemble({ windowOwnershipState: { settingsOwnership: {}, settingsReadiness: {} } }, () => { throw error; }), e => e === error);
  const left: any = {}, right: any = {}, build = (state: any) => assemble({ windowOwnershipState: adapter(state) }, (input: any) => input);
  const first = build(left), second = build(right), win = {}; first.setSettingsWindow(win); assert.equal(first.getSettingsWindow(), win); assert.equal(second.getSettingsWindow(), undefined);
  first.clearSettingsWindow(); assert.equal(left.settingsWindow, null); right.settingsWindow = win; assert.equal(second.getSettingsWindow(), win);
  const promise = Promise.resolve(win); first.setReadyPromise(promise); assert.equal(first.getReadyPromise(), promise); assert.equal(second.getReadyPromise(), undefined); first.clearSettingsWindowReadyPromise(); assert.equal(first.getReadyPromise(), null); assert.equal(left.settingsWindowReadyPromise, null);
  left.isQuitting = true; assert.equal(first.getIsQuitting(), true); assert.equal(second.getIsQuitting(), undefined);
}

console.log(`Settings ownership/readiness assembly passed: ${outcomes.length} state/error cases, forwarding, return/error identity, independent live owners, ownership method identity and root directory reference${process.argv[2] ? ', original call and remaining root AST' : ''}.`);
