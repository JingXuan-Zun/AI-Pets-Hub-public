import { Suspense, lazy, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { type ReactNode } from 'react';
import { SettingsTabErrorBoundary } from './settings/SettingsTabErrorBoundary';
import { type CSSProperties } from 'react';
import { buildShellBackdropStyle } from './chat/chatAppearanceUtils';
import { normalizePetConfig } from '../petConfigNormalization';
import {
  type PetAction,
  type PetConfig,
  type PetConfigUpdateHandler,
  type PetVisualSize,
  type ModelType,
} from '../types';
import { Button } from '../../components/ui/button';
import { WindowCompactHandle, WindowFrameControls } from './WindowFrameControls';
import { getRealWorldTimeSnapshot, isRealWorldTimeAwarenessEnabled } from '../timeAwareness';
import {
  PRIMARY_DESKTOP_PET_SLOT_ID,
  applyDesktopPetModelSelection,
  applyDesktopPetSlotChanges,
} from '../multiPetRoster';
import { type AvatarRuntimeEventSummaryByPetId } from '../pet-runtime/avatar-runtime/avatarRuntimeEventState';
import { useSettingsPanelActivityState } from './settings/useSettingsPanelActivityState';
import { useVisionSettings } from './settings/useVisionSettings';
import { type ViewportRect } from './settings/settingsPanelLayout';
import { useSettingsLocalVoiceState } from './settings/useSettingsLocalVoiceState';
import { useSettingsPanelModelAssetsState } from './settings/useSettingsPanelModelAssetsState';
import { StandaloneWindowResizeHandles } from './StandaloneWindowResizeHandles';
import {
  SettingsPanelActiveTabContent,
  type SettingsPanelTabValue,
} from './settings/SettingsPanelTabSections';
import { SettingsPanelStandaloneShell } from './settings/SettingsPanelStandaloneShell';
import { SettingsOverviewDashboard } from './settings/SettingsOverviewDashboard';
import { SettingsPlatformMcpTab, SettingsPlatformSkillApiTab } from './settings/SettingsPlatformCapabilityTabs';
import { SettingsComfyUiWorkflowTab } from './settings/SettingsComfyUiWorkflowTab';
import { SettingsExtensionHubTab } from './settings/SettingsExtensionHubTab';
import { SettingsAgentRuntimeSection } from './settings/SettingsAgentRuntimeSection';
import { SettingsGameCompanionTab } from './settings/SettingsGameCompanionTab';
import { SettingsDesktopActivityAwarenessTab } from './settings/SettingsDesktopActivityAwarenessTab';
import {
  DEFAULT_SETTINGS_CONTROL_CENTER_PAGE_ID,
  getSettingsControlCenterPage,
  type SettingsControlCenterPageId,
} from './settings/settingsControlCenterNavigation';
import { useSettingsPanelDraftState } from './settings/useSettingsPanelDraftState';
import { useSettingsPanelFrameState } from './settings/useSettingsPanelFrameState';
import { useStandaloneWindowResize } from '../standaloneWindowResize';
import { useStandaloneWindowDrag } from '../standaloneWindowDrag';
import { useStandaloneWindowFrame } from '../standaloneWindowFrame';
import { animateContentIn, animatePanelEnter } from '../uiMotionPresets';
import {
  discardExpressionCategoryDrafts,
  flushExpressionCategoryDrafts,
} from '../expression/expressionCategoryDraftStore';

const SettingsMotionExpressionTab = lazy(async () => {
  const module = await import('./settings/SettingsMotionExpressionTab');
  return { default: module.SettingsMotionExpressionTab };
});

const SettingsModelTab = lazy(async () => {
  const module = await import('./settings/SettingsModelTab');
  return { default: module.SettingsModelTab };
});

const SettingsPersonalityTab = lazy(async () => {
  const module = await import('./settings/SettingsPersonalityTab');
  return { default: module.SettingsPersonalityTab };
});

const SettingsVoiceTab = lazy(async () => {
  const module = await import('./settings/SettingsVoiceTab');
  return { default: module.SettingsVoiceTab };
});

const SettingsSystemTab = lazy(async () => {
  const module = await import('./settings/SettingsSystemTab');
  return { default: module.SettingsSystemTab };
});

const SettingsVisionTab = lazy(async () => {
  const module = await import('./settings/SettingsVisionTab');
  return { default: module.SettingsVisionTab };
});

const SettingsExpressionLibraryTab = lazy(async () => {
  const module = await import('./settings/SettingsExpressionLibraryTab');
  return { default: module.SettingsExpressionLibraryTab };
});

interface SettingsPanelProps {
  isOpen: boolean;
  resetToken: number;
  anchorRect?: ViewportRect;
  dockAnchorPosition?: { x: number; y: number } | null;
  dockReferenceSize?: PetVisualSize | null;
  initialSelectedPetSlotId?: string;
  initialTab?: SettingsPanelTabValue;
  standalone?: boolean;
  onClose: () => void;
  config: PetConfig;
  petVisualSize?: PetVisualSize | null;
  onUpdateConfig: PetConfigUpdateHandler;
  logs: string[];
  runtimeSummaryByPetId?: AvatarRuntimeEventSummaryByPetId;
  screenStream: MediaStream | null;
  screenCaptureActive?: boolean;
  screenCaptureOptions?: DesktopPetCaptureOptionsLike | null;
  onPreviewCaptureOptionsChange?: (options?: DesktopPetCaptureOptionsLike | null) => void;
  onStartScreenCapture: (options?: DesktopPetCaptureOptionsLike) => Promise<void> | void;
  onStopScreenCapture: () => Promise<void> | void;
  onResetFolders: () => void;
  onSetAction: (action: PetAction) => void;
}

function SettingsTabFallback() {
  return (
    <div className="flex min-h-[280px] items-center justify-center rounded-sm border border-dashed border-border/70 bg-secondary/10 text-2xs uppercase tracking-[0.22em] text-muted-foreground">
      正在加载面板...
    </div>
  );
}

function SettingsTabContentMotion({ children }: { children: ReactNode }) {
  const motionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (motionRef.current) {
      animateContentIn(motionRef.current, 0.06);
    }
  }, []);

  return <div ref={motionRef}>{children}</div>;
}

