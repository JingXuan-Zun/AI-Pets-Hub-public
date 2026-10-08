import { normalizeAgentVisualCandidateSearchText, getAgentVisualSearchTokens, getAgentVisualCandidateSearchText, getAgentVisualPointDistance, getAgentVisualCandidateCrossSourceAgreementScore } from './visualCandidateScoring';
export { getAgentVisualCandidateConfidenceScore, getAgentVisualCandidateTextRelevanceScore, getAgentVisualCandidateSourceFamily, getAgentVisualCandidateTextOverlapScore, getAgentVisualCandidateCrossSourceAgreementScore, getAgentVisualEvidenceCandidates, createAgentVisualCandidateFocusBounds, getAgentVisualPointDistance } from './visualCandidateScoring';

import {
  type AgentChatCommandResult,
  type AgentStructuredToolCandidateEvidence,
  type AgentStructuredToolEvidence,
} from '../agentChatCommand';

import { hasAgentAuthenticationHardGateCue, resolveAgentAuthenticationGate } from '../runtime/agentAuthenticationGate';

import { resolveAgentVisualActionPoint, resolveAgentVisualCandidateScreenPoint } from './visualCoordinates';

function getAgentVisualActionOwnershipTargetText(evidence: AgentStructuredToolEvidence | null) {
  return normalizeAgentVisualCandidateSearchText(
    evidence?.targetMatched?.trim()
      || evidence?.currentSelection?.trim()
      || '',
  );
}

function hasAgentVisualUsefulActionOwnershipRelationText(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return false;
  }

  const text = value.normalize('NFKC').trim().toLowerCase();
  return Boolean(text)
    && !/(?:unknown|unclear|not\s+(?:found|visible|clear|confirmed|associated)|not\s+belong|does\s+not\s+belong|no\s+(?:relation|association)|none|null|n\/a|\u4e0d\u786e\u5b9a|\u4e0d\u6e05\u695a|\u672a\u77e5|\u672a\u627e\u5230|\u6ca1\u6709|\u65e0|\u4e0d\u5c5e\u4e8e|\u672a\u5173\u8054|\u65e0\u5173)/iu.test(text);
}

function isAgentVisualGenericPrimaryActionText(value: unknown) {
  const text = normalizeAgentVisualCandidateSearchText(value);
  return Boolean(text)
    && /^(?:start|play|open|launch|run|enter|continue|install|update|resume|\u542f\u52a8|\u5f00\u59cb|\u6253\u5f00|\u8fd0\u884c|\u8fdb\u5165|\u7ee7\u7eed|\u5b89\u88c5|\u66f4\u65b0|\u6062\u590d)$/iu.test(text);
}

function isAgentVisualDirectActionControlText(value: unknown) {
  const text = normalizeAgentVisualCandidateSearchText(value);
  return Boolean(text)
    && /(?:login|signin|logon|continue|allow|ok|confirm|submit|next|start|play|launch|open|enter|resume|install|update|\u767b\u5f55|\u767b\u9678|\u767b\u5165|\u786e\u8ba4|\u786e\u5b9a|\u5141\u8bb8|\u7ee7\u7eed|\u4e0b\u4e00\u6b65|\u5f00\u59cb|\u542f\u52a8|\u6253\u5f00|\u8fdb\u5165|\u64ad\u653e|\u8fd0\u884c|\u5b89\u88c5|\u66f4\u65b0|\u6062\u590d)/iu.test(text);
}

export function createAgentEffectiveVisualActionEvidence(
  evidence: AgentStructuredToolEvidence | null,
) {
  if (!evidence || isAgentVisualUsefulPrimaryAction(evidence.primaryAction)) {
    return evidence;
  }

  const directActionText = [
    evidence.targetMatched,
    evidence.elementDescription,
    evidence.elementRegion,
  ].find(isAgentVisualDirectActionControlText);
  if (!directActionText || typeof directActionText !== 'string') {
    return evidence;
  }

  return {
    ...evidence,
    primaryAction: directActionText.trim(),
    relation: evidence.relation?.trim()
      || `${directActionText.trim()} is the directly actionable target control.`,
  };
}

