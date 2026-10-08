import { expandWindowResourceMessagingSource } from './windowManagerAuxiliaryAssemblySource.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { exerciseWindowMessaging } from './window-manager-state-messaging-smoke.ts';

const require = createRequire(import.meta.url);
const messaging = require('../electron/windowManager/windowStateMessaging.cjs');
const name = 'createWindowStateMessagingControllers';
const calls = ['createWindowStateNotifier', 'createWindowStateBroadcaster'];
const names = ['getIsSettingsWindowOpen', 'getIsChatWindowOpen', 'notifySettingsWindowState', 'notifyChatWindowState', 'broadcastSharedState', 'broadcastRuntimeWorldPresentationIntent'];
const parse = (text: string) => ts.createSourceFile('windowManager.cjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const hash = (text: string) => crypto.createHash('sha256').update(text).digest('hex');
const printer = ts.createPrinter({ removeComments: true });
function tokens(node: ts.Node, tree: ts.SourceFile) {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, printer.printNode(ts.EmitHint.Unspecified, node, tree));
  const result: unknown[] = [];
  for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) result.push([kind, scanner.getTokenText()]);
  return JSON.stringify(result);
}
const rootText = expandWindowResourceMessagingSource(fs.readFileSync('electron/windowManager.cjs', 'utf8'));
const moduleTree = parse(fs.readFileSync('electron/windowManager/windowStateMessaging.cjs', 'utf8'));
const assembly = moduleTree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name) as ts.FunctionDeclaration;
const moved = assembly.body!.statements.filter(ts.isVariableStatement);
const methodDigest = hash(JSON.stringify(moved.map(node => tokens(node, moduleTree))));
assert.equal(methodDigest, 'f7ab3966e978d4d96e374f9e3c60c1e050e7f62bbf760284761b420a992ce713');
let original: ((deps: any) => any) | undefined;
if (process.argv[2]) {
  const tree = parse(fs.readFileSync(process.argv[2], 'utf8'));
  const factory = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'createWindowManager') as ts.FunctionDeclaration;
  const declarations = factory.body!.statements.filter(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration =>
    declaration.initializer && ts.isCallExpression(declaration.initializer) && calls.includes(declaration.initializer.expression.getText(tree))));
  assert.equal(declarations.length, 2);
  assert.equal(methodDigest, hash(JSON.stringify(declarations.map(node => tokens(node, tree)))));
  original = new Function('dependencies', 'const {managerState,getSharedState,createWindowStateNotifier,createWindowStateBroadcaster}=dependencies;'
    + declarations.map(node => node.getText(tree)).join('\n') + ';return {' + names.join(',') + '};') as (deps: any) => any;
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
  assert.equal(canonical(rootText), canonical(tree.text), 'Remaining root composition and public API');
}
function adapted(factory: (deps: any) => any) {
  return (deps: any) => {
    const mapping: Record<string, string> = { mainWindow: 'getMainWindow', settingsWindow: 'getSettingsWindow', chatWindow: 'getChatWindow' };
    let reads = 0;
    const managerState = new Proxy({}, { get(_target, key) { assert.ok(typeof key === 'string' && key in mapping); reads++; return deps[mapping[key as string]](); } });
    const api = factory({ managerState, getSharedState: deps.getSharedState, ...messaging });
    assert.equal(reads, 0, 'No eager window reads during assembly');
    assert.deepEqual(Object.keys(api), names);
    return api;
  };
}
const outcomes = exerciseWindowMessaging(messaging, adapted(messaging[name]));
assert.equal(outcomes.length, 557);
assert.deepEqual(outcomes, exerciseWindowMessaging(messaging));
if (original) assert.deepEqual(outcomes, exerciseWindowMessaging(messaging, adapted(original)));
const digest = hash(JSON.stringify(outcomes));
assert.equal(digest, 'aa0254209f87a3ec62d815a703bc30d901f0b36859e7a9cc2537c971d34c2117');
const tree = parse(rootText), bindings: ts.VariableDeclaration[] = [];
function inspect(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.initializer && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(tree) === name) bindings.push(node);
  ts.forEachChild(node, inspect);
}
inspect(tree); assert.equal(bindings.length, 1);
assert.deepEqual((bindings[0].name as ts.ObjectBindingPattern).elements.map(node => node.name.getText(tree)), names);
const call = bindings[0].initializer as ts.CallExpression;
assert.equal(call.arguments.length, 1);
assert.deepEqual((call.arguments[0] as ts.ObjectLiteralExpression).properties.map(node => node.getText(tree)), ['managerState', 'getSharedState']);
const first = messaging[name]({ managerState: { settingsWindow: { isDestroyed: () => false, isVisible: () => true } }, getSharedState: () => null });
const peer = messaging[name]({ managerState: { settingsWindow: null }, getSharedState: () => null });
assert.equal(first.getIsSettingsWindowOpen(), true); assert.equal(peer.getIsSettingsWindowOpen(), false);
console.log(`Window messaging assembly passed: ${outcomes.length} cases; methods ${methodDigest}; behavior ${digest}; lazy reads, independent managers${original ? ', original options/remaining root AST' : ''}.`);
