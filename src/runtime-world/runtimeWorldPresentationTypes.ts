import type {
  RuntimeWorldBehaviorKind,
  RuntimeWorldMainState,
} from './runtimeWorldTypes';

export type RuntimeWorldPresentationAttention = 'none' | 'task' | 'user';

export type RuntimeWorldPresentationEmotion = 'concerned' | 'neutral' | 'positive';

export type RuntimeWorldPresentationEnergy = 'low' | 'normal';

/**
 * A backend-neutral performance instruction. Renderers may map it to their own
 * motions and parameters, but must not infer new behavior from it.
 */
export type RuntimeWorldPresentationIntent = {
  attention: RuntimeWorldPresentationAttention;
  behaviorKind: RuntimeWorldBehaviorKind;
  durationMs: number;
  emotion: RuntimeWorldPresentationEmotion;
  energy: RuntimeWorldPresentationEnergy;
  id: string;
  mainState: RuntimeWorldMainState;
  priority: number;
  reasonEventId: string | null;
  sourceBehaviorRequestId: string;
  timestampMs: number;
};
