import type { NeuralPersonaGraphViewEdge } from './neuralPersonaGraphProjection';
import type { NeuralPersonaLayoutNode } from './neuralPersonaGraphLayout';
import { resolveNeuralPersonaGraphCollisions } from './neuralPersonaGraphCollision';
import { applyNeuralPersonaGraphCenterForce, neuralPersonaGraphCenter, type NeuralPersonaGraphCenterPoint } from './neuralPersonaGraphCenterForce';
import { maintainNeuralPersonaGraphLinkConvergence, NEURAL_PERSONA_GRAPH_SETTLE_BUDGET } from './neuralPersonaGraphConvergence';
import { buildNeuralPersonaGraphDragInfluences, dedupeNeuralPersonaGraphPhysicsEdges, translateNeuralPersonaGraphFollowers, type NeuralPersonaGraphDragInfluences } from './neuralPersonaGraphDrag';
import { limitNeuralPersonaGraphDragStretch } from './neuralPersonaGraphDragConstraint';
import {
  normalizeNeuralPersonaGraphPhysicsConfig,
  resolveNeuralPersonaGraphRepulsionDistance,
  type NeuralPersonaGraphPhysicsConfig,
} from './neuralPersonaGraphPhysicsConfig';
import { applyNeuralPersonaGraphRepulsion } from './neuralPersonaGraphRepulsion';
import {
  hasNeuralPersonaGraphExtremeStretch,
  recoverNeuralPersonaGraphExtremeStretch,
} from './neuralPersonaGraphRecovery';
export type NeuralPersonaGraphPhysicsPoint = { x: number; y: number };
export interface NeuralPersonaGraphPhysics {
  getPosition: (nodeId: string) => NeuralPersonaGraphPhysicsPoint | null;
  isActive: () => boolean;
  movePinned: (nodeId: string, point: NeuralPersonaGraphPhysicsPoint) => void;
  pin: (nodeId: string) => void;
  release: (nodeId: string) => void;
  reset: () => void;
  setConfig: (config: Partial<NeuralPersonaGraphPhysicsConfig>) => void;
  step: (timeScale?: number) => number;
}
interface PhysicsNode extends NeuralPersonaGraphPhysicsPoint {
  anchorX: number;
  anchorY: number;
  nodeId: string;
  pinnedX?: number;
  pinnedY?: number;
  velocityX: number;
  velocityY: number;
}
interface PhysicsLink {
  desiredDistance?: number;
  source: PhysicsNode;
  target: PhysicsNode;
  weight: number;
}
interface SimulationState {
  activeNodeIds?: Set<string>;
  alpha: number;
  bestLinkError?: number;
  center: NeuralPersonaGraphCenterPoint;
  dragInfluences?: NeuralPersonaGraphDragInfluences;
  dragLinkMaximums?: ReadonlyMap<PhysicsLink, number>;
  extremeRecovery: boolean;
  extremeRecoveryFrames: number;
  pinnedNodeId?: string;
  settleRemaining: number;
}

function applyLinks(
  links: PhysicsLink[], alpha: number, config: NeuralPersonaGraphPhysicsConfig,
) {
  links.forEach((link) => {
    const dx = link.target.x - link.source.x;
    const dy = link.target.y - link.source.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const desired = link.desiredDistance ?? config.linkDistance;
    const force = (distance - desired)
      * (config.linkStrength + link.weight * config.linkWeightStrength) * alpha;
    const forceX = (dx / distance) * force;
    const forceY = (dy / distance) * force;
    link.source.velocityX += forceX;
    link.source.velocityY += forceY;
    link.target.velocityX -= forceX;
    link.target.velocityY -= forceY;
  });
}

function integrateNode(
  node: PhysicsNode,
  alpha: number,
  timeScale: number,
  config: NeuralPersonaGraphPhysicsConfig,
) {
  if (node.pinnedX !== undefined && node.pinnedY !== undefined) {
    node.x = node.pinnedX;
    node.y = node.pinnedY;
    node.velocityX = 0;
    node.velocityY = 0;
    return;
  }
  const damping = Math.pow(config.damping, timeScale);
  node.velocityX = Math.max(-config.maxVelocity, Math.min(config.maxVelocity, node.velocityX * damping));
  node.velocityY = Math.max(-config.maxVelocity, Math.min(config.maxVelocity, node.velocityY * damping));
  node.x += node.velocityX * timeScale;
  node.y += node.velocityY * timeScale;
}

