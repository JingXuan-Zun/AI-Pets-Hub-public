import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { NeuralPersonaGraphSnapshot } from '../../../character-graph/neural-persona';
import { isNeuralMemoryStagedNode } from '../../../neural-memory/neuralMemoryStaging';
import { createMemoryForceSimulation, type MemoryForceSimulation } from './memoryForceSimulation';
import { NeuralMemoryForceSettings, useMemoryForceSettings } from './NeuralMemoryForceSettings';
import { memoryNoteTitle, memoryNotes } from './neuralMemoryNotes';

const CLICK_TOLERANCE_PX = 3;
const MIN_SCALE = 0.1;
const MAX_SCALE = 4;
const WHEEL_ZOOM = 1.12;

type View = { scale: number; x: number; y: number };
type Point = { x: number; y: number };

/** Zooms so the graph point under `screen` (viewBox units) stays where it is. */
function zoomAround(view: View, graphPoint: Point, screen: Point, factor: number): View {
  const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, view.scale * factor));
  return { scale, x: screen.x - graphPoint.x * scale, y: screen.y - graphPoint.y * scale };
}

/** Centers and scales the view so every node fits inside the viewBox. */
function fitView(nodes: Point[], half: number): View {
  if (!nodes.length) return { scale: 1, x: 0, y: 0 };
  const xs = nodes.map((node) => node.x); const ys = nodes.map((node) => node.y);
  const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys); const maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY, 1) + 60;
  const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, (half * 2) / span));
  return { scale, x: -((minX + maxX) / 2) * scale, y: -((minY + maxY) / 2) * scale };
}

type Links = Array<{ id: string; source: string; target: string }>;
type Gesture =
  | { kind: 'node'; moved: boolean; nodeId: string; startX: number; startY: number }
  | { kind: 'pan'; startX: number; startY: number; viewX: number; viewY: number };

function neighborsOf(links: Links, nodeId?: string) {
  const neighbors = new Set<string>();
  links.forEach((link) => {
    if (link.source === nodeId) neighbors.add(link.target);
    if (link.target === nodeId) neighbors.add(link.source);
  });
  return neighbors;
}

function useMemoryGraphModel(graph: NeuralPersonaGraphSnapshot) {
  const notes = memoryNotes(graph);
  const ids = notes.map((note) => note.nodeId);
  const noteIds = new Set(ids);
  const links: Links = graph.edges.filter((edge) => edge.relationType !== 'contains'
    && noteIds.has(edge.sourceNodeId) && noteIds.has(edge.targetNodeId))
    .map((edge) => ({ id: edge.edgeId, source: edge.sourceNodeId, target: edge.targetNodeId }));
  // Only structure changes restart the simulation; editing a memory's text does not.
  const structureKey = `${ids.join('|')}#${links.map((link) => `${link.source}>${link.target}`).join('|')}`;
  const structure = useMemo(() => ({ ids, links }), [structureKey]);
  const degree = new Map<string, number>();
  structure.links.forEach((link) => {
    degree.set(link.source, (degree.get(link.source) ?? 0) + 1);
    degree.set(link.target, (degree.get(link.target) ?? 0) + 1);
  });
  return { degree, notes: new Map(notes.map((note) => [note.nodeId, note])), structure };
}

