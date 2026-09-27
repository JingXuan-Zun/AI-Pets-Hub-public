import { type AgentChatCommand } from '../agentChatCommand';
import { type AgentRuntimeToolResultEntry } from './agentRuntimeContract';

export type AgentEvidenceTerminalStatus = 'completed' | 'needs-user' | 'insufficient';

export interface AgentEvidenceTerminalEvaluation {
  postActionState: string;
  reason: string;
  status: AgentEvidenceTerminalStatus;
  verified: boolean;
}

export interface AgentEvidenceTerminalOutcome {
  finalAnswer: string;
  historyReason?: string;
  kind: 'blocked-manual-gate' | 'completed' | 'launched' | 'login-required';
  postActionState: string;
  status: 'completed' | 'needs-user';
  stepAction: 'ask_user' | 'final_answer';
  stepReason: string;
}

export interface AgentEvidencePostActionStateResolverDependencies {
  collectAutoRecoveryEvidenceText: (entry: AgentRuntimeToolResultEntry) => string;
  hasDirectActionIntent: (sourceText: string, userGoal: string) => boolean;
  isActionResultTool: (command: AgentChatCommand) => boolean;
  isAutoRecoveryCommand: (command: AgentChatCommand) => boolean;
  isPostApprovalVerificationCommand: (command: AgentChatCommand) => boolean;
  isRecoverableUnverifiedToolResult: (entry: AgentRuntimeToolResultEntry) => boolean;
}

export interface AgentEvidenceTerminalEvaluatorDependencies {
  collectAutoRecoveryEvidenceText: (entry: AgentRuntimeToolResultEntry) => string;
  createAttemptedActionCoverage: (toolResults: AgentRuntimeToolResultEntry[]) => Set<string>;
  createRequestedActionCoverage: (options: {
    sourceText: string;
    userGoal: string;
  }) => Set<string>;
  getPostActionState: (entry: AgentRuntimeToolResultEntry | null) => string;
  hasDirectActionIntent: (sourceText: string, userGoal: string) => boolean;
  inferSelectionPostActionState: (entry: AgentRuntimeToolResultEntry) => string;
  isActionResultTool: (command: AgentChatCommand) => boolean;
  isAutoRecoveryReadCommand: (command: AgentChatCommand) => boolean;
  isAutoRecoveryWaitCommand: (command: AgentChatCommand) => boolean;
  isInAppActionCovered: (attemptedCoverage: Set<string>) => boolean;
  isPostApprovalVerificationCommand: (command: AgentChatCommand) => boolean;
  isVerifiedTargetWindowObservation: (entry: AgentRuntimeToolResultEntry) => boolean;
  resolveRecoveryPostActionState: (options: {
    entry: AgentRuntimeToolResultEntry | null;
    sourceText: string;
    userGoal: string;
  }) => string;
}

export interface EvaluateAgentEvidenceTerminalOptions {
  coverageComplete: boolean;
  directActionIntent: boolean;
  latestEntry: AgentRuntimeToolResultEntry | null;
  postActionState?: string | null;
  readOnlyOnly?: boolean | null;
  verifiedTargetState?: boolean | null;
}

const AGENT_EVIDENCE_SUCCESS_STATES = new Set([
  'completed',
  'launched',
  'opened',
  'succeeded',
]);

function hasAgentEvidenceExplicitUnverifiedSignal(
  entry: AgentRuntimeToolResultEntry,
  verifiedTargetState: boolean,
) {
  if (entry.result.receipt?.status === 'unverified') {
    return true;
  }

  return !verifiedTargetState && (
    entry.result.assessment?.status === 'unverified'
    || Boolean(entry.result.stateSummary?.missingEvidence?.length)
  );
}

function hasAgentEvidencePositiveVerification(entry: AgentRuntimeToolResultEntry) {
  const verificationText = entry.result.verification?.trim() ?? '';
  const explicitPositiveVerification = Boolean(verificationText)
    && !/(?:not\s+(?:confirmed|verified|visible|completed)|unconfirmed|unverified|insufficient|unknown|missing\s+evidence|no\s+(?:evidence|change|target|window)|\u672a(?:\u786e\u8ba4|\u9a8c\u8bc1|\u5b8c\u6210)|\u65e0(?:\u8bc1\u636e|\u53d8\u5316))/iu.test(verificationText);
  return explicitPositiveVerification
    || Boolean(entry.result.stateSummary?.verificationEvidence?.length)
    || Boolean(entry.result.receipt?.stateSummary?.verificationEvidence?.length);
}

function hasAgentDesktopSideEffectCommand(entry: AgentRuntimeToolResultEntry) {
  const toolName = entry.command.toolCall?.name ?? '';
  return toolName === 'execute_desktop_input'
    || toolName === 'execute_desktop_sequence'
    || toolName === 'execute_desktop_action';
}

