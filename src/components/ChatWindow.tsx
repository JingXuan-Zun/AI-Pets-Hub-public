import { type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { getChatTargetOptions, resolveActiveChatPetId, resolveActiveChatSlot } from './chat/multiPetChat';
import { type DesktopPetChatSendOptions, type DesktopPetGroupChatContinuationMode, type GroupUserAttention, type GroupUserAttentionDecision } from '../chatState';
import { type ChatAgentApprovalDecision, type ChatMessage, type DesktopPetChatMode, type PetConfig, type PetConfigUpdateHandler } from '../types';
import { Button } from '../../components/ui/button';
import { type ChatMemorySaveHandler } from './chat/chatMemorySaveUtils';
import type { StoryDefinition, StorySessionState } from './chat/story/storyTypes';
import PetChatConversation from './chat/PetChatConversation';
import { StandaloneWindowResizeHandles } from './StandaloneWindowResizeHandles';
import { WindowCompactHandle, WindowFrameControls } from './WindowFrameControls';
import { useStandaloneWindowResize } from '../standaloneWindowResize';
import { useStandaloneWindowDrag } from '../standaloneWindowDrag';
import { useStandaloneWindowCompactFrame } from '../standaloneWindowCompactFrame';
import { capturePetChatScrollPosition } from './chat/usePetChatConversationAutoScroll';

interface ChatWindowProps {
  activePetId: string;
  chatMode: DesktopPetChatMode;
  config: PetConfig;
  groupChatContinuationMode: DesktopPetGroupChatContinuationMode;
  groupUserAttention: GroupUserAttention | null;
  inputValue: string;
  interactiveDialogueActive?: boolean;
  isGroupChatRunning: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  isTyping: boolean;
  messages: ChatMessage[];
  storyLibrary?: StoryDefinition[];
  storySession?: StorySessionState | null;
  onDeleteStory?: (storyId: string) => void;
  speakingPetId?: string | null;
  statusMessage: string;
  typingPetId?: string | null;
  onUpdateConfig?: PetConfigUpdateHandler;
  onClose: () => void;
  onActivePetChange: (petId: string) => void;
  onChatModeChange: (mode: DesktopPetChatMode) => void;
  onInputChange: (value: string) => void;
  onPlayMessageVoice: (text: string) => void;
  onResolveAgentApproval: (messageId: string, decision: ChatAgentApprovalDecision) => void | Promise<void>;
  onResolveGroupUserAttention: (decision: GroupUserAttentionDecision, text?: string) => void | Promise<void>;
  onSaveMessageToMemory?: ChatMemorySaveHandler;
  onSendMessage: (
    textOverride?: string,
    options?: DesktopPetChatSendOptions,
  ) => void;
  onStopAgentRun: (messageId?: string | null) => void;
  onStopGroupChat: () => void;
  onGroupChatContinuationModeChange: (mode: DesktopPetGroupChatContinuationMode) => void;
  onToggleVoiceEnabled: () => void;
  onToggleVoiceInput: () => void;
}

const VOICE_DISABLE_TITLE = '\u5173\u95ed\u8bed\u97f3\u64ad\u62a5';
const VOICE_ENABLE_TITLE = '\u5f00\u542f\u8bed\u97f3\u64ad\u62a5';
const CHAT_WINDOW_MINIMIZE_TITLE = '收纳聊天窗口';
const CHAT_WINDOW_CLOSE_TITLE = '关闭聊天窗口';
const CHAT_WINDOW_EXPAND_TITLE = '展开聊天窗口';

export default function ChatWindow({
  activePetId,
  chatMode,
  config,
  groupChatContinuationMode,
  groupUserAttention,
  inputValue,
  interactiveDialogueActive = false,
  isGroupChatRunning,
  isListening,
  isSpeaking,
  isTyping,
  messages,
  storyLibrary,
  storySession,
  onDeleteStory,
  speakingPetId = null,
  statusMessage,
  typingPetId = null,
  onUpdateConfig,
  onClose,
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
  onToggleVoiceEnabled,
  onToggleVoiceInput,
}: ChatWindowProps) {
  const isInteractiveDialogue = interactiveDialogueActive && chatMode === 'single';
  const noDragRegionStyle = { WebkitAppRegion: 'no-drag' } as CSSProperties;
  const { isResizing, startWindowResize } = useStandaloneWindowResize({
    enabled: true,
    maxHeight: isInteractiveDialogue ? 900 : 1248,
    minHeight: isInteractiveDialogue ? 240 : 480,
    minWidth: isInteractiveDialogue ? 620 : 360,
  });
  const { isDragging, startWindowDrag } = useStandaloneWindowDrag({
    enabled: !isInteractiveDialogue,
  });
  const {
    compactWindow,
    isCompact: isWindowCompact,
    restoreWindow,
  } = useStandaloneWindowCompactFrame();
  const petOptions = getChatTargetOptions(config);
  const resolvedActivePetId = resolveActiveChatPetId(config, activePetId);
  const activePetSlot = resolveActiveChatSlot(config, resolvedActivePetId);
  const activePetName = petOptions.find((option) => option.id === resolvedActivePetId)?.name
    ?? config.personality.name;
  const activeGreeting = activePetSlot?.personality.greeting ?? config.personality.greeting;
  const typingPetName = petOptions.find((option) => option.id === typingPetId)?.name ?? activePetName;
  const chatScrollPositionKey = `standalone:${chatMode}`;
  const stopHeaderControlDrag = (event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation();
  };
  const handleMinimizeWindow = () => {
    capturePetChatScrollPosition(chatScrollPositionKey);
    compactWindow();
  };

  if (isWindowCompact) {
    return (
      <div
        data-desktop-pet-interactive="true"
        className="relative flex h-screen w-screen cursor-grab items-center justify-center overflow-hidden bg-transparent active:cursor-grabbing"
        style={noDragRegionStyle}
        onPointerDown={isInteractiveDialogue ? undefined : startWindowDrag}
      >
        <WindowCompactHandle
          title={CHAT_WINDOW_EXPAND_TITLE}
          onStartDrag={isInteractiveDialogue
            ? undefined
            : (event) => startWindowDrag(event, { allowControl: true })}
          onExpand={restoreWindow}
        />
      </div>
    );
  }

  return (
    <div className={`relative flex h-screen w-screen min-h-0 flex-col overflow-hidden border border-border bg-card text-foreground ${
      isResizing
        ? 'select-none shadow-none'
        : isDragging
          ? 'select-none shadow-none'
          : (isInteractiveDialogue
              ? 'shadow-[0_22px_64px_rgba(15,23,42,0.12)]'
              : 'shadow-[0_28px_80px_rgba(15,23,42,0.16)]')
    }`}>
      <div
        className={`relative shrink-0 flex items-center justify-between border-b border-border bg-card ${
          isInteractiveDialogue
            ? 'px-5 py-3.5'
            : 'px-5 py-3.5'
        }`}
        style={noDragRegionStyle}
        onPointerDown={isInteractiveDialogue ? undefined : startWindowDrag}
      >
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-primary" />
          <span className="text-xs font-semibold tracking-[0.18em] text-foreground">
            {chatMode === 'group'
              ? '群聊 // COMMS'
              : chatMode === 'story' ? '故事 // COMMS' : `${activePetName} // COMMS`}
          </span>
        </div>
        <div className="flex items-center gap-1" style={noDragRegionStyle}>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleVoiceEnabled}
            onPointerDown={stopHeaderControlDrag}
            className="h-8 w-8 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            title={config.settings.voiceEnabled ? VOICE_DISABLE_TITLE : VOICE_ENABLE_TITLE}
          >
            {config.settings.voiceEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
          </Button>
          <WindowFrameControls
            className="-mr-4 ml-2"
            closeTitle={CHAT_WINDOW_CLOSE_TITLE}
            minimizeTitle={CHAT_WINDOW_MINIMIZE_TITLE}
            onClose={onClose}
            onMinimize={handleMinimizeWindow}
          />
        </div>
      </div>

      <PetChatConversation
        className="min-h-0 flex-1"
        activePetId={resolvedActivePetId}
        chatBracketOuterTextColor={config.settings.chatBracketOuterTextColor}
        chatMode={chatMode}
        config={config}
        greeting={activeGreeting}
        groupChatContinuationMode={groupChatContinuationMode}
        groupUserAttention={groupUserAttention}
        inputValue={inputValue}
        isGroupChatRunning={isGroupChatRunning}
        isListening={isListening}
        isSpeaking={isSpeaking}
        isTyping={isTyping}
      messages={messages}
      storyLibrary={storyLibrary}
      storySession={storySession}
      onDeleteStory={onDeleteStory}
        onUpdateConfig={onUpdateConfig}
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
        speakingPetId={speakingPetId}
        onToggleVoiceInput={onToggleVoiceInput}
        petOptions={petOptions}
        showStatusMessage
        statusMessage={statusMessage}
        typingPetName={typingPetName}
        voiceInputEnabled={config.settings.voiceInputEnabled}
        scrollPositionKey={chatScrollPositionKey}
      />
      <StandaloneWindowResizeHandles onStartResize={startWindowResize} />
    </div>
  );
}
