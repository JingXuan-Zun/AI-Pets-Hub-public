import {
  resolveNeuralPersonaGraphRepulsionDistance,
  type NeuralPersonaGraphPhysicsConfig,
} from './neuralPersonaGraphPhysicsConfig';

interface RepulsionNode {
  nodeId: string;
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

function addPairForce(
  left: RepulsionNode, right: RepulsionNode, alpha: number,
  config: NeuralPersonaGraphPhysicsConfig,
) {
  let dx = right.x - left.x;
  let dy = right.y - left.y;
  let distance = Math.hypot(dx, dy);
  const repulsionDistance = resolveNeuralPersonaGraphRepulsionDistance(config);
  if (distance >= repulsionDistance) return;
  if (distance < 0.01) {
    const direction = stableDirection(left.nodeId, right.nodeId);
    dx = direction.x; dy = direction.y; distance = 1;
  }
  const collision = Math.max(0, config.collisionDistance - distance) * config.collisionStrength;
  const repulsion = (1 - distance / repulsionDistance) * config.repulsionStrength;
  const force = (collision + repulsion) * alpha;
  const forceX = (dx / distance) * force;
  const forceY = (dy / distance) * force;
  left.velocityX -= forceX; left.velocityY -= forceY;
  right.velocityX += forceX; right.velocityY += forceY;
}

function gridKey(x: number, y: number, gridSize: number) {
  return `${Math.floor(x / gridSize)}:${Math.floor(y / gridSize)}`;
}

function buildGrid(nodes: RepulsionNode[], gridSize: number) {
  const grid = new Map<string, RepulsionNode[]>();
  nodes.forEach((node) => {
    const key = gridKey(node.x, node.y, gridSize);
    grid.set(key, [...(grid.get(key) ?? []), node]);
  });
  return grid;
}

export function applyNeuralPersonaGraphRepulsion(
  nodes: RepulsionNode[], alpha: number, config: NeuralPersonaGraphPhysicsConfig,
) {
  const distance = resolveNeuralPersonaGraphRepulsionDistance(config);
  const grid = buildGrid(nodes, distance);
  nodes.forEach((node) => {
    const cellX = Math.floor(node.x / distance);
    const cellY = Math.floor(node.y / distance);
    for (let x = cellX - 1; x <= cellX + 1; x += 1) {
      for (let y = cellY - 1; y <= cellY + 1; y += 1) {
        (grid.get(`${x}:${y}`) ?? []).forEach((other) => {
          if (node.nodeId < other.nodeId) addPairForce(node, other, alpha, config);
        });
      }
    }
  });
}
