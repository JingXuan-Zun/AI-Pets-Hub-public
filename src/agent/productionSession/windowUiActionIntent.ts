import { type AgentStructuredToolCandidateEvidence, type AgentStructuredToolEvidence } from '../agentChatCommand';
import {
  getAgentVisualCandidateTextRelevanceScore as getAgentSessionV2CandidateTextRelevanceScore,
  isAgentVisualLauncherVerificationBlocking as isAgentSessionV2LauncherVerificationBlocking,
  isAgentVisualUsefulPrimaryAction as isAgentSessionV2UsefulPrimaryAction,
  hasAgentVisualVerifiedPrimaryActionOwnership as hasAgentSessionV2VerifiedPrimaryActionOwnership,
  hasAgentVisualCandidateTextOwnedActionEvidence as hasAgentSessionV2CandidateTextOwnedActionEvidence,
} from './visualCandidateEvidence';

const AGENT_PRODUCTION_UI_ACTION_PRIORITY = ['invoke', 'select', 'toggle', 'expand-collapse', 'focus', 'scroll-into-view', 'value'] as const;

function normalizeAgentProductionUiActionToken(value: unknown) {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[_\s]+/gu, '-')
    : '';
}

export function getAgentProductionCandidateUiActions(candidate: AgentStructuredToolCandidateEvidence) {
  const actions = Array.isArray(candidate.actions) ? candidate.actions : [];
  const normalizedActions = actions.map(normalizeAgentProductionUiActionToken);
  const actionText = [
    ...normalizedActions,
    candidate.description ?? '',
  ].join(' ').toLowerCase().replace(/[_\s]+/gu, '-');

  return AGENT_PRODUCTION_UI_ACTION_PRIORITY.filter((action) => (
    normalizedActions.includes(action)
    || new RegExp(`\\b${action.replace('-', '[-_]')}\\b`, 'iu').test(actionText)
  ));
}

export function isAgentProductionInvokableUiCandidate(candidate: AgentStructuredToolCandidateEvidence) {
  const actions = getAgentProductionCandidateUiActions(candidate);
  const canScrollIntoView = actions.includes('scroll-into-view');
  if (candidate.enabled === false || (candidate.offscreen === true && !canScrollIntoView)) {
    return false;
  }

  return actions.length > 0;
}

function isAgentProductionEditableUiCandidate(candidate: AgentStructuredToolCandidateEvidence) {
  return Boolean(
    candidate.actions?.some((action) => action.trim().toLowerCase() === 'value')
      || /(?:edit|textbox|text\s*box|input|search|combo\s*box|\u8f93\u5165|\u6587\u672c|\u641c\u7d22)/iu.test([
        candidate.controlType,
        candidate.label,
        candidate.description,
        candidate.name,
        candidate.region,
      ].filter(Boolean).join(' ')),
  );
}

export function inferAgentProductionWindowUiAction(
  candidate: AgentStructuredToolCandidateEvidence,
  evidence: AgentStructuredToolEvidence | null,
  sourceText = '',
  userGoal = '',
) {
  const actions = getAgentProductionCandidateUiActions(candidate);
  const intentText = [
    sourceText,
    userGoal,
    evidence?.primaryAction,
    evidence?.elementDescription,
    candidate.label,
    candidate.description,
    candidate.relation,
  ].filter(Boolean).join(' ').toLowerCase();
  if (/(?:select|choose|\u9009\u62e9|\u9009\u4e2d)/iu.test(intentText)) {
    return 'select';
  }
  if (/(?:toggle|check|uncheck|\u52fe\u9009|\u53d6\u6d88\u52fe\u9009|\u5207\u6362)/iu.test(intentText)) {
    return 'toggle';
  }
  if (/(?:expand|鐏炴洖绱?)/iu.test(intentText)) {
    return 'expand';
  }
  if (/(?:collapse|\u6536\u8d77|\u6298\u53e0)/iu.test(intentText)) {
    return 'collapse';
  }
  if (
    /(?:focus|set[_\s-]*focus|keyboard[_\s-]*focus|\u805a\u7126|\u7126\u70b9|\u9009\u4e2d\u540e|\u5148\u9009\u4e2d)/iu.test(intentText)
    && actions.includes('focus')
  ) {
    return 'focus';
  }
  if (
    /(?:scroll[_\s-]*into[_\s-]*view|scroll|\u6eda\u52a8|\u6eda\u5230|\u6ed1\u5230|\u663e\u793a\u51fa\u6765|\u79fb\u5230\u53ef\u89c1)/iu.test(intentText)
    && actions.includes('scroll-into-view')
  ) {
    return 'scroll_into_view';
  }
  if (
    /(?:set[_\s-]*value|typing|text\s*input|input\s*text|\u8f93\u5165|\u586b\u5199)/iu.test(intentText)
    && isAgentProductionEditableUiCandidate(candidate)
  ) {
    return 'set_value';
  }

  if (actions.includes('invoke')) {
    return 'invoke';
  }
  if (actions.includes('select')) {
    return 'select';
  }
  if (actions.includes('toggle')) {
    return 'toggle';
  }
  if (actions.includes('expand-collapse')) {
    return 'expand';
  }
  if (actions.includes('focus')) {
    return 'focus';
  }
  if (actions.includes('scroll-into-view')) {
    return 'scroll_into_view';
  }
  if (actions.includes('value')) {
    return 'set_value';
  }

  return 'auto';
}

