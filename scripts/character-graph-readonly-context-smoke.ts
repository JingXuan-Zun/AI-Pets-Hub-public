import assert from 'node:assert/strict';
import {
  buildCharacterContextPacket,
  createReadonlyCharacterGraphStore,
  type CharacterGraphNode,
} from '../src/character-graph';

const now = 10 * 86_400_000;
const node = (
  id: string,
  visibility: CharacterGraphNode['visibility'],
  overrides: Partial<CharacterGraphNode> = {},
): CharacterGraphNode => ({
  confidence: 0.8, createdAt: now - 1000, eventAt: now - 1000,
  id, kind: 'episodic-memory', participantRoleIds: [], source: 'manual-test',
  summary: `${id} 讨论了月亮计划`, updatedAt: now - 1000, visibility, ...overrides,
});

const store = createReadonlyCharacterGraphStore([
  node('public', 'world/public'),
  node('alice-private', 'character-private', { ownerRoleId: 'alice' }),
  node('berry-private', 'character-private', { ownerRoleId: 'berry' }),
  node('team-red', 'group', { groupId: 'red' }),
  node('team-blue', 'group', { groupId: 'blue' }),
  node('user-secret', 'user-private'),
  node('invalid', 'world/public', { invalidatedAt: now }),
  node('public', 'world/public', { summary: 'public 新版月亮计划', updatedAt: now }),
]);

const packet = buildCharacterContextPacket(store, {
  groupIds: ['red'], maxCharacters: 500, maxNodes: 10,
  now, query: '月亮计划', roleId: 'alice',
});
const ids = packet.items.map((item) => item.nodeId);
assert.deepEqual(new Set(ids), new Set(['public', 'alice-private', 'team-red']));
assert.doesNotMatch(JSON.stringify(packet), /berry-private|team-blue|user-secret|invalid/u);
assert.equal(store.get('public')?.summary, 'public 新版月亮计划');
assert.ok(packet.items.every((item) => item.reason.some((reason) => reason.startsWith('visibility:'))));
assert.equal(packet.droppedNodeCount, 0);

const userPrivatePacket = buildCharacterContextPacket(store, {
  groupIds: [], includeUserPrivate: true, maxCharacters: 500, maxNodes: 10,
  now, query: '月亮计划', roleId: 'alice',
});
assert.ok(userPrivatePacket.items.some((item) => item.nodeId === 'user-secret'));

const budgetPacket = buildCharacterContextPacket(store, {
  groupIds: ['red'], maxCharacters: 30, maxNodes: 1,
  now, query: '月亮计划', roleId: 'alice',
});
assert.ok(budgetPacket.items.length <= 1);
assert.ok(budgetPacket.totalCharacters <= 30);
assert.equal('upsert' in store, false);

console.log('character graph readonly context smoke ok');
