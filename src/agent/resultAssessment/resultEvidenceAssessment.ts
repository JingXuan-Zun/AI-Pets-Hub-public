import {
  resolveAgentCommandToolName,
  isAgentReadOnlyObservationForDirectActionRequest,
  hasAgentReadOnlyObservationActionCompletionEvidence,
  createAgentReadOnlyActionCompletionMissingEvidence,
  createAgentReadOnlyActionCompletionRecovery,
} from './readOnlyObservationCompletion';
export {
  isAgentReadOnlyObservationForDirectActionRequest,
  hasAgentReadOnlyObservationActionCompletionEvidence,
} from './readOnlyObservationCompletion';

import {
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentStructuredToolEvidence,
  type AgentToolStateSummary,
} from '../agentChatCommand';
import {
  buildAgentPermissionRoute,
} from '../agentPermissionRouter';
import {
  getAgentToolLifecycleMetadata,
} from '../agentToolRegistry';
import {
  isAgentReadOnlyObservationForVisualLocateRequest,
} from '../agentReadOnlyActionCompletionEvidence';
export function resolveAgentResultFollowUpActions(result: AgentChatCommandResult) {
  return result.followUpActions?.length
    ? result.followUpActions
    : result.followUpAction
      ? [result.followUpAction]
      : [];
}