function createNodes(layoutNodes: NeuralPersonaLayoutNode[]) {
  return layoutNodes.map((node): PhysicsNode => ({
    anchorX: node.x, anchorY: node.y, nodeId: node.nodeId,
    velocityX: 0, velocityY: 0, x: node.x, y: node.y,
  }));
}
function createLinks(nodes: Map<string, PhysicsNode>, edges: NeuralPersonaGraphViewEdge[]) {
  return dedupeNeuralPersonaGraphPhysicsEdges(edges).flatMap((edge): PhysicsLink[] => {
    const source = nodes.get(edge.sourceNodeId);
    const target = nodes.get(edge.targetNodeId);
    const desiredDistance = source && target && edge.relationType === 'contains'
      ? Math.hypot(target.x - source.x, target.y - source.y) : undefined;
    return source && target ? [{ desiredDistance, source, target, weight: edge.weight }] : [];
  });
}

function localDragNodeIds(
  rootNodeId: string,
  nodes: PhysicsNode[],
  links: PhysicsLink[],
  config: NeuralPersonaGraphPhysicsConfig,
) {
  const activeNodeIds = new Set([rootNodeId]);
  let previousSize = -1;
  while (previousSize !== activeNodeIds.size) {
    previousSize = activeNodeIds.size;
    links.forEach((link) => {
      if (activeNodeIds.has(link.source.nodeId)) activeNodeIds.add(link.target.nodeId);
      if (activeNodeIds.has(link.target.nodeId)) activeNodeIds.add(link.source.nodeId);
    });
  }
  const root = nodes.find((node) => node.nodeId === rootNodeId);
  if (!root) return activeNodeIds;
  nodes.forEach((node) => {
    if (Math.hypot(node.x - root.x, node.y - root.y)
      <= resolveNeuralPersonaGraphRepulsionDistance(config) * config.dragNeighborRange) {
      activeNodeIds.add(node.nodeId);
    }
  });
  return activeNodeIds;
}

function activeSimulationParts(
  nodes: PhysicsNode[],
  links: PhysicsLink[],
  activeNodeIds?: Set<string>,
) {
  if (!activeNodeIds) return { links, nodes };
  return {
    links: links.filter((link) => (
      activeNodeIds.has(link.source.nodeId) && activeNodeIds.has(link.target.nodeId)
    )),
    nodes: nodes.filter((node) => activeNodeIds.has(node.nodeId)),
  };
}

function captureDragLinkMaximums(links: PhysicsLink[], maximumDistance: number) {
  return new Map(links.map((link) => [link, Math.max(
    maximumDistance,
    Math.hypot(link.target.x - link.source.x, link.target.y - link.source.y),
  )]));
}

function simulateStep(
  nodes: PhysicsNode[],
  links: PhysicsLink[],
  state: SimulationState,
  timeScale: number,
  config: NeuralPersonaGraphPhysicsConfig,
) {
  const active = activeSimulationParts(nodes, links, state.activeNodeIds);
  applyLinks(active.links, state.alpha * timeScale, config);
  applyNeuralPersonaGraphRepulsion(active.nodes, state.alpha * timeScale, config);
  if (!state.pinnedNodeId) applyNeuralPersonaGraphCenterForce(
    nodes, active.nodes, state.center, config.anchorStrength, state.alpha, timeScale,
  );
  active.nodes.forEach((node) => integrateNode(
    node, state.alpha, timeScale, config,
  ));
  if (config.collisionStrength > 0 && !state.pinnedNodeId) resolveNeuralPersonaGraphCollisions(active.nodes, config.collisionDistance);
  if (state.extremeRecovery && !state.pinnedNodeId) {
    recoverNeuralPersonaGraphExtremeStretch(active.links, config.linkDistance,
      config.maxVelocity * 1.5, timeScale, state.extremeRecoveryFrames += timeScale);
  }
  const decay = nodes.some((node) => node.pinnedX !== undefined) ? 0.985 : 0.94;
  state.alpha *= Math.pow(decay, timeScale);
  maintainNeuralPersonaGraphLinkConvergence(
    active.links, state, config.linkDistance, timeScale,
  );
}

function stepSimulation(
  nodes: PhysicsNode[], links: PhysicsLink[], state: SimulationState,
  timeScale: number, config: NeuralPersonaGraphPhysicsConfig,
) {
  let remaining = Math.max(0, Math.min(4, timeScale));
  while (remaining > 0.0001) {
    const step = Math.min(1, remaining);
    simulateStep(nodes, links, state, step, config);
    remaining -= step;
  }
  return state.alpha;
}

function resetSimulation(nodes: PhysicsNode[], state: SimulationState) {
  nodes.forEach((node) => Object.assign(node, {
    pinnedX: undefined, pinnedY: undefined, velocityX: 0, velocityY: 0,
    x: node.anchorX, y: node.anchorY,
  }));
  state.activeNodeIds = undefined;
  state.alpha = 0;
  state.bestLinkError = undefined;
  state.dragLinkMaximums = undefined;
  state.extremeRecovery = false;
  state.pinnedNodeId = undefined;
  state.settleRemaining = 0;
}

