import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import {
  createNeuralPersonaGraphPhysics,
  CENTERED_NEURAL_PERSONA_GRAPH_VIEWPORT,
  NEURAL_PERSONA_GRAPH_VIEW_HEIGHT,
  NEURAL_PERSONA_GRAPH_VIEW_WIDTH,
  panNeuralPersonaGraphViewport,
  zoomNeuralPersonaGraphViewport,
  type NeuralPersonaGraphPhysics,
  type NeuralPersonaGraphPhysicsConfig,
  type NeuralPersonaGraphViewport,
  type NeuralPersonaGraphViewEdge,
  type NeuralPersonaLayoutNode,
} from '../../character-graph/neural-persona';
import { selectNeuralPersonaGraphNodesInMarquee } from './neuralPersonaGraphPixiHitTesting';

type Point = { x: number; y: number };
type DragState =
  | { grabOffset: Point; kind: 'node'; nodeId: string }
  | { append: boolean; current: Point; kind: 'marquee'; start: Point }
  | { kind: 'pan'; origin: NeuralPersonaGraphViewport; start: Point }
  | null;
type EdgeElement = { lines: SVGLineElement[]; sourceNodeId: string; targetNodeId: string };
type GraphElements = { edges: EdgeElement[]; nodes: Map<string, SVGGElement> };

function canvasPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
  const matrix = svg.getScreenCTM();
  if (matrix) {
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  }
  const rect = svg.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (NEURAL_PERSONA_GRAPH_VIEW_WIDTH / rect.width),
    y: (clientY - rect.top) * (NEURAL_PERSONA_GRAPH_VIEW_HEIGHT / rect.height),
  };
}

function worldPoint(svg: SVGSVGElement, clientX: number, clientY: number, viewport: NeuralPersonaGraphViewport) {
  const point = canvasPoint(svg, clientX, clientY);
  return canvasToWorld(point, viewport);
}

function canvasToWorld(point: Point, viewport: NeuralPersonaGraphViewport) {
  const scale = viewport.scale || 1;
  return { x: (point.x - viewport.x) / scale, y: (point.y - viewport.y) / scale };
}

function collectElements(svg: SVGSVGElement) {
  const nodes = new Map<string, SVGGElement>();
  svg.querySelectorAll<SVGGElement>('[data-neural-graph-node-id]').forEach((element) => {
    const nodeId = element.dataset.neuralGraphNodeId;
    if (nodeId) nodes.set(nodeId, element);
  });
  const edges = [...svg.querySelectorAll<SVGGElement>('[data-neural-graph-source]')]
    .flatMap((element): EdgeElement[] => {
      const sourceNodeId = element.dataset.neuralGraphSource;
      const targetNodeId = element.dataset.neuralGraphTarget;
      if (!sourceNodeId || !targetNodeId) return [];
      return [{ lines: [...element.querySelectorAll('line')], sourceNodeId, targetNodeId }];
    });
  return { edges, nodes };
}

function renderPhysics(physics: NeuralPersonaGraphPhysics, elements: GraphElements) {
  elements.nodes.forEach((element, nodeId) => {
    const point = physics.getPosition(nodeId);
    if (point) element.setAttribute('transform', `translate(${point.x} ${point.y})`);
  });
  elements.edges.forEach((edge) => {
    const source = physics.getPosition(edge.sourceNodeId);
    const target = physics.getPosition(edge.targetNodeId);
    if (!source || !target) return;
    edge.lines.forEach((line) => {
      line.setAttribute('x1', String(source.x));
      line.setAttribute('y1', String(source.y));
      line.setAttribute('x2', String(target.x));
      line.setAttribute('y2', String(target.y));
    });
  });
}

function graphSignature(nodes: NeuralPersonaLayoutNode[], edges: NeuralPersonaGraphViewEdge[]) {
  return `${nodes.map((node) => `${node.nodeId}:${node.x}:${node.y}`).join('|')}#${edges
    .map((edge) => `${edge.edgeId}:${edge.sourceNodeId}:${edge.targetNodeId}:${edge.weight}`).join('|')}`;
}

