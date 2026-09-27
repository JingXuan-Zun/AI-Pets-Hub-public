import assert from 'node:assert/strict';
import {
  createAgentUnverifiedResultFinalRejection,
  type AgentSessionV2Decision,
} from '../src/agent/legacy/index.ts';
import {
  assertSourceDoesNotMatch,
  assertSourceMatches,
  readProjectSources,
} from './smokeTestHarness.ts';

const {
  runtimeSignal: runtimeSignalSource,
  session: sessionSource,
} = readProjectSources({
  runtimeSignal: 'src/agent/runtime/agentFinalAnswerRejectionSignals.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
});

assertSourceMatches(
  runtimeSignalSource,
  /export function createAgentUnverifiedResultFinalRejection/u,
  'Unverified result final rejection should live in Runtime.',
);
assertSourceMatches(
  runtimeSignalSource,
  /unverifiedResultFinalRejectionPolicy=This rejection is advisory\/evidence-driven/u,
  'Unverified result final rejection signal should explicitly remain advisory and evidence-driven.',
);
assertSourceMatches(
  sessionSource,
  /from '\.\/runtime\/agentFinalAnswerRejectionSignals'/u,
  'AgentSessionV2 should consume Runtime final-answer rejection signals.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /function createAgentSessionV2UnverifiedResultFinalRejection/u,
  'AgentSessionV2 should not own unverified result final rejection signal implementation.',
);
assertSourceMatches(
  sessionSource,
  /function shouldRejectAgentSessionV2UnverifiedResultFinal/u,
  'AgentSessionV2 should still own the unverified final-answer predicate for this slice.',
);

const decision: AgentSessionV2Decision = {
  action: 'final_answer',
  message: 'It is done.',
  understanding: {
    completedGoals: ['clicked the launcher start button'],
    remainingGoals: [],
    successCriteria: 'the requested app is visibly launched',
    userNeed: 'start Example App',
    verificationEvidence: ['The click primitive completed.'],
    verificationGaps: ['No evidence that Example App opened.'],
    verificationStatus: 'unknown',
  },
};

const rejectionText = createAgentUnverifiedResultFinalRejection(decision);

assert.match(rejectionText, /The model produced a rejected final_answer because the user-level result is not verified well enough/u);
assert.match(rejectionText, /userNeed=start Example App/u);
assert.match(rejectionText, /successCriteria=the requested app is visibly launched/u);
assert.match(rejectionText, /verificationStatus=unknown/u);
assert.match(rejectionText, /verificationEvidence=The click primitive completed/u);
assert.match(rejectionText, /verificationGaps=No evidence that Example App opened/u);
assert.match(rejectionText, /unverifiedResultFinalRejectionPolicy=This rejection is advisory\/evidence-driven/u);
assert.match(rejectionText, /Next action must verify the user-level outcome/u);
assert.match(rejectionText, /rejectedMessage=It is done/u);
assert.doesNotMatch(
  rejectionText,
  /open_app\s*->\s*wait_ui\s*->\s*locate\s*->\s*click\s*->\s*verify/iu,
  'Unverified result final rejection signal should not encode a fixed tool chain.',
);

const missingEvidenceText = createAgentUnverifiedResultFinalRejection({
  action: 'final_answer',
  message: 'Done.',
  understanding: {
    verificationStatus: 'satisfied',
  },
});

assert.match(missingEvidenceText, /verificationStatus=satisfied/u);
assert.match(missingEvidenceText, /verificationEvidence=missing/u);

console.log('agent session v2 unverified result final rejection signal smoke ok');
