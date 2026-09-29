import { type AgentChatCommand } from './agentChatCommand';
import {
  type AgentRuntimeToolResultEntry as AgentSessionV2ToolResultEntry,
} from './runtime/agentRuntimeContract';
import { type AgentEvidenceTerminalOutcome } from './runtime/agentEvidenceEngine';

export type AgentActionRuntimeStatus =
  | 'completed'
  | 'waiting'
  | 'needs-approval'
  | 'needs-recovery'
  | 'failed'
  | 'blocked'
  | 'uncertain';

export type AgentActionRuntimeReason =
  | 'terminal-completed'
  | 'terminal-needs-user'
  | 'post-action-loading'
  | 'post-action-waiting-window'
  | 'missing-requested-coverage'
  | 'read-only-observation-only'
  | 'tool-failed'
  | 'no-latest-evidence'
  | 'insufficient-evidence';

export interface AgentActionRuntimeMissingCoverage {
  attemptedCoverage: Set<string>;
  missingCoverage: string[];
  requestedCoverage: Set<string>;
}

export interface AgentActionRuntimeDecision {
  actionAttempted?: boolean;
  missingCoverage?: AgentActionRuntimeMissingCoverage | null;
  postActionState: string;
  reason: AgentActionRuntimeReason;
  status: AgentActionRuntimeStatus;
  terminalEvaluation?: AgentEvidenceTerminalOutcome | null;
}

export type AgentActionRuntimeEventSource =
  | 'approved-tool-result'
  | 'post-action-terminal'
  | 'post-approval-verification'
  | 'in-app-target-locate'
  | 'auto-recovery'
  | 'unknown';

export interface AgentActionInstance {
  createdAt: number;
  entries: Array<{
    postActionState: string;
    reason: AgentActionRuntimeReason;
    source: AgentActionRuntimeEventSource;
    status: AgentActionRuntimeStatus;
    toolName?: string | null;
  }>;
  id: string;
  latestReason: AgentActionRuntimeReason;
  latestSource: AgentActionRuntimeEventSource;
  postActionState: string;
  status: AgentActionRuntimeStatus;
  updatedAt: number;
}

export interface AgentActionRuntimeQueue {
  currentAction: AgentActionInstance | null;
}

export interface AgentActionRuntimeDependencies {
  createAttemptedActionCoverage: (toolResults: AgentSessionV2ToolResultEntry[]) => Set<string>;
  createRequestedActionCoverage: (options: {
    sourceText: string;
    userGoal: string;
  }) => Set<string>;
  hasDirectActionIntent: (sourceText: string, userGoal: string) => boolean;
  evaluateTerminal: (options: {
    latestEntry: AgentSessionV2ToolResultEntry | null;
    sourceText: string;
    toolResults: AgentSessionV2ToolResultEntry[];
    userGoal: string;
  }) => AgentEvidenceTerminalOutcome | null;
  isActionKindCovered: (kind: string, attemptedCoverage: Set<string>) => boolean;
  isBlockedFinalWithEvidence?: (() => boolean) | null;
  isReadOnlyToolResult: (entry: AgentSessionV2ToolResultEntry) => boolean;
  resolvePostActionState: (options: {
    entry: AgentSessionV2ToolResultEntry | null;
    sourceText: string;
    userGoal: string;
  }) => string;
}

function findAgentActionRuntimeMissingCoverage(options: {
  dependencies: AgentActionRuntimeDependencies;
  sourceText: string;
  toolResults: AgentSessionV2ToolResultEntry[];
  userGoal: string;
}): AgentActionRuntimeMissingCoverage | null {
  const requestedCoverage = options.dependencies.createRequestedActionCoverage({
    sourceText: options.sourceText,
    userGoal: options.userGoal,
  });
  if (!requestedCoverage.size) {
    return null;
  }

  const attemptedCoverage = options.dependencies.createAttemptedActionCoverage(options.toolResults);
  const missingCoverage = [...requestedCoverage].filter((kind) => (
    !options.dependencies.isActionKindCovered(kind, attemptedCoverage)
  ));
  if (!missingCoverage.length) {
    return null;
  }

  return {
    attemptedCoverage,
    missingCoverage,
    requestedCoverage,
  };
}

function hasOnlyReadOnlyObservationEvidence(options: {
  dependencies: AgentActionRuntimeDependencies;
  toolResults: AgentSessionV2ToolResultEntry[];
}) {
  if (!options.toolResults.length) {
    return false;
  }

  const attemptedCoverage = options.dependencies.createAttemptedActionCoverage(options.toolResults);
  return attemptedCoverage.size === 0
    && !options.toolResults.some((entry) => ['list_agent_skills', 'execute_agent_skill'].includes(entry.command.toolCall?.name ?? ''))
    && options.toolResults.every(options.dependencies.isReadOnlyToolResult);
}

function getAgentActionRuntimeToolName(entry: AgentSessionV2ToolResultEntry | null) {
  return entry?.command.toolCall?.name ?? entry?.command.kind ?? null;
}