function compactAgentResultText(value: string | null | undefined, maxLength = 900) {
  const normalizedValue = value?.replace(/\s+/gu, ' ').trim() ?? '';
  if (normalizedValue.length <= maxLength) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, Math.max(0, maxLength - 3))}...`;
}

export function compactAgentAssessmentEvidence(lines: Array<string | null | undefined>) {
  const seen = new Set<string>();
  return lines
    .map((line) => line?.trim() ?? '')
    .filter(Boolean)
    .filter((line) => {
      if (seen.has(line)) {
        return false;
      }

      seen.add(line);
      return true;
    })
    .slice(0, 6);
}

export function getAgentResultStructuredEvidenceRecord(result: AgentChatCommandResult): Record<string, unknown> | null {
  const evidence = result.stateSummary?.structuredEvidence ?? result.receipt?.stateSummary?.structuredEvidence;
  return evidence && typeof evidence === 'object' && !Array.isArray(evidence)
    ? evidence as Record<string, unknown>
    : null;
}

export function collectAgentResultAssessmentText(result: AgentChatCommandResult) {
  return [
    result.responseText,
    result.verification,
    result.receipt?.verification,
    ...(result.observations ?? []),
    ...(result.stateSummary?.observedState ?? []),
    ...(result.stateSummary?.verificationEvidence ?? []),
    ...(result.stateSummary?.missingEvidence ?? []),
    ...(result.stateSummary?.recommendedRecovery ?? []),
    ...(result.receipt?.evidenceLines ?? []),
    ...(result.receipt?.summaryLines ?? []),
  ].filter(Boolean).join('\n').normalize('NFKC');
}

export function getAgentResultPostActionState(result: AgentChatCommandResult) {
  const record = getAgentResultStructuredEvidenceRecord(result);
  const explicit = typeof record?.postActionState === 'string'
    ? record.postActionState.trim().toLowerCase()
    : '';
  if (explicit) {
    return explicit;
  }

  const text = collectAgentResultAssessmentText(result).toLowerCase();
  const match = text.match(/post-action\s+(?:visual\s+)?state\s*:\s*([a-z_]+)/iu);
  return match?.[1]?.trim().toLowerCase() ?? '';
}

export function getAgentResultActionLifecycleStatus(result: AgentChatCommandResult) {
  const record = getAgentResultStructuredEvidenceRecord(result);
  const lifecycle = record?.actionLifecycle && typeof record.actionLifecycle === 'object'
    ? record.actionLifecycle as Record<string, unknown>
    : null;
  return typeof lifecycle?.status === 'string'
    ? lifecycle.status.trim().toLowerCase()
    : '';
}

export function getAgentResultStructuredEvidence(result: AgentChatCommandResult): AgentStructuredToolEvidence | null {
  return result.stateSummary?.structuredEvidence ?? result.receipt?.stateSummary?.structuredEvidence ?? null;
}

function compactAgentToolStateItems(
  lines: Array<string | null | undefined>,
  options: {
    maxItems?: number;
    maxLength?: number;
  } = {},
) {
  const maxItems = options.maxItems ?? 8;
  const maxLength = options.maxLength ?? 220;
  const seen = new Set<string>();

  return lines
    .map((line) => compactAgentResultText(line, maxLength))
    .filter(Boolean)
    .filter((line) => {
      if (seen.has(line)) {
        return false;
      }

      seen.add(line);
      return true;
    })
    .slice(0, maxItems);
}

function createOptionalAgentToolStateItems(lines: Array<string | null | undefined>) {
  const items = compactAgentToolStateItems(lines);
  return items.length ? items : undefined;
}

export function hasAgentResultEvidence(result: AgentChatCommandResult) {
  return Boolean(
    result.verification
    || result.receipt?.verification
    || result.receipt?.status === 'success'
    || result.receipt?.evidenceLines?.length
    || result.observations?.length
    || result.stateSummary?.observedState?.length
    || result.stateSummary?.verificationEvidence?.length
    || result.receipt?.stateSummary?.observedState?.length
    || result.receipt?.stateSummary?.verificationEvidence?.length,
  );
}

function resolveAgentToolStateSummaryStatus(
  command: AgentChatCommand,
  result: AgentChatCommandResult,
) {
  if (result.assessment?.status) {
    return result.assessment.status;
  }

  if (result.ok === false) {
    return 'failed';
  }

  if (result.receipt?.status === 'failed' || result.receipt?.status === 'blocked') {
    return 'failed';
  }

  if (result.receipt?.status === 'unverified') {
    return 'unverified';
  }

  if (
    (isAgentReadOnlyObservationForDirectActionRequest(command)
      || isAgentReadOnlyObservationForVisualLocateRequest(command))
    && !hasAgentReadOnlyObservationActionCompletionEvidence(result)
  ) {
    return 'unverified';
  }

  return hasAgentResultEvidence(result) ? 'completed' : 'unverified';
}

function didAgentCommandMutateState(command: AgentChatCommand, result: AgentChatCommandResult) {
  if (result.ok === false || !hasAgentResultEvidence(result)) {
    return false;
  }

  const route = buildAgentPermissionRoute(command);
  return Boolean(route.plan?.steps.some((step) => (
    step.decision.allowed
    && (
      step.action.risk === 'reversible-write'
      || step.action.risk === 'launch'
      || step.action.risk === 'destructive'
    )
  )));
}

export function createAgentToolStateSummary(
  command: AgentChatCommand,
  result: AgentChatCommandResult,
): AgentToolStateSummary | null {
  const toolName = resolveAgentCommandToolName(command);
  const lifecycle = toolName ? getAgentToolLifecycleMetadata(toolName) : null;
  const existing = result.stateSummary ?? {};
  const receiptState = result.receipt?.stateSummary ?? {};
  const hasExplicitObservedState = Boolean(
    existing.observedState?.length
    || receiptState.observedState?.length
    || result.observations?.length
    || result.receipt?.evidenceLines?.length,
  );
  const observedState = createOptionalAgentToolStateItems([
    ...(existing.observedState ?? []),
    ...(receiptState.observedState ?? []),
    ...(result.observations ?? []),
    ...(result.receipt?.evidenceLines ?? []),
    !hasExplicitObservedState ? result.responseText : null,
  ]);
  const verificationEvidence = createOptionalAgentToolStateItems([
    ...(existing.verificationEvidence ?? []),
    ...(receiptState.verificationEvidence ?? []),
    result.verification,
    result.receipt?.verification,
    result.receipt?.status ? `receipt-status:${result.receipt.status}` : null,
  ]);
  const changedState = createOptionalAgentToolStateItems([
    ...(existing.changedState ?? []),
    ...(receiptState.changedState ?? []),
    ...(lifecycle && didAgentCommandMutateState(command, {
      ...result,
      stateSummary: {
        ...existing,
        observedState,
        verificationEvidence,
      },
    })
      ? lifecycle.mutates
      : []),
  ]);
  const status = resolveAgentToolStateSummaryStatus(command, {
    ...result,
    stateSummary: {
      ...existing,
      changedState,
      observedState,
      verificationEvidence,
    },
  });
  const shouldRecommendRecovery = status === 'failed'
    || status === 'needs-user'
    || status === 'unverified'
    || result.ok === false;
  const missingEvidence = createOptionalAgentToolStateItems([
    ...(existing.missingEvidence ?? []),
    ...(receiptState.missingEvidence ?? []),
    ...createAgentReadOnlyActionCompletionMissingEvidence(command, result),
    ...(lifecycle && shouldRecommendRecovery && (status === 'unverified' || !verificationEvidence?.length)
      ? lifecycle.verifies.map((item) => `missing:${item}`)
      : []),
    ...(!lifecycle && shouldRecommendRecovery && !verificationEvidence?.length
      ? ['missing:verification-evidence']
      : []),
    ...(!lifecycle && result.ok === false
      ? ['missing:successful-tool-result']
      : []),
  ]);
  const recommendedRecovery = createOptionalAgentToolStateItems([
    ...(existing.recommendedRecovery ?? []),
    ...(receiptState.recommendedRecovery ?? []),
    ...createAgentReadOnlyActionCompletionRecovery(command, result),
    ...(lifecycle && shouldRecommendRecovery
      ? lifecycle.recoversWith.map((name) => `tool:${name}`)
      : []),
    ...(!lifecycle && shouldRecommendRecovery && result.followUp
      ? [`follow-up:${result.followUp}`]
      : []),
  ]);
  const summary: AgentToolStateSummary = {
    actionEvidence: existing.actionEvidence ?? receiptState.actionEvidence ?? null,
    changedState,
    missingEvidence,
    observedState,
    recommendedRecovery,
    structuredEvidence: existing.structuredEvidence ?? receiptState.structuredEvidence ?? null,
    verificationEvidence,
  };
  const hasSummary = Object.values(summary).some((items) => (
    Array.isArray(items) ? items.length > 0 : Boolean(items)
  ));

  return hasSummary ? summary : null;
}
