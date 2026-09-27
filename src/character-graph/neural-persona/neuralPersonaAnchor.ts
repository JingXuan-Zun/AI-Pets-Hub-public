import {
  NEURAL_PERSONA_SCHEMA_VERSION,
  type NeuralPersonaEdge,
  type NeuralPersonaNode,
} from './neuralPersonaTypes';

export const NEURAL_PERSONA_ANCHOR_NODE_TYPE = 'persona-anchor' as const;

// This node is only a graph-visible, read-only reference. The authoritative
// Persona Anchor remains the role's PetPersonality and is injected separately.

export function neuralPersonaAnchorNodeId(roleId: string) {
  return `persona-anchor:${roleId}`;
}

export function isNeuralPersonaAnchorNode(node: NeuralPersonaNode) {
  return node.type === NEURAL_PERSONA_ANCHOR_NODE_TYPE;
}

export function createNeuralPersonaAnchorNode(options: {
  personaName: string;
  roleId: string;
  timestamp: number;
}): NeuralPersonaNode {
  const name = options.personaName.trim() || options.roleId;
  return {
    activationCount: 0, baseWeight: 1, confidence: 1,
    createdAt: options.timestamp, currentActivation: 0, decayRate: 0,
    influenceSummary: `主要人格：${name}`.slice(0, 240),
    nodeId: neuralPersonaAnchorNodeId(options.roleId),
    ownerRoleId: options.roleId, plasticity: 0, protected: true,
    schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION,
    scope: 'private', sourceRef: `persona-store:${options.roleId}`,
    stability: 1, status: 'active', tags: [],
    type: NEURAL_PERSONA_ANCHOR_NODE_TYPE, updatedAt: options.timestamp,
  };
}

export function createNeuralPersonaAnchorEdge(options: {
  anchorNodeId: string;
  roleId: string;
  targetNodeId: string;
  timestamp: number;
}): NeuralPersonaEdge {
  return {
    confidence: 1, createdAt: options.timestamp,
    edgeId: `${options.anchorNodeId}:contains:${options.targetNodeId}`,
    ownerRoleId: options.roleId, relationType: 'associated-with',
    schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION,
    sourceNodeId: options.anchorNodeId, targetNodeId: options.targetNodeId,
    updatedAt: options.timestamp, weight: 1,
  };
}
