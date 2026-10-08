import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const name = 'createWindowResourceMessagingControllers', calls = ['createWindowResourceResolvers', 'createWindowStateMessagingControllers'];
const names = ["getCompactWindowBounds","getSettingsWindowBounds","getSettingsPanelWindowBounds","getChatPanelWindowBounds","isInteractiveDialogueChatActive","getResolvedChatPanelWindowLimits","getResolvedChatPanelWindowBounds","getBrowserWindowIconOptions","resolveTrayIcon","getIsSettingsWindowOpen","getIsChatWindowOpen","notifySettingsWindowState","notifyChatWindowState","broadcastSharedState","broadcastRuntimeWorldPresentationIntent"];
const parse = (text: string) => ts.createSourceFile('windowManager.cjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const tree = parse(fs.readFileSync('electron/windowManager/windowResourceMessagingControllers.cjs', 'utf8'));
const phase = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name) as ts.FunctionDeclaration;
const params = (phase.parameters[0].name as ts.ObjectBindingPattern).elements.map(n => n.name.getText(tree));
const printer = ts.createPrinter({ removeComments: true });
function tokens(node: ts.Node, tree: ts.SourceFile) {
  const transformed = ts.transform(node, [context => {
    function visit(node: ts.Node): ts.VisitResult<ts.Node> {
      if (ts.isPropertyAssignment(node) && node.name.getText(tree) === 'processRef' && node.initializer.getText(tree) === 'process') return ts.factory.createShorthandPropertyAssignment('processRef');
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
const referenceBody = "  const {\n    getCompactWindowBounds, getSettingsWindowBounds, getSettingsPanelWindowBounds, getChatPanelWindowBounds,\n    isInteractiveDialogueChatActive, getResolvedChatPanelWindowLimits, getResolvedChatPanelWindowBounds, getBrowserWindowIconOptions,\n    resolveTrayIcon,\n  } = createWindowResourceResolvers({\n    captureService, screen, getSharedState, nativeImage,\n    path, processRef, baseDirectory, SETTINGS_PANEL_WINDOW_BOUNDS,\n    CHAT_PANEL_WINDOW_BOUNDS, INTERACTIVE_CHAT_PANEL_WINDOW_BOUNDS, INTERACTIVE_CHAT_PANEL_CENTER_Y_RATIO,\n  });\n  const {\n    getIsSettingsWindowOpen, getIsChatWindowOpen, notifySettingsWindowState, notifyChatWindowState,\n    broadcastSharedState, broadcastRuntimeWorldPresentationIntent,\n  } = createWindowStateMessagingControllers({\n    managerState, getSharedState\n  });\nreturn {\ngetCompactWindowBounds, getSettingsWindowBounds, getSettingsPanelWindowBounds, getChatPanelWindowBounds,\nisInteractiveDialogueChatActive, getResolvedChatPanelWindowLimits, getResolvedChatPanelWindowBounds, getBrowserWindowIconOptions,\nresolveTrayIcon, getIsSettingsWindowOpen, getIsChatWindowOpen, notifySettingsWindowState,\nnotifyChatWindowState, broadcastSharedState, broadcastRuntimeWorldPresentationIntent,\n};";
const referenceTree = parse(referenceBody);
assert.equal(tokens(phase.body!, tree), tokens(ts.factory.createBlock([...referenceTree.statements], true), referenceTree));
const compile = (body: string) => new Function('deps', ...calls, 'const {' + params.join(',') + '}=deps;' + body);
const actual = compile(phase.getText(tree) + ';return ' + name + '(deps);'), reference = compile(referenceBody);
const rootTree = parse(fs.readFileSync('electron/windowManager.cjs', 'utf8'));
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
  if (ts.isPropertyAssignment(n)) { const key = n.name.getText(rootTree); assert.ok(['baseDirectory', 'processRef'].includes(key)); assert.equal(n.initializer.getText(rootTree), key === 'baseDirectory' ? '__dirname' : 'process'); }
  else assert.ok(ts.isShorthandPropertyAssignment(n));
}
assert.ok(bindings(rootTree, ['createNativeShapeControllers'])[0].end < rootBindings[0].getStart(rootTree));
assert.ok(rootBindings[0].end < bindings(rootTree, ['createWindowManagerPlacementControllers'])[0].getStart(rootTree));
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
    return Object.fromEntries((index ? names.slice(9) : names.slice(0, 9)).map(key => [key, outputs[key]]));
  });
  let result: any, caught: any; try { result = assemble(deps, ...constructors); } catch (e) { caught = e; }
  assert.equal(caught, failure === 'none' ? undefined : error); assert.deepEqual(order, failure === calls[0] ? [calls[0]] : calls);
  if (result) { assert.deepEqual(Object.keys(result), names); for (const key of names) assert.equal(result[key], outputs[key]); }
}
const production = require('../electron/windowManager/windowResourceMessagingControllers.cjs');
const state = new Proxy({}, { get() { assert.fail('No eager state read'); }, set() { assert.fail('No eager state write'); } });
const deps: any = Object.fromEntries(params.map(key => [key, () => assert.fail('No eager native use: ' + key)])); deps.managerState = state;
const api = production[name](deps); assert.deepEqual(Object.keys(api), names); for (const key of names) assert.equal(typeof api[key], 'function');
console.log(`Resource/messaging assembly passed: 3 constructor boundaries; original dependency/order and 15 return identities; actual full assembly without eager state/native access${process.argv[2] ? ', original calls and remaining root AST' : ''}.`);
