import {
  createAgentSessionV3PilotCommandUnavailableEvent,
  createAgentSessionV3PilotEvaluationRecoveryEvent,
  createAgentSessionV3PilotEventFromModelDecisionTurn,
  createAgentSessionV3PilotEventFromParallelToolExecutionTransaction,
  createAgentSessionV3PilotEventFromPostActionTerminalEvaluation,
  createAgentSessionV3PilotEventFromPreparedCommand,
  createAgentSessionV3PilotEventFromToolExecutionTransaction,
} from './agentSessionV3PilotEventAdapters';
import { type AgentSessionV3PilotCommandRoute } from './agentSessionV3PilotStateMachine';
import {
  type AgentSessionV3RuntimeBoundaryPorts,
  type AgentSessionV3RuntimePhasePort,
  type AgentSessionV3RuntimePhasePortContext,
} from './agentSessionV3RuntimeBoundary';
import {
  type AgentModelDecisionTurnOutcome as AgentSessionV2ModelDecisionTurnOutcome,
} from './runtime/agentModelDecisionRuntime';
import { type AgentParallelToolTransactionResult } from './runtime/agentParallelToolTransactionExecutor';
import { type AgentEvidenceTerminalOutcome } from './runtime/agentEvidenceEngine';
import { type AgentToolTransactionResult } from './runtime/agentToolTransactionExecutor';

export type AgentSessionV3RuntimeAdapterPort<Phase extends keyof AgentSessionV3RuntimeBoundaryPorts> =
  NonNullable<AgentSessionV3RuntimeBoundaryPorts[Phase]>;

export type AgentSessionV3RuntimeModelDecisionAdapter = (
  context: AgentSessionV3RuntimePhasePortContext<'model_decision'>,
) => AgentSessionV2ModelDecisionTurnOutcome | Promise<AgentSessionV2ModelDecisionTurnOutcome>;

export type AgentSessionV3RuntimePrepareCommandAdapter = (
  context: AgentSessionV3RuntimePhasePortContext<'prepare_command'>,
) => AgentSessionV3RuntimePreparedCommandResult | Promise<AgentSessionV3RuntimePreparedCommandResult>;

export type AgentSessionV3RuntimeExecuteTransactionAdapter = (
  context: AgentSessionV3RuntimePhasePortContext<'execute_transaction'>,
) => AgentSessionV3RuntimeExecutedTransactionResult | Promise<AgentSessionV3RuntimeExecutedTransactionResult>;

export type AgentSessionV3RuntimeEvaluationAdapter = (
  context: AgentSessionV3RuntimePhasePortContext<'evaluate'>,
) => AgentEvidenceTerminalOutcome | null | Promise<AgentEvidenceTerminalOutcome | null>;

export type AgentSessionV3RuntimePreparedCommandResult =
  | {
      reason?: string | null;
      route: AgentSessionV3PilotCommandRoute;
      status?: 'prepared';
    }
  | {
      reason: string;
      status: 'unavailable';
    };

export type AgentSessionV3RuntimeExecutedTransactionResult =
  | {
      kind: 'parallel-tool-transaction';
      transaction: AgentParallelToolTransactionResult;
    }
  | {
      kind: 'tool-transaction';
      transaction: AgentToolTransactionResult;
    };

export function createAgentSessionV3RuntimeInitPort(
  reason?: string | null,
): AgentSessionV3RuntimeAdapterPort<'init'> {
  return () => ({
    event: {
      reason: reason ?? null,
      type: 'start',
    },
    kind: 'event',
  });
}

export function createAgentSessionV3RuntimeModelDecisionPort(
  adapter: AgentSessionV3RuntimeModelDecisionAdapter,
): AgentSessionV3RuntimeAdapterPort<'model_decision'> {
  return async (context) => ({
    event: createAgentSessionV3PilotEventFromModelDecisionTurn(await adapter(context)),
    kind: 'event',
  });
}

export function createAgentSessionV3RuntimePrepareCommandPort(
  adapter: AgentSessionV3RuntimePrepareCommandAdapter,
): AgentSessionV3RuntimeAdapterPort<'prepare_command'> {
  return async (context) => {
    const prepared = await adapter(context);
    if (prepared.status === 'unavailable') {
      return {
        event: createAgentSessionV3PilotCommandUnavailableEvent(prepared.reason),
        kind: 'event',
      };
    }

    return {
      event: createAgentSessionV3PilotEventFromPreparedCommand({
        reason: prepared.reason,
        route: prepared.route,
      }),
      kind: 'event',
    };
  };
}

export function createAgentSessionV3RuntimeCommandUnavailablePort(
  reason: string,
): AgentSessionV3RuntimePhasePort<'prepare_command'> {
  return () => ({
    event: createAgentSessionV3PilotCommandUnavailableEvent(reason),
    kind: 'event',
  });
}

export function createAgentSessionV3RuntimeExecuteTransactionPort(
  adapter: AgentSessionV3RuntimeExecuteTransactionAdapter,
): AgentSessionV3RuntimeAdapterPort<'execute_transaction'> {
  return async (context) => {
    const executed = await adapter(context);
    return {
      event: executed.kind === 'parallel-tool-transaction'
        ? createAgentSessionV3PilotEventFromParallelToolExecutionTransaction(executed.transaction)
        : createAgentSessionV3PilotEventFromToolExecutionTransaction(executed.transaction),
      kind: 'event',
    };
  };
}

export function createAgentSessionV3RuntimeEvaluatePort(
  adapter: AgentSessionV3RuntimeEvaluationAdapter,
): AgentSessionV3RuntimeAdapterPort<'evaluate'> {
  return async (context) => {
    const event = createAgentSessionV3PilotEventFromPostActionTerminalEvaluation(await adapter(context))
      ?? createAgentSessionV3PilotEvaluationRecoveryEvent('Evaluation did not produce a terminal result.');
    return {
      event,
      kind: 'event',
    };
  };
}

export function createAgentSessionV3RuntimeWaitingPort<Phase extends keyof AgentSessionV3RuntimeBoundaryPorts>(
  reason: string,
): AgentSessionV3RuntimeAdapterPort<Phase> {
  return () => ({
    kind: 'waiting',
    reason,
  });
}

export function createAgentSessionV3RuntimeBlockedPort<Phase extends keyof AgentSessionV3RuntimeBoundaryPorts>(
  reason: string,
): AgentSessionV3RuntimeAdapterPort<Phase> {
  return () => ({
    kind: 'blocked',
    reason,
  });
}
