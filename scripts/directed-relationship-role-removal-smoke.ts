import assert from 'node:assert/strict';
import {
  EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY,
  recordDirectedRelationshipBehaviorTrace,
  upsertDirectedRelationship,
} from '../src/character-relationship';
import { removeDesktopPetSlot } from '../src/multiPetRoster';
import type { PetConfig } from '../src/types';

let repository = upsertDirectedRelationship(EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY, {
  dimensions: { intimacy: 50, trust: 60, vigilance: 20 }, evidenceSummary: '',
  sourceRoleId: 'primary', targetRoleId: 'companion-pet-2',
}, { now: 100, reason: 'outgoing relation', source: 'manual' });
repository = upsertDirectedRelationship(repository, {
  dimensions: { intimacy: 30, trust: 25, vigilance: 70 }, evidenceSummary: '',
  sourceRoleId: 'companion-pet-2', targetRoleId: 'primary',
}, { now: 110, reason: 'incoming relation', source: 'manual' });
repository = recordDirectedRelationshipBehaviorTrace(repository, {
  addressedRoleIds: ['companion-pet-2'], behaviorTargetRoleIds: ['companion-pet-2'],
  groupSessionId: 'group-removal', outputExcerpt: 'turn output', sourceMessageId: 'turn-removal',
  sourceRoleId: 'primary', sourceRoleName: 'Primary', topicId: 'topic-removal',
}, 120);
assert.equal(repository.behaviorTraces.length, 1);
const config = {
  companionPets: [{ id: 'companion-pet-2' }], directedRelationshipRepository: repository,
} as PetConfig;
const removed = removeDesktopPetSlot(config, 'companion-pet-2');
assert.equal(removed.companionPets.length, 0);
assert.equal(removed.directedRelationshipRepository.records.length, 0);
assert.equal(removed.directedRelationshipRepository.behaviorTraces.length, 0);
assert.equal(
  removed.directedRelationshipRepository.auditTrail.filter((entry) => entry.kind === 'remove-role').length,
  2,
);

console.log('directed relationship role removal smoke ok');
