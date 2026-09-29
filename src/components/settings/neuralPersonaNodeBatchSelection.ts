export function toggleNeuralPersonaNodeBatchSelection(
  selectedNodeIds: string[],
  nodeId: string,
) {
  return selectedNodeIds.includes(nodeId)
    ? selectedNodeIds.filter((candidate) => candidate !== nodeId)
    : [...selectedNodeIds, nodeId];
}
