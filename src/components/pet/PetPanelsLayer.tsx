import { Suspense, lazy, memo, type PointerEvent as ReactPointerEvent } from 'react';
import { Gamepad2, Monitor, StopCircle } from 'lucide-react';
import { type DesktopPetChatSendOptions, type DesktopPetGroupChatContinuationMode } from '../../chatState';
import { type ChatAgentApprovalDecision, type ChatMessage, type DesktopPetChatMode, type PetAction, type PetConfig, type PetConfigUpdateHandler, type PetModelMotionBinding, type PetVisualSize } from '../../types';
import { type ChatMemorySaveHandler } from '../chat/chatMemorySaveUtils';
import { type AvatarRuntimeEventSummaryByPetId } from '../../pet-runtime/avatar-runtime/avatarRuntimeEventState';
import { resolveActiveChatSlot, type ChatTargetOption } from '../chat/multiPetChat';
import {
  resolvePetModelMotionBindingsForModel,
} from '../../pet-runtime/content/petModelMotionBindings';
import { filterPetModelMotionBindingsForModelType } from '../../pet-runtime/content/petModelMotionBindingCompatibility';
import {
  PET_QUICK_ACTION_MENU_INTERACTIVE_HEIGHT,
  PET_QUICK_ACTION_MENU_INTERACTIVE_WIDTH,
  PET_QUICK_ACTION_MENU_SAFE_PADDING_X,
  PET_QUICK_ACTION_PANEL_WIDTH,
  QUICK_SUB_PANEL_WIDTH,
  resolvePetQuickActionMenuCenterY,
} from './petQuickActionMenuGeometry';
import {
  PetQuickActionMenu,
} from './PetQuickActionMenu';
import {
  type GameCompanionLoopStatusSnapshot,
  type GameCompanionSourcePreference,
} from './useGameCompanionLoopController';

const PetChatOverlay = lazy(() => import('../chat/PetChatOverlay'));
const SettingsPanel = lazy(() => import('../SettingsPanel'));

type Position = {
  x: number;
  y: number;
};

type ViewportRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

