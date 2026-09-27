import type {
  NeuralPersonaGraphPhysicsConfig,
  NeuralPersonaGraphViewEdge,
  NeuralPersonaLayoutNode,
} from '../../character-graph/neural-persona';

export type NeuralGraphPhysicsWorkerCommand =
  | { config: NeuralPersonaGraphPhysicsConfig; edges: NeuralPersonaGraphViewEdge[]; nodes: NeuralPersonaLayoutNode[]; type: 'init' }
  | { config: Partial<NeuralPersonaGraphPhysicsConfig>; type: 'update-config' }
  | { nodeId: string; type: 'pin' }
  | { nodeId: string; type: 'release' }
  | { nodeId: string; type: 'drag'; x: number; y: number }
  | { nodes: NeuralPersonaLayoutNode[]; type: 'reset' };

export interface NeuralGraphPhysicsWorkerFrame {
  active: boolean;
  buffer: ArrayBuffer;
  type: 'frame';
}
