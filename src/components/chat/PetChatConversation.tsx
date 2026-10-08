import { useEffect, useMemo, useState, type CSSProperties, type HTMLAttributes, type MouseEvent } from 'react';
import { type DesktopPetChatSendOptions, type DesktopPetGroupChatContinuationMode, type GroupUserAttention, type GroupUserAttentionDecision } from '../../chatState';
import { desktopPetChatStore, useDesktopPetChatStore } from '../../chatStore';
import { type ChatAgentApprovalDecision, type ChatMessage, type DesktopPetChatMode, type PetConfig, type PetConfigUpdateHandler } from '../../types';
import { type ChatMemorySaveHandler } from './chatMemorySaveUtils';
import { type ChatTargetOption } from './multiPetChat';
import { isChatSidebarToggleShortcut } from './ChatSidebarToggleButton';
import { PetChatAppearanceMenu } from './PetChatAppearanceMenu';
import { PetChatConversationComposer } from './PetChatConversationComposer';
import { PetChatConversationHeader } from './PetChatConversationHeader';
import { PetChatConversationMessages } from './PetChatConversationMessages';
import { usePetChatConversationAutoScroll } from './usePetChatConversationAutoScroll';
import { usePetChatConversationDraft } from './usePetChatConversationDraft';
import { GroupUserAttentionPrompt } from './group/attention/GroupUserAttentionPrompt';
import { GroupTaskMemoryCandidatePrompt } from './group/memory/GroupTaskMemoryCandidatePrompt';
import { useGroupTaskMemoryCandidateCapture } from './group/memory/useGroupTaskMemoryCandidateCapture';
import { StoryModePanel } from './story/StoryModePanel';
import { NeuralMemoryProposalPanel } from './memory/NeuralMemoryProposalPanel';
import { useNeuralMemoryProposalActions } from './memory/useNeuralMemoryProposalActions';
import { listNeuralMemoryProposals } from '../../neural-memory/neuralMemoryProposalConfig';
import type { StoryDefinition, StorySessionState } from './story/storyTypes';

interface PetChatConversationProps {
  className?: string;
  activePetId: string;
  chatBracketOuterTextColor: string;
  chatMode: DesktopPetChatMode;
  config: PetConfig;
  greeting: string;
  groupChatContinuationMode: DesktopPetGroupChatContinuationMode;
  groupUserAttention?: GroupUserAttention | null;
  inputValue: string;
  isGroupChatRunning: boolean;
  isInteractiveDialogue?: boolean;
  hoistBackground?: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  isTyping: boolean;
  messages: ChatMessage[];
  storyLibrary?: StoryDefinition[];
  storySession?: StorySessionState | null;
  onDeleteStory?: (storyId: string) => void;
  onUpdateConfig?: PetConfigUpdateHandler;
  onActivePetChange: (petId: string) => void;
  onChatModeChange: (mode: DesktopPetChatMode) => void;
  onInputChange: (value: string) => void;
  onPlayMessageVoice?: (text: string) => void | Promise<void>;
  onResolveAgentApproval?: (messageId: string, decision: ChatAgentApprovalDecision) => void | Promise<void>;
  onResolveGroupUserAttention?: (decision: GroupUserAttentionDecision, text?: string) => void | Promise<void>;
  onSaveMessageToMemory?: ChatMemorySaveHandler;
  onSendMessage: (
    textOverride?: string,
    options?: DesktopPetChatSendOptions,
  ) => void | Promise<void>;
  onStopAgentRun?: (messageId?: string | null) => void;
  onStopGroupChat: () => void;
  onGroupChatContinuationModeChange: (mode: DesktopPetGroupChatContinuationMode) => void;
  onToggleVoiceInput: () => void;
  petOptions: ChatTargetOption[];
  showStatusMessage?: boolean;
  speakingPetId?: string | null;
  statusMessage?: string;
  typingPetName?: string | null;
  voiceInputEnabled: boolean;
  scrollPositionKey?: string;
  composerProps?: HTMLAttributes<HTMLDivElement>;
  composerClassName?: string;
  /** When provided, the host owns the sidebar state and renders the toggle in its own title bar. */
  sidebarCollapsed?: boolean;
  onSidebarCollapsedChange?: (isCollapsed: boolean) => void;
}

