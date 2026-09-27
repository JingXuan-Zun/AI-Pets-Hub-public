import assert from 'node:assert/strict';
import {
  createAgentAutoRecoveryResultMessage,
  createAgentAutoRecoveryRunningMessage,
  createAgentAutoRecoveryStepReason,
  createAgentAutoRecoveryStepSummary,
  createAgentFailedActionRecoveryResultMessage,
  createAgentFailedActionRecoveryRunningMessage,
  createAgentFailedActionRecoveryStepReason,
  createAgentFailedActionRecoveryStepSummary,
  createAgentPostApprovalVerificationResultMessage,
  createAgentPostApprovalVerificationRunningMessage,
  createAgentPostApprovalVerificationStepReason,
  createAgentPostApprovalVerificationStepSummary,
} from '../src/agent/legacy/index.ts';
import {
  assertSourceDoesNotMatch,
  assertSourceMatches,
  readProjectSources,
} from './smokeTestHarness.ts';

const {
  recoveryExecution: recoveryExecutionSource,
  index: indexSource,
  runtimeSignal: runtimeSignalSource,
  session: sessionSource,
  signal: signalSource,
} = readProjectSources({
  recoveryExecution: 'src/agent/runtime/agentRecoveryExecutionRuntime.ts',
  index: 'src/agent/legacy/index.ts',
  runtimeSignal: 'src/agent/runtime/agentExecutionProgressSignals.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
  signal: 'src/agent/runtime/agentExecutionProgressSignals.ts',
});

assertSourceMatches(
  runtimeSignalSource,
  /export function createAgentAutoRecoveryStepReason/u,
  'Runtime should own auto-recovery reason builders.',
);
assertSourceMatches(
  runtimeSignalSource,
  /export function createAgentPostApprovalVerificationStepReason/u,
  'Runtime should own post-approval verification reason builders.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /from '\.\/agentSessionV2RecoveryStepReasonSignal'/u,
  'AgentSessionV2 should consume Runtime recovery progress instead of a V2 presentation signal.',
);
assertSourceMatches(
  recoveryExecutionSource,
  /from '\.\/agentExecutionProgressSignals'/u,
  'Recovery Execution Runtime should consume shared Runtime progress signals.',
);
assertSourceDoesNotMatch(
  runtimeSignalSource,
  /buildAgentPermissionRoute|createAgentSessionV2AutoRecoveryObservationCommand|createAgentSessionV2PostApprovalVerificationCommand|executeAgentSessionV2ToolCommandWithCache|timingTracker/u,
  'Recovery step reason signal should not own permission routing, command creation, execution, or timing policy.',
);
assertSourceDoesNotMatch(
  runtimeSignalSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'Recovery step reason signal should not encode a fixed recovery chain.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /reason: 'Automatically following safe read-only post-action recovery evidence\.'/u,
  'AgentSessionV2 should not inline the auto-recovery step reason template.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /summary: 'Post-approval verification: inspect current UI state\.'/u,
  'AgentSessionV2 should not inline the post-approval verification step summary template.',
);

assert.equal(
  createAgentFailedActionRecoveryStepReason(),
  'Automatically reading current UI/window evidence after a failed desktop action.',
);
assert.equal(
  createAgentFailedActionRecoveryStepSummary(),
  'Failed action recovery: inspect current desktop state.',
);
assert.equal(
  createAgentFailedActionRecoveryRunningMessage(),
  'Agent is reading the current UI state after a failed desktop action.',
);
assert.equal(
  createAgentFailedActionRecoveryResultMessage({ ok: true }),
  'Agent read the current UI state after the failed action.',
);
assert.equal(
  createAgentFailedActionRecoveryResultMessage({ ok: false }),
  'Agent received a failed failed-action recovery result.',
);

assert.equal(
  createAgentAutoRecoveryStepReason(),
  'Automatically following safe read-only post-action recovery evidence.',
);
assert.equal(
  createAgentAutoRecoveryStepSummary(),
  'Auto recovery: observe post-action UI state.',
);
assert.equal(
  createAgentAutoRecoveryRunningMessage({
    isWaitAndObserve: true,
    recoveryAttemptText: ' (1/2)',
  }),
  'Agent is waiting and refreshing observation before deciding the next step (1/2).',
);
assert.equal(
  createAgentAutoRecoveryRunningMessage({ isWaitAndObserve: false }),
  'Agent is reading the visible post-action state before deciding the next step.',
);
assert.equal(
  createAgentAutoRecoveryResultMessage({ ok: false }),
  'Agent received a failed post-action recovery observation.',
);

assert.equal(
  createAgentPostApprovalVerificationStepReason(),
  'Automatically verifying the approved desktop action outcome with read-only visual evidence.',
);
assert.equal(
  createAgentPostApprovalVerificationStepSummary(),
  'Post-approval verification: inspect current UI state.',
);
assert.equal(
  createAgentPostApprovalVerificationRunningMessage(),
  'Agent is verifying the approved desktop action outcome.',
);
assert.equal(
  createAgentPostApprovalVerificationResultMessage({ ok: true }),
  'Agent verified the approved desktop action outcome.',
);

console.log('agent session v2 recovery step reason signal smoke ok');
