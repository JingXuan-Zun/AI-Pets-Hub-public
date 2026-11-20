// Character growth (11-19): she looks back only when enough new memories came in (at most daily,
// at most two proposals a week, or by hand); a growth needs at least two real memories behind it;
// approving makes it an active node tagged 成长, linked from those memories; she knows about it for
// a week; the 成长日记 and the persona node show it.
import assert from 'node:assert/strict';
import {
  createNeuralPersonaGraphRepository,
  createNeuralPersonaNodeCommandService,
  DEFAULT_NEURAL_PERSONA_CONFIG,
  type NeuralPersonaAtomicStorage,
} from '../src/character-graph/neural-persona';

const data = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  clear: () => data.clear(), getItem: (key: string) => data.get(key) ?? null, key: () => null, length: 0,
  removeItem: (key: string) => { data.delete(key); }, setItem: (key: string, value: string) => { data.set(key, value); },
};
const rules = await import('../src/character-growth/growthRules');
const { applyGrowthProposal } = await import('../src/character-growth/growthApply');
const { growthNoteFor, readGrowthState } = await import('../src/character-growth/growthStore');
const { growthDiary, withPersonaNode, personaNodeId } = await import('../src/components/settings/memory-notes/personaNode');
const { normalizeNeuralMemoryProposals } = await import('../src/neural-memory/neuralMemoryProposalTypes');

let checks = 0;
const check = (condition: boolean, label: string) => { assert.ok(condition, label); checks += 1; };
const now = Date.UTC(2026, 10, 19, 12);
const hour = 3600_000;

// When she looks back.
check(!rules.shouldReflect({ lastReflectionAt: null, newMemoryCount: 4, now, proposedThisWeek: 0 }).ok, 'not with only 4 new memories');
check(rules.shouldReflect({ lastReflectionAt: null, newMemoryCount: 5, now, proposedThisWeek: 0 }).ok, 'with 5');
check(!rules.shouldReflect({ lastReflectionAt: now - 2 * hour, newMemoryCount: 9, now, proposedThisWeek: 0 }).ok, 'not twice a day');
check(!rules.shouldReflect({ force: true, lastReflectionAt: now, newMemoryCount: 0, now, proposedThisWeek: 2 }).ok, 'never more than two a week, even by hand');
check(rules.shouldReflect({ force: true, lastReflectionAt: now, newMemoryCount: 0, now, proposedThisWeek: 1 }).ok, '回顾一下 skips the other waits');

// The prompt keeps personality fixed; parsing needs two real memories.
const prompt = rules.buildGrowthReflectionPrompt({ existingGrowth: [], memories: [], pending: [], persona: '设定', roleName: '乙' });
check(/性格由 persona 定死/u.test(prompt.systemInstruction) && /至少 2 条/u.test(prompt.systemInstruction), 'personality fixed, evidence required');
const ids = new Set(['m1', 'm2', 'm3']);
const parsed = rules.parseGrowthReflection('{"growth":[{"kind":"preference","text":"我好像开始喜欢看老电影了","why":"三个晚上都一起看了老电影","evidence":["m1","m2"]},{"kind":"habit","text":"只有一条依据","evidence":["m1","nope"]},{"kind":"personality","text":"变外向了","evidence":["m1","m2"]}]}', ids);
check(parsed.length === 1 && parsed[0].kind === 'preference', 'only backed, allowed kinds pass (no personality, no made-up evidence)');

// Approving: an active 成长 node linked from its memories.
const store = new Map<string, string>();
const storage: NeuralPersonaAtomicStorage = {
  compareAndSwap: async (roleId, expected, next) => { if ((store.get(roleId) ?? null) !== expected) return false; store.set(roleId, next); return true; },
  read: async (roleId) => store.get(roleId) ?? null,
};
const repository = createNeuralPersonaGraphRepository({ config: DEFAULT_NEURAL_PERSONA_CONFIG, now: () => now, storage });
const nodes = createNeuralPersonaNodeCommandService({ repository, now: () => now });
await nodes.initializeGraph({ commandId: 'init', roleId: 'pet-4' });
for (const id of ['m1', 'm2']) {
  const loaded = await repository.load('pet-4');
  if (loaded.status !== 'ok') throw new Error('graph missing');
  await nodes.createNode({ commandId: `c-${id}`, expectedRevision: loaded.record.revision, roleId: 'pet-4', node: { baseWeight: 0.6, confidence: 0.8, decayRate: 0.02, influenceSummary: `晚上一起看老电影 ${id}`, nodeId: id, plasticity: 0.3, protected: false, scope: 'private', stability: 0.6, status: 'pending-review', tags: [], type: 'experience' } });
}
const [proposal] = normalizeNeuralMemoryProposals([{ content: parsed[0].text, createdAt: now, growth: { evidenceNodeIds: parsed[0].evidence, kind: parsed[0].kind }, id: 'g1', reason: parsed[0].why, roleId: 'pet-4', sourceExcerpt: '', sourceMessageIds: [], type: 'preference' }]);
check(proposal.growth?.kind === 'preference' && proposal.growth.evidenceNodeIds.length === 2, 'the growth survives being saved as a proposal');
const applied = await applyGrowthProposal(proposal, proposal.content, repository, now);
check(applied.status === 'ok', 'approved');
if (applied.status !== 'ok') throw new Error('not applied');
const graph = applied.record.graph;
const node = graph.nodes.find((item) => item.nodeId === 'growth-g1');
check(Boolean(node) && node!.status === 'active' && rules.isGrowthNode(node!), 'active at once, tagged 成长');
check(graph.edges.filter((edge) => edge.targetNodeId === 'growth-g1' && edge.relationType === 'supports').length === 2, 'linked from both memories');

// She knows; the diary and her persona node show it.
check(/我好像开始喜欢看老电影了/u.test(growthNoteFor('pet-4', now + hour)) && growthNoteFor('pet-4', now + 8 * 24 * hour) === '', 'she knows for a week');
check(readGrowthState('pet-4').approved.length === 1, 'recorded');
const diary = growthDiary(graph);
check(diary.length === 1 && diary[0].kindLabel === '喜好' && diary[0].evidenceCount === 2, '成长日记 entry with its evidence');
const shown = withPersonaNode(graph, 'pet-4', '乙');
check(shown.edges.some((edge) => edge.sourceNodeId === personaNodeId('pet-4') && edge.targetNodeId === 'growth-g1') && !graph.edges.some((edge) => edge.edgeId.startsWith('persona-growth')), 'hangs off her persona node (display only)');
check(rules.growthSourceMemories(graph).every((item) => !rules.isGrowthNode(item)), 'growth is not fed back as a memory');

console.log(`character growth smoke ok: ${checks} checks`);
