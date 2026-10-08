import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const file = 'electron/windowManager/settingsWindowControllers.cjs';
const source = fs.readFileSync(file, 'utf8');
const stages = ['createSettingsWindowEventRegistrar', 'createSettingsWindowOptionsBuilder',
  'createSettingsWindowCreator', 'createSettingsWindowReadiness'];
for (const failedStage of [undefined, ...stages]) verifyAssembly(failedStage);

function verifyAssembly(failedStage?: string) {
  const error = new Error('settings assembly dependency');
  const calls: string[] = [], created = new Map<string, () => never>();
  const dependencies = Object.fromEntries([
    'openExternalSafely', 'getSettingsWindow', 'getIsQuitting', 'clearSettingsWindow', 'clearSettingsWindowReadyPromise',
    'broadcastSharedState', 'scheduleSettingsWindowContentRefresh', 'disableDwmSystemBorderForWindow',
    'notifySettingsWindowState', 'scheduleWindowStackOnTop', 'scheduleKeepWindowOnTop', 'showMainWindowWhenReady',
    'getBrowserWindowIconOptions', 'setSettingsWindow', 'getSettingsPanelWindowBounds', 'BrowserWindow',
    'attachLoadLogging', 'logWindowEvent', 'loadRenderer', 'getReadyPromise', 'setReadyPromise', 'waitForSettingsWindowLoad',
  ].map((name) => [name, () => { throw new Error(`assembly must not invoke ${name}`); }]));
  const exportNames: Record<string, string[]> = {
    createSettingsWindowEventRegistrar: ['attachSettingsWindowEvents'],
    createSettingsWindowOptionsBuilder: ['buildSettingsWindowOptions'],
    createSettingsWindowCreator: ['createSettingsWindow'],
    createSettingsWindowReadiness: ['ensureSettingsWindowReady', 'preloadSettingsWindow'],
  };
  const modules = Object.fromEntries(stages.map((name) => [name, (input: Record<string, unknown>) => {
    calls.push(name);
    for (const [key, value] of Object.entries(input)) {
      if (key in dependencies) assert.equal(value, dependencies[key], `${name} forwards ${key}`);
      if (created.has(key)) assert.equal(value, created.get(key), `${name} uses the preceding controller`);
    }
    if (name === failedStage) throw error;
    const result = Object.fromEntries(exportNames[name].map((key) => {
      const fn = () => { throw new Error(`assembly must not run ${key}`); };
      created.set(key, fn); return [key, fn];
    }));
    return name === 'createSettingsWindowReadiness' ? result : result[exportNames[name][0]];
  }]));
  const module = { exports: {} as any };
  vm.runInNewContext(source, { module, require: () => modules }, { filename: file });
  assert.deepEqual(calls, []);
  let caught: unknown, result: Record<string, unknown> = {};
  try { result = module.exports.createSettingsWindowControllers(dependencies); } catch (value) { caught = value; }
  assert.equal(caught, failedStage ? error : undefined);
  assert.deepEqual(calls, failedStage ? stages.slice(0, stages.indexOf(failedStage) + 1) : stages);
  if (!failedStage) {
    assert.deepEqual(Object.keys(result), ['ensureSettingsWindowReady', 'preloadSettingsWindow']);
    for (const [name, value] of Object.entries(result)) assert.equal(value, created.get(name));
  }
}

assert.ok(source.split('\n').length <= 300);
const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
const factory = parsed.statements.find(ts.isFunctionDeclaration)!;
assert.ok(parsed.getLineAndCharacterOfPosition(factory.end).line
  - parsed.getLineAndCharacterOfPosition(factory.getStart()).line + 1 <= 50);
const root = fs.readFileSync('electron/windowManager.cjs', 'utf8');
assert.match(root, /require\('\.\/windowManager\/auxiliaryWindowContentControllers\.cjs'\)/);
assert.ok(root.indexOf('= createWindowPresentationTrayControllers(') < root.indexOf('= createAuxiliaryWindowContentControllers('));
assert.match(root, /ensureSettingsWindowReady: \(\) => ensureSettingsWindowReady\(\)/);
assert.ok(root.indexOf('= createAuxiliaryWindowContentControllers(') > root.indexOf('= createMainWindowLifecycleControllers('));
console.log('Settings assembly smoke passed (four factory stages, failure order, live state/callback identity, lazy readiness and budgets).');
