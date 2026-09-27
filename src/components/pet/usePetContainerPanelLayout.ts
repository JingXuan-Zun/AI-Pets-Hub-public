import { useMemo } from 'react';
import { PRIMARY_DESKTOP_PET_SLOT_ID } from '../../multiPetRoster';
import { type PetConfig, type PetVisualSize } from '../../types';
import {
  PANEL_SCREEN_MARGIN,
  clampViewportCoordinate,
  resolveTopRightPanelPosition,
  type ViewportRect,
} from './petContainerMath';
import {
  getSelectedDisplayById,
  resolveActivityViewport,
} from './petActivityRegionMath';

type Position = { x: number; y: number };
type Size = { width: number; height: number };
type VisualBounds = { left: number; right: number; top: number; bottom: number };
type PanelRenderSlot = { id: string; position: Position; scale: number };
type CompanionPanelRenderPosition = { petId: string; position: Position } | null;
type SelectedMotionBindingMap = Record<string, { id: string } | undefined>;
const INTERACTIVE_DIALOGUE_MIN_SHELL_SIZE = 520;
const INTERACTIVE_DIALOGUE_MAX_SHELL_SIZE = 920;
const INTERACTIVE_DIALOGUE_STAGE_X_RATIO = 0.5;
const INTERACTIVE_DIALOGUE_STAGE_Y_RATIO = 0.6;
const INTERACTIVE_DIALOGUE_STAGE_WIDTH_RATIO = 0.45;
const INTERACTIVE_DIALOGUE_STAGE_HEIGHT_RATIO = 0.9;
const INTERACTIVE_DIALOGUE_CHAT_CENTER_Y_RATIO = 0.85;
const INTERACTIVE_DIALOGUE_CHAT_WIDTH_RATIO = 0.78;
const INTERACTIVE_DIALOGUE_CHAT_HEIGHT = 236;

function createPetVisualSize(bounds: VisualBounds): PetVisualSize {
  return {
    width: Math.max(1, Math.round(bounds.left + bounds.right)),
    height: Math.max(1, Math.round(bounds.top + bounds.bottom)),
  };
}

function createShellViewport(sceneSize: Size, activityViewport: ViewportRect) {
  return {
    x: 0,
    y: 0,
    width: Math.max(1, Math.round(sceneSize.width || activityViewport.width)),
    height: Math.max(1, Math.round(sceneSize.height || activityViewport.height)),
  } satisfies ViewportRect;
}

function createVisibleDisplayViewport(
  activityViewport: ViewportRect,
  shellViewport: ViewportRect,
  activityArea: Size,
) {
  return {
    // Use the full desktop shell viewport for 3D visibility recovery so
    // cross-screen dragging is not snapped back into a single display.
    x: Math.round(shellViewport.x),
    y: Math.round(shellViewport.y),
    width: Math.max(1, Math.round(shellViewport.width || activityViewport.width || activityArea.width)),
    height: Math.max(1, Math.round(shellViewport.height || activityViewport.height || activityArea.height)),
  } satisfies ViewportRect;
}

function createAnchorPosition(activityCenter: Position, position: Position) {
  return { x: activityCenter.x + position.x, y: activityCenter.y + position.y };
}

function createInteractiveDialogueShellSize(viewport: ViewportRect) {
  const preferredSize = Math.round(Math.min(
    viewport.width * INTERACTIVE_DIALOGUE_STAGE_WIDTH_RATIO,
    viewport.height * INTERACTIVE_DIALOGUE_STAGE_HEIGHT_RATIO,
  ));

  return Math.max(
    INTERACTIVE_DIALOGUE_MIN_SHELL_SIZE,
    Math.min(INTERACTIVE_DIALOGUE_MAX_SHELL_SIZE, preferredSize),
  );
}

function createInteractiveDialogueAnchorPosition(
  viewport: ViewportRect,
  interactiveDialogueShellSize: number,
) {
  return {
    x: clampViewportCoordinate(
      Math.round(viewport.x + viewport.width * INTERACTIVE_DIALOGUE_STAGE_X_RATIO),
      viewport.x + PANEL_SCREEN_MARGIN + Math.round(interactiveDialogueShellSize * 0.45),
      viewport.x + viewport.width - PANEL_SCREEN_MARGIN - Math.round(interactiveDialogueShellSize * 0.45),
    ),
    y: clampViewportCoordinate(
      Math.round(viewport.y + viewport.height * INTERACTIVE_DIALOGUE_STAGE_Y_RATIO),
      viewport.y + PANEL_SCREEN_MARGIN + Math.round(interactiveDialogueShellSize * 0.45),
      viewport.y + viewport.height - PANEL_SCREEN_MARGIN - Math.round(interactiveDialogueShellSize * 0.4),
    ),
  };
}

