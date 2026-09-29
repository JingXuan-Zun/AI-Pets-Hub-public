import { useState, type CSSProperties } from 'react';
import type {
  NeuralPersonaGraphExplorerView,
  NeuralPersonaGraphPhysicsConfig,
} from '../../character-graph/neural-persona';
import { NeuralPersonaGraphPixiCanvas } from './NeuralPersonaGraphPixiCanvas';
import { NeuralPersonaGraphSvgCanvas } from './NeuralPersonaGraphSvgCanvas';

export function NeuralPersonaGraphCanvas(props: {
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
  roleId: string;
  selectedEdgeId?: string;
  selectedNodeId?: string;
  view: NeuralPersonaGraphExplorerView;
}) {
  const [pixiFailed, setPixiFailed] = useState(false);
  return pixiFailed
    ? <NeuralPersonaGraphSvgCanvas {...props} />
    : <NeuralPersonaGraphPixiCanvas {...props} onFailure={() => setPixiFailed(true)} />;
}
