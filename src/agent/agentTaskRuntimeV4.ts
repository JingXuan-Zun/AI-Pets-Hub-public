import {
  canAgentTaskRuntimeV4ActorMarkSucceeded,
  createAgentTaskRuntimeV4Transition,
  getAgentTaskRuntimeV4ApprovalScope,
  isAgentTaskRuntimeV4ReadOnlyCapability,
  isAgentTaskRuntimeV4SideEffectCapability,
  type AgentTaskRuntimeV4Actor,
  type AgentTaskRuntimeV4ApprovalGrant,
  type AgentTaskRuntimeV4Capability,
  type AgentTaskRuntimeV4Context,
  type AgentTaskRuntimeV4Evidence,
  type AgentTaskRuntimeV4State,
  type AgentTaskRuntimeV4TaskSpec,
  type AgentTaskRuntimeV4Transition,
  type AgentTaskRuntimeV4TransitionKind,
} from './agentTaskRuntimeV4Contract';

export interface AgentTaskRuntimeV4AdvanceEvent {
  actor: AgentTaskRuntimeV4Actor;
  approvalGrant?: AgentTaskRuntimeV4ApprovalGrant | null;
  blocker?: string | null;
  capabilities?: AgentTaskRuntimeV4Capability[];
  evidence?: AgentTaskRuntimeV4Evidence | AgentTaskRuntimeV4Evidence[] | null;
  kind: AgentTaskRuntimeV4TransitionKind;
  nowMs?: number;
  reason?: string | null;
  stepId?: string | null;
  targetSummary?: string | null;
}

export type AgentTaskRuntimeV4AdvanceResult =
  | {
      accepted: true;
      context: AgentTaskRuntimeV4Context;
      transition: AgentTaskRuntimeV4Transition;
    }
  | {
      accepted: false;
      context: AgentTaskRuntimeV4Context;
      reason: string;
      transition: null;
    };

function nowAgentTaskRuntimeV4Timestamp() {
  return Date.now();
}

function normalizeAgentTaskRuntimeV4Evidence(
  evidence: AgentTaskRuntimeV4AdvanceEvent['evidence'],
) {
  if (!evidence) {
    return [];
  }

  return Array.isArray(evidence) ? evidence : [evidence];
}

function hasAgentTaskRuntimeV4GrantCapability(
  grant: AgentTaskRuntimeV4ApprovalGrant,
  capability: AgentTaskRuntimeV4Capability,
) {
  return grant.capabilities.includes(capability);
}

export function createAgentTaskRuntimeV4TaskSpec(options: {
  constraints?: string[];
  goal: string;
  id: string;
  intent: string;
  target?: string | null;
}): AgentTaskRuntimeV4TaskSpec {
  return {
    constraints: [...(options.constraints ?? [])],
    goal: options.goal,
    id: options.id,
    intent: options.intent,
    target: options.target ?? null,
    version: 4,
  };
}

export function createAgentTaskRuntimeV4Context(options: {
  task: AgentTaskRuntimeV4TaskSpec;
}): AgentTaskRuntimeV4Context {
  return {
    approvalGrants: [],
    currentState: 'initialized',
    evidence: [],
    lastBlocker: null,
    lastTargetSummary: null,
    localRecoveryCount: 0,
    task: options.task,
    transitionCount: 0,
  };
}

export function hasAgentTaskRuntimeV4ApprovalFor(options: {
  capabilities: readonly AgentTaskRuntimeV4Capability[];
  context: AgentTaskRuntimeV4Context;
  nowMs?: number;
  stepId?: string | null;
}) {
  const capabilities = options.capabilities.filter(isAgentTaskRuntimeV4SideEffectCapability);
  if (!capabilities.length || options.capabilities.every(isAgentTaskRuntimeV4ReadOnlyCapability)) {
    return true;
  }

  const now = options.nowMs ?? nowAgentTaskRuntimeV4Timestamp();
  const requestedStepId = options.stepId?.trim() || null;
  return options.context.approvalGrants.some((grant) => (
    grant.taskId === options.context.task.id
    && grant.scope !== 'none'
    && grant.scope !== 'blocked'
    && (grant.scope !== 'step' || (Boolean(requestedStepId) && grant.stepId === requestedStepId))
    && (!grant.expiresAtMs || grant.expiresAtMs > now)
    && capabilities.every((capability) => hasAgentTaskRuntimeV4GrantCapability(grant, capability))
  ));
}

export function createAgentTaskRuntimeV4ApprovalGrant(options: {
  approvedAtMs?: number;
  capabilities: AgentTaskRuntimeV4Capability[];
  expiresAtMs?: number | null;
  stepId?: string | null;
  taskId: string;
}): AgentTaskRuntimeV4ApprovalGrant {
  return {
    approvedAtMs: options.approvedAtMs ?? nowAgentTaskRuntimeV4Timestamp(),
    capabilities: [...options.capabilities],
    expiresAtMs: options.expiresAtMs ?? null,
    scope: getAgentTaskRuntimeV4ApprovalScope(options.capabilities),
    stepId: options.stepId?.trim() || null,
    taskId: options.taskId,
  };
}

