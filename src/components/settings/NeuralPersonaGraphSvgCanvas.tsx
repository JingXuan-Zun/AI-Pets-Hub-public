import { useEffect, useState, type CSSProperties, type PointerEvent } from 'react';
import type {
  NeuralPersonaGraphExplorerView,
  NeuralPersonaGraphPhysicsConfig,
  NeuralPersonaLayoutNode,
} from '../../character-graph/neural-persona';
import {
  NEURAL_PERSONA_GRAPH_VIEW_HEIGHT,
  NEURAL_PERSONA_GRAPH_VIEW_WIDTH,
} from '../../character-graph/neural-persona';
import { NeuralPersonaGraphCanvasToolbar } from './NeuralPersonaGraphCanvasToolbar';
import { useNeuralPersonaGraphCanvasController } from './useNeuralPersonaGraphCanvasController';
import { resolveNeuralPersonaGraphEdgeVisualStyle } from './neuralPersonaGraphEdgeVisualStyle';
import {
  createNeuralPersonaGraphActivationOverlay,
  neuralPersonaGraphPathEdgeKey,
} from './neuralPersonaGraphActivationOverlay';
import {
  neuralPersonaGraphEdgeFocusAlpha,
  resolveNeuralPersonaGraphFocusAlphas,
} from './neuralPersonaGraphFocusVisibility';
import {
  neuralPersonaGraphColorHex,
  neuralPersonaGraphNodeInnerFontSize,
  neuralPersonaGraphNodeInnerText,
  resolveNeuralPersonaGraphNodeVisualStyle,
} from './neuralPersonaGraphNodeVisualStyle';

function ClusterLayer({ view }: { view: NeuralPersonaGraphExplorerView }) {
  return view.clusters.map((cluster) => (
    <g key={cluster.clusterId} pointerEvents="none">
      <circle cx={cluster.x} cy={cluster.y} r={48 + cluster.nodeIds.length * 5} fill="#0f172a" fillOpacity="0.2" stroke="#334155" strokeDasharray="4 5" />
      <text x={cluster.x} y={cluster.y - 52 - cluster.nodeIds.length * 5} textAnchor="middle" className="fill-muted-foreground text-3xs">{cluster.label}</text>
    </g>
  ));
}

function EdgeLayer(props: {
  activationPreview?: import('../../character-graph/neural-persona').NeuralPersonaActivationPreview | null;
  focusAlphas: ReadonlyMap<string, number>;
  nodes: Map<string, NeuralPersonaLayoutNode>;
  onSelectEdge: (edgeId: string) => void;
  selectedEdgeId?: string;
  selectedNodeId?: string;
  view: NeuralPersonaGraphExplorerView;
}) {
  const activation = createNeuralPersonaGraphActivationOverlay(
    props.activationPreview, props.view.edges,
  );
  return props.view.edges.map((edge) => {
    const source = props.nodes.get(edge.sourceNodeId);
    const target = props.nodes.get(edge.targetNodeId);
    if (!source || !target) return null;
    const style = resolveNeuralPersonaGraphEdgeVisualStyle({
      ...edge,
      activationPath: Boolean(activation?.pathEdgeKeys.includes(
        neuralPersonaGraphPathEdgeKey(edge.sourceNodeId, edge.targetNodeId),
      )),
      activationPreview: Boolean(activation),
      selectedEdgeId: props.selectedEdgeId, selectedNodeId: props.selectedNodeId,
    });
    const stroke = `#${style.color.toString(16).padStart(6, '0')}`;
    const select = () => props.onSelectEdge(edge.edgeId);
    return (
      <g key={edge.edgeId} data-neural-graph-edge data-neural-graph-source={edge.sourceNodeId} data-neural-graph-target={edge.targetNodeId} role="button" tabIndex={0} aria-label={`${edge.sourceNodeId} ${edge.relationType} ${edge.targetNodeId}`} onClick={select} onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => event.key === 'Enter' && select()} className="cursor-pointer outline-none">
        <line x1={source.x} y1={source.y} x2={target.x} y2={target.y} stroke="transparent" strokeWidth="14" />
        <line x1={source.x} y1={source.y} x2={target.x} y2={target.y} stroke={stroke} strokeOpacity={style.alpha * neuralPersonaGraphEdgeFocusAlpha(props.focusAlphas, edge.sourceNodeId, edge.targetNodeId)} strokeWidth={style.width} pointerEvents="none" style={{ transition: 'stroke-opacity 180ms ease' }} />
      </g>
    );
  });
}