export function collectAgentVisualApprovalResultText(result: AgentChatCommandResult) {
  return [
    result.responseText,
    result.verification,
    result.errorText,
    result.assessment?.summary,
    result.receipt?.verification,
    result.receipt?.evidenceLines?.join('\n'),
    result.receipt?.summaryLines?.join('\n'),
    result.stateSummary?.observedState?.join('\n'),
    result.stateSummary?.verificationEvidence?.join('\n'),
    result.observations?.join('\n'),
  ].filter(Boolean).join('\n');
}

export function hasAgentApproximateVisualEvidence(result: AgentChatCommandResult) {
  return /(?:approximate|estimated|estimate|uncertain|unclear|not\s+confirmed|cannot\s+confirm|rough|approximation|近似|估算|大致|不确定|不清楚|未确认|无法确认|无法可靠)/iu.test(
    collectAgentVisualApprovalResultText(result),
  );
}

export function hasAgentVisualSafeLoginContinuationApprovalEvidence(options: {
  evidence: AgentStructuredToolEvidence | null;
  result: AgentChatCommandResult;
}) {
  const evidence = options.evidence;
  if (!evidence) {
    return false;
  }

  const launcherVerification = evidence.launcherVerification;
  if (
    launcherVerification
    && (
      launcherVerification.status !== 'ready'
      || launcherVerification.primaryActionMatchesTarget !== true
    )
  ) {
    return false;
  }

  if (evidence.confidence === 'low' || evidence.coordinateConfidence === 'low') {
    return false;
  }

  if (evidence.visualActionReadiness !== 'ready') {
    return false;
  }

  const text = [
    collectAgentVisualApprovalResultText(options.result),
  ].filter(Boolean).join('\n');
  const controlText = [
    evidence.targetMatched,
    evidence.primaryAction,
    evidence.elementDescription,
    evidence.elementRegion,
    evidence.relation,
  ].filter(Boolean).join('\n');
  if (hasAgentAuthenticationHardGateCue(text)) {
    return false;
  }
  const normalizedControlText = controlText
    .replace(/(?:\u8bc6\u522b|\u53d1\u73b0|\u68c0\u6d4b\u5230)\s*\u4f46\u4e0d\u70b9\u51fb[：:]?/gu, ' ')
    .replace(/(?:identified|detected|found)\s+but\s+do\s+not\s+click:?/giu, ' ');
  if (/(?:no\s+(?:clear|actionable|clickable)|do\s+not\s+click|needs?\s+(?:wait|retry|refin)|unclear|none|null|n\/a|\u65e0\u660e\u786e|\u4e0d\u8981\u70b9\u51fb|\u9700\u8981(?:\u7b49\u5f85|\u91cd\u8bd5|\u7cbe\u786e)|\u4e0d\u6e05\u695a|\u6ca1\u6709)/iu.test(normalizedControlText)) {
    return false;
  }

  return resolveAgentAuthenticationGate({
    controlText,
    postActionState: evidence.postActionState,
    text,
  }).canSubmit;
}

