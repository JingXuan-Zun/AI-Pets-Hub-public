import assert from 'node:assert/strict';
import {
  createAgentUnattemptedRequestedActionFinalRejection,
  type AgentSessionV2Decision,
  type AgentRequestedActionKind,
} from '../src/agent/legacy/index.ts';
import {
  assertSourceDoesNotMatch,
  assertSourceMatches,
  readProjectSources,
} from './smokeTestHarness.ts';

const {
  index: indexSource,
  runtimeSignal: runtimeSignalSource,
  session: sessionSource,
  signal: signalSource,
} = readProjectSources({
  index: 'src/agent/legacy/index.ts',
  runtimeSignal: 'src/agent/runtime/agentFinalAnswerRejectionSignals.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
  signal: 'src/agent/runtime/agentFinalAnswerRejectionSignals.ts',
});

assertSourceMatches(
  runtimeSignalSource,
  /export function createAgentUnattemptedRequestedActionFinalRejection/u,
  'Unattempted requested action final rejection should live in Runtime.',
);
assertSourceMatches(
  runtimeSignalSource,
  /unattemptedRequestedActionFinalRejectionPolicy=This rejection is advisory\/evidence-driven/u,
  'Unattempted requested action final rejection signal should explicitly remain advisory and evidence-driven.',
);
assertSourceMatches(
  sessionSource,
  /from '\.\/runtime\/agentFinalAnswerRejectionSignals'/u,
  'AgentSessionV2 should consume Runtime final-answer rejection signals.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /function createAgentSessionV2UnattemptedRequestedActionFinalRejection/u,
  'AgentSessionV2 should not own unattempted requested action final rejection signal implementation.',
);
assertSourceMatches(
  sessionSource,
  /function shouldRejectAgentSessionV2UnattemptedRequestedActionFinal/u,
  'AgentSessionV2 should still own the unattempted requested action final predicate for this slice.',
);

const decision: AgentSessionV2Decision = {
  action: 'final_answer',
  message: 'Riot Client is open.',
  understanding: {
    completedGoals: ['open Riot Client'],
    remainingGoals: [],
    successCriteria: 'League of Legends should be launched from inside Riot Client',
    userNeed: 'open League of Legends inside Riot Client',
    verificationEvidence: ['Riot Client window is open.'],
    verificationStatus: 'satisfied',
  },
};

const requestedCoverage = new Set<AgentRequestedActionKind>([
  'in-app-action',
]);
const attemptedCoverage = new Set<AgentRequestedActionKind>([
  'open-or-launch',
]);
const missingCoverage: AgentRequestedActionKind[] = [
  'in-app-action',
];

const rejectionText = createAgentUnattemptedRequestedActionFinalRejection({
  attemptedCoverage,
  decision,
  missingCoverage,
  requestedCoverage,
});

assert.match(
  rejectionText,
  /The model produced a rejected final_answer before attempting every action type requested by the user/u,
);
assert.match(rejectionText, /requestedActionCoverage=in-app-action=perform the requested action inside the app UI/u);
assert.match(rejectionText, /attemptedActionCoverage=open-or-launch=open\/focus\/launch the requested app or resource/u);
assert.match(rejectionText, /missingActionGoals=in-app-action=perform the requested action inside the app UI/u);
assert.match(rejectionText, /inAppActionGap=The user requested an action inside an outer app\/launcher/u);
assert.match(rejectionText, /successCriteria=League of Legends should be launched from inside Riot Client/u);
assert.match(rejectionText, /verificationStatus=satisfied/u);
assert.match(rejectionText, /unattemptedRequestedActionFinalRejectionPolicy=This rejection is advisory\/evidence-driven/u);
assert.match(rejectionText, /Next action must address the missing action goals/u);
assert.match(rejectionText, /rejectedMessage=Riot Client is open/u);
assert.doesNotMatch(
  rejectionText,
  /open_app\s*->\s*wait_ui\s*->\s*locate\s*->\s*click\s*->\s*verify/iu,
  'Unattempted requested action final rejection signal should not encode a fixed tool chain.',
);

const chineseInAppDecision: AgentSessionV2Decision = {
  action: 'final_answer',
  message: '已打开 WeGame。',
  understanding: {
    completedGoals: ['open WeGame'],
    remainingGoals: [],
    successCriteria: '英雄联盟应从 WeGame 内启动',
    userNeed: '打开 WeGame 里的英雄联盟',
    verificationEvidence: ['WeGame window is open.'],
    verificationStatus: 'satisfied',
  },
};

const chineseRejectionText = createAgentUnattemptedRequestedActionFinalRejection({
  attemptedCoverage,
  decision: chineseInAppDecision,
  missingCoverage,
  requestedCoverage,
});

assert.match(chineseRejectionText, /inAppActionGap=/u);
assert.match(chineseRejectionText, /英雄联盟应从 WeGame 内启动/u);

console.log('agent session v2 unattempted requested action final rejection signal smoke ok');
