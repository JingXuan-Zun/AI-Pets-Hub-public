import {
  isNeuralPersonaStructuralEdge,
  isNeuralPersonaStructuralNode,
} from './neuralPersonaGeneratedHierarchy';
import {
  NEURAL_PERSONA_COGNITIVE_RELATION_TYPES,
  NEURAL_PERSONA_RELATIONSHIP_CANDIDATE_VERSION,
  type NeuralPersonaCognitiveRelationType,
  type NeuralPersonaRelationshipCandidate,
  type NeuralPersonaRelationshipCandidateGenerationResult,
  type NeuralPersonaRelationshipCandidateProvider,
} from './neuralPersonaRelationshipCandidateTypes';
import { neuralPersonaRelationshipKey } from './neuralPersonaRelationshipKeys';
import type {
  NeuralPersonaEdge,
  NeuralPersonaNode,
} from './neuralPersonaTypes';

const MAX_CANDIDATES = 30;
const relationTypes = new Set<string>(NEURAL_PERSONA_COGNITIVE_RELATION_TYPES);

function numberInUnitRange(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function text(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\s+/gu, ' ').trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
}

function eligibleNodes(nodes: NeuralPersonaNode[]) {
  return nodes.filter((node) => node.status === 'active' && !node.protected
    && !isNeuralPersonaStructuralNode(node) && node.type !== 'persona-anchor');
}

function parseCandidate(
  value: unknown,
  index: number,
  nodeIds: ReadonlySet<string>,
): NeuralPersonaRelationshipCandidate | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const candidateId = text(item.candidateId, 128) ?? `relationship-${index + 1}`;
  const sourceNodeId = text(item.sourceNodeId, 256);
  const targetNodeId = text(item.targetNodeId, 256);
  const reason = text(item.reason, 240);
  if (!sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId || !reason
    || !nodeIds.has(sourceNodeId) || !nodeIds.has(targetNodeId)
    || !relationTypes.has(String(item.relationType))
    || !numberInUnitRange(item.weight) || !numberInUnitRange(item.confidence)) return null;
  return {
    candidateId, confidence: item.confidence, enabled: true, origin: 'model', reason,
    relationType: item.relationType as NeuralPersonaCognitiveRelationType,
    sourceNodeId, targetNodeId, weight: item.weight,
  };
}

function normalizeCandidates(
  raw: unknown,
  nodes: NeuralPersonaNode[],
  edges: NeuralPersonaEdge[],
) {
  if (!Array.isArray(raw) || raw.length > MAX_CANDIDATES) return null;
  const nodeIds = new Set(eligibleNodes(nodes).map((node) => node.nodeId));
  const existing = new Set(edges.filter((edge) => !isNeuralPersonaStructuralEdge(edge))
    .map(neuralPersonaRelationshipKey));
  const seen = new Set<string>();
  const candidates: NeuralPersonaRelationshipCandidate[] = [];
  raw.forEach((value, index) => {
    const candidate = parseCandidate(value, index, nodeIds);
    const key = candidate ? neuralPersonaRelationshipKey(candidate) : '';
    if (!candidate || existing.has(key) || seen.has(key)) return;
    seen.add(key); candidates.push(candidate);
  });
  return candidates;
}

export function validateNeuralPersonaRelationshipCandidate(
  candidate: NeuralPersonaRelationshipCandidate,
  nodes: NeuralPersonaNode[],
) {
  return parseCandidate(candidate, 0, new Set(eligibleNodes(nodes).map((node) => node.nodeId)))
    ? null : 'relationship-candidate-invalid';
}

export async function generateNeuralPersonaRelationshipCandidates(options: {
  batchId: string;
  edges: NeuralPersonaEdge[];
  graphVersion: string;
  nodes: NeuralPersonaNode[];
  now: number;
  provider: NeuralPersonaRelationshipCandidateProvider;
  revision: number;
  roleId: string;
  signal?: AbortSignal;
}): Promise<NeuralPersonaRelationshipCandidateGenerationResult> {
  if (eligibleNodes(options.nodes).length < 2) {
    return { reason: 'relationship-candidate-nodes-insufficient', status: 'invalid' };
  }
  const result = await options.provider.generate({
    edges: options.edges, nodes: options.nodes, requestId: options.batchId,
    roleId: options.roleId, signal: options.signal,
  });
  if (result.status !== 'ok') return result;
  const candidates = normalizeCandidates(result.candidates, options.nodes, options.edges);
  if (!candidates) return { reason: 'relationship-candidate-output-invalid', status: 'invalid' };
  if (!candidates.length) return { reason: 'relationship-candidate-empty', status: 'invalid' };
  return {
    batch: {
      batchId: options.batchId, candidates, generatedAt: options.now,
      graphVersion: options.graphVersion, providerId: options.provider.providerId,
      revision: options.revision, roleId: options.roleId,
      version: NEURAL_PERSONA_RELATIONSHIP_CANDIDATE_VERSION,
    },
    status: 'ok',
  };
}
