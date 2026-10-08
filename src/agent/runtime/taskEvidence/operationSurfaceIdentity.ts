import { type AgentDesktopActionEvidence, type AgentStructuredToolEvidence, type AgentStructuredToolWindowEvidence } from '../../agentChatCommand';
import { type AgentRuntimeToolResultEntry } from '../agentRuntimeContract';
import {
  createAgentRuntimeOperationSurface,
  createAgentRuntimeSurfaceId,
  type AgentRuntimeEvidenceEnvelope,
  type AgentRuntimeOperationSurface,
  type AgentRuntimeOperationSurfacePresence,
  type AgentRuntimeOperationSurfaceProfile,
  type AgentRuntimeTargetBinding,
} from '../agentRuntimeTaskContract';
import { resolveAgentTargetInteractionVerification } from '../agentRuntimeVerificationEvidence';

export function getStructuredEvidence(entry: AgentRuntimeToolResultEntry) {
  return entry.result.stateSummary?.structuredEvidence
    ?? entry.result.receipt?.stateSummary?.structuredEvidence
    ?? null;
}

export function getToolName(entry: AgentRuntimeToolResultEntry) {
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

export function isTargetBindingRefreshEntry(entry: AgentRuntimeToolResultEntry, evidence: AgentStructuredToolEvidence) {
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

export function resolveTargetBinding(options: {
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
