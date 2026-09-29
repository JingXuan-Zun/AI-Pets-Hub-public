import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { type DesktopPetChatController } from '../chatState';
import { PetAction, PetConfig, type PetConfigUpdateHandler, type PetVisualSize } from '../types';
import { PRIMARY_DESKTOP_PET_SLOT_ID, getDesktopPetSlot } from '../multiPetRoster';
import { useDesktopOrganizationShowcase } from './pet/useDesktopOrganizationShowcase';
import { usePetContainer3DVisibilityRecovery } from './pet/usePetContainer3DVisibilityRecovery';
import { usePetContainerCharacterRuntimeBridge } from './pet/usePetContainerCharacterRuntimeBridge';
import {
  usePetContainerFolderVisualMetrics,
} from './pet/usePetContainerEnvironmentState';
import { PetContainerScene } from './pet/PetContainerScene';
import {
  createCompanionRuntimeLayerItems,
  createPetPanelsLayerProps,
  createPrimaryPetAvatarLayerProps,
} from './pet/petContainerRenderProps';
import {
  createPetContainerSceneProps,
  createPetEnvironmentLayerProps,
  createPetInteractiveDialogueOverlayProps,
} from './pet/petContainerSceneSurface';
import { usePetContainerRenderCollections } from './pet/usePetContainerRenderCollections';
import { usePetContainerPresentationAssemblies } from './pet/usePetContainerPresentationAssemblies';
import {
  usePetContainerRecoveryEffects,
  usePetContainerUiSyncEffects,
} from './pet/usePetContainerOrchestratedEffects';
import { usePetContainerCompanionRuntimeState } from './pet/usePetContainerCompanionRuntimeState';
import { usePetContainerActivityRuntimeState } from './pet/usePetContainerActivityRuntimeState';
import { usePetContainerMovementScaleRuntimeState } from './pet/usePetContainerMovementScaleRuntimeState';
import { usePetContainerPrimaryRuntimeState } from './pet/usePetContainerPrimaryRuntimeState';
import { usePetContainerPanelChatState } from './pet/usePetContainerPanelChatState';
import { usePetContainerSelectionChatDerivedState } from './pet/usePetContainerSelectionChatDerivedState';
import { usePetContainerVisualSceneState } from './pet/usePetContainerVisualSceneState';
import { useDesktopIconTargets } from './pet/useDesktopIconTargets';
import { useDesktopMouseTarget } from './pet/useDesktopMouseTarget';
import {
  MIN_PET_SCALE,
  resolveTopRightPanelPosition,
} from './pet/petContainerMath';
import {
  PET_HUNGER_AUTO_EAT_STOP_THRESHOLD,
  PET_HUNGER_TRIGGER_THRESHOLD,
} from './pet/petStatsMath';
import { type PetDragVisualPreviewSurface } from '../pet-runtime/interactions/petDragVisualPreview';
import { usePetContainerGameCompanionLoopState } from './pet/usePetContainerGameCompanionLoopState';
import { usePetContainerNativeDragInterop } from './pet/usePetContainerNativeDragInterop';
import { usePetContainerNativeShapeSyncState } from './pet/usePetContainerNativeShapeSyncState';
import {
  usePetContainerAgentCommandBridge,
  usePetContainerAgentDesktopOrganizationBridge,
  usePetContainerAgentVoiceInputBridge,
} from './pet/usePetContainerAgentCommandBridge';
import { usePetContainerPanelActionHandlers } from './pet/usePetContainerPanelActionHandlers';

interface PetContainerProps {
  config: PetConfig;
  isSettingsOpen: boolean;
  isExternalChatOpen?: boolean;
  settingsResetToken: number;
  useExternalSettingsWindow?: boolean;
  useExternalChatWindow?: boolean;
  onRequestSettingsWindow?: () => void;
  onRequestSharedStateSync?: (preferredDelayMs?: number) => void;
  onRequestChatWindow?: () => void;
  onRequestCloseChatWindow?: () => void;
  onSetSettingsOpen: (isOpen: boolean) => void;
  onUpdateConfig: PetConfigUpdateHandler;
  addLog: (msg: string) => void;
  screenStream: MediaStream | null;
  screenCaptureOptions?: DesktopPetCaptureOptionsLike | null;
  onPreviewCaptureOptionsChange?: (options?: DesktopPetCaptureOptionsLike | null) => void;
  logs: string[];
  onStartScreenCapture: (options?: DesktopPetCaptureOptionsLike) => Promise<void> | void;
  onStopScreenCapture: () => Promise<void> | void;
  onResetFolders: () => void;
  onSetAction: (action: PetAction) => void;
  actionOverride?: PetAction | null;
  pauseAutoMovement?: boolean;
  onChatControllerReady?: (controller: DesktopPetChatController | null) => void;
  onInteractiveDialogueActiveChange?: (isActive: boolean) => void;
  onPetVisualSizeChange?: (size: PetVisualSize) => void;
}

