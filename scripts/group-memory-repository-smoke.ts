import assert from 'node:assert/strict';
import {
  normalizeGroupMemoryRepository,
  stripLegacyGroupMemory,
  upsertGroupMemoryRecord,
} from '../src/group-memory';

const legacyEntry = [
  '[群体记忆｜verified-fact｜id=legacy-1｜source=primary｜topic=topic-1｜confidence=1.00｜createdAt=100]',
  '月亮基地已经建成。',
].join('\n');
const mixedMemory = `角色自己的聊天记忆。\n\n${legacyEntry}`;
const migrated = normalizeGroupMemoryRepository(null, [mixedMemory, legacyEntry], 200);
assert.equal(migrated.records.length, 1);
assert.equal(migrated.records[0]?.id, 'legacy-1');
assert.equal(stripLegacyGroupMemory(mixedMemory), '角色自己的聊天记忆。');

const repository = normalizeGroupMemoryRepository(null, [legacyEntry], 200);
const updated = upsertGroupMemoryRecord(repository, {
  ...repository.records[0]!, summary: '月亮基地新版事实。', updatedAt: 300,
});
assert.equal(updated.records.length, 1);
assert.equal(updated.records[0]?.summary, '月亮基地新版事实。');

console.log('group memory repository smoke ok');
