const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { expandWindowPresentationTraySource } = require('./windowManagerAuxiliaryAssemblySource.mjs');
const root = fs.readFileSync('electron/windowManager.cjs', 'utf8');
const source = fs.readFileSync('electron/windowManager/windowPresentationTrayControllers.cjs', 'utf8');
const parse = text => ts.createSourceFile('windowManager.cjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const factory = tree => tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createWindowManager');
function tokens(text) {
  const tree = parse(text); assert.deepEqual(tree.parseDiagnostics, []);
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, ts.createPrinter({ removeComments: true }).printNode(ts.EmitHint.Unspecified, factory(tree), tree));
  const result = [];
  for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) result.push([kind, scanner.getTokenText()]);
  return result;
}
const names = ['createMainWindowPresentationControllers', 'createSettingsTrayControllers'];
const expanded = expandWindowPresentationTraySource(root), expandedTree = parse(expanded);
const moved = factory(expandedTree).body.statements.filter(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.initializer && ts.isCallExpression(d.initializer) && names.includes(d.initializer.expression.getText(expandedTree))));
assert.equal(moved.length, 2);
assert.deepEqual(tokens('function createWindowManager() {' + moved.map(n => n.getText(expandedTree)).join('\n') + '}'), tokens('function createWindowManager() {' + "const { clearMainInteractiveLayerWarmupTimers, scheduleMainInteractiveLayerWarmup, showMainWindow } = createMainWindowPresentationControllers({\n    managerState, getPlatform: () => process.platform, PREWARM_MAIN_INTERACTIVE_LAYER,\n    warmMainInteractiveLayer, MAIN_INTERACTIVE_LAYER_WARMUP_DELAY_MS,\n    setTimeout: (callback, delay) => setTimeout(callback, delay), clearTimeout: (timer) => clearTimeout(timer),\n    scheduleKeepWindowOnTop, MAIN_TOPMOST_RELATIVE_LEVEL, scheduleWindowStackOnTop,\n  });\n  const { closeSettingsWindow, openSettingsWindow, configureTray } = createSettingsTrayControllers({\n    managerState, ensureSettingsWindowReady: () => ensureSettingsWindowReady(),\n    showSettingsWindow: () => showSettingsWindow(),\n    reportOpenSettingsError: (error) => console.error('Failed to open settings window:', error),\n    windowOwnershipState, Menu, app, showMainWindow, hideMainWindow,\n  });" + '}'));
if (process.argv[2]) assert.deepEqual(tokens(expanded), tokens(fs.readFileSync(process.argv[2], 'utf8')), 'All remaining root callbacks, construction and Agent policy remain equivalent');
const tree = parse(root), body = factory(tree).body.statements;
const binding = body.find(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.initializer && ts.isCallExpression(d.initializer) && d.initializer.expression.getText(tree) === 'createWindowPresentationTrayControllers'));
assert.ok(binding);
assert.equal(body[body.indexOf(binding) - 1].declarationList.declarations[0].initializer.expression.getText(tree), 'createWindowManagerPlacementControllers');
assert.equal(body[body.indexOf(binding) + 1].declarationList.declarations[0].initializer.expression.getText(tree), 'createPostDragInputProxyStateLifecycle');
const options = binding.declarationList.declarations[0].initializer.arguments[0].properties;
const moduleTree = parse(source), phase = moduleTree.statements.find(ts.isFunctionDeclaration);
assert.deepEqual(options.map(p => p.name.getText(tree)), phase.parameters[0].name.elements.map(n => n.name.getText(moduleTree)));
assert.equal(options.length, 17);
for (const p of options) {
  if (['getPlatform', 'setTimeout', 'clearTimeout', 'ensureSettingsWindowReady', 'showSettingsWindow', 'reportOpenSettingsError'].includes(p.name.getText(tree))) assert.ok(ts.isArrowFunction(p.initializer));
  else assert.ok(ts.isShorthandPropertyAssignment(p));
}
const compile = new Function(...names, 'return ' + phase.getText(moduleTree));
const outputKeys = binding.declarationList.declarations[0].name.elements.map(n => n.name.getText(tree));
for (const failure of [-1, 0, 1]) {
  const marker = new Error('constructor failure'), calls = [], dependencies = Object.fromEntries(options.map(p => [p.name.getText(tree), {}]));
  const values = [Object.fromEntries(outputKeys.slice(0, 3).map(key => [key, {}])), Object.fromEntries(outputKeys.slice(3).map(key => [key, {}]))];
  const ctors = names.map((name, index) => args => {
    calls.push(name);
    const expected = moved[index].declarationList.declarations[0].initializer.arguments[0].properties.map(p => p.name.getText(expandedTree));
    assert.deepEqual(Object.keys(args), expected);
    for (const key of expected) assert.equal(args[key], index === 1 && Object.hasOwn(values[0], key) ? values[0][key] : dependencies[key]);
    if (failure === index) throw marker; return values[index];
  });
  if (failure === -1) {
    const api = compile(...ctors)(dependencies); assert.deepEqual(Object.keys(api), outputKeys);
    for (const key of outputKeys) assert.equal(api[key], values[0][key] ?? values[1][key]);
  } else assert.throws(() => compile(...ctors)(dependencies), error => error === marker);
  assert.deepEqual(calls, names.slice(0, failure === -1 ? 2 : failure + 1));
}
const actual = require('../electron/windowManager/windowPresentationTrayControllers.cjs').createWindowPresentationTrayControllers;
const stateFactory = require('../electron/windowManager/windowManagerState.cjs').createWindowManagerState;
const ownershipFactory = require('../electron/windowManager/windowOwnershipStateAdapters.cjs').createWindowOwnershipStateAdapters;
const state = new Proxy({}, { get() { assert.fail('eager state read'); }, set() { assert.fail('eager state write'); } });
const lazyDeps = Object.fromEntries(options.map(p => [p.name.getText(tree), () => assert.fail('eager dependency invocation')]));
lazyDeps.managerState = state; lazyDeps.windowOwnershipState = ownershipFactory(state);
const api = actual(lazyDeps); assert.deepEqual(Object.keys(api), outputKeys); assert.ok(Object.values(api).every(value => typeof value === 'function'));
for (const failure of [false, true]) {
  const events = [], owned = stateFactory(), peer = stateFactory(), error = new Error('show'); let menu, doubleClick;
  function window(label) { return { isDestroyed: () => false, isMinimized: () => false, isVisible: () => false,
    showInactive() { events.push(['show', label]); if (failure) throw error; } }; }
  owned.mainWindow = window('first');
  owned.tray = { setToolTip(value) { events.push(['tooltip', value]); }, setContextMenu(value) { events.push(['context', value]); }, on(name, callback) { events.push(['on', name]); doubleClick = callback; } };
  const trayMenu = {};
  const deps = { ...lazyDeps, managerState: owned, windowOwnershipState: ownershipFactory(owned),
    getPlatform: () => 'linux', PREWARM_MAIN_INTERACTIVE_LAYER: false,
    Menu: { buildFromTemplate(value) { menu = value; events.push(['menu']); return trayMenu; } },
    app: { quit() { assert.equal(owned.isQuitting, true); events.push(['quit']); } },
    hideMainWindow: () => events.push(['hide']), scheduleKeepWindowOnTop: (win, level, opts) => { assert.equal(win, owned.mainWindow); assert.equal(level, 7); assert.deepEqual(opts, { bringToFront: true }); events.push(['topmost']); },
    MAIN_TOPMOST_RELATIVE_LEVEL: 7, scheduleWindowStackOnTop: () => events.push(['stack']),
  };
  const controllers = actual(deps); assert.deepEqual(events, []);
  controllers.configureTray(); assert.deepEqual(events, [['tooltip', 'AI Desktop Pet'], ['menu'], ['context', trayMenu], ['on', 'double-click']]);
  events.length = 0;
  if (failure) assert.throws(() => menu[0].click(), caught => caught === error);
  else assert.equal(menu[0].click(), undefined);
  assert.deepEqual(events, failure ? [['show', 'first']] : [['show', 'first'], ['topmost'], ['stack']]);
  owned.mainWindow = window('latest'); events.length = 0;
  if (failure) assert.throws(() => doubleClick(), caught => caught === error);
  else assert.equal(doubleClick(), undefined);
  assert.deepEqual(events, failure ? [['show', 'latest']] : [['show', 'latest'], ['topmost'], ['stack']]);
  events.length = 0; menu[2].click(); menu[4].click(); assert.deepEqual(events, [['hide'], ['quit']]);
  assert.equal(peer.isQuitting, false); assert.equal(peer.mainWindow, null);
}
console.log('Window presentation/tray assembly passed: original stage/root AST, 3 constructor boundaries, 17 dependencies, presentation-to-tray reference, six return identities, lazy actual assembly, live menu/double-click presentation, show error identity and quit ordering.');
