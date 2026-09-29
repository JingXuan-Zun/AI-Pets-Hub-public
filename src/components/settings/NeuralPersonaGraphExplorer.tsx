import { useMemo, useState, type CSSProperties } from 'react';
import {
  EMPTY_NEURAL_PERSONA_GRAPH_FILTERS,
  buildNeuralPersonaGraphExplorerView,
  type NeuralPersonaGraphFilters,
  type NeuralPersonaGraphProjection,
} from '../../character-graph/neural-persona';
import { NeuralPersonaGraphCanvas } from './NeuralPersonaGraphCanvas';
import { NeuralPersonaGraphControls } from './NeuralPersonaGraphControls';
import { NeuralPersonaGraphDetails } from './NeuralPersonaGraphDetails';
import { useNeuralPersonaGraphPhysicsConfig } from './useNeuralPersonaGraphPhysicsConfig';

type Props = {
  activationPreview?: import('../../character-graph/neural-persona').NeuralPersonaActivationPreview | null;
  batchSelectedNodeIds?: string[];
  canvasStyle: CSSProperties;
  editorMode: boolean;
  exposeSourceRefs?: boolean;
  focusRootNodeId?: string;
  onFocusNodeChange?: (nodeId?: string) => void;
  onSelectedEdgeChange?: (edgeId?: string) => void;
  onSelectedNodeChange?: (nodeId?: string) => void;
  onMultiSelectModeChange: (enabled: boolean) => void;
  onSelectNodes: (nodeIds: string[], append: boolean) => void;
  onToggleEditor: () => void;
  projection: NeuralPersonaGraphProjection;
  multiSelectMode?: boolean;
  selectedEdgeId?: string;
  selectedNodeId?: string;
};

function safeProjection(projection: NeuralPersonaGraphProjection, exposeSourceRefs?: boolean) {
  return {
    ...projection,
    nodes: projection.nodes.map((node) => ({
      ...node, sourceRef: exposeSourceRefs ? node.sourceRef : undefined,
    })),
  };
}

export function NeuralPersonaGraphExplorer(props: Props) {
  const [filters, setFilters] = useState<NeuralPersonaGraphFilters>(EMPTY_NEURAL_PERSONA_GRAPH_FILTERS);
  const physics = useNeuralPersonaGraphPhysicsConfig(props.projection.roleId);
  const projection = useMemo(
    () => safeProjection(props.projection, props.exposeSourceRefs),
    [props.exposeSourceRefs, props.projection],
  );
  const view = useMemo(
    () => buildNeuralPersonaGraphExplorerView(projection, filters), [filters, projection],
  );
  const selectedNode = props.multiSelectMode ? null
    : projection.nodes.find((node) => node.nodeId === props.selectedNodeId) ?? null;
  const selectNode = (nodeId: string) => {
    props.onSelectedEdgeChange?.(undefined); props.onSelectedNodeChange?.(nodeId);
  };
  const selectEdge = (edgeId: string) => {
    props.onSelectedNodeChange?.(undefined); props.onSelectedEdgeChange?.(edgeId);
  };
  return (
    <section className="space-y-3 rounded-sm border border-border bg-secondary/10 p-4">
      <div className="flex items-center justify-between gap-3"><div><div className="text-xs font-semibold">神经人格图谱</div><div className="mt-1 text-2xs text-muted-foreground">浏览与编辑 · {view.nodes.length}/{projection.nodes.length} 个节点</div></div><span className="font-mono text-3xs text-muted-foreground">{projection.graphVersion}</span></div>
      <NeuralPersonaGraphControls filters={filters} nodes={projection.nodes} onChange={setFilters} tagIds={view.tagIds} />
      <div className={props.editorMode ? 'block' : 'grid gap-3 xl:grid-cols-[minmax(0,1fr)_240px]'}>
        <div className="overflow-hidden rounded-sm border border-border"><NeuralPersonaGraphCanvas activationPreview={props.activationPreview} batchSelectedNodeIds={props.batchSelectedNodeIds} canvasStyle={props.canvasStyle} editorMode={props.editorMode} focusRootNodeId={props.focusRootNodeId} multiSelectMode={props.multiSelectMode} physicsConfig={physics.config} roleId={props.projection.roleId} view={view} selectedEdgeId={props.selectedEdgeId} selectedNodeId={props.selectedNodeId} focusedNodeId={filters.focusNodeId} onApplyPhysicsConfig={physics.saveConfig} onFocusNode={props.onFocusNodeChange ?? (() => undefined)} onMultiSelectModeChange={props.onMultiSelectModeChange} onSelectEdge={selectEdge} onSelectNode={selectNode} onSelectNodes={props.onSelectNodes} onToggleEditor={props.onToggleEditor} /></div>
        {!props.editorMode ? <NeuralPersonaGraphDetails node={selectedNode} onFocus={(focusNodeId) => setFilters((current) => ({ ...current, focusNodeId }))} /> : null}
      </div>
    </section>
  );
}
