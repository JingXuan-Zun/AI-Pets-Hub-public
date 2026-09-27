import assert from 'node:assert/strict';
import {
  createAgentSessionV3RuntimeBoundaryContract,
  createAgentSessionV3RuntimePhasePortContext,
  getAgentSessionV3RuntimePhaseSideEffectLimit,
  runAgentSessionV3PilotHarness,
  type AgentSessionV3PilotEvent,
  type AgentSessionV3PilotHarnessPorts,
  type AgentSessionV3PilotRunnerContext,
  type AgentSessionV3RuntimeBoundaryPorts,
  type AgentSessionV3RuntimeDrivenPhase,
  type AgentSessionV3RuntimePhasePort,
  type AgentSessionV3RuntimePhasePortContext,
  type AgentSessionV3RuntimePhasePortResult,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const drivenPhases = [
  'init',
  'model_decision',
  'prepare_command',
  'needs_approval',
  'execute_transaction',
  'evaluate',
  'recover',
] as const satisfies readonly AgentSessionV3RuntimeDrivenPhase[];

const harnessPortToRuntimePhase = {
  approval: 'needs_approval',
  evaluate: 'evaluate',
  executeTransaction: 'execute_transaction',
  init: 'init',
  modelDecision: 'model_decision',
  prepareCommand: 'prepare_command',
  recover: 'recover',
} as const satisfies Record<keyof AgentSessionV3PilotHarnessPorts, AgentSessionV3RuntimeDrivenPhase>;

type HarnessPilotEventResult = {
  event: AgentSessionV3PilotEvent;
  kind: 'pilot-event';
};

function toHarnessPilotEventResult(
  result: AgentSessionV3RuntimePhasePortResult,
): HarnessPilotEventResult | null {
  if (result.kind !== 'event') {
    return null;
  }

  return {
    event: result.event,
    kind: 'pilot-event',
  };
}

async function invokeBoundaryPhasePort<Phase extends AgentSessionV3RuntimeDrivenPhase>(
  boundaryPorts: AgentSessionV3RuntimeBoundaryPorts,
  phase: Phase,
  runnerContext: AgentSessionV3PilotRunnerContext,
): Promise<HarnessPilotEventResult | null> {
  const port = boundaryPorts[phase] as AgentSessionV3RuntimePhasePort<Phase> | undefined;
  if (!port) {
    return null;
  }

  const boundaryContext = createAgentSessionV3RuntimePhasePortContext({
    boundaryMode: 'contract-only',
    phase,
    state: runnerContext.state,
    transitionCount: runnerContext.transitionCount,
    transitions: runnerContext.transitions,
  });

  return toHarnessPilotEventResult(await port(boundaryContext));
}

function createSmokeOnlyBoundaryBackedHarnessPorts(
  boundaryPorts: AgentSessionV3RuntimeBoundaryPorts,
): AgentSessionV3PilotHarnessPorts {
  return {
    approval: (context) => invokeBoundaryPhasePort(boundaryPorts, harnessPortToRuntimePhase.approval, context),
    evaluate: (context) => invokeBoundaryPhasePort(boundaryPorts, harnessPortToRuntimePhase.evaluate, context),
    executeTransaction: (context) => invokeBoundaryPhasePort(
      boundaryPorts,
      harnessPortToRuntimePhase.executeTransaction,
      context,
    ),
    init: (context) => invokeBoundaryPhasePort(boundaryPorts, harnessPortToRuntimePhase.init, context),
    modelDecision: (context) => invokeBoundaryPhasePort(
      boundaryPorts,
      harnessPortToRuntimePhase.modelDecision,
      context,
    ),
    prepareCommand: (context) => invokeBoundaryPhasePort(
      boundaryPorts,
      harnessPortToRuntimePhase.prepareCommand,
      context,
    ),
    recover: (context) => invokeBoundaryPhasePort(boundaryPorts, harnessPortToRuntimePhase.recover, context),
  };
}

function recordBoundaryContext(
  observed: AgentSessionV3RuntimeDrivenPhase[],
  context: AgentSessionV3RuntimePhasePortContext,
) {
  assert.equal(context.boundaryMode, 'contract-only');
  assert.equal(context.sideEffectLimit.phase, context.phase);
  assert.deepEqual(context.sideEffectLimit, getAgentSessionV3RuntimePhaseSideEffectLimit(context.phase));
  observed.push(context.phase);
}

const {
  boundarySource,
  harnessSource,
  preflightAuditText,
  statusText,
} = readProjectSources({
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  harnessSource: 'src/agent/agentSessionV3PilotHarness.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

assert.equal(createAgentSessionV3RuntimeBoundaryContract().productionAuthority, false);
assert.deepEqual(
  [...new Set(Object.values(harnessPortToRuntimePhase))].sort(),
  [...drivenPhases].sort(),
  'Every runtime driven phase should have a harness port projection.',
);

for (const phase of drivenPhases) {
  const sideEffectLimit = getAgentSessionV3RuntimePhaseSideEffectLimit(phase);
  assert.equal(sideEffectLimit.phase, phase);
  assert.ok(sideEffectLimit.forbiddenAuthority.includes('define a required ordered tool workflow'));
}

for (const [phase, portName] of [
  ['evaluate', 'evaluate'],
  ['execute_transaction', 'executeTransaction'],
  ['init', 'init'],
  ['model_decision', 'modelDecision'],
  ['needs_approval', 'approval'],
  ['prepare_command', 'prepareCommand'],
  ['recover', 'recover'],
] as const) {
  assert.match(
    harnessSource,
    new RegExp(`${phase}:\\s*createAgentSessionV3PilotHarnessPhaseHandler\\(\\s*options\\.ports\\.${portName}`, 'u'),
    `Harness phase ${phase} should still map through the explicit ${portName} port.`,
  );
}

for (const concreteTool of [
  'observe_windows_and_apps',
  'locate_screen_elements',
  'execute_desktop_sequence',
  'execute_desktop_input',
  'execute_desktop_action',
]) {
  assert.equal(boundarySource.includes(concreteTool), false);
  assert.equal(harnessSource.includes(concreteTool), false);
}

for (const forbiddenRuntimeCall of [
  'runAgentSessionV2ModelDecisionTurn',
  'runAgentSessionV2ToolExecutionTransaction',
  'buildAgentPermissionRoute',
  'evaluateAgentSessionV2PostActionTerminal',
]) {
  assert.equal(boundarySource.includes(forbiddenRuntimeCall), false);
  assert.equal(harnessSource.includes(forbiddenRuntimeCall), false);
}

const observedPhases: AgentSessionV3RuntimeDrivenPhase[] = [];
let modelDecisionCount = 0;
const boundaryPorts: AgentSessionV3RuntimeBoundaryPorts = {
  evaluate: (context) => {
    recordBoundaryContext(observedPhases, context);
    return {
      event: {
        reason: 'compatibility smoke asks recovery to prove recover can be described',
        type: 'evaluation-needs-recovery',
      },
      kind: 'event',
    };
  },
  execute_transaction: (context) => {
    recordBoundaryContext(observedPhases, context);
    assert.deepEqual(context.sideEffectLimit.allowedScopes, [
      'transaction-execution',
      'trace-recording',
      'progress-emission',
    ]);
    return {
      event: {
        ok: true,
        reason: 'compatibility smoke transaction event',
        type: 'transaction-finished',
      },
      kind: 'event',
    };
  },
  init: (context) => {
    recordBoundaryContext(observedPhases, context);
    return {
      event: {
        reason: 'compatibility smoke start',
        type: 'start',
      },
      kind: 'event',
    };
  },
  model_decision: (context) => {
    recordBoundaryContext(observedPhases, context);
    modelDecisionCount += 1;

    if (modelDecisionCount === 1) {
      return {
        event: {
          reason: 'compatibility smoke prepares a command-shaped event',
          route: 'prepare-command',
          type: 'model-decision-accepted',
        },
        kind: 'event',
      };
    }

    return {
      event: {
        reason: 'compatibility smoke terminal event',
        route: 'terminal',
        terminalStatus: 'completed',
        type: 'model-decision-accepted',
      },
      kind: 'event',
    };
  },
  needs_approval: (context) => {
    recordBoundaryContext(observedPhases, context);
    assert.deepEqual(context.sideEffectLimit.allowedScopes, ['approval-pause', 'trace-recording']);
    return {
      event: {
        reason: 'compatibility smoke approval event',
        type: 'approval-granted',
      },
      kind: 'event',
    };
  },
  prepare_command: (context) => {
    recordBoundaryContext(observedPhases, context);
    assert.deepEqual(context.sideEffectLimit.allowedScopes, [
      'command-preparation',
      'permission-route-consumption',
      'trace-recording',
    ]);
    return {
      event: {
        reason: 'compatibility smoke routes through approval phase',
        route: 'approval',
        type: 'command-prepared',
      },
      kind: 'event',
    };
  },
  recover: (context) => {
    recordBoundaryContext(observedPhases, context);
    assert.deepEqual(context.sideEffectLimit.allowedScopes, ['recovery-planning', 'trace-recording']);
    return {
      event: {
        reason: 'compatibility smoke returns to model decision',
        type: 'recovery-model-requested',
      },
      kind: 'event',
    };
  },
};

const compatibilityResult = await runAgentSessionV3PilotHarness({
  maxTransitions: 12,
  ports: createSmokeOnlyBoundaryBackedHarnessPorts(boundaryPorts),
});
assert.equal(compatibilityResult.status, 'terminal');
assert.equal(compatibilityResult.state.phase, 'done');
assert.equal(compatibilityResult.state.terminal?.status, 'completed');
assert.equal(compatibilityResult.state.recoveryCount, 1);
assert.deepEqual(observedPhases, [
  'init',
  'model_decision',
  'prepare_command',
  'needs_approval',
  'execute_transaction',
  'evaluate',
  'recover',
  'model_decision',
]);

const missingEventResult = await runAgentSessionV3PilotHarness({
  ports: createSmokeOnlyBoundaryBackedHarnessPorts({
    init: () => ({
      event: {
        reason: 'start before waiting',
        type: 'start',
      },
      kind: 'event',
    }),
    model_decision: () => ({
      kind: 'waiting',
      reason: 'boundary waiting result has no production stop-channel yet',
    }),
  }),
});
assert.equal(missingEventResult.status, 'waiting-for-event');
assert.equal(missingEventResult.state.phase, 'model_decision');

const blockedResult = await runAgentSessionV3PilotHarness({
  ports: createSmokeOnlyBoundaryBackedHarnessPorts({
    init: () => ({
      event: {
        reason: 'start before blocked',
        type: 'start',
      },
      kind: 'event',
    }),
    model_decision: () => ({
      kind: 'blocked',
      reason: 'boundary blocked result needs explicit future stop semantics',
    }),
  }),
});
assert.equal(blockedResult.status, 'waiting-for-event');
assert.equal(blockedResult.state.phase, 'model_decision');

assert.match(preflightAuditText, /Runtime Boundary Compatibility Audit Status/u);
assert.match(preflightAuditText, /agent-session-v3-runtime-boundary-harness-compatibility-smoke\.ts/u);
assert.match(preflightAuditText, /event-shaped phase ports/u);
assert.match(preflightAuditText, /`waiting` and `blocked`/u);
assert.match(statusText, /V3 runtime boundary\/harness compatibility audit.*Completed/u);
assert.match(statusText, /agent-session-v3-runtime-boundary-harness-compatibility-smoke\.ts/u);

console.log('agent session v3 runtime boundary harness compatibility smoke ok');
