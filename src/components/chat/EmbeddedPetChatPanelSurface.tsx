import { motion } from 'motion/react';
import { WindowCompactHandle } from '../WindowFrameControls';
import { EmbeddedPetChatPanelConversation } from './EmbeddedPetChatPanelConversation';
import { EmbeddedPetChatPanelHeader } from './EmbeddedPetChatPanelHeader';
import { EmbeddedPetChatPanelResizeHandles } from './EmbeddedPetChatPanelResizeHandles';
import { type EmbeddedPetChatPanelProps } from './embeddedPetChatPanelTypes';

type EmbeddedPetChatPanelSurfaceProps = Omit<
  EmbeddedPetChatPanelProps,
  'isOpen' | 'offset' | 'position'
> & {
  isMinimized: boolean;
  onToggleMinimized: () => void;
};

const EMBEDDED_CHAT_COMPACT_HEIGHT = 48;
const EMBEDDED_CHAT_COMPACT_WIDTH = 56;

export function EmbeddedPetChatPanelSurface({
  activePetId,
  chatBracketOuterTextColor,
  chatMode,
  dragDisabled,
  config,
  greeting,
  groupChatContinuationMode,
  groupUserAttention,
  inputValue,
  isDragging,
  isInteractiveDialogue,
  isGroupChatRunning,
  isListening,
  isMinimized,
  isSpeaking,
  isTyping,
  messages,
  onActivePetChange,
  onChatModeChange,
  onClose,
  onInputChange,
  onPlayMessageVoice,
  onResolveAgentApproval,
  onResolveGroupUserAttention,
  onSaveMessageToMemory,
  onSendMessage,
  onStopAgentRun,
  onStartDrag,
  onStartResize,
  onStopGroupChat,
  onGroupChatContinuationModeChange,
  onUpdateConfig,
  onToggleVoiceEnabled,
  onToggleVoiceInput,
  onToggleMinimized,
  petOptions,
  personalityName,
  size,
  speakingPetId,
  typingPetName = null,
  voiceEnabled,
  voiceInputEnabled,
}: EmbeddedPetChatPanelSurfaceProps) {
  const frameStyle = {
    width: isMinimized ? EMBEDDED_CHAT_COMPACT_WIDTH : isInteractiveDialogue ? '78vw' : size.width,
    height: isMinimized ? EMBEDDED_CHAT_COMPACT_HEIGHT : isInteractiveDialogue ? 236 : size.height,
    maxWidth: isInteractiveDialogue ? 1100 : undefined,
    minWidth: isInteractiveDialogue ? 620 : undefined,
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 10 }}
      style={frameStyle}
      className={`relative flex min-h-0 flex-col overflow-hidden border border-sky-100/85 bg-[linear-gradient(180deg,rgba(158,84,140,0.72),rgba(158,84,140,0.86))] shadow-[0_28px_80px_rgba(158,84,140,0.35)] backdrop-blur-2xl ${isInteractiveDialogue ? 'rounded-[18px] border-white/20' : 'rounded-[30px] bg-[linear-gradient(180deg,rgba(245,250,255,0.98),rgba(233,243,252,0.95))]'}`}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {!dragDisabled && !isMinimized && !isInteractiveDialogue ? (
        <div className="pointer-events-none absolute left-[-16px] top-[132px] h-9 w-9 rotate-45 border-l border-t border-sky-100/80 bg-[linear-gradient(135deg,rgba(252,254,255,0.92),rgba(236,245,253,0.84))]" />
      ) : null}
      {isMinimized ? (
        <WindowCompactHandle
          title="展开聊天面板"
          onStartDrag={dragDisabled ? undefined : (event) => onStartDrag(event, { allowControl: true })}
          onExpand={onToggleMinimized}
        />
      ) : (
        <>
          {!isInteractiveDialogue && (
            <EmbeddedPetChatPanelHeader
            dragDisabled={dragDisabled}
            isMinimized={isMinimized}
            personalityName={personalityName}
            voiceEnabled={voiceEnabled}
            onClose={onClose}
            onStartDrag={onStartDrag}
            onToggleMinimized={onToggleMinimized}
            onToggleVoiceEnabled={onToggleVoiceEnabled}
          />
          )}
          <EmbeddedPetChatPanelConversation
            activePetId={activePetId}
            chatBracketOuterTextColor={chatBracketOuterTextColor}
            chatMode={chatMode}
            config={config}
            greeting={greeting}
            groupChatContinuationMode={groupChatContinuationMode}
            groupUserAttention={groupUserAttention}
            inputValue={inputValue}
            isDragging={isDragging}
            isInteractiveDialogue={isInteractiveDialogue}
            isGroupChatRunning={isGroupChatRunning}
            isListening={isListening}
            isSpeaking={isSpeaking}
            isTyping={isTyping}
            messages={messages}
            onActivePetChange={onActivePetChange}
            onChatModeChange={onChatModeChange}
            onInputChange={onInputChange}
            onPlayMessageVoice={onPlayMessageVoice}
            onResolveAgentApproval={onResolveAgentApproval}
            onResolveGroupUserAttention={onResolveGroupUserAttention}
            onSaveMessageToMemory={onSaveMessageToMemory}
            onSendMessage={onSendMessage}
            onStopAgentRun={onStopAgentRun}
            onStartDrag={onStartDrag}
            onStopGroupChat={onStopGroupChat}
            onGroupChatContinuationModeChange={onGroupChatContinuationModeChange}
            onUpdateConfig={onUpdateConfig}
            onToggleVoiceInput={onToggleVoiceInput}
            petOptions={petOptions}
            speakingPetId={speakingPetId}
            typingPetName={typingPetName}
            voiceInputEnabled={voiceInputEnabled}
          />
          {!isInteractiveDialogue && (
            <EmbeddedPetChatPanelResizeHandles onStartResize={onStartResize} />
          )}
        </>
      )}
    </motion.div>
  );
}
