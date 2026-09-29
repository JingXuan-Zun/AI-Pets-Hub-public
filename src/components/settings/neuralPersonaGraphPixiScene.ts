import {
  Application,
  Container,
  Graphics,
  Sprite,
  Text,
  TextStyle,
  Texture,
} from 'pixi.js';
import type {
  NeuralPersonaGraphExplorerView,
  NeuralPersonaGraphPhysics,
  NeuralPersonaGraphViewport,
  NeuralPersonaLayoutNode,
} from '../../character-graph/neural-persona';
import {
  neuralGraphPointVisible,
  type NeuralGraphWorldBounds,
} from './neuralPersonaGraphPixiViewport';
import { resolveNeuralPersonaGraphEdgeVisualStyle } from './neuralPersonaGraphEdgeVisualStyle';
import {
  createNeuralPersonaGraphActivationOverlay,
  neuralPersonaGraphPathEdgeKey,
  type NeuralPersonaGraphActivationOverlay,
} from './neuralPersonaGraphActivationOverlay';
import { createNeuralPersonaGraphActivationVisibility } from './neuralPersonaGraphActivationVisibility';
import {
  neuralPersonaGraphNodeInnerFontSize,
  neuralPersonaGraphNodeInnerText,
  resolveNeuralPersonaGraphNodeVisualStyle,
} from './neuralPersonaGraphNodeVisualStyle';
import {
  createDisplayPositions,
  createNeuralPersonaGraphPixiSceneLayers,
  applyNeuralPersonaGraphSceneSelection,
  isSceneEdgeVisible,
  renderNeuralPersonaGraphPositions,
  type NeuralPersonaGraphSceneSelection,
} from './neuralPersonaGraphPixiSceneRendering';
import {
  neuralPersonaGraphEdgeFocusAlpha,
  resolveNeuralPersonaGraphFocusAlphas,
} from './neuralPersonaGraphFocusVisibility';
type NodeVisual = { circle: Graphics; container: Container; label: Text; node: NeuralPersonaLayoutNode };
type EdgeVisual = {
  edgeId: string;
  line: Sprite;
  sourceNodeId: string;
  targetNodeId: string;
  weight: number;
};
type Point = { x: number; y: number };
type SceneOptions = {
  app: Application;
  activationPreview?: import('../../character-graph/neural-persona').NeuralPersonaActivationPreview | null;
  batchSelectedNodeIds?: string[];
  focusRootNodeId?: string;
  focusedNodeId?: string;
  physics: NeuralPersonaGraphPhysics;
  selectedEdgeId?: string;
  selectedNodeId?: string;
  view: NeuralPersonaGraphExplorerView;
};
function textStyle(fontSize: number, fill: number) {
  return new TextStyle({
    fill,
    fontFamily: 'Geist Variable, Segoe UI, sans-serif',
    fontSize,
    fontWeight: '400',
  });
}
function createLabel(
  value: string, fontSize: number, fill: number, resolution: number, centered = false,
) {
  const label = new Text(value, textStyle(fontSize, fill));
  label.anchor.set(0.5, centered ? 0.5 : 0);
  label.style.align = 'center';
  label.style.lineHeight = fontSize * 1.05;
  label.resolution = Math.max(2, resolution * 1.5);
  return label;
}
function drawCluster(world: Container, view: NeuralPersonaGraphExplorerView, resolution: number) {
  view.clusters.forEach((cluster) => {
    const radius = 48 + cluster.nodeIds.length * 5;
    const shape = new Graphics();
    shape.beginFill(0x0f172a, 0.2);
    shape.lineStyle(1, 0x334155, 0.8);
    shape.drawCircle(cluster.x, cluster.y, radius);
    shape.endFill();
    world.addChild(shape);
    const label = createLabel(cluster.label, 8, 0x94a3b8, resolution);
    label.position.set(cluster.x, cluster.y - radius - 14);
    world.addChild(label);
  });
}
function drawNodeCircle(
  visual: NodeVisual,
  selectedNodeId?: string,
  focusedNodeId?: string,
  batchSelectedNodeIds: ReadonlySet<string> = new Set(),
  activationOverlay?: NeuralPersonaGraphActivationOverlay,
) {
  const { circle, node } = visual;
  const selected = node.nodeId === selectedNodeId || batchSelectedNodeIds.has(node.nodeId);
  const focused = node.nodeId === focusedNodeId;
  const active = activationOverlay?.activeNodeIds.includes(node.nodeId) ?? false;
  const suppressed = activationOverlay?.suppressedNodeIds.includes(node.nodeId) ?? false;
  const style = resolveNeuralPersonaGraphNodeVisualStyle(node, selected);
  const stroke = active ? 0x34d399 : suppressed ? 0xfb7185
    : focused ? 0xffffff : selected ? 0x67e8f9 : style.defaultStroke;
  circle.clear();
  if (active || suppressed) {
    circle.beginFill(active ? 0x22c55e : 0xf43f5e, active ? 0.38 : 0.28);
    circle.drawCircle(0, 0, style.radius + 9);
    circle.endFill();
  }
  if (style.haloAlpha) {
    circle.beginFill(style.haloColor, style.haloAlpha);
    circle.drawCircle(0, 0, style.haloRadius);
    circle.endFill();
  }
  circle.lineStyle(focused || selected ? 3 : 1.5, stroke, 1);
  circle.beginFill(style.fillColor, style.fillAlpha);
  circle.drawCircle(0, 0, style.radius);
  circle.endFill();
}
function createNodeVisual(node: NeuralPersonaLayoutNode, resolution: number) {
  const container = new Container();
  const circle = new Graphics();
  const style = resolveNeuralPersonaGraphNodeVisualStyle(node, false);
  const label = createLabel(
    neuralPersonaGraphNodeInnerText(node),
    neuralPersonaGraphNodeInnerFontSize(node),
    style.labelColor,
    resolution,
    true,
  );
  label.position.set(0, 0);
  container.position.set(node.x, node.y);
  container.addChild(circle, label);
  return { circle, container, label, node } satisfies NodeVisual;
}
function createNodeVisuals(
  layer: Container,
  view: NeuralPersonaGraphExplorerView,
  resolution: number,
  selectedNodeId?: string,
  focusedNodeId?: string,
  batchSelectedNodeIds: ReadonlySet<string> = new Set(),
  focusAlphas: ReadonlyMap<string, number> = new Map(),
  activationOverlay?: NeuralPersonaGraphActivationOverlay,
) {
  return new Map(view.nodes.map((node) => {
    const visual = createNodeVisual(node, resolution);
    drawNodeCircle(visual, selectedNodeId, focusedNodeId, batchSelectedNodeIds, activationOverlay);
    visual.container.alpha = resolveNodeAlpha(node.nodeId, focusAlphas, activationOverlay);
    layer.addChild(visual.container);
    return [node.nodeId, visual] as const;
  }));
}
function resolveNodeAlpha(
  nodeId: string,
  focusAlphas: ReadonlyMap<string, number>,
  activationOverlay?: NeuralPersonaGraphActivationOverlay,
) {
  const focusAlpha = focusAlphas.get(nodeId) ?? 1;
  if (!activationOverlay?.activeNodeIds.length) return focusAlpha;
  if (activationOverlay.activeNodeIds.includes(nodeId)) return focusAlpha;
  if (activationOverlay.suppressedNodeIds.includes(nodeId)) return focusAlpha * 0.65;
  if (activationOverlay.candidateNodeIds.includes(nodeId)) return focusAlpha * 0.5;
  return focusAlpha * 0.28;
}
function createEdgeVisual(edge: NeuralPersonaGraphExplorerView['edges'][number]) {
  const line = new Sprite(Texture.WHITE);
  line.anchor.set(0, 0.5);
  return {
    edgeId: edge.edgeId,
    line,
    sourceNodeId: edge.sourceNodeId,
    targetNodeId: edge.targetNodeId,
    weight: edge.weight,
  } satisfies EdgeVisual;
}
function drawEdge(
  visual: EdgeVisual,
  positions: Map<string, Point>,
  bounds: NeuralGraphWorldBounds,
  selectedEdgeId?: string,
  selectedNodeId?: string,
  focusAlphas: ReadonlyMap<string, number> = new Map(),
  activationOverlay?: NeuralPersonaGraphActivationOverlay,
) {
  const source = positions.get(visual.sourceNodeId);
  const target = positions.get(visual.targetNodeId);
  if (!source || !target) {
    visual.line.visible = false;
    return;
  }
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.hypot(dx, dy);
  const style = resolveNeuralPersonaGraphEdgeVisualStyle({
    ...visual,
    activationPath: Boolean(activationOverlay?.pathEdgeKeys.includes(
      neuralPersonaGraphPathEdgeKey(visual.sourceNodeId, visual.targetNodeId),
    )),
    activationPreview: Boolean(activationOverlay),
    selectedEdgeId, selectedNodeId,
  });
  visual.line.visible = distance > 0.01 && isSceneEdgeVisible(source, target, bounds);
  if (!visual.line.visible) return;
  visual.line.position.set(source.x, source.y);
  visual.line.rotation = Math.atan2(dy, dx);
  visual.line.width = distance;
  visual.line.height = style.width;
  visual.line.tint = style.color;
  visual.line.alpha = style.alpha * neuralPersonaGraphEdgeFocusAlpha(
    focusAlphas, visual.sourceNodeId, visual.targetNodeId,
  );
}
function createSceneVisuals(options: SceneOptions, layers: ReturnType<typeof createNeuralPersonaGraphPixiSceneLayers>,
  resolution: number, batchSelectedNodeIds: ReadonlySet<string>) {
  const focusAlphas = resolveNeuralPersonaGraphFocusAlphas(options.view, options.focusRootNodeId);
  const activationOverlay = createNeuralPersonaGraphActivationOverlay(
    options.activationPreview, options.view.edges,
  );
  drawCluster(layers.clusterLayer, options.view, resolution);
  const edges = options.view.edges.map(createEdgeVisual);
  edges.forEach((edge) => layers.edgeLayer.addChild(edge.line));
  const nodes = createNodeVisuals(
    layers.nodeLayer, options.view, resolution, options.selectedNodeId,
    options.focusedNodeId, batchSelectedNodeIds, focusAlphas, activationOverlay,
  );
  return { activationOverlay, edges, focusAlphas, nodes };
}
export function createNeuralPersonaGraphPixiScene(options: SceneOptions) {
  const layers = createNeuralPersonaGraphPixiSceneLayers(options.app);
  const resolution = options.app.renderer.resolution || 1;
  let batchSelectedNodeIds = new Set(options.batchSelectedNodeIds);
  const visuals = createSceneVisuals(
    options, layers, resolution, batchSelectedNodeIds,
  );
  const { edges, nodes } = visuals; const activationVisibility = createNeuralPersonaGraphActivationVisibility(visuals.activationOverlay, options.activationPreview?.traceId);
  let activationOverlay = visuals.activationOverlay; let focusAlphas = visuals.focusAlphas;
  let selectedEdgeId = options.selectedEdgeId; let selectedNodeId = options.selectedNodeId; let focusedNodeId = options.focusedNodeId;
  let viewport: NeuralPersonaGraphViewport = { scale: 1, x: 0, y: 0 };
  let draggedNodeId: string | undefined;
  let animating = false; let visualLagPx = 0;
  const positions = createDisplayPositions(options.view);
  const renderPositions = (deltaMS = 16.67) => {
    const motion = renderNeuralPersonaGraphPositions({
      app: options.app, deltaMS, draggedNodeId,
      drawEdge: (edge, edgePositions, bounds) => drawEdge(
        edge, edgePositions, bounds, selectedEdgeId, selectedNodeId,
        focusAlphas, activationOverlay,
      ), edges, nodes, physics: options.physics, positions, viewport,
      visibleNode: (nodeId, point, bounds) => {
        const visual = nodes.get(nodeId);
        if (visual) visual.container.visible = neuralGraphPointVisible(point, bounds);
      },
    });
    animating = motion.animating; visualLagPx = motion.averageLag;
  };
  const resetActivationDisplay = () => {
    activationOverlay = activationVisibility.hide();
    nodes.forEach((visual) => drawNodeCircle(visual, selectedNodeId, focusedNodeId, batchSelectedNodeIds, activationOverlay));
    nodes.forEach((visual, nodeId) => { visual.container.alpha = resolveNodeAlpha(nodeId, focusAlphas, activationOverlay); }); renderPositions();
  };
  renderPositions();
  return {
    getPosition: (nodeId: string) => positions.get(nodeId) ?? null,
    getVisualLag: () => visualLagPx,
    isAnimating: () => animating,
    renderPositions,
    resetActivationDisplay,
    setDraggedNode: (nodeId?: string) => { draggedNodeId = nodeId; }, setMarquee: layers.marquee.set,
    setSelection: (next: NeuralPersonaGraphSceneSelection) => applyNeuralPersonaGraphSceneSelection({ next, setBatchSelectedNodeIds: (value) => { batchSelectedNodeIds = value; }, setActivationOverlay: (value) => { activationOverlay = activationVisibility.resolve(value, next.activationPreview?.traceId); }, setFocusAlphas: (value) => { focusAlphas = value; }, setFocusedNodeId: (value) => { focusedNodeId = value; }, setSelectedEdgeId: (value) => { selectedEdgeId = value; }, setSelectedNodeId: (value) => { selectedNodeId = value; }, drawNodes: () => nodes.forEach((visual) => drawNodeCircle(visual, selectedNodeId, focusedNodeId, batchSelectedNodeIds, activationOverlay)), updateNodeAlphas: () => nodes.forEach((visual, nodeId) => { visual.container.alpha = resolveNodeAlpha(nodeId, focusAlphas, activationOverlay); }), renderPositions, resolveFocusAlphas: (focusRootNodeId) => resolveNeuralPersonaGraphFocusAlphas(options.view, focusRootNodeId), createOverlay: (preview) => createNeuralPersonaGraphActivationOverlay(preview, options.view.edges) }),
    setViewport: (next: NeuralPersonaGraphViewport) => {
      viewport = next; layers.world.position.set(next.x, next.y);
      layers.world.scale.set(next.scale);
    },
    world: layers.world,
  };
}

export type NeuralPersonaGraphPixiScene = ReturnType<typeof createNeuralPersonaGraphPixiScene>;
