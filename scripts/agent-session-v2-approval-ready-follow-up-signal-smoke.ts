import assert from 'node:assert/strict';
import {
  createAgentApprovalReadyFollowUpReason,
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
  runtimeSignal: 'src/agent/runtime/agentApprovalReasonSignals.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
  signal: 'src/agent/runtime/agentApprovalReasonSignals.ts',
});

assertSourceMatches(
  runtimeSignalSource,
  /export function createAgentApprovalReadyFollowUpReason/u,
  'Approval-ready follow-up reason should be Runtime-owned.',
);
assertSourceMatches(
  runtimeSignalSource,
  /approvalReadyFollowUpPolicy=This signal is evidence-driven/u,
  'Approval-ready follow-up signal should explicitly remain evidence-driven.',
);
assertSourceMatches(
  sessionSource,
  /from '\.\/runtime\/agentApprovalReasonSignals'/u,
  'AgentSessionV2 should consume Runtime-owned approval reason signals.',
);
assertSourceMatches(
  sessionSource,
  /function resolveAgentSessionV2ApprovalReadyFollowUp/u,
  'AgentSessionV2 should still own the approval-ready follow-up resolver for this slice.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /approvalReadyFollowUpPolicy=This signal is evidence-driven/u,
  'AgentSessionV2 should not own approval-ready follow-up copy.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /\{action\.label\}/u,
  'AgentSessionV2 should not contain the old literal action.label placeholder.',
);

const reason = createAgentApprovalReadyFollowUpReason({
  actionLabel: 'Run approved plan',
});

assert.equal(reason.includes('Run approved plan'), true);
assert.match(reason, /approvalReadyFollowUpPolicy=This signal is evidence-driven/u);
assert.doesNotMatch(reason, /\{action\.label\}/u);
assert.doesNotMatch(
  reason,
  /observe_windows_and_apps\s*->\s*organize_desktop_icons\s*->\s*execute/iu,
  'Approval-ready follow-up signal should not encode a fixed recovery chain.',
);

const fallbackReason = createAgentApprovalReadyFollowUpReason({
  actionLabel: '   ',
});
assert.match(fallbackReason, /approvalReadyFollowUpPolicy=This signal is evidence-driven/u);
assert.match(fallbackReason, /pending action/u);
assert.doesNotMatch(fallbackReason, /[鍙瑙傚療]/u);

console.log('agent session v2 approval-ready follow-up signal smoke ok');
