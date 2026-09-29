import type { Application } from 'pixi.js';
import {
  panNeuralPersonaGraphViewport,
  zoomNeuralPersonaGraphViewport,
  type NeuralPersonaGraphExplorerView,
  type NeuralPersonaGraphViewport,
} from '../../character-graph/neural-persona';
import {
  hitNeuralPersonaGraphEdge,
  hitNeuralPersonaGraphNode,
  neuralPersonaGraphPointDistance,
  selectNeuralPersonaGraphNodesInMarquee,
  type NeuralPersonaGraphPoint as Point,
} from './neuralPersonaGraphPixiHitTesting';
import type { NeuralPersonaGraphPixiScene } from './neuralPersonaGraphPixiScene';
import { fitNeuralGraphStage, neuralGraphScreenToStage } from './neuralPersonaGraphPixiViewport';
import type { NeuralPersonaGraphWorkerPhysics } from './neuralPersonaGraphWorkerPhysics';

export type NeuralPersonaGraphPixiCallbacks = {
  onFocusNode: (nodeId?: string) => void;
  onSelectEdge: (edgeId: string) => void;
  onSelectNode: (nodeId: string) => void;
  onSelectNodes: (nodeIds: string[], append: boolean) => void;
};

export type NeuralPersonaGraphPointerSession =
  | { grabOffset: Point; kind: 'node'; moved: boolean; nodeId: string; start: Point }
  | { edgeId: string; kind: 'edge'; start: Point }
  | { append: boolean; current: Point; kind: 'marquee'; start: Point }
  | { kind: 'pan'; origin: NeuralPersonaGraphViewport; start: Point }
  | null;

export interface NeuralPersonaGraphPixiInteractionRuntime {
  app: Application;
  callbacks: NeuralPersonaGraphPixiCallbacks;
  canvas: HTMLCanvasElement;
  diagnostics?: { recordPointer: () => void };
  hoveredNodeId?: string;
  multiSelectMode: boolean;
  physics: NeuralPersonaGraphWorkerPhysics;
  pointer: NeuralPersonaGraphPointerSession;
  scene: NeuralPersonaGraphPixiScene;
  ticker: { wake: () => void };
  view: NeuralPersonaGraphExplorerView;
  viewport: NeuralPersonaGraphViewport;
}

function canvasPoint(runtime: NeuralPersonaGraphPixiInteractionRuntime,
  clientX: number, clientY: number) {
  const rect = runtime.canvas.getBoundingClientRect();
  const screen = {
    x: (clientX - rect.left) * (runtime.app.renderer.screen.width / rect.width),
    y: (clientY - rect.top) * (runtime.app.renderer.screen.height / rect.height),
  };
  return neuralGraphScreenToStage(screen, fitNeuralGraphStage(
    runtime.app.renderer.screen.width, runtime.app.renderer.screen.height,
  ));
}

function worldPoint(point: Point, viewport: NeuralPersonaGraphViewport) {
  const scale = viewport.scale || 1;
  return { x: (point.x - viewport.x) / scale, y: (point.y - viewport.y) / scale };
}

function minimumNodeHitRadius(viewport: NeuralPersonaGraphViewport) {
  return 10 / Math.max(0.01, viewport.scale || 1);
}

function beginSession(runtime: NeuralPersonaGraphPixiInteractionRuntime, event: PointerEvent) {
  if (event.button !== 0) return;
  const canvasPosition = canvasPoint(runtime, event.clientX, event.clientY);
  const graphPosition = worldPoint(canvasPosition, runtime.viewport);
  const nodeId = hitNeuralPersonaGraphNode(
    runtime.view, runtime.scene.getPosition, graphPosition,
    minimumNodeHitRadius(runtime.viewport),
  );
  runtime.canvas.setPointerCapture(event.pointerId);
  if (nodeId) {
    if (!runtime.multiSelectMode) runtime.callbacks.onFocusNode(nodeId);
    const node = runtime.physics.getPosition(nodeId);
    if (!node) return;
    runtime.pointer = { grabOffset: { x: node.x - graphPosition.x, y: node.y - graphPosition.y }, kind: 'node', moved: false, nodeId, start: canvasPosition };
    return;
  }
  const edgeId = hitNeuralPersonaGraphEdge(runtime.view, runtime.scene.getPosition, graphPosition);
  if (edgeId) { runtime.pointer = { edgeId, kind: 'edge', start: canvasPosition }; return; }
  if (runtime.multiSelectMode) {
    runtime.pointer = { append: event.ctrlKey || event.metaKey || event.shiftKey,
      current: canvasPosition, kind: 'marquee', start: canvasPosition };
    runtime.scene.setMarquee(canvasPosition, canvasPosition); runtime.ticker.wake();
  } else {
    runtime.callbacks.onFocusNode(undefined);
    runtime.pointer = { kind: 'pan', origin: runtime.viewport, start: canvasPosition };
  }
}

function moveNodeSession(runtime: NeuralPersonaGraphPixiInteractionRuntime,
  active: Extract<NeuralPersonaGraphPointerSession, { kind: 'node' }>, point: Point) {
  if (!active.moved && neuralPersonaGraphPointDistance(point, active.start) > 3) {
    active.moved = true; runtime.physics.pin(active.nodeId);
    runtime.scene.setDraggedNode(active.nodeId);
  }
  if (!active.moved) return;
  const world = worldPoint(point, runtime.viewport);
  runtime.physics.movePinned(active.nodeId, {
    x: world.x + active.grabOffset.x, y: world.y + active.grabOffset.y,
  });
  runtime.ticker.wake();
}

