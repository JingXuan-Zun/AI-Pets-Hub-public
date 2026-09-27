import type { NeuralPersonaConfig } from './neuralPersonaConfig';
import { canReadNeuralPersonaNode } from './neuralPersonaAccessPolicy';
import type { NeuralPersonaCandidate } from './neuralPersonaCandidateTypes';
import type { ReadonlyNeuralPersonaGraphStore } from './neuralPersonaGraphStore';
import {
  normalizeNeuralPersonaTagId,
  type NeuralPersonaTagIndex,
} from './neuralPersonaTagIndex';
import type { NeuralPersonaContextInput, NeuralPersonaNode } from './neuralPersonaTypes';
import { isNeuralPersonaAnchorNode } from './neuralPersonaAnchor';
import { isNeuralPersonaStructuralNode } from './neuralPersonaGeneratedHierarchy';

function queryTerms(query: string) {
  return [...new Set(query.normalize('NFKC').toLocaleLowerCase()
    .split(/[\s,，。！？!?、:：；;（）()]+/u)
    .map((term) => term.trim()).filter((term) => term.length >= 2))];
}

function queryTermsWithCjkBigrams(query: string) {
  const segments = query.normalize('NFKC').toLocaleLowerCase()
    .split(/[\s,，。！？、；;（）()]+/u).map((term) => term.trim())
    .filter((term) => term.length >= 2);
  const terms = segments.flatMap((segment) => {
    if (!/[\p{Script=Han}]/u.test(segment)) return [segment];
    const bigrams = Array.from({ length: segment.length - 1 }, (_, index) => (
      segment.slice(index, index + 2)
    ));
    return [segment, ...bigrams];
  });
  return [...new Set(terms.filter((term) => term.length >= 2))];
}

function countKeywordMatches(node: NeuralPersonaNode, terms: string[]) {
  const text = `${node.influenceSummary} ${node.tags.map((tag) => tag.label).join(' ')}`
    .normalize('NFKC').toLocaleLowerCase();
  return terms.filter((term) => text.includes(term)).length;
}

function scoreCandidate(
  node: NeuralPersonaNode,
  terms: string[],
  tagMatched: boolean,
  input: NeuralPersonaContextInput,
  config: NeuralPersonaConfig,
) {
  const keywordMatches = countKeywordMatches(node, terms);
  const keywordRelevance = terms.length ? keywordMatches / terms.length : 0;
  const tagRelevance = tagMatched ? 1 : 0;
  const cooldownPenalty = node.cooldownUntil !== undefined && node.cooldownUntil > input.now ? 1 : 0;
  const repeatPenalty = Math.min(1, node.activationCount / 10) * config.repeatPenalty;
  const total = node.baseWeight * 0.25 + node.confidence * 0.2
    + keywordRelevance * 0.35 + tagRelevance * 0.2 - cooldownPenalty - repeatPenalty;
  return {
    baseWeight: node.baseWeight,
    confidence: node.confidence,
    cooldownPenalty,
    keywordRelevance,
    repeatPenalty,
    tagRelevance,
    total: Math.max(0, Math.min(1, total)),
  };
}

export function hasNeuralPersonaCandidateRetrievalSignal(
  candidate: NeuralPersonaCandidate,
) {
  return candidate.score.keywordRelevance > 0
    || candidate.score.tagRelevance > 0
    || (candidate.score.semanticRelevance ?? 0) > 0;
}

export function retrieveNeuralPersonaCandidates(options: {
  allowUnmatched?: boolean;
  config: NeuralPersonaConfig;
  input: NeuralPersonaContextInput;
  store: ReadonlyNeuralPersonaGraphStore;
  tagIndex: NeuralPersonaTagIndex;
}) {
  const terms = queryTermsWithCjkBigrams(options.input.query);
  const matchedIds = new Set(options.tagIndex.findNodeIds(terms.map(normalizeNeuralPersonaTagId)));
  return options.store.listNodes()
    .filter((node) => !isNeuralPersonaAnchorNode(node)
      && !isNeuralPersonaStructuralNode(node)
      && canReadNeuralPersonaNode(node, options.input))
    .map((node): NeuralPersonaCandidate => {
      const score = scoreCandidate(node, terms, matchedIds.has(node.nodeId), options.input, options.config);
      const reason = [score.tagRelevance ? 'tag-match' : '', score.keywordRelevance ? 'keyword-match' : '']
        .filter(Boolean);
      return { depth: 0, node, path: [node.nodeId], reason, score };
    })
    .filter((candidate) => (options.allowUnmatched || hasNeuralPersonaCandidateRetrievalSignal(candidate))
      && candidate.score.total >= options.config.candidateThreshold)
    .sort((left, right) => right.score.total - left.score.total
      || left.node.nodeId.localeCompare(right.node.nodeId))
    .slice(0, options.config.maxCandidateNodes);
}
