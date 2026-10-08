export const NEURAL_PERSONA_SCHEMA_VERSION = 1 as const;
export const NEURAL_CONTEXT_CONTRIBUTION_VERSION = 'neural-context-contribution.v1' as const;

export type NeuralPersonaMode = 'classic' | 'hybrid' | 'neural';

export type NeuralPersonaScope =
  | 'group'
  | 'private'
  | 'runtime'
  | 'subgroup'
  | 'world';

export type NeuralPersonaNodeStatus =
  | 'active'
  | 'deleted'
  | 'pending-review'
  | 'quarantined';

export type NeuralPersonaNodeType =
  | 'belief-or-viewpoint'
  | 'cognitive-domain'
  | 'cognitive-topic'
  | 'concern-or-risk'
  | 'desire-or-goal'
  | 'emotional-tendency'
  | 'experience'
  | 'identity-reference'
  | 'knowledge-reference'
  | 'memory-reference'
  | 'persona-anchor'
  | 'preference'
  | 'relationship-influence'
  | 'style-tendency'
  | 'temporary-cognitive-state'
  | 'world-state-reference';

export type NeuralPersonaEdgeType =
  | 'associated-with'
  | 'contains'
  | 'derived-from'
  | 'inhibits'
  | 'opposes'
  | 'protects'
  | 'related-to-person'
  | 'related-to-topic'
  | 'reminds-of'
  | 'supports'
  | 'threatens'
  | 'triggers';

export type NeuralPersonaTagSource = 'system' | 'user';
export type NeuralPersonaTagStatus = 'active' | 'pending-review' | 'rejected';

export interface NeuralPersonaTag {
  aliases?: string[];
  canonicalId: string;
  confidence?: number;
  label: string;
  reviewedAt?: number;
  reviewerId?: string;
  source: NeuralPersonaTagSource;
  status: NeuralPersonaTagStatus;
}

export interface NeuralPersonaLearningValues {
  baseWeight: number;
  confidence: number;
  stability: number;
}

export interface NeuralPersonaLearningApplicationMarker {
  appliedAt: number;
  appliedBy: string;
  appliedValues?: NeuralPersonaLearningValues;
  commandId: string;
  previousValues?: NeuralPersonaLearningValues;
  proposalId: string;
  reversalCommandId?: string;
  reversalGraphRevision?: number;
  reversedAt?: number;
  reversedBy?: string;
  sourceGraphRevision: number;
  sourceLedgerRevision: number;
  targetGraphRevision: number;
}

export interface NeuralPersonaSourceDocument {
  content: string;
  contentFingerprint: string;
  createdAt: number;
  ownerRoleId: string;
  sourceId: string;
  title: string;
  type: 'persona-import';
}

export interface NeuralPersonaSourceReference {
  blockId: string;
  endOffset: number;
  quote: string;
  sourceId: string;
  startOffset: number;
}

export interface NeuralPersonaNode {
  activationCount: number;
  baseWeight: number;
  confidence: number;
  cooldownUntil?: number;
  createdAt: number;
  currentActivation: number;
  decayRate: number;
  expiresAt?: number;
  groupId?: string;
  influenceSummary: string;
  lastActivatedAt?: number;
  learningApplication?: NeuralPersonaLearningApplicationMarker;
  nodeId: string;
  normalizedContent?: string;
  ownerRoleId: string;
  parentNodeId?: string;
  plasticity: number;
  protected: boolean;
  schemaVersion: typeof NEURAL_PERSONA_SCHEMA_VERSION;
  scope: NeuralPersonaScope;
  retrievalSummary?: string;
  sourceRef?: string;
  sourceReferences?: NeuralPersonaSourceReference[];
  stability: number;
  status: NeuralPersonaNodeStatus;
  subgroupId?: string;
  tags: NeuralPersonaTag[];
  type: NeuralPersonaNodeType;
  updatedAt: number;
}

export interface NeuralPersonaEdge {
  /** Text in the source node's content that the user linked to the target node. */
  anchorText?: string;
  confidence: number;
  createdAt: number;
  edgeId: string;
  lastReinforcedAt?: number;
  ownerRoleId: string;
  relationType: NeuralPersonaEdgeType;
  schemaVersion: typeof NEURAL_PERSONA_SCHEMA_VERSION;
  sourceNodeId: string;
  targetNodeId: string;
  updatedAt: number;
  weight: number;
}

export interface NeuralPersonaGraphSnapshot {
  createdAt: number;
  edges: NeuralPersonaEdge[];
  graphVersion: string;
  nodes: NeuralPersonaNode[];
  roleId: string;
  schemaVersion: typeof NEURAL_PERSONA_SCHEMA_VERSION;
  sources?: NeuralPersonaSourceDocument[];
}

export interface NeuralPersonaContextInput {
  groupIds: string[];
  includePrivate: boolean;
  now: number;
  query: string;
  requestId: string;
  roleId: string;
  sessionId: string;
  subgroupIds: string[];
  turnId: string;
}

export interface NeuralContextInfluence {
  confidence: number;
  intensity: number;
  nodeId: string;
  reason: string[];
  sourceRef?: string;
  summary: string;
  type: NeuralPersonaNodeType;
}

export interface NeuralContextContribution {
  generatedAt: number;
  influences: NeuralContextInfluence[];
  requestId: string;
  roleId: string;
  tokenBudgetUsed: number;
  traceId?: string;
  turnId: string;
  version: typeof NEURAL_CONTEXT_CONTRIBUTION_VERSION;
}

export interface NeuralPersonaTrace {
  candidateNodeIds: string[];
  configVersion: string;
  createdAt: number;
  filteredNodeIds: string[];
  graphVersion: string;
  requestId: string;
  roleId: string;
  selectedNodeIds: string[];
  traceId: string;
  turnId: string;
}