export function hasAgentVisualCandidateTextOwnedActionEvidence(options: {
  candidate?: AgentStructuredToolCandidateEvidence | null;
  evidence: AgentStructuredToolEvidence | null;
  sourceText?: string;
  userGoal?: string;
}) {
  if (!options.candidate) {
    return false;
  }

  const candidateText = getAgentVisualCandidateSearchText(options.candidate);
  if (!candidateText) {
    return false;
  }

  const targetSourceText = [
    options.evidence?.targetMatched,
    options.evidence?.currentSelection,
    options.sourceText,
    options.userGoal,
  ]
    .map(normalizeAgentVisualCandidateSearchText)
    .filter((value) => value.length >= 3);
  const targetTokens = [
    options.evidence?.targetMatched,
    options.evidence?.currentSelection,
    options.sourceText,
    options.userGoal,
  ].flatMap(getAgentVisualSearchTokens);
  const candidateTokens = new Set(getAgentVisualSearchTokens(getAgentVisualCandidateSearchText(options.candidate)));
  const actionSourceText = [
    options.evidence?.primaryAction,
    options.candidate.label,
    options.candidate.name,
    options.candidate.automationId,
    options.candidate.description,
  ]
    .map(normalizeAgentVisualCandidateSearchText)
    .filter((value) => value.length >= 2);
  const hasTargetText = targetSourceText.some((text) => (
    candidateText.includes(text) || text.includes(candidateText)
  )) || targetTokens.some((token) => candidateTokens.has(token) || candidateText.includes(token));
  const hasActionText = actionSourceText.some((text) => (
    isAgentVisualGenericPrimaryActionText(text)
      ? candidateText.includes(text)
      : /(?:start|play|open|launch|run|enter|continue|install|update|resume|\u542f\u52a8|\u5f00\u59cb|\u6253\u5f00|\u8fd0\u884c|\u8fdb\u5165|\u7ee7\u7eed|\u5b89\u88c5|\u66f4\u65b0|\u6062\u590d)/iu.test(text)
  )) || /(?:start|play|open|launch|run|enter|continue|install|update|resume|\u542f\u52a8|\u5f00\u59cb|\u6253\u5f00|\u8fd0\u884c|\u8fdb\u5165|\u7ee7\u7eed|\u5b89\u88c5|\u66f4\u65b0|\u6062\u590d)/iu.test(candidateText);

  return hasTargetText && hasActionText;
}

function hasAgentVisualActionOwnershipCandidateText(options: {
  candidate?: AgentStructuredToolCandidateEvidence | null;
  evidence: AgentStructuredToolEvidence | null;
}) {
  const targetText = getAgentVisualActionOwnershipTargetText(options.evidence);
  if (!targetText) {
    return false;
  }

  const candidateText = options.candidate
    ? getAgentVisualCandidateSearchText(options.candidate)
    : '';
  const evidenceText = normalizeAgentVisualCandidateSearchText([
    options.evidence?.elementDescription,
    options.evidence?.elementRegion,
    options.evidence?.relation,
    options.evidence?.primaryAction,
  ].filter(Boolean).join(' '));
  return [candidateText, evidenceText].some((text) => (
    text.includes(targetText) || targetText.includes(text)
  ));
}

function hasAgentVisualSelectedTargetContext(evidence: AgentStructuredToolEvidence | null) {
  const launcherVerification = evidence?.launcherVerification;
  if (
    launcherVerification
    && (
      launcherVerification.targetSelected === true
      || launcherVerification.detailMatchesTarget === true
    )
    && launcherVerification.targetSelected !== false
    && launcherVerification.detailMatchesTarget !== false
  ) {
    return true;
  }

  const targetText = normalizeAgentVisualCandidateSearchText(evidence?.targetMatched);
  const currentSelectionText = normalizeAgentVisualCandidateSearchText(evidence?.currentSelection);
  return Boolean(
    evidence?.selectionVerificationStatus === 'selected'
      || (
        targetText
        && currentSelectionText
        && (targetText.includes(currentSelectionText) || currentSelectionText.includes(targetText))
      ),
  );
}

export function isAgentVisualLauncherVerificationBlocking(evidence: AgentStructuredToolEvidence | null) {
  const launcherVerification = evidence?.launcherVerification;
  if (!launcherVerification) {
    return false;
  }

  return Boolean(
    launcherVerification.targetVisible === false
      || launcherVerification.targetSelected === false
      || launcherVerification.detailMatchesTarget === false
      || launcherVerification.primaryActionMatchesTarget === false
      || (
        launcherVerification.status
        && launcherVerification.status !== 'ready'
        && launcherVerification.status !== 'unknown'
      ),
  );
}

export function isAgentVisualLoginRequiredEvidence(evidence: AgentStructuredToolEvidence | null) {
  return evidence?.postActionState === 'login_required';
}

