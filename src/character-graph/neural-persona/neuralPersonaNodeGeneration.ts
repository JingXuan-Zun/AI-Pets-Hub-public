import {
  NEURAL_PERSONA_NODE_GENERATION_VERSION,
  type NeuralPersonaNodeGenerationCandidate,
  type NeuralPersonaNodeGenerationProvider,
  type NeuralPersonaNodeGenerationRequest,
  type NeuralPersonaNodeGenerationResult,
} from './neuralPersonaNodeGenerationTypes';
import {
  createNeuralPersonaSourceFallbackCandidates,
  isNeuralPersonaGeneratedNodeType,
  normalizeNeuralPersonaGeneratedCandidates,
} from './neuralPersonaNodeGenerationRecovery';

function inUnitRange(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function normalizedText(value: string) {
  return value.trim().replace(/\s+/gu, ' ');
}

function validTags(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 12
    && value.every((tag) => typeof tag === 'string' && tag.trim() && tag.trim().length <= 40);
}

export function validateNeuralPersonaNodeGenerationCandidate(
  candidate: NeuralPersonaNodeGenerationCandidate,
  sourceText?: string,
) {
  if (!candidate || typeof candidate.candidateId !== 'string'
    || !candidate.candidateId.trim() || candidate.candidateId.length > 128) {
    return 'generated-node-id-missing';
  }
  if (typeof candidate.influenceSummary !== 'string'
    || !candidate.influenceSummary.trim()) return 'generated-node-summary-empty';
  if (candidate.influenceSummary.length > 240) return 'generated-node-summary-too-long';
  if (!isNeuralPersonaGeneratedNodeType(candidate.type)) return 'generated-node-type-invalid';
  if (candidate.origin !== 'model' && candidate.origin !== 'user') {
    return 'generated-node-origin-invalid';
  }
  if (typeof candidate.enabled !== 'boolean' || typeof candidate.evidence !== 'string') {
    return 'generated-node-shape-invalid';
  }
  if (!inUnitRange(candidate.baseWeight) || !inUnitRange(candidate.confidence)) {
    return 'generated-node-value-invalid';
  }
  if (!validTags(candidate.tags)) return 'generated-node-tags-invalid';
  if (candidate.topic !== undefined && (typeof candidate.topic !== 'string'
    || candidate.topic.length > 40)) return 'generated-node-topic-invalid';
  if (candidate.origin === 'model') {
    if (!candidate.evidence.trim()) return 'generated-node-evidence-missing';
    if (sourceText !== undefined && (typeof sourceText !== 'string' || !normalizedText(sourceText)
      .includes(normalizedText(candidate.evidence)))) return 'generated-node-evidence-not-found';
  }
  return null;
}

function normalizedCandidates(value: unknown, sourceText: string) {
  const normalized = normalizeNeuralPersonaGeneratedCandidates(value, sourceText);
  const summaries = new Set<string>();
  const candidates: NeuralPersonaNodeGenerationCandidate[] = [];
  const rejectionReasons = { ...normalized.rejectionReasons };
  normalized.candidates.forEach((item) => {
    const issue = validateNeuralPersonaNodeGenerationCandidate(item, sourceText);
    if (issue) {
      rejectionReasons[issue] = (rejectionReasons[issue] ?? 0) + 1;
      return;
    }
    const key = normalizedText(item.influenceSummary).toLocaleLowerCase();
    if (summaries.has(key)) {
      rejectionReasons['generated-node-summary-duplicate'] = (
        rejectionReasons['generated-node-summary-duplicate'] ?? 0
      ) + 1;
      return;
    }
    summaries.add(key);
    candidates.push(item);
  });
  return {
    candidates,
    rejectedCount: normalized.rejectedCount
      + normalized.candidates.length - candidates.length,
    rejectionReasons,
  };
}

function successResult(
  options: Parameters<typeof requestNeuralPersonaNodeGeneration>[0],
  sourceText: string,
  candidates: NeuralPersonaNodeGenerationCandidate[],
  recovery?: Extract<NeuralPersonaNodeGenerationResult, { status: 'ok' }>['recovery'],
): NeuralPersonaNodeGenerationResult {
  return {
    batch: {
      batchId: options.request.batchId, candidates,
      generatedAt: options.request.now, personaName: options.request.personaName.trim(),
      providerId: options.provider.providerId,
      roleId: options.request.roleId, sourceText,
      version: NEURAL_PERSONA_NODE_GENERATION_VERSION,
    },
    recovery,
    status: 'ok',
  };
}

function sourceFallback(
  options: Parameters<typeof requestNeuralPersonaNodeGeneration>[0],
  sourceText: string,
  reason: string,
  rejectedCandidateCount: number,
  rejectionReasons?: Record<string, number>,
) {
  const candidates = createNeuralPersonaSourceFallbackCandidates(sourceText);
  return candidates.length ? successResult(options, sourceText, candidates, {
    mode: 'source-fallback', reason, rejectedCandidateCount, rejectionReasons,
  }) : { reason: 'persona-node-generation-output-invalid', status: 'unavailable' as const };
}

const FALLBACK_PROVIDER_REASONS = new Set([
  'persona-node-generation-empty-response',
  'persona-node-generation-json-invalid',
]);

export async function requestNeuralPersonaNodeGeneration(options: {
  provider: NeuralPersonaNodeGenerationProvider;
  request: NeuralPersonaNodeGenerationRequest;
}): Promise<NeuralPersonaNodeGenerationResult> {
  const sourceText = options.request.sourceText.trim();
  if (sourceText.length < 10) return { reason: 'persona-source-too-short', status: 'invalid' };
  try {
    const generated = await options.provider.generate({ ...options.request, sourceText });
    if (generated.status !== 'ok') {
      return FALLBACK_PROVIDER_REASONS.has(generated.reason)
        ? sourceFallback(options, sourceText, generated.reason, 0, {
          [generated.reason]: 1,
        }) : generated;
    }
    const normalized = normalizedCandidates(generated.candidates, sourceText);
    if (!normalized.candidates.length) return sourceFallback(
      options, sourceText, 'persona-node-generation-output-invalid', normalized.rejectedCount,
      normalized.rejectionReasons,
    );
    const fallbackCount = generated.fallbackCandidateCount ?? 0;
    const recoveredCount = normalized.rejectedCount + fallbackCount;
    const recoveryReasons = {
      ...normalized.rejectionReasons, ...generated.fallbackReasons,
    };
    const explainedFallbackCount = Object.values(generated.fallbackReasons ?? {})
      .reduce((total, count) => total + count, 0);
    const annotationMissingCount = Math.max(0, fallbackCount - explainedFallbackCount);
    if (annotationMissingCount) {
      recoveryReasons['persona-node-generation-annotation-missing'] = annotationMissingCount;
    }
    const recovery = recoveredCount ? {
      mode: 'partial' as const,
      reason: 'persona-node-generation-candidates-partially-recovered',
      rejectedCandidateCount: recoveredCount,
      rejectionReasons: recoveryReasons,
    } : undefined;
    return successResult(options, sourceText, normalized.candidates, recovery);
  } catch {
    return { reason: options.request.signal?.aborted
      ? 'persona-node-generation-cancelled' : 'persona-node-generation-failed', status: 'unavailable' };
  }
}
