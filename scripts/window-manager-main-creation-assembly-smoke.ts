import { expandMainWindowLifecycleSource } from './windowManagerAuxiliaryAssemblySource.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const file = 'electron/windowManager/mainWindowCreationControllers.cjs';
const source = fs.readFileSync(file, 'utf8');
const stages = ['createMainWindowPresentationEventRegistrar', 'createMainWindowLoadEventRegistrar',
  'createMainWindowOptionsBuilder', 'createMainWindowCreator'];
for (const failedStage of [undefined, ...stages]) checkAssembly(failedStage);

function checkAssembly(failedStage?: string) {
  const calls: string[] = [], outputs = new Map<string, () => unknown>();
  const error = new Error('main creation assembly failed'), marker = {};
  const dependencies = Object.fromEntries([
    'getMainWindow', 'getIsQuitting', 'hideMainWindow', 'logWindowEvent', 'applyPostDragInputProxyRegions',
    'scheduleWindowStackOnTop', 'markMainWindowCanShow', 'getRendererRecoveryInProgress', 'showMainWindowWhenReady',
    'openExternalSafely', 'notifySettingsWindowState', 'notifyChatWindowState', 'broadcastSharedState',
    'getShellRendererWindows', 'recoverMainWindowRenderer', 'getBrowserWindowIconOptions', 'setMainWindow',
    'setCanShow', 'setRendererRecoveryInProgress', 'setRendererReadyToShow', 'showOrRecoverMainWindow',
    'BrowserWindow', 'attachLoadLogging', 'resizeWindowForSettings', 'startMainTopmostGuard',
    'setWindowPointerPassthrough', 'ensurePostDragInputProxyWindow', 'scheduleMainWindowRendererReadyFallback',
    'getOpenDevTools', 'loadRenderer',
  ].map((name) => [name, () => { throw new Error(`assembly must not invoke ${name}`); }]));
  const keys = ['attachMainWindowPresentationEvents', 'attachMainWindowLoadEvents', 'buildMainWindowOptions', 'createWindow'];
  const modules = Object.fromEntries(stages.map((name, index) => [name, (input: Record<string, unknown>) => {
    calls.push(name);
    for (const [key, value] of Object.entries(input)) {
      if (key in dependencies) assert.equal(value, dependencies[key]);
      if (outputs.has(key)) assert.equal(value, outputs.get(key));
    }
    if (name === failedStage) throw error;
    const fn = () => marker; outputs.set(keys[index], fn); return fn;
  }]));
  const module = { exports: {} as any };
  vm.runInNewContext(source, { module, require: () => modules }, { filename: file });
  assert.deepEqual(calls, []);
  let caught: unknown, result: any;
  try { result = module.exports.createMainWindowCreationControllers(dependencies); } catch (value) { caught = value; }
  assert.equal(caught, failedStage ? error : undefined);
  assert.deepEqual(calls, failedStage ? stages.slice(0, stages.indexOf(failedStage) + 1) : stages);
  if (!failedStage) { assert.equal(result, outputs.get('createWindow')); assert.equal(result(), marker); }
}

assert.ok(source.split('\n').length <= 300);
const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
const factory = parsed.statements.find(ts.isFunctionDeclaration)!;
assert.ok(parsed.getLineAndCharacterOfPosition(factory.end).line
  - parsed.getLineAndCharacterOfPosition(factory.getStart()).line + 1 <= 50);
const root = expandMainWindowLifecycleSource(fs.readFileSync('electron/windowManager.cjs', 'utf8'));
assert.match(root, /require\('\.\/windowManager\/mainWindowLifecycleControllers\.cjs'\)/);
assert.ok(root.indexOf('= createMainWindowStateCreationControllers(') > root.indexOf('= createMainWindowStateRecoveryControllers('));
assert.ok(root.indexOf('= createMainWindowStateCreationControllers(') < root.indexOf('= createAuxiliaryWindowContentControllers('));
console.log('Main creation assembly smoke passed (four factory stages, failure order, state/controller identity, no eager native calls and budgets).');
