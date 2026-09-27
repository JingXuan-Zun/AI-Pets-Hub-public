/// <reference lib="webworker" />

import {
  createNeuralPersonaGraphPhysics,
  type NeuralPersonaGraphPhysics,
  type NeuralPersonaGraphPhysicsConfig,
  type NeuralPersonaGraphViewEdge,
  type NeuralPersonaLayoutNode,
} from '../../character-graph/neural-persona';
import type {
  NeuralGraphPhysicsWorkerCommand,
  NeuralGraphPhysicsWorkerFrame,
} from './neuralPersonaGraphPhysicsWorkerProtocol';
import {
  NEURAL_PERSONA_GRAPH_BASE_PHYSICS_FRAME_MS,
  NEURAL_PERSONA_GRAPH_PHYSICS_FRAME_MS,
} from './neuralPersonaGraphFrameRate';

const scope = self as unknown as DedicatedWorkerGlobalScope;
let engine: NeuralPersonaGraphPhysics | null = null;
let config: NeuralPersonaGraphPhysicsConfig | null = null;
let edges: NeuralPersonaGraphViewEdge[] = [];
let nodes: NeuralPersonaLayoutNode[] = [];
let previousTickAt: number | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;

function emitFrame() {
  if (!engine) return;
  const positions = new Float32Array(nodes.length * 2);
  nodes.forEach((node, index) => {
    const point = engine?.getPosition(node.nodeId);
    positions[index * 2] = point?.x ?? node.x;
    positions[index * 2 + 1] = point?.y ?? node.y;
  });
  const frame: NeuralGraphPhysicsWorkerFrame = {
    active: engine.isActive(), buffer: positions.buffer, type: 'frame',
  };
  scope.postMessage(frame, [positions.buffer]);
}

function tick() {
  timer = undefined;
  if (!engine) return;
  const startedAt = performance.now();
  const elapsed = previousTickAt === undefined
    ? NEURAL_PERSONA_GRAPH_PHYSICS_FRAME_MS
    : Math.min(NEURAL_PERSONA_GRAPH_BASE_PHYSICS_FRAME_MS * 4, startedAt - previousTickAt);
  previousTickAt = startedAt;
  engine.step(elapsed / NEURAL_PERSONA_GRAPH_BASE_PHYSICS_FRAME_MS);
  emitFrame();
  if (engine.isActive()) {
    const spent = performance.now() - startedAt;
    timer = setTimeout(tick, Math.max(0, NEURAL_PERSONA_GRAPH_PHYSICS_FRAME_MS - spent));
  } else previousTickAt = undefined;
}

function wake() {
  emitFrame();
  if (!timer && engine?.isActive()) {
    previousTickAt = performance.now();
    timer = setTimeout(tick, NEURAL_PERSONA_GRAPH_PHYSICS_FRAME_MS);
  }
}

function initialize(command: Extract<NeuralGraphPhysicsWorkerCommand, { type: 'init' }>) {
  config = command.config;
  edges = command.edges;
  nodes = command.nodes;
  engine = createNeuralPersonaGraphPhysics(command.nodes, command.edges, command.config);
  wake();
}

function reset(command: Extract<NeuralGraphPhysicsWorkerCommand, { type: 'reset' }>) {
  if (!config) return;
  nodes = command.nodes;
  engine = createNeuralPersonaGraphPhysics(nodes, edges, config);
}

function handleCommand(command: NeuralGraphPhysicsWorkerCommand) {
  if (command.type === 'init') return initialize(command);
  if (!engine) return undefined;
  if (command.type === 'update-config') {
    config = { ...config, ...command.config } as NeuralPersonaGraphPhysicsConfig;
    engine.setConfig(command.config);
  }
  if (command.type === 'pin') engine.pin(command.nodeId);
  if (command.type === 'drag') engine.movePinned(command.nodeId, command);
  if (command.type === 'release') engine.release(command.nodeId);
  if (command.type === 'reset') reset(command);
  wake();
  return undefined;
}

scope.onmessage = (event: MessageEvent<NeuralGraphPhysicsWorkerCommand>) => {
  handleCommand(event.data);
};
