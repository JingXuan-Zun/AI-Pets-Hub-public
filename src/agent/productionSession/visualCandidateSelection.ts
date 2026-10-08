import { type AgentStructuredToolCandidateEvidence, type AgentStructuredToolEvidence } from '../agentChatCommand';
import { type AgentRuntimeToolResultEntry } from '../runtime/agentRuntimeContract';
import { getAgentStructuredEvidence } from '../runtime/agentPlanningSignalEvidence';
import { type createAgentProductionVisualRetryEvidence } from './visualRetryEvidence';
import { resolveAgentVisualActionPoint as resolveAgentSessionV2VisualActionPoint, resolveAgentVisualCandidateScreenPoint as resolveAgentSessionV2CandidateScreenPoint } from './visualCoordinates';
import { getAgentProductionCandidateUiActions as getAgentSessionV2CandidateUiActions, isAgentProductionInvokableUiCandidate as isAgentSessionV2InvokableUiCandidate } from './windowUiActionIntent';
import {
  isAgentVisualLauncherVerificationBlocking as isAgentSessionV2LauncherVerificationBlocking,
  getAgentVisualEvidenceCandidates as getAgentSessionV2VisualEvidenceCandidates,
  getAgentVisualPointDistance as getAgentSessionV2PointDistance,
  getAgentVisualCandidateTextOverlapScore as getAgentSessionV2CandidateTextOverlapScore,
  getAgentVisualCandidateTextRelevanceScore as getAgentSessionV2CandidateTextRelevanceScore,
  getAgentVisualCandidateSourceFamily as getAgentSessionV2CandidateSourceFamily,
  getAgentVisualCandidateConfidenceScore as getAgentSessionV2CandidateConfidenceScore,
  isAgentVisualUsefulPrimaryAction as isAgentSessionV2UsefulPrimaryAction,
  getAgentVisualCandidateCrossSourceAgreementScore as getAgentSessionV2CandidateCrossSourceAgreementScore,
} from './visualCandidateEvidence';