interface PetPanelsLayerProps {
  activePetId: string;
  activityViewport: ViewportRect;
  chatMode: DesktopPetChatMode;
  chatPanelBasePosition: Position;
  chatPanelDragState: { pointerId: number; startX: number; startY: number; originX: number; originY: number } | null;
  chatPanelOffset: Position;
  chatPanelSize: { width: number; height: number };
  closeAllPetPanels: () => void;
  config: PetConfig;
  gameCompanionLoopStatus: GameCompanionLoopStatusSnapshot;
  gameCompanionSourcePreference: GameCompanionSourcePreference | null;
  groupChatContinuationMode: DesktopPetGroupChatContinuationMode;
  groupUserAttention: import('../../chatState').GroupUserAttention | null;
  inputValue: string;
  isAgentSelectorOpen: boolean;
  isChatSelectorOpen: boolean;
  isChatOpen: boolean;
  isGroupChatRunning: boolean;
  isInteractiveDialogueOpen: boolean;
  isListening: boolean;
  isDesktopOrganizationRunning: boolean;
  isPetActionSelectorOpen: boolean;
  isSettingsOpen: boolean;
  isSpeaking: boolean;
  isTyping: boolean;
  isPrimaryTyping: boolean;
  interactiveDialogueChatPanelPosition: Position;
  latestPetMessage: string;
  logs: string[];
  runtimeSummaryByPetId: AvatarRuntimeEventSummaryByPetId;
  messages: ChatMessage[];
  petOptions: ChatTargetOption[];
  speakingPetId: string | null;
  typingPetName?: string | null;
  webSearchStatusMessage: string;
  onActivePetChange: (petId: string) => void;
  onGameCompanionSourcePreferenceChange: (preference: GameCompanionSourcePreference | null) => void;
  onChatModeChange: (mode: DesktopPetChatMode) => void;
  onInputChange: (value: string) => void;
  onPlayMessageVoice: (text: string) => Promise<void>;
  onPreviewCaptureOptionsChange?: (options?: DesktopPetCaptureOptionsLike | null) => void;
  onSaveMessageToMemory: ChatMemorySaveHandler;
  onResetFolders: () => void;
  onSendMessage: (
    textOverride?: string,
    options?: DesktopPetChatSendOptions,
  ) => void;
  onStopAgentRun: (messageId?: string | null) => void;
  onStopGroupChat: () => void;
  onGroupChatContinuationModeChange: (mode: DesktopPetGroupChatContinuationMode) => void;
  onOpenChatPanel: () => void;
  onOpenControlsPanel: () => void;
  onOpenGroupChatPanel: () => void;
  onOpenInteractiveDialogue: () => void;
  onOpenNormalAgent: () => void;
  onOpenSettingsPanel: () => void;
  onRestartGameCompanionLoopWithScreenSource: () => void;
  onRestartGameCompanionLoopWithSourcePreference: (preference: GameCompanionSourcePreference | null) => void;
  onResolveAgentApproval: (messageId: string, decision: ChatAgentApprovalDecision) => void | Promise<void>;
  onResolveGroupUserAttention: import('../../chatState').DesktopPetChatController['resolveGroupUserAttention'];
  onSelectPetAction: (action: PetAction) => void;
  onSelectPetCustomMotion: (binding: PetModelMotionBinding) => void;
  onSetAction: (action: PetAction) => void;
  onStartChatPanelDrag: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onStartChatPanelResize: (
    event: ReactPointerEvent<HTMLDivElement>,
    direction: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw',
  ) => void;
  onStartScreenCapture: (options?: DesktopPetCaptureOptionsLike) => Promise<void> | void;
  onStopGameCompanionLoop: () => void;
  onToggleGameCompanionLoop: () => void;
  onStopScreenCapture: () => Promise<void> | void;
  onToggleAgentSelector: () => void;
  onToggleVoiceEnabled: () => void;
  onToggleVoiceInput: () => void;
  onToggleActionSelector: () => void;
  onToggleChatSelector: () => void;
  onUpdateConfig: PetConfigUpdateHandler;
  petAnchorPosition: Position;
  petVisualBounds: { bottom: number; top: number };
  selectedCustomMotionBindingId?: string | null;
  petVisualSize: PetVisualSize;
  screenCaptureOptions?: DesktopPetCaptureOptionsLike | null;
  screenStream: MediaStream | null;
  shellViewport: ViewportRect;
  settingsInitialSelectedPetSlotId?: string;
  settingsInitialTab: 'personality' | 'model' | 'motion-expression' | 'vision' | 'voice' | 'system';
  settingsResetToken: number;
  showPetActions: boolean;
  showEmbeddedChatPanel: boolean;
  useExternalSettingsWindow: boolean;
  voiceEnabled: boolean;
  voiceInputEnabled: boolean;
}

const QUICK_MENU_GAP = 10;
const QUICK_ACTION_PANEL_GAP = 12;
const SIDE_PANEL_GAP = 256;
const SIDE_PANEL_MARGIN = 20;
const GAME_COMPANION_BADGE_MAX_WIDTH = 240;
const GAME_COMPANION_BADGE_ESTIMATED_HEIGHT = 78;
const GAME_COMPANION_BADGE_GAP = 10;

