import { expandMainWindowLifecycleSource } from './windowManagerAuxiliaryAssemblySource.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const file = 'electron/windowManager/mainWindowRecoveryControllers.cjs';
const source = fs.readFileSync(file, 'utf8');
const stages = ['createMainWindowReadinessGate', 'createMainWindowRecreator',
  'createMainWindowRendererRecovery', 'createMainWindowReadyFallbackScheduler', 'createMainWindowHealthPresenter'];
for (const failedStage of [undefined, ...stages]) verifyAssembly(failedStage);

function verifyAssembly(failedStage?: string) {
  const calls: string[] = [], outputs = new Map<string, (...args: any[]) => unknown>();
  const error = new Error('main recovery assembly failed');
  const marker = {}, dependencies: Record<string, any> = Object.fromEntries([
    'getMainWindow', 'getCanShow', 'getRendererReadyToShow', 'setRendererReadyToShow', 'resetStartupRecoveryCount',
    'getReadyFallbackTimer', 'setReadyFallbackTimer', 'logWindowEvent', 'clearTimeout', 'showMainWindow',
    'getRendererRecoveryInProgress', 'setTimeout', 'getIsQuitting', 'clearMainWindow', 'hidePostDragInputProxy',
    'setRendererRecoveryInProgress', 'markMainWindowCanShow', 'getStartupRecoveryCount', 'incrementStartupRecoveryCount',
  ].map((name) => [name, () => { throw new Error(`must not eagerly invoke ${name}`); }]));
  dependencies.createWindowForRecovery = () => { calls.push('create-recovery'); return marker; };
  dependencies.createWindowForHealth = () => { calls.push('create-health'); return marker; };
  const modules: Record<string, any> = {};
  const keys: Record<string, string[]> = {
    createMainWindowReadinessGate: ['showMainWindowWhenReady', 'markMainWindowReadyToShow'],
    createMainWindowRecreator: ['recreateMainWindow'], createMainWindowRendererRecovery: ['recoverMainWindowRenderer'],
    createMainWindowReadyFallbackScheduler: ['scheduleMainWindowRendererReadyFallback'],
    createMainWindowHealthPresenter: ['showOrRecoverMainWindow'],
  };
  for (const name of stages) modules[name] = (input: Record<string, any>) => {
    calls.push(name);
    for (const [key, value] of Object.entries(input)) {
      if (key in dependencies) assert.equal(value, dependencies[key]);
      if (outputs.has(key)) assert.equal(value, outputs.get(key));
    }
    if (name === 'createMainWindowRecreator') assert.equal(input.createWindow, dependencies.createWindowForRecovery);
    if (name === 'createMainWindowHealthPresenter') assert.equal(input.createWindow, dependencies.createWindowForHealth);
    if (name === failedStage) throw error;
    const result = Object.fromEntries(keys[name].map((key) => {
      const fn = (mode?: string): unknown => {
        if (key === 'recreateMainWindow' || key === 'showOrRecoverMainWindow') return input.createWindow();
        if (key === 'recoverMainWindowRenderer') return mode === 'fallback'
          ? input.scheduleMainWindowRendererReadyFallback() : input.recreateMainWindow();
        calls.push(key); return marker;
      };
      outputs.set(key, fn); return [key, fn];
    }));
    return name === 'createMainWindowReadinessGate' ? result : result[keys[name][0]];
  };
  const module = { exports: {} as any };
  vm.runInNewContext(source, { module, require: () => modules }, { filename: file });
  assert.deepEqual(calls, []);
  let caught: unknown, result: any;
  try { result = module.exports.createMainWindowRecoveryControllers(dependencies); } catch (value) { caught = value; }
  assert.equal(caught, failedStage ? error : undefined);
  assert.deepEqual(calls, failedStage ? stages.slice(0, stages.indexOf(failedStage) + 1) : stages);
  if (!failedStage) {
    assert.equal(Object.keys(result).length, 5);
    for (const [key, value] of Object.entries(result)) assert.equal(value, outputs.get(key));
    assert.equal(result.recoverMainWindowRenderer('fallback'), marker, 'lazy cycle resolves to the completed fallback');
    assert.equal(calls.at(-1), 'scheduleMainWindowRendererReadyFallback');
    assert.equal(result.recoverMainWindowRenderer('recreate'), marker); assert.equal(calls.at(-1), 'create-recovery');
    assert.equal(result.showOrRecoverMainWindow(), marker); assert.equal(calls.at(-1), 'create-health');
  }
}

assert.ok(source.split('\n').length <= 300);
const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
for (const fn of parsed.statements.filter(ts.isFunctionDeclaration)) {
  assert.ok(parsed.getLineAndCharacterOfPosition(fn.end).line
    - parsed.getLineAndCharacterOfPosition(fn.getStart()).line + 1 <= 50);
}
const root = expandMainWindowLifecycleSource(fs.readFileSync('electron/windowManager.cjs', 'utf8'));
assert.match(root, /require\('\.\/windowManager\/mainWindowLifecycleControllers\.cjs'\)/);
assert.ok(root.indexOf('= createMainWindowStateRecoveryControllers(') < root.indexOf('= createMainWindowStateCreationControllers('));
console.log('Main recovery assembly smoke passed (five factory stages, lazy cycle, distinct creation callbacks, failure and identity budgets).');
