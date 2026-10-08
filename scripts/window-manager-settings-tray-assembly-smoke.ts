import { expandWindowPresentationTraySource } from './windowManagerAuxiliaryAssemblySource.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { exerciseAuxiliaryControls } from './window-manager-auxiliary-controls-smoke.ts';
import { exerciseTrayConfiguration } from './window-manager-tray-configuration-smoke.ts';
const require = createRequire(import.meta.url), controls = require('../electron/windowManager/auxiliaryWindowControls.cjs'), production = require('../electron/windowManager/trayConfiguration.cjs');
const name = 'createSettingsTrayControllers', calls = ['createSettingsWindowControls', 'createTrayConfigurator'], names = ['closeSettingsWindow', 'openSettingsWindow', 'configureTray'];
const parse = (text: string) => ts.createSourceFile('windowManager.cjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const tree = parse(fs.readFileSync('electron/windowManager/trayConfiguration.cjs', 'utf8'));
const phase = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name) as ts.FunctionDeclaration;
const params = (phase.parameters[0].name as ts.ObjectBindingPattern).elements.map(n => n.name.getText(tree));
const printer = ts.createPrinter({ removeComments: true });
function tokens(node: ts.Node, tree: ts.SourceFile) {
  const transformed = ts.transform(node, [context => {
    function visit(node: ts.Node): ts.VisitResult<ts.Node> {
      if (ts.isPropertyAssignment(node) && ts.isArrowFunction(node.initializer) && ['ensureSettingsWindowReady', 'showSettingsWindow', 'reportOpenSettingsError'].includes(node.name.getText(tree))) {
        const key = node.name.getText(tree), expected = key === 'reportOpenSettingsError' ? "(error) => console.error('Failed to open settings window:', error)" : '() => ' + key + '()';
        assert.equal(node.initializer.getText(tree), expected); return ts.factory.createShorthandPropertyAssignment(key);
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
const referenceBody = `const { closeSettingsWindow, openSettingsWindow } = createSettingsWindowControls({
  getSettingsWindow: () => managerState.settingsWindow, ensureSettingsWindowReady,
  showSettingsWindow, reportOpenSettingsError,
});
const configureTray = createTrayConfigurator({
  ...windowOwnershipState.trayOwnership, Menu, app,
  showMainWindow, openSettingsWindow, hideMainWindow,
});
return { closeSettingsWindow, openSettingsWindow, configureTray };`;
const compile = (body: string) => new Function('deps', ...calls, 'const {' + params.join(',') + '}=deps;' + body);
const actual = compile(phase.getText(tree) + ';return ' + name + '(deps);'), reference = compile(referenceBody);
assert.equal(tokens(phase.body!, tree), tokens(ts.factory.createBlock([...parse(referenceBody).statements], true), parse(referenceBody)));
const rootTree = parse(expandWindowPresentationTraySource(fs.readFileSync('electron/windowManager.cjs', 'utf8')));
function bindings(tree: ts.SourceFile, targets: string[]) {
  const owner = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'createWindowManager') as ts.FunctionDeclaration;
  return owner.body!.statements.filter(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.initializer && ts.isCallExpression(d.initializer) && targets.includes(d.initializer.expression.getText(tree)))) as ts.VariableStatement[];
}
const rootBindings = bindings(rootTree, [name]); assert.equal(rootBindings.length, 1);
const declaration = rootBindings[0].declarationList.declarations[0];
assert.deepEqual((declaration.name as ts.ObjectBindingPattern).elements.map(n => n.name.getText(rootTree)), names);
const options = ((declaration.initializer as ts.CallExpression).arguments[0] as ts.ObjectLiteralExpression).properties;
assert.deepEqual(options.map(n => n.name!.getText(rootTree)), params); for (const n of options) tokens(n, rootTree);
if (process.argv[2]) {
  const oldTree = parse(fs.readFileSync(process.argv[2], 'utf8'));
  assert.deepEqual(bindings(oldTree, calls).map(n => tokens(n, oldTree)), phase.body!.statements.filter(ts.isVariableStatement).map(n => tokens(n, tree)));
  function remaining(tree: ts.SourceFile) {
    const remove = bindings(tree, [name, ...calls]), text = tree.text;
    let restored = text; for (const node of [...remove].reverse()) restored = restored.slice(0, node.getStart(tree)) + restored.slice(node.end);
    const next = parse(restored), owner = next.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'createWindowManager')!;
    return tokens(owner, next);
  }
  assert.equal(remaining(rootTree), remaining(oldTree));
}
for (const assemble of [actual, reference]) {
  for (const failure of ['none', ...calls]) {
    const order: string[] = [], error = new Error('constructor'), outputs = Object.fromEntries(names.map(key => [key, () => key]));
    const state = new Proxy({}, { get() { throw new Error('No eager state access'); } });
    const deps: any = Object.fromEntries(params.map(key => [key, () => key])); deps.managerState = state; deps.windowOwnershipState = { trayOwnership: { getTray: () => 'tray', getMainWindow: () => 'main', markQuitting: () => 'quit' } };
    let result: any, caught: any;
    try { result = assemble(deps, (input: any) => {
      order.push(calls[0]); for (const key of ['ensureSettingsWindowReady', 'showSettingsWindow', 'reportOpenSettingsError']) assert.equal(input[key], deps[key]);
      if (failure === calls[0]) throw error; return outputs;
    }, (input: any) => {
      order.push(calls[1]); assert.equal(input.openSettingsWindow, outputs.openSettingsWindow);
      for (const key of ['Menu', 'app', 'showMainWindow', 'hideMainWindow']) assert.equal(input[key], deps[key]);
      for (const [key, value] of Object.entries(deps.windowOwnershipState.trayOwnership)) assert.equal(input[key], value);
      if (failure === calls[1]) throw error; return outputs.configureTray;
    }); } catch (e) { caught = e; }
    assert.equal(caught, failure === 'none' ? undefined : error); assert.deepEqual(order, failure === calls[0] ? [calls[0]] : calls);
    if (result) { assert.deepEqual(Object.keys(result), names); for (const key of names) assert.equal(result[key], outputs[key]); }
  }
  const left: any = {}, right: any = {}, capture = (state: any) => { let getter: any; assemble({ managerState: state, windowOwnershipState: {} }, (input: any) => { getter = input.getSettingsWindow; return {}; }, () => undefined); return getter; };
  const first = capture(left), second = capture(right), window = {}; left.settingsWindow = window; assert.equal(first(), window); assert.equal(second(), undefined); right.settingsWindow = {}; assert.equal(second(), right.settingsWindow);
}
async function executeControls(assemble: Function) {
  return exerciseAuxiliaryControls({ ...controls, createSettingsWindowControls(deps: any) {
    let accesses = 0; const managerState = { get settingsWindow() { accesses++; return deps.getSettingsWindow(); } };
    const api = assemble({ ...deps, managerState, windowOwnershipState: {} }); assert.equal(accesses, 0);
    return { closeSettingsWindow: api.closeSettingsWindow, openSettingsWindow: api.openSettingsWindow };
  } });
}
const auxiliary = await executeControls((deps: any) => actual(deps, controls.createSettingsWindowControls, production.createTrayConfigurator));
assert.deepEqual(auxiliary, await executeControls((deps: any) => reference(deps, controls.createSettingsWindowControls, production.createTrayConfigurator)));
assert.deepEqual(auxiliary, await executeControls(production.createSettingsTrayControllers));
// Tray matrix controls the settings action; complete composition is checked through root traces.
function executeTray(assemble: Function) {
  return exerciseTrayConfiguration((deps: any) => assemble({ ...deps, managerState: {}, windowOwnershipState: { trayOwnership: { getTray: deps.getTray, getMainWindow: deps.getMainWindow, markQuitting: deps.markQuitting } } },
    () => ({ openSettingsWindow: deps.openSettingsWindow }), production.createTrayConfigurator).configureTray);
}
const tray = executeTray(actual); assert.deepEqual(tray, executeTray(reference)); assert.deepEqual(tray, exerciseTrayConfiguration());
console.log(`Settings/tray assembly passed: 3 constructor boundaries, forwarding/return/error identity and live owner isolation; ${auxiliary.length} auxiliary + ${tray.length} tray cases${process.argv[2] ? ', original calls and remaining root AST' : ''}.`);
