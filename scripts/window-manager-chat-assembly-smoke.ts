import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const file = 'electron/windowManager/chatWindowControllers.cjs';
const source = fs.readFileSync(file, 'utf8');
const stages = [
  ['createChatWindowOptionsBuilder', ['buildChatWindowOptions']],
  ['createChatWindowSizeConstraints', ['applyChatWindowSizeConstraints']],
  ['createInteractiveChatWindowBoundsSync', ['syncInteractiveChatWindowBounds']],
  ['createChatWindowReusePresenter', ['presentReusedChatWindow']],
  ['createChatWindowEventRegistrar', ['attachChatWindowEvents']],
  ['createChatWindowControls', ['closeChatWindow', 'openChatWindow']],
] as const;

for (const failedStage of [undefined, ...stages.map(([name]) => name)]) runAssembly(failedStage);

function runAssembly(failedStage?: string) {
  const order: string[] = [], created = new Map<string, () => never>();
  const error = new Error('chat assembly dependency');
  const dependencies = Object.fromEntries([
    'getBrowserWindowIconOptions', 'isCurrentWindowCompactMinimumSizeActive', 'getResolvedChatPanelWindowLimits',
    'getChatWindow', 'getWasInteractive', 'setWasInteractive', 'isInteractiveDialogueChatActive',
    'getResolvedChatPanelWindowBounds', 'scheduleKeepWindowOnTop', 'scheduleWindowStackOnTop',
    'notifyChatWindowState', 'broadcastSharedState', 'getIsQuitting', 'clearChatWindow', 'openExternalSafely',
    'setChatWindow', 'getChatPanelWindowBounds', 'BrowserWindow', 'attachLoadLogging', 'loadRenderer',
  ].map((name) => [name, () => { throw new Error(`assembly must not run ${name}`); }]));
  const modules: Record<string, any> = {};
  for (const [name, keys] of stages) {
    modules[name] = (input: Record<string, unknown>) => {
      order.push(name);
      for (const [key, value] of Object.entries(input)) {
        if (key in dependencies) assert.equal(value, dependencies[key], `${name} retains ${key}`);
        if (created.has(key)) assert.equal(value, created.get(key), `${name} retains the earlier controller`);
      }
      if (name === failedStage) throw error;
      const outputs = Object.fromEntries(keys.map((key) => {
        const fn = () => { throw new Error(`assembly must not invoke ${key}`); };
        created.set(key, fn); return [key, fn];
      }));
      return name === 'createChatWindowControls' ? outputs : outputs[keys[0]];
    };
  }
  const module = { exports: {} as any };
  vm.runInNewContext(source, { module, require: () => modules }, { filename: file });
  assert.deepEqual(order, []);
  let caught: unknown, result: Record<string, unknown> = {};
  try { result = module.exports.createChatWindowControllers(dependencies); } catch (value) { caught = value; }
  assert.equal(caught, failedStage ? error : undefined);
  const expected = stages.map(([name]) => name);
  assert.deepEqual(order, failedStage ? expected.slice(0, expected.indexOf(failedStage as any) + 1) : expected);
  if (!failedStage) {
    assert.deepEqual(Object.keys(result), ['closeChatWindow', 'openChatWindow', 'syncInteractiveChatWindowBounds']);
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
const auxiliary = fs.readFileSync('electron/windowManager/auxiliaryWindowCreationControllers.cjs', 'utf8');
assert.ok(auxiliary.indexOf('= createChatWindowOwnershipControllers(') < auxiliary.indexOf('= createSettingsWindowOwnershipControllers('));
console.log('Chat assembly smoke passed (six factory stages, failure order, dependency/function identity, no eager effects, budgets).');
