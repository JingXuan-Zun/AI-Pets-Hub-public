import type {
  NeuralPersonaGeneratedNodeType,
  NeuralPersonaNodeGenerationCandidate,
} from './neuralPersonaNodeGenerationTypes';
import {
  NEURAL_PERSONA_SCHEMA_VERSION,
  type NeuralPersonaEdge,
  type NeuralPersonaNode,
} from './neuralPersonaTypes';

interface BranchDefinition {
  branchId: string;
  label: string;
}

const BRANCHES: Record<NeuralPersonaGeneratedNodeType, BranchDefinition> = {
  'belief-or-viewpoint': { branchId: 'belief', label: '观点与价值' },
  'concern-or-risk': { branchId: 'boundary', label: '边界与顾虑' },
  'desire-or-goal': { branchId: 'goal', label: '目标与愿望' },
  'emotional-tendency': { branchId: 'emotion', label: '情感系统' },
  experience: { branchId: 'experience', label: '经历影响' },
  preference: { branchId: 'preference', label: '偏好与厌恶' },
  'relationship-influence': { branchId: 'relationship', label: '关系认知' },
  'style-tendency': { branchId: 'expression', label: '表达风格' },
};

const EMOTION_TOPICS: Array<[RegExp, string]> = [
  [/开心|高兴|喜悦|兴奋/u, '开心'],
  [/愤怒|生气|恼火|炸鳞/u, '愤怒'],
  [/沮丧|难过|失落|委屈/u, '沮丧'],
  [/害羞|脸红/u, '害羞'],
  [/孤独|寂寞/u, '孤独'],
  [/紧张|焦虑|担心/u, '紧张与担心'],
  [/安心|平静|放松/u, '安心与平静'],
];

function normalizedLabel(value: string | undefined) {
  return value?.normalize('NFKC').replace(/[\r\n\t]+/gu, ' ')
    .replace(/\s+/gu, ' ').trim().slice(0, 40) ?? '';
}

function inferredEmotionTopic(candidate: NeuralPersonaNodeGenerationCandidate) {
  if (candidate.type !== 'emotional-tendency') return '';
  const text = `${candidate.influenceSummary} ${candidate.tags.join(' ')}`;
  return EMOTION_TOPICS.find(([pattern]) => pattern.test(text))?.[1] ?? '';
}

