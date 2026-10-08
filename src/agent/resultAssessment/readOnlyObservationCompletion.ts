import { type AgentChatCommand, type AgentChatCommandResult } from '../agentChatCommand';
import { isAgentReadOnlyObservationForVisualLocateRequest } from '../agentReadOnlyActionCompletionEvidence';
import { hasAgentEffectiveDirectActionIntent } from '../runtime/agentActionCoverage';

export function resolveAgentCommandToolName(command: AgentChatCommand) {
  if (command.toolCall?.name) {
    return command.toolCall.name;
  }

  if (command.kind === 'app-launch') {
    return 'launch_local_app';
  }

  if (command.kind === 'app-alias-save') {
    return 'remember_local_app';
  }

  if (command.kind === 'desktop-organization') {
    return 'organize_desktop_icons';
  }

  if (command.kind === 'desktop-icon-placement') {
    return 'place_desktop_icon';
  }

  return null;
}

function normalizeAgentAssessmentSearchText(value: unknown) {
  return typeof value === 'string'
    ? value.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim()
    : '';
}

function isAgentReadonlyObservationTool(command: AgentChatCommand) {
  const toolName = resolveAgentCommandToolName(command);
  if (
    toolName === 'observe_windows_and_apps'
    || toolName === 'list_running_apps'
    || toolName === 'get_active_window_info'
    || toolName === 'get_display_info'
    || toolName === 'locate_screen_elements'
    || toolName === 'execute_memory_action'
  ) {
    return true;
  }

  if (toolName === 'execute_desktop_observation') {
    return true;
  }

  if (toolName === 'execute_desktop_action') {
    const action = normalizeAgentAssessmentSearchText(command.toolCall?.input.action);
    return action === 'list_running_apps'
      || action === 'get_active_window_info'
      || action === 'get_default_app_for_uri';
  }

  return false;
}

export function isAgentReadOnlyObservationForDirectActionRequest(command: AgentChatCommand) {
  if (!isAgentReadonlyObservationTool(command)) {
    return false;
  }

  const text = normalizeAgentAssessmentSearchText([
    command.sourceText,
    command.instruction,
    command.toolCall?.goal,
  ].filter(Boolean).join(' '));
  if (!text) {
    return false;
  }

  const hasActionIntent = hasAgentEffectiveDirectActionIntent(
    command.sourceText ?? '',
    [command.instruction, command.toolCall?.goal].filter(Boolean).join(' '),
  );
  const hasReadOnlyIntent = /(?:what|which|list|show|check|observe|inspect|find|search|where|status|\u4ec0\u4e48|\u54ea(?:\u4e2a|\u4e9b)|\u5217\u51fa|\u663e\u793a|\u67e5(?:\u770b|\u8be2)|\u89c2\u5bdf|\u68c0\u67e5|\u627e(?:\u5230|\u4e00\u4e0b)?|\u641c\u7d22|\u72b6\u6001)/iu.test(text);

  return hasActionIntent && !(
    hasReadOnlyIntent
    && !/(?:open|launch|start|run|focus|move|click|type|select|invoke|control|close|organize|arrange|\u6253\u5f00|\u542f\u52a8|\u8fd0\u884c|\u805a\u7126|\u79fb\u52a8|\u70b9\u51fb|\u8f93\u5165|\u9009\u62e9|\u6267\u884c|\u63a7\u5236|\u5173\u95ed|\u6574\u7406)/iu.test(text)
  );
}

