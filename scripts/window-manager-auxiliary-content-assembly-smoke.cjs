const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { expandAuxiliaryWindowContentSource } = require('./windowManagerAuxiliaryAssemblySource.mjs');
const root = fs.readFileSync('electron/windowManager.cjs', 'utf8');
const source = fs.readFileSync('electron/windowManager/auxiliaryWindowContentControllers.cjs', 'utf8');
const parse = text => ts.createSourceFile('windowManager.cjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const factory = tree => tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createWindowManager');
function tokens(text) {
  const tree = parse(text); assert.deepEqual(tree.parseDiagnostics, []);
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, ts.createPrinter({ removeComments: true }).printNode(ts.EmitHint.Unspecified, factory(tree), tree));
  const result = [];
  for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) result.push([kind, scanner.getTokenText()]);
  return result;
}
const names = ['createAuxiliaryWindowCreationControllers', 'createSettingsWindowContentRefresh'];
const expanded = expandAuxiliaryWindowContentSource(root), expandedTree = parse(expanded);
const moved = factory(expandedTree).body.statements.filter(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.initializer && ts.isCallExpression(d.initializer) && names.includes(d.initializer.expression.getText(expandedTree))));
assert.equal(moved.length, 2);
assert.deepEqual(tokens('function createWindowManager() {' + moved.map(n => n.getText(expandedTree)).join('\n') + '}'), tokens('function createWindowManager() {' + "const {\n    closeChatWindow, openChatWindow, syncInteractiveChatWindowBounds,\n    ensureSettingsWindowReady, preloadSettingsWindow,\n  } = createAuxiliaryWindowCreationControllers({\n    windowOwnershipState, getBrowserWindowIconOptions, path,\n    baseDirectory: __dirname, sessionPartition, isCurrentWindowCompactMinimumSizeActive,\n    getResolvedChatPanelWindowLimits, isInteractiveDialogueChatActive, getResolvedChatPanelWindowBounds,\n    scheduleKeepWindowOnTop, AUX_TOPMOST_RELATIVE_LEVEL, scheduleWindowStackOnTop,\n    notifyChatWindowState, broadcastSharedState, openExternalSafely,\n    shell, getChatPanelWindowBounds, BrowserWindow,\n    attachLoadLogging, loadRenderer, scheduleSettingsWindowContentRefresh,\n    disableDwmSystemBorderForWindow, notifySettingsWindowState, HIDE_MAIN_WINDOW_FOR_GRAPH_DIAGNOSTICS,\n    showMainWindowWhenReady, SETTINGS_PANEL_WINDOW_BOUNDS, getSettingsPanelWindowBounds,\n    logWindowEvent, waitForSettingsWindowLoad,\n  });\n  const refreshSettingsWindowContent = createSettingsWindowContentRefresh({\n    captureService, scheduleSettingsWindowDisplayRefresh, getShellRendererWindows,\n    DISPLAY_ENVIRONMENT_BROADCAST_DELAY_MS, SETTINGS_WINDOW_SHOW_CAPTURE_REFRESH_DELAY_MS,\n  });" + '}'));
if (process.argv[2]) assert.deepEqual(tokens(expanded), tokens(fs.readFileSync(process.argv[2], 'utf8')), 'All remaining root callbacks, construction and Agent policy remain equivalent');
const tree = parse(root), body = factory(tree).body.statements;
const binding = body.find(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.initializer && ts.isCallExpression(d.initializer) && d.initializer.expression.getText(tree) === 'createAuxiliaryWindowContentControllers'));
assert.ok(binding);
assert.equal(body[body.indexOf(binding) - 1].declarationList.declarations[0].initializer.expression.getText(tree), 'createMainWindowLifecycleControllers');
assert.equal(body[body.indexOf(binding) + 1].declarationList.declarations[0].initializer.expression.getText(tree), 'createAgentDesktopExecutionPolicy');
const options = binding.declarationList.declarations[0].initializer.arguments[0].properties;
const moduleTree = parse(source), phase = moduleTree.statements.find(ts.isFunctionDeclaration);
assert.deepEqual(options.map(p => p.name.getText(tree)), phase.parameters[0].name.elements.map(n => n.name.getText(moduleTree)));
assert.equal(options.length, 34);
for (const p of options) {
  if (p.name.getText(tree) === 'baseDirectory') assert.equal(p.initializer.getText(tree), '__dirname');
  else assert.ok(ts.isShorthandPropertyAssignment(p));
}
const compile = new Function(...names, 'return ' + phase.getText(moduleTree));
const outputKeys = binding.declarationList.declarations[0].name.elements.map(n => n.name.getText(tree));
for (const failure of [-1, 0, 1]) {
  const marker = new Error('constructor failure'), calls = [], dependencies = Object.fromEntries(options.map(p => [p.name.getText(tree), {}]));
  const values = [Object.fromEntries(outputKeys.slice(0, 5).map(key => [key, {}])), {}];
  const ctors = names.map((name, index) => args => {
    calls.push(name);
    const expected = moved[index].declarationList.declarations[0].initializer.arguments[0].properties.map(p => p.name.getText(expandedTree));
    assert.deepEqual(Object.keys(args), expected);
    for (const key of expected) assert.equal(args[key], dependencies[key]);
    if (failure === index) throw marker; return values[index];
  });
  if (failure === -1) {
    const api = compile(...ctors)(dependencies); assert.deepEqual(Object.keys(api), outputKeys);
    for (const key of outputKeys) assert.equal(api[key], key === 'refreshSettingsWindowContent' ? values[1] : values[0][key]);
  } else assert.throws(() => compile(...ctors)(dependencies), error => error === marker);
  assert.deepEqual(calls, names.slice(0, failure === -1 ? 2 : failure + 1));
}
const actual = require('../electron/windowManager/auxiliaryWindowContentControllers.cjs').createAuxiliaryWindowContentControllers;
const state = new Proxy({}, { get() { assert.fail('eager state read'); }, set() { assert.fail('eager state write'); } });
const ownership = require('../electron/windowManager/windowOwnershipStateAdapters.cjs').createWindowOwnershipStateAdapters(state);
const lazyDeps = Object.fromEntries(options.map(p => [p.name.getText(tree), () => assert.fail('eager dependency invocation')]));
lazyDeps.windowOwnershipState = ownership;
const api = actual(lazyDeps); assert.deepEqual(Object.keys(api), outputKeys); assert.ok(Object.values(api).every(value => typeof value === 'function'));
const forceValues = [undefined, null, false, 0, '', true, 1, {}, Symbol('force')];
let cases = 0;
for (const force of forceValues) for (const failure of [null, 'display', 'windows', 'environment', 'capture']) {
  const calls = [], error = new Error('refresh boundary'), windows = [], deps = { ...lazyDeps };
  function step(name) { calls.push(name); if (failure === name) throw error; }
  deps.scheduleSettingsWindowDisplayRefresh = () => step('display');
  deps.getShellRendererWindows = () => { step('windows'); return windows; };
  deps.DISPLAY_ENVIRONMENT_BROADCAST_DELAY_MS = 17; deps.SETTINGS_WINDOW_SHOW_CAPTURE_REFRESH_DELAY_MS = 29;
  deps.captureService = {
    scheduleDisplayEnvironmentBroadcast(args) { assert.deepEqual(args, { includeCaptureSources: false, preferCachedCaptureSources: true, windows, delayMs: 17 }); assert.equal(args.windows, windows); step('environment'); },
    scheduleCaptureSourceRefreshBroadcast(delay, args) { assert.equal(delay, 29); assert.equal(args.force, force); step('capture'); },
  };
  const refresh = actual(deps).refreshSettingsWindowContent; assert.deepEqual(calls, []);
  let caught; try { assert.equal(refresh(force), undefined); } catch (value) { caught = value; }
  const order = ['display', 'windows', 'environment', ...(force ? ['capture'] : [])], failedIndex = order.indexOf(failure);
  assert.deepEqual(calls, failedIndex === -1 ? order : order.slice(0, failedIndex + 1));
  assert.equal(caught, failedIndex === -1 ? undefined : error); cases++;
}
console.log('Auxiliary window/content assembly passed: original stage/root AST, 3 constructor boundaries, all 34 dependencies and six return identities, lazy actual construction, ' + cases + ' actual refresh truthiness/order/failure scenarios.');
