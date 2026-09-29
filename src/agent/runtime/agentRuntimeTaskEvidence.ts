import {
  type AgentDesktopActionEvidence,
  type AgentStructuredToolEvidence,
  type AgentStructuredToolWindowEvidence,
} from '../agentChatCommand';
import {
  type AgentRuntimeToolResultEntry,
  type AgentTaskRuntimeStateRecord,
} from './agentRuntimeContract';
import {
  createAgentRuntimeActionId,
  createAgentRuntimeEvidenceEnvelope,
  createAgentRuntimeEvidenceId,
  createAgentRuntimeOperationSurface,
  createAgentRuntimeSurfaceId,
  type AgentRuntimeActionReceipt,
  type AgentRuntimeEvidenceEnvelope,
  type AgentRuntimeEvidenceKind,
  type AgentRuntimeOperationSurface,
  type AgentRuntimeOperationSurfacePresence,
  type AgentRuntimeOperationSurfaceProfile,
  type AgentRuntimeTargetBinding,
  type AgentRuntimeVerificationResult,
} from './agentRuntimeTaskContract';
import { resolveAgentTargetInteractionVerification } from './agentRuntimeVerificationEvidence';

function getStructuredEvidence(entry: AgentRuntimeToolResultEntry) {
  return entry.result.stateSummary?.structuredEvidence
    ?? entry.result.receipt?.stateSummary?.structuredEvidence
    ?? null;
}

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

function getToolName(entry: AgentRuntimeToolResultEntry) {
  return entry.command.toolCall?.name ?? entry.command.kind;
}

function resolveSurfaceWindow(evidence: AgentStructuredToolEvidence | null) {
  return evidence?.finalWindow
    ?? evidence?.targetCandidates?.find((candidate) => candidate.window)?.window
    ?? evidence?.actionCandidates?.find((candidate) => candidate.window)?.window
    ?? null;
}

function hasSameSurfaceOwner(
  surface: AgentRuntimeOperationSurface,
  window: AgentStructuredToolWindowEvidence,
) {
  if (surface.owner.hwnd && window.hwnd) {
    return surface.owner.hwnd === window.hwnd
      && (!surface.owner.pid || !window.pid || surface.owner.pid === window.pid);
  }
  if (surface.owner.pid && window.pid) {
    return surface.owner.pid === window.pid
      && (!surface.owner.windowTitle || !window.title || surface.owner.windowTitle === window.title);
  }
  return Boolean(
    surface.owner.processName
    && window.processName
    && surface.owner.processName === window.processName
    && (!surface.owner.windowTitle || !window.title || surface.owner.windowTitle === window.title),
  );
}

function resolveSurfacePresence(
  evidence: AgentStructuredToolEvidence,
  previous: AgentRuntimeOperationSurface | null,
): AgentRuntimeOperationSurfacePresence {
  if (evidence.desktopTargetPresence === 'absent') {
    return 'absent';
  }
  if (evidence.desktopTargetPresence === 'present_interactable' || evidence.interactionReady === true) {
    return 'present_interactable';
  }
  if (evidence.desktopTargetPresence === 'present_unreadable') {
    return 'present_unreadable';
  }
  if (evidence.processPresent === true && evidence.windowPresent === false) {
    return 'starting';
  }
  if (evidence.processPresent === true || evidence.windowPresent === true) {
    return evidence.captureAvailable === true || evidence.uiAutomationAvailable === true || evidence.visualReadable === true
      ? 'present_interactable'
      : 'present_unreadable';
  }
  if (evidence.processPresent === false && evidence.windowPresent === false) {
    return 'absent';
  }
  return previous?.presence ?? 'starting';
}

function resolveSurfaceProfile(
  evidence: AgentStructuredToolEvidence,
  inheritedProfile: AgentRuntimeOperationSurfaceProfile | null,
) {
  const profile = evidence.appExecutionProfile ?? 'unknown';
  return profile === 'unknown' && inheritedProfile
    ? inheritedProfile
    : profile as AgentRuntimeOperationSurfaceProfile;
}

function hasExplicitTargetQuery(entry: AgentRuntimeToolResultEntry) {
  const input = entry.command.toolCall?.input ?? {};
  return [
    input.targetText,
    input.targetDescription,
    input.query,
    input.sourceQuery,
    input.windowQuery,
    input.windowTitle,
  ].some((value) => typeof value === 'string' && value.trim());
}

