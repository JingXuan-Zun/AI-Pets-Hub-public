import type {
  NeuralPersonaNodeGenerationBatch,
  NeuralPersonaNodeGenerationCandidate,
} from './neuralPersonaNodeGenerationTypes';
import type {
  NeuralPersonaNode,
  NeuralPersonaSourceDocument,
  NeuralPersonaSourceReference,
} from './neuralPersonaTypes';

function normalized(value: string | undefined) {
  return value?.normalize('NFKC').replace(/\s+/gu, ' ').trim() ?? '';
}

export function neuralPersonaNodeContent(node: NeuralPersonaNode) {
  return node.normalizedContent?.trim() || node.influenceSummary.trim();
}

export function neuralPersonaNodeRetrievalSummary(node: NeuralPersonaNode) {
  return node.retrievalSummary?.trim() || node.influenceSummary.trim();
}

export function neuralPersonaCandidateContent(
  candidate: NeuralPersonaNodeGenerationCandidate,
) {
  return candidate.influenceSummary.trim();
}

export function neuralPersonaCandidateRetrievalSummary(
  candidate: NeuralPersonaNodeGenerationCandidate,
) {
  return candidate.retrievalSummary?.trim() || candidate.influenceSummary.trim();
}

export function neuralPersonaSourceFingerprint(content: string) {
  let hash = 2166136261;
  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}:${content.length}`;
}

export function createNeuralPersonaBatchSourceDocument(
  batch: NeuralPersonaNodeGenerationBatch,
): NeuralPersonaSourceDocument {
  return {
    content: batch.sourceText,
    contentFingerprint: neuralPersonaSourceFingerprint(batch.sourceText),
    createdAt: batch.generatedAt,
    ownerRoleId: batch.roleId,
    sourceId: batch.sourceDocumentId ?? `persona-source:${batch.batchId}`,
    title: `${batch.personaName} 人格导入`,
    type: 'persona-import',
  };
}

export function neuralPersonaSourceDocumentAlreadyLinked(
  sourceId: string,
  nodes: NeuralPersonaNode[],
) {
  return nodes.some((node) => node.sourceReferences?.some(
    (reference) => reference.sourceId === sourceId,
  ));
}

function resolvedOffsets(
  batch: NeuralPersonaNodeGenerationBatch,
  candidate: NeuralPersonaNodeGenerationCandidate,
  quote: string,
) {
  const suppliedStart = candidate.sourceStartOffset;
  const suppliedEnd = candidate.sourceEndOffset;
  if (Number.isSafeInteger(suppliedStart) && Number.isSafeInteger(suppliedEnd)
    && suppliedStart! >= 0 && suppliedEnd! >= suppliedStart!
    && batch.sourceText.slice(suppliedStart, suppliedEnd) === quote) {
    return { endOffset: suppliedEnd!, startOffset: suppliedStart! };
  }
  const startOffset = batch.sourceText.indexOf(quote);
  return startOffset >= 0
    ? { endOffset: startOffset + quote.length, startOffset }
    : null;
}

export function createNeuralPersonaCandidateSourceReference(
  batch: NeuralPersonaNodeGenerationBatch,
  candidate: NeuralPersonaNodeGenerationCandidate,
): NeuralPersonaSourceReference | null {
  if (candidate.origin !== 'model') return null;
  const quote = candidate.originalContent?.trim() || candidate.evidence.trim();
  if (!quote) return null;
  const offsets = resolvedOffsets(batch, candidate, quote);
  if (!offsets) return null;
  return {
    blockId: candidate.sourceBlockId?.trim() || candidate.candidateId,
    ...offsets,
    quote,
    sourceId: batch.sourceDocumentId ?? `persona-source:${batch.batchId}`,
  };
}

export function mergeNeuralPersonaSourceReferences(
  current: NeuralPersonaSourceReference[] | undefined,
  incoming: NeuralPersonaSourceReference | null,
) {
  if (!incoming) return current;
  const references = current ?? [];
  const key = (reference: NeuralPersonaSourceReference) => (
    `${reference.sourceId}\u0000${reference.blockId}\u0000${reference.startOffset}\u0000${reference.endOffset}`
  );
  if (references.some((reference) => key(reference) === key(incoming))) return current;
  return [...new Map([...references, incoming].map((reference) => (
    [key(reference), reference]
  ))).values()];
}

export function sameNeuralPersonaContent(left: string, right: string) {
  return normalized(left).toLocaleLowerCase() === normalized(right).toLocaleLowerCase();
}
