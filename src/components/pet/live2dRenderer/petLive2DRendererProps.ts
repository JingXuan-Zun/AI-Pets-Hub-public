import { type PetAction, type PetModelMotionBinding } from '../../../types';
import { type PetContentManifest } from '../../../pet-runtime/content/petContentManifest';
import { type AvatarRuntimeEventListener } from '../../../pet-runtime/avatar-runtime/avatarRuntimeEvents';
import { type AvatarRuntimeViewport } from '../../../pet-runtime/avatar-runtime/avatarRuntimeTypes';
import { type PetHoverState } from '../../../pet-runtime/interactions/petHoverController';
import { type Live2DRuntimeProfileConfigV1 } from '../../../pet-runtime/live2d/live2dRuntimeProfile';
import { type PetVisualBounds } from '../petVisualBounds';

type Position = {
  x: number;
  y: number;
};

export interface PetLive2DRendererProps {
  action: PetAction;
  debugPetId?: string;
  expressionAction?: PetAction | null;
  focusTarget?: Position | null;
  hoverState?: PetHoverState | null;
  isDragging?: boolean;
  isSpeaking?: boolean;
  isTyping?: boolean;
  isMoving: boolean;
  latestMessage?: string;
  live2dRuntimeProfile?: Live2DRuntimeProfileConfigV1 | null;
  contentManifestOverride?: PetContentManifest | null;
  manualExpressionBinding?: PetModelMotionBinding | null;
  manualMotionBinding?: PetModelMotionBinding | null;
  motionBindings?: PetModelMotionBinding[];
  modelUrl: string;
  onRuntimeEvent?: AvatarRuntimeEventListener;
  onVisualBoundsChange?: (bounds: PetVisualBounds) => void;
  pointerLookTarget?: Position | null;
  scale: number;
  viewport?: AvatarRuntimeViewport | null;
  visible?: boolean;
}
