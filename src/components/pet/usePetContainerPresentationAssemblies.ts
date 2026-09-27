import { type PetConfig } from '../../types';
import { type PetVisualBounds } from './petVisualBounds';
import { type SelectedCustomMotionBindingMap } from './usePetContainerCustomMotionSelection';
import { usePetContainerPresentationState } from './usePetContainerDerivedState';
import {
  useActivePetPanelPresentation,
  usePetContainerViewportLayout,
} from './usePetContainerPanelLayout';

type Position = { x: number; y: number };
type Size = { width: number; height: number };

interface UsePetContainerPresentationAssembliesOptions {
  activityArea: { width: number; height: number };
  activityCenter: Position;
  activityDisplayId: PetConfig['settings']['activityDisplayId'];
  activityViewport: { x: number; y: number; width: number; height: number };
  activeCompanionPanelRenderPosition: { petId: string; position: Position } | null;
  availableDisplays: DesktopPetDisplayLike[];
  companionRenderSlots: Array<PetConfig['companionPets'][number] & { position: Position }>;
  chatPanelSize: Size;
  config: PetConfig;
  getScaledCompanionVisualBounds: (petId: string, scale: number) => PetVisualBounds;
  interactiveDialogueDisplayId: PetConfig['settings']['interactiveDialogueDisplayId'];
  isInteractiveDialogueActive: boolean;
  latestPetMessage: string;
  latestPetMessages: Record<string, string>;
  panelPetId: string;
  petPos: Position;
  petVisualBounds: PetVisualBounds;
  sceneSize: Size;
  selectedCustomMotionByPetId: SelectedCustomMotionBindingMap;
  typingPetId: string | null;
}

export function usePetContainerPresentationAssemblies({
  activityArea,
  activityCenter,
  activityDisplayId,
  activityViewport,
  activeCompanionPanelRenderPosition,
  availableDisplays,
  chatPanelSize,
  companionRenderSlots,
  config,
  getScaledCompanionVisualBounds,
  interactiveDialogueDisplayId,
  isInteractiveDialogueActive,
  latestPetMessage,
  latestPetMessages,
  panelPetId,
  petPos,
  petVisualBounds,
  sceneSize,
  selectedCustomMotionByPetId,
  typingPetId,
}: UsePetContainerPresentationAssembliesOptions) {
  const layoutState = usePetContainerViewportLayout({
    activityArea,
    activityCenter,
    activityDisplayId,
    activityViewport,
    availableDisplays,
    chatPanelSize,
    interactiveDialogueDisplayId,
    petVisualBounds,
    renderedPetPos: petPos,
    sceneSize,
  });
  const presentationState = usePetContainerPresentationState({
    config,
    typingPetId,
  });
  const activePanelState = useActivePetPanelPresentation({
    activityCenter,
    activeCompanionPanelRenderPosition,
    companionRenderSlots,
    getScaledCompanionVisualBounds,
    interactiveDialogueAnchorPosition: layoutState.interactiveDialogueAnchorPosition,
    interactiveDialogueVisualSize: layoutState.interactiveDialogueVisualSize,
    isInteractiveDialogueActive,
    latestPetMessage,
    latestPetMessages,
    panelPetId,
    petAnchorPosition: layoutState.petAnchorPosition,
    petVisualBounds,
    petVisualSize: layoutState.petVisualSize,
    primaryPetScale: config.scale,
    renderedPetPos: petPos,
    selectedCustomMotionByPetId,
    typingPetId,
  });

  return {
    ...layoutState,
    ...presentationState,
    ...activePanelState,
  };
}