function createInteractiveDialogueStageFrame(
  interactiveDialogueAnchorPosition: Position,
  interactiveDialogueShellSize: number,
) {
  return {
    height: Math.round(interactiveDialogueShellSize * 1.06),
    left: interactiveDialogueAnchorPosition.x - Math.round(interactiveDialogueShellSize * 0.56),
    top: interactiveDialogueAnchorPosition.y - Math.round(interactiveDialogueShellSize * 0.64),
    width: Math.round(interactiveDialogueShellSize * 1.12),
  };
}

function resolveInteractiveDialogueViewport(
  activityViewport: ViewportRect,
  availableDisplays: DesktopPetDisplayLike[],
  sceneSize: Size,
  activityDisplayId: PetConfig['settings']['activityDisplayId'],
  interactiveDialogueDisplayId: PetConfig['settings']['interactiveDialogueDisplayId'],
) {
  if (interactiveDialogueDisplayId === 'activity') {
    return activityViewport;
  }

  const selectedDisplay = getSelectedDisplayById(
    availableDisplays,
    interactiveDialogueDisplayId,
  );
  if (!selectedDisplay) {
    return activityViewport;
  }

  const nextViewport = resolveActivityViewport(
    selectedDisplay,
    sceneSize,
    availableDisplays,
  );

  return nextViewport.width > 0 && nextViewport.height > 0
    ? nextViewport
    : activityViewport;
}

function createInteractiveDialogueChatPanelPosition(
  viewport: ViewportRect,
  panelSize: Size,
) {
  const interactiveWidth = Math.min(
    Math.max(620, Math.round(viewport.width * INTERACTIVE_DIALOGUE_CHAT_WIDTH_RATIO)),
    Math.max(620, viewport.width - PANEL_SCREEN_MARGIN * 2),
  );
  const interactiveHeight = INTERACTIVE_DIALOGUE_CHAT_HEIGHT;
  const left = Math.round(viewport.x + (viewport.width - interactiveWidth) / 2);
  const top = Math.round(viewport.y + viewport.height - interactiveHeight - PANEL_SCREEN_MARGIN);

  return {
    x: clampViewportCoordinate(
      left,
      viewport.x + PANEL_SCREEN_MARGIN,
      viewport.x + viewport.width - interactiveWidth - PANEL_SCREEN_MARGIN,
    ),
    y: clampViewportCoordinate(
      top,
      viewport.y + PANEL_SCREEN_MARGIN,
      viewport.y + viewport.height - interactiveHeight - PANEL_SCREEN_MARGIN,
    ),
  };
}

function resolveActivePanelPetSlot(
  panelPetId: string,
  renderedPetPos: Position,
  primaryPetScale: number,
  companionRenderSlots: PanelRenderSlot[],
  activeCompanionPanelRenderPosition: CompanionPanelRenderPosition,
) {
  if (panelPetId === PRIMARY_DESKTOP_PET_SLOT_ID) {
    return {
      id: PRIMARY_DESKTOP_PET_SLOT_ID,
      position: renderedPetPos,
      scale: primaryPetScale,
    };
  }

  const activeCompanionSlot = companionRenderSlots.find((slot) => slot.id === panelPetId) ?? null;
  if (!activeCompanionSlot) {
    return null;
  }

  if (activeCompanionPanelRenderPosition?.petId !== activeCompanionSlot.id) {
    return activeCompanionSlot;
  }

  return {
    ...activeCompanionSlot,
    position: activeCompanionPanelRenderPosition.position,
  };
}

function resolveActivePanelPetVisualSize(
  activePanelPetId: string | null,
  activePanelPetScale: number | null,
  isInteractiveDialogueActive: boolean,
  petVisualSize: PetVisualSize,
  interactiveDialogueVisualSize: PetVisualSize,
  getScaledCompanionVisualBounds: (petId: string, scale: number) => VisualBounds,
) {
  if (isInteractiveDialogueActive) {
    return interactiveDialogueVisualSize;
  }

  if (!activePanelPetId || activePanelPetId === PRIMARY_DESKTOP_PET_SLOT_ID || activePanelPetScale === null) {
    return petVisualSize;
  }

  return createPetVisualSize(getScaledCompanionVisualBounds(activePanelPetId, activePanelPetScale));
}