function splitAgentAssessmentSearchTokens(value: string | null | undefined) {
  return normalizeAgentAssessmentSearchText(value)
    .split(/[^a-z0-9\u4e00-\u9fff]+/iu)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function hasAgentAssessmentTokenOverlap(left: string | null | undefined, right: string | null | undefined) {
  const leftTokens = splitAgentAssessmentSearchTokens(left);
  const rightTokens = splitAgentAssessmentSearchTokens(right);
  if (!leftTokens.length || !rightTokens.length) {
    return false;
  }

  return leftTokens.some((leftToken) => (
    rightTokens.some((rightToken) => leftToken.includes(rightToken) || rightToken.includes(leftToken))
  ));
}

function getAgentAssessmentRequestedTargetText(result: AgentChatCommandResult) {
  const record = result.stateSummary?.structuredEvidence && typeof result.stateSummary.structuredEvidence === 'object'
    ? result.stateSummary.structuredEvidence as Record<string, unknown>
    : null;
  const queryFromObservedState = [
    ...(result.observations ?? []),
    ...(result.stateSummary?.observedState ?? []),
    ...(result.receipt?.evidenceLines ?? []),
  ].map((line) => /Windows\/apps query:\s*(.+)$/iu.exec(line)?.[1]?.trim() ?? '')
    .find(Boolean);
  const requestedTarget = [
    record?.requestedTarget,
    record?.query,
    queryFromObservedState,
  ].find((value) => typeof value === 'string' && value.trim());

  return typeof requestedTarget === 'string'
    ? requestedTarget.trim()
    : typeof record?.targetMatched === 'string'
      ? record.targetMatched.trim()
      : '';
}

function hasAgentReadOnlyObservationTargetMatch(result: AgentChatCommandResult) {
  const structuredEvidence = result.stateSummary?.structuredEvidence;
  if (!structuredEvidence || typeof structuredEvidence !== 'object' || Array.isArray(structuredEvidence)) {
    return false;
  }

  const record = structuredEvidence as Record<string, unknown>;
  const requestedTarget = getAgentAssessmentRequestedTargetText(result);
  const directTargetText = [
    record.targetMatched,
    record.selectedTarget,
    record.currentTarget,
    typeof record.finalWindow === 'object' && record.finalWindow
      ? [
          (record.finalWindow as Record<string, unknown>).title,
          (record.finalWindow as Record<string, unknown>).processName,
        ].filter(Boolean).join(' ')
      : null,
    typeof record.targetWindow === 'object' && record.targetWindow
      ? [
          (record.targetWindow as Record<string, unknown>).title,
          (record.targetWindow as Record<string, unknown>).processName,
        ].filter(Boolean).join(' ')
      : null,
  ].filter(Boolean).join(' ');
  if (hasAgentAssessmentTokenOverlap(requestedTarget, directTargetText)) {
    return true;
  }

  const candidates = Array.isArray(record.targetCandidates) ? record.targetCandidates : [];
  return candidates.some((candidate) => {
    if (!candidate || typeof candidate !== 'object') {
      return false;
    }

    const candidateRecord = candidate as Record<string, unknown>;
    const candidateText = [
      candidateRecord.label,
      candidateRecord.name,
      candidateRecord.description,
      typeof candidateRecord.window === 'object' && candidateRecord.window
        ? [
            (candidateRecord.window as Record<string, unknown>).title,
            (candidateRecord.window as Record<string, unknown>).processName,
          ].filter(Boolean).join(' ')
        : null,
    ].filter(Boolean).join(' ');
    return hasAgentAssessmentTokenOverlap(requestedTarget, candidateText);
  });
}

export function hasAgentReadOnlyObservationActionCompletionEvidence(result: AgentChatCommandResult) {
  const structuredEvidence = result.stateSummary?.structuredEvidence;
  if (structuredEvidence && typeof structuredEvidence === 'object' && !Array.isArray(structuredEvidence)) {
    const record = structuredEvidence as Record<string, unknown>;
    const statusText = normalizeAgentAssessmentSearchText([
      record.status,
      record.postActionState,
      result.assessment?.status,
      result.receipt?.status,
    ].filter(Boolean).join(' '));
    if (!/(?:failed|failure|error|unverified|blocked|unknown|visible[-\s]?only|mismatch)/iu.test(statusText)) {
      if (hasAgentReadOnlyObservationTargetMatch(result)) {
        return true;
      }

      if ((record.targetWindow || record.windowMatched) && getAgentAssessmentRequestedTargetText(result)) {
        return true;
      }

      if (/(?:satisfied|completed|launched|running|open|opened|focused|verified)/iu.test(statusText)) {
        const targetText = normalizeAgentAssessmentSearchText([
          record.targetMatched,
          record.selectedTarget,
          record.currentTarget,
        ].filter(Boolean).join(' '));
        if (targetText && hasAgentReadOnlyObservationTargetMatch(result)) {
          return true;
        }
      }
    }
  }

  const evidenceText = normalizeAgentAssessmentSearchText([
    result.responseText,
    result.verification,
    result.receipt?.verification,
    ...(result.observations ?? []),
    ...(result.stateSummary?.observedState ?? []),
    ...(result.stateSummary?.verificationEvidence ?? []),
    ...(result.receipt?.evidenceLines ?? []),
  ].filter(Boolean).join(' '));
  if (!evidenceText) {
    return false;
  }

  if (/(?:running\s*=\s*0|no-window-match|no\s+(?:running|focusable|matching)\s+window|not\s+(?:running|open|launched|verified)|unverified|missing\s+(?:window|evidence|target))/iu.test(evidenceText)) {
    return false;
  }

  return Boolean(
    getAgentAssessmentRequestedTargetText(result)
    && hasAgentReadOnlyObservationTargetMatch(result)
    && /(?:running\s+(?:window|app)|final\s+window|matched\s+window|window\s+matched|target\s+(?:is\s+)?(?:running|open|opened|launched|focused|verified)|observed\s+.+\s+as\s+(?:a\s+)?(?:running|active|open))/iu.test(evidenceText)
  );
}

export function createAgentReadOnlyActionCompletionMissingEvidence(command: AgentChatCommand, result: AgentChatCommandResult) {
  return (
    isAgentReadOnlyObservationForDirectActionRequest(command)
      || isAgentReadOnlyObservationForVisualLocateRequest(command)
  )
    && !hasAgentReadOnlyObservationActionCompletionEvidence(result)
    ? [
        'missing:action-completion-evidence',
        isAgentReadOnlyObservationForVisualLocateRequest(command)
          ? 'missing:visual-element-location-evidence'
          : 'missing:target-window-or-running-app-evidence',
      ]
    : [];
}

export function createAgentReadOnlyActionCompletionRecovery(command: AgentChatCommand, result: AgentChatCommandResult) {
  if (!hasAgentReadOnlyObservationActionCompletionEvidence(result)) {
    if (isAgentReadOnlyObservationForVisualLocateRequest(command)) {
      return [
        'tool:locate_screen_elements',
        'tool:summarize_visual_snapshot',
        'tool:list_capture_sources',
        'tool:get_active_window_info',
      ];
    }

    if (isAgentReadOnlyObservationForDirectActionRequest(command)) {
      return [
          'tool:observe_windows_and_apps',
          'tool:execute_desktop_action',
          'tool:execute_desktop_sequence',
          'tool:locate_screen_elements',
        ];
    }
  }

  return [];
}
