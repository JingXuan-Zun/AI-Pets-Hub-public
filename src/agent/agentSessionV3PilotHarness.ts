import {
  type AgentModelDecisionTurnOutcome as AgentSessionV2ModelDecisionTurnOutcome,
} from './runtime/agentModelDecisionRuntime';
import { type AgentParallelToolTransactionResult } from './runtime/agentParallelToolTransactionExecutor';
import { type AgentRuntimePendingApprovalAssembly } from './runtime/agentPendingApprovalAssembly';
import { type AgentEvidenceTerminalOutcome } from './runtime/agentEvidenceEngine';
import { type AgentToolTransactionResult } from './runtime/agentToolTransactionExecutor';
import {
  createAgentSessionV3PilotCommandUnavailableEvent,
  createAgentSessionV3PilotEvaluationRecoveryEvent,
  createAgentSessionV3PilotEventFromModelDecisionTurn,
  createAgentSessionV3PilotEventFromParallelToolExecutionTransaction,
  createAgentSessionV3PilotEventFromPendingApprovalAssembly,
  createAgentSessionV3PilotEventFromPostActionTerminalEvaluation,
  createAgentSessionV3PilotEventFromPreparedCommand,
  createAgentSessionV3PilotEventFromToolExecutionTransaction,
  createAgentSessionV3PilotRecoveryExhaustedEvent,
  type AgentSessionV3PilotPreparationSource,
} from './agentSessionV3PilotEventAdapters';
import {
  createAgentSessionV3PilotPhaseDriver,
  type AgentSessionV3PilotPhaseHandler,
} from './agentSessionV3PilotPhaseDriver';
import {
  runAgentSessionV3PilotRunner,
  type AgentSessionV3PilotRunnerContext,
  type AgentSessionV3PilotRunnerResult,
} from './agentSessionV3PilotRunner';
import {
  type AgentSessionV3PilotCommandRoute,
  type AgentSessionV3PilotEvent,
  type AgentSessionV3PilotState,
} from './agentSessionV3PilotStateMachine';
import {
  createAgentSessionV3PilotTraceSummaryText,
  type AgentSessionV3PilotTraceSummaryOptions,
} from './agentSessionV3PilotTraceSummary';

export type AgentSessionV3PilotHarnessContext = AgentSessionV3PilotRunnerContext;

export type AgentSessionV3PilotHarnessInitResult =
  | {
      event: AgentSessionV3PilotEvent;
      kind: 'pilot-event';
    }
  | {
      kind: 'start';
      reason?: string | null;
    }
  | null;

export type AgentSessionV3PilotHarnessModelDecisionResult =
  | {
      event: AgentSessionV3PilotEvent;
      kind: 'pilot-event';
    }
  | {
      kind: 'model-decision-turn';
      outcome: AgentSessionV2ModelDecisionTurnOutcome;
    }
  | null;

export type AgentSessionV3PilotHarnessPrepareCommandResult =
  | {
      event: AgentSessionV3PilotEvent;
      kind: 'pilot-event';
    }
  | {
      kind: 'prepared-command';
      reason?: string | null;
      route: AgentSessionV3PilotCommandRoute;
      source?: AgentSessionV3PilotPreparationSource;
    }
  | {
      assembly: AgentRuntimePendingApprovalAssembly;
      kind: 'pending-approval';
      source?: AgentSessionV3PilotPreparationSource;
    }
  | {
      kind: 'command-unavailable';
      reason?: string | null;
    }
  | null;

export type AgentSessionV3PilotHarnessApprovalResult =
  | {
      event: AgentSessionV3PilotEvent;
      kind: 'pilot-event';
    }
  | {
      kind: 'approved';
      reason?: string | null;
    }
  | {
      kind: 'denied';
      reason?: string | null;
    }
  | null;

export type AgentSessionV3PilotHarnessExecuteTransactionResult =
  | {
      event: AgentSessionV3PilotEvent;
      kind: 'pilot-event';
    }
  | {
      kind: 'tool-transaction';
      transaction: AgentToolTransactionResult;
    }
  | {
      kind: 'parallel-tool-transaction';
      transaction: AgentParallelToolTransactionResult;
    }
  | null;

export type AgentSessionV3PilotHarnessEvaluateResult =
  | {
      event: AgentSessionV3PilotEvent;
      kind: 'pilot-event';
    }
  | {
      evaluation: AgentEvidenceTerminalOutcome | null;
      kind: 'post-action-terminal';
    }
  | {
      kind: 'needs-recovery';
      reason?: string | null;
    }
  | null;