/** Light, Obsidian-like memory graph: a live force simulation you can drag, pan and zoom. */
export function NeuralMemoryGraphView(props: {
  graph: NeuralPersonaGraphSnapshot;
  /** Memories to emphasize (e.g. a tag filter); the rest fade until hovered. */
  highlightNodeIds?: Set<string>;
  onSelect: (nodeId: string) => void;
  roleId: string;
  selectedNodeId?: string;
}) {
  const model = useMemoryGraphModel(props.graph);
  const forces = useMemoryForceSettings(props.roleId);
  const lastPositionsRef = useRef(new Map<string, { x: number; y: number }>());
  const simulation = useMemo<MemoryForceSimulation>(
    () => createMemoryForceSimulation(model.structure.ids, model.structure.links, forces.settings, lastPositionsRef.current),
    [model.structure],
  );
  const [, setFrame] = useState(0);
  const [hovered, setHovered] = useState<string>();
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const gestureRef = useRef<Gesture | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const groupRef = useRef<SVGGElement>(null);
  const frameRef = useRef<number | null>(null);

  const animate = () => {
    if (frameRef.current !== null) return;
    const frame = () => {
      simulation.tick();
      simulation.nodes.forEach((node) => lastPositionsRef.current.set(node.id, { x: node.x, y: node.y }));
      setFrame((count) => count + 1);
      frameRef.current = simulation.isActive() ? requestAnimationFrame(frame) : null;
    };
    frameRef.current = requestAnimationFrame(frame);
  };
  useEffect(() => {
    animate();
    return () => { if (frameRef.current !== null) cancelAnimationFrame(frameRef.current); frameRef.current = null; };
  }, [simulation]);
  useEffect(() => { simulation.setSettings(forces.settings); animate(); }, [forces.settings]);

  const toGraphPoint = (clientX: number, clientY: number) => {
    const matrix = groupRef.current?.getScreenCTM(); const svg = svgRef.current;
    if (!matrix || !svg) return null;
    const point = svg.createSVGPoint();
    point.x = clientX; point.y = clientY;
    const local = point.matrixTransform(matrix.inverse());
    return { x: local.x, y: local.y };
  };
  // A view a little wider than the node count needs, centered on the origin.
  const half = Math.max(220, Math.sqrt(Math.max(1, model.structure.ids.length)) * 70);

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    const nodeId = (event.target as Element).closest<SVGGElement>('[data-memory-graph-node]')?.dataset.memoryGraphNode;
    svgRef.current?.setPointerCapture(event.pointerId);
    gestureRef.current = nodeId
      ? { kind: 'node', moved: false, nodeId, startX: event.clientX, startY: event.clientY }
      : { kind: 'pan', startX: event.clientX, startY: event.clientY, viewX: view.x, viewY: view.y };
  };
  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const gesture = gestureRef.current; const svg = svgRef.current;
    if (!gesture || !svg) return;
    if (gesture.kind === 'pan') {
      const unit = (half * 2) / Math.max(1, Math.min(svg.clientWidth, svg.clientHeight));
      setView({ ...view, x: gesture.viewX + (event.clientX - gesture.startX) * unit, y: gesture.viewY + (event.clientY - gesture.startY) * unit });
      return;
    }
    if (!gesture.moved) {
      if (Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) < CLICK_TOLERANCE_PX) return;
      gesture.moved = true;
      simulation.dragStart(gesture.nodeId);
    }
    const point = toGraphPoint(event.clientX, event.clientY);
    if (point) simulation.dragMove(gesture.nodeId, point);
    animate();
  };
  const onPointerUp = () => {
    const gesture = gestureRef.current;
    gestureRef.current = null;
    if (gesture?.kind !== 'node') return;
    if (!gesture.moved) { props.onSelect(gesture.nodeId); return; }
    simulation.dragEnd(gesture.nodeId);
    animate();
  };
  // The native wheel listener reads the latest selection and simulation through this ref.
  const zoomTargetRef = useRef({ selectedNodeId: props.selectedNodeId, simulation });
  zoomTargetRef.current = { selectedNodeId: props.selectedNodeId, simulation };
  // React's wheel listener is passive, so a native one is needed to keep the page from scrolling.
  const hasNodes = model.structure.ids.length > 0;
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const matrix = svg.getScreenCTM();
      if (!matrix) return;
      const factor = event.deltaY < 0 ? WHEEL_ZOOM : 1 / WHEEL_ZOOM;
      const pointer = Object.assign(svg.createSVGPoint(), { x: event.clientX, y: event.clientY }).matrixTransform(matrix.inverse());
      const { selectedNodeId, simulation: current } = zoomTargetRef.current;
      const selected = current.nodes.find((node) => node.id === selectedNodeId);
      // Zoom around the selected memory when there is one, otherwise around the pointer.
      setView((last) => (selected
        ? zoomAround(last, selected, { x: last.x + selected.x * last.scale, y: last.y + selected.y * last.scale }, factor)
        : zoomAround(last, { x: (pointer.x - last.x) / last.scale, y: (pointer.y - last.y) / last.scale }, pointer, factor)));
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [hasNodes]);

  const focus = hovered;
  const focusNeighbors = neighborsOf(model.structure.links, focus);
  const positions = new Map(simulation.nodes.map((node) => [node.id, node]));
  return (
    <div className="relative h-full w-full">
      <div className="absolute right-3 top-3 z-10">
        <NeuralMemoryForceSettings settings={forces.settings} onChange={forces.save} />
      </div>
      {!model.structure.ids.length ? (
        <div className="flex h-full items-center justify-center text-2xs text-muted-foreground">还没有记忆</div>
      ) : (
        <svg
          ref={svgRef}
          data-memory-graph
          viewBox={`${-half} ${-half} ${half * 2} ${half * 2}`}
          className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={(event) => {
            // Double-clicking the background brings the whole graph back into view.
            if ((event.target as Element).closest('[data-memory-graph-node]')) return;
            setView(fitView(simulation.nodes, half));
          }}
        >
          <g ref={groupRef} transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
            {model.structure.links.map((link) => {
              const from = positions.get(link.source); const to = positions.get(link.target);
              if (!from || !to) return null;
              const lit = focus && (link.source === focus || link.target === focus);
              return <line key={link.id} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="currentColor" strokeOpacity={lit ? 0.55 : focus ? 0.08 : 0.25} strokeWidth={lit ? 1.4 : 1} vectorEffect="non-scaling-stroke" />;
            })}
            {simulation.nodes.map((node) => {
              const note = model.notes.get(node.id);
              if (!note) return null;
              const selected = node.id === props.selectedNodeId;
              const near = focus ? node.id === focus || focusNeighbors.has(node.id) : !props.highlightNodeIds || props.highlightNodeIds.has(node.id);
              const radius = 4 + Math.min(5, model.degree.get(node.id) ?? 0) * 0.8 + (selected ? 1.5 : 0);
              const fill = selected ? 'var(--primary)' : isNeuralMemoryStagedNode(note) ? 'rgb(245 158 11)' : 'var(--muted-foreground)';
              const highlighted = !focus && props.highlightNodeIds?.has(node.id);
              const showLabel = selected || highlighted || node.id === hovered || (focus && focusNeighbors.has(node.id)) || view.scale > 1.6;
              return (
                <g
                  key={node.id}
                  data-memory-graph-node={node.id}
                  className="cursor-pointer"
                  opacity={near ? 1 : 0.2}
                  onPointerEnter={() => setHovered(node.id)}
                  onPointerLeave={() => setHovered(undefined)}
                >
                  <circle cx={node.x} cy={node.y} r={radius + 5} fill="transparent" />
                  <circle cx={node.x} cy={node.y} r={radius} fill={fill} fillOpacity={selected ? 1 : 0.8} />
                  {showLabel ? (
                    <text x={node.x} y={node.y + radius + 11} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.75} pointerEvents="none">
                      {memoryNoteTitle(note, 14)}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        </svg>
      )}
    </div>
  );
}