function movePinnedNode(nodeId: string, point: NeuralPersonaGraphPhysicsPoint,
  nodes: Map<string, PhysicsNode>, nodeList: PhysicsNode[], links: PhysicsLink[],
  edges: NeuralPersonaGraphViewEdge[], state: SimulationState, config: NeuralPersonaGraphPhysicsConfig) {
  const node = nodes.get(nodeId);
  if (!node) return;
  if (state.pinnedNodeId !== nodeId) {
    state.dragInfluences = buildNeuralPersonaGraphDragInfluences(nodeId, edges);
  }
  const delta = { x: point.x - node.x, y: point.y - node.y };
  translateNeuralPersonaGraphFollowers(nodes, state.dragInfluences ?? {}, nodeId, delta, config.dragFollowStrength);
  Object.assign(node, { pinnedX: point.x, pinnedY: point.y, velocityX: 0,
    velocityY: 0, x: point.x, y: point.y });
  limitNeuralPersonaGraphDragStretch(
    links, nodeId, config.dragMaxStretch, state.dragLinkMaximums,
  );
  state.activeNodeIds = localDragNodeIds(nodeId, nodeList, links, config);
  state.pinnedNodeId = nodeId;
  state.settleRemaining = NEURAL_PERSONA_GRAPH_SETTLE_BUDGET;
  state.alpha = Math.max(state.alpha, 0.48);
}

function pinPhysicsNode(
  nodeId: string, nodes: Map<string, PhysicsNode>, nodeList: PhysicsNode[],
  links: PhysicsLink[], edges: NeuralPersonaGraphViewEdge[],
  state: SimulationState, config: NeuralPersonaGraphPhysicsConfig,
) {
  const node = nodes.get(nodeId);
  if (!node) return;
  node.pinnedX = node.x; node.pinnedY = node.y;
  state.activeNodeIds = localDragNodeIds(nodeId, nodeList, links, config);
  state.dragInfluences = buildNeuralPersonaGraphDragInfluences(nodeId, edges);
  state.dragLinkMaximums = captureDragLinkMaximums(links, config.dragMaxStretch);
  state.extremeRecovery = false; state.pinnedNodeId = nodeId;
  state.bestLinkError = undefined;
  state.settleRemaining = NEURAL_PERSONA_GRAPH_SETTLE_BUDGET;
  state.alpha = Math.max(state.alpha, 0.55);
}

function releasePhysicsNode(
  nodeId: string, nodes: Map<string, PhysicsNode>, links: PhysicsLink[],
  state: SimulationState, config: NeuralPersonaGraphPhysicsConfig,
) {
  const node = nodes.get(nodeId);
  if (!node) return;
  delete node.pinnedX; delete node.pinnedY;
  state.dragInfluences = undefined; state.dragLinkMaximums = undefined;
  state.pinnedNodeId = undefined;
  state.extremeRecovery = hasNeuralPersonaGraphExtremeStretch(
    links, config.linkDistance,
  );
  state.bestLinkError = undefined; state.extremeRecoveryFrames = 0;
  state.settleRemaining = NEURAL_PERSONA_GRAPH_SETTLE_BUDGET;
  state.alpha = Math.max(state.alpha, 0.42);
}

export function createNeuralPersonaGraphPhysics(layoutNodes: NeuralPersonaLayoutNode[], edges: NeuralPersonaGraphViewEdge[], inputConfig?: Partial<NeuralPersonaGraphPhysicsConfig>): NeuralPersonaGraphPhysics {
  let config = normalizeNeuralPersonaGraphPhysicsConfig(inputConfig);
  const nodeList = createNodes(layoutNodes);
  const nodes = new Map(nodeList.map((node) => [node.nodeId, node]));
  const links = createLinks(nodes, edges);
  const state: SimulationState = {
    alpha: 0, center: neuralPersonaGraphCenter(nodeList),
    extremeRecovery: false, extremeRecoveryFrames: 0, settleRemaining: 0,
  };
  return {
    getPosition: (nodeId: string) => nodes.get(nodeId) ?? null,
    isActive: () => state.alpha > 0.012 || state.pinnedNodeId !== undefined,
    movePinned: (nodeId, point) => movePinnedNode(
      nodeId, point, nodes, nodeList, links, edges, state, config,
    ),
    pin: (nodeId) => pinPhysicsNode(
      nodeId, nodes, nodeList, links, edges, state, config,
    ),
    release: (nodeId) => releasePhysicsNode(
      nodeId, nodes, links, state, config,
    ),
    reset: () => resetSimulation(nodeList, state),
    setConfig: (nextConfig) => {
      config = normalizeNeuralPersonaGraphPhysicsConfig({ ...config, ...nextConfig });
      state.bestLinkError = undefined;
      state.settleRemaining = NEURAL_PERSONA_GRAPH_SETTLE_BUDGET;
      state.alpha = Math.max(state.alpha, 0.38);
    },
    step: (timeScale = 1) => stepSimulation(nodeList, links, state, timeScale, config),
  };
}
