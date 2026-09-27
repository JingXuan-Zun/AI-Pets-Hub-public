import type {
  NeuralPersonaGraphExplorerView,
  NeuralPersonaGraphViewport,
} from '../../character-graph/neural-persona';
import type { NeuralPersonaGraphPoint } from './neuralPersonaGraphPixiHitTesting';

export interface NeuralPersonaGraphPixiViewState {
  nodePositions: Record<string, NeuralPersonaGraphPoint>;
  viewport: NeuralPersonaGraphViewport;
}

export function mergeNeuralPersonaGraphViewState(
  previous: NeuralPersonaGraphPixiViewState | undefined,
  current: NeuralPersonaGraphPixiViewState,
): NeuralPersonaGraphPixiViewState {
  return {
    nodePositions: { ...previous?.nodePositions, ...current.nodePositions },
    viewport: { ...current.viewport },
  };
}

export function applyNeuralPersonaGraphViewState(
  view: NeuralPersonaGraphExplorerView,
  state?: NeuralPersonaGraphPixiViewState,
): NeuralPersonaGraphExplorerView {
  if (!state) return view;
  return {
    ...view,
    nodes: view.nodes.map((node) => {
      const retained = state.nodePositions[node.nodeId];
      return retained ? { ...node, x: retained.x, y: retained.y } : node;
    }),
  };
}

export function captureNeuralPersonaGraphViewState(
  view: NeuralPersonaGraphExplorerView,
  getPosition: (nodeId: string) => NeuralPersonaGraphPoint | null,
  viewport: NeuralPersonaGraphViewport,
): NeuralPersonaGraphPixiViewState {
  const nodePositions = Object.fromEntries(view.nodes.flatMap((node) => {
    const point = getPosition(node.nodeId);
    return point ? [[node.nodeId, { x: point.x, y: point.y }]] : [];
  }));
  return { nodePositions, viewport: { ...viewport } };
}
