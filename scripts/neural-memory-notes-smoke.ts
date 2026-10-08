import assert from 'node:assert/strict';
import type {
  NeuralPersonaEdge,
  NeuralPersonaGraphSnapshot,
  NeuralPersonaNode,
} from '../src/character-graph/neural-persona';
import {
  groupMemoryNotes,
  memoryContentSegments,
  memoryNoteLinks,
  memoryNotes,
} from '../src/components/settings/memory-notes/neuralMemoryNotes';
import {
  insertNeuralMemoryLink,
  insertTextAt,
  neuralMemoryLinkLabel,
} from '../src/neural-memory/neuralMemoryLinkInsertion';
import {
  createMemoryForceSimulation,
  DEFAULT_MEMORY_FORCE_SETTINGS,
} from '../src/components/settings/memory-notes/memoryForceSimulation';
import {
  activeMemoryTags,
  addMemoryTag,
  memoryHasTag,
  removeMemoryTag,
} from '../src/components/settings/memory-notes/neuralMemoryTags';
import {
  DEFAULT_NEURAL_PERSONA_CONFIG,
  createNeuralPersonaGraphRepository,
  createNeuralPersonaNodeCommandService,
  type NeuralPersonaAtomicStorage,
} from '../src/character-graph/neural-persona';

function node(nodeId: string, influenceSummary: string, extra: Partial<NeuralPersonaNode> = {}): NeuralPersonaNode {
  return {
    activationCount: 0, baseWeight: 0.6, confidence: 0.8, createdAt: 1, currentActivation: 0,
    decayRate: 0.02, influenceSummary, nodeId, ownerRoleId: 'r', plasticity: 0.3, protected: false,
    schemaVersion: 1, scope: 'private', stability: 0.6, status: 'active', tags: [],
    type: 'experience', updatedAt: 1, ...extra,
  };
}

function edge(edgeId: string, sourceNodeId: string, targetNodeId: string, anchorText?: string): NeuralPersonaEdge {
  return {
    anchorText, confidence: 0.8, createdAt: 1, edgeId, ownerRoleId: 'r', relationType: 'associated-with',
    schemaVersion: 1, sourceNodeId, targetNodeId, updatedAt: 1, weight: 0.6,
  };
}

const graph: NeuralPersonaGraphSnapshot = {
  createdAt: 1, graphVersion: 'g', roleId: 'r', schemaVersion: 1,
  nodes: [
    node('anchor', '主体人格', { type: 'persona-anchor', protected: true }),
    node('topic', '饮食', { type: 'cognitive-topic' }),
    node('cilantro', '主人不吃辣椒，喝柠檬水时也不加', { type: 'preference', updatedAt: 5 }),
    node('tea', '主人爱喝柠檬水', { type: 'preference', updatedAt: 3 }),
    node('sick', '主人搬家时我帮过忙', { updatedAt: 4 }),
    node('interview', '主人下周三开会', { status: 'pending-review', updatedAt: 2 }),
    node('gone', '已删除的记忆', { status: 'deleted' }),
  ],
  edges: [
    edge('e-tea', 'cilantro', 'tea', '柠檬水'),
    edge('e-tea-long', 'cilantro', 'sick', '喝柠檬水'),
    edge('e-back', 'sick', 'cilantro'),
    edge('e-contains', 'topic', 'cilantro'),
    edge('e-missing-anchor', 'cilantro', 'interview', '不存在的文字'),
  ],
};
graph.edges[3].relationType = 'contains';

const notes = memoryNotes(graph);
assert.deepEqual(notes.map((item) => item.nodeId), ['cilantro', 'tea', 'sick', 'interview'],
  'structural nodes, the persona anchor and deleted memories are hidden');

const groups = groupMemoryNotes(notes, '');
assert.equal(groups[0].key, 'staged', 'staged memories come first');
assert.deepEqual(groups[0].notes.map((item) => item.nodeId), ['interview']);
assert.deepEqual(groups.map((group) => group.key), ['staged', 'experience', 'preference']);
assert.deepEqual(groups[2].notes.map((item) => item.nodeId), ['cilantro', 'tea'], 'newest first inside a group');
assert.deepEqual(groupMemoryNotes(notes, '柠檬').flatMap((group) => group.notes.map((item) => item.nodeId)), ['cilantro', 'tea']);

