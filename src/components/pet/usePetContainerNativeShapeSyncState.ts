import { PRIMARY_DESKTOP_PET_SLOT_ID } from '../../multiPetRoster';
import { type PetAction, type PetConfig, type PetModelMotionBinding } from '../../types';
import { type DirectionalExtents } from './petActivityRegionMath';
import { type NativeDragCompanionRenderSlot, type Position } from './petContainerNativeDragPreview';
import { createNativeInteractiveRegionPostRenderSyncKey } from './petNativeInteractiveRegionSyncKey';
import { resolveNativePetShapeMotionActive } from './petNativeShapeMotionState';
import {
  POST_DRAG_NATIVE_SHAPE_HOLD_STATE,
  usePetContainerPostDragNativeShapeHold,
} from './usePetContainerPostDragNativeShapeHold';

type NativeShapeCompanionSlot = NativeDragCompanionRenderSlot & {
  currentAction: PetAction;
};

interface UsePetContainerNativeShapeSyncStateOptions {
  actionOverride?: PetAction | null;
  activityArea: { height: number; width: number };
  activityCenter: Position;
  activityRegionDragState: unknown;
  activityRegionResizeState: unknown;
  companionDragState: unknown;
  companionRenderSlots: NativeShapeCompanionSlot[];
  companionVisualBoundsById: Record<string, DirectionalExtents>;
  config: PetConfig;
  dragState: unknown;
  expressionAction?: PetAction | null;
  getScaledCompanionVisualBounds: (petId: string, scale: number) => DirectionalExtents;
  isAutoMoving: boolean;
  isCompanionDragActive: boolean;
  isPetDragActive: boolean;
  petPos: Position;
  petVisualBounds: DirectionalExtents;
  selectedCustomMotionByPetId: Record<string, PetModelMotionBinding | undefined>;
  setCompanionRenderSlotsForNativeDrag: (slots: NativeDragCompanionRenderSlot[]) => void;
}

export function usePetContainerNativeShapeSyncState({
  actionOverride = null,
  activityArea,
  activityCenter,
  activityRegionDragState,
  activityRegionResizeState,
  companionDragState,
  companionRenderSlots,
  companionVisualBoundsById,
  config,
  dragState,
  expressionAction = null,
  getScaledCompanionVisualBounds,
  isAutoMoving,
  isCompanionDragActive,
  isPetDragActive,
  petPos,
  petVisualBounds,
  selectedCustomMotionByPetId,
  setCompanionRenderSlotsForNativeDrag,
}: UsePetContainerNativeShapeSyncStateOptions) {
  setCompanionRenderSlotsForNativeDrag(companionRenderSlots);

  const isNativePetShapeMotionActive = resolveNativePetShapeMotionActive({
    companionSlots: companionRenderSlots,
    isAutoMoving,
    primary: {
      actionOverride,
      currentAction: config.currentAction,
      expressionAction,
      manualMotionBinding: selectedCustomMotionByPetId[PRIMARY_DESKTOP_PET_SLOT_ID] ?? null,
      modelType: config.modelType,
    },
    selectedCustomMotionByPetId,
  });
  const nativeInteractiveRegionPostRenderSyncKey = createNativeInteractiveRegionPostRenderSyncKey({
    activityArea,
    activityCenter,
    companionSlots: companionRenderSlots.map((slot) => ({
      id: slot.id,
      position: slot.position,
      scale: slot.scale,
      visualBounds: companionVisualBoundsById[slot.id] ?? getScaledCompanionVisualBounds(slot.id, slot.scale),
    })),
    isActivityRegionInteractionActive: Boolean(activityRegionDragState || activityRegionResizeState),
    isCompanionDragActive,
    isPetMotionActive: isNativePetShapeMotionActive,
    isPrimaryDragActive: isPetDragActive,
    primary: {
      position: petPos,
      scale: config.scale,
      visualBounds: petVisualBounds,
    },
  });
  const isAnyPetDragActive = isPetDragActive || isCompanionDragActive;
  const isPostDragNativeShapeHoldActive = usePetContainerPostDragNativeShapeHold(isAnyPetDragActive);
  const useFullWindowNativeShapeForPetDrag = isAnyPetDragActive || isPostDragNativeShapeHoldActive;
  const nativeShapeDragState = isPetDragActive
    ? dragState
    : isPostDragNativeShapeHoldActive
      ? POST_DRAG_NATIVE_SHAPE_HOLD_STATE
      : null;
  const nativeShapeCompanionDragState = isCompanionDragActive ? companionDragState : null;

  return {
    isNativePetShapeMotionActive,
    nativeInteractiveRegionPostRenderSyncKey,
    nativeShapeCompanionDragState,
    nativeShapeDragState,
    useFullWindowNativeShapeForPetDrag,
  };
}