export function resolveGeneratedCandidateTopic(
  candidate: NeuralPersonaNodeGenerationCandidate,
) {
  return normalizedLabel(candidate.topic)
    || inferredEmotionTopic(candidate)
    || normalizedLabel(candidate.tags[0])
    || '其他设定';
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function structuralNode(options: {
  label: string;
  nodeId: string;
  parentNodeId: string;
  roleId: string;
  timestamp: number;
  type: 'cognitive-domain' | 'cognitive-topic';
}): NeuralPersonaNode {
  return {
    activationCount: 0, baseWeight: 0, confidence: 1,
    createdAt: options.timestamp, currentActivation: 0, decayRate: 0,
    influenceSummary: options.label, nodeId: options.nodeId,
    ownerRoleId: options.roleId, parentNodeId: options.parentNodeId,
    plasticity: 0, protected: false, schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION,
    scope: 'private', stability: 1, status: 'active', tags: [],
    type: options.type, updatedAt: options.timestamp,
  };
}

function structuralEdge(options: {
  roleId: string;
  sourceNodeId: string;
  targetNodeId: string;
  timestamp: number;
}): NeuralPersonaEdge {
  return {
    confidence: 1, createdAt: options.timestamp,
    edgeId: `${options.sourceNodeId}:contains:${options.targetNodeId}`,
    ownerRoleId: options.roleId, relationType: 'contains',
    schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION,
    sourceNodeId: options.sourceNodeId, targetNodeId: options.targetNodeId,
    updatedAt: options.timestamp, weight: 1,
  };
}

function domainNodeId(roleId: string, branchId: string) {
  return `cognitive-domain:${roleId}:${branchId}`;
}

function topicNodeId(roleId: string, branchId: string, topic: string) {
  return `cognitive-topic:${roleId}:${branchId}:${stableHash(topic.toLocaleLowerCase())}`;
}

export interface GeneratedHierarchyTarget {
  candidate: NeuralPersonaNodeGenerationCandidate;
  node: NeuralPersonaNode;
}

interface HierarchyBuildOptions {
  anchorNodeId: string;
  existingEdges: NeuralPersonaEdge[];
  existingNodes: NeuralPersonaNode[];
  roleId: string;
  targets: GeneratedHierarchyTarget[];
  timestamp: number;
}

function populateHierarchyTarget(
  options: HierarchyBuildOptions,
  target: GeneratedHierarchyTarget,
  ensureNode: (node: NeuralPersonaNode) => void,
  ensureEdge: (sourceNodeId: string, targetNodeId: string) => void,
  parentByNodeId: Map<string, string>,
  removedEdgeIds: Set<string>,
) {
  const branch = BRANCHES[target.node.type as NeuralPersonaGeneratedNodeType];
  const domainId = domainNodeId(options.roleId, branch.branchId);
  ensureNode(structuralNode({
    label: branch.label, nodeId: domainId, parentNodeId: options.anchorNodeId,
    roleId: options.roleId, timestamp: options.timestamp, type: 'cognitive-domain',
  }));
  ensureEdge(options.anchorNodeId, domainId);
  const topic = resolveGeneratedCandidateTopic(target.candidate);
  let parentNodeId = domainId;
  if (topic) {
    const topicId = topicNodeId(options.roleId, branch.branchId, topic);
    ensureNode(structuralNode({
      label: topic, nodeId: topicId, parentNodeId: domainId,
      roleId: options.roleId, timestamp: options.timestamp, type: 'cognitive-topic',
    }));
    ensureEdge(domainId, topicId);
    parentNodeId = topicId;
  }
  parentByNodeId.set(target.node.nodeId, parentNodeId);
  ensureEdge(parentNodeId, target.node.nodeId);
  removedEdgeIds.add(`${options.anchorNodeId}:contains:${target.node.nodeId}`);
}

export function buildGeneratedNeuralPersonaHierarchy(options: HierarchyBuildOptions) {
  const nodes = new Map(options.existingNodes.map((node) => [node.nodeId, node]));
  const branchNodes = new Map<string, NeuralPersonaNode>();
  const desiredEdges = new Map<string, NeuralPersonaEdge>();
  const parentByNodeId = new Map<string, string>();
  const removedEdgeIds = new Set<string>();
  const ensureNode = (node: NeuralPersonaNode) => {
    if (!nodes.has(node.nodeId)) branchNodes.set(node.nodeId, node);
    nodes.set(node.nodeId, node);
  };
  const ensureEdge = (sourceNodeId: string, targetNodeId: string) => {
    const edge = structuralEdge({ ...options, sourceNodeId, targetNodeId });
    desiredEdges.set(edge.edgeId, edge);
  };
  options.targets.forEach((target) => populateHierarchyTarget(
    options, target, ensureNode, ensureEdge, parentByNodeId, removedEdgeIds,
  ));
  const existingById = new Map(options.existingEdges.map((edge) => [edge.edgeId, edge]));
  desiredEdges.forEach((edge, edgeId) => {
    const current = existingById.get(edgeId);
    if (current && current.relationType !== 'contains') removedEdgeIds.add(edgeId);
  });
  const generatedEdges = [...desiredEdges.values()].filter((edge) => {
    const current = existingById.get(edge.edgeId);
    return !current || current.relationType !== 'contains';
  });
  return {
    branchNodes: [...branchNodes.values()], generatedEdges, parentByNodeId,
    removedEdgeIds: [...removedEdgeIds].filter((edgeId) => existingById.has(edgeId)),
  };
}

export function isNeuralPersonaStructuralNode(node: NeuralPersonaNode) {
  return node.type === 'cognitive-domain' || node.type === 'cognitive-topic';
}

export function isNeuralPersonaStructuralEdge(edge: NeuralPersonaEdge) {
  return edge.relationType === 'contains';
}