const PET_HALF_SIZE = 128;
const SATIATED_THRESHOLD = 45;
const PET_SCALE_STEP = 0.05;
const MIN_CHAT_PANEL_WIDTH = 280;
const MIN_CHAT_PANEL_HEIGHT = 240;
const DEFAULT_CHAT_PANEL_OFFSET = { x: 0, y: 0 };
const DEFAULT_CHAT_PANEL_SIZE = { width: 320, height: 416 };
const CHAT_PANEL_MAX_WIDTH = 8192;
const CHAT_PANEL_MAX_HEIGHT_SCALE = 3;
const MAX_CHAT_PANEL_WIDTH = CHAT_PANEL_MAX_WIDTH;
const MAX_CHAT_PANEL_HEIGHT = DEFAULT_CHAT_PANEL_SIZE.height * CHAT_PANEL_MAX_HEIGHT_SCALE;
const DEFAULT_INTERACTIVE_CHAT_PANEL_OFFSET = { x: 0, y: 0 };
const DEFAULT_INTERACTIVE_CHAT_PANEL_SIZE = { width: 960, height: 300 };
const COMPANION_EATING_DURATION_MS = 1600;
const DEFAULT_PET_VISUAL_BOUNDS = { left: 72, right: 72, top: 140, bottom: 52 };

