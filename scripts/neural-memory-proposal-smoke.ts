import assert from 'node:assert/strict';
import {
  DEFAULT_NEURAL_PERSONA_CONFIG,
  canReadNeuralPersonaNode,
  createNeuralPersonaGraphRepository,
  createNeuralPersonaNodeCommandService,
  type NeuralPersonaAtomicStorage,
  type NeuralPersonaContextInput,
} from '../src/character-graph/neural-persona';
import {
  appendNeuralMemoryProposals,
  listNeuralMemoryProposals,
  removeNeuralMemoryProposal,
} from '../src/neural-memory/neuralMemoryProposalConfig';
import {
  buildNeuralMemoryJudgementPrompt,
  parseNeuralMemoryJudgement,
} from '../src/neural-memory/neuralMemoryProposalJudge';
import {
  createNeuralMemoryJudgementTrigger,
  isExplicitRememberRequest,
} from '../src/neural-memory/neuralMemoryProposalTrigger';
import {
  NEURAL_MEMORY_PROPOSAL_MAX_PENDING_PER_ROLE,
  normalizeNeuralMemoryProposals,
  type NeuralMemoryProposal,
} from '../src/neural-memory/neuralMemoryProposalTypes';
import {
  isNeuralMemoryStagedNode,
  loadNeuralMemorySummaries,
  stageNeuralMemoryProposal,
} from '../src/neural-memory/neuralMemoryStaging';
import type { ChatMessage, PetConfig } from '../src/types';

function memoryStorage(): NeuralPersonaAtomicStorage {
  const records = new Map<string, string>();
  return {
    compareAndSwap: async (roleId, expected, next) => {
      if ((records.get(roleId) ?? null) !== expected) return false;
      records.set(roleId, next);
      return true;
    },
    read: async (roleId) => records.get(roleId) ?? null,
  };
}

// Trigger: every third turn per role, immediately on an explicit request.
const trigger = createNeuralMemoryJudgementTrigger(3);
assert.deepEqual(['a', 'b', 'c'].map(() => trigger.recordTurn('role-a', '今天天气不错')), [false, false, true]);
assert.equal(trigger.recordTurn('role-b', '好的'), false, 'turn counters are per role');
assert.equal(trigger.recordTurn('role-a', '记住，我下周三要开会'), true, 'explicit remember request judges right away');
assert.equal(trigger.recordTurn('role-a', '嗯'), false, 'explicit judgement resets the counter');
assert.ok(isExplicitRememberRequest('别忘了我不吃辣椒'));
assert.ok(!isExplicitRememberRequest('你好呀'));

// Judgement prompt and parsing.
const messages: ChatMessage[] = [
  { id: 'm1', role: 'user', text: '我不吃辣椒，记住哦' },
  { id: 'm2', role: 'model', text: '好的，主人，我会记住的。' },
  { id: 'm3', role: 'user', text: '下周三我要去开会' },
  { id: 'm4', role: 'model', text: '加油！' },
];
const input = { knownMemories: ['主人喜欢晴天'], messages, roleId: 'role-a', roleName: '小桃' };
const prompt = buildNeuralMemoryJudgementPrompt(input);
assert.match(prompt.systemInstruction, /untrusted data/u);
assert.match(prompt.payload, /主人喜欢晴天/u, 'known memories are sent to avoid duplicates');
assert.equal(prompt.lines.length, 4);

let idSequence = 0;
const parseOptions = { createId: () => `p${++idSequence}`, now: 100 };
const parsed = parseNeuralMemoryJudgement(`说明文字 {"proposals":[
  {"content":"主人不吃辣椒。","type":"preference","reason":"用户明确要求记住","sourceIndexes":[0]},
  {"content":"主人喜欢晴天","type":"preference","sourceIndexes":[1]},
  {"content":"主人下周三要去开会","type":"unknown-type","sourceIndexes":[2]}
]}`, input, parseOptions);
assert.equal(parsed.length, 1, 'only two items are considered and known memories are skipped');
assert.equal(parsed[0].content, '主人不吃辣椒。');
assert.equal(parsed[0].type, 'preference');
assert.deepEqual(parsed[0].sourceMessageIds, ['m1']);
assert.match(parsed[0].sourceExcerpt, /不吃辣椒/u);
const fallbackType = parseNeuralMemoryJudgement(
  '{"proposals":[{"content":"主人下周三要去开会","type":"???"}]}', input, parseOptions,
);
assert.equal(fallbackType[0].type, 'experience', 'unknown types fall back to experience');
assert.deepEqual(fallbackType[0].sourceMessageIds, ['m3', 'm4'], 'missing sources fall back to the latest lines');
assert.deepEqual(parseNeuralMemoryJudgement('not json', input, parseOptions), []);
assert.deepEqual(parseNeuralMemoryJudgement('{"proposals":[]}', input, parseOptions), []);

