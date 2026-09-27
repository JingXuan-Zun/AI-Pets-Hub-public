import assert from 'node:assert/strict';
import {
  advanceAgentTaskRuntimeV4,
  createAgentTaskRuntimeV4ApprovalGrant,
  createAgentTaskRuntimeV4Context,
  createAgentTaskRuntimeV4SessionV2Shadow,
  createAgentTaskRuntimeV4TaskSpec,
  getAgentTaskRuntimeV4ApprovalScope,
  hasAgentTaskRuntimeV4ApprovalFor,
  type AgentTaskRuntimeV4Capability,
  type AgentTaskRuntimeV4SessionV2ShadowInput,
  type AgentTaskRuntimeV4SessionV2ShadowToolResultEntry,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  controllerSource,
  contractSource,
  permissionRouterSource,
  shadowSource,
} = readProjectSources({
  contractSource: 'src/agent/agentTaskRuntimeV4Contract.ts',
  controllerSource: 'src/components/chat/agentRunController.ts',
  permissionRouterSource: 'src/agent/agentPermissionRouter.ts',
  shadowSource: 'src/agent/agentTaskRuntimeV4SessionV2ShadowAdapter.ts',
});

assert.match(
  contractSource,
  /Locate success resolves a target; it must not complete the task/u,
  'V4 must lock locate as target resolution, not task completion.',
);
assert.match(
  contractSource,
  /Action dispatch must be followed by evidence collection and outcome verification/u,
  'V4 must lock dispatch -> evidence -> verify.',
);
assert.match(
  contractSource,
  /Observe, locate, verify, wait, and retry are read-only/u,
  'V4 must lock read-only capabilities as silent runtime work.',
);
assert.match(
  permissionRouterSource,
  /AGENT_TASK_APPROVAL_CONTINUATION_TOOLS[\s\S]*'execute_desktop_sequence'[\s\S]*'execute_desktop_action'[\s\S]*'execute_desktop_input'[\s\S]*'launch_local_app'/u,
  'Same-task approval continuation must include low-level desktop input dispatch.',
);
assert.match(
  permissionRouterSource,
  /isAgentCommandHardGate\(pendingCommand, pendingPlan\)/u,
  'Same-task approval continuation must still stop hard login/security gates.',
);
assert.match(
  shadowSource,
  /target_resolved_without_dispatch/u,
  'V4 shadow must expose locate-ready-without-dispatch as a first-class diagnosis.',
);
assert.match(
  shadowSource,
  /input_dispatched_unverified/u,
  'V4 shadow must expose dispatch-without-verified-outcome as a first-class diagnosis.',
);

const readOnlyCapabilities = [
  'observe',
  'locate',
  'verify',
  'wait',
  'retry',
] as const satisfies readonly AgentTaskRuntimeV4Capability[];
assert.equal(getAgentTaskRuntimeV4ApprovalScope(readOnlyCapabilities), 'none');
assert.equal(getAgentTaskRuntimeV4ApprovalScope(['mouse']), 'task');
assert.equal(getAgentTaskRuntimeV4ApprovalScope(['keyboard']), 'task');

const task = createAgentTaskRuntimeV4TaskSpec({
  constraints: ['one approval for the same non-hard-gate task', 'verify after dispatch'],
  goal: 'Launch League of Legends from WeGame',
  id: 'runtime-v4-main-chain-contract',
  intent: 'launch-game-from-launcher',
  target: 'WeGame',
});
let context = createAgentTaskRuntimeV4Context({ task });

assert.equal(hasAgentTaskRuntimeV4ApprovalFor({
  capabilities: readOnlyCapabilities,
  context,
}), true);
assert.equal(hasAgentTaskRuntimeV4ApprovalFor({
  capabilities: ['mouse'],
  context,
  nowMs: 1000,
}), false);

let result = advanceAgentTaskRuntimeV4(context, {
  actor: 'task-runtime',
  kind: 'start',
});
assert.equal(result.accepted, true);
assert.equal(result.context.currentState, 'observing');
context = result.context;

result = advanceAgentTaskRuntimeV4(context, {
  actor: 'task-runtime',
  evidence: {
    kind: 'window',
    source: 'observe',
    summary: 'WeGame is visible.',
    timestampMs: 1000,
    verified: true,
  },
  kind: 'observation-collected',
});
assert.equal(result.accepted, true);
assert.equal(result.context.currentState, 'resolving_target');
context = result.context;

const prematureSuccessFromLocate = advanceAgentTaskRuntimeV4(context, {
  actor: 'target-resolver',
  kind: 'outcome-verified',
});
assert.equal(prematureSuccessFromLocate.accepted, false);
assert.match(prematureSuccessFromLocate.reason, /not valid/u);