function useGraphCanvasRuntime(
  nodes: NeuralPersonaLayoutNode[], edges: NeuralPersonaGraphViewEdge[],
  config: NeuralPersonaGraphPhysicsConfig,
) {
  const [viewport, setViewport] = useState(CENTERED_NEURAL_PERSONA_GRAPH_VIEWPORT);
  const [marquee, setMarquee] = useState<{ current: Point; start: Point } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const viewportRef = useRef(viewport);
  const physics = useRef<NeuralPersonaGraphPhysics | null>(null);
  const elements = useRef<GraphElements>({ edges: [], nodes: new Map() });
  const drag = useRef<DragState>(null);
  const frame = useRef<number | null>(null);
  const previousFrameAt = useRef<number | null>(null);
  const animate = useRef<(timestamp: number) => void>(() => undefined);
  const requestFrame = () => {
    if (frame.current === null) frame.current = requestAnimationFrame(animate.current);
  };
  animate.current = (timestamp) => {
    frame.current = null;
    const engine = physics.current;
    if (!engine) return;
    const elapsed = previousFrameAt.current === null ? 16.67 : timestamp - previousFrameAt.current;
    previousFrameAt.current = timestamp;
    engine.step(elapsed / 16.67);
    renderPhysics(engine, elements.current);
    if (engine.isActive()) requestFrame();
    else previousFrameAt.current = null;
  };
  const signature = graphSignature(nodes, edges);
  useEffect(() => {
    if (!svgRef.current) return undefined;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    physics.current = createNeuralPersonaGraphPhysics(nodes, edges, config);
    elements.current = collectElements(svgRef.current);
    renderPhysics(physics.current, elements.current);
    return () => { if (frame.current !== null) cancelAnimationFrame(frame.current); };
  }, [signature]);
  useEffect(() => {
    const engine = physics.current;
    if (!engine) return;
    engine.setConfig(config);
    renderPhysics(engine, elements.current);
    requestFrame();
  }, [config]);
  return { drag, elements, marquee, physics, requestFrame, setMarquee,
    setViewport, svgRef, viewport, viewportRef };
}

type GraphCanvasRuntime = ReturnType<typeof useGraphCanvasRuntime>;

function beginPan(runtime: GraphCanvasRuntime, event: PointerEvent<SVGSVGElement>, multiSelectMode: boolean) {
  if (event.target instanceof Element && event.target.closest('[data-neural-graph-node], [data-neural-graph-edge]')) return;
  event.currentTarget.setPointerCapture(event.pointerId);
  const point = canvasPoint(event.currentTarget, event.clientX, event.clientY);
  if (multiSelectMode) {
    runtime.drag.current = { append: event.ctrlKey || event.metaKey || event.shiftKey,
      current: point, kind: 'marquee', start: point };
    runtime.setMarquee({ current: point, start: point });
  } else runtime.drag.current = {
    kind: 'pan', origin: runtime.viewportRef.current, start: point,
  };
}

function beginNodeDrag(runtime: GraphCanvasRuntime, event: PointerEvent<SVGGElement>, nodeId: string) {
  event.stopPropagation();
  const svg = event.currentTarget.ownerSVGElement;
  const engine = runtime.physics.current;
  const position = engine?.getPosition(nodeId);
  if (!svg || !engine || !position) return;
  svg.setPointerCapture(event.pointerId);
  const pointer = worldPoint(svg, event.clientX, event.clientY, runtime.viewportRef.current);
  runtime.drag.current = { grabOffset: { x: position.x - pointer.x, y: position.y - pointer.y }, kind: 'node', nodeId };
  engine.pin(nodeId);
  runtime.requestFrame();
}