export type AgentSessionV3PilotHarnessRecoverResult =
  | {
      event: AgentSessionV3PilotEvent;
      kind: 'pilot-event';
    }
  | {
      kind: 'model-requested';
      reason?: string | null;
    }
  | {
      kind: 'prepared-command';
      reason?: string | null;
      route: AgentSessionV3PilotCommandRoute;
    }
  | {
      assembly: AgentRuntimePendingApprovalAssembly;
      kind: 'pending-approval';
    }
  | {
      kind: 'exhausted';
      reason?: string | null;
    }
  | null;

export interface AgentSessionV3PilotHarnessPorts {
  approval?: (context: AgentSessionV3PilotHarnessContext) => AgentSessionV3PilotHarnessApprovalResult | Promise<AgentSessionV3PilotHarnessApprovalResult>;
  evaluate?: (context: AgentSessionV3PilotHarnessContext) => AgentSessionV3PilotHarnessEvaluateResult | Promise<AgentSessionV3PilotHarnessEvaluateResult>;
  executeTransaction?: (context: AgentSessionV3PilotHarnessContext) => AgentSessionV3PilotHarnessExecuteTransactionResult | Promise<AgentSessionV3PilotHarnessExecuteTransactionResult>;
  init?: (context: AgentSessionV3PilotHarnessContext) => AgentSessionV3PilotHarnessInitResult | Promise<AgentSessionV3PilotHarnessInitResult>;
  modelDecision?: (context: AgentSessionV3PilotHarnessContext) => AgentSessionV3PilotHarnessModelDecisionResult | Promise<AgentSessionV3PilotHarnessModelDecisionResult>;
  prepareCommand?: (context: AgentSessionV3PilotHarnessContext) => AgentSessionV3PilotHarnessPrepareCommandResult | Promise<AgentSessionV3PilotHarnessPrepareCommandResult>;
  recover?: (context: AgentSessionV3PilotHarnessContext) => AgentSessionV3PilotHarnessRecoverResult | Promise<AgentSessionV3PilotHarnessRecoverResult>;
}

export interface CreateAgentSessionV3PilotHarnessDriverOptions {
  ports: AgentSessionV3PilotHarnessPorts;
}

export interface AgentSessionV3PilotHarnessDebugSummaryOptions extends AgentSessionV3PilotTraceSummaryOptions {
  enabled?: boolean;
}

export interface RunAgentSessionV3PilotHarnessOptions extends CreateAgentSessionV3PilotHarnessDriverOptions {
  debugSummary?: AgentSessionV3PilotHarnessDebugSummaryOptions | null;
  initialState?: AgentSessionV3PilotState | null;
  maxTransitions?: number | null;
}

export interface AgentSessionV3PilotHarnessResult {
  debugSummaryText?: string | null;
  result: AgentSessionV3PilotRunnerResult;
}

function resolveAgentSessionV3PilotHarnessInitResult(
  result: AgentSessionV3PilotHarnessInitResult,
): AgentSessionV3PilotEvent | null {
  if (!result) {
    return null;
  }

  if (result.kind === 'pilot-event') {
    return result.event;
  }

  return {
    reason: result.reason ?? null,
    type: 'start',
  };
}

function resolveAgentSessionV3PilotHarnessModelDecisionResult(
  result: AgentSessionV3PilotHarnessModelDecisionResult,
): AgentSessionV3PilotEvent | null {
  if (!result) {
    return null;
  }

  if (result.kind === 'pilot-event') {
    return result.event;
  }

  return createAgentSessionV3PilotEventFromModelDecisionTurn(result.outcome);
}

function resolveAgentSessionV3PilotHarnessPrepareCommandResult(
  result: AgentSessionV3PilotHarnessPrepareCommandResult,
): AgentSessionV3PilotEvent | null {
  if (!result) {
    return null;
  }

  switch (result.kind) {
    case 'pilot-event':
      return result.event;
    case 'prepared-command':
      return createAgentSessionV3PilotEventFromPreparedCommand({
        reason: result.reason,
        route: result.route,
        source: result.source,
      });
    case 'pending-approval':
      return createAgentSessionV3PilotEventFromPendingApprovalAssembly(result.assembly, {
        source: result.source,
      });
    case 'command-unavailable':
      return createAgentSessionV3PilotCommandUnavailableEvent(result.reason);
  }
}

function resolveAgentSessionV3PilotHarnessApprovalResult(
  result: AgentSessionV3PilotHarnessApprovalResult,
): AgentSessionV3PilotEvent | null {
  if (!result) {
    return null;
  }

  switch (result.kind) {
    case 'pilot-event':
      return result.event;
    case 'approved':
      return {
        reason: result.reason ?? null,
        type: 'approval-granted',
      };
    case 'denied':
      return {
        reason: result.reason ?? null,
        type: 'approval-denied',
      };
  }
}

