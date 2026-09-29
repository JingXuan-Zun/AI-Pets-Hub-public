import type {
  NeuralPersonaGraphPhysics,
  NeuralPersonaGraphPhysicsConfig,
  NeuralPersonaGraphPhysicsPoint,
  NeuralPersonaGraphViewEdge,
  NeuralPersonaLayoutNode,
} from '../../character-graph/neural-persona';
import type {
  NeuralGraphPhysicsWorkerCommand,
  NeuralGraphPhysicsWorkerFrame,
} from './neuralPersonaGraphPhysicsWorkerProtocol';

export type NeuralPersonaGraphWorkerPhysics = NeuralPersonaGraphPhysics & { destroy: () => void };

type WorkerPhysicsOptions = {
  config: NeuralPersonaGraphPhysicsConfig;
  edges: NeuralPersonaGraphViewEdge[];
  nodes: NeuralPersonaLayoutNode[];
  onFailure: () => void;
  onFrame: () => void;
  resetNodes?: NeuralPersonaLayoutNode[];
};

function send(worker: Worker, command: NeuralGraphPhysicsWorkerCommand) {
  worker.postMessage(command);
}

type WorkerPhysicsState = {
  active: boolean;
  pinnedNodeId?: string;
  pinnedPoint?: NeuralPersonaGraphPhysicsPoint;
};

function createWorkerPhysicsFacade(
  worker: Worker,
  positions: Map<string, NeuralPersonaGraphPhysicsPoint>,
  options: WorkerPhysicsOptions,
  state: WorkerPhysicsState,
): NeuralPersonaGraphWorkerPhysics {
  return {
    destroy: () => worker.terminate(),
    getPosition: (nodeId) => positions.get(nodeId) ?? null,
    isActive: () => state.active || state.pinnedNodeId !== undefined,
    movePinned: (nodeId, point) => {
      state.pinnedNodeId = nodeId;
      state.pinnedPoint = { ...point };
      Object.assign(positions.get(nodeId) ?? {}, point);
      send(worker, { nodeId, type: 'drag', ...point });
    },
    pin: (nodeId) => {
      state.pinnedNodeId = nodeId;
      state.pinnedPoint = positions.get(nodeId);
      send(worker, { nodeId, type: 'pin' });
    },
    release: (nodeId) => {
      state.pinnedNodeId = undefined; state.pinnedPoint = undefined;
      send(worker, { nodeId, type: 'release' });
    },
    reset: () => {
      const resetNodes = options.resetNodes ?? options.nodes;
      positions.clear();
      resetNodes.forEach((node) => positions.set(node.nodeId, { x: node.x, y: node.y }));
      state.pinnedNodeId = undefined; state.pinnedPoint = undefined;
      send(worker, { nodes: resetNodes, type: 'reset' });
    },
    setConfig: (config) => send(worker, { config, type: 'update-config' }),
    step: () => state.active ? 1 : 0,
  };
}

export function createNeuralPersonaGraphWorkerPhysics(options: WorkerPhysicsOptions): NeuralPersonaGraphWorkerPhysics {
  const worker = new Worker(new URL('./neuralPersonaGraphPhysics.worker.ts', import.meta.url), {
    name: 'Neural Persona Graph Physics', type: 'module',
  });
  const positions = new Map(options.nodes.map((node) => [node.nodeId, { x: node.x, y: node.y }]));
  const state: WorkerPhysicsState = { active: false };
  worker.onmessage = (event: MessageEvent<NeuralGraphPhysicsWorkerFrame>) => {
    if (event.data.type !== 'frame') return;
    const values = new Float32Array(event.data.buffer);
    options.nodes.forEach((node, index) => {
      const point = positions.get(node.nodeId);
      if (point && node.nodeId !== state.pinnedNodeId) {
        point.x = values[index * 2];
        point.y = values[index * 2 + 1];
      }
    });
    if (state.pinnedNodeId && state.pinnedPoint) {
      Object.assign(positions.get(state.pinnedNodeId) ?? {}, state.pinnedPoint);
    }
    state.active = event.data.active;
    options.onFrame();
  };
  worker.onerror = () => options.onFailure();
  send(worker, { config: options.config, edges: options.edges, nodes: options.nodes, type: 'init' });
  return createWorkerPhysicsFacade(worker, positions, options, state);
}
