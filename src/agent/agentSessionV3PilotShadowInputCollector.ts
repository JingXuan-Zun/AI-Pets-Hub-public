import {
  type AgentModelDecisionTurnOutcome as AgentSessionV2ModelDecisionTurnOutcome,
} from './runtime/agentModelDecisionRuntime';
import {
  type AgentParallelToolTransactionResult,
} from './runtime/agentParallelToolTransactionExecutor';
import {
  type AgentRuntimePendingApprovalAssembly,
} from './runtime/agentPendingApprovalAssembly';
import { type AgentEvidenceTerminalOutcome } from './runtime/agentEvidenceEngine';
import {
  type AgentToolTransactionResult,
} from './runtime/agentToolTransactionExecutor';
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
  type AgentSessionV3PilotCommandRoute,
  type AgentSessionV3PilotEvent,
} from './agentSessionV3PilotStateMachine';

export type AgentSessionV3PilotShadowInputKind =
  | 'approval-decision'
  | 'command-unavailable'
  | 'evaluation-recovery'
  | 'model-decision-turn'
  | 'parallel-tool-transaction'
  | 'pending-approval'
  | 'post-action-terminal'
  | 'prepared-command'
  | 'raw-event'
  | 'recovery-exhausted'
  | 'recovery-model-requested'
  | 'start'
  | 'tool-transaction';

export interface AgentSessionV3PilotShadowInputEntry {
  event: AgentSessionV3PilotEvent;
  kind: AgentSessionV3PilotShadowInputKind;
  label: string | null;
  timestamp: number;
}

export interface AgentSessionV3PilotShadowInputSnapshot {
  entries: AgentSessionV3PilotShadowInputEntry[];
  events: AgentSessionV3PilotEvent[];
}

export interface AgentSessionV3PilotShadowInputAppendOptions {
  label?: string | null;
}

export interface AgentSessionV3PilotShadowInputCollectorOptions {
  now?: (() => number) | null;
}

export interface AgentSessionV3PilotShadowInputCollector {
  appendApprovalDecision: (options: {
    approved: boolean;
    label?: string | null;
    reason?: string | null;
  }) => AgentSessionV3PilotShadowInputEntry;
  appendCommandUnavailable: (
    reason?: string | null,
    options?: AgentSessionV3PilotShadowInputAppendOptions,
  ) => AgentSessionV3PilotShadowInputEntry;
  appendEvaluationRecovery: (
    reason?: string | null,
    options?: AgentSessionV3PilotShadowInputAppendOptions,
  ) => AgentSessionV3PilotShadowInputEntry;
  appendEvent: (
    event: AgentSessionV3PilotEvent,
    options?: AgentSessionV3PilotShadowInputAppendOptions & {
      kind?: AgentSessionV3PilotShadowInputKind | null;
    },
  ) => AgentSessionV3PilotShadowInputEntry;
  appendModelDecisionTurn: (
    outcome: AgentSessionV2ModelDecisionTurnOutcome,
    options?: AgentSessionV3PilotShadowInputAppendOptions,
  ) => AgentSessionV3PilotShadowInputEntry;
  appendParallelToolExecutionTransaction: (
    transaction: AgentParallelToolTransactionResult,
    options?: AgentSessionV3PilotShadowInputAppendOptions,
  ) => AgentSessionV3PilotShadowInputEntry;
  appendPendingApprovalAssembly: (
    assembly: AgentRuntimePendingApprovalAssembly,
    options?: AgentSessionV3PilotShadowInputAppendOptions & {
      preparationSource?: AgentSessionV3PilotPreparationSource | null;
    },
  ) => AgentSessionV3PilotShadowInputEntry;
  appendPostActionTerminalEvaluation: (
    evaluation: AgentEvidenceTerminalOutcome | null,
    options?: AgentSessionV3PilotShadowInputAppendOptions,
  ) => AgentSessionV3PilotShadowInputEntry | null;
  appendPreparedCommand: (options: {
    label?: string | null;
    preparationSource?: AgentSessionV3PilotPreparationSource | null;
    reason?: string | null;
    route: AgentSessionV3PilotCommandRoute;
  }) => AgentSessionV3PilotShadowInputEntry;
  appendRecoveryExhausted: (
    reason?: string | null,
    options?: AgentSessionV3PilotShadowInputAppendOptions,
  ) => AgentSessionV3PilotShadowInputEntry;
  appendRecoveryModelRequested: (
    reason?: string | null,
    options?: AgentSessionV3PilotShadowInputAppendOptions,
  ) => AgentSessionV3PilotShadowInputEntry;
  appendStart: (
    reason?: string | null,
    options?: AgentSessionV3PilotShadowInputAppendOptions,
  ) => AgentSessionV3PilotShadowInputEntry;
  appendToolExecutionTransaction: (
    transaction: AgentToolTransactionResult,
    options?: AgentSessionV3PilotShadowInputAppendOptions,
  ) => AgentSessionV3PilotShadowInputEntry;
  clear: () => void;
  getEntries: () => AgentSessionV3PilotShadowInputEntry[];
  getEvents: () => AgentSessionV3PilotEvent[];
  snapshot: () => AgentSessionV3PilotShadowInputSnapshot;
}