function rejectAgentTaskRuntimeV4Advance(
  context: AgentTaskRuntimeV4Context,
  reason: string,
): AgentTaskRuntimeV4AdvanceResult {
  return {
    accepted: false,
    context,
    reason,
    transition: null,
  };
}

function assertAgentTaskRuntimeV4TransitionPolicy(options: {
  context: AgentTaskRuntimeV4Context;
  event: AgentTaskRuntimeV4AdvanceEvent;
  nextState: AgentTaskRuntimeV4State;
}) {
  if (
    options.nextState === 'succeeded'
    && !canAgentTaskRuntimeV4ActorMarkSucceeded(options.event.actor)
  ) {
    return 'Only the evidence engine may mark a V4 task succeeded.';
  }

  if (
    options.event.kind === 'action-dispatched'
    && options.event.actor !== 'action-executor'
    && options.event.actor !== 'input-backend'
  ) {
    return 'Only the action executor or input backend may report action dispatch.';
  }

  if (options.event.kind === 'approval-granted') {
    const requestedCapabilities = (
      options.event.capabilities
      ?? options.event.approvalGrant?.capabilities
      ?? []
    ).filter(isAgentTaskRuntimeV4SideEffectCapability);

    if (!requestedCapabilities.length || !options.event.approvalGrant) {
      return 'Approval-granted requires a side-effect approval grant.';
    }

    if (options.event.approvalGrant.taskId !== options.context.task.id) {
      return 'Approval grant taskId does not match the active task.';
    }

    if (
      options.event.approvalGrant.scope === 'step'
      && (!options.event.approvalGrant.stepId || options.event.stepId !== options.event.approvalGrant.stepId)
    ) {
      return 'Step-scoped approval grants must carry the matching stepId.';
    }

    const contextWithGrant = {
      ...options.context,
      approvalGrants: [...options.context.approvalGrants, options.event.approvalGrant],
    };
    if (!hasAgentTaskRuntimeV4ApprovalFor({
      capabilities: requestedCapabilities,
      context: contextWithGrant,
      nowMs: options.event.nowMs,
      stepId: options.event.stepId,
    })) {
      return 'Side-effect capabilities are not covered by a valid approval grant.';
    }
  }

  if (options.event.kind === 'action-dispatched') {
    const capabilities = (options.event.capabilities ?? []).filter(isAgentTaskRuntimeV4SideEffectCapability);
    if (!capabilities.length) {
      return 'Action dispatch must declare the side-effect capabilities it uses.';
    }

    if (!hasAgentTaskRuntimeV4ApprovalFor({
      capabilities,
      context: options.context,
      nowMs: options.event.nowMs,
      stepId: options.event.stepId,
    })) {
      return 'Action dispatch capabilities are not covered by a valid approval grant.';
    }
  }

  return null;
}

export function advanceAgentTaskRuntimeV4(
  context: AgentTaskRuntimeV4Context,
  event: AgentTaskRuntimeV4AdvanceEvent,
): AgentTaskRuntimeV4AdvanceResult {
  const transition = createAgentTaskRuntimeV4Transition({
    actor: event.actor,
    from: context.currentState,
    kind: event.kind,
    reason: event.reason ?? null,
  });
  if (!transition) {
    return rejectAgentTaskRuntimeV4Advance(
      context,
      `Transition ${event.kind} is not valid while V4 task state is ${context.currentState}.`,
    );
  }

  const policyRejection = assertAgentTaskRuntimeV4TransitionPolicy({
    context,
    event,
    nextState: transition.to,
  });
  if (policyRejection) {
    return rejectAgentTaskRuntimeV4Advance(context, policyRejection);
  }

  const evidence = normalizeAgentTaskRuntimeV4Evidence(event.evidence);
  const approvalGrants = event.approvalGrant
    ? [...context.approvalGrants, event.approvalGrant]
    : context.approvalGrants;
  const enteringLocalRecovery = transition.to === 'local_recovering'
    && context.currentState !== 'local_recovering';

  return {
    accepted: true,
    context: {
      ...context,
      approvalGrants,
      currentState: transition.to,
      evidence: [...context.evidence, ...evidence],
      lastBlocker: event.blocker ?? context.lastBlocker ?? null,
      lastTargetSummary: event.targetSummary ?? context.lastTargetSummary ?? null,
      localRecoveryCount: enteringLocalRecovery
        ? context.localRecoveryCount + 1
        : context.localRecoveryCount,
      transitionCount: context.transitionCount + 1,
    },
    transition,
  };
}