const APPEARANCE_MENU_SIZE = { width: 344, height: 568 };

function clampAppearanceMenuPosition(x: number, y: number) {
  return {
    x: Math.max(8, Math.min(x + 10, window.innerWidth - APPEARANCE_MENU_SIZE.width - 8)),
    y: Math.max(8, Math.min(y + 10, window.innerHeight - APPEARANCE_MENU_SIZE.height - 8)),
  };
}

export default function PetChatConversation({
  activePetId,
  className = '',
  chatBracketOuterTextColor,
  chatMode,
  config,
  greeting,
  groupChatContinuationMode,
  groupUserAttention = null,
  inputValue,
  isGroupChatRunning,
  isInteractiveDialogue = false,
  hoistBackground = false,
  isListening,
  isSpeaking,
  isTyping,
  messages,
  storyLibrary: externalStoryLibrary,
  storySession: externalStorySession,
  onDeleteStory: externalDeleteStory,
  onUpdateConfig,
  onActivePetChange,
  onChatModeChange,
  onInputChange,
  onPlayMessageVoice,
  onResolveAgentApproval,
  onResolveGroupUserAttention,
  onSaveMessageToMemory,
  onSendMessage,
  onStopAgentRun,
  onStopGroupChat,
  onGroupChatContinuationModeChange,
  onToggleVoiceInput,
  petOptions,
  showStatusMessage = true,
  speakingPetId = null,
  statusMessage = '',
  typingPetName = null,
  voiceInputEnabled,
  scrollPositionKey = chatMode,
  composerProps,
  composerClassName = '',
  sidebarCollapsed,
  onSidebarCollapsedChange,
}: PetChatConversationProps) {
  const { scrollRegionRef } = usePetChatConversationAutoScroll({
    isTyping,
    lastMessageText: messages[messages.length - 1]?.text,
    messageCount: messages.length,
    storageKey: scrollPositionKey,
  });
  const {
    addDraftAttachments,
    agentMode,
    browserSearchMode,
    commitInputValue,
    draftAttachments,
    draftValue,
    flushAndSendMessage,
    inputSyncFrameRef,
    removeDraftAttachment,
    scheduleInputSync,
    setAgentMode,
    setBrowserSearchMode,
    setDraftValue,
  } = usePetChatConversationDraft({
    inputValue,
    onInputChange,
    onSendMessage,
  });
  const [appearanceMenuPosition, setAppearanceMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [localSidebarCollapsed, setLocalSidebarCollapsed] = useState(false);
  const isSidebarControlled = sidebarCollapsed !== undefined && Boolean(onSidebarCollapsedChange);
  const isTargetSelectorCollapsed = isSidebarControlled ? sidebarCollapsed : localSidebarCollapsed;
  const setIsTargetSelectorCollapsed = isSidebarControlled ? onSidebarCollapsedChange! : setLocalSidebarCollapsed;
  const [isStorySetupOpen, setIsStorySetupOpen] = useState(false);
  const [storySetupDraft, setStorySetupDraft] = useState<StoryDefinition | null>(null);
  const localChatStore = useDesktopPetChatStore();
  const storyLibrary = externalStoryLibrary ?? localChatStore.storyLibrary;
  const storySession = externalStorySession === undefined ? localChatStore.storySession : externalStorySession;
  const canEditAppearance = Boolean(onUpdateConfig);
  const activePetName = petOptions.find((option) => option.id === activePetId)?.name ?? petOptions[0]?.name ?? '桌宠';
  const activeStoryDefinition = useMemo(
    () => [...messages].reverse().find((message) => (
      message.chatMode === 'story' && message.storyDefinition
    ))?.storyDefinition ?? null,
    [messages],
  );
  const rootStyle = useMemo(() => ({ WebkitAppRegion: 'no-drag' } as CSSProperties), []);
  const memoryProposalActions = useNeuralMemoryProposalActions({ config, onUpdateConfig });
  const pendingMemoryProposals = listNeuralMemoryProposals(config);
  const pendingMemoryProposalCountByPetId = pendingMemoryProposals.reduce<Record<string, number>>(
    (counts, proposal) => ({ ...counts, [proposal.roleId]: (counts[proposal.roleId] ?? 0) + 1 }),
    {},
  );
  const taskMemoryCandidate = useGroupTaskMemoryCandidateCapture({
    config,
    messages,
    onUpdateConfig,
  });

  useEffect(() => {
    if (chatMode === 'story') setIsTargetSelectorCollapsed(true);
    if (chatMode !== 'story') {
      setIsStorySetupOpen(false);
      setStorySetupDraft(null);
    }
  }, [chatMode]);

  useEffect(() => {
    if (isInteractiveDialogue) return undefined;
    const toggleSidebarFromShortcut = (event: KeyboardEvent) => {
      if (event.repeat || !isChatSidebarToggleShortcut(event)) return;
      event.preventDefault();
      setIsTargetSelectorCollapsed(!isTargetSelectorCollapsed);
    };
    window.addEventListener('keydown', toggleSidebarFromShortcut);
    return () => window.removeEventListener('keydown', toggleSidebarFromShortcut);
  }, [isInteractiveDialogue, isTargetSelectorCollapsed, setIsTargetSelectorCollapsed]);

  useEffect(() => {
    if (externalStorySession !== undefined || chatMode !== 'story' || storySession || !activeStoryDefinition) return;
    desktopPetChatStore.startStorySession(activeStoryDefinition);
  }, [activeStoryDefinition, chatMode, externalStorySession, storySession]);

  useEffect(() => {
    if (!appearanceMenuPosition) {
      return undefined;
    }

    const closeMenu = () => {
      setAppearanceMenuPosition(null);
    };
    const closeMenuFromPointer = (event: PointerEvent) => {
      const targetElement = event.target as HTMLElement | null;
      if (targetElement?.closest('[data-chat-appearance-menu="true"]')) {
        return;
      }

      closeMenu();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };

    window.addEventListener('pointerdown', closeMenuFromPointer, true);
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      window.removeEventListener('pointerdown', closeMenuFromPointer, true);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [appearanceMenuPosition]);

  const mergedComposerClassName = [
    isInteractiveDialogue
      ? 'shrink-0 flex gap-2 border-t border-white/15 bg-black/25 px-5 py-3 text-white'
      : 'mx-3 mb-3 shrink-0 flex gap-2 rounded-2xl border border-white/70 glass-bar px-4 py-3 text-sky-900 shadow-[0_10px_30px_rgba(158,84,140,0.12)]',
    composerClassName,
  ].filter(Boolean).join(' ');

  const handleContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    if (!canEditAppearance) {
      return;
    }

    const targetElement = event.target as HTMLElement | null;
    if (targetElement?.closest('input, textarea, button, [contenteditable="true"]')) {
      return;
    }

    event.preventDefault();
    setAppearanceMenuPosition(clampAppearanceMenuPosition(event.clientX, event.clientY));
  };

  return (
    <div className={`relative flex h-full min-h-0 flex-1 flex-col ${className}`} style={rootStyle} onContextMenu={handleContextMenu}>
      <div className="relative flex h-full min-h-0 flex-1">
        {!isInteractiveDialogue && (
          <div className="relative z-20 shrink-0 bg-inherit">
            <PetChatConversationHeader
              activePetId={activePetId}
              activeStoryDefinition={isStorySetupOpen ? null : activeStoryDefinition}
              chatMode={chatMode}
              config={config}
              groupChatContinuationMode={groupChatContinuationMode}
              isTargetSelectorCollapsed={isTargetSelectorCollapsed}
              isGroupChatRunning={isGroupChatRunning}
              messages={messages}
              onActivePetChange={onActivePetChange}
              onChatModeChange={onChatModeChange}
              onCreateStory={() => {
                setStorySetupDraft(null);
                setIsStorySetupOpen(true);
              }}
              onGroupChatContinuationModeChange={onGroupChatContinuationModeChange}
              onStopGroupChat={onStopGroupChat}
              onTargetSelectorCollapsedChange={setIsTargetSelectorCollapsed}
              onViewStory={() => {
                if (!activeStoryDefinition) return;
                setStorySetupDraft(activeStoryDefinition);
                setIsStorySetupOpen(true);
              }}
              petOptions={petOptions}
              showSidebarToggle={!isSidebarControlled}
              pendingMemoryProposalCountByPetId={pendingMemoryProposalCountByPetId}
              memoryProposalPanel={onUpdateConfig ? (
                <NeuralMemoryProposalPanel
                  busyProposalId={memoryProposalActions.busyProposalId}
                  message={memoryProposalActions.message}
                  proposals={pendingMemoryProposals.filter((proposal) => proposal.roleId === activePetId)}
                  onApprove={(proposal, content) => void memoryProposalActions.approve(proposal, content)}
                  onDismiss={memoryProposalActions.dismiss}
                />
              ) : null}
            />
          </div>
        )}
        <div className="relative flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
          {chatMode === 'story' && (!activeStoryDefinition || isStorySetupOpen) ? (
            <div className="relative min-h-0 min-w-0 flex-1 basis-0 overflow-clip">
              <StoryModePanel
                config={config}
                initialDraft={storySetupDraft}
                storyLibrary={storyLibrary}
                onCancel={() => {
                  setStorySetupDraft(null);
                  setIsStorySetupOpen(false);
                }}
                onDeleteStory={(story) => (externalDeleteStory ?? desktopPetChatStore.deleteStory)(story.id)}
                onSendMessage={onSendMessage}
                onStarted={() => {
                  setStorySetupDraft(null);
                  setIsStorySetupOpen(false);
                }}
                participants={petOptions.map((option) => ({ id: option.id, name: option.name }))}
              />
            </div>
          ) : (
            <>
          <PetChatConversationMessages
            activePetId={activePetId}
            activePetName={activePetName}
            chatMode={chatMode}
            chatBracketOuterTextColor={chatBracketOuterTextColor}
            config={config}
            greeting={greeting}
            isInteractiveDialogue={isInteractiveDialogue}
            hoistBackground={hoistBackground}
            isListening={isListening}
            isSpeaking={isSpeaking}
            isTyping={isTyping}
            messages={messages}
            onPlayMessageVoice={onPlayMessageVoice}
            onChooseStoryAction={(action) => {
              setDraftValue(action);
              scheduleInputSync(action);
            }}
            onResolveAgentApproval={onResolveAgentApproval}
            onSaveMessageToMemory={onSaveMessageToMemory}
            onSendMessage={onSendMessage}
            onStopAgentRun={onStopAgentRun}
            petOptions={petOptions}
            scrollRegionRef={scrollRegionRef}
            showStatusMessage={showStatusMessage}
            speakingPetId={speakingPetId}
            statusMessage={statusMessage}
            storySession={storySession}
            typingPetName={typingPetName}
          />
          {groupUserAttention && onResolveGroupUserAttention ? (
            <GroupUserAttentionPrompt
              attention={groupUserAttention}
              onResolve={onResolveGroupUserAttention}
            />
          ) : null}
          {taskMemoryCandidate.notice ? (
            <GroupTaskMemoryCandidatePrompt
              notice={taskMemoryCandidate.notice}
              onApprove={taskMemoryCandidate.approve}
              onIgnore={taskMemoryCandidate.ignore}
              repository={config.groupMemoryRepository}
            />
          ) : null}
          <PetChatConversationComposer
            activePetName={activePetName}
            chatMode={chatMode}
            commitInputValue={commitInputValue}
            composerClassName={mergedComposerClassName}
            composerProps={composerProps}
            config={config}
            draftAttachments={draftAttachments}
            draftValue={draftValue}
            agentMode={agentMode}
            browserSearchMode={browserSearchMode}
            flushAndSendMessage={flushAndSendMessage}
            inputSyncFrameRef={inputSyncFrameRef}
            isListening={isListening}
            onAddDraftAttachments={addDraftAttachments}
            onRemoveDraftAttachment={removeDraftAttachment}
            onToggleVoiceInput={onToggleVoiceInput}
            petOptions={petOptions}
            scheduleInputSync={scheduleInputSync}
            setAgentMode={setAgentMode}
            setDraftValue={setDraftValue}
            setBrowserSearchMode={setBrowserSearchMode}
            voiceInputEnabled={voiceInputEnabled}
          />
            </>
          )}
        </div>
      </div>
      {appearanceMenuPosition && onUpdateConfig && (
        <PetChatAppearanceMenu
          activePetId={activePetId}
          config={config}
          menuPosition={appearanceMenuPosition}
          onClose={() => setAppearanceMenuPosition(null)}
          onUpdateConfig={onUpdateConfig}
        />
      )}
    </div>
  );
}