const links = memoryNoteLinks(graph, 'cilantro');
assert.deepEqual(links.filter((link) => link.direction === 'outgoing').map((link) => link.edge.edgeId),
  ['e-tea', 'e-tea-long', 'e-missing-anchor'], 'contains edges are not memory links');
assert.deepEqual(links.filter((link) => link.direction === 'incoming').map((link) => link.other.nodeId), ['sick']);

const segments = memoryContentSegments(graph.nodes[2].influenceSummary, links);
assert.equal(segments.map((segment) => segment.text).join(''), graph.nodes[2].influenceSummary, 'segments rebuild the text');
const linked = segments.filter((segment) => segment.link);
assert.equal(linked.length, 1, 'overlapping anchors keep only the longest; missing anchors are skipped');
assert.equal(linked[0].text, '喝柠檬水');
assert.equal(linked[0].link?.other.nodeId, 'sick');
assert.deepEqual(memoryContentSegments('没有关联', []), [{ text: '没有关联' }]);

// Drag-to-link: label is the first phrase, inserted at the drop offset and linked.
assert.equal(neuralMemoryLinkLabel({ influenceSummary: '主人爱喝柠檬水，每天下午一杯' }), '主人爱喝柠檬水');
assert.equal(neuralMemoryLinkLabel({ influenceSummary: '  ' }), '一段记忆');
assert.equal(insertTextAt('abc', 1, 'X'), 'aXbc');
assert.equal(insertTextAt('abc', 99, 'X'), 'abcX');

function memoryStorage(): NeuralPersonaAtomicStorage {
  const records = new Map<string, string>();
  return {
    compareAndSwap: async (roleId, expected, next) => {
      if ((records.get(roleId) ?? null) !== expected) return false;
      records.set(roleId, next); return true;
    },
    read: async (roleId) => records.get(roleId) ?? null,
  };
}
const repository = createNeuralPersonaGraphRepository({ config: DEFAULT_NEURAL_PERSONA_CONFIG, now: () => 10, storage: memoryStorage() });
const nodeService = createNeuralPersonaNodeCommandService({ now: () => 10, repository });
await nodeService.initializeGraph({ commandId: 'init', roleId: 'role' });
const draft = (nodeId: string, influenceSummary: string) => ({
  baseWeight: 0.6, confidence: 0.8, decayRate: 0.02, influenceSummary, nodeId, plasticity: 0.3,
  protected: false, scope: 'private' as const, stability: 0.6, status: 'active' as const, tags: [], type: 'experience' as const,
});
await nodeService.createNode({ commandId: 'a', expectedRevision: 0, node: draft('a', '主人不吃辣椒'), roleId: 'role' });
await nodeService.createNode({ commandId: 'b', expectedRevision: 1, node: draft('b', '主人爱喝柠檬水，每天下午一杯'), roleId: 'role' });
const dropped = await insertNeuralMemoryLink({ offset: 2, repository, roleId: 'role', sourceNodeId: 'a', targetNodeId: 'b' });
assert.equal(dropped.status, 'ok', 'text insertion and link creation chain on the latest revision');
if (dropped.status !== 'ok') throw new Error('unreachable');
const linkedNode = dropped.record.graph.nodes.find((item) => item.nodeId === 'a')!;
assert.equal(linkedNode.influenceSummary, '主人主人爱喝柠檬水不吃辣椒');
const linkedEdge = dropped.record.graph.edges.find((item) => item.sourceNodeId === 'a' && item.targetNodeId === 'b')!;
assert.equal(linkedEdge.anchorText, '主人爱喝柠檬水', 'the inserted text becomes the colored anchor');
assert.equal((await insertNeuralMemoryLink({ offset: 0, repository, roleId: 'role', sourceNodeId: 'a', targetNodeId: 'a' })).status, 'invalid');

