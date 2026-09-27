import { NEURAL_PERSONA_GRAPH_INITIAL_ORIGIN } from './neuralPersonaGraphDimensions';

export interface NeuralPersonaGraphViewport {
  scale: number;
  x: number;
  y: number;
}

export const DEFAULT_NEURAL_PERSONA_GRAPH_VIEWPORT: NeuralPersonaGraphViewport = {
  scale: 1,
  x: 0,
  y: 0,
};

export const CENTERED_NEURAL_PERSONA_GRAPH_VIEWPORT: NeuralPersonaGraphViewport = {
  scale: 1,
  x: -NEURAL_PERSONA_GRAPH_INITIAL_ORIGIN.x,
  y: -NEURAL_PERSONA_GRAPH_INITIAL_ORIGIN.y,
};

export const NEURAL_PERSONA_GRAPH_MIN_SCALE = 0.05;

export function panNeuralPersonaGraphViewport(
  viewport: NeuralPersonaGraphViewport,
  delta: { x: number; y: number },
): NeuralPersonaGraphViewport {
  return { ...viewport, x: viewport.x + delta.x, y: viewport.y + delta.y };
}

export function zoomNeuralPersonaGraphViewport(
  viewport: NeuralPersonaGraphViewport,
  point: { x: number; y: number },
  zoomFactor: number,
): NeuralPersonaGraphViewport {
  const scale = Math.min(2.5, Math.max(
    NEURAL_PERSONA_GRAPH_MIN_SCALE,
    viewport.scale * zoomFactor,
  ));
  const ratio = scale / viewport.scale;
  return {
    scale,
    x: point.x - (point.x - viewport.x) * ratio,
    y: point.y - (point.y - viewport.y) * ratio,
  };
}
