import assert from 'node:assert/strict';
import { parseAgentExternalSkillImport } from '../src/agent/agentExternalSkillLibrary';
import { executeAgentSkill, executeListAgentSkills } from '../src/agent/agentRuntimeSkillTools';
import type { PetConfig } from '../src/types';

const markdown = '---\nname: h3-prompt-writing\ndescription: Write video prompts.\n---\n# H3 Prompt Writing\nUse a timed shot list. Include sound cues.';
const imported = parseAgentExternalSkillImport(markdown, 'SKILL.md').skill!;
const data = new Map<string, string>();
Object.defineProperty(globalThis, 'window', { configurable: true, value: {
  localStorage: { getItem: (key: string) => data.get(key) ?? null },
} });
// Preserve the old importer identity to exercise already-installed skills.
const legacy = { ...imported, id: 'external.skill', description: '---', instructions: markdown };
data.set('desktop-pet.agent-external-skills.v1', JSON.stringify({ skills: [legacy] }));
data.set('desktop-pet.agent-skill-bindings.v1', JSON.stringify({ primary: ['external.skill'] }));
const listing = executeListAgentSkills({ name: 'list_agent_skills', input: { query: 'h3-prompt-writing' } }, { petId: 'primary' });
assert.match(listing.responseText, /external\.skill/, 'enabled imported skill must be discoverable by its declared name');
assert.equal(imported.id, 'external.h3-prompt-writing');
assert.equal(imported.description, 'Write video prompts.');
const runtime = { configRef: { current: {} as PetConfig }, petId: 'primary' };
const result = await executeAgentSkill(runtime, { name: 'execute_agent_skill', input: { skillId: 'h3-prompt-writing' } });
assert.equal(result.ok, true);
assert.ok(result.responseText.includes(markdown), 'return the full instructions for the next model decision');
const other = executeListAgentSkills({ name: 'list_agent_skills', input: { query: 'h3-prompt-writing' } }, { petId: 'other' });
assert.match(other.responseText, /找到 0 个/);
data.set('desktop-pet.agent-skill-bindings.v1', JSON.stringify({ primary: [] }));
assert.equal((await executeAgentSkill(runtime, { name: 'execute_agent_skill', input: { skillId: 'external.skill' } })).ok, false);
assert.match(executeListAgentSkills({ name: 'list_agent_skills', input: {} }, runtime).responseText, /character\.animation/);
console.log('imported skill discovery, instructions, legacy identity and role isolation passed');
