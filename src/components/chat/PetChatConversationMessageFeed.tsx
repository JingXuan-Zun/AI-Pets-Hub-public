import { useCallback, useEffect, useRef, useState } from 'react';
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

export function buildMessageKey(message: ConversationMessage, index: number) {
  return message.id ?? `${message.role}-${index}-${message.text}`;
}

export function resolveSpeakingMessageIndex(
  messages: ConversationMessage[],
  speakingPetId: string | null,
  manualPlaybackKey: string | null,
) {
  if (manualPlaybackKey) {
    const manualIndex = messages.findIndex((message, index) => buildMessageKey(message, index) === manualPlaybackKey);
    if (manualIndex >= 0) return manualIndex;
  }
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
  onPlayMessageVoice?: PetChatConversationMessagesProps['onPlayMessageVoice'];
  showsLatestStoryTurn: boolean;
  speakingMessageIndex: number;
}

function ConversationMessageRow(props: ConversationMessageRowProps) {
  const { conversation, index, message, onPlayMessageVoice, showsLatestStoryTurn, speakingMessageIndex } = props;
  const messageKey = buildMessageKey(message, index);
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
      onPlayMessageVoice={onPlayMessageVoice}
      onResolveAgentApproval={conversation.onResolveAgentApproval}
      onSaveMessageToMemory={conversation.onSaveMessageToMemory}
      onSendMessage={conversation.onSendMessage}
      onStopAgentRun={conversation.onStopAgentRun}
      showVoiceOutputStatus={index === speakingMessageIndex}
    />
  );
}

// A manually replayed message keeps the "playing" badge instead of the speaking pet's latest message,
// until that playback ends (speaking true→false) or a new message arrives and its reply voice takes over.
function useManualPlaybackTarget(isSpeaking: boolean, messageCount: number) {
  const [manualPlaybackKey, setManualPlaybackKey] = useState<string | null>(null);
  const wasSpeakingRef = useRef(isSpeaking);
  const messageCountRef = useRef(messageCount);

  useEffect(() => {
    if (wasSpeakingRef.current && !isSpeaking) setManualPlaybackKey(null);
    wasSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    if (messageCount > messageCountRef.current) setManualPlaybackKey(null);
    messageCountRef.current = messageCount;
  }, [messageCount]);

  const trackManualPlayback = useCallback((messageKey: string) => setManualPlaybackKey(messageKey), []);
  return { manualPlaybackKey, trackManualPlayback };
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
  const { manualPlaybackKey, trackManualPlayback } = useManualPlaybackTarget(
    conversation.isSpeaking,
    visibleMessages.length,
  );
  const speakingMessageIndex = conversation.isSpeaking
    ? resolveSpeakingMessageIndex(visibleMessages, conversation.speakingPetId, manualPlaybackKey)
    : -1;
  const basePlayMessageVoice = conversation.onPlayMessageVoice;
  const storySession = conversation.chatMode === 'story' && !conversation.isTyping
    ? conversation.storySession : null;
  const narrationIndex = storySession ? findLatestStoryNarrationIndex(visibleMessages) : -1;
  return (
    <div className="space-y-4 px-5 pb-5 pt-5">
      {visibleMessages.length === 0 ? (
        <div className="flex justify-center py-8">
          <div className="glass-card max-w-xl rounded-full px-4 py-2 text-center text-xs leading-relaxed text-sky-800">
            {emptyState}
          </div>
        </div>
      ) : null}
      {visibleMessages.map((message, index) => (
        <ConversationMessageRow
          conversation={conversation}
          index={index}
          key={buildMessageKey(message, index)}
          message={message}
          onPlayMessageVoice={basePlayMessageVoice ? (text) => {
            trackManualPlayback(buildMessageKey(message, index));
            return basePlayMessageVoice(text);
          } : undefined}
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
