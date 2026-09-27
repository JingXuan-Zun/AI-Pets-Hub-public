import { type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { type DesktopPetChatController } from '../../chatState';
import { type PetConfig, type PetConfigUpdateHandler, type PetVisualSize } from '../../types';
import { useLocalTestMenuPauseProbe } from './useLocalTestMenuPauseProbe';
import { useLocalTestPrimaryDragCompanionProbe } from './useLocalTestPrimaryDragCompanionProbe';
import { useLocalTestPrimaryDragSnapBackProbe } from './useLocalTestPrimaryDragSnapBackProbe';
import { usePetContainerBoundaryRecoveryEffects } from './usePetContainerBoundaryRecoveryEffects';
import { usePetContainerCompanionCollisionSyncEffect } from './usePetContainerCompanionCollisionSyncEffect';
import { usePetContainerExternalSyncEffects } from './usePetContainerExternalSyncEffects';
import { usePetContainerShellEffects } from './usePetContainerShellEffects';
import { type DirectionalExtents } from './petActivityRegionMath';

type Position = { x: number; y: number };

interface UsePetContainerUiSyncEffectsOptions {
  activityRegionDragState: unknown;
  activityRegionResizeState: unknown;
  chatPanelDragState: unknown;
  chatPanelResizeState: unknown;
  companionDragState: unknown;
  companionStatsTickAtRef: MutableRefObject<number>;
  config: PetConfig;
  configRef: MutableRefObject<PetConfig>;
  dragState: unknown;
  isNativePetShapeMotionActive: boolean;
  nativeInteractiveRegionPostRenderSyncKey: string;
  isChatOpen: boolean;
  isExternalChatOpen: boolean;
  isSettingsOpen: boolean;
  nativeInteractiveRegionBaseRegionsRef: MutableRefObject<DesktopPetInteractiveRegionLike[]>;
  onChatControllerReady?: (controller: DesktopPetChatController | null) => void;
  onPetVisualSizeChange?: (size: PetVisualSize) => void;
  onUpdateConfig: PetConfigUpdateHandler;
  openPetActionsForPet: (petId: string) => void;
  petVisualSize: PetVisualSize;
  playMessageVoice: DesktopPetChatController['playMessageVoice'];
  resolveAgentApproval: DesktopPetChatController['resolveAgentApproval'];
  resolveGroupUserAttention: DesktopPetChatController['resolveGroupUserAttention'];
  pointerInteractionLockRef: MutableRefObject<boolean>;
  resolvePetPositionForLocalTest: (petId: string) => Position | null;
  selectPanelPet: (petId: string) => void;
  sendMessage: DesktopPetChatController['sendMessage'];
  setActivePetId: DesktopPetChatController['setActivePetId'];
  setChatMode: DesktopPetChatController['setChatMode'];
  setInputValue: DesktopPetChatController['setInputValue'];
  setIsChatOpen: Dispatch<SetStateAction<boolean>>;
  stopAgentRun: DesktopPetChatController['stopAgentRun'];
  stopGroupChat: DesktopPetChatController['stopGroupChat'];
  stopPetSpeech: DesktopPetChatController['stopPetSpeech'];
  setGroupChatContinuationMode: DesktopPetChatController['setGroupChatContinuationMode'];
  toggleVoiceEnabled: DesktopPetChatController['toggleVoiceEnabled'];
  toggleVoiceInput: DesktopPetChatController['toggleVoiceInput'];
  useFullWindowNativeShapeForPetDrag?: boolean;
  useExternalChatWindow: boolean;
  useExternalSettingsWindow: boolean;
}

interface UsePetContainerRecoveryEffectsOptions {
  activityArea: { width: number; height: number };
  clampPrimaryPetToAllowedAreaWithMetrics: (
    position: Position,
    petScale: number,
    visualBounds: DirectionalExtents,
  ) => Position;
  clampPetToRenderedActivityAreaWithMetrics: (
    position: Position,
    petScale: number,
    visualBounds: DirectionalExtents,
  ) => Position;
  clearRecovered3DVisibilitySignature: (petId: string) => void;
  companionDragState: unknown;
  companionVisualBoundsById: Record<string, DirectionalExtents>;
  config: PetConfig;
  configRef: MutableRefObject<PetConfig>;
  dragState: unknown;
  getScaledCompanionCollisionBounds: (
    petId: string,
    currentScale: number,
    nextScale?: number,
  ) => DirectionalExtents;
  getScaledCompanionVisualBounds: (
    petId: string,
    currentScale: number,
    nextScale?: number,
  ) => DirectionalExtents;
  isAutoMoving: boolean;
  onUpdateConfig: PetConfigUpdateHandler;
  panelPetId: string;
  pendingPetConfigSyncRef: MutableRefObject<boolean>;
  petCollisionBounds: DirectionalExtents;
  petPos: Position;
  petPosRef: MutableRefObject<Position>;
  petVisualBounds: DirectionalExtents;
  previousCompanionVisualBoundsByIdRef: MutableRefObject<Record<string, DirectionalExtents>>;
  previousPetVisualBoundsRef: MutableRefObject<DirectionalExtents>;
  recover3DPositionIntoVisibleViewport: (
    petId: string,
    petName: string,
    modelType: PetConfig['modelType'],
    modelUrl: string,
    position: Position,
    petScale: number,
    visualBounds: DirectionalExtents,
  ) => Position;
  resolvePetPositionAgainstEntries: (
    candidatePosition: Position,
    petScale: number,
    clampBounds: DirectionalExtents,
    collisionBounds: DirectionalExtents,
    otherEntries: Array<{ id: string; position: Position; bounds: DirectionalExtents }>,
  ) => Position;
  setPetPos: (position: Position) => void;
  showPetActions: boolean;
}

export function usePetContainerUiSyncEffects({
  activityRegionDragState,
  activityRegionResizeState,
  chatPanelDragState,
  chatPanelResizeState,
  companionDragState,
  companionStatsTickAtRef,
  config,
  configRef,
  dragState,
  isNativePetShapeMotionActive,
  nativeInteractiveRegionPostRenderSyncKey,
  isChatOpen,
  isExternalChatOpen,
  isSettingsOpen,
  nativeInteractiveRegionBaseRegionsRef,
  onChatControllerReady,
  onPetVisualSizeChange,
  onUpdateConfig,
  openPetActionsForPet,
  petVisualSize,
  playMessageVoice,
  resolveAgentApproval,
  resolveGroupUserAttention,
  pointerInteractionLockRef,
  resolvePetPositionForLocalTest,
  selectPanelPet,
  sendMessage,
  setActivePetId,
  setChatMode,
  setInputValue,
  setIsChatOpen,
  stopAgentRun,
  stopGroupChat,
  stopPetSpeech,
  setGroupChatContinuationMode,
  toggleVoiceEnabled,
  toggleVoiceInput,
  useFullWindowNativeShapeForPetDrag = false,
  useExternalChatWindow,
  useExternalSettingsWindow,
}: UsePetContainerUiSyncEffectsOptions) {
  useLocalTestMenuPauseProbe({ openPetActionsForPet, resolvePetPositionForLocalTest, selectPanelPet });
  useLocalTestPrimaryDragCompanionProbe({ resolvePetPositionForLocalTest });
  useLocalTestPrimaryDragSnapBackProbe({ resolvePetPositionForLocalTest });
  usePetContainerShellEffects({
    activityRegionDragState, activityRegionResizeState, chatPanelDragState, chatPanelResizeState, companionDragState, dragState,
    isChatOpen, isExternalChatOpen, isPetMotionActive: isNativePetShapeMotionActive, isSettingsOpen, nativeInteractiveRegionBaseRegionsRef, nativeInteractiveRegionPostRenderSyncKey, pointerInteractionLockRef, setIsChatOpen,
    useFullWindowNativeShapeForPetDrag,
    useNativeInteractiveRegions: true,
    useExternalChatWindow, useExternalSettingsWindow,
  });
  usePetContainerExternalSyncEffects({
    companionStatsTickAtRef, config, configRef, onChatControllerReady, onPetVisualSizeChange, onUpdateConfig,
    petVisualSize, playMessageVoice, resolveAgentApproval, resolveGroupUserAttention, sendMessage, setActivePetId, setChatMode, setInputValue,
    stopAgentRun, stopGroupChat, stopPetSpeech, setGroupChatContinuationMode, toggleVoiceEnabled,
    toggleVoiceInput,
  });
}

export function usePetContainerRecoveryEffects({
  activityArea,
  clampPrimaryPetToAllowedAreaWithMetrics,
  clampPetToRenderedActivityAreaWithMetrics,
  clearRecovered3DVisibilitySignature,
  companionDragState,
  companionVisualBoundsById,
  config,
  configRef,
  dragState,
  getScaledCompanionCollisionBounds,
  getScaledCompanionVisualBounds,
  isAutoMoving,
  onUpdateConfig,
  panelPetId,
  pendingPetConfigSyncRef,
  petCollisionBounds,
  petPos,
  petPosRef,
  petVisualBounds,
  previousCompanionVisualBoundsByIdRef,
  previousPetVisualBoundsRef,
  recover3DPositionIntoVisibleViewport,
  resolvePetPositionAgainstEntries,
  setPetPos,
  showPetActions,
}: UsePetContainerRecoveryEffectsOptions) {
  usePetContainerBoundaryRecoveryEffects({
    activityArea, clampPrimaryPetToAllowedAreaWithMetrics, clampPetToRenderedActivityAreaWithMetrics, clearRecovered3DVisibilitySignature,
    companionDragState, companionVisualBoundsById, config, configRef, dragState, getScaledCompanionVisualBounds,
    isAutoMoving, onUpdateConfig, panelPetId, pendingPetConfigSyncRef, petPos, petPosRef, petVisualBounds,
    previousCompanionVisualBoundsByIdRef, previousPetVisualBoundsRef, recover3DPositionIntoVisibleViewport,
    setPetPos, showPetActions,
  });
  usePetContainerCompanionCollisionSyncEffect({
    config, configRef, getScaledCompanionCollisionBounds, getScaledCompanionVisualBounds, onUpdateConfig,
    petCollisionBounds, petPos, petPosRef, resolvePetPositionAgainstEntries,
  });
}