result = advanceAgentTaskRuntimeV4(context, {
  actor: 'target-resolver',
  evidence: {
    kind: 'visual',
    source: 'locate',
    summary: 'Login button target/action/location are ready.',
    timestampMs: 1100,
    verified: true,
  },
  kind: 'target-resolved',
  targetSummary: 'WeGame login button',
});
assert.equal(result.accepted, true);
assert.equal(result.context.currentState, 'target_resolved');
context = result.context;

const directDispatchWithoutApproval = advanceAgentTaskRuntimeV4(context, {
  actor: 'action-executor',
  capabilities: ['mouse'],
  kind: 'action-dispatched',
});
assert.equal(directDispatchWithoutApproval.accepted, false);
assert.match(directDispatchWithoutApproval.reason, /not valid/u);

const approvalGrantedWithoutGrant = advanceAgentTaskRuntimeV4(context, {
  actor: 'approval-manager',
  capabilities: ['mouse'],
  kind: 'approval-granted',
});
assert.equal(approvalGrantedWithoutGrant.accepted, false);
assert.match(approvalGrantedWithoutGrant.reason, /requires a side-effect approval grant/u);

result = advanceAgentTaskRuntimeV4(context, {
  actor: 'approval-manager',
  kind: 'approval-required',
  reason: 'Clicking the resolved login button requires task approval.',
});
assert.equal(result.accepted, true);
assert.equal(result.context.currentState, 'waiting_approval');
context = result.context;

const grant = createAgentTaskRuntimeV4ApprovalGrant({
  approvedAtMs: 1200,
  capabilities: ['mouse', 'keyboard'],
  expiresAtMs: 5000,
  taskId: task.id,
});
assert.equal(grant.scope, 'task');
result = advanceAgentTaskRuntimeV4(context, {
  actor: 'approval-manager',
  approvalGrant: grant,
  capabilities: ['mouse'],
  kind: 'approval-granted',
  nowMs: 1300,
});
assert.equal(result.accepted, true);
assert.equal(result.context.currentState, 'executing');
assert.equal(hasAgentTaskRuntimeV4ApprovalFor({
  capabilities: ['mouse'],
  context: result.context,
  nowMs: 1300,
}), true);

const stepScopedGrant = createAgentTaskRuntimeV4ApprovalGrant({
  approvedAtMs: 1250,
  capabilities: ['install'],
  stepId: 'install-launcher-step',
  taskId: task.id,
});
assert.equal(stepScopedGrant.scope, 'step');
const stepScopedContext = {
  ...result.context,
  approvalGrants: [...result.context.approvalGrants, stepScopedGrant],
};
assert.equal(hasAgentTaskRuntimeV4ApprovalFor({
  capabilities: ['install'],
  context: stepScopedContext,
  nowMs: 1300,
  stepId: 'install-launcher-step',
}), true);
assert.equal(hasAgentTaskRuntimeV4ApprovalFor({
  capabilities: ['install'],
  context: stepScopedContext,
  nowMs: 1300,
  stepId: 'another-install-step',
}), false);
assert.equal(hasAgentTaskRuntimeV4ApprovalFor({
  capabilities: ['install'],
  context: stepScopedContext,
  nowMs: 1300,
}), false);
context = result.context;

const dispatchWithoutCapabilityDeclaration = advanceAgentTaskRuntimeV4(context, {
  actor: 'input-backend',
  kind: 'action-dispatched',
});
assert.equal(dispatchWithoutCapabilityDeclaration.accepted, false);
assert.match(dispatchWithoutCapabilityDeclaration.reason, /must declare/u);

const dispatchOutsideApprovalGrant = advanceAgentTaskRuntimeV4(context, {
  actor: 'input-backend',
  capabilities: ['close'],
  kind: 'action-dispatched',
});
assert.equal(dispatchOutsideApprovalGrant.accepted, false);
assert.match(dispatchOutsideApprovalGrant.reason, /not covered/u);

const prematureSuccessFromDispatch = advanceAgentTaskRuntimeV4(context, {
  actor: 'action-executor',
  kind: 'outcome-verified',
});
assert.equal(prematureSuccessFromDispatch.accepted, false);
assert.match(prematureSuccessFromDispatch.reason, /not valid/u);

result = advanceAgentTaskRuntimeV4(context, {
  actor: 'input-backend',
  capabilities: ['mouse'],
  evidence: {
    kind: 'input',
    source: 'execute_desktop_input',
    summary: 'Mouse click was dispatched to the login button.',
    timestampMs: 1400,
    verified: null,
  },
  kind: 'action-dispatched',
  nowMs: 1400,
});
assert.equal(result.accepted, true);
assert.equal(result.context.currentState, 'collecting_evidence');
context = result.context;

