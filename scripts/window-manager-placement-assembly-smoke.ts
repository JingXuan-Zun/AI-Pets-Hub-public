import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const file = 'electron/windowManager/windowPlacementControllers.cjs';
const source = fs.readFileSync(file, 'utf8');
const stages = [
  ['createWindowTopmostScheduler', ['scheduleKeepWindowOnTop']],
  ['createAuxWindowTopmostActions', ['keepAuxWindowsOnTop', 'keepAreaPickerOnTop', 'keepPersistentAreaBorderOnTop']],
  ['createAuxWindowTopmostScheduler', ['scheduleAuxWindowsOnTop', 'scheduleAreaPickerOnTop', 'schedulePersistentAreaBorderOnTop']],
  ['createWindowStackTopmost', ['keepWindowStackOnTop', 'scheduleWindowStackOnTop']],
  ['createMainWindowSettingsResizer', ['resizeWindowForSettings']],
  ['createMainWindowCenterResizer', ['resizeWindowAroundCurrentCenter']],
  ['createAuxWindowVisibilityQuery', ['hasVisibleAuxWindow']],
  ['createMainWindowTopmostGuard', ['startMainTopmostGuard', 'stopMainTopmostGuard']],
] as const;

for (const failedStage of [undefined, ...stages.map(([name]) => name)]) {
  exerciseAssembly(failedStage);
}

function exerciseAssembly(failedStage?: string) {
  const order: string[] = [], outputs = new Map<string, () => never>();
  const error = new Error('assembly dependency failed');
  const forbidden = () => { throw new Error('assembly must not invoke native actions, timers or live getters'); };
  const dependencies = Object.fromEntries([
    'getMainWindow', 'getInputProxyWindow', 'getSettingsWindow', 'getChatWindow', 'getAreaPickerWindow',
    'getPersistentAreaBorderWindow', 'getSettingsWindowBounds', 'getCompactWindowBounds',
    'getGuardTimer', 'setGuardTimer', 'keepWindowOnTop', 'setTimeout', 'setInterval', 'clearInterval',
  ].map((name) => [name, () => forbidden()]));
  const modules: Record<string, any> = {};
  for (const [name, keys] of stages) {
    modules[name] = (input: Record<string, unknown>) => {
      order.push(name);
      for (const [key, value] of Object.entries(input)) {
        if (key in dependencies) assert.equal(value, dependencies[key], `${name} forwards ${key}`);
        if (outputs.has(key)) assert.equal(value, outputs.get(key), `${name} uses the earlier controller`);
      }
      if (failedStage === name) throw error;
      const result = Object.fromEntries(keys.map((key) => {
        const output = () => { throw new Error(`assembly must not run ${key}`); };
        outputs.set(key, output); return [key, output];
      }));
      return ['createMainWindowSettingsResizer', 'createMainWindowCenterResizer', 'createAuxWindowVisibilityQuery'].includes(name)
        ? result[keys[0]] : result;
    };
  }
  const module = { exports: {} as any };
  vm.runInNewContext(source, { module, require: () => modules }, { filename: file });
  assert.deepEqual(order, [], 'loading the assembly does not construct controllers');
  let caught: unknown;
  let result: Record<string, unknown> = {};
  try { result = module.exports.createWindowPlacementControllers(dependencies); } catch (value) { caught = value; }
  assert.equal(caught, failedStage ? error : undefined);
  const expected = stages.map(([name]) => name);
  assert.deepEqual(order, failedStage ? expected.slice(0, expected.indexOf(failedStage as any) + 1) : expected);
  if (!failedStage) {
    assert.equal(Object.keys(result).length, 10);
    for (const [key, value] of Object.entries(result)) assert.equal(value, outputs.get(key), `public ${key} retains identity`);
  }
}

assert.ok(source.split('\n').length <= 300);
const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
for (const statement of parsed.statements) {
  if (!ts.isFunctionDeclaration(statement)) continue;
  const length = parsed.getLineAndCharacterOfPosition(statement.end).line
    - parsed.getLineAndCharacterOfPosition(statement.getStart()).line + 1;
  assert.ok(length <= 50, `${statement.name?.text} exceeds the assembly function budget`);
}
const root = fs.readFileSync('electron/windowManager.cjs', 'utf8');
assert.match(root, /require\('\.\/windowManager\/windowPlacementControllers\.cjs'\)/);
assert.match(root, /= createWindowManagerPlacementControllers\(/);
assert.ok(root.indexOf('= createWindowManagerPlacementControllers(') < root.indexOf('= createWindowPresentationTrayControllers('));
console.log('Window placement assembly smoke passed (original factory order, 8 failure boundaries, identity and budgets).');
