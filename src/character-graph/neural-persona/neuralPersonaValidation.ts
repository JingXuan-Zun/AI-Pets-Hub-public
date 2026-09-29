import type {
  NeuralPersonaEdge,
  NeuralPersonaGraphSnapshot,
  NeuralPersonaLearningValues,
  NeuralPersonaNode,
} from './neuralPersonaTypes';
import type { NeuralPersonaConfig } from './neuralPersonaConfig';
import { isReservedNeuralPersonaStorageRoleId } from './neuralPersonaStorageNamespaces';

export type NeuralPersonaValidationIssueCode =
  | 'duplicate-edge-id'
  | 'duplicate-node-id'
  | 'duplicate-tag-id'
  | 'edge-id-missing'
  | 'edge-crosses-role-boundary'
  | 'edge-node-missing'
  | 'edge-role-mismatch'
  | 'edge-self-reference'
  | 'graph-role-mismatch'
  | 'graph-role-reserved'
  | 'group-id-missing'
  | 'identity-reference-not-protected'
  | 'learning-application-metadata-invalid'
  | 'node-id-missing'
  | 'node-role-missing'
  | 'node-value-out-of-range'
  | 'persona-anchor-not-protected'
  | 'protected-type-invalid'
  | 'reference-source-missing'
  | 'summary-empty'
  | 'summary-too-long'
  | 'subgroup-id-missing'
  | 'tag-limit-exceeded'
  | 'tag-record-limit-exceeded'
  | 'tag-confidence-out-of-range'
  | 'tag-id-missing'
  | 'tag-review-metadata-invalid'
  | 'temporary-expiry-missing';

export interface NeuralPersonaValidationIssue {
  code: NeuralPersonaValidationIssueCode;
  targetId: string;
}

const REFERENCE_NODE_TYPES = new Set<NeuralPersonaNode['type']>([
  'identity-reference',
  'knowledge-reference',
  'memory-reference',
  'persona-anchor',
  'world-state-reference',
]);

const PROTECTED_NODE_TYPES = new Set<NeuralPersonaNode['type']>([
  'identity-reference', 'persona-anchor',
]);

