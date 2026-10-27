import { type ComponentProps, useMemo, useRef } from 'react';
import ChatWindow from './components/ChatWindow';
import { saveChatMessageToMemory } from './components/chat/chatMemorySaveUtils';
import { useDesktopPetShellStore } from './desktopShellStore';

type ChatWindowProps = ComponentProps<typeof ChatWindow>;

export default function ChatWindowApp() {
  const shellStore = useDesktopPetShellStore();
  const sharedState = shellStore.sharedState;
  // The store object is rebuilt on every state push (about once a second); handlers read the
  // latest one through a ref so they stay the same functions and memoized bubbles don't redraw.
  const storeRef = useRef(shellStore);
  storeRef.current = shellStore;
  const handlers = useMemo(() => {
    const store = () => storeRef.current;
    return {
      onActivePetChange: ((petId) => store().setActiveChatPet(petId)) as ChatWindowProps['onActivePetChange'],
      onChatModeChange: ((mode) => store().setChatMode(mode)) as ChatWindowProps['onChatModeChange'],
      onClose: () => store().closeChatWindow(),
      onDeleteStory: ((storyId) => store().deleteStory(storyId)) as ChatWindowProps['onDeleteStory'],
      onGroupChatContinuationModeChange: ((mode) => store().setGroupChatContinuationMode(mode)) as ChatWindowProps['onGroupChatContinuationModeChange'],
      onInputChange: ((value) => store().setChatInput(value)) as ChatWindowProps['onInputChange'],
      onPlayMessageVoice: ((text) => store().playChatMessageVoice(text)) as ChatWindowProps['onPlayMessageVoice'],
      onResolveAgentApproval: ((messageId, decision) => store().resolveAgentApproval(messageId, decision)) as ChatWindowProps['onResolveAgentApproval'],
      onResolveGroupUserAttention: ((decision, text) => store().resolveGroupUserAttention(decision, text)) as ChatWindowProps['onResolveGroupUserAttention'],
      onSaveMessageToMemory: ((message, target, groupId) => {
        const { sharedState: latest, updateConfig } = store();
        updateConfig(saveChatMessageToMemory(latest.config, latest.chatState.activePetId, message, target, groupId));
      }) as ChatWindowProps['onSaveMessageToMemory'],
      onSendMessage: ((textOverride, options) => store().sendChatMessage(textOverride, options)) as ChatWindowProps['onSendMessage'],
      onStopAgentRun: ((messageId) => store().stopAgentRun(messageId)) as ChatWindowProps['onStopAgentRun'],
      onStopGroupChat: (() => store().stopGroupChat()) as ChatWindowProps['onStopGroupChat'],
      onToggleVoiceEnabled: (() => store().toggleChatVoiceEnabled()) as ChatWindowProps['onToggleVoiceEnabled'],
      onToggleVoiceInput: (() => store().toggleChatVoiceInput()) as ChatWindowProps['onToggleVoiceInput'],
      onUpdateConfig: ((config, options) => store().updateConfig(config, { persist: options?.persist ?? true })) as ChatWindowProps['onUpdateConfig'],
    };
  }, []);

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
      speakingPetId={sharedState.chatState.speakingPetId}
      statusMessage={sharedState.chatState.statusMessage}
      typingPetId={sharedState.chatState.typingPetId}
      {...handlers}
    />
  );
}
