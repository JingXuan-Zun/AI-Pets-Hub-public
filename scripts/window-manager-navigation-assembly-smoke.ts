import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { exerciseRendererNavigation } from './window-manager-renderer-navigation-smoke.ts';

const require = createRequire(import.meta.url);
const actual = require('../electron/windowManager/rendererNavigation.cjs').createWindowManagerRendererNavigation;
const name = 'createWindowManagerRendererNavigation';
const parse = (text: string) => ts.createSourceFile('windowManager.cjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const hash = (text: string) => crypto.createHash('sha256').update(text).digest('hex');
const printer = ts.createPrinter({ removeComments: true });
function tokens(node: ts.Node, tree: ts.SourceFile) {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, printer.printNode(ts.EmitHint.Unspecified, node, tree));
  const result: unknown[] = [];
  for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) result.push([kind, scanner.getTokenText()]);
  return JSON.stringify(result);
}
const rootText = fs.readFileSync('electron/windowManager.cjs', 'utf8');
const tree = parse(fs.readFileSync('electron/windowManager/rendererNavigation.cjs', 'utf8'));
const factory = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name) as ts.FunctionDeclaration;
const call = (factory.body!.statements[0] as ts.ReturnStatement).expression!;
const callDigest = hash(tokens(call, tree)); assert.equal(callDigest, 'f751dac4154d1514ea7b7bd00bd954cc5557791e123dda21f31355633ad6793f');
const controlled = new Function('createRendererNavigation', 'deps', factory.getText(tree) + ';return ' + name + '(deps);');
let original: Function | undefined;
if (process.argv[2]) {
  const oldTree = parse(fs.readFileSync(process.argv[2], 'utf8'));
  const oldFactory = oldTree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'createWindowManager') as ts.FunctionDeclaration;
  const decl = oldFactory.body!.statements.filter(ts.isVariableStatement).flatMap(node => [...node.declarationList.declarations])
    .find(node => node.initializer && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(oldTree) === 'createRendererNavigation')!;
  const normalized = parse('const result=' + decl.initializer!.getText(oldTree).replace('baseDirectory: __dirname', 'baseDirectory') + ';');
  const expression = (normalized.statements[0] as ts.VariableStatement).declarationList.declarations[0].initializer!;
  assert.equal(callDigest, hash(tokens(expression, normalized)));
  original = new Function('createRendererNavigation', 'deps', 'const {isDev,path,baseDirectory:__dirname,logWindowEvent,localTestQueryValues,pointerDiagnosticsEnabled,forceFullShapeOnDragEnabled,live2DDragProbeEnabled}=deps;return ' + decl.initializer!.getText(oldTree) + ';');
  function canonical(text: string) {
    const tree = parse(text), factory = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'createWindowManager')!;
    const transformed = ts.transform(factory, [context => {
      function visit(node: ts.Node): ts.VisitResult<ts.Node> {
        if (ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => declaration.initializer && ts.isCallExpression(declaration.initializer)
          && ['createRendererNavigation', name].includes(declaration.initializer.expression.getText(tree)))) return undefined;
        return ts.visitEachChild(node, visit, context);
      }
      return node => ts.visitNode(node, visit) as typeof node;
    }]);
    try { return hash(tokens(transformed.transformed[0], tree)); } finally { transformed.dispose(); }
  }
  assert.equal(canonical(rootText), canonical(oldTree.text), 'Remaining root order, execution and API');
}
function exercise(assemble: Function) {
  const outcomes: unknown[] = [];
  for (const source of ['undefined', 'null', 'false', 'zero', 'text', 'plain', 'accessors', 'proxy']) for (let flags = 0; flags < 8; flags++) for (const failure of ['none', 'first', 'later']) {
    const calls: unknown[] = [], error = new Error('query spread failure'), marker = { id: 'reference' }, symbol = Symbol('query');
    const seed: any = { localTestDebugModelPath: 'before', pointerDiagnosticsEnabled: 'local', forceFullShapeOnDragEnabled: 'local', live2DDragProbeEnabled: 'local', marker, [symbol]: marker };
    Object.defineProperty(seed, 'hidden', { value: 'hidden' }); Object.setPrototypeOf(seed, { inherited: 'hidden' });
    if (source === 'accessors' || source === 'proxy') for (const [index, key] of ['localTestDebugModelPath', 'marker'].entries()) Object.defineProperty(seed, key, { enumerable: true, configurable: true, get() {
      calls.push(['get', key]); if (failure === (index === 0 ? 'first' : 'later')) throw error; return key === 'marker' ? marker : 'before';
    } });
    const primitive: any = { undefined, null: null, false: false, zero: 0, text: '雪abc' };
    const local = source in primitive ? primitive[source] : source === 'proxy' ? new Proxy(seed, {
      ownKeys(target) { calls.push(['keys']); return Reflect.ownKeys(target); },
      getOwnPropertyDescriptor(target, key) { calls.push(['descriptor', String(key)]); return Reflect.getOwnPropertyDescriptor(target, key); },
    }) : seed;
    const deps: any = { isDev: true, path: marker, baseDirectory: 'D:/app/electron', logWindowEvent: marker, localTestQueryValues: local,
      pointerDiagnosticsEnabled: Boolean(flags & 1), forceFullShapeOnDragEnabled: Boolean(flags & 2), live2DDragProbeEnabled: Boolean(flags & 4) };
    const token = { marker }, inputs: any[] = []; let caught;
    try { assert.equal(assemble((options: any) => { inputs.push(options); return token; }, deps), token); } catch (failure) { caught = failure; }
    assert.equal(caught, (source === 'accessors' || source === 'proxy') && failure !== 'none' ? error : undefined);
    if (inputs.length) {
      const options = inputs[0]; assert.equal(options.path, marker); assert.equal(options.logWindowEvent, marker);
      const snapshot = options.queryOptions;
      for (const key of ['pointerDiagnosticsEnabled', 'forceFullShapeOnDragEnabled', 'live2DDragProbeEnabled']) assert.equal(snapshot[key], deps[key]);
      assert.ok(!Object.hasOwn(snapshot, 'hidden')); assert.ok(!Object.hasOwn(snapshot, 'inherited'));
      if (['plain', 'accessors', 'proxy'].includes(source)) { assert.equal(snapshot.marker, marker); assert.equal(snapshot[symbol], marker); }
      if (source === 'plain') seed.localTestDebugModelPath = 'after';
      if (['plain', 'accessors', 'proxy'].includes(source)) assert.equal(snapshot.localTestDebugModelPath, 'before');
      outcomes.push({ source, flags, failure, calls, keys: Reflect.ownKeys(snapshot).map(String), values: Object.entries(snapshot).map(([key, value]) => [key, value === marker ? '<reference>' : value]) });
    } else outcomes.push({ source, flags, failure, calls, error: Boolean(caught) });
  }
  return outcomes;
}
const snapshots = exercise(controlled); if (original) assert.deepEqual(snapshots, exercise(original));
const navigation = exerciseRendererNavigation((deps: any) => {
  const { queryOptions, ...host } = deps;
  return actual({ ...host, localTestQueryValues: queryOptions, pointerDiagnosticsEnabled: queryOptions.pointerDiagnosticsEnabled,
    forceFullShapeOnDragEnabled: queryOptions.forceFullShapeOnDragEnabled, live2DDragProbeEnabled: queryOptions.live2DDragProbeEnabled });
});
assert.deepEqual(navigation, exerciseRendererNavigation());
const digest = hash(JSON.stringify({ snapshots, navigation })); assert.equal(digest, '4b8e1af7afbd8ad955cbd358b1ad0245990c17eba60a21f288d3025db858e353');
const rootTree = parse(rootText), bindings: ts.VariableDeclaration[] = [];
function inspect(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.initializer && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(rootTree) === name) bindings.push(node);
  ts.forEachChild(node, inspect);
}
inspect(rootTree); assert.equal(bindings.length, 1);
assert.deepEqual((bindings[0].name as ts.ObjectBindingPattern).elements.map(node => node.name.getText(rootTree)), ['isSettingsWindowAtSettingsPanelUrl', 'loadRenderer']);
const options = ((bindings[0].initializer as ts.CallExpression).arguments[0] as ts.ObjectLiteralExpression).properties;
assert.deepEqual(options.map(node => node.getText(rootTree)), ['isDev', 'path', 'baseDirectory: __dirname', 'logWindowEvent', 'localTestQueryValues', 'pointerDiagnosticsEnabled', 'forceFullShapeOnDragEnabled', 'live2DDragProbeEnabled']);
console.log(`Navigation assembly passed: ${snapshots.length} snapshots + ${navigation.length} navigation cases; calls ${callDigest}; behavior ${digest}${original ? ', original spread and remaining root AST' : ''}.`);
