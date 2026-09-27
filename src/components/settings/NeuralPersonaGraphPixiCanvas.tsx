import type { CSSProperties } from 'react';
import type {
  NeuralPersonaGraphExplorerView,
  NeuralPersonaGraphPhysicsConfig,
} from '../../character-graph/neural-persona';
import { NeuralPersonaGraphCanvasToolbar } from './NeuralPersonaGraphCanvasToolbar';
import { useNeuralPersonaGraphPixiCanvas } from './useNeuralPersonaGraphPixiCanvas';

export function NeuralPersonaGraphPixiCanvas(props: {
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
  onFailure: () => void;
  onSelectEdge: (edgeId: string) => void;
  onSelectNode: (nodeId: string) => void;
  onSelectNodes: (nodeIds: string[], append: boolean) => void;
  onToggleEditor: () => void;
  physicsConfig: NeuralPersonaGraphPhysicsConfig;
  roleId: string;
  selectedEdgeId?: string;
  selectedNodeId?: string;
  view: NeuralPersonaGraphExplorerView;
}) {
  const controller = useNeuralPersonaGraphPixiCanvas(props);
  return (
    <div className="relative bg-background">
      <NeuralPersonaGraphCanvasToolbar editorMode={props.editorMode} multiSelectMode={Boolean(props.multiSelectMode)} physicsConfig={props.physicsConfig} selectedNodeCount={props.batchSelectedNodeIds?.length ?? 0} onApplyPhysicsConfig={props.onApplyPhysicsConfig} onMultiSelectModeChange={props.onMultiSelectModeChange} onReset={controller.reset} onToggleEditor={props.onToggleEditor} />
      {controller.diagnosticsEnabled ? (
        <pre ref={controller.diagnosticsRef} data-neural-graph-diagnostics className="pointer-events-none absolute left-2 top-2 z-10 min-w-40 rounded-sm border border-cyan-400/40 bg-black/80 px-2 py-1.5 font-mono text-2xs leading-4 text-cyan-100">Renderer  Pixi WebGL{`\n`}等待采样...</pre>
      ) : null}
      <div ref={controller.hostRef} style={props.canvasStyle} data-neural-graph-canvas data-neural-graph-renderer="pixi" className="overflow-hidden bg-background" />
      <div className="sr-only">
        {props.view.nodes.map((node) => <button key={node.nodeId} type="button" data-neural-graph-node data-neural-graph-node-id={node.nodeId} data-neural-graph-x={node.x} data-neural-graph-y={node.y} onClick={() => props.onSelectNode(node.nodeId)}>{node.label}</button>)}
        {props.view.edges.map((edge) => <button key={edge.edgeId} type="button" data-neural-graph-edge onClick={() => props.onSelectEdge(edge.edgeId)}>{edge.sourceNodeId} {edge.relationType} {edge.targetNodeId}</button>)}
      </div>
    </div>
  );
}
