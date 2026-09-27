import type { NeuralPersonaEdgeType } from './neuralPersonaTypes';

export function neuralPersonaRelationshipKey(options: {
  relationType: NeuralPersonaEdgeType;
  sourceNodeId: string;
  targetNodeId: string;
}) {
  const pair = options.relationType === 'associated-with'
    ? [options.sourceNodeId, options.targetNodeId].sort()
    : [options.sourceNodeId, options.targetNodeId];
  return `${pair[0]}\u0000${options.relationType}\u0000${pair[1]}`;
}
