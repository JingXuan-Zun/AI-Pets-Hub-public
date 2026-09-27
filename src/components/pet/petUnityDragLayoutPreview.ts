import { type AvatarRuntimePresentationMode } from '../../pet-runtime/avatar-runtime/avatarRuntimeTypes';
import { createUnityLayoutCommand } from '../../pet-runtime/avatar-runtime/unity/unityBridgeCommandSurface';
import { resolveUnity3DViewportShellSize } from './petVisualBounds';

type Position = {
  x: number;
  y: number;
};

type Size = {
  height: number;
  width: number;
};

export function resolveUnityDragLayoutPreviewCommand({
  activityCenter,
  isMoving = false,
  petId,
  position,
  presentationMode = 'default',
  scale,
  screen,
}: {
  activityCenter: Position;
  isMoving?: boolean;
  petId: string;
  position: Position;
  presentationMode?: AvatarRuntimePresentationMode;
  scale: number;
  screen: Size;
}) {
  const shellSize = resolveUnity3DViewportShellSize(scale, isMoving);
  const centerX = activityCenter.x + position.x;
  const centerY = activityCenter.y + position.y;

  return createUnityLayoutCommand({
    petId,
    presentationMode,
    scale,
    screenHeight: Math.max(0, Math.round(screen.height)),
    screenWidth: Math.max(0, Math.round(screen.width)),
    viewportHeight: shellSize,
    viewportWidth: shellSize,
    viewportX: Math.round(centerX - shellSize / 2),
    viewportY: Math.round(centerY - shellSize / 2),
  });
}
