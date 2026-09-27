import assert from 'node:assert/strict';
import {
  runAgentSessionV3RuntimeController,
  type AgentSessionV3RuntimeBoundaryPorts,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  runtimeControllerSource,
  runtimeBoundarySource,
  indexSource,
} = readProjectSources({
  runtimeControllerSource: 'src/agent/agentSessionV3RuntimeController.ts',
  runtimeBoundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  indexSource: 'src/agent/legacy/index.ts',
});

assert.match(runtimeControllerSource, /export async function runAgentSessionV3RuntimeController/u);
assert.match(runtimeControllerSource, /createAgentSessionV3RuntimePhasePortContext/u);
assert.match(runtimeControllerSource, /getAgentSessionV3RuntimeBoundaryStopSemantic/u);
assert.match(indexSource, /export \* from '\.\.\/agentSessionV3RuntimeController';/u);

const completedPorts = {
  init: () => ({ event: { type: 'start' }, kind: 'event' }),
  model_decision: () => ({
    event: {
      reason: 'runtime controller accepted final answer',
      route: 'terminal',
      terminalStatus: 'completed',
      type: 'model-decision-accepted',
    },
    kind: 'event',
  }),
} as const satisfies AgentSessionV3RuntimeBoundaryPorts;

const completedResult = await runAgentSessionV3RuntimeController({
  ports: completedPorts,
});
assert.equal(completedResult.status, 'terminal');
assert.equal(completedResult.state.phase, 'done');
assert.equal(completedResult.state.terminal?.status, 'completed');
assert.equal(completedResult.boundary.mode, 'experimental-non-production');
assert.equal(completedResult.boundary.authority, 'experimental-adapter');
assert.equal(completedResult.boundary.productionAuthority, false);
assert.deepEqual(
  completedResult.transitions.map((transition) => transition.to),
  ['model_decision', 'done'],
);

let observedBoundaryMode: string | null = null;
let observedAllowedScopes: readonly string[] = [];
const waitingResult = await runAgentSessionV3RuntimeController({
  ports: {
    init: (context) => {
      observedBoundaryMode = context.boundaryMode;
      observedAllowedScopes = context.sideEffectLimit.allowedScopes;
      return {
        kind: 'waiting',
        reason: 'runtime controller waiting smoke',
      };
    },
  },
});
assert.equal(waitingResult.status, 'waiting');
assert.equal(waitingResult.stopReason, 'waiting-for-phase-event');
assert.equal(waitingResult.stopSemantic?.requiresControllerDecision, true);
assert.equal(waitingResult.reason, 'runtime controller waiting smoke');
assert.equal(observedBoundaryMode, 'experimental-non-production');
assert.deepEqual(observedAllowedScopes, ['none', 'trace-recording']);

const blockedResult = await runAgentSessionV3RuntimeController({
  ports: {
    init: () => ({
      kind: 'blocked',
      reason: 'runtime controller blocked smoke',
    }),
  },
});
assert.equal(blockedResult.status, 'blocked');
assert.equal(blockedResult.stopReason, 'blocked-by-phase');
assert.equal(blockedResult.stopSemantic?.requiresControllerDecision, true);
assert.equal(blockedResult.reason, 'runtime controller blocked smoke');

const invalidResult = await runAgentSessionV3RuntimeController({
  ports: {
    init: () => ({
      event: {
        reason: 'invalid event for init',
        type: 'transaction-finished',
      },
      kind: 'event',
    }),
  },
});
assert.equal(invalidResult.status, 'invalid-transition');
assert.equal(invalidResult.stopReason, 'invalid-transition');
assert.equal(invalidResult.stopMetadata?.reason, 'invalid-transition');
assert.equal(invalidResult.stopMetadata?.phase, 'init');
assert.equal(invalidResult.stopMetadata?.eventType, 'transaction-finished');

const transitionLimitResult = await runAgentSessionV3RuntimeController({
  maxTransitions: 1,
  ports: completedPorts,
});
assert.equal(transitionLimitResult.status, 'transition-limit');
assert.equal(transitionLimitResult.stopReason, 'transition-budget-exhausted');
assert.equal(transitionLimitResult.stopMetadata?.reason, 'transition-budget-exhausted');
assert.equal(transitionLimitResult.stopMetadata?.transitionCount, 1);
assert.equal(transitionLimitResult.stopMetadata?.recoveryCount, 0);

const cancelledResult = await runAgentSessionV3RuntimeController({
  isCancellationRequested: () => true,
  ports: completedPorts,
});
assert.equal(cancelledResult.status, 'cancelled');
assert.equal(cancelledResult.stopReason, 'cancelled');
assert.equal(cancelledResult.state.phase, 'done');
assert.equal(cancelledResult.state.terminal?.status, 'cancelled');

const noPortResult = await runAgentSessionV3RuntimeController({
  ports: {},
});
assert.equal(noPortResult.status, 'waiting');
assert.equal(noPortResult.stopReason, 'waiting-for-phase-event');
assert.match(noPortResult.reason ?? '', /No runtime phase port is available for phase init/u);

const guardedRuntimeSource = runtimeControllerSource;
assert.doesNotMatch(
  guardedRuntimeSource,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Runtime controller must not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  guardedRuntimeSource,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|implementationQueue|orderedSteps|requiredReportOrder/u,
  'Runtime controller must not define fixed tool order, tool decisions, or controller queues.',
);
assert.doesNotMatch(
  guardedRuntimeSource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Runtime controller must not call v2 production modules directly.',
);
assert.match(runtimeBoundarySource, /AgentSessionV2 remains the production orchestrator/u);
assert.match(runtimeBoundarySource, /no required ordered tool workflow/u);

console.log('agent session v3 runtime controller smoke ok');
