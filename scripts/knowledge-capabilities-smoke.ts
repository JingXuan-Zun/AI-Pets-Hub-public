import assert from 'node:assert/strict';
import { getPlatformCapability, runPlatformCapability } from '../src/platform-capabilities/platformCapabilityRegistry';
import type { PetConfig } from '../src/types';

let cases = 0;
const check = (actual: unknown, expected: unknown, label: string) => { assert.deepEqual(actual, expected, label); cases++; };

let config = {
  companionPets: [{ enabled: true, id: 'companion-pet-2', personality: { knowledgeBase: '', name: '高冷小桃' } }],
  personality: { knowledgeBase: '小桃住在月亮城。', name: '甜心小桃' },
  settings: { globalKnowledgeBase: '' },
} as unknown as PetConfig;
const configRef = { current: config };
const context = { configRef, onUpdateConfig: (next: PetConfig) => { config = next; configRef.current = next; }, petId: 'primary' };
const run = (capability: string, args: Record<string, unknown> = {}) => runPlatformCapability(context, { args, capability });

check(['knowledge.add', 'knowledge.read', 'knowledge.remove'].map((id) => getPlatformCapability(id)?.risk), ['change', 'read', 'change'], 'changes ask, reading does not');
assert.match(getPlatformCapability('knowledge.add')!.describe({ text: '公司年假是 15 天' }), /全局知识库：公司年假是 15 天/u);
cases++;

check((await run('knowledge.add', { text: '公司年假是 15 天' })).ok, true, 'added to the global knowledge base');
await run('knowledge.add', { text: '报销要在月底前提交' });
check(config.settings.globalKnowledgeBase, '公司年假是 15 天\n\n报销要在月底前提交', 'paragraphs kept apart');
assert.match((await run('knowledge.add', { text: '公司年假是 15 天' })).text, /已经有这段/u);
cases++;
assert.match((await run('knowledge.read')).text, /2 段[\s\S]*1\. 公司年假[\s\S]*2\. 报销/u);
cases++;
check((await run('knowledge.remove', { match: '报销' })).ok, true, 'removed by keyword');
check(config.settings.globalKnowledgeBase, '公司年假是 15 天', 'only that paragraph removed');

await run('knowledge.add', { scope: 'character', text: '小桃怕打雷。' });
check(config.personality.knowledgeBase, '小桃住在月亮城。\n\n小桃怕打雷。', 'the current character by default');
await run('knowledge.add', { pet: '高冷小桃', scope: 'character', text: '高冷小桃会弹钢琴。' });
check(config.companionPets[0].personality.knowledgeBase, '高冷小桃会弹钢琴。', 'another character by name');
check((await run('knowledge.add', { pet: '不存在', scope: 'character', text: 'x' })).ok, false, 'unknown character refused');
check((await run('knowledge.add', { text: 'x'.repeat(5000) })).ok, false, 'too long refused');

console.log(`knowledge capabilities smoke ok: ${cases} checks`);
