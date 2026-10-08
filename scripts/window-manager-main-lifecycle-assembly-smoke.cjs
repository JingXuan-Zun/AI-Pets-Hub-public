const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { expandMainWindowLifecycleSource } = require('./windowManagerAuxiliaryAssemblySource.mjs');
const root = fs.readFileSync('electron/windowManager.cjs', 'utf8');
const source = fs.readFileSync('electron/windowManager/mainWindowLifecycleControllers.cjs', 'utf8');
const parse = text => ts.createSourceFile('windowManager.cjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const factory = tree => tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createWindowManager');
function tokens(text) {
  const tree = parse(text); assert.deepEqual(tree.parseDiagnostics, []);
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, ts.createPrinter({ removeComments: true }).printNode(ts.EmitHint.Unspecified, factory(tree), tree));
  const result = [];
  for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) result.push([kind, scanner.getTokenText()]);
  return result;
}
const names = ['createMainWindowStateRecoveryControllers', 'createMainWindowStateCreationControllers'];
const expanded = expandMainWindowLifecycleSource(root), expandedTree = parse(expanded);
const moved = factory(expandedTree).body.statements.filter(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.initializer && ts.isCallExpression(d.initializer) && names.includes(d.initializer.expression.getText(expandedTree))));
assert.equal(moved.length, 2);
assert.deepEqual(tokens('function createWindowManager() {' + moved.map(n => n.getText(expandedTree)).join('\n') + '}'), tokens('function createWindowManager() {' + "const {\n    showMainWindowWhenReady, markMainWindowReadyToShow, recoverMainWindowRenderer,\n    scheduleMainWindowRendererReadyFallback, showOrRecoverMainWindow,\n  } = createMainWindowStateRecoveryControllers({\n    managerState, logWindowEvent, showMainWindow, hidePostDragInputProxy,\n    createWindowForRecovery: () => createWindow(), createWindowForHealth: () => createWindow(),\n    setTimeout: (callback, delay) => setTimeout(callback, delay), clearTimeout: (timer) => clearTimeout(timer),\n    MAIN_WINDOW_RENDERER_READY_TIMEOUT_MS, MAIN_WINDOW_RENDERER_STARTUP_RECOVERY_LIMIT, MAIN_WINDOW_RENDERER_HEALTH_TIMEOUT_MS,\n  });\n  const createWindow = createMainWindowStateCreationControllers({\n    managerState, pointerDiagnosticsEnabled, hideMainWindow, logWindowEvent,\n    applyPostDragInputProxyRegions, scheduleWindowStackOnTop, showMainWindowWhenReady,\n    openExternalSafely, shell, notifySettingsWindowState,\n    notifyChatWindowState, broadcastSharedState, captureService,\n    getShellRendererWindows, recoverMainWindowRenderer, COMPACT_WINDOW_BOUNDS,\n    getBrowserWindowIconOptions, path, baseDirectory: __dirname,\n    sessionPartition, windowOwnershipState, showOrRecoverMainWindow,\n    BrowserWindow, attachLoadLogging, resizeWindowForSettings,\n    startMainTopmostGuard, setWindowPointerPassthrough, USE_SEPARATE_RENDER_AND_INPUT_WINDOWS,\n    ensurePostDragInputProxyWindow, scheduleMainWindowRendererReadyFallback, isDev,\n    getOpenDevTools: () => process.env.DESKTOP_PET_OPEN_DEVTOOLS, loadRenderer,\n  });" + '}'));
if (process.argv[2]) assert.deepEqual(tokens(expanded), tokens(fs.readFileSync(process.argv[2], 'utf8')), 'All remaining root callbacks, construction and Agent policy remain equivalent');
const tree = parse(root), body = factory(tree).body.statements;
const binding = body.find(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.initializer && ts.isCallExpression(d.initializer) && d.initializer.expression.getText(tree) === 'createMainWindowLifecycleControllers'));
assert.ok(binding);
assert.equal(body[body.indexOf(binding) - 1].declarationList.declarations[0].initializer.expression.getText(tree), 'createSettingsStatePresentationControllers');
assert.equal(body[body.indexOf(binding) + 1].declarationList.declarations[0].initializer.expression.getText(tree), 'createAuxiliaryWindowContentControllers');
const options = binding.declarationList.declarations[0].initializer.arguments[0].properties;
const moduleTree = parse(source), phase = moduleTree.statements.find(ts.isFunctionDeclaration);
assert.deepEqual(options.map(p => p.name.getText(tree)), phase.parameters[0].name.elements.map(n => n.name.getText(moduleTree)));
assert.equal(options.length, 38);
for (const p of options) {
  if (p.name.getText(tree) === 'baseDirectory') assert.equal(p.initializer.getText(tree), '__dirname');
  else if (['createWindowForRecovery', 'createWindowForHealth', 'setTimeout', 'clearTimeout', 'getOpenDevTools'].includes(p.name.getText(tree))) assert.ok(ts.isArrowFunction(p.initializer));
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
    for (const key of expected) assert.equal(args[key], index === 1 && Object.hasOwn(values[0], key) ? values[0][key] : dependencies[key]);
    if (failure === index) throw marker; return values[index];
  });
  if (failure === -1) {
    const api = compile(...ctors)(dependencies); assert.deepEqual(Object.keys(api), outputKeys);
    for (const key of outputKeys) assert.equal(api[key], key === 'createWindow' ? values[1] : values[0][key]);
  } else assert.throws(() => compile(...ctors)(dependencies), error => error === marker);
  assert.deepEqual(calls, names.slice(0, failure === -1 ? 2 : failure + 1));
}
const actual = require('../electron/windowManager/mainWindowLifecycleControllers.cjs').createMainWindowLifecycleControllers;
const state = new Proxy({}, { get() { assert.fail('eager state read'); }, set() { assert.fail('eager state write'); } });
const ownership = require('../electron/windowManager/windowOwnershipStateAdapters.cjs').createWindowOwnershipStateAdapters(state);
const lazyDeps = Object.fromEntries(options.map(p => [p.name.getText(tree), () => assert.fail('eager dependency invocation')]));
lazyDeps.managerState = state; lazyDeps.windowOwnershipState = ownership;
const api = actual(lazyDeps); assert.deepEqual(Object.keys(api), outputKeys); assert.ok(Object.values(api).every(value => typeof value === 'function'));
const lateProperties = options.filter(p => ['createWindowForRecovery', 'createWindowForHealth'].includes(p.name.getText(tree)));
assert.equal(lateProperties.length, 2);
for (const p of lateProperties) assert.equal(p.initializer.getText(tree), '() => createWindow()');
const makeCallbacks = new Function('read', 'const createWindow = (...args) => read()(...args); return {' + lateProperties.map(p => p.getText(tree)).join(',') + '};');
for (const failure of [false, true]) {
  let published; const marker = {}, error = new Error('creation callback'); const events = [];
  const callbacks = makeCallbacks(() => published);
  assert.notEqual(callbacks.createWindowForRecovery, callbacks.createWindowForHealth);
  const deps = { ...lazyDeps, ...callbacks };
  let forwarded;
  const created = () => { events.push('create'); if (failure) throw error; return marker; };
  const result = compile(args => {
    forwarded = args; return Object.fromEntries(outputKeys.slice(0, 5).map(key => [key, () => marker]));
  }, () => created)(deps);
  assert.deepEqual(events, [], 'Constructor callbacks must remain deferred'); published = result.createWindow;
  assert.equal(forwarded.createWindowForRecovery, callbacks.createWindowForRecovery); assert.equal(forwarded.createWindowForHealth, callbacks.createWindowForHealth);
  for (const name of ['createWindowForRecovery', 'createWindowForHealth']) {
    if (failure) assert.throws(() => forwarded[name](), caught => caught === error);
    else assert.equal(forwarded[name](), marker);
  }
  assert.deepEqual(events, ['create', 'create']);
}
console.log('Main window lifecycle assembly passed: original stage/root AST, 3 constructor boundaries, 38 dependencies, recovery-to-creation references, six return identities, lazy actual assembly and distinct deferred recovery/health callback return/error identity.');
