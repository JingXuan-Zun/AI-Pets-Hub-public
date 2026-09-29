import { type DesktopPetSlot } from '../../multiPetRoster';
import { type PetAction, type PetModelMotionBinding, type PetConfig } from '../../types';
import { isPetModelExpressionBinding } from '../../pet-runtime/content/petModelMotionBindingKinds';

const THREE_D_NATIVE_SHAPE_MOTION_ACTIONS = new Set<PetAction>([
  'WALKING',
  'RUNNING',
  'SWIMMING',
  'EATING',
  'HAPPY',
  'SAD',
]);

type PetNativeShapeMotionPet = {
  actionOverride?: PetAction | null;
  currentAction: PetAction;
  expressionAction?: PetAction | null;
  manualMotionBinding?: PetModelMotionBinding | null;
  modelType: PetConfig['modelType'];
};

export function shouldTreat3DVisualStateAsNativeShapeMotion({
  actionOverride = null,
  currentAction,
  expressionAction = null,
  manualMotionBinding = null,
  modelType,
}: PetNativeShapeMotionPet) {
  if (modelType !== '3d') {
    return false;
  }

  if (manualMotionBinding && !isPetModelExpressionBinding(manualMotionBinding)) {
    return true;
  }

  const visualAction = actionOverride ?? expressionAction ?? currentAction;
  return THREE_D_NATIVE_SHAPE_MOTION_ACTIONS.has(visualAction);
}

type ResolveNativePetShapeMotionActiveOptions = {
  companionSlots?: Array<Pick<DesktopPetSlot, 'currentAction' | 'id' | 'modelType'>>;
  isAutoMoving: boolean;
  primary: PetNativeShapeMotionPet;
  selectedCustomMotionByPetId?: Record<string, PetModelMotionBinding | undefined>;
};

export function resolveNativePetShapeMotionActive({
  companionSlots = [],
  isAutoMoving,
  primary,
  selectedCustomMotionByPetId = {},
}: ResolveNativePetShapeMotionActiveOptions) {
  return isAutoMoving
    || shouldTreat3DVisualStateAsNativeShapeMotion(primary)
    || companionSlots.some((slot) => shouldTreat3DVisualStateAsNativeShapeMotion({
      currentAction: slot.currentAction,
      manualMotionBinding: selectedCustomMotionByPetId[slot.id] ?? null,
      modelType: slot.modelType,
    }));
}
