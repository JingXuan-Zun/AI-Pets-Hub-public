export interface NeuralPersonaGraphPhysicsConfig {
  anchorStrength: number;
  collisionDistance: number;
  collisionStrength: number;
  damping: number;
  dragFollowStrength: number;
  dragMaxStretch: number;
  dragNeighborRange: number;
  linkDistance: number;
  linkStrength: number;
  linkWeightDistance: number;
  linkWeightStrength: number;
  maxVelocity: number;
  repulsionDistance: number;
  repulsionStrength: number;
}

export const DEFAULT_NEURAL_PERSONA_GRAPH_PHYSICS_CONFIG: NeuralPersonaGraphPhysicsConfig = {
  anchorStrength: 0.0018,
  collisionDistance: 34,
  collisionStrength: 0.075,
  damping: 0.84,
  dragFollowStrength: 1,
  dragMaxStretch: 260,
  dragNeighborRange: 1.2,
  linkDistance: 92,
  linkStrength: 0.006,
  linkWeightDistance: 28,
  linkWeightStrength: 0.006,
  maxVelocity: 18,
  repulsionDistance: 76,
  repulsionStrength: 0.42,
};

const RANGES: Record<keyof NeuralPersonaGraphPhysicsConfig, [number, number]> = {
  anchorStrength: [0, 0.02], collisionDistance: [8, 160], collisionStrength: [0, 0.5],
  damping: [0.5, 0.99], dragFollowStrength: [0, 1], dragMaxStretch: [60, 1200],
  dragNeighborRange: [0.5, 3],
  linkDistance: [20, 500],
  linkStrength: [0, 0.05], linkWeightDistance: [0, 100],
  linkWeightStrength: [0, 0.05], maxVelocity: [1, 80],
  repulsionDistance: [16, 400], repulsionStrength: [0, 2],
};

function bounded(value: unknown, fallback: number, range: [number, number]) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(range[0], Math.min(range[1], value));
}

export function normalizeNeuralPersonaGraphPhysicsConfig(
  input?: Partial<NeuralPersonaGraphPhysicsConfig>,
): NeuralPersonaGraphPhysicsConfig {
  const defaults = DEFAULT_NEURAL_PERSONA_GRAPH_PHYSICS_CONFIG;
  return Object.fromEntries(Object.keys(defaults).map((key) => {
    const field = key as keyof NeuralPersonaGraphPhysicsConfig;
    return [field, bounded(input?.[field], defaults[field], RANGES[field])];
  })) as unknown as NeuralPersonaGraphPhysicsConfig;
}

export function resolveNeuralPersonaGraphRepulsionDistance(
  config: NeuralPersonaGraphPhysicsConfig,
) {
  return Math.max(
    config.repulsionDistance,
    Math.min(config.linkDistance, config.repulsionDistance * 2),
  );
}
