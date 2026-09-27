import {
  NEURAL_PERSONA_GRAPH_VIEW_HEIGHT,
  NEURAL_PERSONA_GRAPH_VIEW_WIDTH,
  type NeuralPersonaGraphViewport,
} from '../../character-graph/neural-persona';

export const NEURAL_GRAPH_WIDTH = NEURAL_PERSONA_GRAPH_VIEW_WIDTH;
export const NEURAL_GRAPH_HEIGHT = NEURAL_PERSONA_GRAPH_VIEW_HEIGHT;

export type NeuralGraphPoint = { x: number; y: number };
export type NeuralGraphStageFit = { scale: number; x: number; y: number };
export type NeuralGraphWorldBounds = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

export function fitNeuralGraphStage(width: number, height: number): NeuralGraphStageFit {
  const scale = Math.max(0.01, Math.min(
    1, width / NEURAL_GRAPH_WIDTH, height / NEURAL_GRAPH_HEIGHT,
  ));
  return {
    scale,
    x: (width - NEURAL_GRAPH_WIDTH * scale) / 2,
    y: (height - NEURAL_GRAPH_HEIGHT * scale) / 2,
  };
}

export function neuralGraphScreenToStage(
  point: NeuralGraphPoint,
  fit: NeuralGraphStageFit,
): NeuralGraphPoint {
  return {
    x: (point.x - fit.x) / fit.scale,
    y: (point.y - fit.y) / fit.scale,
  };
}

export function neuralGraphVisibleStageBounds(width: number, height: number) {
  const fit = fitNeuralGraphStage(width, height);
  const topLeft = neuralGraphScreenToStage({ x: 0, y: 0 }, fit);
  const bottomRight = neuralGraphScreenToStage({ x: width, y: height }, fit);
  return {
    bottom: bottomRight.y,
    left: topLeft.x,
    right: bottomRight.x,
    top: topLeft.y,
  } satisfies NeuralGraphWorldBounds;
}

export function neuralGraphVisibleWorldBounds(
  viewport: NeuralPersonaGraphViewport,
  padding = 48,
  stageBounds: NeuralGraphWorldBounds = {
    bottom: NEURAL_GRAPH_HEIGHT, left: 0, right: NEURAL_GRAPH_WIDTH, top: 0,
  },
): NeuralGraphWorldBounds {
  const scale = Math.max(0.01, viewport.scale);
  return {
    bottom: (stageBounds.bottom - viewport.y) / scale + padding,
    left: (stageBounds.left - viewport.x) / scale - padding,
    right: (stageBounds.right - viewport.x) / scale + padding,
    top: (stageBounds.top - viewport.y) / scale - padding,
  };
}

export function neuralGraphPointVisible(point: NeuralGraphPoint, bounds: NeuralGraphWorldBounds) {
  return point.x >= bounds.left && point.x <= bounds.right
    && point.y >= bounds.top && point.y <= bounds.bottom;
}

export function neuralGraphSegmentBoundsVisible(
  source: NeuralGraphPoint,
  target: NeuralGraphPoint,
  bounds: NeuralGraphWorldBounds,
) {
  return Math.max(source.x, target.x) >= bounds.left
    && Math.min(source.x, target.x) <= bounds.right
    && Math.max(source.y, target.y) >= bounds.top
    && Math.min(source.y, target.y) <= bounds.bottom;
}
