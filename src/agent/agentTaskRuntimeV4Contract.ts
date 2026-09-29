export type AgentTaskRuntimeV4State =
  | 'initialized'
  | 'observing'
  | 'resolving_target'
  | 'target_resolved'
  | 'waiting_approval'
  | 'executing'
  | 'collecting_evidence'
  | 'verifying_outcome'
  | 'local_recovering'
  | 'global_recovering'
  | 'succeeded'
  | 'failed'
  | 'blocked_needs_user';

export type AgentTaskRuntimeV4Capability =
  | 'observe'
  | 'locate'
  | 'verify'
  | 'wait'
  | 'retry'
  | 'mouse'
  | 'keyboard'
  | 'launch'
  | 'focus'
  | 'window_control'
  | 'close'
  | 'install'
  | 'filesystem_mutation'
  | 'network_mutation';

export type AgentTaskRuntimeV4Actor =
  | 'planner'
  | 'task-runtime'
  | 'target-resolver'
  | 'action-executor'
  | 'input-backend'
  | 'evidence-engine'
  | 'approval-manager';

export type AgentTaskRuntimeV4TransitionKind =
  | 'start'
  | 'observation-collected'
  | 'target-resolved'
  | 'target-not-resolved'
  | 'approval-required'
  | 'approval-granted'
  | 'action-dispatched'
  | 'dispatch-failed'
  | 'evidence-collected'
  | 'outcome-verified'
  | 'outcome-unverified'
  | 'local-recovery-selected'
  | 'local-recovery-exhausted'
  | 'global-recovery-selected'
  | 'user-blocked'
  | 'fatal-failure';

export type AgentTaskRuntimeV4EvidenceKind =
  | 'window'
  | 'process'
  | 'visual'
  | 'uia'
  | 'input'
  | 'system'
  | 'user';

export type AgentTaskRuntimeV4ApprovalScope = 'none' | 'task' | 'step' | 'blocked';

export interface AgentTaskRuntimeV4TaskSpec {
  constraints: string[];
  goal: string;
  id: string;
  intent: string;
  target?: string | null;
  version: 4;
}

export interface AgentTaskRuntimeV4Evidence {
  kind: AgentTaskRuntimeV4EvidenceKind;
  source: string;
  summary: string;
  timestampMs: number;
  verified?: boolean | null;
}

export interface AgentTaskRuntimeV4ApprovalGrant {
  approvedAtMs: number;
  capabilities: AgentTaskRuntimeV4Capability[];
  expiresAtMs?: number | null;
  scope: AgentTaskRuntimeV4ApprovalScope;
  stepId?: string | null;
  taskId: string;
}

export interface AgentTaskRuntimeV4Context {
  approvalGrants: AgentTaskRuntimeV4ApprovalGrant[];
  currentState: AgentTaskRuntimeV4State;
  evidence: AgentTaskRuntimeV4Evidence[];
  lastBlocker?: string | null;
  lastTargetSummary?: string | null;
  localRecoveryCount: number;
  task: AgentTaskRuntimeV4TaskSpec;
  transitionCount: number;
}

export interface AgentTaskRuntimeV4Transition {
  actor: AgentTaskRuntimeV4Actor;
  from: AgentTaskRuntimeV4State;
  kind: AgentTaskRuntimeV4TransitionKind;
  reason?: string | null;
  to: AgentTaskRuntimeV4State;
}

export interface AgentTaskRuntimeV4Contract {
  guardrails: string[];
  plannerForbiddenCapabilities: AgentTaskRuntimeV4Capability[];
  productionAuthority: false;
  readOnlyCapabilities: AgentTaskRuntimeV4Capability[];
  sideEffectCapabilities: AgentTaskRuntimeV4Capability[];
  transitionTable: Record<AgentTaskRuntimeV4State, readonly AgentTaskRuntimeV4TransitionKind[]>;
  version: 4;
}

const AGENT_TASK_RUNTIME_V4_READ_ONLY_CAPABILITIES = [
  'observe',
  'locate',
  'verify',
  'wait',
  'retry',
] as const satisfies readonly AgentTaskRuntimeV4Capability[];

const AGENT_TASK_RUNTIME_V4_SIDE_EFFECT_CAPABILITIES = [
  'mouse',
  'keyboard',
  'launch',
  'focus',
  'window_control',
  'close',
  'install',
  'filesystem_mutation',
  'network_mutation',
] as const satisfies readonly AgentTaskRuntimeV4Capability[];

export const AGENT_TASK_RUNTIME_V4_GUARDRAILS = [
  'contract-only until wired behind an explicit runtime adapter',
  'Planner describes task intent only; it must not own click, wait, retry, or recovery details',
  'Observe, locate, verify, wait, and retry are read-only task-runtime capabilities and remain silent',
  'Side-effect capabilities require task-scoped or step-scoped approval before dispatch',
  'Locate success resolves a target; it must not complete the task or produce a character reply',
  'Action dispatch must be followed by evidence collection and outcome verification',
  'Only the evidence engine may mark a task succeeded',
  'Local recovery is bounded and remains internal to the task runtime',
  'The same approved task should reuse approval for covered side-effect capabilities until the grant expires or is exhausted',
] as const;

export const AGENT_TASK_RUNTIME_V4_TRANSITION_TABLE: Record<
  AgentTaskRuntimeV4State,
  readonly AgentTaskRuntimeV4TransitionKind[]