// Obsidian-like simulation: dragging keeps the whole graph warm, release drifts to rest.
const sim = createMemoryForceSimulation(['a', 'b', 'c', 'd'], [{ source: 'a', target: 'b' }, { source: 'b', target: 'c' }], DEFAULT_MEMORY_FORCE_SETTINGS);
let settleTicks = 0;
while (sim.isActive() && settleTicks < 2000) { sim.tick(); settleTicks += 1; }
assert.ok(settleTicks > 100 && settleTicks < 2000, `the graph cools to rest gradually (${settleTicks} ticks)`);
const rest = new Map(sim.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
sim.dragStart('a');
for (let step = 0; step < 40; step += 1) { sim.dragMove('a', { x: rest.get('a')!.x + step * 5, y: rest.get('a')!.y }); sim.tick(); }
const shift = (id: string) => Math.hypot(sim.nodes.find((n) => n.id === id)!.x - rest.get(id)!.x, sim.nodes.find((n) => n.id === id)!.y - rest.get(id)!.y);
assert.ok(shift('c') > 20, `a two-hop memory follows the drag (${Math.round(shift('c'))})`);
assert.ok(shift('d') > 1, 'even an unlinked memory reacts while the graph is warm');
for (let step = 0; step < 300; step += 1) sim.tick();
const held = sim.nodes.find((n) => n.id === 'a')!; const hanging = sim.nodes.find((n) => n.id === 'b')!;
assert.ok(Math.hypot(hanging.x - held.x, hanging.y - held.y) < DEFAULT_MEMORY_FORCE_SETTINGS.linkDistance * 1.6,
  'while a node is held, its linked memory hangs close instead of staying stretched');
sim.dragEnd('a');
sim.tick();
assert.ok(sim.isActive(), 'the graph keeps drifting after release');
let releaseTicks = 0;
while (sim.isActive() && releaseTicks < 2000) { sim.tick(); releaseTicks += 1; }
assert.ok(releaseTicks > 30 && releaseTicks < 2000, `released graph settles over time (${releaseTicks} ticks)`);

// A graph dragged elsewhere eases back where it was left: no snap, no return to the middle.
const far = createMemoryForceSimulation(['p', 'q', 'r'], [{ source: 'p', target: 'q' }, { source: 'q', target: 'r' }], DEFAULT_MEMORY_FORCE_SETTINGS);
for (let step = 0; step < 400; step += 1) far.tick();
far.dragStart('p');
for (let step = 1; step <= 60; step += 1) { far.dragMove('p', { x: step * 8, y: 0 }); far.tick(); }
const farPoint = far.nodes[0];
const stretch = () => Math.hypot(farPoint.x - far.nodes[1].x, farPoint.y - far.nodes[1].y);
const releasedStretch = stretch();
far.dragEnd('p');
far.tick(); far.tick();
assert.ok(releasedStretch - stretch() < (releasedStretch - DEFAULT_MEMORY_FORCE_SETTINGS.linkDistance) * 0.5, `a released memory eases back instead of snapping (${Math.round(releasedStretch)} -> ${Math.round(stretch())})`);
for (let step = 0; step < 3000 && far.isActive(); step += 1) far.tick();
const centroidX = far.nodes.reduce((sum, node) => sum + node.x, 0) / 3;
assert.ok(centroidX > 100, `the released graph stays where it was moved (${Math.round(centroidX)})`);

// Tags: added from the editor row, removed with ×, and found by filtering.
const untagged = node('t', '主人不吃辣椒', { tags: [{ canonicalId: 'system:food', label: '饮食', source: 'system', status: 'active' }] });
const withHabit = { ...untagged, tags: addMemoryTag(untagged, '习惯')! };
assert.deepEqual(activeMemoryTags(withHabit).map((tag) => tag.label), ['饮食', '习惯']);
assert.equal(addMemoryTag(withHabit, '习惯'), null, 'an existing tag is not added twice');
const habitId = activeMemoryTags(withHabit)[1].canonicalId;
assert.ok(memoryHasTag(withHabit, habitId), 'a tagged memory matches its tag filter');
const withoutHabit = { ...withHabit, tags: removeMemoryTag(withHabit, habitId) };
assert.equal(withoutHabit.tags.length, 1, 'removing a user tag drops it');
const withoutFood = { ...withHabit, tags: removeMemoryTag(withHabit, 'system:food') };
assert.equal(withoutFood.tags.find((tag) => tag.canonicalId === 'system:food')?.status, 'rejected', 'a removed system tag is kept as rejected');
assert.ok(!memoryHasTag(withoutFood, 'system:food'), 'a rejected tag no longer matches');
assert.equal(addMemoryTag(withoutFood, '饮食') === null, false, 'typing a removed tag again brings it back');

console.log('neural memory notes smoke ok');