export function createAgentProductionVisualCandidateSelection(
  retryEvidence: ReturnType<typeof createAgentProductionVisualRetryEvidence>,
) {
  const {
    getAgentProductionPreviousUnverifiedActionPoints: getAgentSessionV2PreviousUnverifiedActionPoints,
    isAgentProductionNearPreviousActionPoint: isAgentSessionV2NearPreviousActionPoint,
    isAgentProductionSameUnverifiedWindowUiCandidate: isAgentSessionV2SameUnverifiedWindowUiCandidate,
    getAgentProductionPreviousUnverifiedWindowUiSignatureKeys: getAgentSessionV2PreviousUnverifiedWindowUiSignatureKeys,
    getAgentProductionCandidateWindowUiSignatureKeys: getAgentSessionV2CandidateWindowUiSignatureKeys,
  } = retryEvidence;

  function findAgentProductionHistoricalInvokableUiCandidateForVisualEvidence(options: {
    evidence: AgentStructuredToolEvidence | null;
    sourceText: string;
    toolResults?: AgentRuntimeToolResultEntry[] | null;
    userGoal: string;
  }) {
    const point = resolveAgentSessionV2VisualActionPoint(options.evidence);
    if (
      !point
      || options.evidence?.visualActionReadiness !== 'ready'
      || options.evidence.confidence === 'low'
      || isAgentSessionV2LauncherVerificationBlocking(options.evidence)
    ) {
      return null;
    }

    const historyEntries = [...(options.toolResults ?? [])]
      .reverse()
      .slice(0, 8)
      .filter((entry) => entry.result.ok !== false);
    const candidates = historyEntries.flatMap((entry) => {
      const historicalEvidence = getAgentStructuredEvidence(entry);
      return getAgentSessionV2VisualEvidenceCandidates(historicalEvidence)
        .filter((candidate) => isAgentSessionV2InvokableUiCandidate(candidate))
        .filter((candidate) => !isAgentSessionV2SameUnverifiedWindowUiCandidate({
          candidate,
          evidence: historicalEvidence,
          toolResults: options.toolResults,
        }))
        .map((candidate) => ({
          candidate,
          evidence: historicalEvidence,
        }));
    });

    const ranked = candidates.map(({ candidate, evidence }, index) => {
      const candidatePoint = resolveAgentSessionV2CandidateScreenPoint(candidate, evidence);
      if (!candidatePoint) {
        return null;
      }

      const distance = getAgentSessionV2PointDistance(point, candidatePoint);
      const spatialScore = distance <= 24
        ? 70
        : distance <= 64
          ? 52
          : distance <= 120
            ? 30
            : 0;
      const currentCandidate: AgentStructuredToolCandidateEvidence = {
        center: {
          coordinateSpace: 'native-screen',
          source: options.evidence?.elementCenter?.source ?? 'visual',
          x: point.x,
          y: point.y,
        },
        confidence: options.evidence?.coordinateConfidence === 'low' ? 'low' : options.evidence?.confidence ?? null,
        description: options.evidence?.elementDescription ?? null,
        label: options.evidence?.primaryAction ?? options.evidence?.targetMatched ?? null,
        relation: options.evidence?.relation ?? null,
        source: 'visual',
      };
      const textScore = Math.max(
        getAgentSessionV2CandidateTextOverlapScore(candidate, currentCandidate),
        getAgentSessionV2CandidateTextRelevanceScore({
          candidate,
          evidence: options.evidence,
          sourceText: options.sourceText,
          userGoal: options.userGoal,
        }),
      );
      const selectorScore = candidate.automationId?.trim() ? 18 : candidate.name?.trim() ? 10 : 0;
      const sourceScore = getAgentSessionV2CandidateSourceFamily(candidate) === 'uia' ? 18 : 0;
      const confidenceScore = getAgentSessionV2CandidateConfidenceScore(candidate.confidence);
      const actionableScore = getAgentSessionV2CandidateUiActions(candidate).includes('invoke') ? 18 : 8;
      const score = spatialScore
        + textScore
        + selectorScore
        + sourceScore
        + confidenceScore
        + actionableScore
        - index;

      if (
        score < 95
        || !candidate.automationId?.trim()
        || (
          spatialScore <= 0
          && textScore < 18
        )
      ) {
        return null;
      }

      const fusedCandidate: AgentStructuredToolCandidateEvidence = {
        ...candidate,
        center: {
          coordinateSpace: 'native-screen',
          source: 'ui-automation+visual',
          x: point.x,
          y: point.y,
        },
        confidence: options.evidence?.confidence === 'high' && candidate.confidence !== 'low'
          ? 'high'
          : candidate.confidence ?? options.evidence?.confidence ?? null,
        description: [
          candidate.description?.trim(),
          options.evidence?.relation?.trim(),
          'Fused with current visual/OCR evidence.',
        ].filter(Boolean).join(' | '),
        label: candidate.label?.trim()
          || candidate.name?.trim()
          || options.evidence?.primaryAction?.trim()
          || options.evidence?.targetMatched?.trim()
          || null,
        relation: [
          candidate.relation?.trim(),
          options.evidence?.relation?.trim(),
        ].filter(Boolean).join(' | ') || 'UI Automation selector matches current visual/OCR action evidence.',
        source: 'ui-automation+visual',
      };

      return {
        candidate: fusedCandidate,
        point,
        score,
      };
    })
      .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
      .sort((a, b) => b.score - a.score);

    return ranked.at(0) ?? null;
  }

  // A generic control (e.g. one of several identical "Start" buttons) must not
  // outrank the control whose evidence ties it to the requested target.
  function getAgentProductionCandidateOwnershipScore(
    candidate: AgentStructuredToolCandidateEvidence,
    evidence: AgentStructuredToolEvidence | null,
  ) {
    const relationText = [candidate.relation, candidate.description]
      .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
      .join(' ')
      .normalize('NFKC')
      .toLowerCase();
    if (!relationText) {
      return 0;
    }
    if (/(?:ownership|owner|relation)\s+(?:is\s+)?(?:unknown|unclear|not\s+(?:confirmed|verified|known))/u.test(relationText)) {
      return -25;
    }
    const targetText = evidence?.targetMatched?.normalize('NFKC').trim().toLowerCase() ?? '';
    return targetText && relationText.includes(targetText) ? 20 : 0;
  }

  function scoreAgentProductionVisualActionCandidate(options: {
    candidate: AgentStructuredToolCandidateEvidence;
    candidateKind: 'action' | 'target';
    evidence: AgentStructuredToolEvidence | null;
    index: number;
    previousPoints: Array<{ x: number; y: number }>;
  }) {
    const point = resolveAgentSessionV2CandidateScreenPoint(options.candidate, options.evidence);
    if (!point) {
      return null;
    }

    let score = 60 + getAgentSessionV2CandidateConfidenceScore(options.candidate.confidence) - options.index;
    if (options.candidateKind === 'action') {
      score += 15;
    }
    if (options.candidate.relation?.trim()) {
      score += 12;
    }
    if (options.candidate.label?.trim() || options.candidate.description?.trim()) {
      score += 5;
    }
    score += getAgentSessionV2CandidateCrossSourceAgreementScore({
      candidate: options.candidate,
      evidence: options.evidence,
    });
    score += getAgentProductionCandidateOwnershipScore(options.candidate, options.evidence);
    if (isAgentSessionV2NearPreviousActionPoint(point, options.previousPoints)) {
      score -= 90;
    } else if (options.previousPoints.length) {
      const nearestDistance = Math.min(
        ...options.previousPoints.map((previousPoint) => getAgentSessionV2PointDistance(point, previousPoint)),
      );
      score += Math.min(25, Math.max(0, nearestDistance / 12));
    }

    return {
      candidate: options.candidate,
      candidateKind: options.candidateKind,
      point,
      score,
    };
  }

  function rankAgentProductionVisualActionCandidates(options: {
    evidence: AgentStructuredToolEvidence | null;
    toolResults?: AgentRuntimeToolResultEntry[] | null;
  }) {
    const previousPoints = getAgentSessionV2PreviousUnverifiedActionPoints(options.toolResults);
    const actionCandidates = Array.isArray(options.evidence?.actionCandidates)
      ? options.evidence.actionCandidates
      : [];
    const targetCandidates = Array.isArray(options.evidence?.targetCandidates)
      ? options.evidence.targetCandidates
      : [];
    const rankedCandidates = [
      ...actionCandidates.map((candidate, index) => scoreAgentProductionVisualActionCandidate({
        candidate,
        candidateKind: 'action' as const,
        evidence: options.evidence,
        index,
        previousPoints,
      })),
      ...targetCandidates.map((candidate, index) => scoreAgentProductionVisualActionCandidate({
        candidate,
        candidateKind: 'target' as const,
        evidence: options.evidence,
        index,
        previousPoints,
      })),
    ]
      .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
      .sort((a, b) => b.score - a.score);

    return rankedCandidates;
  }

  function resolveAgentProductionVisualActionApprovalPoint(options: {
    evidence: AgentStructuredToolEvidence | null;
    toolResults?: AgentRuntimeToolResultEntry[] | null;
  }) {
    const directPoint = resolveAgentSessionV2VisualActionPoint(options.evidence);
    const previousPoints = getAgentSessionV2PreviousUnverifiedActionPoints(options.toolResults);
    const rankedCandidates = rankAgentProductionVisualActionCandidates(options);
    const bestCandidate = rankedCandidates.at(0);
    const bestActionCandidate = rankedCandidates.find((candidate) => candidate.candidateKind === 'action');
    if (
      bestActionCandidate
      && options.evidence?.visualActionReadiness === 'ready'
      && isAgentSessionV2UsefulPrimaryAction(options.evidence.primaryAction)
      && options.evidence.confidence !== 'low'
      && bestActionCandidate.candidate.confidence !== 'low'
    ) {
      return bestActionCandidate.point;
    }

    if (
      bestCandidate
      && (
        !directPoint
        || (
          isAgentSessionV2NearPreviousActionPoint(directPoint, previousPoints)
          && !isAgentSessionV2NearPreviousActionPoint(bestCandidate.point, previousPoints)
        )
      )
    ) {
      return bestCandidate.point;
    }

    return directPoint ?? bestCandidate?.point ?? null;
  }

  function scoreAgentProductionInvokableUiCandidate(options: {
    candidate: AgentStructuredToolCandidateEvidence;
    candidateKind: 'action' | 'target';
    evidence: AgentStructuredToolEvidence | null;
    index: number;
    sourceText?: string;
    toolResults?: AgentRuntimeToolResultEntry[] | null;
    userGoal?: string;
  }) {
    if (!isAgentSessionV2InvokableUiCandidate(options.candidate)) {
      return null;
    }

    if (isAgentSessionV2SameUnverifiedWindowUiCandidate({
      candidate: options.candidate,
      evidence: options.evidence,
      toolResults: options.toolResults,
    })) {
      return null;
    }

    const point = resolveAgentSessionV2CandidateScreenPoint(options.candidate, options.evidence);
    const previousPoints = getAgentSessionV2PreviousUnverifiedActionPoints(options.toolResults);
    const previousWindowUiSignatureKeys = getAgentSessionV2PreviousUnverifiedWindowUiSignatureKeys(options.toolResults);
    const candidateWindowUiSignatureKeys = getAgentSessionV2CandidateWindowUiSignatureKeys(
      options.candidate,
      options.evidence,
    );
    let score = 100 + getAgentSessionV2CandidateConfidenceScore(options.candidate.confidence) - options.index;
    if (options.candidateKind === 'action') {
      score += 25;
    }
    if (options.candidate.automationId?.trim()) {
      score += 18;
    }
    if (options.candidate.controlType?.trim()) {
      score += 10;
    }
    score += getAgentSessionV2CandidateUiActions(options.candidate).length * 12;
    if (options.candidate.source === 'ui-automation') {
      score += 14;
    }
    if (options.candidate.window?.hwnd || options.candidate.window?.title || options.candidate.window?.processName) {
      score += 8;
    }
    if (options.sourceText || options.userGoal) {
      score += getAgentSessionV2CandidateTextRelevanceScore({
        candidate: options.candidate,
        evidence: options.evidence,
        sourceText: options.sourceText ?? '',
        userGoal: options.userGoal ?? '',
      });
    }
    score += getAgentSessionV2CandidateCrossSourceAgreementScore({
      candidate: options.candidate,
      evidence: options.evidence,
    });
    if (point && isAgentSessionV2NearPreviousActionPoint(point, previousPoints)) {
      score -= 40;
    }
    if (
      previousWindowUiSignatureKeys.length
      && candidateWindowUiSignatureKeys.some((key) => previousWindowUiSignatureKeys.includes(key))
    ) {
      score -= 95;
    }

    return {
      candidate: options.candidate,
      point,
      score,
    };
  }

  function resolveAgentProductionInvokableUiCandidate(options: {
    evidence: AgentStructuredToolEvidence | null;
    sourceText?: string;
    toolResults?: AgentRuntimeToolResultEntry[] | null;
    userGoal?: string;
  }) {
    const actionCandidates = Array.isArray(options.evidence?.actionCandidates)
      ? options.evidence.actionCandidates
      : [];
    const targetCandidates = Array.isArray(options.evidence?.targetCandidates)
      ? options.evidence.targetCandidates
      : [];
    return [
      ...actionCandidates.map((candidate, index) => scoreAgentProductionInvokableUiCandidate({
        candidate,
        candidateKind: 'action' as const,
        evidence: options.evidence,
        index,
        sourceText: options.sourceText,
        toolResults: options.toolResults,
        userGoal: options.userGoal,
      })),
      ...targetCandidates.map((candidate, index) => scoreAgentProductionInvokableUiCandidate({
        candidate,
        candidateKind: 'target' as const,
        evidence: options.evidence,
        index,
        sourceText: options.sourceText,
        toolResults: options.toolResults,
        userGoal: options.userGoal,
      })),
    ]
      .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
      .sort((a, b) => b.score - a.score)
      .at(0)
      ?? findAgentProductionHistoricalInvokableUiCandidateForVisualEvidence({
        evidence: options.evidence,
        sourceText: options.sourceText ?? '',
        toolResults: options.toolResults,
        userGoal: options.userGoal ?? '',
      });
  }

  return {
    resolveAgentProductionVisualActionApprovalPoint,
    resolveAgentProductionInvokableUiCandidate,
  };
}
