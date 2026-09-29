import {
  type PetContentManifest,
  type PetContentExpressionKey,
  type PetContentMotionKey,
} from '../content/petContentManifest';

export type AvatarRuntimeKind = 'three' | 'unity' | 'live2d';
export type AvatarRuntimePresentationMode = 'default' | 'interactive-dialogue';

export type AvatarRuntimeFocusTarget = {
  x: number;
  y: number;
};

export type AvatarRuntimeHoverState = {
  activeRegion: string | null;
  focusTarget: AvatarRuntimeFocusTarget | null;
  supportedRegions: string[];
};

export type AvatarRuntimeDragState = {
  active: boolean;
  deltaX: number;
  deltaY: number;
};

export type AvatarRuntimeManualMotionSelection = {
  candidateClipNames: string[];
  motionKey: PetContentMotionKey;
  playbackMode: 'loop' | 'native' | 'once';
};

export type AvatarRuntimeManualExpressionSelection = {
  candidateExpressionNames: string[];
  expressionKey: PetContentExpressionKey;
  weightMultiplier?: number;
};

export type AvatarRuntimeContentState = {
  contentManifest: PetContentManifest | null;
  contentManifestResolved: boolean;
  contentManifestSourceUrl: string | null;
  modelUrl: string;
};

export type AvatarRuntimeViewport = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type AvatarRuntimeLayoutState = {
  activeSceneCount: number;
  displayId: string | null;
  presentationMode: AvatarRuntimePresentationMode;
  scale: number;
  viewport: AvatarRuntimeViewport | null;
};
