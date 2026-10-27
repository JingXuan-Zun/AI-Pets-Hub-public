import assert from 'node:assert/strict';
import { runPlatformCapability, getPlatformCapability } from '../src/platform-capabilities/platformCapabilityRegistry';
import { buildWorkTaskInstruction } from '../src/work-tasks/workTaskPrompt';
import { normalizeWorkTaskSettings } from '../src/work-tasks/workTaskSettings';
import type { PetConfig } from '../src/types';

let config = { settings: { workTasks: undefined } } as unknown as PetConfig;
let saves = 0;
const context = {
  configRef: { current: config },
  onUpdateConfig: (next: PetConfig) => { config = next; saves += 1; },
  petId: 'primary',
};
const run = async (capability: string, args: Record<string, unknown> = {}) => runPlatformCapability(context, { args, capability });
const tasks = () => normalizeWorkTaskSettings(context.configRef.current.settings.workTasks);

// Registered, and none of them asks for confirmation.
for (const id of ['work.start_task', 'work.update_task', 'work.finish_task', 'work.show_task', 'work.log_decision', 'work.list_decisions', 'work.remove_decision']) {
  assert.ok(getPlatformCapability(id), `${id} is registered`);
  assert.notEqual(getPlatformCapability(id)?.risk, 'change', `${id} runs without a confirmation card`);
}

// No task: nothing extra in the prompt.
assert.equal(buildWorkTaskInstruction(undefined), '');
assert.equal((await run('work.update_task', { progress: 'x' })).ok, false, 'updating needs an open card');

// Open a card, settle points, move on.
const started = await run('work.start_task', { goal: '翻滚手感像龙之谷', project: '动作游戏', title: '战斗系统的翻滚' });
assert.equal(started.ok, true);
assert.match(started.text, /任务：战斗系统的翻滚（项目：动作游戏）\n目标：翻滚手感像龙之谷/u);
const updated = await run('work.update_task', { decided: '- 翻滚无敌 0.3 秒\n- 连续最多滚 2 次', next: '调冷却', progress: '翻滚动画接好了' });
assert.match(updated.text, /记下 2 条决定/u);
assert.deepEqual(tasks().activeTask?.decided, ['翻滚无敌 0.3 秒', '连续最多滚 2 次']);
assert.equal(tasks().decisions.length, 2, 'settled points also go to the project log');
assert.equal((await run('work.log_decision', { text: '翻滚无敌 0.3 秒' })).text, '这些之前已经记过了。', 'no duplicate decisions');

// The card and the project's decisions reach every reply.
const prompt = buildWorkTaskInstruction(tasks());
assert.match(prompt, /【当前进度卡】[\s\S]*任务：战斗系统的翻滚[\s\S]*做到：翻滚动画接好了\n下一步：调冷却/u);
assert.match(prompt, /【动作游戏已定下的事】[\s\S]*- 翻滚无敌 0\.3 秒/u);
assert.match(prompt, /不要说出和已定下的事相反的话/u);

// Decisions can be looked up and removed.
assert.match((await run('work.list_decisions', { keyword: '翻滚' })).text, /1\. 翻滚无敌 0\.3 秒/u);
assert.equal((await run('work.remove_decision', { match: '连续' })).ok, true);
assert.equal(tasks().decisions.length, 1);

// A new task in the same project keeps the project; the old card is kept as finished.
await run('work.start_task', { title: '冲刺' });
assert.equal(tasks().activeTask?.project, '动作游戏', 'project carries over');
assert.equal(tasks().recentTasks[0]?.title, '战斗系统的翻滚');
assert.match(buildWorkTaskInstruction(tasks()), /翻滚无敌 0\.3 秒/u, 'earlier decisions of the project still apply');

// Finishing closes the card; showing it tells where to pick up.
const finished = await run('work.finish_task', { summary: '冲刺先放着' });
assert.match(finished.text, /任务“冲刺”已收起/u);
assert.equal(tasks().activeTask, null);
assert.equal(buildWorkTaskInstruction(tasks()), '', 'no open card, nothing in the prompt');
assert.match((await run('work.show_task')).text, /现在没有打开的进度卡[\s\S]*- 冲刺：冲刺先放着/u);

assert.ok(saves >= 6, 'every change is saved');
console.log('work task smoke ok');
