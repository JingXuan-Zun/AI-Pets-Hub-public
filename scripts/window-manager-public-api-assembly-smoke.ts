import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
const production = createRequire(import.meta.url)('../electron/windowManager/windowManagerPublicApi.cjs');
const parse = (text: string) => ts.createSourceFile('windowManager.cjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const names = ['createWindowManagerWindowApi', 'createWindowManagerInteractionApi'];
const text = fs.readFileSync('electron/windowManager/windowManagerPublicApi.cjs', 'utf8'), tree = parse(text);
assert.ok(!text.includes('setAgentDesktopExecutionActive'), 'Execution policy stays in the root');
const phases = names.map(name => tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name) as ts.FunctionDeclaration);
const params = phases.map(p => (p.parameters[0].name as ts.ObjectBindingPattern).elements.map(n => n.name.getText(tree)));
const referenceObject = "{\n    broadcastSharedState,\n    broadcastRuntimeWorldPresentationIntent,\n    closeChatWindow,\n    closeSettingsWindow,\n    createMainWindow: createWindow,\n    createTray,\n    dispose,\n    getChatWindow,\n    getIsChatWindowOpen,\n    getIsSettingsWindowOpen,\n    getMainWindow,\n    getSettingsWindow,\n    getSharedState,\n    getShellRendererWindows,\n    getShellSettingsOpen: () => managerState.isShellSettingsOpen,\n    hideMainWindow,\n    keepWindowOnTop,\n    markMainWindowReadyToShow,\n    notifyChatWindowState,\n    notifySettingsWindowState,\n    openChatWindow,\n    openSettingsWindow,\n    preloadSettingsWindow,\n    recoverMainWindowRenderer,\n    resizeWindowForSettings,\n    scheduleKeepWindowOnTop,\n    setAgentDesktopExecutionActive,\n    scheduleSettingsWindowContentRefresh,\n    scheduleWindowStackOnTop,\n    setInteractiveRegions,\n    setPetDragNativeShapeActive,\n    forwardPostDragInputProxyEvent,\n    setPointerPassthrough: setWindowPointerPassthrough,\n    setQuitting,\n    setSettingsOpen,\n    setSharedState,\n    showOrRecoverMainWindow,\n    showMainWindow,\n    showSettingsWindow,\n    startMainTopmostGuard,\n    stopMainTopmostGuard,\n  }";
const referenceTree = parse('const api = ' + referenceObject + ';');
const object = (referenceTree.statements[0] as ts.VariableStatement).declarationList.declarations[0].initializer as ts.ObjectLiteralExpression;
const slot = object.properties.findIndex(n => n.name!.getText(referenceTree) === 'setAgentDesktopExecutionActive'); assert.ok(slot >= 0);
const originalGroups = [object.properties.slice(0, slot), object.properties.slice(slot + 1)];
const keys = object.properties.map(n => n.name!.getText(referenceTree));
const printer = ts.createPrinter({ removeComments: true });
function tokens(node: ts.Node, tree: ts.SourceFile) {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, printer.printNode(ts.EmitHint.Unspecified, node, tree)), result = [];
  for (let k = scanner.scan(); k !== ts.SyntaxKind.EndOfFileToken; k = scanner.scan()) result.push([k, scanner.getTokenText()]);
  return JSON.stringify(result);
}
for (let i = 0; i < 2; i++) {
  const returned = phases[i].body!.statements.find(ts.isReturnStatement)!.expression!;
  const expected = ts.factory.createObjectLiteralExpression(ts.factory.createNodeArray(originalGroups[i], true), true);
  assert.equal(tokens(returned, tree), tokens(expected, referenceTree), 'Original API properties and aliases');
}
const allParams = [...new Set(params.flat().concat('setAgentDesktopExecutionActive'))];
const original = new Function('deps', 'const {' + allParams.join(',') + '}=deps;return ' + referenceObject + ';');
const assemble = (deps: any) => ({ ...production[names[0]](deps), setAgentDesktopExecutionActive: deps.setAgentDesktopExecutionActive, ...production[names[1]](deps) });
const rootTree = parse(fs.readFileSync('electron/windowManager.cjs', 'utf8'));
const rootFactory = rootTree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'createWindowManager') as ts.FunctionDeclaration;
const returned = rootFactory.body!.statements.find(ts.isReturnStatement)!.expression as ts.ObjectLiteralExpression;
assert.equal(returned.properties.length, 3); assert.ok(ts.isShorthandPropertyAssignment(returned.properties[1]));
assert.equal(returned.properties[1].getText(rootTree), 'setAgentDesktopExecutionActive');
for (let i = 0; i < 2; i++) {
  const spread = returned.properties[i ? 2 : 0]; assert.ok(ts.isSpreadAssignment(spread)); assert.ok(ts.isCallExpression(spread.expression));
  assert.equal(spread.expression.expression.getText(rootTree), names[i]);
  const args = (spread.expression.arguments[0] as ts.ObjectLiteralExpression).properties;
  assert.deepEqual(args.map(n => n.name!.getText(rootTree)), params[i]);
  for (const arg of args) assert.ok(ts.isShorthandPropertyAssignment(arg), 'Exact root method/state references');
}
if (process.argv[2]) {
  const oldTree = parse(fs.readFileSync(process.argv[2], 'utf8')), oldFactory = oldTree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'createWindowManager') as ts.FunctionDeclaration;
  assert.equal(tokens(oldFactory.body!.statements.find(ts.isReturnStatement)!.expression!, oldTree), tokens(object, referenceTree));
  function remaining(factory: ts.FunctionDeclaration, tree: ts.SourceFile) {
    const body = ts.factory.updateBlock(factory.body!, factory.body!.statements.filter(n => !ts.isReturnStatement(n)));
    return tokens(ts.factory.updateFunctionDeclaration(factory, factory.modifiers, factory.asteriskToken, factory.name, factory.typeParameters, factory.parameters, factory.type, body), tree);
  }
  assert.equal(remaining(rootFactory, rootTree), remaining(oldFactory, oldTree));
}
let identities = 0;
for (const kind of ['undefined', 'null', 'false', 'zero', 'string', 'object', 'symbol', 'function']) {
  const deps: any = Object.fromEntries(allParams.map(key => [key, kind === 'undefined' ? undefined : kind === 'null' ? null : kind === 'false' ? false : kind === 'zero' ? 0 : kind === 'string' ? key : kind === 'object' ? { key } : kind === 'symbol' ? Symbol(key) : () => assert.fail('No eager method call: ' + key)]));
  let reads = 0; deps.managerState = { get isShellSettingsOpen() { reads++; return 'live'; } };
  const actual = assemble(deps), expected = original(deps); assert.deepEqual(Object.keys(actual), keys); assert.equal(reads, 0);
  for (const key of keys.filter(key => key !== 'getShellSettingsOpen')) { assert.equal(actual[key], expected[key], key); identities++; }
  assert.equal(actual.getShellSettingsOpen(), expected.getShellSettingsOpen()); assert.equal(reads, 2);
}
for (const mode of ['undefined', 'null', 'false', 'number', 'string', 'object', 'symbol', 'read-error']) {
  const error = new Error(mode), value: any = mode === 'undefined' ? undefined : mode === 'null' ? null : mode === 'false' ? false : mode === 'number' ? 2 : mode === 'string' ? 'value' : mode === 'symbol' ? Symbol('value') : {};
  let reads = 0; const deps: any = { managerState: { get isShellSettingsOpen() { reads++; if (mode === 'read-error') throw error; return value; } } };
  const actual = assemble(deps), expected = original(deps); assert.equal(reads, 0);
  if (mode === 'read-error') { assert.throws(actual.getShellSettingsOpen, e => e === error); assert.throws(expected.getShellSettingsOpen, e => e === error); }
  else { assert.equal(actual.getShellSettingsOpen(), value); assert.equal(expected.getShellSettingsOpen(), value); }
  assert.equal(reads, 2);
}
const left: any = { isShellSettingsOpen: false }, right: any = { isShellSettingsOpen: true };
const first = assemble({ managerState: left }), second = assemble({ managerState: right }); assert.notEqual(first.getShellSettingsOpen, second.getShellSettingsOpen);
left.isShellSettingsOpen = {}; assert.equal(first.getShellSettingsOpen(), left.isShellSettingsOpen); assert.equal(second.getShellSettingsOpen(), true);
console.log(`Public API assembly passed: ${keys.length} ordered members, ${identities} reference checks, 8 live-state/error cases, independent owner getters and unchanged execution-policy slot${process.argv[2] ? ', original return and remaining root AST' : ''}.`);
