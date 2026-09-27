import { Suspense, lazy } from 'react';
import { PetChatOverlayBubble } from './PetChatOverlayBubble';
import { type PetChatOverlayProps } from './petChatOverlayTypes';

const EmbeddedPetChatPanel = lazy(() => import('./EmbeddedPetChatPanel'));

export default function PetChatOverlay({
  activePetId,
  chatBracketOuterTextColor,
  chatBubbleEnabled,
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
  isOpen,
  isSpeaking,
  isTyping,
  isPrimaryTyping,
  latestPetMessage,
  messages,
  panelOffset,
  panelPosition,
  panelSize,
  petAnchorPosition,
  petVisualBounds,
  petOptions,
  personalityName,
  showEmbeddedPanel,
  speakingPetId,
  typingPetName = null,
  webSearchStatusMessage = '',
  voiceEnabled,
  voiceInputEnabled,
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
  onStartDrag,
  onStartResize,
  onUpdateConfig,
  onToggleVoiceEnabled,
  onToggleVoiceInput,
}: PetChatOverlayProps) {
  return (
    <>
      {!isInteractiveDialogue && (
        <PetChatOverlayBubble
          chatBracketOuterTextColor={chatBracketOuterTextColor}
          chatBubbleEnabled={chatBubbleEnabled}
          isPrimaryTyping={isPrimaryTyping}
          latestPetMessage={latestPetMessage}
          petAnchorPosition={petAnchorPosition}
          petVisualBounds={petVisualBounds}
          webSearchStatusMessage={webSearchStatusMessage}
        />
      )}

      {showEmbeddedPanel && (
        <Suspense fallback={null}>
          <EmbeddedPetChatPanel
            activePetId={activePetId}
            chatBracketOuterTextColor={chatBracketOuterTextColor}
            chatMode={chatMode}
            dragDisabled={dragDisabled}
            config={config}
            greeting={greeting}
            groupChatContinuationMode={groupChatContinuationMode}
            groupUserAttention={groupUserAttention}
            inputValue={inputValue}
            isDragging={isDragging}
            isInteractiveDialogue={isInteractiveDialogue}
            isGroupChatRunning={isGroupChatRunning}
            isListening={isListening}
            isOpen={isOpen}
            isSpeaking={isSpeaking}
            isTyping={isTyping}
            messages={messages}
            offset={panelOffset}
            petOptions={petOptions}
            personalityName={personalityName}
            position={panelPosition}
            size={panelSize}
            speakingPetId={speakingPetId}
            typingPetName={typingPetName}
            voiceEnabled={voiceEnabled}
            voiceInputEnabled={voiceInputEnabled}
            onClose={onClose}
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
            onStartDrag={onStartDrag}
            onStartResize={onStartResize}
            onUpdateConfig={onUpdateConfig}
            onToggleVoiceEnabled={onToggleVoiceEnabled}
            onToggleVoiceInput={onToggleVoiceInput}
          />
        </Suspense>
      )}
    </>
  );
}
