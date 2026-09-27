import type {
  NeuralPersonaGeneratedNodeType,
  NeuralPersonaNodeGenerationCandidate,
} from './neuralPersonaNodeGenerationTypes';
import {
  inferNeuralPersonaSourceBlockType,
  type NeuralPersonaSourceBlock,
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

function tags(value: unknown) {
  const values = Array.isArray(value) ? value
    : typeof value === 'string' ? value.split(/[,，、]/u) : [];
  return [...new Set(values.flatMap((tag) => (
    typeof tag === 'string' && tag.trim() ? [tag.trim().slice(0, 40)] : []
  )))].slice(0, 12);
}

function topic(value: unknown) {
  return typeof value === 'string'
    ? value.normalize('NFKC').replace(/\s+/gu, ' ').trim().slice(0, 40)
    : '';
}

function annotationType(value: unknown, content: string) {
  return typeof value === 'string' && ALLOWED_TYPES.has(value as NeuralPersonaGeneratedNodeType)
    ? value as NeuralPersonaGeneratedNodeType : inferNeuralPersonaSourceBlockType(content);
}

export function countNeuralPersonaSourceBlockAnnotations(
  blocks: NeuralPersonaSourceBlock[],
  value: unknown,
) {
  if (!Array.isArray(value)) return 0;
  const sourceIds = new Set(value.flatMap((item) => {
    const annotation = record(item);
    return annotation && typeof annotation.sourceId === 'string'
      && typeof annotation.type === 'string'
      && ALLOWED_TYPES.has(annotation.type as NeuralPersonaGeneratedNodeType)
      ? [annotation.sourceId] : [];
  }));
  return blocks.filter((block) => sourceIds.has(block.sourceId)).length;
}

export function mapNeuralPersonaSourceBlockAnnotations(
  blocks: NeuralPersonaSourceBlock[],
  value: unknown,
) {
  const annotations = Array.isArray(value) ? value : [];
  const bySourceId = new Map<string, Record<string, unknown>>();
  annotations.forEach((item) => {
    const annotation = record(item);
    if (annotation && typeof annotation.sourceId === 'string') {
      bySourceId.set(annotation.sourceId, annotation);
    }
  });
  return blocks.map((block) => {
    const annotation = bySourceId.get(block.sourceId) ?? {};
    return {
      baseWeight: unitValue(annotation.baseWeight, 0.65),
      candidateId: `source-candidate:${block.sourceId}`,
      confidence: unitValue(annotation.confidence, annotation.sourceId ? 0.75 : 0.6),
      enabled: true,
      evidence: block.content,
      influenceSummary: block.content,
      origin: 'model' as const,
      tags: tags(annotation.tags),
      topic: topic(annotation.topic) || undefined,
      type: annotationType(annotation.type, block.content),
    } satisfies NeuralPersonaNodeGenerationCandidate;
  });
}