function moveSession(runtime: NeuralPersonaGraphPixiInteractionRuntime, event: PointerEvent) {
  runtime.diagnostics?.recordPointer();
  const point = canvasPoint(runtime, event.clientX, event.clientY);
  const active = runtime.pointer;
  if (!active) return updateCursor(runtime, point);
  if (active.kind === 'edge') return;
  if (active.kind === 'marquee') {
    active.current = point; runtime.scene.setMarquee(active.start, point);
    runtime.ticker.wake(); return;
  }
  if (active.kind === 'pan') {
    runtime.viewport = panNeuralPersonaGraphViewport(active.origin, {
      x: point.x - active.start.x, y: point.y - active.start.y,
    });
    runtime.scene.setViewport(runtime.viewport); runtime.ticker.wake(); return;
  }
  moveNodeSession(runtime, active, point);
}

function finishMarquee(runtime: NeuralPersonaGraphPixiInteractionRuntime,
  active: Extract<NeuralPersonaGraphPointerSession, { kind: 'marquee' }>) {
  const start = worldPoint(active.start, runtime.viewport);
  const end = worldPoint(active.current, runtime.viewport);
  const nodeIds = selectNeuralPersonaGraphNodesInMarquee(
    runtime.view.nodes, runtime.scene.getPosition, start, end,
  );
  runtime.scene.setMarquee(); runtime.callbacks.onSelectNodes(nodeIds, active.append);
  runtime.ticker.wake();
}

function endSession(runtime: NeuralPersonaGraphPixiInteractionRuntime,
  event: PointerEvent, cancelled = false) {
  if (runtime.canvas.hasPointerCapture(event.pointerId)) runtime.canvas.releasePointerCapture(event.pointerId);
  const active = runtime.pointer; runtime.pointer = null;
  if (active?.kind === 'node' && active.moved) {
    runtime.physics.release(active.nodeId); runtime.scene.setDraggedNode(); runtime.ticker.wake();
  } else if (!cancelled && active?.kind === 'node') runtime.callbacks.onFocusNode(active.nodeId);
  if (!cancelled && active?.kind === 'edge') runtime.callbacks.onSelectEdge(active.edgeId);
  if (!cancelled && active?.kind === 'marquee') finishMarquee(runtime, active);
  else if (active?.kind === 'marquee') { runtime.scene.setMarquee(); runtime.ticker.wake(); }
}

function updateCursor(runtime: NeuralPersonaGraphPixiInteractionRuntime, canvasPosition: Point) {
  const point = worldPoint(canvasPosition, runtime.viewport);
  const nodeId = hitNeuralPersonaGraphNode(
    runtime.view, runtime.scene.getPosition, point, minimumNodeHitRadius(runtime.viewport),
  );
  runtime.canvas.style.cursor = nodeId ? 'grab' : runtime.multiSelectMode ? 'crosshair'
    : hitNeuralPersonaGraphEdge(runtime.view, runtime.scene.getPosition, point) ? 'pointer' : 'default';
  if (!nodeId) { runtime.hoveredNodeId = undefined; return; }
  if (nodeId === runtime.hoveredNodeId) return;
  runtime.hoveredNodeId = nodeId;
  if (!runtime.multiSelectMode) runtime.callbacks.onSelectNode(nodeId);
}

function wheel(runtime: NeuralPersonaGraphPixiInteractionRuntime, event: WheelEvent) {
  event.preventDefault();
  const point = canvasPoint(runtime, event.clientX, event.clientY);
  runtime.viewport = zoomNeuralPersonaGraphViewport(
    runtime.viewport, point, event.deltaY < 0 ? 1.12 : 0.89,
  );
  runtime.scene.setViewport(runtime.viewport); runtime.ticker.wake();
}

export function installNeuralPersonaGraphPixiInteractions(
  runtime: NeuralPersonaGraphPixiInteractionRuntime,
) {
  const down = (event: PointerEvent) => beginSession(runtime, event);
  const move = (event: PointerEvent) => moveSession(runtime, event);
  const end = (event: PointerEvent) => endSession(runtime, event);
  const cancel = (event: PointerEvent) => endSession(runtime, event, true);
  const scroll = (event: WheelEvent) => wheel(runtime, event);
  const leave = () => { runtime.hoveredNodeId = undefined; runtime.canvas.style.cursor = 'default'; };
  runtime.canvas.addEventListener('pointerdown', down); runtime.canvas.addEventListener('pointermove', move);
  runtime.canvas.addEventListener('pointerup', end); runtime.canvas.addEventListener('pointercancel', cancel);
  runtime.canvas.addEventListener('wheel', scroll, { passive: false }); runtime.canvas.addEventListener('pointerleave', leave);
  return () => {
    runtime.canvas.removeEventListener('pointerdown', down); runtime.canvas.removeEventListener('pointermove', move);
    runtime.canvas.removeEventListener('pointerup', end); runtime.canvas.removeEventListener('pointercancel', cancel);
    runtime.canvas.removeEventListener('wheel', scroll); runtime.canvas.removeEventListener('pointerleave', leave);
  };
}
