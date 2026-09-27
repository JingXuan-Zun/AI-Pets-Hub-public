import { type ComponentProps } from 'react';
import ChatWindow from './components/ChatWindow';
import { saveChatMessageToMemory } from './components/chat/chatMemorySaveUtils';
import { useDesktopPetShellStore } from './desktopShellStore';

export default function ChatWindowApp() {
  const shellStore = useDesktopPetShellStore();
  const sharedState = shellStore.sharedState;
  const handleSaveMessageToMemory: ComponentProps<typeof ChatWindow>['onSaveMessageToMemory'] = (
    message, target, groupId,
  ) => {
    shellStore.updateConfig(saveChatMessageToMemory(
      sharedState.config,
      sharedState.chatState.activePetId,
      message,
      target,
      groupId,
    ));
  };
  const handleUpdateConfig: ComponentProps<typeof ChatWindow>['onUpdateConfig'] = (config, options) => {
    shellStore.updateConfig(config, { persist: options?.persist ?? true });
  };

  return (
    <ChatWindow
      activePetId={sharedState.chatState.activePetId}
      chatMode={sharedState.chatState.chatMode}
      config={sharedState.config}
      groupChatContinuationMode={sharedState.chatState.groupChatContinuationMode}
      groupUserAttention={sharedState.chatState.groupUserAttention}
      inputValue={sharedState.chatState.inputValue}
      interactiveDialogueActive={sharedState.interactiveDialogueActive}
      isGroupChatRunning={sharedState.chatState.isGroupChatRunning}
      isListening={sharedState.chatState.isListening}
      isSpeaking={sharedState.chatState.isSpeaking}
      isTyping={sharedState.chatState.isTyping}
      messages={sharedState.chatState.messages}
      storyLibrary={sharedState.chatState.storyLibrary}
      storySession={sharedState.chatState.storySession}
      onDeleteStory={shellStore.deleteStory}
      speakingPetId={sharedState.chatState.speakingPetId}
      statusMessage={sharedState.chatState.statusMessage}
      typingPetId={sharedState.chatState.typingPetId}
      onUpdateConfig={handleUpdateConfig}
      onClose={() => shellStore.closeChatWindow()}
      onActivePetChange={shellStore.setActiveChatPet}
      onChatModeChange={shellStore.setChatMode}
      onInputChange={shellStore.setChatInput}
      onPlayMessageVoice={(text) => shellStore.playChatMessageVoice(text)}
      onResolveAgentApproval={(messageId, decision) => shellStore.resolveAgentApproval(messageId, decision)}
      onResolveGroupUserAttention={(decision, text) => shellStore.resolveGroupUserAttention(decision, text)}
      onSaveMessageToMemory={handleSaveMessageToMemory}
      onSendMessage={(textOverride, options) => shellStore.sendChatMessage(textOverride, options)}
      onStopAgentRun={shellStore.stopAgentRun}
      onStopGroupChat={shellStore.stopGroupChat}
      onGroupChatContinuationModeChange={shellStore.setGroupChatContinuationMode}
      onToggleVoiceEnabled={shellStore.toggleChatVoiceEnabled}
      onToggleVoiceInput={shellStore.toggleChatVoiceInput}
    />
  );
}
