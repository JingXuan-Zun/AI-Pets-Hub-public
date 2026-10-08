import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { readModuleProjectFile } from './projectModuleSource.mjs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

const windowManager = read('../electron/windowManager.cjs');
const windowManagerModules = readModuleProjectFile('electron/windowManager.cjs');
const ipcHandlers = read('../electron/ipcHandlers.cjs');
const preload = read('../electron/preload.cjs');
const controller = read('../src/components/chat/agentRunController.ts');

assert.match(windowManager, /const setAgentDesktopExecutionActive = createAgentDesktopExecutionPolicy\(/u);
const activationModule = read('../electron/windowManager/agentDesktopExecutionPolicy.cjs');
assert.match(
  windowManagerModules,
  /const nextIgnore = getIsAgentDesktopExecutionActive\(\)\s*\? !hasInteractiveWindowShape\(\)\s*:\s*hasPetDragPassthrough\s*\? true\s*:\s*Boolean\(nativeShapeState\.getRequestedPointerPassthrough\(\)\) && !hasFullWindowShape/u,
);
const ast = ts.createSourceFile('agentDesktopExecutionPolicy.cjs', activationModule, ts.ScriptTarget.Latest, true);
let activationSource = '';
function findActivation(node: ts.Node) {
  if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) && node.name?.text === 'setAgentDesktopExecutionActive') {
    assert.equal(activationSource, '');
    activationSource = node.getText(ast);
  }
  ts.forEachChild(node, findActivation);
}
findActivation(ast);
assert.ok(activationSource);
assert.doesNotMatch(activationSource, /setFocusable|setIgnoreMouseEvents/u,
  'desktop execution must leave chat/settings input and focus available');
assert.match(activationSource, /nextActive && win !== getMainWindow\(\)/u);
assert.match(activationSource, /win\.setAlwaysOnTop\(false\)/u);

// Evaluate the real passthrough expression across all 32 state combinations.
const nativeShape = read('../electron/windowManager/nativePointerPassthrough.cjs');
const nativeShapeAst = ts.createSourceFile('nativePointerPassthrough.cjs', nativeShape, ts.ScriptTarget.Latest, true);
let passthroughExpression = '';
function visit(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(nativeShapeAst) === 'nextIgnore'
    && node.initializer && ts.isConditionalExpression(node.initializer)) {
    assert.equal(passthroughExpression, '', 'the policy must have one conditional owner');
    passthroughExpression = node.initializer.getText(nativeShapeAst);
  }
  ts.forEachChild(node, visit);
}
visit(nativeShapeAst);
assert.ok(passthroughExpression);
for (const active of [false, true]) for (const interactive of [false, true])
for (const dragging of [false, true]) for (const requested of [false, true])
for (const full of [false, true]) {
  const actual = vm.runInNewContext(passthroughExpression, {
    getIsAgentDesktopExecutionActive: () => active,
    hasInteractiveWindowShape: () => interactive,
    hasPetDragPassthrough: dragging,
    nativeShapeState: { getRequestedPointerPassthrough: () => requested },
    hasFullWindowShape: full,
  });
  const expected = active ? !interactive : dragging || (requested && !full);
  assert.equal(actual, expected);
}

// Execute the actual activation function with shell-window spies. Repeated
// activation is idempotent, and closing an auxiliary window is tolerated.
const calls: unknown[][] = [];
const makeWindow = (name: string, destroyed = false) => ({
  isDestroyed: () => destroyed,
  setAlwaysOnTop: (value: boolean) => calls.push([name, 'topmost', value]),
  setFocusable: () => assert.fail('activation must not change shell focusability'),
  setIgnoreMouseEvents: () => assert.fail('activation must not disable auxiliary input'),
});
const context = vm.createContext({
  isAgentDesktopExecutionActive: false,
  mainWindow: makeWindow('main'), chatWindow: makeWindow('chat'), settingsWindow: makeWindow('settings', true),
  topmostStateByWindow: { delete: () => calls.push(['delete-topmost']) },
  applyInteractiveWindowShape: () => calls.push(['shape']),
  applyPointerPassthroughState: () => calls.push(['passthrough']),
  keepWindowOnTop: () => calls.push(['main-topmost']),
  keepAuxWindowsOnTop: () => calls.push(['aux-topmost']),
  MAIN_TOPMOST_RELATIVE_LEVEL: 1,
});
const activation = createRequire(import.meta.url)('../electron/windowManager/agentDesktopExecutionPolicy.cjs').createAgentDesktopExecutionPolicy({
  ...context, getIsActive: () => context.isAgentDesktopExecutionActive,
  setIsActive: (active: boolean) => { context.isAgentDesktopExecutionActive = active; },
  getMainWindow: () => context.mainWindow, getChatWindow: () => context.chatWindow,
  getSettingsWindow: () => context.settingsWindow,
});
activation(true); activation(true);
assert.deepEqual(calls, [['chat', 'topmost', false], ['delete-topmost'], ['passthrough']]);
calls.length = 0;
activation(false);
assert.deepEqual(calls, [['shape'], ['passthrough'], ['main-topmost'], ['aux-topmost']]);

assert.match(ipcHandlers, /registerLoggedHandle\([\s\S]*desktop-pet:set-agent-desktop-execution-active/u);
assert.match(preload, /ipcRenderer\.invoke\('desktop-pet:set-agent-desktop-execution-active'/u);
assert.doesNotMatch(
  controller,
  /setAgentDesktopExecutionActive\(/u,
  'Agent runs must not make the desktop pet windows non-interactive',
);

console.log('agent desktop execution window isolation smoke ok');
