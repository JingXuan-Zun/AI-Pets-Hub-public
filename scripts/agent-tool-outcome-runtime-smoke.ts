import assert from 'node:assert/strict';

import {
  buildAgentPermissionRoute,
  runAgentToolOutcomeContinuation,
  transitionAgentToolOutcome,
  type AgentActionRuntimeDecision,
  type AgentChatCommand,
  type AgentRuntimePendingApproval,
  type AgentRuntimeToolResultEntry,
} from '../src/agent/index.ts';

const actionDecision: AgentActionRuntimeDecision = {
  postActionState: '',
  reason: 'insufficient-evidence',
  status: 'uncertain',
  terminalEvaluation: null,
};
const noRecovery = { action: 'no-recovery', reason: 'no-recovery-signal' } as const;

function createEntry(readiness?: 'ready' | 'needs-primary-action'): AgentRuntimeToolResultEntry {
  return {
    command: {
      capabilityId: 'desktop-observation',
      instruction: 'Inspect the current target',
      kind: 'tool-call',
      sourceText: '/agent inspect the current target',
      toolCall: {
        goal: 'Inspect the current target',
        input: { action: 'inspect_window_ui' },
        name: 'execute_desktop_observation',
      },
    },
    result: {
      ok: true,
      responseText: 'Current target evidence collected.',
      stateSummary: {
        structuredEvidence: readiness ? { visualActionReadiness: readiness } : {},
      },
    },
  };
}

function createApproval(label: string): AgentRuntimePendingApproval {
  const command: AgentChatCommand = {
    capabilityId: 'desktop-input',
    instruction: label,
    kind: 'tool-call',
    sourceText: `/agent ${label}`,
    toolCall: {
      goal: label,
      input: { action: 'click', x: 300, y: 200 },
      name: 'execute_desktop_input',
    },
  };
  const route = buildAgentPermissionRoute(command);
  assert.ok(route.plan);
  return {
    command,
    plan: route.plan,
    reason: label,
    routeSummary: route.summary,
  };
}

const visualApproval = createApproval('Approve visual action');
const approvalReadyApproval = createApproval('Approve follow-up action');

const terminal = transitionAgentToolOutcome({
  actionDecision: {
    ...actionDecision,
    reason: 'terminal-completed',
    status: 'completed',
    terminalEvaluation: {
      finalAnswer: 'Task complete.',
      kind: 'launched',
      postActionState: 'launched',
      status: 'completed',
      stepAction: 'final_answer',
      stepReason: 'Evidence Engine authorized completion.',
    },
  },
  approvalReadyApproval,
  latestEntry: createEntry('ready'),
  recoveryDecision: noRecovery,
  recoveryEnabled: true,
  refinementAvailable: true,
  visualApproval,
});
assert.equal(terminal.kind, 'terminal');

const readOnlyTerminal = transitionAgentToolOutcome({
  actionDecision: {
    ...actionDecision,
    reason: 'terminal-completed',
    status: 'completed',
    terminalEvaluation: null,
  },
  approvalReadyApproval: null,
  latestEntry: createEntry(),
  recoveryDecision: noRecovery,
  recoveryEnabled: true,
  refinementAvailable: false,
  visualApproval: null,
});
assert.equal(
  readOnlyTerminal.kind,
  'terminal',
  'a completed read-only ActionRuntime decision must terminate without another model turn',
);

const readyVisualApproval = transitionAgentToolOutcome({
  actionDecision,
  approvalReadyApproval,
  latestEntry: createEntry('ready'),
  recoveryDecision: noRecovery,
  recoveryEnabled: true,
  refinementAvailable: true,
  visualApproval,
});
assert.equal(readyVisualApproval.kind, 'approval');
assert.equal(readyVisualApproval.approvalSource, 'visual-action');

const boundedRefinement = transitionAgentToolOutcome({
  actionDecision,
  approvalReadyApproval: null,
  latestEntry: createEntry('needs-primary-action'),
  recoveryDecision: { action: 'automatic-observation', reason: 'insufficient-evidence' },
  recoveryEnabled: true,
  refinementAvailable: true,
  visualApproval,
});
assert.equal(boundedRefinement.kind, 'refine');

