import {
  type AgentDesktopActionEvidence,
  type AgentStructuredToolEvidence,
} from '../agentChatCommand';
import {
  type AgentRuntimeToolResultEntry,
  type AgentTaskRuntimeStateRecord,
} from './agentRuntimeContract';
import {
  createAgentRuntimeActionId,
  createAgentRuntimeEvidenceEnvelope,
  createAgentRuntimeEvidenceId,
  type AgentRuntimeActionReceipt,
  type AgentRuntimeEvidenceEnvelope,
  type AgentRuntimeEvidenceKind,
  type AgentRuntimeOperationSurface,
  type AgentRuntimeVerificationResult,
} from './agentRuntimeTaskContract';
import {
  getStructuredEvidence,
  getToolName,
  isTargetBindingRefreshEntry,
  resolveTargetBinding,
  resolveAgentRuntimeOperationSurface,
} from './taskEvidence/operationSurfaceIdentity';
export { resolveAgentRuntimeOperationSurface } from './taskEvidence/operationSurfaceIdentity';

function getActionEvidence(entry: AgentRuntimeToolResultEntry) {
  return entry.result.stateSummary?.actionEvidence
    ?? entry.result.receipt?.stateSummary?.actionEvidence
    ?? null;
}

function stableEvidenceJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableEvidenceJson).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableEvidenceJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function getStableEvidenceSourceId(entry: AgentRuntimeToolResultEntry) {
  const toolName = getToolName(entry);
  const input = entry.command.toolCall?.input ?? null;
  const transactionId = entry.timing?.id?.trim() || '';
  const serializedInput = stableEvidenceJson(input);
  let hash = 2166136261;
  for (let index = 0; index < serializedInput.length; index += 1) {
    hash ^= serializedInput.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${toolName}-${transactionId || 'legacy'}-${(hash >>> 0).toString(16)}`;
}

function resolveEvidenceKind(
  structuredEvidence: AgentStructuredToolEvidence | null,
  actionEvidence: AgentDesktopActionEvidence | null,
): AgentRuntimeEvidenceKind {
  if (actionEvidence) {
    return 'input';
  }
  if (structuredEvidence?.uiAutomationAvailable === true) {
    return 'uia';
  }
  if (structuredEvidence?.captureAvailable === true || structuredEvidence?.visualReadable === true) {
    return 'visual';
  }
  if (structuredEvidence?.finalWindow || structuredEvidence?.windowPresent != null) {
    return 'window';
  }
  if (structuredEvidence?.processPresent != null) {
    return 'process';
  }
  return 'system';
}

function resolveToolEvidenceCapturedAt(
  entry: AgentRuntimeToolResultEntry,
  now?: number,
) {
  const structuredEvidence = getStructuredEvidence(entry);
  const actionEvidence = getActionEvidence(entry);
  const candidates = [
    actionEvidence?.timestamp,
    structuredEvidence?.observationCapturedAt,
    entry.timing?.endedAt,
    now,
  ];
  return candidates.find((value) => (
    typeof value === 'number'
      && Number.isFinite(value)
      && value > 0
  ));
}

function resolveStableToolEvidenceCapturedAt(entry: AgentRuntimeToolResultEntry) {
  const structuredEvidence = getStructuredEvidence(entry);
  const actionEvidence = getActionEvidence(entry);
  const candidates = [
    actionEvidence?.timestamp,
    structuredEvidence?.observationCapturedAt,
    entry.timing?.endedAt,
  ];
  return candidates.find((value) => (
    typeof value === 'number'
      && Number.isFinite(value)
      && value > 0
  ));
}

function resolveEvidenceConfidence(
  structuredEvidence: AgentStructuredToolEvidence | null,
  actionEvidence: AgentDesktopActionEvidence | null,
) {
  if (typeof actionEvidence?.confidence === 'number') {
    return actionEvidence.confidence;
  }
  if (structuredEvidence?.confidence === 'high') {
    return 0.9;
  }
  if (structuredEvidence?.confidence === 'medium') {
    return 0.7;
  }
  if (structuredEvidence?.confidence === 'low') {
    return 0.4;
  }
  return null;
}

export function createAgentRuntimeToolEvidenceEnvelope(options: {
  entry: AgentRuntimeToolResultEntry;
  now?: number;
  surface?: AgentRuntimeOperationSurface | null;
  taskId: string;
}): AgentRuntimeEvidenceEnvelope {
  const structuredEvidence = getStructuredEvidence(options.entry);
  const actionEvidence = getActionEvidence(options.entry);
  const capturedAt = resolveToolEvidenceCapturedAt(options.entry, options.now);
  return createAgentRuntimeEvidenceEnvelope({
    capturedAt,
    confidence: resolveEvidenceConfidence(structuredEvidence, actionEvidence),
    kind: resolveEvidenceKind(structuredEvidence, actionEvidence),
    payload: {
      actionEvidence,
      structuredEvidence,
      verificationEvidence: options.entry.result.stateSummary?.verificationEvidence
        ?? options.entry.result.receipt?.stateSummary?.verificationEvidence
        ?? [],
    },
    sourceId: getStableEvidenceSourceId(options.entry),
    surface: options.surface,
    taskId: options.taskId,
  });
}

function createActionReceipt(options: {
  entry: AgentRuntimeToolResultEntry;
  evidence: AgentRuntimeEvidenceEnvelope;
  runId: string;
  surface: AgentRuntimeOperationSurface | null;
}): AgentRuntimeActionReceipt | null {
  const actionEvidence = getActionEvidence(options.entry);
  if (!actionEvidence) {
    return null;
  }
  const startedAt = options.entry.timing?.startedAt ?? actionEvidence.timestamp;
  const completedAt = options.entry.timing?.endedAt ?? actionEvidence.timestamp;
  const status = options.entry.result.ok === false
    || options.entry.result.receipt?.status === 'failed'
    || options.entry.result.receipt?.status === 'blocked'
    || actionEvidence.outcome === 'blocked'
    ? 'failed' as const
    : actionEvidence.outcome === 'changed'
      ? 'executed' as const
      : 'uncertain' as const;
  return {
    actionId: createAgentRuntimeActionId({
      runId: options.runId,
      startedAt,
      tool: actionEvidence.tool,
      toolCallId: options.entry.timing?.id,
      inputFingerprint: getStableEvidenceSourceId(options.entry),
    }),
    completedAt,
    executionEvidenceRefs: [options.evidence.evidenceId],
    inputSummary: {
      action: actionEvidence.action ?? null,
      target: actionEvidence.targetRef ?? null,
      tool: actionEvidence.tool,
    },
    startedAt,
    status,
    surfaceGeneration: options.surface?.generation ?? null,
    surfaceId: options.surface?.surfaceId ?? null,
    toolCallId: options.entry.timing?.id ?? null,
  };
}

function createVerificationResult(options: {
  entry: AgentRuntimeToolResultEntry;
  evidence: AgentRuntimeEvidenceEnvelope;
}): AgentRuntimeVerificationResult | null {
  const assessment = options.entry.result.assessment;
  if (!assessment) {
    return null;
  }
  const status = assessment.status === 'completed'
    ? 'verified_success' as const
    : assessment.status === 'failed'
      ? 'verified_failure' as const
      : assessment.status === 'needs-user'
        ? 'needs_user' as const
        : assessment.status === 'can-continue'
          ? 'needs_recovery' as const
          : 'uncertain' as const;
  return {
    evidenceRefs: [options.evidence.evidenceId],
    expectedPostconditions: [],
    matchedPostconditions: options.entry.result.stateSummary?.verificationEvidence ?? [],
    missingPostconditions: options.entry.result.stateSummary?.missingEvidence ?? [],
    reasonCode: `tool-assessment-${assessment.status}`,
    status,
  };
}

export function appendAgentRuntimeToolEvidence(options: {
  entries: AgentRuntimeToolResultEntry[];
  now?: number;
  state: AgentTaskRuntimeStateRecord;
}): AgentTaskRuntimeStateRecord {
  let surface = options.state.surface ?? null;
  const evidenceById = new Map((options.state.evidence ?? []).map((item) => [item.evidenceId, item]));
  const completedActions = [...(options.state.completedActions ?? [])];
  let verification = options.state.verification ?? null;
  let targetBinding = options.state.targetBinding ?? null;

  for (const entry of options.entries) {
    if (entry.timing?.status === 'deduped') {
      // A parallel coverage result is presentation-only. The covering
      // transaction owns the actual evidence and must be aggregated once.
      continue;
    }
    const structuredEvidence = getStructuredEvidence(entry);
    const actionEvidence = getActionEvidence(entry);
    const isStaleFallback = structuredEvidence?.observationFreshness === 'stale-fallback';
    const capturedAt = resolveStableToolEvidenceCapturedAt(entry);
    const kind = resolveEvidenceKind(structuredEvidence, actionEvidence);
    const existingEvidenceId = capturedAt
      ? createAgentRuntimeEvidenceId({
          capturedAt,
          kind,
          sourceId: getStableEvidenceSourceId(entry),
          taskId: options.state.taskId,
        })
      : null;
    if (existingEvidenceId && evidenceById.has(existingEvidenceId)) {
      continue;
    }
    const nextSurface = isStaleFallback
      ? surface
      : resolveAgentRuntimeOperationSurface({ entry, now: options.now, previous: surface });
    const surfaceReplaced = Boolean(
      surface
      && nextSurface
      && (
        surface.surfaceId !== nextSurface.surfaceId
        || surface.generation !== nextSurface.generation
      ),
    );
    surface = nextSurface;
    if (
      !isStaleFallback
      && (
        surfaceReplaced
        || surface?.presence === 'absent'
        || surface?.presence === 'present_unreadable'
        || surface?.presence === 'starting'
      )
    ) {
      targetBinding = null;
      verification = null;
    }
    const evidence = createAgentRuntimeToolEvidenceEnvelope({
      entry,
      now: options.now,
      surface,
      taskId: options.state.taskId,
    });
    evidenceById.set(evidence.evidenceId, evidence);
    if (structuredEvidence && !isStaleFallback) {
      const resolvedTargetBinding = resolveTargetBinding({
        actionEvidence,
        entry,
        evidence,
        structuredEvidence,
        surface,
      });
      if (resolvedTargetBinding) {
        targetBinding = resolvedTargetBinding;
      } else if (isTargetBindingRefreshEntry(entry, structuredEvidence)) {
        targetBinding = null;
      }
    }
    const receipt = isStaleFallback ? null : createActionReceipt({
      entry,
      evidence,
      runId: options.state.runId ?? options.state.taskId,
      surface,
    });
    if (receipt && !completedActions.some((item) => item.actionId === receipt.actionId)) {
      completedActions.push(receipt);
    }
    if (!isStaleFallback) {
      verification = createVerificationResult({ entry, evidence }) ?? verification;
    }
  }

  const evidence = [...evidenceById.values()];
  if (surface) {
    surface = {
      ...surface,
      evidenceRefs: evidence
        .filter((item) => item.surfaceId === surface?.surfaceId && item.surfaceGeneration === surface?.generation)
        .map((item) => item.evidenceId),
    };
  }
  return {
    ...options.state,
    activeAction: null,
    completedActions,
    evidence,
    surface,
    targetBinding,
    verification,
  };
}