function createPetVisualBoundsFromSize(size: PetVisualSize): VisualBounds {
  return {
    bottom: Math.max(1, Math.round(size.height * 0.48)),
    left: Math.max(1, Math.round(size.width / 2)),
    right: Math.max(1, Math.round(size.width / 2)),
    top: Math.max(1, Math.round(size.height * 0.52)),
  };
}

function resolveActivePanelPetVisualBounds(
  activePanelPetId: string | null,
  activePanelPetScale: number | null,
  isInteractiveDialogueActive: boolean,
  primaryPetVisualBounds: VisualBounds,
  interactiveDialogueVisualSize: PetVisualSize,
  getScaledCompanionVisualBounds: (petId: string, scale: number) => VisualBounds,
) {
  if (isInteractiveDialogueActive) {
    return createPetVisualBoundsFromSize(interactiveDialogueVisualSize);
  }

  if (!activePanelPetId || activePanelPetId === PRIMARY_DESKTOP_PET_SLOT_ID || activePanelPetScale === null) {
    return primaryPetVisualBounds;
  }

  return getScaledCompanionVisualBounds(activePanelPetId, activePanelPetScale);
}

interface UsePetContainerViewportLayoutOptions {
  activityArea: Size;
  activityCenter: Position;
  activityDisplayId: PetConfig['settings']['activityDisplayId'];
  activityViewport: ViewportRect;
  availableDisplays: DesktopPetDisplayLike[];
  chatPanelSize: Size;
  interactiveDialogueDisplayId: PetConfig['settings']['interactiveDialogueDisplayId'];
  petVisualBounds: VisualBounds;
  renderedPetPos: Position;
  sceneSize: Size;
}

export function usePetContainerViewportLayout({
  activityArea,
  activityCenter,
  activityDisplayId,
  activityViewport,
  availableDisplays,
  chatPanelSize,
  interactiveDialogueDisplayId,
  petVisualBounds,
  renderedPetPos,
  sceneSize,
}: UsePetContainerViewportLayoutOptions) {
  const petVisualSize = useMemo(() => createPetVisualSize(petVisualBounds), [petVisualBounds]);
  const shellViewport = useMemo(() => createShellViewport(sceneSize, activityViewport), [activityViewport, sceneSize]);
  const visibleDisplayViewport = useMemo(() => createVisibleDisplayViewport(activityViewport, shellViewport, activityArea), [activityArea, activityViewport, shellViewport]);
  const chatPanelBasePosition = useMemo(() => resolveTopRightPanelPosition(shellViewport, chatPanelSize), [chatPanelSize, shellViewport]);
  const petAnchorPosition = useMemo(() => createAnchorPosition(activityCenter, renderedPetPos), [activityCenter, renderedPetPos]);
  const interactiveDialogueViewport = useMemo(() => resolveInteractiveDialogueViewport(
    activityViewport,
    availableDisplays,
    sceneSize,
    activityDisplayId,
    interactiveDialogueDisplayId,
  ), [activityDisplayId, activityViewport, availableDisplays, interactiveDialogueDisplayId, sceneSize]);
  const interactiveDialogueShellSize = useMemo(() => createInteractiveDialogueShellSize(interactiveDialogueViewport), [interactiveDialogueViewport]);
  const interactiveDialogueAnchorPosition = useMemo(() => createInteractiveDialogueAnchorPosition(
    interactiveDialogueViewport,
    interactiveDialogueShellSize,
  ), [interactiveDialogueShellSize, interactiveDialogueViewport]);
  const interactiveDialoguePosition = useMemo(() => ({ x: interactiveDialogueAnchorPosition.x - activityCenter.x, y: interactiveDialogueAnchorPosition.y - activityCenter.y }), [activityCenter, interactiveDialogueAnchorPosition]);
  const interactiveDialogueVisualSize = useMemo(() => ({ width: interactiveDialogueShellSize, height: Math.round(interactiveDialogueShellSize * 1.04) }), [interactiveDialogueShellSize]);
  const interactiveDialogueStageFrame = useMemo(() => createInteractiveDialogueStageFrame(interactiveDialogueAnchorPosition, interactiveDialogueShellSize), [interactiveDialogueAnchorPosition, interactiveDialogueShellSize]);
  const interactiveDialogueChatPanelPosition = useMemo(() => createInteractiveDialogueChatPanelPosition(
    interactiveDialogueViewport,
    chatPanelSize,
  ), [chatPanelSize, interactiveDialogueViewport]);

  return {
    chatPanelBasePosition,
    interactiveDialogueAnchorPosition,
    interactiveDialogueChatPanelPosition,
    interactiveDialoguePosition,
    interactiveDialogueShellSize,
    interactiveDialogueStageFrame,
    interactiveDialogueVisualSize,
    interactiveDialogueViewport,
    petAnchorPosition,
    petVisualSize,
    shellViewport,
    visibleDisplayViewport,
  };
}

