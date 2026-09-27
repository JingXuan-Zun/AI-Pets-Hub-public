import assert from 'node:assert/strict';
import {
  isGroupTopicTransitionAllowed,
  resolveGroupTopicStatus,
  shouldContinueGroupTopic,
} from '../src/components/chat/group/topic/topicLifecycle';

assert.equal(resolveGroupTopicStatus(null, { hasNewUserInput: true }), 'starting');
assert.equal(resolveGroupTopicStatus('starting', {}), 'active');
assert.equal(resolveGroupTopicStatus('active', { repeatedReplyCount: 2 }), 'resolving');
assert.equal(resolveGroupTopicStatus('active', { hasDisagreement: true }), 'disputed');
assert.equal(resolveGroupTopicStatus('disputed', { waitingForInformation: true }), 'waiting-information');
assert.equal(resolveGroupTopicStatus('waiting-information', { hasNewInformation: true }), 'active');
assert.equal(resolveGroupTopicStatus('active', { hasStageConclusion: true }), 'concluded');
assert.equal(resolveGroupTopicStatus('concluded', { shouldDecay: true }), 'decaying');
assert.equal(resolveGroupTopicStatus('decaying', { shouldArchive: true }), 'archived');
assert.equal(resolveGroupTopicStatus('archived', { hasNewUserInput: true }), 'archived');
assert.equal(resolveGroupTopicStatus('archived', { startsDerivedTopic: true }), 'starting');
assert.equal(isGroupTopicTransitionAllowed('closed', 'active'), false);
assert.equal(isGroupTopicTransitionAllowed('closed', 'archived'), true);
assert.equal(resolveGroupTopicStatus('active', { userRequestedTopicChange: true }), 'closed');
assert.equal(shouldContinueGroupTopic('active'), true);
assert.equal(shouldContinueGroupTopic('disputed'), true);
assert.equal(shouldContinueGroupTopic('waiting-information'), false);
assert.equal(shouldContinueGroupTopic('resolving'), false);
assert.equal(shouldContinueGroupTopic('concluded'), false);
assert.equal(shouldContinueGroupTopic('archived'), false);
console.log('group topic lifecycle smoke ok');
