const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { expandWindowManagerStateSource } = require('./windowManagerStateAssemblySource.cjs');
const root = fs.readFileSync('electron/windowManager.cjs', 'utf8');
const source = fs.readFileSync('electron/windowManager/windowManagerStateControllers.cjs', 'utf8');
const parse = text => ts.createSourceFile('windowManager.cjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const factory = tree => tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createWindowManager');
function tokens(text) {
  const tree = parse(text), fn = factory(tree), printer = ts.createPrinter({ removeComments: true });
  assert.deepEqual(tree.parseDiagnostics, [], 'Reference and expanded composition must parse successfully');
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, printer.printNode(ts.EmitHint.Unspecified, fn, tree));
  const result = [];
  for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) result.push([kind, scanner.getTokenText()]);
  return result;
}
const expanded = expandWindowManagerStateSource(root), expandedTree = parse(expanded);
const stages = factory(expandedTree).body.statements.filter(ts.isVariableStatement);
const names = ['createWindowManagerActions', 'createWindowOwnershipStateAdapters', 'createWindowManagerStateControls'];
const moved = stages.filter(n => n.declarationList.declarations.some(d => d.initializer && ts.isCallExpression(d.initializer) && names.includes(d.initializer.expression.getText(expandedTree))));
assert.equal(moved.length, 3);
assert.deepEqual(tokens('function createWindowManager() {' + moved.map(n => n.getText(expandedTree)).join('\n') + '}'), tokens('function createWindowManager() {' + "  const { hideMainWindow, createTray, setSettingsOpen } = createWindowManagerActions({\n    managerState, Tray,\n    hidePostDragInputProxy: (reason, destroy) => hidePostDragInputProxy(reason, destroy),\n    resolveTrayIcon: () => resolveTrayIcon(), configureTray: () => configureTray(),\n    resizeWindowForSettings: (isOpen) => resizeWindowForSettings(isOpen),\n  });\n  const windowOwnershipState = createWindowOwnershipStateAdapters(managerState);\n  const { getMainWindow, getSettingsWindow, getChatWindow, getShellRendererWindows, setQuitting, setSharedState, getSharedState }\n    = createWindowManagerStateControls({\n    managerState,\n    syncInteractiveChatWindowBounds: () => syncInteractiveChatWindowBounds(),\n    broadcastSharedState: () => broadcastSharedState(),\n  });\n" + '}'));
if (process.argv[2]) assert.deepEqual(tokens(expanded), tokens(fs.readFileSync(process.argv[2], 'utf8')), 'All remaining root composition, callbacks and Agent policy remain equivalent');
const tree = parse(root), body = factory(tree).body.statements;
const binding = body.find(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.initializer && ts.isCallExpression(d.initializer) && d.initializer.expression.getText(tree) === 'createWindowManagerStateControllers'));
assert.ok(binding);
assert.equal(body[body.indexOf(binding) - 1].declarationList.declarations[0].initializer.expression.getText(tree), 'createWindowManagerState');
assert.equal(body[body.indexOf(binding) + 1].declarationList.declarations[0].name.getText(tree), 'isAgentDesktopExecutionActive');
const options = binding.declarationList.declarations[0].initializer.arguments[0].properties;
assert.deepEqual(options.map(p => p.name.getText(tree)), ['managerState', 'Tray', 'hidePostDragInputProxy', 'resolveTrayIcon', 'configureTray', 'resizeWindowForSettings', 'syncInteractiveChatWindowBounds', 'broadcastSharedState']);
assert.ok(options.slice(0, 2).every(ts.isShorthandPropertyAssignment));
assert.ok(options.slice(2).every(p => ts.isPropertyAssignment(p) && ts.isArrowFunction(p.initializer)));
const moduleTree = parse(source), phase = moduleTree.statements.find(ts.isFunctionDeclaration);
const compile = new Function(...names, 'return ' + phase.getText(moduleTree));
const outputKeys = binding.declarationList.declarations[0].name.elements.map(n => n.name.getText(tree));
for (const failure of [-1, 0, 1, 2]) {
  const marker = new Error('constructor failure'), calls = [], state = {}, dependencies = Object.fromEntries(options.map(p => [p.name.getText(tree), p.name.getText(tree) === 'managerState' ? state : () => { throw new Error('eager callback'); }]));
  const values = [Object.fromEntries(outputKeys.slice(0, 3).map(key => [key, {}])), {}, Object.fromEntries(outputKeys.slice(4).map(key => [key, {}]))];
  const ctors = names.map((name, index) => args => {
    calls.push(name);
    if (index === 1) assert.equal(args, state);
    else {
      const expected = index === 0 ? ['managerState', 'Tray', 'hidePostDragInputProxy', 'resolveTrayIcon', 'configureTray', 'resizeWindowForSettings'] : ['managerState', 'syncInteractiveChatWindowBounds', 'broadcastSharedState'];
      assert.deepEqual(Object.keys(args), expected);
      for (const key of expected) assert.equal(args[key], dependencies[key]);
    }
    if (failure === index) throw marker;
    return values[index];
  });
  if (failure === -1) {
    const api = compile(...ctors)(dependencies); assert.deepEqual(Object.keys(api), outputKeys);
    for (const key of outputKeys) assert.equal(api[key], key === 'windowOwnershipState' ? values[1] : values[0][key] ?? values[2][key]);
  } else assert.throws(() => compile(...ctors)(dependencies), error => error === marker);
  assert.deepEqual(calls, names.slice(0, failure === -1 ? 3 : failure + 1));
}
const actual = require('../electron/windowManager/windowManagerStateControllers.cjs').createWindowManagerStateControllers;
const stateFactory = require('../electron/windowManager/windowManagerState.cjs').createWindowManagerState;
const events = [];
function create() {
  const state = stateFactory();
  const api = actual({ managerState: state, Tray: class { constructor(icon) { events.push(['tray', icon]); } },
    hidePostDragInputProxy: (...args) => events.push(['hide-proxy', ...args]), resolveTrayIcon: () => 'icon',
    configureTray: () => events.push(['configure']), resizeWindowForSettings: value => events.push(['resize', value]),
    syncInteractiveChatWindowBounds: () => events.push(['sync']), broadcastSharedState: () => events.push(['broadcast']) });
  return { state, api };
}
const first = create(), peer = create(); assert.deepEqual(events, []);
const win = { hide() { events.push(['hide']); }, isDestroyed() { return false; } };
first.api.windowOwnershipState.mainCreation.setMainWindow(win);
assert.equal(first.api.getMainWindow(), win); assert.equal(peer.api.getMainWindow(), null);
first.api.hideMainWindow(); first.api.createTray(); first.api.setSettingsOpen(1);
const shared = {}; first.api.setSharedState(shared); assert.equal(first.api.getSharedState(), shared); assert.equal(peer.api.getSharedState(), null);
first.api.windowOwnershipState.trayOwnership.markQuitting(); assert.equal(first.state.isQuitting, true); assert.equal(peer.state.isQuitting, false);
assert.deepEqual(events, [['hide-proxy', 'main-window-hidden', true], ['hide'], ['tray', 'icon'], ['configure'], ['resize', true], ['sync'], ['broadcast']]);
const error = new Error('sync'); const state = stateFactory();
const failureApi = actual({ managerState: state, syncInteractiveChatWindowBounds() { throw error; }, broadcastSharedState() { assert.fail('broadcast after failed sync'); } });
assert.throws(() => failureApi.setSharedState(shared), caught => caught === error); assert.equal(state.latestSharedState, shared);
console.log('Window state controller assembly passed: original stage/root AST, 4 constructor boundaries, reference forwarding, shared ownership/action/control state, isolation and sync failure ordering.');
