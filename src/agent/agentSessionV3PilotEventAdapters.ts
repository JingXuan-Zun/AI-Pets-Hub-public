import {
  type AgentModelDecisionTurnOutcome as AgentSessionV2ModelDecisionTurnOutcome,
} from './runtime/agentModelDecisionRuntime';
import { type AgentParallelToolTransactionResult } from './runtime/agentParallelToolTransactionExecutor';
import { type AgentRuntimePendingApprovalAssembly } from './runtime/agentPendingApprovalAssembly';
import { type AgentEvidenceTerminalOutcome } from './runtime/agentEvidenceEngine';
import { type AgentToolTransactionResult } from './runtime/agentToolTransactionExecutor';
import {
  type AgentSessionV3PilotCommandRoute,
  type AgentSessionV3PilotEvent,
} from './agentSessionV3PilotStateMachine';

export type AgentSessionV3PilotPreparationSource = 'normal' | 'recovery';

function coalesceAgentSessionV3PilotReason(...values: Array<string | null | undefined>) {
  return values.find((value): value is string => typeof value === 'string' && value.trim().length > 0)?.trim() ?? null;
}

function createAgentSessionV3PilotPreparedCommandEvent(options: {
  reason?: string | null;
  route: AgentSessionV3PilotCommandRoute;
  source?: AgentSessionV3PilotPreparationSource;
}): AgentSessionV3PilotEvent {
  if (options.source === 'recovery') {
    return {
      reason: options.reason ?? null,
      route: options.route,
      type: 'recovery-command-prepared',
    };
  }

  return {
    reason: options.reason ?? null,
    route: options.route,
    type: 'command-prepared',
  };
}

export function createAgentSessionV3PilotEventFromModelDecisionTurn(
  outcome: AgentSessionV2ModelDecisionTurnOutcome,
): AgentSessionV3PilotEvent {
  switch (outcome.type) {
    case 'accepted':
      if (outcome.decision.action === 'final_answer') {
        return {
          reason: coalesceAgentSessionV3PilotReason(outcome.decision.reason, outcome.decision.message),
          route: 'terminal',
          terminalStatus: 'completed',
          type: 'model-decision-accepted',
        };
      }

      if (outcome.decision.action === 'ask_user') {
        return {
          reason: coalesceAgentSessionV3PilotReason(outcome.decision.reason, outcome.decision.message),
          route: 'terminal',
          terminalStatus: 'needs-user',
          type: 'model-decision-accepted',
        };
      }

      return {
        reason: coalesceAgentSessionV3PilotReason(outcome.decision.reason, outcome.decision.message),
        route: 'prepare-command',
        type: 'model-decision-accepted',
      };

    case 'invalid-output':
      return {
        reason: 'Model output did not satisfy the decision contract.',
        type: 'model-output-invalid',
      };

    case 'model-failed':
      return {
        errorText: outcome.errorText,
        reason: outcome.errorText,
        type: 'model-failed',
      };

    case 'cancelled-after-output':
      return {
        reason: 'Cancellation was requested after model output.',
        type: 'cancel',
      };
  }
}

export function createAgentSessionV3PilotEventFromPreparedCommand(options: {
  reason?: string | null;
  route: AgentSessionV3PilotCommandRoute;
  source?: AgentSessionV3PilotPreparationSource;
}): AgentSessionV3PilotEvent {
  return createAgentSessionV3PilotPreparedCommandEvent(options);
}

export function createAgentSessionV3PilotEventFromPendingApprovalAssembly(
  assembly: AgentRuntimePendingApprovalAssembly,
  options: {
    source?: AgentSessionV3PilotPreparationSource;
  } = {},
): AgentSessionV3PilotEvent {
  return createAgentSessionV3PilotPreparedCommandEvent({
    reason: assembly.finalAnswer,
    route: 'approval',
    source: options.source,
  });
}

export function createAgentSessionV3PilotCommandUnavailableEvent(reason?: string | null): AgentSessionV3PilotEvent {
  return {
    reason: reason ?? null,
    type: 'command-unavailable',
  };
}

export function createAgentSessionV3PilotEventFromToolExecutionTransaction(
  transaction: AgentToolTransactionResult,
): AgentSessionV3PilotEvent {
  return {
    ok: transaction.result.ok !== false,
    reason: coalesceAgentSessionV3PilotReason(
      transaction.result.verification,
      transaction.result.responseText,
      transaction.result.errorText,
    ),
    type: 'transaction-finished',
  };
}

export function createAgentSessionV3PilotEventFromParallelToolExecutionTransaction(
  transaction: AgentParallelToolTransactionResult,
): AgentSessionV3PilotEvent {
  const successfulResults = transaction.allResults.filter(({ result }) => result.ok !== false).length;
  return {
    ok: successfulResults === transaction.allResults.length,
    reason: `Parallel transaction finished with ${successfulResults}/${transaction.allResults.length} successful results.`,
    type: 'transaction-finished',
  };
}

export function createAgentSessionV3PilotEventFromPostActionTerminalEvaluation(
  evaluation: AgentEvidenceTerminalOutcome | null,
): AgentSessionV3PilotEvent | null {
  if (!evaluation) {
    return null;
  }

  if (evaluation.status === 'completed') {
    return {
      reason: coalesceAgentSessionV3PilotReason(evaluation.stepReason, evaluation.finalAnswer),
      type: 'evaluation-completed',
    };
  }

  return {
    reason: coalesceAgentSessionV3PilotReason(evaluation.stepReason, evaluation.finalAnswer),
    type: 'evaluation-needs-user',
  };
}

export function createAgentSessionV3PilotEvaluationRecoveryEvent(reason?: string | null): AgentSessionV3PilotEvent {
  return {
    reason: reason ?? null,
    type: 'evaluation-needs-recovery',
  };
}

export function createAgentSessionV3PilotRecoveryExhaustedEvent(reason?: string | null): AgentSessionV3PilotEvent {
  return {
    reason: reason ?? null,
    type: 'recovery-exhausted',
  };
}