interface UseActivePetPanelPresentationOptions {
  activityCenter: Position;
  activeCompanionPanelRenderPosition: CompanionPanelRenderPosition;
  companionRenderSlots: PanelRenderSlot[];
  getScaledCompanionVisualBounds: (petId: string, scale: number) => VisualBounds;
  interactiveDialogueAnchorPosition: Position;
  interactiveDialogueVisualSize: PetVisualSize;
  isInteractiveDialogueActive: boolean;
  latestPetMessage: string;
  latestPetMessages: Record<string, string>;
  panelPetId: string;
  petAnchorPosition: Position;
  petVisualBounds: VisualBounds;
  petVisualSize: PetVisualSize;
  primaryPetScale: number;
  renderedPetPos: Position;
  selectedCustomMotionByPetId: SelectedMotionBindingMap;
  typingPetId: string | null;
}

export function useActivePetPanelPresentation({
  activityCenter,
  activeCompanionPanelRenderPosition,
  companionRenderSlots,
  getScaledCompanionVisualBounds,
  interactiveDialogueAnchorPosition,
  interactiveDialogueVisualSize,
  isInteractiveDialogueActive,
  latestPetMessage,
  latestPetMessages,
  panelPetId,
  petAnchorPosition,
  petVisualBounds,
  petVisualSize,
  primaryPetScale,
  renderedPetPos,
  selectedCustomMotionByPetId,
  typingPetId,
}: UseActivePetPanelPresentationOptions) {
  const activePanelLatestPetMessage = useMemo(() => latestPetMessages[panelPetId] ?? latestPetMessage, [latestPetMessage, latestPetMessages, panelPetId]);
  const activePanelPetSlot = useMemo(() => resolveActivePanelPetSlot(
    panelPetId,
    renderedPetPos,
    primaryPetScale,
    companionRenderSlots,
    activeCompanionPanelRenderPosition,
  ), [activeCompanionPanelRenderPosition, companionRenderSlots, panelPetId, primaryPetScale, renderedPetPos]);
  const activePanelSelectedCustomMotionBindingId = selectedCustomMotionByPetId[panelPetId]?.id ?? null;
  const activePanelPetAnchorPosition = useMemo(() => {
    if (isInteractiveDialogueActive) {
      return interactiveDialogueAnchorPosition;
    }

    return activePanelPetSlot
      ? createAnchorPosition(activityCenter, activePanelPetSlot.position)
      : petAnchorPosition;
  }, [
    activityCenter,
    activePanelPetSlot,
    interactiveDialogueAnchorPosition,
    isInteractiveDialogueActive,
    petAnchorPosition,
  ]);
  const activePanelPetVisualSize = useMemo(() => resolveActivePanelPetVisualSize(
    activePanelPetSlot?.id ?? null,
    activePanelPetSlot?.scale ?? null,
    isInteractiveDialogueActive,
    petVisualSize,
    interactiveDialogueVisualSize,
    getScaledCompanionVisualBounds,
  ), [activePanelPetSlot, getScaledCompanionVisualBounds, interactiveDialogueVisualSize, isInteractiveDialogueActive, petVisualSize]);
  const activePanelPetVisualBounds = useMemo(() => resolveActivePanelPetVisualBounds(
    activePanelPetSlot?.id ?? null,
    activePanelPetSlot?.scale ?? null,
    isInteractiveDialogueActive,
    petVisualBounds,
    interactiveDialogueVisualSize,
    getScaledCompanionVisualBounds,
  ), [activePanelPetSlot, getScaledCompanionVisualBounds, interactiveDialogueVisualSize, isInteractiveDialogueActive, petVisualBounds]);
  const isActivePanelPetTyping = typingPetId === panelPetId;

  return {
    activePanelLatestPetMessage,
    activePanelPetAnchorPosition,
    activePanelPetVisualBounds,
    activePanelPetVisualSize,
    activePanelSelectedCustomMotionBindingId,
    isActivePanelPetTyping,
  };
}