const directSuccessWithoutEvidence = advanceAgentTaskRuntimeV4(context, {
  actor: 'evidence-engine',
  kind: 'outcome-verified',
});
assert.equal(directSuccessWithoutEvidence.accepted, false);
assert.match(directSuccessWithoutEvidence.reason, /not valid/u);

result = advanceAgentTaskRuntimeV4(context, {
  actor: 'evidence-engine',
  evidence: {
    kind: 'visual',
    source: 'post-dispatch-observation',
    summary: 'Login panel changed after input dispatch.',
    timestampMs: 1800,
    verified: true,
  },
  kind: 'evidence-collected',
});
assert.equal(result.accepted, true);
assert.equal(result.context.currentState, 'verifying_outcome');
context = result.context;

const executorCannotVerify = advanceAgentTaskRuntimeV4(context, {
  actor: 'action-executor',
  kind: 'outcome-verified',
});
assert.equal(executorCannotVerify.accepted, false);
assert.match(executorCannotVerify.reason, /Only the evidence engine/u);

result = advanceAgentTaskRuntimeV4(context, {
  actor: 'evidence-engine',
  kind: 'outcome-verified',
});
assert.equal(result.accepted, true);
assert.equal(result.context.currentState, 'succeeded');

function toolEntry(
  toolName: string,
  options: {
    action?: string;
    stepsJson?: string;
    assessmentStatus?: string;
    postActionState?: string;
    targetMatched?: string;
    verification?: string;
    visualActionReadiness?: string;
  } = {},
): AgentTaskRuntimeV4SessionV2ShadowToolResultEntry {
  return {
    command: {
      kind: 'tool-call',
      toolCall: {
        input: {
          ...(options.action ? { action: options.action } : {}),
          ...(options.stepsJson ? { stepsJson: options.stepsJson } : {}),
        },
        name: toolName,
      },
    },
    createdAt: 1000,
    result: {
      assessment: options.assessmentStatus ? {
        status: options.assessmentStatus,
        summary: options.assessmentStatus,
      } : null,
      ok: true,
      stateSummary: {
        structuredEvidence: {
          postActionState: options.postActionState,
          targetMatched: options.targetMatched,
          visualActionReadiness: options.visualActionReadiness,
        },
        verificationEvidence: options.verification ? [options.verification] : [],
      },
      verification: options.verification,
    },
  };
}

function shadow(input: Partial<AgentTaskRuntimeV4SessionV2ShadowInput>) {
  return createAgentTaskRuntimeV4SessionV2Shadow({
    sourceText: 'Open League of Legends inside WeGame',
    status: 'completed',
    taskId: 'runtime-v4-main-chain-shadow',
    toolResults: [],
    userGoal: 'Open League of Legends inside WeGame',
    ...input,
  });
}

const locateReadyOnly = shadow({
  toolResults: [
    toolEntry('locate_screen_elements', {
      targetMatched: 'login button',
      visualActionReadiness: 'ready',
    }),
  ],
});
assert.equal(locateReadyOnly.classification, 'target_resolved_without_dispatch');
assert.equal(locateReadyOnly.context.currentState, 'target_resolved');

const locateReadyPendingInput = shadow({
  pendingApproval: {
    command: {
      kind: 'tool-call',
      toolCall: {
        input: {},
        name: 'execute_desktop_input',
      },
    },
  },
  status: 'needs-approval',
  toolResults: [
    toolEntry('locate_screen_elements', {
      targetMatched: 'login button',
      visualActionReadiness: 'ready',
    }),
  ],
});
assert.equal(locateReadyPendingInput.classification, 'approval_pending');
assert.equal(locateReadyPendingInput.context.currentState, 'waiting_approval');
assert.deepEqual(
  locateReadyPendingInput.events.map((event) => event.kind),
  ['start', 'observation-collected', 'target-resolved', 'approval-required'],
);

const dispatchedButUnverified = shadow({
  toolResults: [
    toolEntry('locate_screen_elements', {
      targetMatched: 'login button',
      visualActionReadiness: 'ready',
    }),
    toolEntry('execute_desktop_input', {
      action: 'click',
      assessmentStatus: 'unverified',
      postActionState: 'unchanged',
      verification: 'Mouse input dispatched, but UI did not change.',
    }),
  ],
});
assert.equal(dispatchedButUnverified.classification, 'input_dispatched_unverified');
assert.equal(dispatchedButUnverified.context.currentState, 'collecting_evidence');

console.log('agent runtime v4 main chain contract smoke ok');
