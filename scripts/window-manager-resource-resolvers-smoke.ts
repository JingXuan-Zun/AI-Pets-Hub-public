import { expandWindowResourceMessagingSource } from './windowManagerAuxiliaryAssemblySource.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { exerciseWindowManagerBounds } from './window-manager-bounds-smoke.ts';
import { exerciseWindowManagerIcons } from './window-manager-icons-smoke.ts';

const require = createRequire(import.meta.url);
const actual = require('../electron/windowManager/windowResourceResolvers.cjs').createWindowResourceResolvers;
const name = 'createWindowResourceResolvers', calls = ['createWindowBoundsResolver', 'createWindowIconResolver'];
const names = ['getCompactWindowBounds', 'getSettingsWindowBounds', 'getSettingsPanelWindowBounds', 'getChatPanelWindowBounds',
  'isInteractiveDialogueChatActive', 'getResolvedChatPanelWindowLimits', 'getResolvedChatPanelWindowBounds', 'getBrowserWindowIconOptions', 'resolveTrayIcon'];
const parse = (text: string) => ts.createSourceFile('windowManager.cjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const hash = (text: string) => crypto.createHash('sha256').update(text).digest('hex');
const printer = ts.createPrinter({ removeComments: true });
function tokens(node: ts.Node, tree: ts.SourceFile) {
  const transformed = ts.transform(node, [context => {
    function visit(node: ts.Node): ts.VisitResult<ts.Node> {
      if (ts.isPropertyAssignment(node) && ['processRef', 'baseDirectory'].includes(node.name.getText(tree)) && ['process', '__dirname'].includes(node.initializer.getText(tree)))
        return ts.factory.createShorthandPropertyAssignment(node.name.getText(tree));
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
function declarations(factory: ts.FunctionDeclaration, tree: ts.SourceFile, wanted = calls) {
  return factory.body!.statements.filter(ts.isVariableStatement).flatMap(node => [...node.declarationList.declarations])
    .filter(node => node.initializer && ts.isCallExpression(node.initializer) && wanted.includes(node.initializer.expression.getText(tree)));
}
const rootText = expandWindowResourceMessagingSource(fs.readFileSync('electron/windowManager.cjs', 'utf8')), moduleText = fs.readFileSync('electron/windowManager/windowResourceResolvers.cjs', 'utf8');
const tree = parse(moduleText), factory = tree.statements.find(ts.isFunctionDeclaration)!;
const moved = declarations(factory, tree), callDigest = hash(JSON.stringify(moved.map(node => tokens(node.initializer!, tree))));
assert.equal(callDigest, '994d6b332bd7b5f781f024eca74bd5d7702c6be131bf614001b04cd2338da9aa');
let oldDeclarations: ts.VariableDeclaration[] | undefined, oldTree: ts.SourceFile | undefined;
if (process.argv[2]) {
  oldTree = parse(fs.readFileSync(process.argv[2], 'utf8'));
  const oldFactory = oldTree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'createWindowManager') as ts.FunctionDeclaration;
  oldDeclarations = declarations(oldFactory, oldTree);
  assert.equal(oldDeclarations.length, 2);
  assert.equal(callDigest, hash(JSON.stringify(oldDeclarations.map(node => tokens(node.initializer!, oldTree!)))));
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
  assert.equal(canonical(rootText), canonical(oldTree.text), 'Remaining root execution, order and API');
}
for (const failure of ['none', ...calls]) {
  const deps = Object.fromEntries(['captureService', 'screen', 'getSharedState', 'nativeImage', 'path', 'processRef', 'baseDirectory',
    'SETTINGS_PANEL_WINDOW_BOUNDS', 'CHAT_PANEL_WINDOW_BOUNDS', 'INTERACTIVE_CHAT_PANEL_WINDOW_BOUNDS', 'INTERACTIVE_CHAT_PANEL_CENTER_Y_RATIO'].map(key => [key, {}]));
  const error = new Error('resource assembly failure'), outputs = Object.fromEntries(names.map(key => [key, () => key]));
  function exercise(old = false) {
    const order: string[] = [], options: unknown[] = [];
    const factories = Object.fromEntries(calls.map((name, index) => [name, (input: any) => {
      order.push(name); options.push({ ...input });
      for (const key of Object.keys(input)) assert.equal(input[key], deps[key], `Dependency identity: ${key}`);
      if (failure === name) throw error;
      return Object.fromEntries(names.slice(index === 0 ? 0 : 7, index === 0 ? 7 : 9).map(key => [key, outputs[key]]));
    }]));
    let api: any, caught;
    try {
      if (old) {
        const body = oldDeclarations!.map(node => 'const ' + node.getText(oldTree!) + ';').join('\n');
        api = new Function('deps', 'const {' + Object.keys(deps).join(',') + ',createWindowBoundsResolver,createWindowIconResolver}=deps;const process=processRef,__dirname=baseDirectory;'
          + body + ';return {' + names.join(',') + '};')({ ...deps, ...factories });
      } else {
        const module = { exports: {} as any };
        vm.runInNewContext(moduleText, { module, require: () => factories });
        api = module.exports[name](deps);
      }
    } catch (failure) { caught = failure; }
    assert.equal(caught, failure === 'none' ? undefined : error);
    if (api) for (const key of names) assert.equal(api[key], outputs[key]);
    assert.deepEqual(order, failure === calls[0] ? [calls[0]] : calls);
    return { order, options };
  }
  const result = exercise(); if (oldDeclarations) assert.deepEqual(result, exercise(true));
}
const outcomes = { bounds: exerciseWindowManagerBounds((deps: any) => {
  const { getBrowserWindowIconOptions, resolveTrayIcon, ...bounds } = actual(deps); return bounds;
}), icons: exerciseWindowManagerIcons((deps: any) => {
  const { getBrowserWindowIconOptions, resolveTrayIcon } = actual(deps); return { getBrowserWindowIconOptions, resolveTrayIcon };
}) };
assert.deepEqual(outcomes.bounds, exerciseWindowManagerBounds()); assert.deepEqual(outcomes.icons, exerciseWindowManagerIcons());
const digest = hash(JSON.stringify(outcomes)); assert.equal(digest, '5362b101f2cf8cf907b4c04d73d69f7a26155c0b0c12eb4f49cac329735cd6b2');
const rootTree = parse(rootText), rootFactory = rootTree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'createWindowManager') as ts.FunctionDeclaration;
const bindings = declarations(rootFactory, rootTree, [name]); assert.equal(bindings.length, 1);
assert.deepEqual((bindings[0].name as ts.ObjectBindingPattern).elements.map(node => node.name.getText(rootTree)), names);
const options = ((bindings[0].initializer as ts.CallExpression).arguments[0] as ts.ObjectLiteralExpression).properties;
assert.deepEqual(options.map(node => node.name!.getText(rootTree)), ['captureService', 'screen', 'getSharedState', 'nativeImage', 'path', 'processRef', 'baseDirectory',
  'SETTINGS_PANEL_WINDOW_BOUNDS', 'CHAT_PANEL_WINDOW_BOUNDS', 'INTERACTIVE_CHAT_PANEL_WINDOW_BOUNDS', 'INTERACTIVE_CHAT_PANEL_CENTER_Y_RATIO']);
assert.equal(options[5].getText(rootTree), 'processRef'); assert.equal(options[6].getText(rootTree), 'baseDirectory');
assert.ok(fs.readFileSync('electron/windowManager.cjs', 'utf8').includes('processRef: process'));
assert.ok(fs.readFileSync('electron/windowManager.cjs', 'utf8').includes('baseDirectory: __dirname'));
console.log(`Window resources passed: ${outcomes.bounds.length + outcomes.icons.length} real cases, 3 assembly order/error cases; calls ${callDigest}; behavior ${digest}${oldDeclarations ? ', original options and remaining root AST' : ''}.`);
