export interface NeuralPersonaGraphCollisionNode {
  nodeId: string;
  pinnedX?: number;
  pinnedY?: number;
  velocityX: number;
  velocityY: number;
  x: number;
  y: number;
}

function stableDirection(left: string, right: string) {
  const seed = [...`${left}:${right}`].reduce((sum, value) => sum + value.charCodeAt(0), 0);
  const angle = (seed % 360) * (Math.PI / 180);
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function gridKey(x: number, y: number, size: number) {
  return `${Math.floor(x / size)}:${Math.floor(y / size)}`;
}

function buildGrid(nodes: NeuralPersonaGraphCollisionNode[], distance: number) {
  const grid = new Map<string, NeuralPersonaGraphCollisionNode[]>();
  nodes.forEach((node) => {
    const key = gridKey(node.x, node.y, distance);
    grid.set(key, [...(grid.get(key) ?? []), node]);
  });
  return grid;
}

function separatePair(
  left: NeuralPersonaGraphCollisionNode,
  right: NeuralPersonaGraphCollisionNode,
  minimumDistance: number,
) {
  let dx = right.x - left.x; let dy = right.y - left.y;
  let distance = Math.hypot(dx, dy);
  if (distance >= minimumDistance) return;
  if (distance < 0.001) {
    const direction = stableDirection(left.nodeId, right.nodeId);
    dx = direction.x; dy = direction.y; distance = 1;
  }
  const normalX = dx / distance; const normalY = dy / distance;
  const overlap = minimumDistance - distance;
  const leftPinned = left.pinnedX !== undefined; const rightPinned = right.pinnedX !== undefined;
  const leftShare = leftPinned ? 0 : rightPinned ? 1 : 0.5;
  const rightShare = rightPinned ? 0 : leftPinned ? 1 : 0.5;
  left.x -= normalX * overlap * leftShare; left.y -= normalY * overlap * leftShare;
  right.x += normalX * overlap * rightShare; right.y += normalY * overlap * rightShare;
  const closing = (right.velocityX - left.velocityX) * normalX
    + (right.velocityY - left.velocityY) * normalY;
  if (closing >= 0) return;
  left.velocityX += normalX * closing * leftShare;
  left.velocityY += normalY * closing * leftShare;
  right.velocityX -= normalX * closing * rightShare;
  right.velocityY -= normalY * closing * rightShare;
}

export function resolveNeuralPersonaGraphCollisions(
  nodes: NeuralPersonaGraphCollisionNode[],
  minimumDistance: number,
) {
  const grid = buildGrid(nodes, minimumDistance);
  nodes.forEach((node) => {
    const cellX = Math.floor(node.x / minimumDistance);
    const cellY = Math.floor(node.y / minimumDistance);
    for (let x = cellX - 1; x <= cellX + 1; x += 1) {
      for (let y = cellY - 1; y <= cellY + 1; y += 1) {
        (grid.get(`${x}:${y}`) ?? []).forEach((other) => {
          if (node.nodeId < other.nodeId) separatePair(node, other, minimumDistance);
        });
      }
    }
  });
}
