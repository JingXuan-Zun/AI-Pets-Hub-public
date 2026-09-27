interface ConvergencePoint { x: number; y: number }
interface ConvergenceLink {
  desiredDistance?: number;
  source: ConvergencePoint;
  target: ConvergencePoint;
}

export interface NeuralPersonaGraphConvergenceState {
  alpha: number;
  bestLinkError?: number;
  pinnedNodeId?: string;
  settleRemaining: number;
}

export const NEURAL_PERSONA_GRAPH_SETTLE_BUDGET = 180;

function linkError(link: ConvergenceLink, targetDistance: number) {
  const target = link.desiredDistance ?? targetDistance;
  const distance = Math.hypot(
    link.target.x - link.source.x,
    link.target.y - link.source.y,
  );
  return { absolute: Math.abs(distance - target), target };
}

function releaseConvergenceAlpha(errors: { absolute: number; target: number }[]) {
  const largestRatio = errors.reduce((largest, error) => (
    Math.max(largest, error.absolute / Math.max(1, error.target))
  ), 0);
  return Math.min(0.5, 0.1 + largestRatio * 0.05);
}

function recordConvergenceProgress(
  state: NeuralPersonaGraphConvergenceState,
  maximumError: number,
) {
  const threshold = Math.max(0.05, (state.bestLinkError ?? maximumError) * 0.0005);
  if (state.bestLinkError !== undefined
    && maximumError > state.bestLinkError - threshold) return;
  state.bestLinkError = maximumError;
  state.settleRemaining = Math.max(
    state.settleRemaining, NEURAL_PERSONA_GRAPH_SETTLE_BUDGET,
  );
}

export function maintainNeuralPersonaGraphLinkConvergence(
  links: ConvergenceLink[], state: NeuralPersonaGraphConvergenceState,
  targetDistance: number, timeScale: number,
) {
  if (state.settleRemaining <= 0) return;
  const tolerance = Math.max(4, targetDistance * 0.08);
  const errors = links.map((link) => linkError(link, targetDistance));
  const unfinished = errors.some((error) => (
    error.absolute > Math.max(tolerance, error.target * 0.08)
  ));
  if (!unfinished) {
    state.bestLinkError = undefined; state.settleRemaining = 0;
    return;
  }
  recordConvergenceProgress(
    state, Math.max(...errors.map((error) => error.absolute)),
  );
  state.alpha = Math.max(state.alpha, state.pinnedNodeId
    ? 0.14 : releaseConvergenceAlpha(errors));
  if (!state.pinnedNodeId) {
    state.settleRemaining = Math.max(0, state.settleRemaining - timeScale);
  }
}