function NodeLayer(props: {
  activationPreview?: import('../../character-graph/neural-persona').NeuralPersonaActivationPreview | null;
  batchSelectedNodeIds?: string[];
  beginDrag: (event: PointerEvent<SVGGElement>, nodeId: string) => void;
  edges: NeuralPersonaGraphExplorerView['edges'];
  focusedNodeId?: string;
  focusAlphas: ReadonlyMap<string, number>;
  multiSelectMode?: boolean;
  nodes: NeuralPersonaLayoutNode[];
  onSelectNode: (nodeId: string) => void;
  onFocusNode: (nodeId: string) => void;
  selectedNodeId?: string;
}) {
  const batchSelected = new Set(props.batchSelectedNodeIds);
  const activation = createNeuralPersonaGraphActivationOverlay(
    props.activationPreview, props.edges,
  );
  return props.nodes.map((node) => {
    const selected = node.nodeId === props.selectedNodeId || batchSelected.has(node.nodeId);
    const focused = node.nodeId === props.focusedNodeId;
    const style = resolveNeuralPersonaGraphNodeVisualStyle(node, selected);
    const active = activation?.activeNodeIds.includes(node.nodeId) ?? false;
    const suppressed = activation?.suppressedNodeIds.includes(node.nodeId) ?? false;
    const dimmed = Boolean(activation?.activeNodeIds.length && !active);
    const stroke = active ? '#34d399' : suppressed ? '#fb7185' : focused ? '#ffffff' : selected ? '#67e8f9'
      : neuralPersonaGraphColorHex(style.defaultStroke);
    return (
      <g key={node.nodeId} data-neural-graph-node data-neural-graph-node-id={node.nodeId} transform={`translate(${node.x} ${node.y})`} opacity={(props.focusAlphas.get(node.nodeId) ?? 1) * (active ? 1 : dimmed ? 0.28 : suppressed ? 0.65 : 1)} style={{ transition: 'opacity 180ms ease' }} role="button" tabIndex={0} aria-label={node.label} onClick={() => props.onFocusNode(node.nodeId)} onPointerEnter={() => !props.multiSelectMode && props.onSelectNode(node.nodeId)} onPointerDown={(event) => { if (!props.multiSelectMode) props.onFocusNode(node.nodeId); props.beginDrag(event, node.nodeId); }} onKeyDown={(event) => event.key === 'Enter' && props.onFocusNode(node.nodeId)} className="cursor-grab outline-none active:cursor-grabbing">
        {active || suppressed ? <circle cx={0} cy={0} r={style.radius + 9} fill={active ? '#22c55e' : '#f43f5e'} fillOpacity={active ? 0.38 : 0.28} /> : null}
        {style.haloAlpha ? <circle cx={0} cy={0} r={style.haloRadius} fill={neuralPersonaGraphColorHex(style.haloColor)} fillOpacity={style.haloAlpha} /> : null}
        <circle cx={0} cy={0} r={style.radius} fill={neuralPersonaGraphColorHex(style.fillColor)} fillOpacity={style.fillAlpha} stroke={stroke} strokeWidth={focused || selected ? 3 : 1.5} />
        <text x={0} y={0} textAnchor="middle" dominantBaseline="middle" fontSize={neuralPersonaGraphNodeInnerFontSize(node, selected)} fill={neuralPersonaGraphColorHex(style.labelColor)} pointerEvents="none">{neuralPersonaGraphNodeInnerText(node, selected)}</text>
      </g>
    );
  });
}

function MarqueeLayer(props: { marquee: { current: { x: number; y: number }; start: { x: number; y: number } } | null }) {
  if (!props.marquee) return null;
  const x = Math.min(props.marquee.start.x, props.marquee.current.x);
  const y = Math.min(props.marquee.start.y, props.marquee.current.y);
  const width = Math.abs(props.marquee.current.x - props.marquee.start.x);
  const height = Math.abs(props.marquee.current.y - props.marquee.start.y);
  return <rect x={x} y={y} width={width} height={height} fill="#22d3ee" fillOpacity="0.12" stroke="#67e8f9" strokeWidth="1.5" pointerEvents="none" />;
}