const explicitRecoveryEntry = createEntry('needs-primary-action');
explicitRecoveryEntry.result.stateSummary = {
  structuredEvidence: {
    postActionRecovery: {
      nextArgs: { action: 'describe_elements' },
      nextTool: 'locate_screen_elements',
      reason: 'UI Automation failed before controls could be inspected.',
      strategy: 're-locate-target',
    },
    visualActionReadiness: 'needs-primary-action',
  },
};
const explicitRecoveryBeforeRefinement = transitionAgentToolOutcome({
  actionDecision,
  approvalReadyApproval: null,
  latestEntry: explicitRecoveryEntry,
  recoveryDecision: { action: 'failed-action', reason: 'action-failed' },
  recoveryEnabled: true,
  refinementAvailable: true,
  visualApproval: null,
});
assert.equal(explicitRecoveryBeforeRefinement.kind, 'recovery');
assert.equal(explicitRecoveryBeforeRefinement.recoveryMode, 'automatic-observation');

const preDispatchObservation = createEntry('needs-primary-action');
preDispatchObservation.result.stateSummary = explicitRecoveryEntry.result.stateSummary;
const preDispatchPlanning = transitionAgentToolOutcome({
  actionDecision: {
    ...actionDecision,
    actionAttempted: false,
    reason: 'missing-requested-coverage',
  },
  approvalReadyApproval: null,
  latestEntry: preDispatchObservation,
  recoveryDecision: { action: 'no-recovery', reason: 'no-recovery-signal' },
  recoveryEnabled: true,
  refinementAvailable: false,
  visualApproval: null,
});
assert.equal(
  preDispatchPlanning.kind,
  'planning',
  'read-only evidence collected before the requested action must return to planning, not recovery',
);

const parallelApprovalReady = transitionAgentToolOutcome({
  actionDecision,
  approvalReadyApproval,
  latestEntry: createEntry(),
  recoveryDecision: { action: 'automatic-observation', reason: 'insufficient-evidence' },
  recoveryEnabled: false,
  refinementAvailable: true,
  visualApproval: null,
});
assert.equal(parallelApprovalReady.kind, 'approval');
assert.equal(parallelApprovalReady.approvalSource, 'approval-ready');

const singleApprovalReadyBeforeRefinement = transitionAgentToolOutcome({
  actionDecision,
  approvalReadyApproval,
  latestEntry: createEntry(),
  recoveryDecision: { action: 'automatic-observation', reason: 'insufficient-evidence' },
  recoveryEnabled: true,
  refinementAvailable: true,
  visualApproval: null,
});
assert.equal(singleApprovalReadyBeforeRefinement.kind, 'approval');
assert.equal(singleApprovalReadyBeforeRefinement.approvalSource, 'approval-ready');

const recovery = transitionAgentToolOutcome({
  actionDecision,
  approvalReadyApproval: null,
  latestEntry: createEntry(),
  recoveryDecision: { action: 'failed-action', reason: 'action-failed' },
  recoveryEnabled: true,
  refinementAvailable: false,
  visualApproval: null,
});
assert.equal(recovery.kind, 'recovery');
assert.equal(recovery.recoveryMode, 'failed-action');

const planning = transitionAgentToolOutcome({
  actionDecision,
  approvalReadyApproval: null,
  latestEntry: createEntry(),
  recoveryDecision: { action: 'automatic-observation', reason: 'insufficient-evidence' },
  recoveryEnabled: false,
  refinementAvailable: false,
  visualApproval: null,
});
assert.equal(planning.kind, 'planning');

const continuationAdapterCalls: string[] = [];
const createContinuationAdapter = (kind: string, finalResult: string | null = null) => async () => {
  continuationAdapterCalls.push(kind);
  return { executed: true, finalResult };
};
const toolContinuation = await runAgentToolOutcomeContinuation({
  actionDecision,
  adapters: {
    approval: createContinuationAdapter('approval'),
    planning: createContinuationAdapter('planning'),
    recovery: createContinuationAdapter('recovery', 'recovery-ran'),
    refine: createContinuationAdapter('refine'),
    targetResolution: createContinuationAdapter('targetResolution'),
    terminal: createContinuationAdapter('terminal'),
    verification: createContinuationAdapter('verification'),
  },
  approvalReadyApproval: null,
  latestEntry: createEntry(),
  recoveryDecision: { action: 'failed-action', reason: 'action-failed' },
  recoveryEnabled: true,
  refinementAvailable: false,
  stepIndex: 14,
  visualApproval: null,
});
assert.deepEqual(continuationAdapterCalls, ['recovery']);
assert.equal(toolContinuation.adapterKind, 'recovery');
assert.equal(toolContinuation.transition.kind, 'recovery');
assert.equal(toolContinuation.transition.recoveryMode, 'failed-action');
assert.equal(toolContinuation.finalResult, 'recovery-ran');
assert.equal(toolContinuation.loopDecision.action, 'return-final');

console.log('agent tool outcome runtime smoke ok');
