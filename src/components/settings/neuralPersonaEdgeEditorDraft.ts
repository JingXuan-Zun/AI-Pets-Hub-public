import type {
  NeuralPersonaEdge,
  NeuralPersonaEdgeDraft,
  NeuralPersonaEdgePatch,
  NeuralPersonaEdgeType,
} from '../../character-graph/neural-persona';

export interface NeuralPersonaEdgeEditorDraft {
  confidence: string;
  edgeId: string;
  relationType: NeuralPersonaEdgeType;
  sourceNodeId: string;
  targetNodeId: string;
  weight: string;
}

export function createEmptyNeuralPersonaEdgeEditorDraft(
  nodeIds: string[] = [],
  edgeId = '',
): NeuralPersonaEdgeEditorDraft {
  return {
    confidence: '1',
    edgeId,
    relationType: 'associated-with',
    sourceNodeId: nodeIds[0] ?? '',
    targetNodeId: nodeIds[1] ?? nodeIds[0] ?? '',
    weight: '0.5',
  };
}

export function createNeuralPersonaEdgeEditorDraft(
  edge: NeuralPersonaEdge,
): NeuralPersonaEdgeEditorDraft {
  return {
    confidence: String(edge.confidence),
    edgeId: edge.edgeId,
    relationType: edge.relationType,
    sourceNodeId: edge.sourceNodeId,
    targetNodeId: edge.targetNodeId,
    weight: String(edge.weight),
  };
}

export function buildNeuralPersonaEdgeDraft(
  draft: NeuralPersonaEdgeEditorDraft,
): NeuralPersonaEdgeDraft {
  return {
    confidence: Number(draft.confidence),
    edgeId: draft.edgeId.trim(),
    relationType: draft.relationType,
    sourceNodeId: draft.sourceNodeId.trim(),
    targetNodeId: draft.targetNodeId.trim(),
    weight: Number(draft.weight),
  };
}

export function buildNeuralPersonaEdgePatch(
  draft: NeuralPersonaEdgeEditorDraft,
): NeuralPersonaEdgePatch {
  return {
    confidence: Number(draft.confidence),
    relationType: draft.relationType,
    weight: Number(draft.weight),
  };
}