function createAgentSessionV3PilotShadowInputEntry(options: {
  event: AgentSessionV3PilotEvent;
  kind: AgentSessionV3PilotShadowInputKind;
  label?: string | null;
  timestamp: number;
}): AgentSessionV3PilotShadowInputEntry {
  return {
    event: options.event,
    kind: options.kind,
    label: options.label ?? null,
    timestamp: options.timestamp,
  };
}

export function createAgentSessionV3PilotShadowInputCollector(
  options: AgentSessionV3PilotShadowInputCollectorOptions = {},
): AgentSessionV3PilotShadowInputCollector {
  const entries: AgentSessionV3PilotShadowInputEntry[] = [];
  const now = options.now ?? (() => Date.now());

  function appendEntry(
    event: AgentSessionV3PilotEvent,
    kind: AgentSessionV3PilotShadowInputKind,
    appendOptions: AgentSessionV3PilotShadowInputAppendOptions = {},
  ) {
    const entry = createAgentSessionV3PilotShadowInputEntry({
      event,
      kind,
      label: appendOptions.label,
      timestamp: now(),
    });
    entries.push(entry);
    return entry;
  }

  return {
    appendApprovalDecision: (approval) => appendEntry({
      reason: approval.reason ?? null,
      type: approval.approved ? 'approval-granted' : 'approval-denied',
    }, 'approval-decision', approval),
    appendCommandUnavailable: (reason, appendOptions) => appendEntry(
      createAgentSessionV3PilotCommandUnavailableEvent(reason),
      'command-unavailable',
      appendOptions,
    ),
    appendEvaluationRecovery: (reason, appendOptions) => appendEntry(
      createAgentSessionV3PilotEvaluationRecoveryEvent(reason),
      'evaluation-recovery',
      appendOptions,
    ),
    appendEvent: (event, appendOptions = {}) => appendEntry(
      event,
      appendOptions.kind ?? 'raw-event',
      appendOptions,
    ),
    appendModelDecisionTurn: (outcome, appendOptions) => appendEntry(
      createAgentSessionV3PilotEventFromModelDecisionTurn(outcome),
      'model-decision-turn',
      appendOptions,
    ),
    appendParallelToolExecutionTransaction: (transaction, appendOptions) => appendEntry(
      createAgentSessionV3PilotEventFromParallelToolExecutionTransaction(transaction),
      'parallel-tool-transaction',
      appendOptions,
    ),
    appendPendingApprovalAssembly: (assembly, appendOptions) => appendEntry(
      createAgentSessionV3PilotEventFromPendingApprovalAssembly(assembly, {
        source: appendOptions?.preparationSource ?? undefined,
      }),
      'pending-approval',
      appendOptions,
    ),
    appendPostActionTerminalEvaluation: (evaluation, appendOptions) => {
      const event = createAgentSessionV3PilotEventFromPostActionTerminalEvaluation(evaluation);
      if (!event) {
        return null;
      }

      return appendEntry(event, 'post-action-terminal', appendOptions);
    },
    appendPreparedCommand: (prepared) => appendEntry(
      createAgentSessionV3PilotEventFromPreparedCommand({
        reason: prepared.reason,
        route: prepared.route,
        source: prepared.preparationSource ?? undefined,
      }),
      'prepared-command',
      prepared,
    ),
    appendRecoveryExhausted: (reason, appendOptions) => appendEntry(
      createAgentSessionV3PilotRecoveryExhaustedEvent(reason),
      'recovery-exhausted',
      appendOptions,
    ),
    appendRecoveryModelRequested: (reason, appendOptions) => appendEntry({
      reason: reason ?? null,
      type: 'recovery-model-requested',
    }, 'recovery-model-requested', appendOptions),
    appendStart: (reason, appendOptions) => appendEntry({
      reason: reason ?? null,
      type: 'start',
    }, 'start', appendOptions),
    appendToolExecutionTransaction: (transaction, appendOptions) => appendEntry(
      createAgentSessionV3PilotEventFromToolExecutionTransaction(transaction),
      'tool-transaction',
      appendOptions,
    ),
    clear: () => {
      entries.length = 0;
    },
    getEntries: () => entries.slice(),
    getEvents: () => entries.map((entry) => entry.event),
    snapshot: () => ({
      entries: entries.slice(),
      events: entries.map((entry) => entry.event),
    }),
  };
}
