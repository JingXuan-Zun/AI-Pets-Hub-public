import assert from 'node:assert/strict';
import type { NeuralPersonaNode } from '../src/character-graph/neural-persona';
import {
  buildNeuralMemoryTagPrompt,
  knownMemoryTagLabels,
  parseNeuralMemoryTagSuggestion,
  suggestedMemoryTags,
} from '../src/neural-memory/neuralMemoryTagSuggestion';

const tagged = (labels: string[]) => ({
  tags: labels.map((label) => ({ canonicalId: `custom:${label}`, label, source: 'user', status: 'active' })),
}) as unknown as NeuralPersonaNode;

const known = knownMemoryTagLabels([tagged(['饮食', '主人']), tagged(['饮食']), tagged(['工作'])]);
assert.deepEqual(known, ['饮食', '主人', '工作'], 'known tags are ordered by how often they are used');

const input = {
  content: '主人说过不喜欢吃辣椒，以后做饭要记得避开。',
  knownTags: known,
  memoryTags: [{ canonicalId: 'custom:辣椒', label: '辣椒', source: 'user' as const, status: 'active' as const }],
  roleName: '小桃',
};
const prompt = buildNeuralMemoryTagPrompt(input);
assert.match(prompt.systemInstruction, /3 to 5/u, 'the prompt asks for 3 to 5 tags');
assert.match(prompt.payload, /existingTags/u, 'existing tags are sent so the model reuses them');

const labels = parseNeuralMemoryTagSuggestion(
  'Sure: {"tags":["吃饭","#辣椒","做饭","主人","这是一个非常非常长的不合格标签","做饭","偏好","习惯"]}',
  input,
);
assert.deepEqual(labels, ['饮食', '做饭', '主人', '偏好', '习惯'],
  'aliases map onto shared labels, tags already on the memory, duplicates and long tags are skipped, at most 5');
assert.deepEqual(parseNeuralMemoryTagSuggestion('not json', input), [], 'bad output gives no tags');

const tags = suggestedMemoryTags(['饮食', '做饭'], new Map([['饮食', 'topic:food']]));
assert.equal(tags[0].canonicalId, 'topic:food', 'a known label keeps its existing tag id');
assert.ok(tags.every((tag) => tag.source === 'system' && tag.status === 'active'), 'automatic tags are active system tags');

console.log('neural memory tag suggestion smoke ok');
