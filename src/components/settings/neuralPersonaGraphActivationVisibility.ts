import type { NeuralPersonaGraphActivationOverlay } from './neuralPersonaGraphActivationOverlay';

export function createNeuralPersonaGraphActivationVisibility(
  initial?: NeuralPersonaGraphActivationOverlay,
  initialTraceId?: string,
) {
  let traceId = initialTraceId; let visible = initial !== undefined;
  return {
    hide: () => { visible = false; return undefined; },
    resolve: (next: NeuralPersonaGraphActivationOverlay | undefined, nextTraceId?: string) => {
      if (nextTraceId !== traceId) { traceId = nextTraceId; visible = true; }
      return visible ? next : undefined;
    },
  };
}