function clampPanelCoordinate(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function resolveQuickMenuPosition(
  viewport: ViewportRect,
  petAnchorPosition: Position,
  petVisualBounds: { bottom: number; top: number },
  petVisualSize: PetVisualSize,
  reserveRightWidth = 0,
) {
  const desiredX = petAnchorPosition.x + petVisualSize.width / 2 + QUICK_MENU_GAP;
  const desiredY = resolvePetQuickActionMenuCenterY(petAnchorPosition.y, petVisualBounds);

  return {
    x: clampPanelCoordinate(
      desiredX,
      viewport.x + SIDE_PANEL_MARGIN + PET_QUICK_ACTION_MENU_SAFE_PADDING_X,
      viewport.x + viewport.width
        - (PET_QUICK_ACTION_MENU_INTERACTIVE_WIDTH - PET_QUICK_ACTION_MENU_SAFE_PADDING_X)
        - SIDE_PANEL_MARGIN
        - reserveRightWidth,
    ),
    y: clampPanelCoordinate(
      desiredY,
      viewport.y + PET_QUICK_ACTION_MENU_INTERACTIVE_HEIGHT / 2,
      viewport.y + viewport.height - PET_QUICK_ACTION_MENU_INTERACTIVE_HEIGHT / 2,
    ),
  };
}

function resolveGameCompanionBadgePosition(
  viewport: ViewportRect,
  petAnchorPosition: Position,
  petVisualBounds: { bottom: number; top: number },
  petVisualSize: PetVisualSize,
) {
  const halfBadgeWidth = GAME_COMPANION_BADGE_MAX_WIDTH / 2;
  return {
    x: clampPanelCoordinate(
      petAnchorPosition.x + petVisualSize.width / 2,
      viewport.x + SIDE_PANEL_MARGIN + halfBadgeWidth,
      viewport.x + viewport.width - SIDE_PANEL_MARGIN - halfBadgeWidth,
    ),
    y: clampPanelCoordinate(
      petAnchorPosition.y + petVisualBounds.bottom + GAME_COMPANION_BADGE_GAP,
      viewport.y + SIDE_PANEL_MARGIN,
      viewport.y + viewport.height - GAME_COMPANION_BADGE_ESTIMATED_HEIGHT - SIDE_PANEL_MARGIN,
    ),
  };
}
function resolveSidePanelBasePosition(
  viewport: ViewportRect,
  petAnchorPosition: Position,
  petVisualSize: PetVisualSize,
  panelSize: { width: number; height: number },
) {
  const nextLeft = clampPanelCoordinate(
    petAnchorPosition.x + petVisualSize.width / 2 + SIDE_PANEL_GAP,
    viewport.x + SIDE_PANEL_MARGIN,
    viewport.x + viewport.width - panelSize.width - SIDE_PANEL_MARGIN,
  );
  const nextTop = clampPanelCoordinate(
    petAnchorPosition.y - panelSize.height / 2,
    viewport.y + SIDE_PANEL_MARGIN,
    viewport.y + viewport.height - panelSize.height - SIDE_PANEL_MARGIN,
  );

  return {
    x: Math.round(nextLeft),
    y: Math.round(nextTop),
  };
}

export const PetPanelsLayer = memo(function PetPanelsLayer({
  activePetId,
  activityViewport,
  chatMode,
  chatPanelBasePosition,
  chatPanelDragState,
  chatPanelOffset,
  chatPanelSize,
  closeAllPetPanels,
  config,
  gameCompanionLoopStatus,
  gameCompanionSourcePreference,
  groupChatContinuationMode,
  groupUserAttention,
  inputValue,
  isAgentSelectorOpen,
  isChatSelectorOpen,
  isChatOpen,
  isGroupChatRunning,
  isInteractiveDialogueOpen,
  isListening,
  isDesktopOrganizationRunning,
  isPetActionSelectorOpen,
  isSettingsOpen,
  isSpeaking,
  isTyping,
  isPrimaryTyping,
  interactiveDialogueChatPanelPosition,
  latestPetMessage,
  logs,
  runtimeSummaryByPetId,
  messages,
  petOptions,
  speakingPetId,
  typingPetName = null,
  webSearchStatusMessage,
  onActivePetChange,
  onGameCompanionSourcePreferenceChange,
  onChatModeChange,
  onInputChange,
  onPlayMessageVoice,
  onPreviewCaptureOptionsChange,
  onSaveMessageToMemory,
  onResetFolders,
  onSendMessage,
  onStopAgentRun,
  onStopGroupChat,
  onGroupChatContinuationModeChange,
  onOpenChatPanel,
  onOpenControlsPanel,
  onOpenGroupChatPanel,
  onOpenInteractiveDialogue,
  onOpenNormalAgent,
  onOpenSettingsPanel,
  onRestartGameCompanionLoopWithScreenSource,
  onRestartGameCompanionLoopWithSourcePreference,
  onResolveAgentApproval,
  onResolveGroupUserAttention,
  onSelectPetAction,
  onSelectPetCustomMotion,
  onSetAction,
  onStartChatPanelDrag,
  onStartChatPanelResize,
  onStartScreenCapture,
  onStopGameCompanionLoop,
  onToggleGameCompanionLoop,
  onStopScreenCapture,
  onToggleAgentSelector,
  onToggleActionSelector,
  onToggleChatSelector,
  onToggleVoiceEnabled,
  onToggleVoiceInput,
  onUpdateConfig,
  petAnchorPosition,
  petVisualBounds,
  selectedCustomMotionBindingId = null,
  petVisualSize,
  screenCaptureOptions = null,
  screenStream,
  shellViewport,
  settingsInitialSelectedPetSlotId = 'primary',
  settingsInitialTab,
  settingsResetToken,
  showPetActions,
  showEmbeddedChatPanel,
  useExternalSettingsWindow,
  voiceEnabled,
  voiceInputEnabled,
}: PetPanelsLayerProps) {
  const activePetSlot = resolveActiveChatSlot(config, activePetId);
  const activePetModelType = activePetSlot?.modelType ?? config.modelType;
  const activePetModelUrl = activePetSlot?.modelUrl ?? config.modelUrl;
  const activePetName = petOptions.find((option) => option.id === activePetId)?.name ?? config.personality.name;
  const activeGreeting = activePetSlot?.personality.greeting ?? config.personality.greeting;
  const activePetCustomMotionBindings = filterPetModelMotionBindingsForModelType(
    activePetModelType,
    resolvePetModelMotionBindingsForModel(
      activePetModelType,
      activePetModelUrl,
      config.customModelPresets,
    ),
  );
  const shouldRenderChatOverlay = showEmbeddedChatPanel || Boolean(latestPetMessage) || isPrimaryTyping || Boolean(webSearchStatusMessage);
  const quickSubPanelWidth = isPetActionSelectorOpen
    ? PET_QUICK_ACTION_PANEL_WIDTH
    : (isChatSelectorOpen || isAgentSelectorOpen)
      ? QUICK_SUB_PANEL_WIDTH
      : 0;
  const quickMenuReservedRightWidth = quickSubPanelWidth > 0
    ? quickSubPanelWidth + QUICK_ACTION_PANEL_GAP
    : 0;
  const adjustedQuickMenuPosition = resolveQuickMenuPosition(
    shellViewport,
    petAnchorPosition,
    petVisualBounds,
    petVisualSize,
    quickMenuReservedRightWidth,
  );
  const gameCompanionLoopBadgePosition = resolveGameCompanionBadgePosition(
    shellViewport,
    petAnchorPosition,
    petVisualBounds,
    petVisualSize,
  );
  const gameCompanionDetected = gameCompanionLoopStatus.sourceCheckStatus === 'ready'
    && Boolean(gameCompanionLoopStatus.detectedGameOrGenre?.trim());
  const gameCompanionTextColor = config.settings.chatBracketOuterTextColor;
  const dockedChatPanelPosition = resolveSidePanelBasePosition(
    shellViewport,
    petAnchorPosition,
    petVisualSize,
    chatPanelSize,
  );
  const resolvedChatPanelPosition = isInteractiveDialogueOpen
    ? interactiveDialogueChatPanelPosition
    : (dockedChatPanelPosition ?? chatPanelBasePosition);
  const resolvedChatPanelOffset = isInteractiveDialogueOpen
    ? { x: 0, y: 0 }
    : chatPanelOffset;
  const activeQuickActionId = isSettingsOpen
    ? (settingsInitialTab === 'motion-expression' ? 'controls' : 'settings')
    : isDesktopOrganizationRunning
      ? 'agent'
    : isAgentSelectorOpen || gameCompanionLoopStatus.running
      ? 'agent'
    : isPetActionSelectorOpen
      ? 'controls'
    : isChatSelectorOpen
      ? 'chat'
    : isChatOpen
      ? 'chat'
      : null;
  const shouldShowGameCompanionRecoveryActions = gameCompanionLoopStatus.running
    && (gameCompanionLoopStatus.sourceCheckStatus === 'uncertain' || gameCompanionLoopStatus.sourceCheckStatus === 'error');

  return (
    <>
      <PetQuickActionMenu
        activeItemId={activeQuickActionId}
        activePetModelType={activePetModelType}
        activePetAction={activePetSlot?.currentAction ?? config.currentAction}
        activeCustomMotionBindingId={selectedCustomMotionBindingId}
        activePetName={activePetName}
        customMotionBindings={activePetCustomMotionBindings}
        isAgentSelectorOpen={isAgentSelectorOpen}
        isActionSelectorOpen={isPetActionSelectorOpen}
        isChatSelectorOpen={isChatSelectorOpen}
        isInteractiveDialogueActive={isInteractiveDialogueOpen}
        isOpen={showPetActions}
        nativeDragOwnerId={activePetId}
        gameCompanionLoopStatus={gameCompanionLoopStatus}
        gameCompanionSourcePreference={gameCompanionSourcePreference}
        position={adjustedQuickMenuPosition}
        onClose={closeAllPetPanels}
        onOpenChat={onOpenChatPanel}
        onOpenControls={onOpenControlsPanel}
        onOpenInteractiveDialogue={onOpenInteractiveDialogue}
        onOpenNormalAgent={onOpenNormalAgent}
        onToggleGameCompanionLoop={onToggleGameCompanionLoop}
        onOpenSettings={onOpenSettingsPanel}
        onOpenAgent={onToggleAgentSelector}
        onGameCompanionSourcePreferenceChange={onGameCompanionSourcePreferenceChange}
        onRestartGameCompanionLoopWithScreenSource={onRestartGameCompanionLoopWithScreenSource}
        onRestartGameCompanionLoopWithSourcePreference={onRestartGameCompanionLoopWithSourcePreference}
        onStopGameCompanionLoop={onStopGameCompanionLoop}
        onSelectAction={onSelectPetAction}
        onSelectCustomMotionBinding={onSelectPetCustomMotion}
        onToggleActionSelector={onToggleActionSelector}
        onToggleChatSelector={onToggleChatSelector}
      />

      {gameCompanionLoopStatus.running && (
        <div
          data-desktop-pet-interactive="true"
          data-desktop-pet-window-shape="true"
          data-desktop-pet-native-scope="pet"
          className={`absolute z-[72] flex w-[min(240px,calc(100vw-40px))] items-center gap-2 rounded-full border px-3 py-2 shadow-[0_10px_24px_rgba(15,23,42,0.14)] backdrop-blur-md transition-colors ${
            gameCompanionDetected ? 'border-white/55 bg-white/52' : 'border-violet-200 bg-white/94'
          }`}
          style={{
            left: gameCompanionLoopBadgePosition.x,
            top: gameCompanionLoopBadgePosition.y,
            transform: 'translateX(-50%)',
            color: gameCompanionTextColor,
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/65" style={{ color: gameCompanionTextColor }}>
            <Gamepad2 className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11px] font-semibold">游戏陪玩中</span>
            <span
              className="block truncate text-[9px]"
              style={{ color: gameCompanionTextColor, opacity: 0.72 }}
              title={gameCompanionLoopStatus.lockedSourceLabel ?? gameCompanionLoopStatus.query ?? '自动来源'}
            >
              {gameCompanionLoopStatus.lockedSourceLabel ?? gameCompanionLoopStatus.query ?? '自动来源'}
            </span>
            <span
              className="block truncate text-[9px]"
              style={{ color: gameCompanionTextColor, opacity: 0.58 }}
              title={gameCompanionLoopStatus.sourceCheckMessage ?? gameCompanionLoopStatus.lastObservationSummary ?? undefined}
            >
              {gameCompanionLoopStatus.sourceCheckMessage
                ? `${gameCompanionLoopStatus.sourceCheckMessage} · `
                : gameCompanionLoopStatus.lastObservationSummary
                ? `${gameCompanionLoopStatus.lastObservationSummary} · `
                : `${gameCompanionLoopStatus.isTicking ? '正在分析' : '低频观察'} · `}
              {gameCompanionLoopStatus.sampleCount}/{gameCompanionLoopStatus.maxSamples}
              {' · '}
              评论 {gameCompanionLoopStatus.commentCount}
            </span>
          </span>
          {shouldShowGameCompanionRecoveryActions && (
            <button
              type="button"
              onClick={onRestartGameCompanionLoopWithScreenSource}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-amber-100 bg-amber-50 text-amber-700 transition-colors hover:border-amber-200 hover:bg-amber-100"
              title="改看整个屏幕"
            >
              <Monitor className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onStopGameCompanionLoop}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-rose-100 bg-rose-50 text-rose-600 transition-colors hover:border-rose-200 hover:bg-rose-100"
            title="停止游戏陪玩"
          >
            <StopCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {shouldRenderChatOverlay && (
        <Suspense fallback={null}>
          <PetChatOverlay
            activePetId={activePetId}
            chatBracketOuterTextColor={config.settings.chatBracketOuterTextColor}
            chatBubbleEnabled={config.settings.chatBubbleEnabled}
            chatMode={chatMode}
            greeting={activeGreeting}
            config={config}
            groupChatContinuationMode={groupChatContinuationMode}
            groupUserAttention={groupUserAttention}
            inputValue={inputValue}
            isDragging={Boolean(chatPanelDragState)}
            isInteractiveDialogue={isInteractiveDialogueOpen}
            isGroupChatRunning={isGroupChatRunning}
            isListening={isListening}
            isOpen={isChatOpen}
            isSpeaking={isSpeaking}
            isTyping={isTyping}
            isPrimaryTyping={isPrimaryTyping}
            latestPetMessage={latestPetMessage}
            messages={messages}
            panelOffset={resolvedChatPanelOffset}
            panelPosition={resolvedChatPanelPosition}
            panelSize={chatPanelSize}
            petAnchorPosition={petAnchorPosition}
            petVisualBounds={petVisualBounds}
            petOptions={petOptions}
            personalityName={chatMode === 'group' ? '群聊' : chatMode === 'story' ? '故事' : activePetName}
            showEmbeddedPanel={showEmbeddedChatPanel}
            speakingPetId={speakingPetId}
            dragDisabled={isInteractiveDialogueOpen}
            typingPetName={typingPetName}
            webSearchStatusMessage={webSearchStatusMessage}
            voiceEnabled={voiceEnabled}
            voiceInputEnabled={voiceInputEnabled}
            onClose={closeAllPetPanels}
            onActivePetChange={onActivePetChange}
            onChatModeChange={onChatModeChange}
            onInputChange={onInputChange}
            onPlayMessageVoice={onPlayMessageVoice}
            onResolveAgentApproval={onResolveAgentApproval}
            onResolveGroupUserAttention={onResolveGroupUserAttention}
            onSaveMessageToMemory={onSaveMessageToMemory}
            onSendMessage={onSendMessage}
            onStopAgentRun={onStopAgentRun}
            onStopGroupChat={onStopGroupChat}
            onGroupChatContinuationModeChange={onGroupChatContinuationModeChange}
            onStartDrag={onStartChatPanelDrag}
            onStartResize={onStartChatPanelResize}
            onUpdateConfig={onUpdateConfig}
            onToggleVoiceEnabled={onToggleVoiceEnabled}
            onToggleVoiceInput={onToggleVoiceInput}
          />
        </Suspense>
      )}

      {!useExternalSettingsWindow && isSettingsOpen && (
        <Suspense fallback={null}>
          <SettingsPanel
            isOpen
            resetToken={settingsResetToken}
            anchorRect={shellViewport}
            dockAnchorPosition={petAnchorPosition}
            dockReferenceSize={petVisualSize}
            initialSelectedPetSlotId={settingsInitialSelectedPetSlotId}
            initialTab={settingsInitialTab}
            onClose={closeAllPetPanels}
            config={config}
            onUpdateConfig={onUpdateConfig}
            logs={logs}
            runtimeSummaryByPetId={runtimeSummaryByPetId}
            petVisualSize={petVisualSize}
            screenStream={screenStream}
            screenCaptureOptions={screenCaptureOptions}
            onPreviewCaptureOptionsChange={onPreviewCaptureOptionsChange}
            onStartScreenCapture={onStartScreenCapture}
            onStopScreenCapture={onStopScreenCapture}
            onResetFolders={onResetFolders}
            onSetAction={onSetAction}
          />
        </Suspense>
      )}
    </>
  );
});

PetPanelsLayer.displayName = 'PetPanelsLayer';
