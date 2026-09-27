export interface NeuralPersonaGraphEdgeVisualStyle {
  alpha: number;
  color: number;
  width: number;
}

export function resolveNeuralPersonaGraphEdgeVisualStyle(input: {
  activationPath?: boolean;
  activationPreview?: boolean;
  edgeId: string;
  selectedEdgeId?: string;
  selectedNodeId?: string;
  sourceNodeId: string;
  targetNodeId: string;
  weight: number;
}): NeuralPersonaGraphEdgeVisualStyle {
  const defaultWidth = 1 + input.weight * 2;
  if (input.activationPath) {
    return { alpha: 1, color: 0x22d3ee, width: defaultWidth + 2 };
  }
  if (input.activationPreview) {
    return { alpha: 0.16, color: 0x334155, width: Math.max(0.75, defaultWidth * 0.55) };
  }
  if (input.edgeId === input.selectedEdgeId) {
    return { alpha: 1, color: 0x67e8f9, width: defaultWidth + 1 };
  }
  if (!input.selectedNodeId) {
    return { alpha: 0.8, color: 0x334155, width: defaultWidth };
  }
  const connected = input.sourceNodeId === input.selectedNodeId
    || input.targetNodeId === input.selectedNodeId;
  if (connected) {
    return { alpha: 0.98, color: 0x94a3b8, width: defaultWidth + 0.75 };
  }
  return {
    alpha: 0.2,
    color: 0x334155,
    width: Math.max(0.75, defaultWidth * 0.65),
  };
}
