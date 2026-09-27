import { normalizeNeuralPersonaTagId } from './neuralPersonaTagIndex';
import type { NeuralPersonaNode, NeuralPersonaTag } from './neuralPersonaTypes';

export interface NeuralPersonaTagVocabularyItem {
  aliases?: string[];
  canonicalId: string;
  label: string;
}

function normalizedText(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase();
}

function matchesVocabulary(summary: string, item: NeuralPersonaTagVocabularyItem) {
  const candidates = [item.label, ...(item.aliases ?? [])].map(normalizedText).filter(Boolean);
  return candidates.some((candidate) => summary.includes(candidate));
}

export function suggestNeuralPersonaTags(
  node: Pick<NeuralPersonaNode, 'influenceSummary' | 'type'>,
  vocabulary: readonly NeuralPersonaTagVocabularyItem[],
) {
  const summary = normalizedText(node.influenceSummary);
  const typeTag: NeuralPersonaTag = {
    canonicalId: `node-type:${node.type}`,
    confidence: 1,
    label: node.type,
    source: 'system',
    status: 'pending-review',
  };
  const matched = vocabulary.filter((item) => matchesVocabulary(summary, item)).map((item) => ({
    aliases: item.aliases,
    canonicalId: normalizeNeuralPersonaTagId(item.canonicalId),
    confidence: 0.8,
    label: item.label,
    source: 'system' as const,
    status: 'pending-review' as const,
  }));
  const deduplicated = new Map([typeTag, ...matched].map((tag) => [tag.canonicalId, tag]));
  return [...deduplicated.values()];
}

export function createUserNeuralPersonaTag(options: {
  canonicalId?: string;
  label: string;
}): NeuralPersonaTag | null {
  const label = options.label.normalize('NFKC').replace(/\s+/gu, ' ').trim();
  if (!label) return null;
  const canonicalId = normalizeNeuralPersonaTagId(options.canonicalId ?? `custom:${label}`);
  if (!canonicalId) return null;
  return { canonicalId, label, source: 'user', status: 'active' };
}
