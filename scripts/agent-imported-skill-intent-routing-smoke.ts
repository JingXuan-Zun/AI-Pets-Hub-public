import assert from 'node:assert/strict';
import {
  formatAgentImportedSkillCatalog,
  resolveAgentProductionSessionInstruction,
  resolveExplicitAgentImportedSkillIntent,
  runAgentProductionSession,
} from '../src/agent';
import { parseAgentExternalSkillImport } from '../src/agent/agentExternalSkillLibrary';
import { executeAgentSkill } from '../src/agent/agentRuntimeSkillTools';
import type { PetConfig } from '../src/types';

const source = [
  '---',
  'name: h3-prompt-writing',
  'description: Write cinematic video generation prompts with timed shots and sound.',
  '---',
  '# H3 Prompt Writing',
  'MANDATORY_RULE: Include a timed 10-second shot list and sound cues.',
].join('\n');
const skill = parseAgentExternalSkillImport(source, 'SKILL.md').skill;
assert.ok(skill, 'fixture Skill must parse');

const explicitGoal = '请使用 h3-prompt-writing 技能，帮我写一段 10秒的视频生成提示词。';
const intent = resolveExplicitAgentImportedSkillIntent(explicitGoal, [skill]);
assert.equal(intent?.skill.id, 'external.h3-prompt-writing');
assert.equal(resolveExplicitAgentImportedSkillIntent('请调用 h3-prompt-writing 帮我写一段视频提示词。', [skill])?.skill.id, 'external.h3-prompt-writing');
assert.equal(resolveExplicitAgentImportedSkillIntent('h3-prompt-writing 是做什么的？', [skill]), null);
assert.match(formatAgentImportedSkillCatalog([skill]), /external\.h3-prompt-writing/u);

assert.equal(
  resolveAgentProductionSessionInstruction(`/${explicitGoal}`),
  explicitGoal,
  'a leading slash must be the only chat-to-Agent entry for imported Skills',
);
let modelCalls = 0;
const result = await runAgentProductionSession({
  importedSkills: [skill],
  maxSteps: 2,
  modelCaller: async ({ systemInstruction }) => {
    modelCalls += 1;
    assert.match(systemInstruction, /The user explicitly requested the enabled imported Skill/u);
    assert.match(systemInstruction, /MANDATORY_RULE/u);
    return JSON.stringify({
      action: 'final_answer',
      message: '0–5秒：镜头跟随赛博猫穿过雨夜街道。5–10秒：霓虹倒影与引擎声收束。',
      reason: 'Applied the requested Skill.',
    });
  },
  settings: {} as PetConfig['settings'],
  sourceText: `/${explicitGoal}`,
  userGoal: explicitGoal,
});
assert.equal(modelCalls, 1);
assert.equal(result.status, 'completed');
assert.match(result.finalAnswer, /0–5秒/u);

const localStorageData = new Map([
  ['desktop-pet.agent-external-skills.v1', JSON.stringify({ skills: [skill] })],
  ['desktop-pet.agent-skill-bindings.v1', JSON.stringify({ primary: [skill.id] })],
]);
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { localStorage: { getItem: (key: string) => localStorageData.get(key) ?? null } },
});
const automaticGoal = '帮我写一段 10 秒的视频生成提示词，主题是赛博朋克猫在雨夜巡逻。';
const automaticTools: string[] = [];
let automaticModelCalls = 0;
const automaticResult = await runAgentProductionSession({
  importedSkills: [skill],
  maxSteps: 3,
  modelCaller: async ({ systemInstruction, userInput }) => {
    automaticModelCalls += 1;
    if (automaticModelCalls === 1) {
      assert.match(systemInstruction, /Enabled imported declarative Skills/u);
      assert.match(systemInstruction, /external\.h3-prompt-writing/u);
      assert.doesNotMatch(systemInstruction, /<active_imported_skill>/u);
      return JSON.stringify({
        action: 'tool_call',
        tool: 'execute_agent_skill',
        args: { skillId: 'external.h3-prompt-writing', dryRun: true },
        reason: 'The enabled video prompt Skill matches the request.',
      });
    }
    assert.match(userInput, /MANDATORY_RULE/u);
    return JSON.stringify({
      action: 'final_answer',
      message: '0–5秒：赛博猫穿过雨夜霓虹。5–10秒：低机位跟随巡逻，雨声与机械步伐同步。',
      reason: 'Applied the matching imported Skill.',
    });
  },
  settings: {} as PetConfig['settings'],
  sourceText: `/${automaticGoal}`,
  toolExecutor: async (command) => {
    automaticTools.push(command.toolCall?.name ?? '');
    return executeAgentSkill({ configRef: { current: {} as PetConfig }, petId: 'primary' }, command.toolCall!);
  },
  userGoal: automaticGoal,
});
assert.equal(automaticResult.status, 'completed');
assert.equal(automaticModelCalls, 2);
assert.deepEqual(automaticTools, ['execute_agent_skill']);

console.log('imported Skill intent routing and explicit instruction preload passed');
