export type NeuralPersonaGraphCenterPoint = { x: number; y: number };

interface CenterForceNode extends NeuralPersonaGraphCenterPoint {
  pinnedX?: number;
  velocityX: number;
  velocityY: number;
}

export function neuralPersonaGraphCenter(
  nodes: NeuralPersonaGraphCenterPoint[],
): NeuralPersonaGraphCenterPoint {
  if (!nodes.length) return { x: 0, y: 0 };
  const total = nodes.reduce((sum, node) => ({
    x: sum.x + node.x, y: sum.y + node.y,
  }), { x: 0, y: 0 });
  return { x: total.x / nodes.length, y: total.y / nodes.length };
}

export function applyNeuralPersonaGraphCenterForce(
  allNodes: CenterForceNode[],
  activeNodes: CenterForceNode[],
  target: NeuralPersonaGraphCenterPoint,
  strength: number,
  alpha: number,
  timeScale: number,
) {
  if (!activeNodes.length || strength <= 0) return;
  const current = neuralPersonaGraphCenter(allNodes);
  const velocityX = (target.x - current.x) * strength * alpha * timeScale;
  const velocityY = (target.y - current.y) * strength * alpha * timeScale;
  activeNodes.forEach((node) => {
    if (node.pinnedX !== undefined) return;
    node.velocityX += velocityX;
    node.velocityY += velocityY;
  });
}