const EMBEDDED_SETTINGS_EDGE_HANDLE_CLASS = 'pointer-events-auto absolute z-popover touch-none bg-transparent';
const EMBEDDED_SETTINGS_CORNER_HANDLE_CLASS = 'pointer-events-auto absolute z-modal touch-none bg-transparent';
const EMBEDDED_SETTINGS_COMPACT_HEIGHT = 48;
const EMBEDDED_SETTINGS_COMPACT_WIDTH = 56;
const SETTINGS_FRAME_CONTROL_BUTTON_CLASS = [
  '!text-primary hover:!bg-primary/10 hover:!text-primary',
  'focus-visible:!ring-primary/40',
].join(' ');
const SETTINGS_FRAME_CONTROL_CLOSE_BUTTON_CLASS = 'hover:!bg-primary/10 hover:!text-primary';
const SETTINGS_COMPACT_HANDLE_CLASS = '!border-primary/35 !bg-white !text-primary focus-visible:!ring-primary/40';

type SettingsPanelFrameMode = 'normal' | 'minimized';

export default function SettingsPanel({
  isOpen,
  resetToken,
  anchorRect,
  dockAnchorPosition = null,
  dockReferenceSize = null,
  initialSelectedPetSlotId = PRIMARY_DESKTOP_PET_SLOT_ID,
  initialTab = 'personality',
  standalone = false,
  onClose,
  config,
  petVisualSize = null,
  onUpdateConfig,
  logs,
  runtimeSummaryByPetId = {},
  screenStream,
  screenCaptureActive,
  screenCaptureOptions = null,
  onPreviewCaptureOptionsChange,
  onStartScreenCapture,
  onStopScreenCapture,
  onResetFolders,
  onSetAction,
}: SettingsPanelProps) {
  const resolvedInitialTab = initialTab ?? 'personality';
  const [systemNow, setSystemNow] = useState(() => new Date());
  const [embeddedFrameMode, setEmbeddedFrameMode] = useState<SettingsPanelFrameMode>('normal');
  const [activeControlCenterPageId, setActiveControlCenterPageId] = useState<SettingsControlCenterPageId>(
    DEFAULT_SETTINGS_CONTROL_CENTER_PAGE_ID,
  );
  const panelRootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (panelRootRef.current) {
      animatePanelEnter(panelRootRef.current);
    }
  }, [isOpen]);
  const {
    activeTab,
    applyConfig,
    commitModelConfig,
    commitTraitsDraft,
    customApiDraft,
    customApiSaveFeedback,
    desktopPetSlots,
    handleCloseWithoutSaving,
    handleAddPetSlot,
    handleRemovePetSlot,
    handleSaveAndClose,
    handleSetCustomApiDraft,
    handleSetTraitsDraft,
    handleUpdatePersonality,
    isCustomApiDirty,
    isEditingTraits,
    localConfig,
    resolveCommittedConfigBase,
    replaceConfig,
    saveCustomApiSettings,
    selectedPetSlot,
    selectedPetSlotId,
    setActiveTab,
    setIsEditingTraits,
    setLocalConfig,
    setSelectedPetSlotId,
    traitsDraft,
  } = useSettingsPanelDraftState({
    config,
    initialSelectedPetSlotId,
    initialTab: resolvedInitialTab,
    isOpen,
    onClose,
    onUpdateConfig,
    resetToken,
  });
  const {
    isDockedPresentation,
    isDraggingPanel,
    isFrameInteracting,
    noDragRegionStyle,
    rootStyle,
    startPanelDrag,
    startPanelResize,
  } = useSettingsPanelFrameState({
    anchorRect,
    dockAnchorPosition,
    dockReferenceSize,
    isOpen,
    resetToken,
    standalone,
  });
  const standaloneWindowResize = useStandaloneWindowResize({
    enabled: standalone,
    minHeight: 600,
    minWidth: 1180,
  });
  const standaloneWindowFrame = useStandaloneWindowFrame({ enabled: standalone });
  const standaloneWindowDrag = useStandaloneWindowDrag({
    enabled: standalone,
    isMaximized: standaloneWindowFrame.isMaximized,
  });
  const isEmbeddedMinimized = !standalone && embeddedFrameMode === 'minimized';
  const shellBackdropStyle = useMemo(() => buildShellBackdropStyle(config), [config]);
  const resolvedRootStyle = standalone
    ? { ...rootStyle, ...shellBackdropStyle }
    : isEmbeddedMinimized
        ? ({
            ...rootStyle,
            height: EMBEDDED_SETTINGS_COMPACT_HEIGHT,
            width: EMBEDDED_SETTINGS_COMPACT_WIDTH,
          } as CSSProperties)
        : { ...rootStyle, ...shellBackdropStyle };
  const handleMinimizeFrame = () => {
    if (standalone) {
      standaloneWindowFrame.minimizeWindow();
      return;
    }

    setEmbeddedFrameMode((currentMode) => (currentMode === 'minimized' ? 'normal' : 'minimized'));
  };
  const {
    browserTtsHealth,
    browserTtsHealthLoading,
    browserTtsInstallFeedback,
    browserTtsInstallProgress,
    browserTtsInstallRunning,
    handleInstallBrowserTtsDependencies,
    handleInstallLocalVoiceDependencies,
    handleStartBrowserTtsService,
    localVoiceAssets,
    localVoiceHealth,
    localVoiceHealthLoading,
    localVoiceInstallFeedback,
    localVoiceInstallProgress,
    localVoiceInstallRunning,
    refreshBrowserTtsHealth,
    refreshLocalVoiceHealth,
  } = useSettingsLocalVoiceState({
    activeTab,
    config: localConfig,
    isOpen,
    resetToken,
  });
  const {
    activePreviewSourceId,
    activateWindowAreaMode,
    availableDisplays,
    captureCropRect,
    captureMode,
    captureSourcesLoading,
    desktopAreaSelection,
    isDesktopConnected,
    isWindowAreaMode,
    pickDesktopCaptureArea,
    previewCaptureSources,
    refreshCaptureSources,
    selectedCaptureSource,
    setCaptureMode,
    setSelectedCaptureSourceId,
    startConfiguredScreenCapture,
    updateCaptureCropRect,
  } = useVisionSettings({
    activeTab,
    isOpen,
    onPreviewCaptureOptionsChange,
    onStartScreenCapture,
    screenCaptureActive,
    screenStream,
  });
  const {
    appendCustomModelPresets,
    appendFoodAppearances,
    appendModelMotionBindings,
    removeFoodAppearance,
    updateFoodInteractionType,
    removeModelMotionBinding,
    removeModelPreset,
    restoreBuiltinModelPresets,
    restoreFoodAppearances,
    updateModelMotionBindingDuration,
    updateModelMotionBindingKey,
    updateModelMotionBindingSemantic,
    updateLive2DRuntimeProfile,
  } = useSettingsPanelModelAssetsState({
    applyConfig,
    commitModelConfig,
    localConfig,
    selectedPetSlotId: selectedPetSlot.id,
  });
  const {
    activityAreaHeightValue,
    activityAreaPreview,
    activityAreaScale,
    activityAreaWidthValue,
    activityDisplayOptions,
    currentActivityDisplayLabel,
    currentInteractiveDialogueDisplayLabel,
    interactiveDialogueDisplayOptions,
    restoreActivityAreaAuto,
    selectedDisplay,
    selectedDisplayPixelHeight,
    selectedDisplayPixelWidth,
    updateActivityAreaDimension,
    updateActivityAreaScale,
    updateActivityDisplay,
    updateInteractiveDialogueDisplay,
  } = useSettingsPanelActivityState({
    applyConfig,
    availableDisplays,
    localConfig,
  });
  const timeAwarenessEnabled = isRealWorldTimeAwarenessEnabled(localConfig.settings);
  const realWorldTimeSnapshot = getRealWorldTimeSnapshot(systemNow);
  useEffect(() => {
    if (!isOpen || activeTab !== 'system') {
      return;
    }

    setSystemNow(new Date());
    const intervalId = window.setInterval(() => {
      setSystemNow(new Date());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeTab, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setEmbeddedFrameMode('normal');
      return;
    }

    setEmbeddedFrameMode('normal');
  }, [isOpen, resetToken, standalone]);

  const handleUpdateModel = (url: string, type: ModelType) => {
    commitModelConfig((baseConfig) => applyDesktopPetModelSelection(baseConfig, selectedPetSlot.id, {
      modelUrl: url,
      modelType: type,
    }));
  };

  const handleSetPetSlotEnabled = (slotId: string, enabled: boolean) => {
    if (slotId === PRIMARY_DESKTOP_PET_SLOT_ID) {
      return;
    }

    commitModelConfig((baseConfig) => applyDesktopPetSlotChanges(baseConfig, slotId, { enabled }));
  };

  const handleUpdatePetAutoMovementEnabled = (slotId: string, enabled: boolean) => {
    commitModelConfig((baseConfig) => applyDesktopPetSlotChanges(baseConfig, slotId, {
      autoMovementEnabled: enabled,
    }));
  };

  const handleUpdatePetModelVisible = (slotId: string, visible: boolean) => {
    if (slotId === PRIMARY_DESKTOP_PET_SLOT_ID) {
      return;
    }

    commitModelConfig((baseConfig) => applyDesktopPetSlotChanges(baseConfig, slotId, {
      modelVisible: visible,
    }));
  };

  const handleUpdatePetPointerLookEnabled = (slotId: string, enabled: boolean) => {
    commitModelConfig((baseConfig) => applyDesktopPetSlotChanges(baseConfig, slotId, {
      pointerLookEnabled: enabled,
    }));
  };

  const handleSetAvatar3DRuntimeBackend = (backend: 'three' | 'unity') => {
    commitModelConfig((baseConfig) => ({
      ...baseConfig,
      settings: {
        ...baseConfig.settings,
        avatar3dRuntimeBackend: backend,
      },
    }));
  };

  const updateStat = (key: 'affection' | 'hunger' | 'fatigue', value: number | number[]) => {
    const nextValue = Array.isArray(value) ? value[0] : value;
    applyConfig(applyDesktopPetSlotChanges(localConfig, selectedPetSlot.id, {
      stats: {
        ...selectedPetSlot.stats,
        [key]: nextValue,
      },
    }));
  };

  const updateCurrentAction = (action: PetAction) => {
    const nextLocalConfig = normalizePetConfig(applyDesktopPetSlotChanges(localConfig, selectedPetSlot.id, {
      currentAction: action,
    }));
    const nextCommittedConfig = normalizePetConfig(applyDesktopPetSlotChanges(resolveCommittedConfigBase(), selectedPetSlot.id, {
      currentAction: action,
    }));

    setLocalConfig(nextLocalConfig);
    if (selectedPetSlot.id === PRIMARY_DESKTOP_PET_SLOT_ID) {
      onSetAction(action);
      return;
    }

    onUpdateConfig(nextCommittedConfig, { persist: false });
  };

  const engineLabel = localConfig.settings.avatar3dRuntimeBackend === 'unity'
    ? 'Unity 3D Runtime'
    : (localConfig.settings.engineType ?? 'Live2D');
  const activeControlCenterPage = getSettingsControlCenterPage(activeControlCenterPageId);
  useEffect(() => {
    if (!isOpen) return;
    // The draft hook resets its legacy runtime tab on reopen. Reapply the
    // control-center page's route so the visible page and content cannot drift.
    setActiveTab(activeControlCenterPage.runtimeTab);
  }, [activeControlCenterPage.runtimeTab, isOpen, resetToken, setActiveTab]);
  const handleSetControlCenterPage = (pageId: SettingsControlCenterPageId) => {
    const page = getSettingsControlCenterPage(pageId);
    setActiveControlCenterPageId(pageId);
    setActiveTab(page.runtimeTab);
  };

  const renderSettingsTabContent = () => (
      <Suspense fallback={<SettingsTabFallback />}>
        <SettingsTabContentMotion>
          <SettingsPanelActiveTabContent
            activeTab={activeTab}
            personalityWorkspacePage={activeControlCenterPage.personalityWorkspacePage}
            motionExpressionTab={SettingsMotionExpressionTab}
            motionExpressionTabProps={{
              activityAreaHeightValue,
              activityAreaPreview,
              activityAreaScale,
              activityAreaWidthValue,
              desktopPetSlots,
              localConfig,
              logs,
              noDragRegionStyle,
              onAppendModelMotionBindings: appendModelMotionBindings,
              onApplyConfig: applyConfig,
              onRemoveModelMotionBinding: removeModelMotionBinding,
              onRestoreActivityAreaAuto: restoreActivityAreaAuto,
              onAddPetSlot: handleAddPetSlot,
              onRemovePetSlot: handleRemovePetSlot,
              onSelectPetSlot: setSelectedPetSlotId,
              onSetPetSlotEnabled: handleSetPetSlotEnabled,
              onSetPetSlotModelVisible: handleUpdatePetModelVisible,
              onSetActivityBorderVisible: (visible) => commitModelConfig((baseConfig) => ({
                ...baseConfig,
                settings: {
                  ...baseConfig.settings,
                  activityBorderVisible: visible,
                },
              })),
              onUpdateActivityAreaDimension: updateActivityAreaDimension,
              onUpdateActivityAreaScale: updateActivityAreaScale,
              onUpdateModelMotionBindingDuration: updateModelMotionBindingDuration,
              onUpdateModelMotionBindingKey: updateModelMotionBindingKey,
              onUpdateModelMotionBindingSemantic: updateModelMotionBindingSemantic,
              onUpdatePetAutoMovementEnabled: handleUpdatePetAutoMovementEnabled,
              onUpdatePetPointerLookEnabled: handleUpdatePetPointerLookEnabled,
              petVisualSize,
              selectedDisplay,
              selectedDisplayPixelHeight,
              selectedDisplayPixelWidth,
              selectedPetSlot,
              selectedPetSlotId: selectedPetSlot.id,
            }}
            modelTab={SettingsModelTab}
            modelTabProps={{
              desktopPetSlots,
              localConfig,
              onAppendCustomModelPresets: appendCustomModelPresets,
              onAppendFoodAppearances: appendFoodAppearances,
              onApplyConfig: applyConfig,
              onRemoveFoodAppearance: removeFoodAppearance,
              onUpdateFoodInteractionType: updateFoodInteractionType,
              onRemoveModelPreset: removeModelPreset,
              onResetFolders,
              onRestoreBuiltinModelPresets: restoreBuiltinModelPresets,
              onRestoreFoodAppearances: restoreFoodAppearances,
              onAddPetSlot: handleAddPetSlot,
              onRemovePetSlot: handleRemovePetSlot,
              onSelectPetSlot: setSelectedPetSlotId,
              onSetAvatar3DRuntimeBackend: handleSetAvatar3DRuntimeBackend,
              onSetPetSlotAutoMovementEnabled: handleUpdatePetAutoMovementEnabled,
              onSetPetSlotModelVisible: handleUpdatePetModelVisible,
              onSetPetSlotPointerLookEnabled: handleUpdatePetPointerLookEnabled,
              onSetPetSlotEnabled: handleSetPetSlotEnabled,
              onUpdateModel: handleUpdateModel,
              onUpdateLive2DRuntimeProfile: updateLive2DRuntimeProfile,
              selectedPetSlot,
              selectedPetSlotId: selectedPetSlot.id,
            }}
            personalityTab={SettingsPersonalityTab}
            personalityTabProps={{
              customApiDraft,
              customApiSaveFeedback,
              desktopPetSlots,
              isCustomApiDirty,
              localConfig,
              noDragRegionStyle,
              onAddPetSlot: handleAddPetSlot,
              onApplyConfig: applyConfig,
              onCommitTraitsDraft: commitTraitsDraft,
              onRemovePetSlot: handleRemovePetSlot,
              onSaveCustomApiSettings: saveCustomApiSettings,
              onSelectPetSlot: setSelectedPetSlotId,
              onSetCustomApiDraft: handleSetCustomApiDraft,
              onSetIsEditingTraits: setIsEditingTraits,
              onSetPetSlotAutoMovementEnabled: handleUpdatePetAutoMovementEnabled,
              onSetPetSlotModelVisible: handleUpdatePetModelVisible,
              onSetPetSlotPointerLookEnabled: handleUpdatePetPointerLookEnabled,
              onSetPetSlotEnabled: handleSetPetSlotEnabled,
              onSetTraitsDraft: handleSetTraitsDraft,
              onUpdatePersonality: handleUpdatePersonality,
              selectedPetSlot,
              selectedPetSlotId: selectedPetSlot.id,
              traitsDraft,
            }}
            systemTab={SettingsSystemTab}
            systemTabProps={{
              localConfig,
              logs,
              onApplyConfig: applyConfig,
              realWorldTimeSnapshot,
              timeAwarenessEnabled,
              onlyWebSearch: activeControlCenterPageId === 'ai-tools-web',
              onlyChatDisplay: activeControlCenterPageId === 'system-chat',
              onUpdateConfig,
            }}
            visionTab={SettingsVisionTab}
            visionTabProps={{
              activePreviewSourceId,
              activityDisplayOptions,
              currentActivityDisplayLabel,
              currentInteractiveDialogueDisplayLabel,
              captureCropRect,
              captureMode,
              captureSourcesLoading,
              desktopAreaSelection,
              interactiveDialogueDisplayOptions,
              isDesktopConnected,
              isWindowAreaMode,
              localConfig,
              logs,
              noDragRegionStyle,
              onActivateWindowAreaMode: activateWindowAreaMode,
              onApplyConfig: applyConfig,
              onPickDesktopCaptureArea: pickDesktopCaptureArea,
              onRefreshCaptureSources: refreshCaptureSources,
              onSetCaptureMode: setCaptureMode,
              onSetSelectedCaptureSourceId: setSelectedCaptureSourceId,
              onStartConfiguredScreenCapture: startConfiguredScreenCapture,
              onStopScreenCapture,
              onUpdateActivityDisplay: updateActivityDisplay,
              onUpdateInteractiveDialogueDisplay: updateInteractiveDialogueDisplay,
              onUpdateCaptureCropRect: updateCaptureCropRect,
              previewCaptureSources,
              screenCaptureOptions,
              selectedCaptureSource,
            }}
            voiceTab={SettingsVoiceTab}
            voiceTabProps={{
              browserTtsHealth,
              browserTtsHealthLoading,
              browserTtsInstallFeedback,
              browserTtsInstallProgress,
              browserTtsInstallRunning,
              localConfig,
              localVoiceAssets,
              localVoiceHealth,
              localVoiceHealthLoading,
              localVoiceInstallFeedback,
              localVoiceInstallProgress,
              localVoiceInstallRunning,
              noDragRegionStyle,
              onApplyConfig: applyConfig,
              onInstallBrowserTtsDependencies: () => {
                void handleInstallBrowserTtsDependencies();
              },
              onInstallLocalVoiceDependencies: () => {
                void handleInstallLocalVoiceDependencies();
              },
              onRefreshBrowserTtsHealth: () => {
                void refreshBrowserTtsHealth();
              },
              onRefreshLocalVoiceHealth: () => {
                void refreshLocalVoiceHealth({ forceRefreshAssets: true });
              },
              onStartBrowserTtsService: () => {
                void handleStartBrowserTtsService();
              },
            }}
          />
        </SettingsTabContentMotion>
      </Suspense>
  );

  const renderControlCenterContent = () => (
    activeControlCenterPageId === 'overview'
      ? <SettingsOverviewDashboard config={localConfig} onImportConfig={replaceConfig} />
      : activeControlCenterPageId === 'extension-deepseek-harness'
        ? <SettingsAgentRuntimeSection config={localConfig} noDragRegionStyle={noDragRegionStyle} onApplyConfig={applyConfig} />
      : activeControlCenterPageId === 'advanced-game-companion'
        ? <SettingsGameCompanionTab config={localConfig} noDragRegionStyle={noDragRegionStyle} onApplyConfig={applyConfig} />
      : activeControlCenterPageId === 'advanced-desktop-awareness'
        ? <SettingsDesktopActivityAwarenessTab config={localConfig} noDragRegionStyle={noDragRegionStyle} onApplyConfig={applyConfig} stats={selectedPetSlot.stats} />
      : activeControlCenterPageId === 'advanced-expression'
        ? (
          <Suspense fallback={<SettingsTabFallback />}>
            <SettingsExpressionLibraryTab localConfig={localConfig} onApplyConfig={applyConfig} />
          </Suspense>
        )
      : activeControlCenterPageId === 'extension-overview'
        ? <SettingsExtensionHubTab category="overview" currentPetId={selectedPetSlot.id} />
        : activeControlCenterPageId === 'extension-plugins'
          ? <SettingsExtensionHubTab category="plugins" currentPetId={selectedPetSlot.id} />
          : activeControlCenterPageId === 'extension-personas'
            ? <SettingsExtensionHubTab category="personas" currentPetId={selectedPetSlot.id} />
            : activeControlCenterPageId === 'extension-external'
              ? <SettingsExtensionHubTab category="external" currentPetId={selectedPetSlot.id} />
              : activeControlCenterPageId === 'extension-resources'
                ? <SettingsExtensionHubTab category="resources" currentPetId={selectedPetSlot.id} />
      : activeControlCenterPageId === 'platform-mcp'
          ? <SettingsPlatformMcpTab />
          : activeControlCenterPageId === 'platform-skills-api'
            ? <SettingsPlatformSkillApiTab localConfig={localConfig} currentPetId={selectedPetSlot.id} />
            : activeControlCenterPageId === 'platform-workflow'
              ? <SettingsComfyUiWorkflowTab />
      : renderSettingsTabContent()
  );

  const closeSettingsWithoutSaving = () => {
    discardExpressionCategoryDrafts();
    handleCloseWithoutSaving();
  };

  const saveSettingsAndClose = async () => {
    try {
      await flushExpressionCategoryDrafts();
      handleSaveAndClose();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '表情包分类保存失败，请检查后重试。');
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={panelRootRef}
      data-desktop-pet-settings-panel="true"
      data-desktop-pet-interactive="true"
      className={[
        standalone ? 'relative h-full w-full' : 'absolute z-panel',
        standaloneWindowResize.isResizing ? 'select-none shadow-none' : '',
        standaloneWindowDrag.isDragging ? 'select-none shadow-none' : '',
        isFrameInteracting ? 'select-none ring-1 ring-ring/40 shadow-[0_22px_64px_rgba(158,84,140,0.18)]' : '',
        'pointer-events-auto flex flex-col overflow-hidden',
        isDockedPresentation
          ? 'rounded-2xl border-0 app-shell-canvas shadow-[0_28px_80px_rgba(158,84,140,0.20)]'
          // A standalone panel fills its window, so an outer shadow can only
          // leak into the transparent area outside the rounded bottom corners.
          : `${standalone && standaloneWindowFrame.isMaximized ? 'rounded-none' : 'rounded-[10px]'} border-0 app-shell-canvas ${standalone ? '' : 'shadow-xl'}`,
      ].join(' ')}
      style={resolvedRootStyle}
    >
      {isEmbeddedMinimized ? (
        <WindowCompactHandle
          className={SETTINGS_COMPACT_HANDLE_CLASS}
          title="展开控制中心"
          onExpand={handleMinimizeFrame}
        />
      ) : (
        <>
      <div
        className={[
          'relative touch-none select-none rounded-t-[inherit] px-5 py-4 transition-colors',
          isDockedPresentation
            ? 'border-b border-border/80 bg-white/80'
            : 'border-b border-border bg-card',
          isDraggingPanel
            ? (isDockedPresentation ? 'bg-white/95' : 'bg-muted/40')
            : '',
        ].join(' ')}
        style={standalone ? noDragRegionStyle : undefined}
        onPointerDown={standalone ? standaloneWindowDrag.startWindowDrag : startPanelDrag}
        onDoubleClick={standalone ? (event) => {
          if (!(event.target as HTMLElement).closest('button')) standaloneWindowFrame.toggleMaximizeWindow();
        } : undefined}
      >
        <div className="relative z-10 mb-1 flex items-center justify-between gap-3">
          <div className="pointer-events-none min-w-0 flex items-center gap-2">
            <div className="h-2 w-2 shrink-0 rounded-full bg-primary" />
            <div className="truncate text-sm font-semibold tracking-[0.12em] text-foreground">
              {isDockedPresentation ? '角色设置' : '控制中心'}
            </div>
          </div>
          <WindowFrameControls
            buttonClassName={SETTINGS_FRAME_CONTROL_BUTTON_CLASS}
            className="-my-4 -mr-5 ml-2"
            closeButtonClassName={SETTINGS_FRAME_CONTROL_CLOSE_BUTTON_CLASS}
            closeDangerHover={false}
            closeTitle="关闭控制中心"
            minimizeTitle={standalone ? '最小化' : '收纳控制中心'}
            style={noDragRegionStyle}
            onClose={closeSettingsWithoutSaving}
            onMinimize={handleMinimizeFrame}
            isMaximized={standaloneWindowFrame.isMaximized}
            onToggleMaximize={standalone ? standaloneWindowFrame.toggleMaximizeWindow : undefined}
          />
        </div>
        {!isEmbeddedMinimized && (
          <div className="pointer-events-none relative z-10 text-xs tracking-[0.08em] text-muted-foreground">
            {isDockedPresentation ? '从角色右侧快速调整模型、人格、控制与系统配置' : '管理角色、模型、记忆与桌面互动'}
          </div>
        )}
        </div>

        {!isEmbeddedMinimized && (
          <SettingsPanelStandaloneShell
            activePetName={selectedPetSlot?.personality.name ?? '桌宠'}
            activePageId={activeControlCenterPageId}
            config={localConfig}
            desktopPetSlots={desktopPetSlots}
            engineLabel={engineLabel}
            logs={logs}
            noDragRegionStyle={noDragRegionStyle}
            petVisualSize={petVisualSize}
            selectedPetSlot={selectedPetSlot}
            onSelectPetSlot={setSelectedPetSlotId}
            onAddPetSlot={handleAddPetSlot}
            onRemovePetSlot={handleRemovePetSlot}
            onSetActivePage={handleSetControlCenterPage}
            onSetPetSlotAutoMovementEnabled={handleUpdatePetAutoMovementEnabled}
            onSetPetSlotEnabled={handleSetPetSlotEnabled}
            onSetPetSlotModelVisible={handleUpdatePetModelVisible}
            onSetPetSlotPointerLookEnabled={handleUpdatePetPointerLookEnabled}
            onUpdateStat={updateStat}
            renderTabContent={() => (
              <SettingsTabErrorBoundary key={`${activeControlCenterPageId}:${resetToken}`} activeTab={activeControlCenterPage.runtimeTab}>
                <Suspense fallback={<SettingsTabFallback />}>
                  {renderControlCenterContent()}
                </Suspense>
              </SettingsTabErrorBoundary>
            )}
          />
        )}

        {!isEmbeddedMinimized && (
        <div
          className="flex justify-end gap-3 rounded-b-[inherit] border-t border-border bg-muted/30 px-5 py-4"
          style={noDragRegionStyle}
        >
          <Button variant="outline" onClick={closeSettingsWithoutSaving} className="h-9 rounded-md border-border text-xs text-muted-foreground hover:bg-muted">关闭</Button>
          <Button onClick={() => void saveSettingsAndClose()} className="h-9 rounded-md bg-primary text-xs font-medium text-primary-foreground hover:bg-primary/90">保存</Button>
        </div>
        )}
      {!standalone && !isEmbeddedMinimized && (
        <div className="pointer-events-none absolute inset-0 z-40">
          <div className={`${EMBEDDED_SETTINGS_EDGE_HANDLE_CLASS} left-0 right-0 top-0 h-5 cursor-ns-resize border-t border-primary/45 bg-gradient-to-b from-primary/10 to-transparent`} onPointerDown={(event) => startPanelResize(event, 'n')} />
          <div className={`${EMBEDDED_SETTINGS_EDGE_HANDLE_CLASS} bottom-0 left-0 right-0 h-5 cursor-ns-resize border-b border-primary/45 bg-gradient-to-t from-primary/10 to-transparent`} onPointerDown={(event) => startPanelResize(event, 's')} />
          <div className={`${EMBEDDED_SETTINGS_EDGE_HANDLE_CLASS} bottom-0 left-0 top-0 w-5 cursor-ew-resize border-l border-primary/45 bg-gradient-to-r from-primary/10 to-transparent`} onPointerDown={(event) => startPanelResize(event, 'w')} />
          <div className={`${EMBEDDED_SETTINGS_EDGE_HANDLE_CLASS} bottom-0 right-0 top-0 w-5 cursor-ew-resize border-r border-primary/45 bg-gradient-to-l from-primary/10 to-transparent`} onPointerDown={(event) => startPanelResize(event, 'e')} />
          <div className={`${EMBEDDED_SETTINGS_CORNER_HANDLE_CLASS} left-0 top-0 h-7 w-7 cursor-nwse-resize border-l border-t border-primary/45 bg-gradient-to-br from-primary/10 to-transparent`} onPointerDown={(event) => startPanelResize(event, 'nw')} />
          <div className={`${EMBEDDED_SETTINGS_CORNER_HANDLE_CLASS} right-0 top-0 h-7 w-7 cursor-nesw-resize border-r border-t border-primary/45 bg-gradient-to-bl from-primary/10 to-transparent`} onPointerDown={(event) => startPanelResize(event, 'ne')} />
          <div className={`${EMBEDDED_SETTINGS_CORNER_HANDLE_CLASS} bottom-0 left-0 h-7 w-7 cursor-nesw-resize border-b border-l border-primary/45 bg-gradient-to-tr from-primary/10 to-transparent`} onPointerDown={(event) => startPanelResize(event, 'sw')} />
          <div className={`${EMBEDDED_SETTINGS_CORNER_HANDLE_CLASS} bottom-0 right-0 h-7 w-7 cursor-nwse-resize border-b border-r border-primary/45 bg-gradient-to-tl from-primary/10 to-transparent`} onPointerDown={(event) => startPanelResize(event, 'se')} />
        </div>
      )}

      {standalone && (
        <StandaloneWindowResizeHandles onStartResize={standaloneWindowResize.startWindowResize} />
      )}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute z-max border border-border ${isDockedPresentation ? 'rounded-2xl' : 'rounded-[10px]'}`}
        style={{ inset: 1 }}
      />
        </>
      )}
    </div>
  );
}
