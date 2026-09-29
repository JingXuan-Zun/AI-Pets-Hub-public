import {
  createAgentSessionV3RuntimeEvaluatePort,
  createAgentSessionV3RuntimeExecuteTransactionPort,
  createAgentSessionV3RuntimeInitPort,
  createAgentSessionV3RuntimeModelDecisionPort,
  createAgentSessionV3RuntimePrepareCommandPort,
  createAgentSessionV3RuntimeWaitingPort,
  type AgentSessionV3RuntimeEvaluationAdapter,
  type AgentSessionV3RuntimeExecuteTransactionAdapter,
  type AgentSessionV3RuntimeModelDecisionAdapter,
  type AgentSessionV3RuntimePrepareCommandAdapter,
} from './agentSessionV3RuntimeAdapters';
import {
  runAgentSessionV3RuntimeController,
  type AgentSessionV3RuntimeControllerResult,
} from './agentSessionV3RuntimeController';
import {
  type AgentSessionV3RuntimeBoundaryMode,
  type AgentSessionV3RuntimeBoundaryPorts,
  type AgentSessionV3RuntimePhasePort,
} from './agentSessionV3RuntimeBoundary';
import { type AgentSessionV3PilotTerminalStatus } from './agentSessionV3PilotStateMachine';
import { type AgentSessionV3PilotState } from './agentSessionV3PilotStateMachine';

export type AgentSessionV3ExperimentalSessionStatus =
  | 'blocked'
  | 'cancelled'
  | 'completed'
  | 'failed'
  | 'invalid-transition'
  | 'needs-approval'
  | 'needs-user'
  | 'runtime-failed'
  | 'transition-limit'
  | 'waiting';

export interface AgentSessionV3ExperimentalSessionAdapters {
  approval?: AgentSessionV3RuntimePhasePort<'needs_approval'> | null;
  evaluate?: AgentSessionV3RuntimeEvaluationAdapter | null;
  executeTransaction?: AgentSessionV3RuntimeExecuteTransactionAdapter | null;
  modelDecision: AgentSessionV3RuntimeModelDecisionAdapter;
  prepareCommand?: AgentSessionV3RuntimePrepareCommandAdapter | null;
  recover?: AgentSessionV3RuntimePhasePort<'recover'> | null;
}

export interface RunAgentSessionV3ExperimentalSessionOptions {
  adapters: AgentSessionV3ExperimentalSessionAdapters;
  boundaryMode?: AgentSessionV3RuntimeBoundaryMode;
  initialState?: AgentSessionV3PilotState | null;
  isCancellationRequested?: (() => boolean) | null;
  maxTransitions?: number | null;
  startReason?: string | null;
}

export interface AgentSessionV3ExperimentalSessionResult {
  finalAnswer: string;
  runtime: AgentSessionV3RuntimeControllerResult;
  status: AgentSessionV3ExperimentalSessionStatus;
}

function createAgentSessionV3ExperimentalMissingPhasePort<Phase extends keyof AgentSessionV3RuntimeBoundaryPorts>(
  phase: Phase,
): NonNullable<AgentSessionV3RuntimeBoundaryPorts[Phase]> {
  return createAgentSessionV3RuntimeWaitingPort<Phase>(
    `No experimental v3 adapter is configured for phase ${String(phase)}.`,
  );
}

function createAgentSessionV3ExperimentalSessionPorts(
  adapters: AgentSessionV3ExperimentalSessionAdapters,
  startReason?: string | null,
): AgentSessionV3RuntimeBoundaryPorts {
  return {
    evaluate: adapters.evaluate
      ? createAgentSessionV3RuntimeEvaluatePort(adapters.evaluate)
      : createAgentSessionV3ExperimentalMissingPhasePort('evaluate'),
    execute_transaction: adapters.executeTransaction
      ? createAgentSessionV3RuntimeExecuteTransactionPort(adapters.executeTransaction)
      : createAgentSessionV3ExperimentalMissingPhasePort('execute_transaction'),
    init: createAgentSessionV3RuntimeInitPort(startReason ?? 'Begin experimental v3 agent session.'),
    model_decision: createAgentSessionV3RuntimeModelDecisionPort(adapters.modelDecision),
    needs_approval: adapters.approval ?? createAgentSessionV3ExperimentalMissingPhasePort('needs_approval'),
    prepare_command: adapters.prepareCommand
      ? createAgentSessionV3RuntimePrepareCommandPort(adapters.prepareCommand)
      : createAgentSessionV3ExperimentalMissingPhasePort('prepare_command'),
    recover: adapters.recover ?? createAgentSessionV3ExperimentalMissingPhasePort('recover'),
  };
}

function mapAgentSessionV3ExperimentalTerminalStatus(
  status: AgentSessionV3PilotTerminalStatus | null | undefined,
): AgentSessionV3ExperimentalSessionStatus {
  switch (status) {
    case 'cancelled':
      return 'cancelled';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'needs-user':
      return 'needs-user';
    default:
      return 'completed';
  }
}

function mapAgentSessionV3ExperimentalRuntimeStatus(
  runtime: AgentSessionV3RuntimeControllerResult,
): AgentSessionV3ExperimentalSessionStatus {
  if (runtime.status === 'terminal') {
    return mapAgentSessionV3ExperimentalTerminalStatus(runtime.state.terminal?.status);
  }

  if (runtime.status === 'waiting' && runtime.state.phase === 'needs_approval') {
    return 'needs-approval';
  }

  return runtime.status;
}

function createAgentSessionV3ExperimentalFinalAnswer(
  runtime: AgentSessionV3RuntimeControllerResult,
  status: AgentSessionV3ExperimentalSessionStatus,
) {
  if (runtime.reason?.trim()) {
    return runtime.reason.trim();
  }

  if (runtime.errorText?.trim()) {
    return runtime.errorText.trim();
  }

  switch (status) {
    case 'completed':
      return 'Agent v3 runtime completed.';
    case 'needs-approval':
      return 'Agent v3 runtime is waiting for approval.';
    case 'needs-user':
      return 'Agent v3 runtime needs user input.';
    case 'waiting':
      return 'Agent v3 runtime is waiting for a phase adapter.';
    case 'blocked':
      return 'Agent v3 runtime is blocked by a phase adapter.';
    case 'cancelled':
      return 'Agent v3 runtime was cancelled.';
    case 'failed':
    case 'runtime-failed':
      return 'Agent v3 runtime failed.';
    case 'invalid-transition':
      return 'Agent v3 runtime stopped on an invalid transition.';
    case 'transition-limit':
      return 'Agent v3 runtime stopped at the transition limit.';
  }
}

export async function runAgentSessionV3ExperimentalSession(
  options: RunAgentSessionV3ExperimentalSessionOptions,
): Promise<AgentSessionV3ExperimentalSessionResult> {
  const runtime = await runAgentSessionV3RuntimeController({
    boundaryMode: options.boundaryMode ?? 'experimental-non-production',
    initialState: options.initialState ?? null,
    isCancellationRequested: options.isCancellationRequested,
    maxTransitions: options.maxTransitions,
    ports: createAgentSessionV3ExperimentalSessionPorts(options.adapters, options.startReason),
  });
  const status = mapAgentSessionV3ExperimentalRuntimeStatus(runtime);

  return {
    finalAnswer: createAgentSessionV3ExperimentalFinalAnswer(runtime, status),
    runtime,
    status,
  };
}
