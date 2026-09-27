import { type PetVisualBounds } from '../../components/pet/petVisualBounds';
import { type AvatarRuntimeKind } from './avatarRuntimeTypes';

export type AvatarRuntimeVisualBoundsSource = 'fallback' | 'measured';
export type AvatarRuntimePerfStats = {
  fps?: number | null;
  frameIntervalMs?: number | null;
};

export type AvatarRuntimeEvent =
  | {
    petId: string;
    runtimeKind: AvatarRuntimeKind;
    type: 'ready';
  }
  | {
    bounds: PetVisualBounds;
    petId: string;
    runtimeKind: AvatarRuntimeKind;
    source: AvatarRuntimeVisualBoundsSource;
    type: 'visual-bounds';
  }
  | {
    motionKey: string | null;
    petId: string;
    runtimeKind: AvatarRuntimeKind;
    type: 'motion-state-changed';
  }
  | {
    expressionKey: string | null;
    petId: string;
    runtimeKind: AvatarRuntimeKind;
    type: 'expression-state-changed';
  }
  | (AvatarRuntimePerfStats & {
    petId: string;
    runtimeKind: AvatarRuntimeKind;
    type: 'perf-stats';
  })
  | {
    errorMessage: string;
    petId: string;
    runtimeKind: AvatarRuntimeKind;
    type: 'error';
  };

export type AvatarRuntimeEventListener = (event: AvatarRuntimeEvent) => void;