export function createAgentActionInstance(options: {
  decision: AgentActionRuntimeDecision;
  latestEntry?: AgentSessionV2ToolResultEntry | null;
  now?: number;
  source: AgentActionRuntimeEventSource;
}): AgentActionInstance {
  const now = options.now ?? Date.now();
  const toolName = getAgentActionRuntimeToolName(options.latestEntry ?? null);
  return {
    createdAt: now,
    entries: [{
      postActionState: options.decision.postActionState,
      reason: options.decision.reason,
      source: options.source,
      status: options.decision.status,
      toolName,
    }],
    id: `action-${now}`,
    latestReason: options.decision.reason,
    latestSource: options.source,
    postActionState: options.decision.postActionState,
    status: options.decision.status,
    updatedAt: now,
  };
}

export function updateAgentActionInstance(options: {
  currentAction: AgentActionInstance | null;
  decision: AgentActionRuntimeDecision;
  latestEntry?: AgentSessionV2ToolResultEntry | null;
  now?: number;
  source: AgentActionRuntimeEventSource;
}): AgentActionInstance {
  if (!options.currentAction) {
    return createAgentActionInstance(options);
  }

  const now = options.now ?? Date.now();
  const toolName = getAgentActionRuntimeToolName(options.latestEntry ?? null);
  return {
    ...options.currentAction,
    entries: [
      ...options.currentAction.entries,
      {
        postActionState: options.decision.postActionState,
        reason: options.decision.reason,
        source: options.source,
        status: options.decision.status,
        toolName,
      },
    ],
    latestReason: options.decision.reason,
    latestSource: options.source,
    postActionState: options.decision.postActionState,
    status: options.decision.status,
    updatedAt: now,
  };
}

export function updateAgentActionRuntimeQueue(options: {
  decision: AgentActionRuntimeDecision;
  latestEntry?: AgentSessionV2ToolResultEntry | null;
  queue: AgentActionRuntimeQueue;
  source: AgentActionRuntimeEventSource;
}) {
  return {
    currentAction: updateAgentActionInstance({
      currentAction: options.queue.currentAction,
      decision: options.decision,
      latestEntry: options.latestEntry,
      source: options.source,
    }),
  };
}

export function evaluateAgentActionRuntime(options: {
  dependencies: AgentActionRuntimeDependencies;
  latestEntry: AgentSessionV2ToolResultEntry | null;
  sourceText: string;
  toolResults: AgentSessionV2ToolResultEntry[];
  userGoal: string;
}): AgentActionRuntimeDecision {
  const {
    dependencies,
    latestEntry,
    sourceText,
    toolResults,
    userGoal,
  } = options;
  const postActionState = dependencies.resolvePostActionState({
    entry: latestEntry,
    sourceText,
    userGoal,
  });

  if (!latestEntry) {
    return {
      actionAttempted: false,
      postActionState,
      reason: 'no-latest-evidence',
      status: 'uncertain',
    };
  }

  const hasDirectActionIntent = dependencies.hasDirectActionIntent(sourceText, userGoal)
    && !dependencies.isBlockedFinalWithEvidence?.();
  const missingCoverage = hasDirectActionIntent
    ? findAgentActionRuntimeMissingCoverage({
        dependencies,
        sourceText,
        toolResults,
        userGoal,
      })
    : null;
  const actionAttempted = hasDirectActionIntent
    ? !missingCoverage || [...missingCoverage.requestedCoverage].some((kind) => (
        dependencies.isActionKindCovered(kind, missingCoverage.attemptedCoverage)
      ))
    : false;

  if (latestEntry.result.ok === false) {
    return {
      actionAttempted,
      postActionState,
      reason: 'tool-failed',
      status: 'failed',
    };
  }

  if (missingCoverage && !actionAttempted) {
    return {
      actionAttempted: false,
      missingCoverage,
      postActionState,
      reason: 'missing-requested-coverage',
      status: 'uncertain',
    };
  }

  const terminalEvaluation = dependencies.evaluateTerminal({
    latestEntry,
    sourceText,
    toolResults,
    userGoal,
  });
  if (
    terminalEvaluation
    && (terminalEvaluation.status === 'needs-user' || !missingCoverage)
  ) {
    return {
      actionAttempted,
      postActionState: terminalEvaluation.postActionState || postActionState,
      reason: terminalEvaluation.status === 'completed'
        ? 'terminal-completed'
        : 'terminal-needs-user',
      status: terminalEvaluation.status === 'completed' ? 'completed' : 'blocked',
      terminalEvaluation,
    };
  }

  if (postActionState === 'loading' || postActionState === 'updating') {
    return {
      actionAttempted,
      postActionState,
      reason: 'post-action-loading',
      status: 'waiting',
    };
  }

  if (postActionState === 'waiting_window') {
    return {
      actionAttempted,
      postActionState,
      reason: 'post-action-waiting-window',
      status: 'waiting',
    };
  }

  if (postActionState === 'waiting_target') {
    return {
      actionAttempted,
      postActionState,
      reason: 'post-action-waiting-window',
      status: 'waiting',
    };
  }

  if (
    hasDirectActionIntent
  ) {
    if (missingCoverage) {
      return {
        actionAttempted,
        missingCoverage,
        postActionState,
        reason: 'missing-requested-coverage',
        status: 'needs-recovery',
      };
    }

  }

  if (
    !hasDirectActionIntent
    && hasOnlyReadOnlyObservationEvidence({ dependencies, toolResults })
  ) {
    return {
      actionAttempted,
      postActionState,
      reason: 'terminal-completed',
      status: 'completed',
    };
  }

  return {
    actionAttempted,
    postActionState,
    reason: 'insufficient-evidence',
    status: 'uncertain',
  };
}