function isAgentProductionLikelyUiFieldLabelValue(value: string) {
  const compactValue = value
    .normalize('NFKC')
    .replace(/[\s"'`.,;:!?()[\]{}<>_\-]+/gu, '')
    .toLowerCase();

  return Boolean(
    compactValue
      && (
        /^(?:box|field|input|textbox|textinput|searchbox|searchfield|edit|control)$/u.test(compactValue)
        || /^(?:\u6846|\u8f93\u5165\u6846|\u641c\u7d22\u6846|\u6587\u672c\u6846|\u7f16\u8f91\u6846|\u63a7\u4ef6)$/u.test(compactValue)
      ),
  );
}

export function extractAgentProductionWindowUiSetValueText(...values: string[]) {
  const text = values
    .filter((value) => typeof value === 'string' && value.trim())
    .join('\n')
    .normalize('NFKC');
  if (!text.trim()) {
    return '';
  }

  const quotedMatch = text.match(/(?:\u8f93\u5165|\u586b\u5199|\u586b\u5165|\u952e\u5165|\u8bbe\u7f6e\u4e3a|\u8bbe\u4e3a|\u6539\u6210|\u6539\u4e3a|enter|type|fill(?:[^\S\r\n]+in)?|set(?:[^\S\r\n]+(?:value|text))?[^\S\r\n]+to|change[^\S\r\n]+to)[^\n"'`]{0,40}["'`]([^"'`]{1,160})["'`]/iu);
  if (quotedMatch?.[1]?.trim()) {
    return quotedMatch[1].trim();
  }

  const plainMatch = text.match(/(?:\u8f93\u5165|\u586b\u5199|\u586b\u5165|\u952e\u5165)[^\S\r\n]*[:\uff1a][^\S\r\n]*([^\n,.;\uff0c\u3002\uff1b]{1,120})|(?:\u8bbe\u7f6e\u4e3a|\u8bbe\u4e3a|\u6539\u6210|\u6539\u4e3a)[^\S\r\n]*[:\uff1a][^\S\r\n]*([^\n,.;\uff0c\u3002\uff1b]{1,120})|(?:enter|type|fill(?:[^\S\r\n]+in)?|set(?:[^\S\r\n]+(?:value|text))?[^\S\r\n]+to|change[^\S\r\n]+to)[^\S\r\n]+([^\n.;]{1,120})/iu);
  const value = plainMatch?.[1] ?? plainMatch?.[2] ?? plainMatch?.[3] ?? '';
  const cleanedValue = value
    .replace(/(?:\u5230|\u8fdb\u5165|into|in)\s*(?:\u8f93\u5165\u6846|\u6587\u672c\u6846|\u641c\u7d22\u6846|field|textbox|input).*$/iu, '')
    .trim();
  if (
    !cleanedValue
    || isAgentProductionLikelyUiFieldLabelValue(cleanedValue)
    || /^(?:\u5230|\u8fdb\u5165)?\s*.*(?:\u8f93\u5165\u6846|\u6587\u672c\u6846|\u641c\u7d22\u6846|field|textbox|input)\s*$/iu.test(cleanedValue)
  ) {
    return '';
  }

  return cleanedValue;
}

export function isAgentProductionWindowUiSetValueIntentWithoutValue(options: {
  evidence: AgentStructuredToolEvidence | null;
  sourceText: string;
  userGoal: string;
}) {
  const intentText = [
    options.sourceText,
    options.userGoal,
    options.evidence?.primaryAction,
    options.evidence?.elementDescription,
    options.evidence?.elementRegion,
    options.evidence?.targetMatched,
  ].filter(Boolean).join(' ').normalize('NFKC').toLowerCase();
  if (!/(?:\u8f93\u5165|\u586b\u5199|\u586b\u5165|\u952e\u5165|\u8bbe\u7f6e\u4e3a|\u8bbe\u4e3a|\u6539\u6210|\u6539\u4e3a|enter|type|fill(?:\s+in)?|set(?:\s+(?:value|text))?\s+(?:to|in)|change\s+to)/iu.test(intentText)) {
    return false;
  }

  const candidates = [
    ...(options.evidence?.actionCandidates ?? []),
    ...(options.evidence?.targetCandidates ?? []),
  ];
  const hasEditableEvidence = candidates.some((candidate) => isAgentProductionEditableUiCandidate(candidate));
  if (!hasEditableEvidence) {
    return false;
  }

  return !extractAgentProductionWindowUiSetValueText(options.sourceText, options.userGoal);
}

export function hasAgentProductionWindowUiTextEntryIntent(...values: string[]) {
  const text = values
    .filter((value) => typeof value === 'string' && value.trim())
    .join('\n')
    .normalize('NFKC')
    .toLowerCase();
  return /(?:\u8f93\u5165|\u586b\u5199|\u586b\u5165|\u952e\u5165|\u641c\u7d22|enter|type|fill(?:\s+in)?|search|find)/iu.test(text);
}

export function inferAgentProductionKeyboardSubmitKey(...values: string[]) {
  const text = values
    .filter((value) => typeof value === 'string' && value.trim())
    .join('\n')
    .normalize('NFKC')
    .toLowerCase();
  if (/(?:space|\u7a7a\u683c)/iu.test(text)) {
    return 'Space';
  }
  if (/(?:enter|return|\u56de\u8f66|\u63d0\u4ea4|\u786e\u8ba4|\u641c\u7d22|\u67e5\u627e|\u6253\u5f00|\u542f\u52a8)/iu.test(text)) {
    return 'Enter';
  }

  return '';
}

export function hasAgentProductionClearInvokableUiCandidateEvidence(options: {
  candidate: AgentStructuredToolCandidateEvidence;
  evidence: AgentStructuredToolEvidence | null;
  sourceText: string;
  userGoal: string;
}) {
  if (!isAgentProductionInvokableUiCandidate(options.candidate)) {
    return false;
  }

  const readiness = options.evidence?.visualActionReadiness ?? null;
  if (readiness && readiness !== 'ready') {
    return false;
  }
  if (isAgentSessionV2LauncherVerificationBlocking(options.evidence)) {
    return false;
  }

  if (options.candidate.confidence === 'low' || options.evidence?.confidence === 'low') {
    return false;
  }

  const hasSelectorEvidence = Boolean(
    options.candidate.automationId?.trim()
      || options.candidate.name?.trim()
      || options.candidate.label?.trim()
      || options.candidate.controlType?.trim()
  );
  if (!hasSelectorEvidence) {
    return false;
  }

  const relevanceScore = getAgentSessionV2CandidateTextRelevanceScore({
    candidate: options.candidate,
    evidence: options.evidence,
    sourceText: options.sourceText,
    userGoal: options.userGoal,
  });
  const candidateActions = getAgentProductionCandidateUiActions(options.candidate);
  const hasTargetSelfActionEvidence = candidateActions.some((action) => (
    action === 'scroll-into-view'
    || action === 'focus'
    || action === 'select'
    || action === 'value'
  )) && (
    relevanceScore > 0
    || options.evidence?.targetMatched?.trim()
    || options.candidate.confidence === 'high'
  );
  return Boolean(
    relevanceScore > 0
      || options.evidence?.targetMatched?.trim()
      || isAgentSessionV2UsefulPrimaryAction(options.evidence?.primaryAction)
      || options.candidate.confidence === 'high'
  ) && (
    hasTargetSelfActionEvidence
    || candidateActions.includes('scroll-into-view')
    || candidateActions.includes('focus')
    || hasAgentSessionV2VerifiedPrimaryActionOwnership({
      candidate: options.candidate,
      evidence: options.evidence,
    })
    || hasAgentSessionV2CandidateTextOwnedActionEvidence(options)
  );
}