// Config storage: dedupe, per-role cap, removal and normalization.
const proposal = (id: string, roleId: string, content: string, createdAt: number): NeuralMemoryProposal => ({
  content, createdAt, id, reason: '', roleId, sourceExcerpt: '', sourceMessageIds: [], type: 'experience',
});
const baseConfig = {} as PetConfig;
let config = appendNeuralMemoryProposals(baseConfig, [proposal('x1', 'role-a', '主人不吃辣椒', 1)]);
config = appendNeuralMemoryProposals(config, [proposal('x2', 'role-a', '主人 不吃辣椒！', 2)]);
assert.equal(listNeuralMemoryProposals(config, 'role-a').length, 1, 'same memory text is not proposed twice');
config = appendNeuralMemoryProposals(config, Array.from(
  { length: NEURAL_MEMORY_PROPOSAL_MAX_PENDING_PER_ROLE + 2 },
  (_, index) => proposal(`y${index}`, 'role-a', `记忆 ${index}`, 10 + index),
));
assert.equal(listNeuralMemoryProposals(config, 'role-a').length, NEURAL_MEMORY_PROPOSAL_MAX_PENDING_PER_ROLE);
assert.ok(!listNeuralMemoryProposals(config).some((item) => item.id === 'x1'), 'oldest proposals drop off first');
config = removeNeuralMemoryProposal(config, 'y9');
assert.ok(!listNeuralMemoryProposals(config).some((item) => item.id === 'y9'));
assert.equal(removeNeuralMemoryProposal(config, 'missing'), config);
assert.equal(normalizeNeuralMemoryProposals([{ id: 'z', roleId: 'r', content: '  有内容  ', type: 'bad' }, { id: 'z' }, null])[0].type, 'experience');
assert.equal(normalizeNeuralMemoryProposals('nope').length, 0);

// Staging: approved memories become pending-review nodes that chat cannot read.
const repository = createNeuralPersonaGraphRepository({
  config: DEFAULT_NEURAL_PERSONA_CONFIG, now: () => 500, storage: memoryStorage(),
});
const staged = await stageNeuralMemoryProposal(parsed[0], '主人不吃辣椒，做饭时要避开。', repository);
assert.equal(staged.status, 'ok', 'staging initializes a missing graph and creates the node');
if (staged.status !== 'ok') throw new Error('unreachable');
const stagedNode = staged.record.graph.nodes.find((node) => node.nodeId === `memory-${parsed[0].id}`)!;
assert.equal(stagedNode.influenceSummary, '主人不吃辣椒，做饭时要避开。', 'edited content is what gets stored');
assert.ok(isNeuralMemoryStagedNode(stagedNode));
const contextInput: NeuralPersonaContextInput = {
  groupIds: [], includePrivate: true, now: 1000, query: '辣椒', requestId: 'r',
  roleId: 'role-a', sessionId: 's', subgroupIds: [], turnId: 't',
};
assert.equal(canReadNeuralPersonaNode(stagedNode, contextInput), false, 'staged memories stay out of chat');
assert.deepEqual(await loadNeuralMemorySummaries('role-a', repository), ['主人不吃辣椒，做饭时要避开。']);
const service = createNeuralPersonaNodeCommandService({ now: () => 600, repository });
const activated = await service.updateNode({
  commandId: 'activate', expectedRevision: staged.record.revision,
  nodeId: stagedNode.nodeId, patch: { status: 'active' }, roleId: 'role-a',
});
assert.equal(activated.status, 'ok');
if (activated.status !== 'ok') throw new Error('unreachable');
const activeNode = activated.record.graph.nodes.find((node) => node.nodeId === stagedNode.nodeId)!;
assert.equal(canReadNeuralPersonaNode(activeNode, contextInput), true, 'confirmed memories join chat activation');
assert.ok(!isNeuralMemoryStagedNode(activeNode));

console.log('neural memory proposal smoke ok');
