import assert from 'node:assert/strict';
import { createAgentGuardedTraceStuckSignalText } from '../src/agent/legacy/index.ts';
import { createAgentGuardedTraceStuckSignalText } from '../src/agent/runtime/agentTraceStuckSignalGuard.ts';

const guardedSignal = createAgentGuardedTraceStuckSignalText([
  'reason=recent_action_evidence_not_completed',
  'actionOutcome=no-op',
  'requiredReplan=Fill the evidence gap.',
  'reason=repeated_incomplete_action_primitive',
  'repeatCount=2',
  'reason=repeated_action_outcome_window',
  'windowSize=2',
  'repeatCount=2',
  'reason=repeated_failed_tool_signature',
  'tool=locate_screen_elements',
  'reason=recent_trace_rejection',
  'status=invalid-tool-input',
  'reason=permission_route_blocked',
  'summary=Permission policy blocked the action.',
  'reason=tool_started_without_recent_finish',
  'tool=execute_desktop_input',
]);
const runtimeGuardedSignal = createAgentGuardedTraceStuckSignalText([
  'reason=recent_action_evidence_not_completed',
  'actionOutcome=no-op',
  'requiredReplan=Fill the evidence gap.',
  'reason=repeated_incomplete_action_primitive',
  'repeatCount=2',
  'reason=repeated_action_outcome_window',
  'windowSize=2',
  'repeatCount=2',
  'reason=repeated_failed_tool_signature',
  'tool=locate_screen_elements',
  'reason=recent_trace_rejection',
  'status=invalid-tool-input',
  'reason=permission_route_blocked',
  'summary=Permission policy blocked the action.',
  'reason=tool_started_without_recent_finish',
  'tool=execute_desktop_input',
]);
assert.equal(runtimeGuardedSignal, guardedSignal);

assert.match(guardedSignal, /stuckSignalPrimaryReason=permission_route_blocked/u);
assert.match(guardedSignal, /stuckSignalSeverity=critical/u);
assert.match(guardedSignal, /stuckSignalConfidence=0\.95/u);
assert.match(guardedSignal, /stuckSignalThresholdGuard=maxSignals=5; totalSignals=7; shownSignals=5/u);
assert.match(guardedSignal, /stuckSignalVisibleReasons=recent_action_evidence_not_completed,repeated_incomplete_action_primitive,repeated_action_outcome_window,repeated_failed_tool_signature,permission_route_blocked/u);
assert.match(guardedSignal, /stuckSignalSuppressedReasons=recent_trace_rejection,tool_started_without_recent_finish/u);
assert.match(guardedSignal, /reason=recent_action_evidence_not_completed/u);
assert.match(guardedSignal, /reason=permission_route_blocked/u);
assert.doesNotMatch(guardedSignal, /status=invalid-tool-input/u);
assert.doesNotMatch(guardedSignal, /reason=tool_started_without_recent_finish/u);
assert.match(guardedSignal, /stuckSignalPolicy=This signal is advisory/u);

const singleLowSignal = createAgentGuardedTraceStuckSignalText([
  'reason=tool_started_without_recent_finish',
  'tool=execute_desktop_input',
]);

assert.match(singleLowSignal, /stuckSignalPrimaryReason=tool_started_without_recent_finish/u);
assert.match(singleLowSignal, /stuckSignalSeverity=low/u);
assert.match(singleLowSignal, /reason=tool_started_without_recent_finish/u);
assert.doesNotMatch(singleLowSignal, /stuckSignalSuppressedReasons/u);

console.log('agent session v2 trace stuck signal guard smoke ok');
