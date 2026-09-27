import type {
  NeuralPersonaGeneratedNodeType,
  NeuralPersonaNodeGenerationCandidate,
} from './neuralPersonaNodeGenerationTypes';
import {
  createNeuralPersonaSourceBlocks,
  inferNeuralPersonaSourceBlockType,
} from './neuralPersonaSourceBlocks';

const ALLOWED_TYPES = new Set<NeuralPersonaGeneratedNodeType>([
  'belief-or-viewpoint', 'concern-or-risk', 'desire-or-goal',
  'emotional-tendency', 'experience', 'preference',
  'relationship-influence', 'style-tendency',
]);

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function unitValue(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value)) : fallback;
}

function normalizedTags(value: unknown) {
  const values = Array.isArray(value) ? value
    : typeof value === 'string' ? value.split(/[,，、]/u) : [];
  return [...new Set(values.flatMap((tag) => (
    typeof tag === 'string' && tag.trim() ? [tag.trim().slice(0, 40)] : []
  )))].slice(0, 12);
}

function normalizedTopic(value: unknown) {
  return typeof value === 'string'
    ? value.normalize('NFKC').replace(/\s+/gu, ' ').trim().slice(0, 40)
    : '';
}

function comparable(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '');
}

function evidenceFragments(sourceText: string) {
  return (sourceText.match(/[^\n。！？!?；;]+[。！？!?；;]?/gu) ?? [])
    .filter((fragment) => comparable(fragment).length >= 4);
}

function resolveEvidence(sourceText: string, requested: string) {
  const evidence = requested.trim();
  if (!evidence) return null;
  if (sourceText.includes(evidence)) return evidence;
  const target = comparable(evidence);
  if (target.length < 4) return null;
  const candidates = evidenceFragments(sourceText).filter((fragment) => {
    const source = comparable(fragment);
    const shorter = Math.min(source.length, target.length);
    const longer = Math.max(source.length, target.length);
    return shorter / Math.max(1, longer) >= 0.72
      && (source.includes(target) || target.includes(source));
  });
  return candidates.sort((left, right) => (
    Math.abs(comparable(left).length - target.length)
      - Math.abs(comparable(right).length - target.length)
  ))[0] ?? null;
}

function resolveContent(sourceText: string, requested: unknown) {
  if (typeof requested !== 'string' || !requested.trim()) return null;
  const target = comparable(requested);
  if (target.length < 4) return null;
  return createNeuralPersonaSourceBlocks(sourceText).map((block) => block.content)
    .filter((content) => {
      const source = comparable(content);
      return source.includes(target) || target.includes(source);
    }).sort((left, right) => (
      Math.abs(comparable(left).length - target.length)
        - Math.abs(comparable(right).length - target.length)
    ))[0] ?? null;
}

type CandidateParseResult =
  | { candidate: NeuralPersonaNodeGenerationCandidate }
  | { reason: string };

function parseCandidate(
  value: unknown, index: number, sourceText: string,
): CandidateParseResult {
  const item = record(value);
  if (!item || typeof item.evidence !== 'string' || typeof item.type !== 'string') {
    return { reason: 'generated-node-shape-invalid' };
  }
  if (!ALLOWED_TYPES.has(item.type as NeuralPersonaGeneratedNodeType)) {
    return { reason: 'generated-node-type-invalid' };
  }
  const evidence = resolveEvidence(sourceText, item.evidence);
  if (!evidence) return { reason: 'generated-node-evidence-not-found' };
  const requestedContent = item.content ?? item.influenceSummary;
  const content = requestedContent === undefined
    ? evidence : resolveContent(sourceText, requestedContent);
  if (!content) return { reason: 'generated-node-content-not-found' };
  return { candidate: {
    baseWeight: unitValue(item.baseWeight, 0.7),
    candidateId: `candidate-${index + 1}`,
    confidence: unitValue(item.confidence, 0.7),
    enabled: true, evidence, influenceSummary: content, origin: 'model' as const,
    tags: normalizedTags(item.tags), topic: normalizedTopic(item.topic) || undefined,
    type: item.type as NeuralPersonaGeneratedNodeType,
  } satisfies NeuralPersonaNodeGenerationCandidate };
}

function countReason(reasons: Record<string, number>, reason: string) {
  reasons[reason] = (reasons[reason] ?? 0) + 1;
}

export function isNeuralPersonaGeneratedNodeType(
  value: string,
): value is NeuralPersonaGeneratedNodeType {
  return ALLOWED_TYPES.has(value as NeuralPersonaGeneratedNodeType);
}

export function normalizeNeuralPersonaGeneratedCandidates(value: unknown, sourceText: string) {
  if (!Array.isArray(value)) return {
    candidates: [], rejectedCount: 1,
    rejectionReasons: { 'generated-node-candidates-not-array': 1 },
  };
  const candidates: NeuralPersonaNodeGenerationCandidate[] = [];
  const rejectionReasons: Record<string, number> = {};
  value.forEach((item, index) => {
    const parsed = parseCandidate(item, index, sourceText);
    if ('candidate' in parsed) candidates.push(parsed.candidate);
    else countReason(rejectionReasons, parsed.reason);
  });
  return {
    candidates,
    rejectedCount: value.length - candidates.length,
    rejectionReasons,
  };
}

export function createNeuralPersonaSourceFallbackCandidates(sourceText: string) {
  const seen = new Set<string>();
  return createNeuralPersonaSourceBlocks(sourceText).flatMap((block, index) => {
    const evidence = block.content;
    const key = comparable(evidence);
    if (seen.has(key)) return [];
    seen.add(key);
    return [{
      baseWeight: 0.65, candidateId: `source-fallback-${index + 1}`,
      confidence: 0.6, enabled: true, evidence, influenceSummary: evidence,
      origin: 'model' as const, tags: [], type: inferNeuralPersonaSourceBlockType(evidence),
    } satisfies NeuralPersonaNodeGenerationCandidate];
  });
}