function move(runtime: GraphCanvasRuntime, event: PointerEvent<SVGSVGElement>) {
  const active = runtime.drag.current;
  if (!active) return;
  if (active.kind === 'marquee') {
    active.current = canvasPoint(event.currentTarget, event.clientX, event.clientY);
    runtime.setMarquee({ current: active.current, start: active.start });
    return;
  }
  if (active.kind === 'pan') {
    const point = canvasPoint(event.currentTarget, event.clientX, event.clientY);
    const next = panNeuralPersonaGraphViewport(active.origin, { x: point.x - active.start.x, y: point.y - active.start.y });
    runtime.viewportRef.current = next;
    runtime.setViewport(next);
    return;
  }
  const point = worldPoint(event.currentTarget, event.clientX, event.clientY, runtime.viewportRef.current);
  runtime.physics.current?.movePinned(active.nodeId, {
    x: point.x + active.grabOffset.x, y: point.y + active.grabOffset.y,
  });
  runtime.requestFrame();
}

function end(runtime: GraphCanvasRuntime, event: PointerEvent<SVGSVGElement>,
  nodes: NeuralPersonaLayoutNode[], onSelectNodes: (nodeIds: string[], append: boolean) => void) {
  if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  const active = runtime.drag.current;
  runtime.drag.current = null;
  if (active?.kind === 'marquee') {
    runtime.setMarquee(null);
    const viewport = runtime.viewportRef.current;
    onSelectNodes(selectNeuralPersonaGraphNodesInMarquee(
      nodes, (nodeId) => runtime.physics.current?.getPosition(nodeId) ?? null,
      canvasToWorld(active.start, viewport), canvasToWorld(active.current, viewport),
    ), active.append);
    return;
  }
  if (active?.kind !== 'node') return;
  runtime.physics.current?.release(active.nodeId);
  runtime.requestFrame();
}

function wheel(runtime: GraphCanvasRuntime, event: WheelEvent<SVGSVGElement>) {
  event.preventDefault();
  const point = canvasPoint(event.currentTarget, event.clientX, event.clientY);
  const next = zoomNeuralPersonaGraphViewport(runtime.viewportRef.current, point, event.deltaY < 0 ? 1.12 : 0.89);
  runtime.viewportRef.current = next;
  runtime.setViewport(next);
}

function reset(runtime: GraphCanvasRuntime) {
  runtime.drag.current = null;
  runtime.setMarquee(null);
  runtime.viewportRef.current = CENTERED_NEURAL_PERSONA_GRAPH_VIEWPORT;
  runtime.setViewport(CENTERED_NEURAL_PERSONA_GRAPH_VIEWPORT);
  runtime.physics.current?.reset();
  if (runtime.physics.current) renderPhysics(runtime.physics.current, runtime.elements.current);
}

export function useNeuralPersonaGraphCanvasController(
  nodes: NeuralPersonaLayoutNode[],
  edges: NeuralPersonaGraphViewEdge[],
  config: NeuralPersonaGraphPhysicsConfig,
  options: {
    multiSelectMode?: boolean;
    onSelectNodes: (nodeIds: string[], append: boolean) => void;
  },
) {
  const runtime = useGraphCanvasRuntime(nodes, edges, config);
  return {
    beginNodeDrag: (event: PointerEvent<SVGGElement>, nodeId: string) => beginNodeDrag(runtime, event, nodeId),
    beginPan: (event: PointerEvent<SVGSVGElement>) => beginPan(runtime, event, Boolean(options.multiSelectMode)),
    end: (event: PointerEvent<SVGSVGElement>) => end(runtime, event, nodes, options.onSelectNodes),
    marquee: runtime.marquee,
    move: (event: PointerEvent<SVGSVGElement>) => move(runtime, event),
    reset: () => reset(runtime),
    svgRef: runtime.svgRef,
    viewport: runtime.viewport,
    wheel: (event: WheelEvent<SVGSVGElement>) => wheel(runtime, event),
  };
}
