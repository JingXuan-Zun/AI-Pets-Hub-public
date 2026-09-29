import {
  type AgentChatCommand,
  type AgentStructuredToolCandidateEvidence,
} from '../agentChatCommand';
import { getAgentStructuredEvidence } from './agentPlanningSignalEvidence';
import { type AgentRuntimeToolResultEntry } from './agentRuntimeContract';
import {
  AGENT_RUNTIME_POST_ACTION_VERIFICATION_MARKER,
  isAgentRuntimePostActionVerificationCommand,
} from './agentVerificationRuntime';

export const AGENT_POST_APPROVAL_VERIFICATION_MARKER = AGENT_RUNTIME_POST_ACTION_VERIFICATION_MARKER;

function getAgentToolInputAction(command: AgentChatCommand) {
  const action = command.toolCall?.input.action;
  return typeof action === 'string' ? action.trim() : '';
}

const AGENT_DISPLAY_INFO_ACTION_PATTERN = /^(?:get_display_info|display_info|screen_info|list_displays)$/iu;

function hasPositiveDisplayCount(entry: AgentRuntimeToolResultEntry) {
  const evidenceText = [
    ...(entry.result.observations ?? []),
    ...(entry.result.receipt?.evidenceLines ?? []),
    entry.result.verification,
    entry.result.responseText,
  ].filter((value): value is string => typeof value === 'string' && Boolean(value.trim())).join('\n');
  const countMatch = evidenceText.match(/\bDisplay observations:\s*(\d+)\b/iu);
  return Boolean(countMatch && Number(countMatch[1]) > 0);
}

function normalizeAgentPredicateSearchText(value: unknown) {
  return typeof value === 'string'
    ? value.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim()
    : '';
}

function getAgentPredicateCandidateSearchText(candidate: AgentStructuredToolCandidateEvidence) {
  return [
    candidate.label,
    candidate.name,
    candidate.description,
    candidate.controlType,
    candidate.automationId,
    candidate.region,
  ].map(normalizeAgentPredicateSearchText).filter(Boolean).join(' ');
}

export function isAgentPostApprovalVerificationCommand(command: AgentChatCommand) {
  return isAgentRuntimePostActionVerificationCommand(command);
}

export function hasAgentPostApprovalVerificationRun(toolResults: AgentRuntimeToolResultEntry[]) {
  return toolResults.some((entry) => isAgentPostApprovalVerificationCommand(entry.command));
}

export function hasAgentDisplayObservationEvidence(entry: AgentRuntimeToolResultEntry) {
  if (entry.result.ok === false) return false;

  const toolName = entry.command.toolCall?.name ?? '';
  const action = getAgentToolInputAction(entry.command);
  if (toolName === 'get_display_info') {
    return true;
  }
  if (
    toolName === 'execute_desktop_observation'
    && AGENT_DISPLAY_INFO_ACTION_PATTERN.test(action)
  ) {
    return true;
  }
  if (toolName !== 'observe_windows_and_apps') {
    return false;
  }

  const includeDisplays = entry.command.toolCall?.input.includeDisplays;
  return includeDisplays !== false && hasPositiveDisplayCount(entry);
}

export function isAgentVerifiedTargetWindowObservation(entry: AgentRuntimeToolResultEntry) {
  if (entry.result.ok === false) return false;

  const toolName = entry.command.toolCall?.name ?? null;
  if (
    toolName !== 'observe_windows_and_apps'
    && toolName !== 'execute_desktop_action'
    && toolName !== 'execute_desktop_sequence'
  ) {
    return false;
  }

  const structuredEvidence = getAgentStructuredEvidence(entry);
  if (structuredEvidence?.observationFreshness === 'stale-fallback') return false;
  const finalWindow = structuredEvidence?.finalWindow;
  if (!finalWindow) return false;

  const authoritativeStatusText = normalizeAgentPredicateSearchText([
    structuredEvidence.status,
    entry.result.receipt?.status,
  ].filter(Boolean).join(' '));
  if (/(?:failed|failure|error|unverified|blocked)/u.test(authoritativeStatusText)) return false;

  const assessmentStatus = normalizeAgentPredicateSearchText(entry.result.assessment?.status);
  if (/(?:failed|failure|error|blocked|needs user)/u.test(assessmentStatus)) return false;
  const hasSuccessfulStructuredStatus = /(?:success|satisfied|completed|ok)/u.test(authoritativeStatusText);

  const windowParts = [
    finalWindow.processName,
    finalWindow.title,
  ].map(normalizeAgentPredicateSearchText).filter((value) => value.length >= 2);
  if (!windowParts.length) return false;

  const targetTexts = [
    structuredEvidence.targetMatched,
    entry.command.toolCall.input?.query,
    entry.command.toolCall.input?.target,
    entry.command.toolCall.input?.name,
    entry.command.toolCall.input?.title,
    entry.command.toolCall.input?.processName,
  ].map(normalizeAgentPredicateSearchText).filter((value) => value.length >= 2);

  const actionText = normalizeAgentPredicateSearchText([
    entry.command.toolCall.input?.action,
    entry.command.toolCall.input?.operation,
  ].filter(Boolean).join(' '));
  const actionOnlyTargets = new Set(['app', 'browser', 'window', 'resource']);
  const nonGenericTargetTexts = targetTexts.filter((target) => !actionOnlyTargets.has(target));

  const candidateText = [
    ...(structuredEvidence.targetCandidates ?? []).map(getAgentPredicateCandidateSearchText),
    ...(entry.result.stateSummary?.verificationEvidence ?? []),
    ...(entry.result.receipt?.evidenceLines ?? []),
    ...(entry.result.observations ?? []),
    entry.result.verification,
    entry.result.responseText,
  ].map(normalizeAgentPredicateSearchText).filter(Boolean).join(' ');

  const windowHasEvidence = windowParts.some((part) => candidateText.includes(part))
    || (
      toolName !== 'observe_windows_and_apps'
      && hasSuccessfulStructuredStatus
      && Boolean(finalWindow.processName || finalWindow.title)
    );
  if (!windowHasEvidence) return false;
  if (!nonGenericTargetTexts.length) return true;

  if (
    (actionText.includes('launch') || actionText.includes('focus') || actionText.includes('open'))
    && structuredEvidence.status
    && normalizeAgentPredicateSearchText(structuredEvidence.status).includes('success')
  ) {
    return true;
  }

  return nonGenericTargetTexts.some((target) => (
    windowParts.some((part) => part.includes(target) || target.includes(part))
    || candidateText.includes(target)
  ));
}