function inUnitRange(value: number) {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function validLearningValues(value: NeuralPersonaLearningValues | undefined) {
  return value === undefined || [value.baseWeight, value.confidence, value.stability]
    .every(inUnitRange);
}

function validReversalMetadata(marker: NonNullable<NeuralPersonaNode['learningApplication']>) {
  const fields = [marker.reversalCommandId, marker.reversalGraphRevision,
    marker.reversedAt, marker.reversedBy];
  if (fields.every((value) => value === undefined)) return true;
  return fields.every((value) => value !== undefined)
    && Boolean(marker.reversalCommandId?.trim() && marker.reversalCommandId.length <= 128)
    && Boolean(marker.reversedBy?.trim() && marker.reversedBy.length <= 128)
    && Number.isSafeInteger(marker.reversedAt) && Number(marker.reversedAt) >= 0
    && Number.isSafeInteger(marker.reversalGraphRevision)
    && Number(marker.reversalGraphRevision) > marker.targetGraphRevision;
}

function validLearningApplication(node: NeuralPersonaNode) {
  const marker = node.learningApplication;
  if (!marker) return true;
  const revisions = [marker.sourceGraphRevision, marker.sourceLedgerRevision,
    marker.targetGraphRevision];
  return Boolean(marker.proposalId.trim() && marker.proposalId.length <= 128
    && marker.commandId.trim() && marker.commandId.length <= 128
    && marker.appliedBy.trim() && marker.appliedBy.length <= 128
    && Number.isSafeInteger(marker.appliedAt) && marker.appliedAt >= 0
    && revisions.every((value) => Number.isSafeInteger(value) && value >= 0)
    && marker.targetGraphRevision === marker.sourceGraphRevision + 1
    && (marker.appliedValues === undefined) === (marker.previousValues === undefined)
    && validLearningValues(marker.appliedValues)
    && validLearningValues(marker.previousValues)
    && validReversalMetadata(marker));
}

function validateNode(node: NeuralPersonaNode, config: NeuralPersonaConfig) {
  const issues: NeuralPersonaValidationIssue[] = [];
  const add = (code: NeuralPersonaValidationIssueCode) => issues.push({ code, targetId: node.nodeId });
  if (!node.nodeId.trim()) add('node-id-missing');
  if (!node.ownerRoleId.trim()) add('node-role-missing');
  if (!node.influenceSummary.trim()) add('summary-empty');
  if (node.influenceSummary.length > config.maxInfluenceSummaryCharacters) add('summary-too-long');
  if (node.tags.filter((tag) => tag.status !== 'rejected').length > config.maxTagsPerNode) {
    add('tag-limit-exceeded');
  }
  if (node.tags.length > config.maxTagRecordsPerNode) add('tag-record-limit-exceeded');
  const tagIds = node.tags.map((tag) => tag.canonicalId.trim());
  if (tagIds.some((tagId) => !tagId)) add('tag-id-missing');
  if (new Set(tagIds).size !== tagIds.length) add('duplicate-tag-id');
  if (node.tags.some((tag) => tag.confidence !== undefined && !inUnitRange(tag.confidence))) {
    add('tag-confidence-out-of-range');
  }
  if (node.tags.some((tag) => (tag.reviewedAt === undefined) !== (tag.reviewerId === undefined)
    || (tag.reviewedAt !== undefined && (!Number.isFinite(tag.reviewedAt)
      || !tag.reviewerId?.trim())))) add('tag-review-metadata-invalid');
  if (node.scope === 'group' && !node.groupId?.trim()) add('group-id-missing');
  if (node.scope === 'subgroup' && !node.subgroupId?.trim()) add('subgroup-id-missing');
  const values = [node.baseWeight, node.confidence, node.currentActivation,
    node.decayRate, node.plasticity, node.stability];
  if (!values.every(inUnitRange)) add('node-value-out-of-range');
  if (REFERENCE_NODE_TYPES.has(node.type) && !node.sourceRef?.trim()) add('reference-source-missing');
  if (node.type === 'identity-reference' && !node.protected) add('identity-reference-not-protected');
  if (node.type === 'persona-anchor' && !node.protected) add('persona-anchor-not-protected');
  if (node.protected && !PROTECTED_NODE_TYPES.has(node.type)) add('protected-type-invalid');
  if (node.type === 'temporary-cognitive-state' && node.expiresAt === undefined) {
    add('temporary-expiry-missing');
  }
  if (!validLearningApplication(node)) add('learning-application-metadata-invalid');
  return issues;
}

function validateEdge(
  edge: NeuralPersonaEdge,
  nodesById: ReadonlyMap<string, NeuralPersonaNode>,
) {
  const issues: NeuralPersonaValidationIssue[] = [];
  const add = (code: NeuralPersonaValidationIssueCode) => issues.push({ code, targetId: edge.edgeId });
  if (!edge.edgeId.trim()) add('edge-id-missing');
  const source = nodesById.get(edge.sourceNodeId);
  const target = nodesById.get(edge.targetNodeId);
  if (!source || !target) add('edge-node-missing');
  if (edge.sourceNodeId === edge.targetNodeId) add('edge-self-reference');
  if (source && target && (source.ownerRoleId !== edge.ownerRoleId
    || target.ownerRoleId !== edge.ownerRoleId)) add('edge-crosses-role-boundary');
  if (!inUnitRange(edge.weight) || !inUnitRange(edge.confidence)) add('node-value-out-of-range');
  return issues;
}

function duplicateIssues(
  ids: string[],
  code: 'duplicate-edge-id' | 'duplicate-node-id',
) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  ids.forEach((id) => (seen.has(id) ? duplicates.add(id) : seen.add(id)));
  return [...duplicates].map((targetId) => ({ code, targetId }));
}

export function validateNeuralPersonaGraph(
  graph: NeuralPersonaGraphSnapshot,
  config: NeuralPersonaConfig,
) {
  const issues: NeuralPersonaValidationIssue[] = [];
  if (isReservedNeuralPersonaStorageRoleId(graph.roleId)) {
    issues.push({ code: 'graph-role-reserved', targetId: graph.roleId });
  }
  issues.push(...duplicateIssues(graph.nodes.map((node) => node.nodeId), 'duplicate-node-id'));
  issues.push(...duplicateIssues(graph.edges.map((edge) => edge.edgeId), 'duplicate-edge-id'));
  graph.nodes.forEach((node) => {
    if (node.ownerRoleId !== graph.roleId) {
      issues.push({ code: 'graph-role-mismatch', targetId: node.nodeId });
    }
    issues.push(...validateNode(node, config));
  });
  const nodesById = new Map(graph.nodes.map((node) => [node.nodeId, node]));
  graph.edges.forEach((edge) => issues.push(...validateEdge(edge, nodesById)));
  graph.edges.filter((edge) => edge.ownerRoleId !== graph.roleId).forEach((edge) => {
    issues.push({ code: 'edge-role-mismatch', targetId: edge.edgeId });
  });
  return { issues, valid: issues.length === 0 };
}
