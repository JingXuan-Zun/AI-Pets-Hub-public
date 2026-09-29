import assert from 'node:assert/strict';
import {
  extractAgentSessionV3RuntimeRunnerDerivedStopMetadata,
  getAgentSessionV3RuntimeRunnerDerivedStopMetadataFields,
  runAgentSessionV3PilotRunner,
  type AgentSessionV3RuntimeRunnerDerivedStopMetadata,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

function assertMetadataFields(metadata: AgentSessionV3RuntimeRunnerDerivedStopMetadata) {
  assert.deepEqual(
    Object.keys(metadata).sort(),
    [...getAgentSessionV3RuntimeRunnerDerivedStopMetadataFields(metadata.reason)].sort(),
  );
}

function assertNoAdapterOrControllerFields(metadata: AgentSessionV3RuntimeRunnerDerivedStopMetadata) {
  const serializedMetadata = JSON.stringify(metadata);
  assert.doesNotMatch(
    serializedMetadata,
    /adapterSource|blockerSource|budgetOwner|errorClass|failureOrigin|invalidTransitionKind|modelBudgetState|pauseReason|recoverability|resumeTriggerOwner|retrySafety|retryability|sideEffectCommitted|taskProgress|terminalStatusCandidate|toolBudgetState|userActionRequired|userVisibleFailureReason|waitBudget|waitSource/u,
    'Runner-derived metadata should not include adapter, phase-port, or controller-owned fields.',
  );
}

const {
  extractionSmokeSource,
  boundarySource,
  indexSource,
  preflightAuditText,
  statusText,
} = readProjectSources({
  extractionSmokeSource: 'scripts/agent-session-v3-runtime-boundary-runner-derived-stop-metadata-extraction-audit-smoke.ts',
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  indexSource: 'src/agent/legacy/index.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

assert.match(boundarySource, /export function extractAgentSessionV3RuntimeRunnerDerivedStopMetadata/u);
assert.match(indexSource, /export \* from '\.\.\/agentSessionV3RuntimeBoundary'/u);
const localProjectionFunctionSignature = [
  'function',
  'extractRunnerDerivedMetadata',
].join(' ');
assert.equal(
  extractionSmokeSource.includes(localProjectionFunctionSignature),
  false,
  'Extraction audit should use the exported helper instead of keeping a local projection copy.',
);

const invalidTransitionResult = await runAgentSessionV3PilotRunner({
  driver: () => ({
    reason: 'extraction audit rejected event',
    type: 'model-output-invalid',
  }),
});
assert.equal(invalidTransitionResult.status, 'invalid-transition');
assert.equal(invalidTransitionResult.state.phase, 'init');
assert.equal(invalidTransitionResult.transition?.accepted, false);
assert.equal(invalidTransitionResult.transition?.from, 'init');
assert.equal(invalidTransitionResult.transition?.event.type, 'model-output-invalid');

const invalidTransitionMetadata = extractAgentSessionV3RuntimeRunnerDerivedStopMetadata(invalidTransitionResult);
assert.ok(invalidTransitionMetadata);
assert.deepEqual(invalidTransitionMetadata, {
  eventType: 'model-output-invalid',
  phase: 'init',
  reason: 'invalid-transition',
});
assertMetadataFields(invalidTransitionMetadata);
assertNoAdapterOrControllerFields(invalidTransitionMetadata);

const recoveryLimitEvents = [
  { type: 'start' },
  {
    route: 'prepare-command',
    type: 'model-decision-accepted',
  },
  {
    route: 'execute',
    type: 'command-prepared',
  },
  {
    ok: false,
    type: 'transaction-finished',
  },
  {
    reason: 'audit needs recovery before budget stops',
    type: 'evaluation-needs-recovery',
  },
] as const;
const transitionLimitResult = await runAgentSessionV3PilotRunner({
  driver: ({ transitionCount }) => recoveryLimitEvents[transitionCount] ?? null,
  maxTransitions: recoveryLimitEvents.length,
});
assert.equal(transitionLimitResult.status, 'transition-limit');
assert.equal(transitionLimitResult.state.phase, 'recover');
assert.equal(transitionLimitResult.state.recoveryCount, 1);
assert.equal(transitionLimitResult.transitions.length, recoveryLimitEvents.length);

const transitionBudgetMetadata = extractAgentSessionV3RuntimeRunnerDerivedStopMetadata(transitionLimitResult);
assert.ok(transitionBudgetMetadata);
assert.deepEqual(transitionBudgetMetadata, {
  reason: 'transition-budget-exhausted',
  recoveryCount: 1,
  transitionCount: recoveryLimitEvents.length,
});
assertMetadataFields(transitionBudgetMetadata);
assertNoAdapterOrControllerFields(transitionBudgetMetadata);

const terminalResult = await runAgentSessionV3PilotRunner({
  driver: ({ transitionCount }) => [
    { type: 'start' },
    {
      route: 'terminal',
      terminalStatus: 'completed',
      type: 'model-decision-accepted',
    },
  ][transitionCount] ?? null,
});
assert.equal(terminalResult.status, 'terminal');
assert.equal(extractAgentSessionV3RuntimeRunnerDerivedStopMetadata(terminalResult), null);

const waitingResult = await runAgentSessionV3PilotRunner({
  driver: () => null,
});
assert.equal(waitingResult.status, 'waiting-for-event');
assert.equal(extractAgentSessionV3RuntimeRunnerDerivedStopMetadata(waitingResult), null);

const driverFailedResult = await runAgentSessionV3PilotRunner({
  driver: () => {
    throw new Error('runner-derived extraction audit driver failed');
  },
});
assert.equal(driverFailedResult.status, 'driver-failed');
assert.equal(extractAgentSessionV3RuntimeRunnerDerivedStopMetadata(driverFailedResult), null);

assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Runner-derived metadata extraction audit must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  extractionSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Runner-derived metadata extraction audit should not call production v2 modules.',
);

const serializedExtractedMetadata = JSON.stringify([
  invalidTransitionMetadata,
  transitionBudgetMetadata,
]);
assert.doesNotMatch(
  serializedExtractedMetadata,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Runner-derived metadata extraction audit should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedExtractedMetadata,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain|nextTool|nextArgs/iu,
  'Runner-derived metadata extraction audit should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedExtractedMetadata,
  /productionReady":true|runtimeAuthority|experimental-adapter/u,
  'Runner-derived metadata extraction audit should not grant runtime authority.',
);

assert.match(preflightAuditText, /Runner-Derived Stop Metadata Extraction Helper Contract Status/u);
assert.match(
  preflightAuditText,
  /agent-session-v3-runtime-boundary-runner-derived-stop-metadata-extraction-audit-smoke\.ts/u,
);
assert.match(preflightAuditText, /invalid-transition/u);
assert.match(preflightAuditText, /transition-limit/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary runner-derived stop-metadata extraction helper.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-runner-derived-stop-metadata-extraction-audit-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary runner-derived stop metadata extraction audit smoke ok');