export function hasAgentVisualVerifiedLauncherActionOwnership(evidence: AgentStructuredToolEvidence | null) {
  const launcherVerification = evidence?.launcherVerification;
  if (!launcherVerification) {
    return false;
  }

  return Boolean(
    launcherVerification.status === 'ready'
      && launcherVerification.targetVisible !== false
      && launcherVerification.targetSelected !== false
      && launcherVerification.detailMatchesTarget !== false
      && launcherVerification.primaryActionMatchesTarget === true,
  );
}

export function hasAgentVisualVerifiedPrimaryActionOwnership(options: {
  candidate?: AgentStructuredToolCandidateEvidence | null;
  evidence: AgentStructuredToolEvidence | null;
}) {
  const evidence = options.evidence;
  if (!evidence?.targetMatched || !isAgentVisualUsefulPrimaryAction(evidence.primaryAction)) {
    return false;
  }

  if (isAgentVisualLauncherVerificationBlocking(evidence)) {
    return false;
  }

  if (hasAgentVisualVerifiedLauncherActionOwnership(evidence)) {
    return true;
  }

  const relationText = [
    evidence.relation,
    options.candidate?.relation,
    options.candidate?.description,
  ].filter((value): value is string => typeof value === 'string' && Boolean(value.trim())).join(' | ');
  if (options.candidate) {
    const candidateHasOwnOwnershipEvidence = hasAgentVisualCandidateTextOwnedActionEvidence({
      candidate: options.candidate,
      evidence,
    });
    const candidateHasCrossSourceAgreement = getAgentVisualCandidateCrossSourceAgreementScore({
      candidate: options.candidate,
      evidence,
    }) > 0;
    const candidatePoint = resolveAgentVisualCandidateScreenPoint(options.candidate, evidence);
    const topLevelActionPoint = resolveAgentVisualActionPoint(evidence);
    const candidateMatchesTopLevelActionPoint = Boolean(
      candidatePoint
        && topLevelActionPoint
        && getAgentVisualPointDistance(candidatePoint, topLevelActionPoint) <= 64,
    );
    if (
      !candidateHasOwnOwnershipEvidence
      && !candidateHasCrossSourceAgreement
      && !candidateMatchesTopLevelActionPoint
    ) {
      return false;
    }
  }

  if (
    hasAgentVisualUsefulActionOwnershipRelationText(relationText)
    && (
      hasAgentVisualActionOwnershipCandidateText(options)
      || /(?:belongs\s+to|associated\s+with|for\s+(?:the\s+)?selected|current\s+detail|detail\s+page|owned\s+by|\u5c5e\u4e8e|\u5173\u8054|\u5bf9\u5e94|\u5f53\u524d\u8be6\u60c5|\u8be6\u60c5\u9875|\u5df2\u9009\u4e2d)/iu.test(relationText)
    )
  ) {
    return true;
  }

  const primaryActionIsGeneric = isAgentVisualGenericPrimaryActionText(evidence.primaryAction)
    || isAgentVisualGenericPrimaryActionText(options.candidate?.label)
    || isAgentVisualGenericPrimaryActionText(options.candidate?.name);
  if (!primaryActionIsGeneric) {
    return hasAgentVisualActionOwnershipCandidateText(options);
  }

  return hasAgentVisualSelectedTargetContext(evidence)
    && hasAgentVisualUsefulActionOwnershipRelationText(relationText)
    && /(?:selected|current|detail|page|belongs|associated|\u5df2\u9009\u4e2d|\u5f53\u524d|\u8be6\u60c5|\u5c5e\u4e8e|\u5173\u8054|\u5bf9\u5e94)/iu.test(relationText);
}

export function isAgentVisualUsefulPrimaryAction(value: unknown) {
  if (typeof value !== 'string') {
    return false;
  }

  const text = value.normalize('NFKC').trim().toLowerCase();
  return Boolean(text)
    && !/(?:unknown|unclear|not\s+(?:found|visible|clear)|none|null|n\/a|\u4e0d\u786e\u5b9a|\u4e0d\u6e05\u695a|\u672a\u77e5|\u672a\u627e\u5230|\u6ca1\u6709|\u65e0)/iu.test(text);
}