function hasAgentActionChangeEvidence(entry: AgentRuntimeToolResultEntry) {
  const actionEvidence = entry.result.stateSummary?.actionEvidence
    ?? entry.result.receipt?.stateSummary?.actionEvidence
    ?? null;
  return typeof actionEvidence?.outcome === 'string'
    && actionEvidence.outcome.trim().toLowerCase() === 'changed';
}

function hasAgentEvidenceNonSuccessfulActionOutcome(
  entry: AgentRuntimeToolResultEntry,
  verifiedTargetState: boolean,
) {
  const actionEvidence = entry.result.stateSummary?.actionEvidence
    ?? entry.result.receipt?.stateSummary?.actionEvidence
    ?? null;
  const outcome = typeof actionEvidence?.outcome === 'string'
    ? actionEvidence.outcome.trim().toLowerCase()
    : '';
  if (outcome === 'blocked' || outcome === 'failed') {
    return true;
  }
  return !verifiedTargetState && (outcome === 'no-op' || outcome === 'uncertain');
}

export function resolveAgentEvidenceStructuredEvidence(
  entry: AgentRuntimeToolResultEntry | null,
) {
  return entry?.result.stateSummary?.structuredEvidence
    ?? entry?.result.receipt?.stateSummary?.structuredEvidence
    ?? null;
}

export function resolveAgentEvidencePostActionState(
  entry: AgentRuntimeToolResultEntry | null,
) {
  const state = resolveAgentEvidenceStructuredEvidence(entry)?.postActionState;
  return typeof state === 'string' ? state.trim().toLowerCase() : '';
}

export function evaluateAgentEvidenceTerminal(
  options: EvaluateAgentEvidenceTerminalOptions,
): AgentEvidenceTerminalEvaluation {
  const entry = options.latestEntry;
  const postActionState = options.postActionState?.trim().toLowerCase()
    || resolveAgentEvidencePostActionState(entry);

  if (!entry) {
    return {
      postActionState,
      reason: 'No tool receipt is available for terminal verification.',
      status: 'insufficient',
      verified: false,
    };
  }

  if (
    entry.result.ok === false
    || entry.result.receipt?.status === 'failed'
    || entry.result.receipt?.status === 'blocked'
    || entry.result.assessment?.status === 'failed'
    || entry.result.assessment?.status === 'needs-user'
  ) {
    return {
      postActionState,
      reason: 'The latest tool transaction failed or is blocked on user action.',
      status: 'needs-user',
      verified: false,
    };
  }

  if (options.directActionIntent && options.readOnlyOnly) {
    return {
      postActionState,
      reason: 'Read-only evidence cannot complete a side-effect task.',
      status: 'insufficient',
      verified: false,
    };
  }

  if (!options.coverageComplete) {
    return {
      postActionState,
      reason: 'Requested action coverage is incomplete.',
      status: 'insufficient',
      verified: false,
    };
  }

  if (hasAgentEvidenceExplicitUnverifiedSignal(entry, options.verifiedTargetState === true)) {
    return {
      postActionState,
      reason: 'The latest receipt explicitly reports an unverified outcome.',
      status: 'insufficient',
      verified: false,
    };
  }

  if (hasAgentEvidenceNonSuccessfulActionOutcome(entry, options.verifiedTargetState === true)) {
    return {
      postActionState,
      reason: 'The latest action evidence reports no verified successful outcome.',
      status: 'insufficient',
      verified: false,
    };
  }

  const successfulState = AGENT_EVIDENCE_SUCCESS_STATES.has(postActionState);
  if (
    options.directActionIntent
    && hasAgentDesktopSideEffectCommand(entry)
    && !options.verifiedTargetState
    && !successfulState
    && !hasAgentActionChangeEvidence(entry)
  ) {
    return {
      postActionState,
      reason: 'The desktop action receipt is successful, but no user-level outcome evidence is available yet.',
      status: 'insufficient',
      verified: false,
    };
  }

  const positiveVerification = options.verifiedTargetState === true
    || hasAgentEvidencePositiveVerification(entry);
  if (options.directActionIntent && !positiveVerification && !successfulState) {
    return {
      postActionState,
      reason: 'No verified target state or successful post-action state is available.',
      status: 'insufficient',
      verified: false,
    };
  }

  return {
    postActionState,
    reason: options.verifiedTargetState
      ? 'Verified target-state evidence satisfies the task.'
      : successfulState
        ? `Verified post-action state: ${postActionState}.`
        : 'The transaction receipt contains positive verification evidence.',
    status: 'completed',
    verified: true,
  };
}
