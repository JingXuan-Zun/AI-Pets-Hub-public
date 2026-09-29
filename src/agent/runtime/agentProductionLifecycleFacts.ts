import {
  type AgentChatCommand,
} from '../agentChatCommand';
import {
  type AgentRuntimeToolResultEntry,
} from './agentRuntimeContract';
import {
  hasAgentRuntimeCommittedDesktopDispatch,
  hasAgentRuntimeCommittedInputDispatch,
  hasAgentRuntimeInputDispatch,
} from './agentDispatchEvidence';

export type AgentRuntimeLifecycleFactKind =
  | 'action-dispatched'
  | 'outcome-verified'
  | 'outer-dispatch';

export interface AgentRuntimeLifecycleFact {
  kind: AgentRuntimeLifecycleFactKind;
  target?: string | null;
  tool?: string | null;
}

function normalizeLifecycleTarget(value: unknown) {
  return typeof value === 'string'
    ? value.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim()
    : '';
}

function getLifecycleTarget(command: AgentChatCommand) {
  const input = command.toolCall?.input ?? {};
  const candidates = [
    input.postVerifyVisualQuery,
    input.postVerifyQuery,
    input.verifyQuery,
    command.toolCall?.actionScope?.targetRef,
    input.sourceQuery,
    input.windowQuery,
    input.targetText,
    input.target,
    input.query,
    input.name,
    input.title,
  ];
  return candidates.find((candidate) => normalizeLifecycleTarget(candidate))?.toString().trim() ?? null;
}

function areLifecycleTargetsCompatible(
  dispatchedTarget: string | null,
  verificationTarget: string | null,
) {
  const dispatched = normalizeLifecycleTarget(dispatchedTarget);
  const verification = normalizeLifecycleTarget(verificationTarget);
  if (!dispatched) {
    return true;
  }
  if (!verification) {
    return false;
  }
  return dispatched.includes(verification) || verification.includes(dispatched);
}

function getPostActionState(entry: AgentRuntimeToolResultEntry) {
  const structuredEvidence = entry.result.stateSummary?.structuredEvidence
    ?? entry.result.receipt?.stateSummary?.structuredEvidence;
  return typeof structuredEvidence?.postActionState === 'string'
    ? structuredEvidence.postActionState.trim().toLowerCase()
    : '';
}

function hasVerifiedOutcome(options: {
  entry: AgentRuntimeToolResultEntry;
  isPostApprovalVerificationCommand: (command: AgentChatCommand) => boolean;
}) {
  if (
    !options.isPostApprovalVerificationCommand(options.entry.command)
    || options.entry.result.ok === false
    || options.entry.result.assessment?.status !== 'completed'
    || options.entry.result.receipt?.status === 'unverified'
    || options.entry.result.receipt?.status === 'failed'
    || options.entry.result.receipt?.status === 'blocked'
  ) {
    return false;
  }

  const successfulState = new Set(['completed', 'launched', 'opened', 'succeeded']);
  return successfulState.has(getPostActionState(options.entry))
    || Boolean(options.entry.result.stateSummary?.verificationEvidence?.length)
    || Boolean(options.entry.result.receipt?.stateSummary?.verificationEvidence?.length);
}

export function collectAgentRuntimeLifecycleFacts(options: {
  entries: AgentRuntimeToolResultEntry[];
  isPostApprovalVerificationCommand: (command: AgentChatCommand) => boolean;
}): AgentRuntimeLifecycleFact[] {
  const facts: AgentRuntimeLifecycleFact[] = [];
  let hasCurrentInputDispatch = false;
  let latestInputDispatchTarget: string | null = null;
  for (const entry of options.entries) {
    const tool = entry.command.toolCall?.name ?? entry.command.kind;
    const target = getLifecycleTarget(entry.command);
    const isInputCommand = hasAgentRuntimeInputDispatch(entry.command);
    const isCommittedInput = hasAgentRuntimeCommittedInputDispatch(entry.command, entry.result);
    const isCommittedDesktop = hasAgentRuntimeCommittedDesktopDispatch(entry.command, entry.result);
    if (isInputCommand) {
      // A new input attempt supersedes the previous action, even when the
      // backend rejects it or returns an unverified/no-op result.
      hasCurrentInputDispatch = false;
      latestInputDispatchTarget = null;
    }
    if (isCommittedInput) {
      facts.push({ kind: 'action-dispatched', target, tool });
      hasCurrentInputDispatch = true;
      latestInputDispatchTarget = target;
    } else if (isCommittedDesktop) {
      facts.push({ kind: 'outer-dispatch', target, tool });
      hasCurrentInputDispatch = false;
      latestInputDispatchTarget = null;
    }
    if (
      hasCurrentInputDispatch
      && areLifecycleTargetsCompatible(latestInputDispatchTarget, target)
      && hasVerifiedOutcome({
        entry,
        isPostApprovalVerificationCommand: options.isPostApprovalVerificationCommand,
      })
    ) {
      facts.push({ kind: 'outcome-verified', target, tool });
    }
  }
  return facts;
}

export function hasAgentRuntimeLifecycleFact(
  facts: AgentRuntimeLifecycleFact[],
  kind: AgentRuntimeLifecycleFactKind,
) {
  return facts.some((fact) => fact.kind === kind);
}
