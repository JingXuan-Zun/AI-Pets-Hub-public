import { expandAuxiliaryWindowContentSource } from './windowManagerAuxiliaryAssemblySource.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const name = 'createAuxiliaryWindowCreationControllers', calls = ['createChatWindowOwnershipControllers', 'createSettingsWindowOwnershipControllers'];
const names = ['closeChatWindow', 'openChatWindow', 'syncInteractiveChatWindowBounds', 'ensureSettingsWindowReady', 'preloadSettingsWindow'];
const parse = (text: string) => ts.createSourceFile('windowManager.cjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const tree = parse(fs.readFileSync('electron/windowManager/auxiliaryWindowCreationControllers.cjs', 'utf8'));
const phase = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name) as ts.FunctionDeclaration;
const params = (phase.parameters[0].name as ts.ObjectBindingPattern).elements.map(n => n.name.getText(tree));
const printer = ts.createPrinter({ removeComments: true });
function tokens(node: ts.Node, tree: ts.SourceFile) {
  const transformed = ts.transform(node, [context => {
    function visit(node: ts.Node): ts.VisitResult<ts.Node> {
      if (ts.isPropertyAssignment(node) && node.name.getText(tree) === 'baseDirectory' && node.initializer.getText(tree) === '__dirname') return ts.factory.createShorthandPropertyAssignment('baseDirectory');
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
const referenceBody = "  const { closeChatWindow, openChatWindow, syncInteractiveChatWindowBounds } = createChatWindowOwnershipControllers({\n    windowOwnershipState, getBrowserWindowIconOptions, path,\n    baseDirectory, sessionPartition, isCurrentWindowCompactMinimumSizeActive,\n    getResolvedChatPanelWindowLimits, isInteractiveDialogueChatActive, getResolvedChatPanelWindowBounds,\n    scheduleKeepWindowOnTop, AUX_TOPMOST_RELATIVE_LEVEL, scheduleWindowStackOnTop,\n    notifyChatWindowState, broadcastSharedState, openExternalSafely,\n    shell, getChatPanelWindowBounds, BrowserWindow,\n    attachLoadLogging, loadRenderer,\n  });\n  const { ensureSettingsWindowReady, preloadSettingsWindow } = createSettingsWindowOwnershipControllers({\n    windowOwnershipState, openExternalSafely, shell,\n    broadcastSharedState, scheduleSettingsWindowContentRefresh, disableDwmSystemBorderForWindow,\n    notifySettingsWindowState, scheduleWindowStackOnTop, scheduleKeepWindowOnTop,\n    AUX_TOPMOST_RELATIVE_LEVEL, HIDE_MAIN_WINDOW_FOR_GRAPH_DIAGNOSTICS, showMainWindowWhenReady,\n    getBrowserWindowIconOptions, SETTINGS_PANEL_WINDOW_BOUNDS, path,\n    baseDirectory, sessionPartition, getSettingsPanelWindowBounds,\n    BrowserWindow, attachLoadLogging, logWindowEvent,\n    loadRenderer, waitForSettingsWindowLoad,\n  });\nreturn { closeChatWindow, openChatWindow, syncInteractiveChatWindowBounds, ensureSettingsWindowReady, preloadSettingsWindow };";
const referenceTree = parse(referenceBody);
assert.equal(tokens(phase.body!, tree), tokens(ts.factory.createBlock([...referenceTree.statements], true), referenceTree));
const compile = (body: string) => new Function('deps', ...calls, 'const {' + params.join(',') + '}=deps;' + body);
const actual = compile(phase.getText(tree) + ';return ' + name + '(deps);'), reference = compile(referenceBody);
const rootTree = parse(expandAuxiliaryWindowContentSource(fs.readFileSync('electron/windowManager.cjs', 'utf8')));
function bindings(tree: ts.SourceFile, targets: string[]) {
  const owner = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'createWindowManager') as ts.FunctionDeclaration;
  return owner.body!.statements.filter(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.initializer && ts.isCallExpression(d.initializer) && targets.includes(d.initializer.expression.getText(tree)))) as ts.VariableStatement[];
}
const rootBindings = bindings(rootTree, [name]); assert.equal(rootBindings.length, 1);
const declaration = rootBindings[0].declarationList.declarations[0];
assert.deepEqual((declaration.name as ts.ObjectBindingPattern).elements.map(n => n.name.getText(rootTree)), names);
const options = ((declaration.initializer as ts.CallExpression).arguments[0] as ts.ObjectLiteralExpression).properties;
assert.deepEqual(options.map(n => n.name!.getText(rootTree)), params);
for (const n of options) {
  if (ts.isPropertyAssignment(n)) { assert.equal(n.name.getText(rootTree), 'baseDirectory'); assert.equal(n.initializer.getText(rootTree), '__dirname'); }
  else assert.ok(ts.isShorthandPropertyAssignment(n));
}
assert.ok(bindings(rootTree, ['createMainWindowLifecycleControllers'])[0].end < rootBindings[0].getStart(rootTree));
assert.ok(rootBindings[0].end < bindings(rootTree, ['createSettingsWindowContentRefresh'])[0].getStart(rootTree));
if (process.argv[2]) {
  const oldTree = parse(fs.readFileSync(process.argv[2], 'utf8'));
  assert.deepEqual(bindings(oldTree, calls).map(n => tokens(n, oldTree)), phase.body!.statements.filter(ts.isVariableStatement).map(n => tokens(n, tree)));
  function remaining(tree: ts.SourceFile) {
    const remove = bindings(tree, [name, ...calls]), text = tree.text; let next = text;
    for (const node of [...remove].reverse()) next = next.slice(0, node.getStart(tree)) + next.slice(node.end);
    const parsed = parse(next), owner = parsed.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'createWindowManager')!;
    return tokens(owner, parsed);
  }
  assert.equal(remaining(rootTree), remaining(oldTree));
}
for (const assemble of [actual, reference]) for (const failure of ['none', ...calls]) {
  const order: string[] = [], error = new Error('constructor'), outputs = Object.fromEntries(names.map(key => [key, () => key]));
  const deps = Object.fromEntries(params.map(key => [key, () => assert.fail('No eager use: ' + key)]));
  const constructors = calls.map((call, index) => (input: any) => {
    order.push(call);
    for (const [key, value] of Object.entries(input)) assert.equal(value, deps[key], call + ' forwards ' + key);
    const statement = phase.body!.statements.filter(ts.isVariableStatement)[index];
    const expected = ((statement.declarationList.declarations[0].initializer as ts.CallExpression).arguments[0] as ts.ObjectLiteralExpression).properties.map(n => n.name!.getText(tree));
    assert.deepEqual(Object.keys(input), expected);
    if (failure === call) throw error;
    return Object.fromEntries((index ? names.slice(3) : names.slice(0, 3)).map(key => [key, outputs[key]]));
  });
  let result: any, caught: any; try { result = assemble(deps, ...constructors); } catch (e) { caught = e; }
  assert.equal(caught, failure === 'none' ? undefined : error); assert.deepEqual(order, failure === calls[0] ? [calls[0]] : calls);
  if (result) { assert.deepEqual(Object.keys(result), names); for (const key of names) assert.equal(result[key], outputs[key]); }
}
const production = require('../electron/windowManager/auxiliaryWindowCreationControllers.cjs');
const state = new Proxy({}, { get() { assert.fail('No eager state read'); }, set() { assert.fail('No eager state write'); } });
const owner = require('../electron/windowManager/windowOwnershipStateAdapters.cjs').createWindowOwnershipStateAdapters(state);
const deps: any = Object.fromEntries(params.map(key => [key, () => assert.fail('No eager native use: ' + key)])); deps.windowOwnershipState = owner;
const api = production[name](deps); assert.deepEqual(Object.keys(api), names); for (const key of names) assert.equal(typeof api[key], 'function');
console.log(`Auxiliary creation assembly passed: 3 constructor boundaries; original dependency/order and five return identities; actual full assembly without eager state/native access${process.argv[2] ? ', original calls and remaining root AST' : ''}.`);
