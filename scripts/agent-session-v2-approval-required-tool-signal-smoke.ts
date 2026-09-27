import assert from 'node:assert/strict';
import {
  createAgentApprovalRequiredToolReason,
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
  /export function createAgentApprovalRequiredToolReason/u,
  'Approval-required tool reason should be Runtime-owned.',
);
assertSourceMatches(
  sessionSource,
  /from '\.\/runtime\/agentApprovalReasonSignals'/u,
  'AgentSessionV2 should consume Runtime-owned approval reason signals.',
);
assertSourceMatches(
  sessionSource,
  /createAgentApprovalRequiredToolReason\(\{/u,
  'AgentSessionV2 should delegate approval-required reason selection to the signal module.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /This step needs user approval before it can run/u,
  'AgentSessionV2 should not own the approval-required fallback copy.',
);
assertSourceDoesNotMatch(
  runtimeSignalSource,
  /buildAgentPermissionRoute|AGENT_SESSION_V2_PRIMARY_TOOL_NAMES/u,
  'Approval-required reason signal should not own permission routing or tool registry policy.',
);

assert.equal(
  createAgentApprovalRequiredToolReason({
    decisionReason: 'Model chose this reversible action.',
    permissionSummary: 'Requires user approval.',
  }),
  'Model chose this reversible action.',
);
assert.equal(
  createAgentApprovalRequiredToolReason({
    decisionReason: '   ',
    permissionSummary: 'Requires user approval.',
  }),
  'Requires user approval.',
);
assert.equal(
  createAgentApprovalRequiredToolReason({
    decisionReason: null,
    permissionSummary: null,
  }),
  'This step needs user approval before it can run.',
);

const reason = createAgentApprovalRequiredToolReason({
  decisionReason: 'Click the located button after approval.',
});
assert.doesNotMatch(
  reason,
  /observe_windows_and_apps\s*->\s*execute_desktop_action\s*->\s*verify/iu,
  'Approval-required reason signal should not encode a fixed tool chain.',
);

console.log('agent session v2 approval-required tool signal smoke ok');
