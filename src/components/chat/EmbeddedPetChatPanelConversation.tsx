import PetChatConversation from './PetChatConversation';
import { type EmbeddedPetChatPanelProps } from './embeddedPetChatPanelTypes';

type EmbeddedPetChatPanelConversationProps = Pick<
  EmbeddedPetChatPanelProps,
  | 'activePetId'
  | 'chatBracketOuterTextColor'
  | 'chatMode'
  | 'config'
  | 'greeting'
  | 'groupChatContinuationMode'
  | 'groupUserAttention'
  | 'inputValue'
  | 'isDragging'
  | 'isInteractiveDialogue'
  | 'isGroupChatRunning'
  | 'isListening'
  | 'isSpeaking'
  | 'isTyping'
  | 'messages'
  | 'onActivePetChange'
  | 'onChatModeChange'
  | 'onInputChange'
  | 'onPlayMessageVoice'
  | 'onResolveAgentApproval'
  | 'onResolveGroupUserAttention'
  | 'onSaveMessageToMemory'
  | 'onSendMessage'
  | 'onStopAgentRun'
  | 'onStartDrag'
  | 'onStopGroupChat'
  | 'onGroupChatContinuationModeChange'
  | 'onUpdateConfig'
  | 'onToggleVoiceInput'
  | 'petOptions'
  | 'speakingPetId'
  | 'typingPetName'
  | 'voiceInputEnabled'
>;

export function EmbeddedPetChatPanelConversation({
  activePetId,
  chatBracketOuterTextColor,
  chatMode,
  config,
  greeting,
  groupChatContinuationMode,
  groupUserAttention,
  inputValue,
  isDragging,
  isInteractiveDialogue,
  isGroupChatRunning,
  isListening,
  isSpeaking,
  isTyping,
  messages,
  onActivePetChange,
  onChatModeChange,
  onInputChange,
  onPlayMessageVoice,
  onResolveAgentApproval,
  onResolveGroupUserAttention,
  onSaveMessageToMemory,
  onSendMessage,
  onStopAgentRun,
  onStartDrag,
  onStopGroupChat,
  onGroupChatContinuationModeChange,
  onUpdateConfig,
  onToggleVoiceInput,
  petOptions,
  speakingPetId,
  typingPetName = null,
  voiceInputEnabled,
}: EmbeddedPetChatPanelConversationProps) {
  return (
    <PetChatConversation
      className="min-h-0 flex-1"
      activePetId={activePetId}
      chatBracketOuterTextColor={chatBracketOuterTextColor}
      chatMode={chatMode}
      config={config}
      greeting={greeting}
      groupChatContinuationMode={groupChatContinuationMode}
      groupUserAttention={groupUserAttention}
      inputValue={inputValue}
      isGroupChatRunning={isGroupChatRunning}
      isInteractiveDialogue={isInteractiveDialogue}
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
      onStopGroupChat={onStopGroupChat}
      onGroupChatContinuationModeChange={onGroupChatContinuationModeChange}
      onToggleVoiceInput={onToggleVoiceInput}
      onUpdateConfig={onUpdateConfig}
      petOptions={petOptions}
      speakingPetId={speakingPetId}
      typingPetName={typingPetName}
      voiceInputEnabled={voiceInputEnabled}
      scrollPositionKey={`embedded:${chatMode}`}
      showStatusMessage={false}
      composerProps={isInteractiveDialogue ? undefined : { onPointerDown: onStartDrag }}
      composerClassName={[
        isDragging ? 'select-none' : '',
        isInteractiveDialogue ? 'px-6 py-4' : '',
      ].filter(Boolean).join(' ')}
    />
  );
}
