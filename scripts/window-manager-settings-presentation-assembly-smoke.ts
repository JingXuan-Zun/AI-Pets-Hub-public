import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('electron/windowManager/settingsPresentationControllers.cjs', 'utf8');
const stages = ['createSettingsWindowDisplayRefreshScheduler', 'createSettingsWindowContentScheduler', 'createSettingsWindowPresenter'];
const exports = ['scheduleSettingsWindowDisplayRefresh', 'scheduleSettingsWindowContentRefresh', 'showSettingsWindow'];
const inputs = [
  ['getSettingsWindow', 'getDisplayRefreshTimer', 'setDisplayRefreshTimer', 'setTimeout', 'clearTimeout', 'captureService', 'SETTINGS_WINDOW_SHOW_DISPLAY_REFRESH_DELAY_MS'],
  ['getContentRefreshAt', 'setContentRefreshAt', 'getCurrentTime', 'SETTINGS_WINDOW_CONTENT_REFRESH_COOLDOWN_MS', 'refreshSettingsWindowContent'],
  ['getSettingsWindow', 'getMainWindow', 'getSettingsPanelWindowBounds', 'isSettingsWindowAtSettingsPanelUrl', 'logWindowEvent', 'loadRenderer',
    'HIDE_MAIN_WINDOW_FOR_GRAPH_DIAGNOSTICS', 'scheduleKeepWindowOnTop', 'AUX_TOPMOST_RELATIVE_LEVEL', 'scheduleWindowStackOnTop', 'notifySettingsWindowState', 'scheduleSettingsWindowContentRefresh'],
];
for (const failure of [undefined, ...stages]) {
  const calls: string[] = [], created = new Map<string, () => never>(), error = new Error('settings presentation assembly');
  const dependencies = Object.fromEntries(inputs.flat().filter(key => key !== 'scheduleSettingsWindowContentRefresh').map(key => [key,
    key.endsWith('_MS') || key === 'AUX_TOPMOST_RELATIVE_LEVEL' ? 137 : key === 'captureService' ? { root: true } : () => { throw new Error(`no eager ${key}`); }]));
  const factories = Object.fromEntries(stages.map((stage, index) => [stage, (input: any) => {
    calls.push(stage); assert.deepEqual(Object.keys(input).sort(), [...inputs[index]].sort());
    for (const key of inputs[index]) assert.equal(input[key], created.has(key) ? created.get(key) : dependencies[key], `${stage} forwards ${key}`);
    if (failure === stage) throw error;
    const fn = () => { throw new Error('no eager controller'); }; created.set(exports[index], fn); return fn;
  }]));
  const module = { exports: {} as any };
  vm.runInNewContext(source, { module, require: () => factories });
  assert.deepEqual(calls, []);
  let result: any, caught: unknown;
  try { result = module.exports.createSettingsPresentationControllers(dependencies); } catch (value) { caught = value; }
  assert.equal(caught, failure ? error : undefined);
  assert.deepEqual(calls, failure ? stages.slice(0, stages.indexOf(failure) + 1) : stages);
  if (!failure) {
    assert.deepEqual(Object.keys(result), exports);
    for (const key of exports) assert.equal(result[key], created.get(key));
  }
}
const root = fs.readFileSync('electron/windowManager.cjs', 'utf8');
assert.match(root, /refreshSettingsWindowContent: \(force\) => refreshSettingsWindowContent\(force\)/);
assert.ok(root.indexOf('= createSettingsStatePresentationControllers(') > root.indexOf('= createWindowManagerRendererNavigation('));
assert.ok(root.indexOf('= createSettingsStatePresentationControllers(') < root.indexOf('= createMainWindowLifecycleControllers('));
console.log('Settings presentation assembly passed (three stages, failure order, exact dependencies/controller identities and lazy root refresh).');

assert.ok(root.indexOf('= createWindowManagerRendererNavigation(') >= 0, 'Navigation assembly must exist before comparing initialization order');
