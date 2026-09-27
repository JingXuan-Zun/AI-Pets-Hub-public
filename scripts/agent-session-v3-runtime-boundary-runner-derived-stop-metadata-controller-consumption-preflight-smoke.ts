import assert from 'node:assert/strict';
import {
  extractAgentSessionV3RuntimeRunnerDerivedStopMetadata,
  getAgentSessionV3RuntimeRunnerDerivedStopMetadataFields,
  runAgentSessionV3PilotRunner,
  type AgentSessionV3RuntimeRunnerDerivedStopMetadata,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type ControllerConsumptionStatus =
  | 'readable-runner-evidence'
  | 'requires-adapter-evidence'
  | 'requires-controller-policy';

type ControllerForbiddenDecision =
  | 'choose-tool'
  | 'decide-recovery'
  | 'execute-tool'
  | 'fail-runtime'
  | 'pause-runtime'
  | 'route-permission';

interface RunnerDerivedControllerConsumptionRow {
  controllerConsumptionStatus: ControllerConsumptionStatus;
  forbiddenDecisions: readonly ControllerForbiddenDecision[];
  missingBeforeDecision: readonly string[];
  readableFields: readonly string[];
  reason: AgentSessionV3RuntimeRunnerDerivedStopMetadata['reason'];
}

const controllerConsumptionAudit = [
  {
    controllerConsumptionStatus: 'readable-runner-evidence',
    forbiddenDecisions: [
      'choose-tool',
      'decide-recovery',
      'execute-tool',
      'fail-runtime',
      'pause-runtime',
      'route-permission',
    ],
    missingBeforeDecision: [
      'adapterSource',
      'invalidTransitionKind',
      'retrySafety',
    ],
    readableFields: ['reason', 'phase', 'eventType'],
    reason: 'invalid-transition',
  },
  {
    controllerConsumptionStatus: 'readable-runner-evidence',
    forbiddenDecisions: [
      'choose-tool',
      'decide-recovery',
      'execute-tool',
      'fail-runtime',
      'pause-runtime',
      'route-permission',
    ],
    missingBeforeDecision: [
      'budgetOwner',
      'modelBudgetState',
      'toolBudgetState',
      'taskProgress',
    ],
    readableFields: ['reason', 'transitionCount', 'recoveryCount'],
    reason: 'transition-budget-exhausted',
  },
] as const satisfies readonly RunnerDerivedControllerConsumptionRow[];

function assertMetadataMatchesControllerReadableFields(
  metadata: AgentSessionV3RuntimeRunnerDerivedStopMetadata,
) {
  const row = controllerConsumptionAudit.find((candidate) => candidate.reason === metadata.reason);
  assert.ok(row, `${metadata.reason} should have a controller-consumption audit row.`);
  assert.deepEqual(Object.keys(metadata).sort(), [...row.readableFields].sort());
  assert.deepEqual(
    [...row.readableFields].sort(),
    [...getAgentSessionV3RuntimeRunnerDerivedStopMetadataFields(metadata.reason)].sort(),
  );
}

const {
  boundarySource,
  controllerConsumptionSmokeSource,
  extractionSmokeSource,
  productionStopPolicyGapSmokeSource,
  preflightAuditText,
  statusText,
} = readProjectSources({
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  controllerConsumptionSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-runner-derived-stop-metadata-controller-consumption-preflight-smoke.ts',
  extractionSmokeSource: 'scripts/agent-session-v3-runtime-boundary-runner-derived-stop-metadata-extraction-audit-smoke.ts',
  productionStopPolicyGapSmokeSource: 'scripts/agent-session-v3-runtime-boundary-production-stop-policy-gap-smoke.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

assert.match(boundarySource, /export function extractAgentSessionV3RuntimeRunnerDerivedStopMetadata/u);
assert.match(extractionSmokeSource, /Runner-Derived Stop Metadata Extraction Helper Contract Status/u);
assert.match(productionStopPolicyGapSmokeSource, /missingPolicyDecision/u);

const invalidTransitionResult = await runAgentSessionV3PilotRunner({
  driver: () => ({
    reason: 'controller consumption preflight rejected event',
    type: 'model-output-invalid',
  }),
});
const invalidTransitionMetadata = extractAgentSessionV3RuntimeRunnerDerivedStopMetadata(invalidTransitionResult);
assert.ok(invalidTransitionMetadata);
assert.deepEqual(invalidTransitionMetadata, {
  eventType: 'model-output-invalid',
  phase: 'init',
  reason: 'invalid-transition',
});
assertMetadataMatchesControllerReadableFields(invalidTransitionMetadata);

const transitionLimitResult = await runAgentSessionV3PilotRunner({
  driver: ({ state }) => {
    if (state.phase === 'init') {
      return { type: 'start' };
    }

    return {
      route: 'prepare-command',
      type: 'model-decision-accepted',
    };
  },
  maxTransitions: 1,
});
const transitionBudgetMetadata = extractAgentSessionV3RuntimeRunnerDerivedStopMetadata(transitionLimitResult);
assert.ok(transitionBudgetMetadata);
assert.deepEqual(transitionBudgetMetadata, {
  reason: 'transition-budget-exhausted',
  recoveryCount: 0,
  transitionCount: 1,
});
assertMetadataMatchesControllerReadableFields(transitionBudgetMetadata);

assert.deepEqual(
  controllerConsumptionAudit.map((row) => row.reason).sort(),
  ['invalid-transition', 'transition-budget-exhausted'],
);
for (const row of controllerConsumptionAudit) {
  assert.equal(row.controllerConsumptionStatus, 'readable-runner-evidence');
  assert.ok(row.missingBeforeDecision.length >= 3);
  assert.deepEqual(row.forbiddenDecisions, [
    'choose-tool',
    'decide-recovery',
    'execute-tool',
    'fail-runtime',
    'pause-runtime',
    'route-permission',
  ]);
  assert.deepEqual(
    [...row.readableFields].sort(),
    [...getAgentSessionV3RuntimeRunnerDerivedStopMetadataFields(row.reason)].sort(),
  );
}

const serializedConsumptionAudit = JSON.stringify(controllerConsumptionAudit);
assert.doesNotMatch(
  serializedConsumptionAudit,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|terminalStatusCandidate/u,
  'Controller-consumption preflight should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedConsumptionAudit,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Controller-consumption preflight should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedConsumptionAudit,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Controller-consumption preflight should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  JSON.stringify(controllerConsumptionAudit.map((row) => row.readableFields)),
  /adapterSource|budgetOwner|failureOrigin|modelBudgetState|retrySafety|taskProgress|toolBudgetState/u,
  'Readable controller fields should not include adapter or controller-policy fields.',
);

assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Controller-consumption preflight must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  controllerConsumptionSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Controller-consumption preflight should not call production v2 modules.',
);

assert.match(preflightAuditText, /Runner-Derived Stop Metadata Controller-Consumption Preflight Status/u);
assert.match(
  preflightAuditText,
  /agent-session-v3-runtime-boundary-runner-derived-stop-metadata-controller-consumption-preflight-smoke\.ts/u,
);
assert.match(preflightAuditText, /future controller may read/u);
assert.match(preflightAuditText, /must not decide/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary runner-derived stop-metadata controller-consumption preflight.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-runner-derived-stop-metadata-controller-consumption-preflight-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary runner-derived stop metadata controller-consumption preflight smoke ok');
