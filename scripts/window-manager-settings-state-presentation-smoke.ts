import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { exerciseSettingsDisplayRefresh } from './window-manager-settings-display-refresh-smoke.ts';
import { exerciseSettingsContentScheduler } from './window-manager-settings-content-scheduler-smoke.ts';
import { exerciseSettingsWindowPresentation } from './window-manager-settings-presentation-smoke.ts';
const require = createRequire(import.meta.url);
const production = require('../electron/windowManager/settingsPresentationControllers.cjs');
const parse = (text: string) => ts.createSourceFile('windowManager.cjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const name = 'createSettingsStatePresentationControllers', lower = 'createSettingsPresentationControllers';
const moduleTree = parse(fs.readFileSync('electron/windowManager/settingsPresentationControllers.cjs', 'utf8'));
const phase = moduleTree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name) as ts.FunctionDeclaration;
const returned = phase.body!.statements.find(ts.isReturnStatement)!.expression as ts.CallExpression;
const printer = ts.createPrinter({ removeComments: true });
function canonical(node: ts.Node, tree: ts.SourceFile) {
  const transformed = ts.transform(node, [context => {
    function visit(node: ts.Node): ts.VisitResult<ts.Node> {
      if (ts.isPropertyAssignment(node) && ts.isArrowFunction(node.initializer) && ['getCurrentTime', 'refreshSettingsWindowContent', 'setTimeout', 'clearTimeout'].includes(node.name.getText(tree))) {
        const key = node.name.getText(tree), expected = { getCurrentTime: '() => Date.now()', refreshSettingsWindowContent: '(force) => refreshSettingsWindowContent(force)', setTimeout: '(callback, delay) => setTimeout(callback, delay)', clearTimeout: '(timer) => clearTimeout(timer)' }[key];
        assert.equal(node.initializer.getText(tree), expected); return ts.factory.createShorthandPropertyAssignment(key);
      }
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
const originalBody = "return createSettingsPresentationControllers({\ngetSettingsWindow: () => managerState.settingsWindow,\ngetMainWindow: () => managerState.mainWindow,\ngetDisplayRefreshTimer: () => managerState.settingsWindowDisplayRefreshTimer,\nsetDisplayRefreshTimer: (timer) => { managerState.settingsWindowDisplayRefreshTimer = timer; },\nsetTimeout,\nclearTimeout,\ncaptureService,\nSETTINGS_WINDOW_SHOW_DISPLAY_REFRESH_DELAY_MS,\ngetContentRefreshAt: () => managerState.settingsWindowContentRefreshAt,\nsetContentRefreshAt: (value) => { managerState.settingsWindowContentRefreshAt = value; },\ngetCurrentTime,\nSETTINGS_WINDOW_CONTENT_REFRESH_COOLDOWN_MS,\nrefreshSettingsWindowContent,\ngetSettingsPanelWindowBounds,\nisSettingsWindowAtSettingsPanelUrl,\nlogWindowEvent,\nloadRenderer,\nHIDE_MAIN_WINDOW_FOR_GRAPH_DIAGNOSTICS,\nscheduleKeepWindowOnTop,\nAUX_TOPMOST_RELATIVE_LEVEL,\nscheduleWindowStackOnTop,\nnotifySettingsWindowState,\n});";
const reference = compile(originalBody);
assert.equal(canonical(returned, moduleTree), canonical((parse(originalBody).statements[0] as ts.ReturnStatement).expression!, parse(originalBody)));
const rootText = fs.readFileSync('electron/windowManager.cjs', 'utf8'), rootTree = parse(rootText);
function binding(tree: ts.SourceFile, target: string) {
  const factory = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'createWindowManager') as ts.FunctionDeclaration;
  return factory.body!.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(d => d.initializer && ts.isCallExpression(d.initializer) && d.initializer.expression.getText(tree) === target)) as ts.VariableStatement;
}
const rootBinding = binding(rootTree, name); assert.ok(rootBinding);
const declaration = rootBinding.declarationList.declarations[0];
assert.deepEqual((declaration.name as ts.ObjectBindingPattern).elements.map(n => n.name.getText(rootTree)), ['scheduleSettingsWindowDisplayRefresh', 'scheduleSettingsWindowContentRefresh', 'showSettingsWindow']);
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
const callbacks = ['getSettingsWindow', 'getMainWindow', 'getDisplayRefreshTimer', 'setDisplayRefreshTimer', 'getContentRefreshAt', 'setContentRefreshAt'];
function exercise(assemble: Function) {
  const outcomes = [];
  for (const callback of callbacks) for (const mode of ['undefined', 'null', 'false', 'number', 'string', 'object', 'symbol', 'read-error', 'write-error', 'coercion-error']) {
    const marker = {}, writes: unknown[] = [], reads: unknown[] = [], error = new Error(mode);
    const value: any = mode === 'undefined' ? undefined : mode === 'null' ? null : mode === 'false' ? false : mode === 'number' ? 2 : mode === 'string' ? '2' : mode === 'symbol' ? Symbol('value') : mode === 'coercion-error' ? { valueOf() { throw error; } } : marker;
    const state = new Proxy({}, { get(_target, key) { reads.push(String(key)); if (mode === 'read-error') throw error; return value; }, set(_target, key, value) { writes.push([String(key), value === marker ? 'marker' : value]); if (mode === 'write-error') throw error; return true; } });
    const deps: any = Object.fromEntries(params.map(key => [key, () => marker])); deps.managerState = state;
    let captured: any; const result = assemble(deps, (input: any) => { captured = input; return marker; });
    assert.equal(result, marker); assert.deepEqual(reads, []); assert.deepEqual(writes, []);
    for (const key of params.filter(key => key !== 'managerState')) assert.equal(captured[key], deps[key], key);
    let returned: any, caught: any; try { returned = captured[callback](marker); } catch (e) { caught = e; }
    outcomes.push({ callback, mode, reads, writes: writes.map(([key, value]: any) => [key, typeof value === 'symbol' ? 'symbol' : value]), returned: returned === marker ? 'marker' : returned === value && mode === 'coercion-error' ? 'coercion-value' : typeof returned === 'symbol' ? 'symbol' : returned, caught: caught === error ? 'original-error' : caught?.constructor.name });
  }
  return outcomes;
}
const outcomes = exercise(actual); assert.deepEqual(outcomes, exercise(reference));
for (const assemble of [actual, reference]) {
  const error = new Error('lower constructor'); assert.throws(() => assemble({ managerState: {} }, () => { throw error; }), e => e === error);
  const left: any = { settingsWindow: {} }, right: any = { settingsWindow: {} };
  const capture = (state: any) => assemble({ managerState: state }, (input: any) => input);
  const first = capture(left), second = capture(right); first.setDisplayRefreshTimer('left'); assert.equal(left.settingsWindowDisplayRefreshTimer, 'left'); assert.equal(right.settingsWindowDisplayRefreshTimer, undefined); assert.equal(second.getSettingsWindow(), right.settingsWindow);
  right.settingsWindow = {}; assert.equal(second.getSettingsWindow(), right.settingsWindow); left.settingsWindowContentRefreshAt = 137; assert.equal(first.getContentRefreshAt(), 137);
}
function exerciseExecution(assemble: Function) {
  const getters: Record<string, string> = { settingsWindow: 'getSettingsWindow', mainWindow: 'getMainWindow', settingsWindowDisplayRefreshTimer: 'getDisplayRefreshTimer', settingsWindowContentRefreshAt: 'getContentRefreshAt' };
  const setters: Record<string, string> = { settingsWindowDisplayRefreshTimer: 'setDisplayRefreshTimer', settingsWindowContentRefreshAt: 'setContentRefreshAt' };
  const build = (deps: any) => {
    let accesses = 0;
    const state = new Proxy({}, {
      get(_target, key) { accesses++; assert.ok(typeof key === 'string' && key in getters); return deps[getters[key as string]](); },
      set(_target, key, value) { accesses++; assert.ok(typeof key === 'string' && key in setters); deps[setters[key as string]](value); return true; },
    });
    const api = assemble({ ...deps, managerState: state }); assert.equal(accesses, 0, 'No eager state access'); return api;
  };
  return {
    display: exerciseSettingsDisplayRefresh((deps: any) => build(deps).scheduleSettingsWindowDisplayRefresh),
    content: exerciseSettingsContentScheduler((deps: any) => build(deps).scheduleSettingsWindowContentRefresh),
  };
}
const executions = exerciseExecution((deps: any) => actual(deps, production.createSettingsPresentationControllers));
assert.deepEqual(executions, exerciseExecution((deps: any) => reference(deps, production.createSettingsPresentationControllers)));
assert.deepEqual(executions, exerciseExecution(production.createSettingsStatePresentationControllers));
assert.deepEqual(executions.display, exerciseSettingsDisplayRefresh());
assert.deepEqual(executions.content, exerciseSettingsContentScheduler());
// Presenter matrix controls the content scheduler; the complete combination is covered by root traces.
const lowerFactory = moduleTree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === lower)!;
const partialLower = new Function('deps', 'createSettingsWindowDisplayRefreshScheduler', 'createSettingsWindowContentScheduler', 'createSettingsWindowPresenter', lowerFactory.getText(moduleTree) + ';return ' + lower + '(deps);');
function exercisePresenter(assemble: Function) {
  return exerciseSettingsWindowPresentation((deps: any) => {
    let accesses = 0;
    const state = new Proxy({}, { get(_target, key) { accesses++; if (key === 'settingsWindow') return deps.getSettingsWindow(); if (key === 'mainWindow') return deps.getMainWindow(); throw new Error('Unexpected state read'); } });
    const api = assemble({ ...deps, managerState: state }, (input: any) => partialLower(input,
      require('../electron/windowManager/settingsWindowDisplayRefresh.cjs').createSettingsWindowDisplayRefreshScheduler,
      () => deps.scheduleSettingsWindowContentRefresh,
      require('../electron/windowManager/settingsWindowPresentation.cjs').createSettingsWindowPresenter));
    assert.equal(accesses, 0); return api.showSettingsWindow;
  });
}
const presentation = exercisePresenter(actual); assert.deepEqual(presentation, exercisePresenter(reference));
assert.deepEqual(presentation, exerciseSettingsWindowPresentation());
console.log(`Settings state presentation assembly passed: ${outcomes.length} state/error cases, forwarding, return/error identity, independent live owners, root clock/timer/refresh callbacks; execution ${executions.display.length} display + ${executions.content.length} content + ${presentation.length} presentation${process.argv[2] ? ', original call and remaining root AST' : ''}.`);