> = {
  blocked_needs_user: [],
  collecting_evidence: ['evidence-collected', 'fatal-failure'],
  executing: ['action-dispatched', 'dispatch-failed', 'fatal-failure'],
  failed: [],
  global_recovering: ['observation-collected', 'user-blocked', 'fatal-failure'],
  initialized: ['start', 'fatal-failure'],
  local_recovering: [
    'observation-collected',
    'local-recovery-exhausted',
    'global-recovery-selected',
    'user-blocked',
    'fatal-failure',
  ],
  observing: ['observation-collected', 'evidence-collected', 'fatal-failure'],
  resolving_target: ['target-resolved', 'target-not-resolved', 'evidence-collected', 'fatal-failure'],
  succeeded: [],
  target_resolved: ['approval-required', 'approval-granted', 'fatal-failure'],
  verifying_outcome: [
    'outcome-verified',
    'outcome-unverified',
    'local-recovery-selected',
    'user-blocked',
    'fatal-failure',
  ],
  waiting_approval: ['approval-granted', 'user-blocked', 'fatal-failure'],
};

export function isAgentTaskRuntimeV4ReadOnlyCapability(
  capability: AgentTaskRuntimeV4Capability,
) {
  return AGENT_TASK_RUNTIME_V4_READ_ONLY_CAPABILITIES.includes(
    capability as (typeof AGENT_TASK_RUNTIME_V4_READ_ONLY_CAPABILITIES)[number],
  );
}

export function isAgentTaskRuntimeV4SideEffectCapability(
  capability: AgentTaskRuntimeV4Capability,
) {
  return AGENT_TASK_RUNTIME_V4_SIDE_EFFECT_CAPABILITIES.includes(
    capability as (typeof AGENT_TASK_RUNTIME_V4_SIDE_EFFECT_CAPABILITIES)[number],
  );
}

export function getAgentTaskRuntimeV4ApprovalScope(
  capabilities: readonly AgentTaskRuntimeV4Capability[],
): AgentTaskRuntimeV4ApprovalScope {
  if (!capabilities.length || capabilities.every(isAgentTaskRuntimeV4ReadOnlyCapability)) {
    return 'none';
  }

  if (capabilities.some((capability) => capability === 'install' || capability === 'network_mutation')) {
    return 'step';
  }

  if (capabilities.some(isAgentTaskRuntimeV4SideEffectCapability)) {
    return 'task';
  }

  return 'blocked';
}

export function canAgentTaskRuntimeV4PlannerOwnCapability(
  capability: AgentTaskRuntimeV4Capability,
) {
  return !isAgentTaskRuntimeV4ReadOnlyCapability(capability)
    && !isAgentTaskRuntimeV4SideEffectCapability(capability);
}

export function getAgentTaskRuntimeV4NextState(
  state: AgentTaskRuntimeV4State,
  transitionKind: AgentTaskRuntimeV4TransitionKind,
): AgentTaskRuntimeV4State | null {
  if (!AGENT_TASK_RUNTIME_V4_TRANSITION_TABLE[state].includes(transitionKind)) {
    return null;
  }

  switch (transitionKind) {
    case 'start':
      return 'observing';
    case 'observation-collected':
      return 'resolving_target';
    case 'target-resolved':
      return 'target_resolved';
    case 'target-not-resolved':
      return 'local_recovering';
    case 'approval-required':
      return 'waiting_approval';
    case 'approval-granted':
      return 'executing';
    case 'action-dispatched':
      return 'collecting_evidence';
    case 'dispatch-failed':
      return 'local_recovering';
    case 'evidence-collected':
      return 'verifying_outcome';
    case 'outcome-verified':
      return 'succeeded';
    case 'outcome-unverified':
    case 'local-recovery-selected':
      return 'local_recovering';
    case 'local-recovery-exhausted':
    case 'global-recovery-selected':
      return 'global_recovering';
    case 'user-blocked':
      return 'blocked_needs_user';
    case 'fatal-failure':
      return 'failed';
  }
}

export function isAgentTaskRuntimeV4TransitionAllowed(
  from: AgentTaskRuntimeV4State,
  transitionKind: AgentTaskRuntimeV4TransitionKind,
) {
  return getAgentTaskRuntimeV4NextState(from, transitionKind) !== null;
}

export function createAgentTaskRuntimeV4Transition(options: {
  actor: AgentTaskRuntimeV4Actor;
  from: AgentTaskRuntimeV4State;
  kind: AgentTaskRuntimeV4TransitionKind;
  reason?: string | null;
}): AgentTaskRuntimeV4Transition | null {
  const to = getAgentTaskRuntimeV4NextState(options.from, options.kind);
  if (!to) {
    return null;
  }

  return {
    actor: options.actor,
    from: options.from,
    kind: options.kind,
    reason: options.reason ?? null,
    to,
  };
}

export function canAgentTaskRuntimeV4ActorMarkSucceeded(actor: AgentTaskRuntimeV4Actor) {
  return actor === 'evidence-engine';
}

export function createAgentTaskRuntimeV4Contract(): AgentTaskRuntimeV4Contract {
  return {
    guardrails: [...AGENT_TASK_RUNTIME_V4_GUARDRAILS],
    plannerForbiddenCapabilities: [
      ...AGENT_TASK_RUNTIME_V4_READ_ONLY_CAPABILITIES,
      ...AGENT_TASK_RUNTIME_V4_SIDE_EFFECT_CAPABILITIES,
    ],
    productionAuthority: false,
    readOnlyCapabilities: [...AGENT_TASK_RUNTIME_V4_READ_ONLY_CAPABILITIES],
    sideEffectCapabilities: [...AGENT_TASK_RUNTIME_V4_SIDE_EFFECT_CAPABILITIES],
    transitionTable: AGENT_TASK_RUNTIME_V4_TRANSITION_TABLE,
    version: 4,
  };
}
