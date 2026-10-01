import {
  type AgentActionScope,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../agentChatCommand';
import { type AgentExecutionPlan } from '../agentOrchestrator';
import {
  type AgentRuntimeActionReceipt,
  type AgentRuntimeEvidenceEnvelope,
  type AgentRuntimeOperationSurface,
  type AgentRuntimeTargetBinding,
  type AgentRuntimeVerificationResult,
} from './agentRuntimeTaskContract';
import {
  type AgentRuntimeTaskTransactionEvent,
  type AgentRuntimeTaskTransactionState,
} from './agentRuntimeTaskTransaction';
import type { AgentCanonicalEventJournal } from './agentCanonicalEventJournal.ts';

export type AgentRuntimeImplementation =
  | 'stable'
  | 'candidate'
  | 'fallback'
  | 'unavailable';

export interface AgentRuntimeRunResult<Result> {
  implementation: AgentRuntimeImplementation;
  reason: string;
  result: Result | null;
}

export interface AgentRuntimeAdapter<Result> {
  readonly id: string;
  run(context?: AgentRuntimeAdapterContext): Promise<AgentRuntimeRunResult<Result>>;
}

export interface RunAgentRuntimeOptions<Result> {
  adapter: AgentRuntimeAdapter<Result>;
  canonicalEventJournal?: AgentCanonicalEventJournal | null;
  onProgress?: AgentRuntimeProgressHandler | null;
  taskIdentity?: {
    sourceText: string;
    userGoal: string;
  } | null;
  taskTransaction?: AgentRuntimeTaskTransactionState | null;
  taskTransactionEvent?: AgentRuntimeTaskTransactionEvent | null;
  cancellationSignal?: AbortSignal | null;
}

export interface AgentRuntimeAdapterContext {
  authorizeModelIteration: AgentTaskRuntimeModelIterationAuthorizer;
  authorizeRecovery: AgentTaskRuntimeRecoveryAuthorizer;
  onProgress: AgentRuntimeProgressHandler;
  taskTransaction: AgentRuntimeTaskTransactionState | null;
  cancellationSignal?: AbortSignal | null;
  canonicalEventJournal?: AgentCanonicalEventJournal | null;
}

export type AgentRuntimeTimingEntryKind = 'model' | 'tool';

export type AgentRuntimeTimingEntryStatus =
  | 'budget-exceeded'
  | 'cached'
  | 'cancelled'
  | 'deduped'
  | 'failed'
  | 'running'
  | 'success';

export type AgentRuntimeTimingStopReason =
  | 'max-duration'
  | 'max-model-calls'
  | 'max-tool-calls';

export interface AgentRuntimeTimingEntry {
  detail?: string | null;
  durationMs?: number;
  endedAt?: number;
  id: string;
  kind: AgentRuntimeTimingEntryKind;
  label: string;
  startedAt: number;
  status: AgentRuntimeTimingEntryStatus;
  stepIndex: number;
}

export interface AgentRuntimeTimingTrace {
  accumulatedElapsedMs?: number;
  elapsedMs: number;
  entries: AgentRuntimeTimingEntry[];
  maxDurationMs: number;
  maxModelCalls: number;
  maxToolCalls: number;
  modelCallCount: number;
  modelDurationMs: number;
  startedAt: number;
  stopReason?: AgentRuntimeTimingStopReason | null;
  toolCallCount: number;
  toolDurationMs: number;
  updatedAt: number;
}

export interface AgentRuntimeToolResultEntry {
  command: AgentChatCommand;
  result: AgentChatCommandResult;
  timing?: AgentRuntimeTimingEntry | null;
}

export type AgentTaskRuntimeProductionState =
  | 'active'
  | 'waiting_approval'
  | 'blocked_needs_user'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'budget_exceeded';

export type AgentTaskRuntimeActivePhase =
  | 'planning'
  | 'observing'
  | 'resolving_target'
  | 'executing'
  | 'collecting_evidence'
  | 'verifying_outcome'
  | 'recovering'
  | 'approval'
  | 'terminal';

export type AgentTaskRuntimeLifecycleTransitionKind =
  | 'observation-started'
  | 'observation-collected'
  | 'target-resolution-started'
  | 'target-resolution-collected'
  | 'approval-required'
  | 'approval-granted'
  | 'execution-started'
  | 'action-dispatched'
  | 'evidence-collected'
  | 'verification-started'
  | 'verification-collected'
  | 'recovery-started'
  | 'recovery-collected';

export type AgentTaskRuntimeSubgoalStatus =
  | 'pending'
  | 'in_progress'
  | 'dispatched'
  | 'completed'
  | 'blocked';

export type AgentTaskRuntimeNextSubgoalAction =
  | 'await_approval'
  | 'execute'
  | 'resume'
  | 'verify'
  | 'blocked'
  | 'complete';

export interface AgentTaskRuntimeSubgoalRecord {
  completion: AgentActionScope['completion'];
  id: string;
  status: AgentTaskRuntimeSubgoalStatus;
  targetRef: string | null;
  taskGoalId: string | null;
  updatedAt: number;
}

export interface AgentTaskRuntimeStateRecord {
  activeAction?: AgentRuntimeActionReceipt | null;
  completedActions?: AgentRuntimeActionReceipt[];
  currentSubgoalId?: string | null;
  evidence?: AgentRuntimeEvidenceEnvelope[];
  lastRecoveryKind: AgentTaskRuntimeRecoveryKind | null;
  lastRejectedTransitionKind?: AgentTaskRuntimeLifecycleTransitionKind | null;
  lastRuntimeStatus: AgentRuntimeStatus | null;
  lastTransitionError?: string | null;
  lastTransitionKind?: AgentTaskRuntimeLifecycleTransitionKind | null;
  modelIterationCount: number;
  modelIterationLimit: number;
  nextSubgoalAction?: AgentTaskRuntimeNextSubgoalAction;
  nextSubgoalId?: string | null;
  owner: 'task-runtime';
  phase: AgentTaskRuntimeActivePhase;
  recoveryAttemptCount: number;
  recoveryLimit: number;
  revision: number;
  runId?: string | null;
  surface?: AgentRuntimeOperationSurface | null;
  sourceText: string;
  startedAt: number;
  state: AgentTaskRuntimeProductionState;
  taskId: string;
  subgoals?: AgentTaskRuntimeSubgoalRecord[];
  updatedAt: number;
  userGoal: string;
  targetBinding?: AgentRuntimeTargetBinding | null;
  verification?: AgentRuntimeVerificationResult | null;
}

export type AgentTaskRuntimeTransitionEvent =
  | {
      phase: AgentTaskRuntimeActivePhase;
      type: 'progress';
    }
  | {
      kind: AgentTaskRuntimeLifecycleTransitionKind;
      type: 'lifecycle';
    }
  | {
      actionScope: AgentActionScope;
      status: AgentTaskRuntimeSubgoalStatus;
      type: 'subgoal-status';
    }
  | {
      action: AgentTaskRuntimeModelIterationAction;
      iteration: number;
      limit: number;
      type: 'model-iteration-authorization';
    }
  | {
      allowed: boolean;
      attempt: number;
      kind: AgentTaskRuntimeRecoveryKind;
      limit: number;
      type: 'recovery-authorization';
    }
  | {
      status: AgentRuntimeStatus;
      type: 'runtime-result';
    };

export type AgentTaskRuntimeRecoveryKind =
  | 'automatic-observation'
  | 'failed-action';

export type AgentTaskRuntimeModelIterationAction =
  | 'run-iteration'
  | 'stop-limit'
  | 'stop-cancelled';

export interface AgentTaskRuntimeModelIterationRequest {
  cancellationRequested: boolean;
  requestedLimit: number;
  sourceText: string;
  taskState?: AgentTaskRuntimeStateRecord | null;
  userGoal: string;
}

export interface AgentTaskRuntimeModelIterationDecision {
  action: AgentTaskRuntimeModelIterationAction;
  iteration: number;
  limit: number;
  reason: string;
  taskState: AgentTaskRuntimeStateRecord;
}

export type AgentTaskRuntimeModelIterationAuthorizer = (
  request: AgentTaskRuntimeModelIterationRequest,
) => AgentTaskRuntimeModelIterationDecision;

export interface AgentTaskRuntimeRecoveryRequest {
  kind: AgentTaskRuntimeRecoveryKind;
  reason?: string | null;
  requestedLimit?: number | null;
  sourceText: string;
  taskState?: AgentTaskRuntimeStateRecord | null;
  userGoal: string;
}

export interface AgentTaskRuntimeRecoveryDecision {
  allowed: boolean;
  attempt: number;
  limit: number;
  reason: string;
}

export type AgentTaskRuntimeRecoveryAuthorizer = (
  request: AgentTaskRuntimeRecoveryRequest,
) => AgentTaskRuntimeRecoveryDecision;

export type AgentRuntimeStatus =
  | 'budget-exceeded'
  | 'cancelled'
  | 'completed'
  | 'failed'
  | 'max-steps'
  | 'needs-approval'
  | 'needs-user';

export type AgentRuntimeDecisionAction =
  | 'ask_user'
  | 'final_answer'
  | 'tool_call'
  | 'tool_calls';

export type AgentRuntimeVerificationStatus =
  | 'blocked'
  | 'partial'
  | 'satisfied'
  | 'unknown';

export interface AgentRuntimeUnderstanding {
  blockedGoals?: string[] | null;
  capabilityGap?: string | null;
  completedGoals?: string[] | null;
  neededCapability?: string | null;
  remainingGoals?: string[] | null;
  successCriteria?: string | null;
  userNeed?: string | null;
  verificationEvidence?: string[] | null;
  verificationGaps?: string[] | null;
  verificationStatus?: AgentRuntimeVerificationStatus | null;
}

export interface AgentRuntimeStep {
  action: AgentRuntimeDecisionAction | 'tool_result';
  args?: Record<string, unknown>;
  errorText?: string | null;
  index: number;
  modelResponse?: string;
  ok?: boolean;
  reason?: string | null;
  summary: string;
  timing?: AgentRuntimeTimingEntry | null;
  tool?: string | null;
  understanding?: AgentRuntimeUnderstanding | null;
}

export type AgentRuntimeTraceEventType =
  | 'approval_required'
  | 'decision_parsed'
  | 'decision_rejected'
  | 'final_answer'
  | 'model_output'
  | 'permission_routed'
  | 'runtime_shadow'
  | 'trace_compacted'
  | 'tool_finished'
  | 'tool_started';

export interface AgentRuntimeTraceEvent {
  action?: AgentRuntimeDecisionAction | null;
  details?: Record<string, unknown>;
  id: string;
  status?: string | null;
  stepIndex: number;
  summary: string;
  timestamp: number;
  tool?: string | null;
  type: AgentRuntimeTraceEventType;
}

export interface AgentRuntimeTraceEventDraft {
  action?: AgentRuntimeDecisionAction | null;
  details?: Record<string, unknown> | null;
  status?: string | null;
  stepIndex: number;
  summary: string;
  tool?: string | null;
  type: AgentRuntimeTraceEventType;
}

export interface AgentRuntimeCoveredParallelToolCommand {
  command: AgentChatCommand;
  coveredByCommand: AgentChatCommand;
  reason: string;
}

export interface AgentRuntimeParallelToolExecutionPlan {
  coveredCommands: AgentRuntimeCoveredParallelToolCommand[];
  runCommands: AgentChatCommand[];
}

export interface AgentRuntimeContinuation {
  diagnostics?: AgentRuntimeDiagnosticEnvelope[] | null;
  historyLines: string[];
  sourceText: string;
  steps: AgentRuntimeStep[];
  taskState?: AgentTaskRuntimeStateRecord | null;
  taskTransaction?: AgentRuntimeTaskTransactionState | null;
  timing?: AgentRuntimeTimingTrace | null;
  traceEvents: AgentRuntimeTraceEvent[];
  toolResults: AgentRuntimeToolResultEntry[];
  userGoal: string;
}

export interface AgentRuntimePendingApproval {
  command: AgentChatCommand;
  plan: AgentExecutionPlan;
  reason: string;
  routeSummary: string;
  runId?: string | null;
  taskId?: string | null;
  surfaceGeneration?: number | null;
  surfaceId?: string | null;
}

export type AgentRuntimeDiagnosticCategory =
  | 'approval-continuation'
  | 'runtime-shadow'
  | 'runtime-pilot'
  | 'task-runtime';

export interface AgentRuntimeDiagnosticPayload {
  details?: Record<string, unknown> | null;
  status?: string | null;
  summary: string;
  tool?: string | null;
}

export interface AgentRuntimeDiagnosticEnvelope<Payload = AgentRuntimeDiagnosticPayload> {
  authority: 'diagnostic-only';
  category: AgentRuntimeDiagnosticCategory;
  payload: Payload;
  source: string;
  timestamp: number;
}

export interface AgentRuntimeResult {
  continuation: AgentRuntimeContinuation;
  diagnostics?: AgentRuntimeDiagnosticEnvelope[] | null;
  finalAnswer: string;
  pendingApproval?: AgentRuntimePendingApproval | null;
  sourceText: string;
  status: AgentRuntimeStatus;
  steps: AgentRuntimeStep[];
  taskState?: AgentTaskRuntimeStateRecord | null;
  timing?: AgentRuntimeTimingTrace | null;
  traceEvents: AgentRuntimeTraceEvent[];
  toolResults: AgentRuntimeToolResultEntry[];
}

export interface AgentRuntimeToolExecutorContext {
  petId?: string | null;
  signal?: AbortSignal | null;
}

export type AgentRuntimeToolExecutor = (
  command: AgentChatCommand,
  context?: AgentRuntimeToolExecutorContext,
) => AgentChatCommandResult | Promise<AgentChatCommandResult>;

export type AgentRuntimeProgressEventType =
  | 'model-thinking'
  | 'model-decision'
  | 'tools-running'
  | 'tool-result';

export interface AgentRuntimeProgressEvent {
  command?: AgentChatCommand | null;
  commands?: AgentChatCommand[];
  continuation: AgentRuntimeContinuation;
  message: string;
  stepIndex: number;
  taskPhase?: AgentTaskRuntimeActivePhase | null;
  taskTransition?: {
    kind: AgentTaskRuntimeLifecycleTransitionKind;
  } | null;
  type: AgentRuntimeProgressEventType;
}

export type AgentRuntimeProgressHandler = (
  event: AgentRuntimeProgressEvent,
) => void;
