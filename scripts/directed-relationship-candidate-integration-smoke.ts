import assert from 'node:assert/strict';
import { readProjectFile } from './smokeTestHarness.ts';

const initial = readProjectFile('src/components/chat/chatPreparedTargetResponses.ts');
const continuation = readProjectFile('src/components/chat/chatPreparedGroupContinuation.ts');
const taskContinuation = readProjectFile('src/components/chat/group/task/groupTaskSenderLifecycle.ts');
const response = readProjectFile('src/components/chat/usePetChatResponseTurn.ts');
const stream = readProjectFile('src/components/chat/chatResponseTurnUtils.ts');
const visible = readProjectFile('src/components/chat/characterToolProtocol.ts');
const section = readProjectFile('src/components/settings/SettingsDirectedRelationshipSection.tsx');
const inbox = readProjectFile('src/components/settings/SettingsDirectedRelationshipCandidateInbox.tsx');
const actions = readProjectFile('src/components/settings/SettingsDirectedRelationshipCandidateActions.tsx');
const review = readProjectFile('src/components/settings/useSettingsDirectedRelationshipCandidateReview.ts');
const behaviorPreview = readProjectFile('src/components/settings/SettingsDirectedRelationshipBehaviorPreview.tsx');
const relationshipList = readProjectFile('src/components/settings/SettingsDirectedRelationshipList.tsx');
const behaviorTimeline = readProjectFile('src/components/settings/SettingsDirectedRelationshipBehaviorTimeline.tsx');
const candidateGroups = readProjectFile(
  'src/components/settings/SettingsDirectedRelationshipCandidateGroups.tsx',
);

assert.match(initial, /captureGroupRelationshipTurnArtifacts/u);
assert.match(continuation, /onRelationshipTurnComplete[\s\S]*captureGroupRelationshipTurnArtifacts/u);
assert.match(taskContinuation, /onRelationshipTurnComplete[\s\S]*captureGroupRelationshipTurnArtifacts/u);
assert.match(response, /extractGroupRelationshipSignal/u);
assert.match(response, /stripGroupRoleSignalMarkers/u);
assert.match(stream, /stripGroupRoleSignalMarkers/u);
assert.match(visible, /stripGroupRoleSignalMarkers/u);
assert.match(section, /SettingsDirectedRelationshipCandidateInbox/u);
assert.match(section, /SettingsDirectedRelationshipShadowReport/u);
assert.match(inbox, /反向正式关系/u);
assert.match(inbox, /反方向待审核候选/u);
assert.match(actions, /撤销审核/u);
assert.match(actions, /批准可审核项/u);
assert.match(review, /rollbackDirectedRelationshipCandidateReview/u);
assert.match(review, /reviewDirectedRelationshipCandidateBatch/u);
assert.match(inbox, /buildDirectedRelationshipCandidateGroups/u);
assert.match(candidateGroups, /按定向关系分组审核/u);
assert.match(candidateGroups, /候选累计/u);
assert.match(review, /onApproveGroup/u);
assert.match(review, /onRejectGroup/u);
assert.match(behaviorPreview, /deriveDirectedRelationshipBehaviorPolicy/u);
assert.match(relationshipList, /SettingsDirectedRelationshipBehaviorPreview/u);
assert.match(behaviorTimeline, /只证明策略被提供给该轮角色/u);
assert.match(section, /SettingsDirectedRelationshipBehaviorTimeline/u);
assert.doesNotMatch(initial, /upsertDirectedRelationship/u, 'runtime capture must not write formal records');
console.log('directed relationship candidate integration smoke ok');