function resolveAgentSessionV3PilotHarnessExecuteTransactionResult(
  result: AgentSessionV3PilotHarnessExecuteTransactionResult,
): AgentSessionV3PilotEvent | null {
  if (!result) {
    return null;
  }

  switch (result.kind) {
    case 'pilot-event':
      return result.event;
    case 'tool-transaction':
      return createAgentSessionV3PilotEventFromToolExecutionTransaction(result.transaction);
    case 'parallel-tool-transaction':
      return createAgentSessionV3PilotEventFromParallelToolExecutionTransaction(result.transaction);
  }
}

function resolveAgentSessionV3PilotHarnessEvaluateResult(
  result: AgentSessionV3PilotHarnessEvaluateResult,
): AgentSessionV3PilotEvent | null {
  if (!result) {
    return null;
  }

  switch (result.kind) {
    case 'pilot-event':
      return result.event;
    case 'post-action-terminal':
      return createAgentSessionV3PilotEventFromPostActionTerminalEvaluation(result.evaluation);
    case 'needs-recovery':
      return createAgentSessionV3PilotEvaluationRecoveryEvent(result.reason);
  }
}

function resolveAgentSessionV3PilotHarnessRecoverResult(
  result: AgentSessionV3PilotHarnessRecoverResult,
): AgentSessionV3PilotEvent | null {
  if (!result) {
    return null;
  }

  switch (result.kind) {
    case 'pilot-event':
      return result.event;
    case 'model-requested':
      return {
        reason: result.reason ?? null,
        type: 'recovery-model-requested',
      };
    case 'prepared-command':
      return createAgentSessionV3PilotEventFromPreparedCommand({
        reason: result.reason,
        route: result.route,
        source: 'recovery',
      });
    case 'pending-approval':
      return createAgentSessionV3PilotEventFromPendingApprovalAssembly(result.assembly, {
        source: 'recovery',
      });
    case 'exhausted':
      return createAgentSessionV3PilotRecoveryExhaustedEvent(result.reason);
  }
}

function createAgentSessionV3PilotHarnessPhaseHandler<T>(
  port: ((context: AgentSessionV3PilotHarnessContext) => T | Promise<T>) | undefined,
  resolve: (result: Awaited<T>) => AgentSessionV3PilotEvent | null,
): AgentSessionV3PilotPhaseHandler {
  return async (context) => {
    if (!port) {
      return null;
    }

    return resolve(await port(context));
  };
}

export function createAgentSessionV3PilotHarnessDriver(
  options: CreateAgentSessionV3PilotHarnessDriverOptions,
) {
  return createAgentSessionV3PilotPhaseDriver({
    handlers: {
      evaluate: createAgentSessionV3PilotHarnessPhaseHandler(
        options.ports.evaluate,
        resolveAgentSessionV3PilotHarnessEvaluateResult,
      ),
      execute_transaction: createAgentSessionV3PilotHarnessPhaseHandler(
        options.ports.executeTransaction,
        resolveAgentSessionV3PilotHarnessExecuteTransactionResult,
      ),
      init: createAgentSessionV3PilotHarnessPhaseHandler(
        options.ports.init,
        resolveAgentSessionV3PilotHarnessInitResult,
      ),
      model_decision: createAgentSessionV3PilotHarnessPhaseHandler(
        options.ports.modelDecision,
        resolveAgentSessionV3PilotHarnessModelDecisionResult,
      ),
      needs_approval: createAgentSessionV3PilotHarnessPhaseHandler(
        options.ports.approval,
        resolveAgentSessionV3PilotHarnessApprovalResult,
      ),
      prepare_command: createAgentSessionV3PilotHarnessPhaseHandler(
        options.ports.prepareCommand,
        resolveAgentSessionV3PilotHarnessPrepareCommandResult,
      ),
      recover: createAgentSessionV3PilotHarnessPhaseHandler(
        options.ports.recover,
        resolveAgentSessionV3PilotHarnessRecoverResult,
      ),
    },
  });
}

export function runAgentSessionV3PilotHarness(
  options: RunAgentSessionV3PilotHarnessOptions,
): Promise<AgentSessionV3PilotRunnerResult> {
  return runAgentSessionV3PilotRunner({
    driver: createAgentSessionV3PilotHarnessDriver({
      ports: options.ports,
    }),
    initialState: options.initialState,
    maxTransitions: options.maxTransitions,
  });
}

export async function runAgentSessionV3PilotHarnessWithDebugSummary(
  options: RunAgentSessionV3PilotHarnessOptions,
): Promise<AgentSessionV3PilotHarnessResult> {
  const result = await runAgentSessionV3PilotHarness(options);
  return {
    debugSummaryText: options.debugSummary?.enabled
      ? createAgentSessionV3PilotTraceSummaryText(result, options.debugSummary)
      : null,
    result,
  };
}