function isTargetBindingRefreshEntry(entry: AgentRuntimeToolResultEntry, evidence: AgentStructuredToolEvidence) {
  const toolName = getToolName(entry);
  return toolName === 'locate_screen_elements'
    || toolName === 'summarize_visual_snapshot'
    || Boolean(
      evidence.targetMatched
      || evidence.primaryAction
      || evidence.visualActionReadiness
      || evidence.actionCandidates?.length
      || evidence.targetCandidates?.length
      || hasExplicitTargetQuery(entry),
    );
}

function resolveTargetBinding(options: {
  actionEvidence?: AgentDesktopActionEvidence | null;
  entry: AgentRuntimeToolResultEntry;
  evidence: AgentRuntimeEvidenceEnvelope;
  structuredEvidence: AgentStructuredToolEvidence;
  surface: AgentRuntimeOperationSurface | null;
}): AgentRuntimeTargetBinding | null {
  if (!options.surface) {
    return null;
  }
  const verification = resolveAgentTargetInteractionVerification(options.structuredEvidence);
  const readiness = options.structuredEvidence.visualActionReadiness;
  const targetIsActionable = readiness === 'ready'
    || verification?.status === 'ready'
    || Boolean(options.actionEvidence?.targetRef);
  // A window query identifies the operation surface, not an actionable
  // control. Keep window identity resolution separate from control binding.
  if (!targetIsActionable) {
    return null;
  }
  const candidate = [
    ...(options.structuredEvidence.actionCandidates ?? []),
    ...(options.structuredEvidence.targetCandidates ?? []),
  ].find((item) => item.label?.trim() || item.name?.trim()) ?? null;
  const label = options.actionEvidence?.targetRef?.label?.trim()
    || verification?.targetMatched?.trim()
    || options.structuredEvidence.targetMatched?.trim()
    || candidate?.label?.trim()
    || candidate?.name?.trim()
    || '';
  if (!label) {
    return null;
  }
  return {
    confidence: options.actionEvidence?.targetRef?.confidence
      ?? candidate?.confidence
      ?? options.structuredEvidence.confidence
      ?? null,
    evidenceRefs: [options.evidence.evidenceId],
    label,
    stableId: options.actionEvidence?.targetRef?.stableId ?? candidate?.automationId ?? null,
    surfaceGeneration: options.surface.generation,
    surfaceId: options.surface.surfaceId,
  };
}

export function resolveAgentRuntimeOperationSurface(options: {
  entry: AgentRuntimeToolResultEntry;
  now?: number;
  previous?: AgentRuntimeOperationSurface | null;
}): AgentRuntimeOperationSurface | null {
  const evidence = getStructuredEvidence(options.entry);
  if (!evidence) {
    return options.previous ?? null;
  }
  const previous = options.previous ?? null;
  const window = resolveSurfaceWindow(evidence);
  const owner = window
    ? {
        hwnd: window.hwnd ?? null,
        pid: window.pid ?? null,
        processName: window.processName ?? null,
        windowTitle: window.title ?? null,
      }
    : previous?.owner ?? {};
  const ownerChanged = Boolean(previous && window && !hasSameSurfaceOwner(previous, window));
  const surfaceReappeared = Boolean(
    previous
    && window
    && previous.presence === 'absent',
  );
  const surfaceReplaced = ownerChanged || surfaceReappeared;
  const generation = surfaceReplaced ? previous!.generation + 1 : previous?.generation ?? 0;
  const now = options.now ?? options.entry.timing?.endedAt ?? Date.now();
  const surfaceId = surfaceReplaced || !previous
    ? createAgentRuntimeSurfaceId(owner, now)
    : previous.surfaceId;
  const presence = resolveSurfacePresence(evidence, previous);
  const inheritedCapabilities = ownerChanged ? null : previous?.capabilities ?? null;
  return createAgentRuntimeOperationSurface({
    capabilities: {
      desktopInput: presence === 'present_interactable'
        && (evidence.interactionReady === true || inheritedCapabilities?.desktopInput === true),
      screenRegionCapture: evidence.captureSourceType === 'screen' || inheritedCapabilities?.screenRegionCapture === true,
      uia: evidence.uiAutomationAvailable === true || inheritedCapabilities?.uia === true,
      windowCapture: evidence.captureSourceType === 'window'
        || evidence.captureAvailable === true
        || inheritedCapabilities?.windowCapture === true,
    },
    generation,
    now,
    owner,
    presence,
    profile: resolveSurfaceProfile(
      evidence,
      ownerChanged ? null : previous?.profile ?? null,
    ),
    surfaceId,
  });
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