export function NeuralPersonaGraphSvgCanvas(props: {
  activationPreview?: import('../../character-graph/neural-persona').NeuralPersonaActivationPreview | null;
  batchSelectedNodeIds?: string[];
  canvasStyle: CSSProperties;
  editorMode: boolean;
  focusRootNodeId?: string;
  focusedNodeId?: string;
  multiSelectMode?: boolean;
  onApplyPhysicsConfig: (config: NeuralPersonaGraphPhysicsConfig) => void;
  onFocusNode: (nodeId?: string) => void;
  onMultiSelectModeChange: (enabled: boolean) => void;
  onSelectEdge: (edgeId: string) => void;
  onSelectNode: (nodeId: string) => void;
  onSelectNodes: (nodeIds: string[], append: boolean) => void;
  onToggleEditor: () => void;
  physicsConfig: NeuralPersonaGraphPhysicsConfig;
  selectedEdgeId?: string;
  selectedNodeId?: string;
  view: NeuralPersonaGraphExplorerView;
}) {
  const controller = useNeuralPersonaGraphCanvasController(
    props.view.nodes, props.view.edges, props.physicsConfig,
    { multiSelectMode: props.multiSelectMode, onSelectNodes: props.onSelectNodes },
  );
  const [activationVisible, setActivationVisible] = useState(true);
  useEffect(() => setActivationVisible(true), [props.activationPreview?.traceId]);
  const visiblePreview = activationVisible ? props.activationPreview : null;
  const byId = new Map(props.view.nodes.map((node) => [node.nodeId, node]));
  const focusAlphas = resolveNeuralPersonaGraphFocusAlphas(props.view, props.focusRootNodeId);
  return (
    <div className="relative bg-background">
      <NeuralPersonaGraphCanvasToolbar editorMode={props.editorMode} multiSelectMode={Boolean(props.multiSelectMode)} physicsConfig={props.physicsConfig} selectedNodeCount={props.batchSelectedNodeIds?.length ?? 0} onApplyPhysicsConfig={props.onApplyPhysicsConfig} onMultiSelectModeChange={props.onMultiSelectModeChange} onReset={() => { controller.reset(); setActivationVisible(false); }} onToggleEditor={props.onToggleEditor} />
      <svg ref={controller.svgRef} style={props.canvasStyle} data-neural-graph-canvas data-neural-graph-renderer="svg" viewBox={`0 0 ${NEURAL_PERSONA_GRAPH_VIEW_WIDTH} ${NEURAL_PERSONA_GRAPH_VIEW_HEIGHT}`} preserveAspectRatio="xMidYMid meet" className="touch-none rounded-sm bg-background" onPointerDown={(event) => { props.onFocusNode(undefined); controller.beginPan(event); }} onPointerMove={controller.move} onPointerUp={controller.end} onPointerCancel={controller.end} onWheel={controller.wheel}>
        <g transform={`translate(${controller.viewport.x} ${controller.viewport.y}) scale(${controller.viewport.scale})`}>
          <ClusterLayer view={props.view} />
          <EdgeLayer activationPreview={visiblePreview} focusAlphas={focusAlphas} view={props.view} nodes={byId} selectedEdgeId={props.selectedEdgeId} selectedNodeId={props.selectedNodeId} onSelectEdge={props.onSelectEdge} />
          <NodeLayer activationPreview={visiblePreview} batchSelectedNodeIds={props.batchSelectedNodeIds} nodes={props.view.nodes} edges={props.view.edges} beginDrag={controller.beginNodeDrag} focusAlphas={focusAlphas} focusedNodeId={props.focusedNodeId} multiSelectMode={props.multiSelectMode} selectedNodeId={props.selectedNodeId} onFocusNode={props.onFocusNode} onSelectNode={props.onSelectNode} />
        </g>
        <MarqueeLayer marquee={controller.marquee} />
      </svg>
    </div>
  );
}
