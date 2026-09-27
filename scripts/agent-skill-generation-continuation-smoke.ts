import assert from 'node:assert/strict';
import { runAgentProductionSession } from '../src/agent/legacy/index';
import type { PetConfig } from '../src/types';
import { executeAgentSkill, executeListAgentSkills } from '../src/agent/agentRuntimeSkillTools';
import { parseAgentExternalSkillImport } from '../src/agent/agentExternalSkillLibrary';

const instructions = '---\nname: h3-prompt-writing\ndescription: Video prompt writing\n---\n# H3\n' + 'Detailed reference text. '.repeat(100) + '\nFINAL_RULE: include sound cues and a timed shot list.';
const skill = parseAgentExternalSkillImport(instructions, 'SKILL.md').skill!;
const storage = new Map([
  ['desktop-pet.agent-external-skills.v1', JSON.stringify({ skills: [skill] })],
  ['desktop-pet.agent-skill-bindings.v1', JSON.stringify({ primary: [skill.id] })],
]);
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem: (key: string) => storage.get(key) ?? null } } });
const runtime = { petId: 'primary', configRef: { current: {} as PetConfig } };

const goal = '请使用 h3-prompt-writing 技能，帮我写一段 10秒 的视频生成提示词，主题是赛博朋克猫在雨夜街头巡逻。';
let calls = 0;
const tools: string[] = [];
const result = await runAgentProductionSession({
  settings: {} as PetConfig['settings'], sourceText: goal, userGoal: goal, maxSteps: 6,
  modelCaller: async (request) => {
    calls += 1;
    if (calls === 1) return JSON.stringify({ action: 'tool_call', tool: 'list_agent_skills', args: { query: 'h3-prompt-writing' }, reason: 'Find the requested skill.' });
    if (calls === 2) return JSON.stringify({ action: 'tool_call', tool: 'execute_agent_skill', args: { skillId: 'external.h3-prompt-writing', dryRun: true }, reason: 'Read the instructions before writing.' });
    assert.ok(request.userInput.includes('FINAL_RULE: include sound cues and a timed shot list.'), 'full skill instructions must reach the next model request');
    return JSON.stringify({ action: 'final_answer', message: '0–5秒：装甲猫穿过雨夜霓虹。5–10秒：低机位跟随巡逻，雨声与低沉引擎声交织。', reason: 'Generated the requested prompt using the loaded skill.' });
  },
  toolExecutor: async (command) => {
    tools.push(command.toolCall!.name);
    return command.toolCall!.name === 'list_agent_skills' ? executeListAgentSkills(command.toolCall!, runtime) : executeAgentSkill(runtime, command.toolCall!);
  },
});
assert.deepEqual(tools, ['list_agent_skills', 'execute_agent_skill'], result.status + '\n' + result.continuation.historyLines.join('\n'));
assert.equal(calls, 3, 'loading skill instructions must return control to the model');
assert.equal(result.status, 'completed');
assert.match(result.finalAnswer, /0–5秒/);
console.log('skill discovery -> instructions -> generated answer continuation passed');
