import {
  createUserNeuralPersonaTag,
  type NeuralPersonaNode,
  type NeuralPersonaNodeDraft,
  type NeuralPersonaNodeStatus,
  type NeuralPersonaNodeType,
  type NeuralPersonaScope,
} from '../../character-graph/neural-persona';

export interface NeuralPersonaNodeEditorDraft {
  baseWeight: string;
  confidence: string;
  decayRate: string;
  expiresAt: string;
  groupId: string;
  influenceSummary: string;
  nodeId: string;
  parentNodeId: string;
  plasticity: string;
  protected: boolean;
  scope: NeuralPersonaScope;
  sourceRef: string;
  stability: string;
  status: NeuralPersonaNodeStatus;
  subgroupId: string;
  tags: string;
  type: NeuralPersonaNodeType;
}

const REFERENCE_NODE_TYPES: ReadonlySet<NeuralPersonaNodeType> = new Set([
  'identity-reference', 'knowledge-reference', 'memory-reference',
  'persona-anchor', 'world-state-reference',
]);

export function neuralPersonaNodeTypeNeedsSource(type: NeuralPersonaNodeType) {
  return REFERENCE_NODE_TYPES.has(type);
}

export function applyNeuralPersonaNodeEditorType(
  draft: NeuralPersonaNodeEditorDraft,
  type: NeuralPersonaNodeType,
): NeuralPersonaNodeEditorDraft {
  return {
    ...draft,
    protected: type === 'identity-reference' || type === 'persona-anchor',
    sourceRef: neuralPersonaNodeTypeNeedsSource(type) ? draft.sourceRef : '',
    type,
  };
}

export function createEmptyNeuralPersonaNodeEditorDraft(
  nodeId = '',
): NeuralPersonaNodeEditorDraft {
  return {
    baseWeight: '0.5',
    confidence: '0.8',
    decayRate: '0.1',
    expiresAt: '',
    groupId: '',
    influenceSummary: '',
    nodeId,
    parentNodeId: '',
    plasticity: '0.2',
    protected: false,
    scope: 'private',
    sourceRef: '',
    stability: '0.5',
    status: 'active',
    subgroupId: '',
    tags: '',
    type: 'preference',
  };
}

export function createNeuralPersonaNodeEditorDraft(
  node: NeuralPersonaNode,
): NeuralPersonaNodeEditorDraft {
  return {
    baseWeight: String(node.baseWeight),
    confidence: String(node.confidence),
    decayRate: String(node.decayRate),
    expiresAt: node.expiresAt === undefined ? '' : String(node.expiresAt),
    groupId: node.groupId ?? '',
    influenceSummary: node.influenceSummary,
    nodeId: node.nodeId,
    parentNodeId: node.parentNodeId ?? '',
    plasticity: String(node.plasticity),
    protected: node.protected,
    scope: node.scope,
    sourceRef: node.sourceRef ?? '',
    stability: String(node.stability),
    status: node.status,
    subgroupId: node.subgroupId ?? '',
    tags: node.tags.filter((tag) => tag.source === 'user' && tag.status === 'active')
      .map((tag) => tag.label).join(', '),
    type: node.type,
  };
}

export function mergeNeuralPersonaEditorTags(
  node: NeuralPersonaNode,
  userTags: NeuralPersonaNodeDraft['tags'],
) {
  const systemTags = node.tags.filter((tag) => tag.source === 'system');
  const systemIds = new Set(systemTags.map((tag) => tag.canonicalId));
  return [...systemTags, ...userTags.filter((tag) => !systemIds.has(tag.canonicalId))];
}

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function buildNeuralPersonaNodeDraft(
  draft: NeuralPersonaNodeEditorDraft,
): NeuralPersonaNodeDraft {
  const tags = draft.tags.split(/[,，]/u)
    .map((label) => createUserNeuralPersonaTag({ label }))
    .filter((tag) => tag !== null);
  return {
    baseWeight: numberValue(draft.baseWeight),
    confidence: numberValue(draft.confidence),
    decayRate: numberValue(draft.decayRate),
    expiresAt: draft.expiresAt.trim() ? numberValue(draft.expiresAt) : undefined,
    groupId: draft.groupId.trim() || undefined,
    influenceSummary: draft.influenceSummary.trim(),
    nodeId: draft.nodeId.trim(),
    parentNodeId: draft.parentNodeId.trim() || undefined,
    plasticity: numberValue(draft.plasticity),
    protected: draft.protected,
    scope: draft.scope,
    sourceRef: draft.sourceRef.trim() || undefined,
    stability: numberValue(draft.stability),
    status: draft.status,
    subgroupId: draft.subgroupId.trim() || undefined,
    tags,
    type: draft.type,
  };
}
