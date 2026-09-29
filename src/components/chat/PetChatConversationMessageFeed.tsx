import { PRIMARY_DESKTOP_PET_SLOT_ID } from '../../multiPetRoster';
import { PetChatConversationActivityStates } from './PetChatConversationActivityStates';
import { PetChatConversationMessageBubble } from './PetChatConversationMessageBubble';
import { buildConversationEmptyState, filterConversationMessages } from './petChatConversationMessageUtils';
import type { PetChatConversationMessagesProps } from './petChatConversationMessageTypes';
import { StoryTurnContentCard } from './story/StoryTurnContentCard';

type ConversationMessage = PetChatConversationMessagesProps['messages'][number];

function findLatestStoryNarrationIndex(messages: ConversationMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].storyMessageKind === 'narration') return index;
  }
  return -1;
}

function resolveModelMessagePetId(message: ConversationMessage) {
  if (message.storyMessageKind === 'narration') return null;
  return message.role === 'model'
    ? message.petId ?? PRIMARY_DESKTOP_PET_SLOT_ID
    : null;
}

function resolveSpeakingMessageIndex(messages: ConversationMessage[], speakingPetId: string | null) {
  if (!speakingPetId) return -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (resolveModelMessagePetId(messages[index]) === speakingPetId) return index;
  }
  return -1;
}

interface ConversationMessageRowProps {
  conversation: PetChatConversationMessagesProps;
  index: number;
  message: ConversationMessage;
  showsLatestStoryTurn: boolean;
  speakingMessageIndex: number;
}

function ConversationMessageRow(props: ConversationMessageRowProps) {
  const { conversation, index, message, showsLatestStoryTurn, speakingMessageIndex } = props;
  const messageKey = message.id ?? `${message.role}-${index}-${message.text}`;
  const storySession = showsLatestStoryTurn ? conversation.storySession : null;
  if (storySession) {
    return (
      <StoryTurnContentCard
        conversation={conversation}
        message={message}
        messageKey={messageKey}
        session={storySession}
        showVoiceOutputStatus={index === speakingMessageIndex}
      />
    );
  }
  return (
    <PetChatConversationMessageBubble
      chatBracketOuterTextColor={conversation.chatBracketOuterTextColor}
      config={conversation.config}
      message={message}
      messageKey={messageKey}
      onPlayMessageVoice={conversation.onPlayMessageVoice}
      onResolveAgentApproval={conversation.onResolveAgentApproval}
      onSaveMessageToMemory={conversation.onSaveMessageToMemory}
      onSendMessage={conversation.onSendMessage}
      onStopAgentRun={conversation.onStopAgentRun}
      showVoiceOutputStatus={index === speakingMessageIndex}
    />
  );
}

interface PetChatConversationMessageFeedProps {
  conversation: PetChatConversationMessagesProps;
}

export function PetChatConversationMessageFeed({ conversation }: PetChatConversationMessageFeedProps) {
  const visibleMessages = filterConversationMessages(
    conversation.messages,
    conversation.chatMode,
    conversation.activePetId,
  );
  const emptyState = buildConversationEmptyState(
    conversation.greeting,
    conversation.chatMode,
    conversation.petOptions.length,
  );
  const speakingMessageIndex = conversation.isSpeaking
    ? resolveSpeakingMessageIndex(visibleMessages, conversation.speakingPetId)
    : -1;
  const storySession = conversation.chatMode === 'story' && !conversation.isTyping
    ? conversation.storySession : null;
  const narrationIndex = storySession ? findLatestStoryNarrationIndex(visibleMessages) : -1;
  return (
    <div className="space-y-4 px-5 pb-5 pt-5">
      {visibleMessages.length === 0 ? (
        <div className="py-10 text-center font-mono text-[10px] uppercase tracking-tight text-sky-600 opacity-60">
          {emptyState}
        </div>
      ) : null}
      {visibleMessages.map((message, index) => (
        <ConversationMessageRow
          conversation={conversation}
          index={index}
          key={message.id ?? `${message.role}-${index}-${message.text}`}
          message={message}
          showsLatestStoryTurn={Boolean(storySession && index === narrationIndex)}
          speakingMessageIndex={speakingMessageIndex}
        />
      ))}
      <PetChatConversationActivityStates
        activePetName={conversation.activePetName}
        isListening={conversation.isListening}
        isTyping={conversation.isTyping}
        showStatusMessage={conversation.showStatusMessage}
        statusMessage={conversation.statusMessage}
        typingPetName={conversation.typingPetName}
      />
    </div>
  );
}
