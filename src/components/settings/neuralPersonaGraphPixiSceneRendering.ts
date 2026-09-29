import { Application, Container } from 'pixi.js';
import type {
  NeuralPersonaGraphPhysics,
  NeuralPersonaGraphViewport,
  NeuralPersonaLayoutNode,
} from '../../character-graph/neural-persona';
import {
  neuralGraphPointVisible,
  neuralGraphSegmentBoundsVisible,
  neuralGraphVisibleStageBounds,
  neuralGraphVisibleWorldBounds,
  type NeuralGraphWorldBounds,
} from './neuralPersonaGraphPixiViewport';
import { createNeuralPersonaGraphPixiMarquee } from './neuralPersonaGraphPixiMarquee';

type Point = { x: number; y: number };
type PositionVisual = { container: Container };
export type NeuralPersonaGraphSceneSelection = {
  activationPreview?: import('../../character-graph/neural-persona').NeuralPersonaActivationPreview | null;
  batchSelectedNodeIds?: string[];
  focusRootNodeId?: string;
  focusedNodeId?: string;
  selectedEdgeId?: string;
  selectedNodeId?: string;
};

function interpolationRatio(deltaMS: number) {
  return 1 - Math.exp(-Math.max(0, Math.min(100, deltaMS)) / 33);
}

export function updateDisplayPositions(
  nodes: Map<string, PositionVisual>, physics: NeuralPersonaGraphPhysics,
  positions: Map<string, Point>, draggedNodeId: string | undefined, deltaMS: number,
) {
  const ratio = interpolationRatio(deltaMS);
  let animating = false;
  let totalLag = 0;
  nodes.forEach((visual, nodeId) => {
    const target = physics.getPosition(nodeId);
    if (!target) return;
    const current = positions.get(nodeId) ?? { ...target };
    if (nodeId === draggedNodeId) Object.assign(current, target);
    else {
      current.x += (target.x - current.x) * ratio;
      current.y += (target.y - current.y) * ratio;
      const lag = Math.hypot(target.x - current.x, target.y - current.y);
      totalLag += lag;
      animating ||= lag > 0.08;
    }
    positions.set(nodeId, current);
    visual.container.position.set(current.x, current.y);
  });
  return { animating, averageLag: nodes.size ? totalLag / nodes.size : 0 };
}

export function createDisplayPositions(view: { nodes: NeuralPersonaLayoutNode[] }) {
  return new Map(view.nodes.map((node) => [node.nodeId, { x: node.x, y: node.y }]));
}

export function visibleBounds(app: Application, viewport: NeuralPersonaGraphViewport) {
  const stageBounds = neuralGraphVisibleStageBounds(
    app.renderer.screen.width, app.renderer.screen.height,
  );
  return neuralGraphVisibleWorldBounds(viewport, 48, stageBounds);
}

export function createNeuralPersonaGraphPixiSceneLayers(app: Application) {
  const world = new Container();
  const clusterLayer = new Container(); const edgeLayer = new Container();
  const nodeLayer = new Container();
  const marquee = createNeuralPersonaGraphPixiMarquee();
  app.stage.addChild(world, marquee.graphic);
  world.addChild(clusterLayer, edgeLayer, nodeLayer);
  return { clusterLayer, edgeLayer, marquee, nodeLayer, world };
}

export function isSceneEdgeVisible(source: Point, target: Point, bounds: NeuralGraphWorldBounds) {
  return neuralGraphSegmentBoundsVisible(source, target, bounds);
}

export function renderNeuralPersonaGraphPositions<Edge>(options: {
  app: Application;
  draggedNodeId?: string;
  drawEdge: (edge: Edge, positions: Map<string, Point>, bounds: NeuralGraphWorldBounds) => void;
  edges: readonly Edge[];
  nodes: Map<string, PositionVisual>;
  physics: NeuralPersonaGraphPhysics;
  positions: Map<string, Point>;
  viewport: NeuralPersonaGraphViewport;
  visibleNode: (nodeId: string, point: Point, bounds: NeuralGraphWorldBounds) => void;
  deltaMS: number;
}) {
  const motion = updateDisplayPositions(
    options.nodes, options.physics, options.positions, options.draggedNodeId, options.deltaMS,
  );
  const bounds = visibleBounds(options.app, options.viewport);
  options.nodes.forEach((visual, nodeId) => {
    const point = options.positions.get(nodeId);
    if (point) options.visibleNode(nodeId, point, bounds);
    else visual.container.visible = false;
  });
  options.edges.forEach((edge) => options.drawEdge(edge, options.positions, bounds));
  return motion;
}

export function applyNeuralPersonaGraphSceneSelection(options: {
  next: NeuralPersonaGraphSceneSelection;
  setBatchSelectedNodeIds: (value: Set<string>) => void;
  setActivationOverlay: (value: ReturnType<typeof import('./neuralPersonaGraphActivationOverlay').createNeuralPersonaGraphActivationOverlay>) => void;
  setFocusAlphas: (value: Map<string, number>) => void;
  setFocusedNodeId: (value?: string) => void;
  setSelectedEdgeId: (value?: string) => void;
  setSelectedNodeId: (value?: string) => void;
  drawNodes: () => void;
  updateNodeAlphas: () => void;
  renderPositions: () => void;
  resolveFocusAlphas: (focusRootNodeId?: string) => Map<string, number>;
  createOverlay: (preview?: import('../../character-graph/neural-persona').NeuralPersonaActivationPreview | null) => ReturnType<typeof import('./neuralPersonaGraphActivationOverlay').createNeuralPersonaGraphActivationOverlay>;
}) {
  options.setBatchSelectedNodeIds(new Set(options.next.batchSelectedNodeIds));
  options.setActivationOverlay(options.createOverlay(options.next.activationPreview));
  options.setFocusAlphas(options.resolveFocusAlphas(options.next.focusRootNodeId));
  options.setFocusedNodeId(options.next.focusedNodeId);
  options.setSelectedEdgeId(options.next.selectedEdgeId);
  options.setSelectedNodeId(options.next.selectedNodeId);
  options.drawNodes(); options.updateNodeAlphas(); options.renderPositions();
}
