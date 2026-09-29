import assert from 'node:assert/strict';
import { type AgentSessionV3RuntimeBoundaryStopReason } from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type ProductionStopPolicyGapStatus =
  | 'needs-controller-policy'
  | 'needs-evidence'
  | 'needs-terminal-mapping';

interface ProductionStopPolicyGap {
  currentConstraint: string;
  missingEvidence: string[];
  missingPolicyDecision: string;
  productionControllerReady: false;
  reason: AgentSessionV3RuntimeBoundaryStopReason;
  status: ProductionStopPolicyGapStatus;
}

const productionStopPolicyGaps = [
  {
    currentConstraint: 'Generic waiting is distinct from the known needs-approval wait shape.',
    missingEvidence: [
      'wait source classification',
      'resume trigger owner',
      'maximum wait or poll budget',
      'user-visible pause reason',
    ],
    missingPolicyDecision: 'Whether the future controller should pause, poll, request user input, or fail.',
    productionControllerReady: false,
    reason: 'waiting-for-phase-event',
    status: 'needs-controller-policy',
  },
  {
    currentConstraint: 'Blocked has no distinct pilot runner status or AgentSessionV2 final status yet.',
    missingEvidence: [
      'blocker source classification',
      'recoverability signal',
      'user action required signal',
      'terminal status mapping',
    ],
    missingPolicyDecision: 'Whether blocked means needs-user, failed, recoverable, or paused.',
    productionControllerReady: false,
    reason: 'blocked-by-phase',
    status: 'needs-terminal-mapping',
  },
  {
    currentConstraint: 'Invalid transition is a pilot state-machine guard, not a v2 production final status.',
    missingEvidence: [
      'invalid phase/event pair',
      'adapter that emitted the event',
      'state corruption versus adapter bug classification',
      'retry safety signal',
    ],
    missingPolicyDecision: 'Whether invalid transition should fail, recover, pause for debugging, or quarantine the adapter.',
    productionControllerReady: false,
    reason: 'invalid-transition',
    status: 'needs-evidence',
  },
  {
    currentConstraint: 'Budget and max-step v2 statuses intentionally have no strict v3 terminal mapping yet.',
    missingEvidence: [
      'budget owner',
      'transition count at stop',
      'model call and tool call budget state',
      'task progress at stop',
      'recovery count at stop',
    ],
    missingPolicyDecision: 'Whether the future controller should report budget-exceeded, max-steps, needs-user, failed, or recoverable.',
    productionControllerReady: false,
    reason: 'transition-budget-exhausted',
    status: 'needs-terminal-mapping',
  },
  {
    currentConstraint: 'Runtime failure combines driver failure, terminal failed, and future adapter failures.',
    missingEvidence: [
      'failure origin classification',
      'retryability signal',
      'side-effect committed signal',
      'user-visible failure reason',
      'error class normalization',
    ],
    missingPolicyDecision: 'Whether runtime failure should map to failed, recoverable, cancelled, or needs-user.',
    productionControllerReady: false,
    reason: 'runtime-failed',
    status: 'needs-evidence',
  },
] as const satisfies readonly ProductionStopPolicyGap[];

const {
  alignmentSmokeSource,
  boundarySource,
  preflightAuditText,
  statusText,
} = readProjectSources({
  alignmentSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-stop-reason-alignment-smoke.ts',
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

assert.match(boundarySource, /export type AgentSessionV3RuntimeBoundaryStopReason/u);
assert.match(alignmentSmokeSource, /StopReasonAlignmentRow/u);
assert.match(alignmentSmokeSource, /missing-production-mapping/u);
assert.match(alignmentSmokeSource, /partial/u);

assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Production stop policy gap audit should not add production v2 runtime, permission, or execution calls.',
);
assert.doesNotMatch(
  boundarySource,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action/u,
  'Production stop policy gap audit should not add concrete desktop tools.',
);

const gapReasons = productionStopPolicyGaps.map((gap) => gap.reason);
assert.deepEqual(gapReasons.sort(), [
  'blocked-by-phase',
  'invalid-transition',
  'runtime-failed',
  'transition-budget-exhausted',
  'waiting-for-phase-event',
].sort());
assert.equal(gapReasons.includes('continue-with-event'), false);
assert.equal(gapReasons.includes('cancelled'), false);

for (const gap of productionStopPolicyGaps) {
  assert.equal(gap.productionControllerReady, false);
  assert.ok(gap.currentConstraint.length > 20);
  assert.ok(gap.missingEvidence.length >= 4);
  assert.ok(gap.missingPolicyDecision.length > 20);
}

const gapByReason = new Map(productionStopPolicyGaps.map((gap) => [gap.reason, gap]));
assert.equal(gapByReason.get('waiting-for-phase-event')?.status, 'needs-controller-policy');
assert.ok(gapByReason.get('waiting-for-phase-event')?.missingEvidence.includes('wait source classification'));
assert.equal(gapByReason.get('blocked-by-phase')?.status, 'needs-terminal-mapping');
assert.ok(gapByReason.get('blocked-by-phase')?.missingEvidence.includes('recoverability signal'));
assert.equal(gapByReason.get('invalid-transition')?.status, 'needs-evidence');
assert.ok(gapByReason.get('invalid-transition')?.missingEvidence.includes('invalid phase/event pair'));
assert.equal(gapByReason.get('transition-budget-exhausted')?.status, 'needs-terminal-mapping');
assert.ok(gapByReason.get('transition-budget-exhausted')?.missingEvidence.includes('budget owner'));
assert.equal(gapByReason.get('runtime-failed')?.status, 'needs-evidence');
assert.ok(gapByReason.get('runtime-failed')?.missingEvidence.includes('failure origin classification'));

const serializedGapTable = JSON.stringify(productionStopPolicyGaps);
assert.doesNotMatch(
  serializedGapTable,
  /execute_desktop|observe_windows_and_apps|locate_screen_elements|open_app|click|type|hotkey/iu,
  'Production stop policy gaps should not prescribe concrete tools.',
);
assert.doesNotMatch(
  serializedGapTable,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Production stop policy gaps should not define fixed workflows or fallback chains.',
);

assert.match(preflightAuditText, /Production Stop Policy Gap Audit Status/u);
assert.match(preflightAuditText, /agent-session-v3-runtime-boundary-production-stop-policy-gap-smoke\.ts/u);
assert.match(preflightAuditText, /waiting-for-phase-event/u);
assert.match(preflightAuditText, /blocked-by-phase/u);
assert.match(preflightAuditText, /invalid-transition/u);
assert.match(preflightAuditText, /transition-budget-exhausted/u);
assert.match(preflightAuditText, /runtime-failed/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(preflightAuditText, /not a controller policy/u);
assert.match(statusText, /V3 runtime boundary production-stop-policy gap audit.*Completed/u);
assert.match(statusText, /agent-session-v3-runtime-boundary-production-stop-policy-gap-smoke\.ts/u);

console.log('agent session v3 runtime boundary production stop policy gap smoke ok');