export default function PetContainer({
  config,
  isSettingsOpen,
  isExternalChatOpen = false,
  settingsResetToken,
  useExternalSettingsWindow = false,
  useExternalChatWindow = false,
  onRequestSettingsWindow,
  onRequestSharedStateSync,
  onRequestChatWindow,
  onRequestCloseChatWindow,
  onSetSettingsOpen,
  onUpdateConfig,
  addLog,
  screenStream,
  screenCaptureOptions = null,
  onPreviewCaptureOptionsChange,
  logs,
  onStartScreenCapture,
  onStopScreenCapture,
  onResetFolders,
  onSetAction,
  actionOverride = null,
  pauseAutoMovement = false,
  onChatControllerReady,
  onInteractiveDialogueActiveChange,
  onPetVisualSizeChange,
}: PetContainerProps) {
  const [petPos, setPetPos] = useState(config.position);
  const [isPrimaryMovementInteractionPaused, setIsPrimaryMovementInteractionPaused] = useState(false);
  const sceneRef = useRef<HTMLDivElement>(null);
  const activityCenterRef = useRef({ x: 0, y: 0 });
  const companionRenderedPositionByIdRef = useRef<Record<string, { x: number; y: number }>>({});
  const configRef = useRef(config);
  const petPosRef = useRef(config.position);
  const chatPanelBasePositionResolverRef = useRef((size: { width: number; height: number }) => (
    resolveTopRightPanelPosition({
      x: 0,
      y: 0,
      width: typeof window === 'undefined' ? size.width + 48 : window.innerWidth,
      height: typeof window === 'undefined' ? size.height + 48 : window.innerHeight,
    }, size)
  ));
  const companionStatsTickAtRef = useRef(Date.now());
  const pendingPetConfigSyncRef = useRef(false);
  const pointerInteractionLockRef = useRef(false);
  const primaryPetDragVisualPreviewSurfaceRef = useRef<PetDragVisualPreviewSurface | null>(null);
  const {
    gameCompanionLoopControllerRef,
    gameCompanionLoopStatus,
    gameCompanionSourcePreference,
    handleGameCompanionSourcePreferenceChange,
    handleRestartGameCompanionLoopWithScreenSource,
    handleRestartGameCompanionLoopWithSourcePreference,
    handleStopGameCompanionLoop,
    handleToggleGameCompanionLoop,
  } = usePetContainerGameCompanionLoopState({
    addLog,
    configRef,
  });
  const agentCommandBridge = usePetContainerAgentCommandBridge({
    configRef,
    gameCompanionLoopControllerRef,
    onUpdateConfig,
  });
  const {
    folderBoundaryExtents,
    folderHalfHeight,
    folderHalfWidth,
    folderRenderOffset,
    handleFolderVisualMetricsChange,
    companionVisualBoundsById,
    getScaledCompanionCollisionBounds,
    getScaledCompanionVisualBounds,
    handleCompanionVisualBoundsChange,
    handlePetVisualBoundsChange,
    petCollisionBounds,
    petVisualBounds,
    previousCompanionVisualBoundsByIdRef,
    previousPetVisualBoundsRef,
  } = usePetContainerVisualSceneState({
    config,
    configRef,
    defaultPetVisualBounds: DEFAULT_PET_VISUAL_BOUNDS,
  });
  const {
    nativeInteractiveRegionBaseRegionsRef,
    setCompanionRenderSlotsForNativeDrag,
    setPetDragNativeShapeActive,
    syncActivityRegionNativeShapePreview,
    syncNativeDragInteractiveRegions,
    syncPrimaryNativeDragInteractiveRegions,
  } = usePetContainerNativeDragInterop({
    activityCenterRef,
    companionRenderedPositionByIdRef,
    companionVisualBoundsById,
    configRef,
    folderBoundaryExtents,
    folderHalfHeight,
    folderHalfWidth,
    getScaledCompanionVisualBounds,
    petPosRef,
    petVisualBounds,
  });

  const {
    activePetId: chatActivePetId,
    animationToolTriggersByPetId,
    chatMode,
    chatPanelDragState,
    chatPanelOffset,
    chatPanelResizeState,
    chatPanelSize,
    closeAllPetPanels,
    groupChatContinuationMode,
    groupUserAttention,
    inputValue,
    isAgentSelectorOpen,
    isChatSelectorOpen,
    isChatOpen,
    isGroupChatRunning,
    isInteractiveDialogueOpen,
    isListening,
    isPetActionSelectorOpen,
    isSpeaking,
    isTyping,
    lastReplayableAnimationToolTriggersByPetId,
    latestPetMessage,
    latestPetMessages,
    localSettingsResetToken,
    messages,
    openChatPanel,
    openInteractiveDialogue,
    openPetActions,
    openSettingsPanel,
    playMessageVoice,
    resolveAgentApproval,
    resolveGroupUserAttention,
    sendMessage,
    setActivePetId,
    setChatMode,
    setInputValue,
    setIsChatOpen,
    settingsInitialTab,
    showPetActions,
    speakingPetId,
    startChatPanelDrag,
    startChatPanelResize,
    stopAgentRun,
    stopGroupChat,
    stopPetSpeech,
    setGroupChatContinuationMode,
    toggleAgentSelector,
    toggleChatSelector,
    togglePetActionSelector,
    toggleVoiceEnabled,
    toggleVoiceInput,
    voiceInputController,
    typingPetId,
    webSearchStatusMessage,
  } = usePetContainerPanelChatState({
    addLog,
    config,
    defaultChatPanelOffset: DEFAULT_CHAT_PANEL_OFFSET,
    defaultChatPanelSize: DEFAULT_CHAT_PANEL_SIZE,
    interactiveDefaultChatPanelOffset: DEFAULT_INTERACTIVE_CHAT_PANEL_OFFSET,
    interactiveDefaultChatPanelSize: DEFAULT_INTERACTIVE_CHAT_PANEL_SIZE,
    maxChatPanelHeight: MAX_CHAT_PANEL_HEIGHT,
    maxChatPanelWidth: MAX_CHAT_PANEL_WIDTH,
    minChatPanelHeight: MIN_CHAT_PANEL_HEIGHT,
    minChatPanelWidth: MIN_CHAT_PANEL_WIDTH,
    panelBasePositionResolverRef: chatPanelBasePositionResolverRef,
    onRequestChatWindow,
    onRequestCloseChatWindow,
    onRequestSharedStateSync,
    onRequestSettingsWindow,
    onAgentChatCommand: agentCommandBridge.handleAgentChatCommand,
    onSetSettingsOpen,
    onUpdateConfig,
    useExternalChatWindow,
    useExternalSettingsWindow,
  });
  const {
    activeCompanionPanelRenderPosition,
    effectiveAutoMovementPause,
    handleCompanionRenderedPositionChange,
    isInteractiveDialogueActive,
    isPrimarySpeaking,
    isPrimaryTyping,
    isSelectedPetMenuMovementLocked,
    panelPetId,
    primaryLatestPetMessage,
    selectPanelPet,
    selectedCustomMotionByPetId,
    setSelectedCustomMotionByPetId,
  } = usePetContainerSelectionChatDerivedState({
    chatActivePetId,
    chatMode,
    companionRenderedPositionByIdRef,
    config,
    configRef,
    isChatOpen,
    isInteractiveDialogueOpen,
    isSpeaking,
    isSettingsOpen,
    isTyping,
    latestPetMessage,
    latestPetMessages,
    pauseAutoMovement,
    setActivePetId,
    showPetActions,
    speakingPetId,
    typingPetId,
  });
  const {
    activityArea,
    activityAreaScale,
    activityCenter,
    activityRegionDragState,
    activityRegionResizeState,
    activityViewport,
    availableDisplays,
    clampPrimaryPetToAllowedAreaWithMetrics,
    clampPositionToRenderedActivityArea,
    clampPetToRenderedActivityAreaWithMetrics,
    clampToScene,
    getPetEatReachThresholdForScale,
    getScenePositionFromViewportPoint,
    handleCreateFood,
    petEatReachThreshold,
    sceneSize,
    startActivityRegionDrag,
    startActivityRegionResize,
  } = usePetContainerActivityRuntimeState({
    addLog,
    config,
    configRef,
    folderHalfHeight,
    folderHalfWidth,
    folderBoundaryExtents,
    onActivityRegionNativeShapePreview: syncActivityRegionNativeShapePreview,
    onUpdateConfig,
    pendingPetConfigSyncRef,
    petPosRef,
    petVisualBounds,
    pointerInteractionLockRef,
    sceneRef,
    setPetPos,
  });
  activityCenterRef.current = activityCenter;
  const {
    clampCompanionDragPosition,
    clampCompanionPosition,
    clampPrimaryPetPosition,
    getPetCollisionEntries,
    resolvePetPositionAgainstEntries,
    createCompanionRoamTarget,
    createPrimaryPetRoamTarget,
    mainPetMaxScale,
    manualCompanionEatingUntilByPetIdRef,
    resolveCompanionMaxScale,
    resolveScaledCompanionPosition,
    resolveScaledPrimaryPetPosition,
    triggerPetEatScaleBoost,
  } = usePetContainerMovementScaleRuntimeState({
    activityArea,
    clampPrimaryPetToAllowedAreaWithMetrics,
    clampPetToRenderedActivityAreaWithMetrics,
    config,
    configRef,
    getScaledCompanionCollisionBounds,
    getScaledCompanionVisualBounds,
    onUpdateConfig,
    petCollisionBounds,
    petPosRef,
    petVisualBounds,
    setPetPos,
  });
  const desktopIconTargets = useDesktopIconTargets({
    activityCenter,
    availableDisplays,
    config,
  });
  const desktopMouseTarget = useDesktopMouseTarget({
    activityCenter,
    availableDisplays,
    config,
  });
  const {
    dragState,
    folderDragPreview,
    handlePetWheelScale,
    isPetDragActive,
    isAutoMoving,
    motionTarget,
    reactionState: primaryReactionState,
    startFolderDrag,
    updateStat,
    visionTarget,
    handleCompanionPetContextMenu,
    handleOpenControlsPanel,
    handleOpenGroupChatPanel,
    handleOpenInteractiveDialoguePanel,
    handleOpenSettingsHomePanel,
    handleOpenSingleChatPanel,
    handlePetContextMenu,
    handleSelectActivePetAction,
    handleSelectActivePetCustomMotion,
    handleStartPrimaryPetDrag,
    openPetActionsForPet,
  } = usePetContainerPrimaryRuntimeState({
    actionOverride,
    addLog,
    clampPrimaryPetPosition,
    clampToScene,
    config,
    configRef,
    createPrimaryPetRoamTarget,
    desktopIconTargets,
    desktopMouseTarget,
    effectiveAutoMovementPause,
    getScenePositionFromViewportPoint,
    hungerAutoEatStopThreshold: PET_HUNGER_AUTO_EAT_STOP_THRESHOLD,
    hungerTriggerThreshold: PET_HUNGER_TRIGGER_THRESHOLD,
    isInteractionMovementPaused: isPrimaryMovementInteractionPaused,
    isPrimaryPetMenuMovementLocked: isSelectedPetMenuMovementLocked(PRIMARY_DESKTOP_PET_SLOT_ID),
    isPrimaryTyping,
    latestMessage: primaryLatestPetMessage,
    mainPetMaxScale,
    minPetScale: MIN_PET_SCALE,
    onFoodConsumed: () => triggerPetEatScaleBoost(PRIMARY_DESKTOP_PET_SLOT_ID),
    onSetAction,
    onUpdateConfig,
    onPetDragNativeRegionPreview: syncPrimaryNativeDragInteractiveRegions,
    onPetDragNativeShapeActiveChange: setPetDragNativeShapeActive,
    onPetDragVisualPreview: (preview) => {
      primaryPetDragVisualPreviewSurfaceRef.current?.previewPosition(
        preview.position,
        preview.previousPosition,
      );
    },
    openChatPanel,
    openInteractiveDialogue,
    openPetActions,
    openSettingsPanel,
    panelPetId,
    pendingPetConfigSyncRef,
    petPos,
    petPosRef,
    petEatReachThreshold,
    petScaleStep: PET_SCALE_STEP,
    pointerInteractionLockRef,
    resolveScaledPetPosition: resolveScaledPrimaryPetPosition,
    satiatedThreshold: SATIATED_THRESHOLD,
    selectPanelPet,
    setChatMode,
    setPetPos,
    setSelectedCustomMotionByPetId,
    fallbackPetName: config.personality.name,
  });

  const {
    active3DSceneCount,
    companionDragDelta,
    companionDragState,
    companionRenderSlots,
    draggingCompanionPetId,
    draggingCompanionPetIdRef,
    handleCompanionWheelScale,
    handleStartCompanionPetDrag,
    isCompanionDragActive,
    sequenceFrameDurationMultiplier,
  } = usePetContainerCompanionRuntimeState({
    addLog,
    clampCompanionDragPosition,
    clampCompanionPosition,
    clampPetToRenderedActivityAreaWithMetrics,
    companionEatingDurationMs: COMPANION_EATING_DURATION_MS,
    companionRenderedPositionByIdRef,
    config,
    configRef,
    getPetEatReachThresholdForScale,
    getScenePositionFromViewportPoint,
    getScaledCompanionVisualBounds,
    manualEatingUntilByPetIdRef: manualCompanionEatingUntilByPetIdRef,
    minPetScale: MIN_PET_SCALE,
    onCompanionEatScaleBoost: triggerPetEatScaleBoost,
    onCompanionDragNativeRegionPreview: syncNativeDragInteractiveRegions,
    onCompanionDragNativeShapeActiveChange: setPetDragNativeShapeActive,
    onUpdateConfig,
    petScaleStep: PET_SCALE_STEP,
    pointerInteractionLockRef,
    resolveCompanionMaxScale,
    resolveScaledCompanionPosition,
    selectPanelPet,
  });
  const handleStartOverlappedPetDrag = useCallback((
    event: Parameters<typeof handleStartPrimaryPetDrag>[0],
    petId: string,
  ) => {
    if (petId === PRIMARY_DESKTOP_PET_SLOT_ID) {
      handleStartPrimaryPetDrag(event);
      return;
    }

    const targetSlot = getDesktopPetSlot(configRef.current, petId);
    if (!targetSlot || targetSlot.isPrimary) {
      selectPanelPet(petId);
      return;
    }

    handleStartCompanionPetDrag(
      event,
      petId,
      companionRenderedPositionByIdRef.current[petId] ?? targetSlot.position,
    );
  }, [
    handleStartCompanionPetDrag,
    handleStartPrimaryPetDrag,
    selectPanelPet,
  ]);
  const {
    isNativePetShapeMotionActive,
    nativeInteractiveRegionPostRenderSyncKey,
    nativeShapeCompanionDragState,
    nativeShapeDragState,
    useFullWindowNativeShapeForPetDrag,
  } = usePetContainerNativeShapeSyncState({
    actionOverride,
    activityArea,
    activityCenter,
    activityRegionDragState,
    activityRegionResizeState,
    companionDragState,
    companionRenderSlots,
    companionVisualBoundsById,
    config,
    dragState,
    expressionAction: primaryReactionState.expressionAction,
    getScaledCompanionVisualBounds,
    isAutoMoving,
    isCompanionDragActive,
    isPetDragActive,
    petPos,
    petVisualBounds,
    selectedCustomMotionByPetId,
    setCompanionRenderSlotsForNativeDrag,
  });
  const {
    activePanelLatestPetMessage,
    activePanelPetAnchorPosition,
    activePanelPetVisualBounds,
    activePanelPetVisualSize,
    activePanelSelectedCustomMotionBindingId,
    chatPanelBasePosition,
    interactiveDialogueChatPanelPosition,
    interactiveDialoguePosition,
    interactiveDialogueShellSize,
    interactiveDialogueStageFrame,
    interactiveDialogueVisualSize,
    isActivePanelPetTyping,
    petAnchorPosition,
    petVisualSize,
    petOptions,
    shellViewport,
    typingPetName,
    visibleDisplayViewport,
  } = usePetContainerPresentationAssemblies({
    activityCenter,
    activityArea,
    activityDisplayId: config.settings.activityDisplayId,
    activityViewport,
    activeCompanionPanelRenderPosition,
    availableDisplays,
    chatPanelSize,
    companionRenderSlots,
    config,
    getScaledCompanionVisualBounds,
    interactiveDialogueDisplayId: config.settings.interactiveDialogueDisplayId,
    isInteractiveDialogueActive,
    latestPetMessage,
    latestPetMessages,
    panelPetId,
    petPos,
    petVisualBounds,
    sceneSize,
    selectedCustomMotionByPetId,
    typingPetId,
  });
  chatPanelBasePositionResolverRef.current = (size) => resolveTopRightPanelPosition(shellViewport, size);
  const desktopOrganizationShowcase = useDesktopOrganizationShowcase({
    addLog,
    onSetAction,
    shellViewport,
  });
  usePetContainerAgentDesktopOrganizationBridge({
    desktopOrganizationRef: agentCommandBridge.desktopOrganizationRef,
    preview: desktopOrganizationShowcase.preview,
    start: desktopOrganizationShowcase.start,
    startDesktopIconPlacementRef: agentCommandBridge.startDesktopIconPlacementRef,
    startRelativePlacement: desktopOrganizationShowcase.startRelativePlacement,
  });
  usePetContainerAgentVoiceInputBridge({
    startVoiceInputSession: voiceInputController.startVoiceInputSession,
    stopVoiceInput: voiceInputController.stopVoiceInput,
    voiceInputControllerRef: agentCommandBridge.voiceInputControllerRef,
  });

  useEffect(() => {
    onInteractiveDialogueActiveChange?.(isInteractiveDialogueActive);
    return () => {
      onInteractiveDialogueActiveChange?.(false);
    };
  }, [isInteractiveDialogueActive, onInteractiveDialogueActiveChange]);
  const {
    clearRecovered3DVisibilitySignature,
    recover3DPositionIntoVisibleViewport,
  } = usePetContainer3DVisibilityRecovery({
    activityCenter,
    activityDisplayId: config.settings.activityDisplayId,
    clampPrimaryPetToAllowedAreaWithMetrics,
    clampPetToRenderedActivityAreaWithMetrics,
    visibleDisplayViewport,
  });
  const {
    folderRenderItems,
    resolvePetPositionForLocalTest,
  } = usePetContainerRenderCollections({
    clampPositionToRenderedActivityArea,
    companionRenderedPositionByIdRef,
    configFolders: config.folders,
    configRef,
    folderDragPreview,
    petPosRef,
  });
  usePetContainerUiSyncEffects({
    activityRegionDragState,
    activityRegionResizeState,
    chatPanelDragState,
    chatPanelResizeState,
    companionDragState: nativeShapeCompanionDragState,
    companionStatsTickAtRef,
    config,
    configRef,
    dragState: nativeShapeDragState,
    isNativePetShapeMotionActive,
    nativeInteractiveRegionBaseRegionsRef,
    nativeInteractiveRegionPostRenderSyncKey,
    isChatOpen,
    isExternalChatOpen,
    isSettingsOpen,
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
    setGroupChatContinuationMode,
    setInputValue,
    setIsChatOpen,
    stopAgentRun,
    stopGroupChat,
    stopPetSpeech,
    toggleVoiceEnabled,
    toggleVoiceInput,
    useFullWindowNativeShapeForPetDrag,
    useExternalChatWindow,
    useExternalSettingsWindow,
  });

  usePetContainerRecoveryEffects({
    activityArea,
    clampPrimaryPetToAllowedAreaWithMetrics,
    clampPetToRenderedActivityAreaWithMetrics,
    clearRecovered3DVisibilitySignature,
    companionDragState,
    companionVisualBoundsById,
    config,
    configRef,
    dragState: nativeShapeDragState,
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
  });
  const {
    handleAvatarRuntimeEvent,
    runtimeSummaryByPetId,
  } = usePetContainerCharacterRuntimeBridge({
    addLog,
    configRef,
    customModelPresets: config.customModelPresets,
    onCompanionVisualBoundsChange: handleCompanionVisualBoundsChange,
    onPrimaryVisualBoundsChange: handlePetVisualBoundsChange,
    onUpdateConfig,
  });

  const {
    handleOpenNormalAgent,
    handleSaveMessageToMemory,
  } = usePetContainerPanelActionHandlers({
    addLog,
    configRef,
    onUpdateConfig,
    openChatPanel,
    panelPetId,
    setInputValue,
  });

  const panelsLayerProps = createPetPanelsLayerProps({
    activePetId: panelPetId, activityViewport, chatMode, chatPanelBasePosition, chatPanelDragState,
    chatPanelOffset, chatPanelSize, closeAllPetPanels, config, groupChatContinuationMode, groupUserAttention, inputValue, interactiveDialogueChatPanelPosition, isAgentSelectorOpen, isChatSelectorOpen,
    gameCompanionLoopStatus, gameCompanionSourcePreference, isChatOpen, isGroupChatRunning, isInteractiveDialogueActive, isListening, isPetActionSelectorOpen,
    isSettingsOpen, isSpeaking, isTyping, isPrimaryTyping: isActivePanelPetTyping,
    latestPetMessage: activePanelLatestPetMessage, logs, messages, petOptions, runtimeSummaryByPetId, speakingPetId, typingPetName,
    webSearchStatusMessage,
    onActivePetChange: selectPanelPet, onChatModeChange: setChatMode, onInputChange: setInputValue,
    isDesktopOrganizationRunning: desktopOrganizationShowcase.isRunning,
    onOpenChatPanel: handleOpenSingleChatPanel, onOpenControlsPanel: handleOpenControlsPanel,
    onOpenGroupChatPanel: handleOpenGroupChatPanel, onOpenInteractiveDialogue: handleOpenInteractiveDialoguePanel,
    onToggleGameCompanionLoop: handleToggleGameCompanionLoop, onOpenNormalAgent: handleOpenNormalAgent,
    onOpenSettingsPanel: handleOpenSettingsHomePanel, onPlayMessageVoice: playMessageVoice,
    onPreviewCaptureOptionsChange, onResolveAgentApproval: resolveAgentApproval, onResolveGroupUserAttention: resolveGroupUserAttention, onSaveMessageToMemory: handleSaveMessageToMemory, onResetFolders, onSelectPetAction: handleSelectActivePetAction,
    onSelectPetCustomMotion: handleSelectActivePetCustomMotion, onSendMessage: sendMessage,
    onSetAction, onStartChatPanelDrag: startChatPanelDrag, onStartChatPanelResize: startChatPanelResize,
    onGroupChatContinuationModeChange: setGroupChatContinuationMode,
    onGameCompanionSourcePreferenceChange: handleGameCompanionSourcePreferenceChange,
    onRestartGameCompanionLoopWithScreenSource: handleRestartGameCompanionLoopWithScreenSource,
    onRestartGameCompanionLoopWithSourcePreference: handleRestartGameCompanionLoopWithSourcePreference,
    onStartScreenCapture, onStopAgentRun: stopAgentRun, onStopGameCompanionLoop: handleStopGameCompanionLoop, onStopGroupChat: stopGroupChat, onStopScreenCapture, onToggleActionSelector: togglePetActionSelector,
    onToggleAgentSelector: toggleAgentSelector,
    onToggleChatSelector: toggleChatSelector, onToggleVoiceEnabled: toggleVoiceEnabled,
    onToggleVoiceInput: toggleVoiceInput, onUpdateConfig, petAnchorPosition: activePanelPetAnchorPosition,
    petVisualBounds: activePanelPetVisualBounds, petVisualSize: activePanelPetVisualSize, screenCaptureOptions, screenStream, selectedCustomMotionBindingId: activePanelSelectedCustomMotionBindingId,
    settingsInitialSelectedPetSlotId: panelPetId, settingsInitialTab, settingsResetToken: settingsResetToken + localSettingsResetToken,
    shellViewport, showEmbeddedChatPanel: !useExternalChatWindow, showPetActions, useExternalSettingsWindow,
    voiceEnabled: config.settings.voiceEnabled, voiceInputEnabled: config.settings.voiceInputEnabled,
  });
  const companionRuntimeLayerItems = createCompanionRuntimeLayerItems({
    active3DSceneCount, activityArea, activityCenter, addLog, avatar3dRuntimeBackend: config.settings.avatar3dRuntimeBackend, clampCompanionPosition, companionDragDelta, companionRenderSlots,
    configRef, createCompanionRoamTarget, draggingCompanionPetId, draggingCompanionPetIdRef, getScaledCompanionCollisionBounds, getScaledCompanionVisualBounds, handleCompanionPetContextMenu,
    handleCompanionRenderedPositionChange, handleCompanionVisualBoundsChange, handleCompanionWheelScale, handleStartCompanionPetDrag,
    hungerAutoEatStopThreshold: PET_HUNGER_AUTO_EAT_STOP_THRESHOLD,
    hungerTriggerThreshold: PET_HUNGER_TRIGGER_THRESHOLD,
    interactiveDialoguePosition, interactiveDialogueShellSize, isInteractiveDialogueActive, isSpeaking, isTyping,
    isMovementPausedByPetId: (petId) => (
      effectiveAutoMovementPause
      || isSelectedPetMenuMovementLocked(petId)
      || !(
        getDesktopPetSlot(configRef.current, petId)?.autoMovementEnabled
        ?? true
      )
    ),
    animationToolTriggersByPetId, lastReplayableAnimationToolTriggersByPetId,
    latestPetMessages, manualCompanionEatingUntilByPetIdRef, onUpdateConfig, panelPetId,
    onRuntimeEvent: handleAvatarRuntimeEvent,
    onSelectPet: selectPanelPet,
    onStartOverlappedPetDrag: handleStartOverlappedPetDrag,
    satiatedThreshold: SATIATED_THRESHOLD,
    selectedCustomMotionByPetId, sequenceFrameDurationMultiplier, speakingPetId, triggerPetEatScaleBoost, typingPetId,
  });
  const primaryPetAvatarLayerProps = createPrimaryPetAvatarLayerProps({
    actionOverride, active3DSceneCount, activityCenter, config,
    debugClampBounds: petVisualBounds,
    debugCollisionBounds: petCollisionBounds,
    expressionAction: primaryReactionState.expressionAction,
    hungerTriggerThreshold: PET_HUNGER_TRIGGER_THRESHOLD,
    interactiveDialoguePosition, interactiveDialogueShellSize, isAutoMoving, isChatOpen,
    isDragging: isPetDragActive, isInteractiveDialogueActive, isSpeaking: isPrimarySpeaking,
    isSettingsOpen, isTyping: isPrimaryTyping,
    animationToolTrigger: animationToolTriggersByPetId[PRIMARY_DESKTOP_PET_SLOT_ID] ?? null,
    lastReplayableAnimationToolTrigger: lastReplayableAnimationToolTriggersByPetId[PRIMARY_DESKTOP_PET_SLOT_ID] ?? null,
    latestMessage: primaryLatestPetMessage,
    manualMotionBinding: selectedCustomMotionByPetId[PRIMARY_DESKTOP_PET_SLOT_ID] ?? null,
    motionOverrideMode: primaryReactionState.motionOverrideState.mode, motionTarget,
    dragVisualPreviewSurfaceRef: primaryPetDragVisualPreviewSurfaceRef,
    onMovementPauseChange: setIsPrimaryMovementInteractionPaused,
    onOpenChatPanel: handleOpenSingleChatPanel, onOpenSettingsPanel: handleOpenSettingsHomePanel,
    onPetContextMenu: handlePetContextMenu, onPetVisualBoundsChange: handlePetVisualBoundsChange,
    onRuntimeEvent: handleAvatarRuntimeEvent,
    onSelectPet: selectPanelPet,
    onStartOverlappedPetDrag: handleStartOverlappedPetDrag,
    onStartPetDrag: handleStartPrimaryPetDrag, onWheelPetScale: handlePetWheelScale, panelPetId,
    petPos, primaryPetId: PRIMARY_DESKTOP_PET_SLOT_ID, sequenceFrameDurationMultiplier,
    selectedPetId: panelPetId,
    showPetActions: false, visionTarget,
  });
  const environmentLayerProps = createPetEnvironmentLayerProps({
    activityArea,
    activityAreaScale,
    activityCenter,
    config,
    folderDragPreview,
    folders: folderRenderItems,
    isActivityRegionDragging: Boolean(activityRegionDragState),
    folderRenderOffset,
    onFolderVisualMetricsChange: handleFolderVisualMetricsChange,
    onStartActivityRegionDrag: startActivityRegionDrag,
    onStartActivityRegionResize: startActivityRegionResize,
    onCreateFood: handleCreateFood,
    onStartFolderDrag: startFolderDrag,
    onUpdateStat: updateStat,
  });
  const interactiveDialogueOverlayProps = createPetInteractiveDialogueOverlayProps({
    interactiveDialogueStageFrame,
    isVisible: isInteractiveDialogueActive,
  });
  const sceneProps = createPetContainerSceneProps({
    companionRuntimeLayerItems,
    desktopOrganizationOverlayProps: {
      onCancel: desktopOrganizationShowcase.cancel,
      onComplete: desktopOrganizationShowcase.complete,
      run: desktopOrganizationShowcase.run,
      shellViewport,
    },
    environmentLayerProps,
    interactiveDialogueOverlayProps,
    panelsLayerProps,
    primaryPetAvatarLayerProps,
    sceneRef,
  });

  return (
    <PetContainerScene {...sceneProps} />
  );
}


