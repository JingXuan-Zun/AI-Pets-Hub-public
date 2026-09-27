import assert from 'node:assert/strict';
import { resolveGroupSocialAutomationModes } from '../src/components/chat/group/social/groupSocialAutomationPolicy';

const disabled = resolveGroupSocialAutomationModes({
  automaticMemoryWriteEnabled: false,
  automaticRelationshipEvolutionEnabled: false,
  automaticSubgroupEvolutionEnabled: false,
});
assert.deepEqual(disabled, { memory: 'disabled', relationship: 'disabled', subgroup: 'disabled' });
const candidateOnly = resolveGroupSocialAutomationModes({
  automaticMemoryWriteEnabled: true,
  automaticRelationshipEvolutionEnabled: true,
  automaticSubgroupEvolutionEnabled: true,
});
assert.deepEqual(candidateOnly, { memory: 'candidate-only', relationship: 'candidate-only', subgroup: 'candidate-only' });
console.log('group social automation policy smoke ok');
