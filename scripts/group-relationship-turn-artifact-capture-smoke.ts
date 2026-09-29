import assert from 'node:assert/strict';
import {
  EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY,
  upsertDirectedRelationship,
} from '../src/character-relationship';
import { captureGroupRelationshipTurnArtifacts } from '../src/components/chat/group/relationship/groupRelationshipCandidateCapture';
import type { PetConfig, PetConfigUpdateHandler } from '../src/types';

const relationshipRepository = upsertDirectedRelationship(EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY, {
  dimensions: { intimacy: 80, trust: 85, vigilance: 20 }, evidenceSummary: 'formal relation',
  sourceRoleId: 'alice', targetRoleId: 'berry', targetRoleName: 'Berry',
}, { now: 100, reason: 'manual relation', source: 'manual' });
const configRef = { current: { directedRelationshipRepository: relationshipRepository } as PetConfig };
const targetSlots = [{ id: 'alice', personality: { name: 'Alice' } }, {
  id: 'berry', personality: { name: 'Berry' },
}] as Parameters<typeof captureGroupRelationshipTurnArtifacts>[0]['targetSlots'];
let updateCount = 0;
const onUpdateConfig: PetConfigUpdateHandler = (config, options) => {
  updateCount += 1;
  assert.equal(config, configRef.current);
  assert.deepEqual(options, { normalize: false, persist: true, priority: 'low' });
};

const baseInput = {
  addressedRoleIds: ['berry'], behaviorTargetRoleIds: ['berry'], groupSessionId: 'group-1',
  groupRoleTurnOutput: { text: 'Berry 的方案可以采用，但重要结果仍要核对。' },
  sourceMessageId: 'turn-1', sourceRoleId: 'alice', sourceRoleName: 'Alice', topicId: 'topic-1',
};
assert.equal(captureGroupRelationshipTurnArtifacts({ configRef, input: baseInput, onUpdateConfig, targetSlots }), true);
assert.equal(updateCount, 1);
assert.equal(configRef.current.directedRelationshipRepository.behaviorTraces.length, 1);
assert.equal(configRef.current.directedRelationshipRepository.candidates.length, 0);
assert.equal(captureGroupRelationshipTurnArtifacts({ configRef, input: baseInput, onUpdateConfig, targetSlots }), false);
assert.equal(updateCount, 1, 'deduped turn must not persist again');

const withSignal = {
  ...baseInput,
  groupRoleTurnOutput: {
    text: 'Berry 再次提供了可靠帮助。',
    relationshipSignal: {
      deltas: { intimacy: 1, trust: 2, vigilance: -1 }, reason: 'reliable help', targetRoleName: 'Berry',
    },
  },
  sourceMessageId: 'turn-2',
};
assert.equal(captureGroupRelationshipTurnArtifacts({ configRef, input: withSignal, onUpdateConfig, targetSlots }), true);
assert.equal(updateCount, 2, 'trace and candidate should persist in one config update');
assert.equal(configRef.current.directedRelationshipRepository.behaviorTraces.length, 2);
assert.equal(configRef.current.directedRelationshipRepository.candidates.length, 1);
assert.equal(configRef.current.directedRelationshipRepository.records.length, 1,
  'turn capture must not modify formal relationship records');
console.log('group relationship turn artifact capture smoke ok');
