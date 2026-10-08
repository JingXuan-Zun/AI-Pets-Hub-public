import { PetChatConversationMessageBubble } from '../PetChatConversationMessageBubble';
import type { PetChatConversationMessagesProps } from '../petChatConversationMessageTypes';
import { StoryStateOverview } from './StoryStateOverview';
import { StoryTurnControls } from './StoryTurnControls';
import { StoryTurnReview } from './StoryTurnReview';
import type { StorySessionState } from './storyTypes';
import { resolveChatBubbleBackgroundStyle } from '../../../chatAppearanceSettings';

type ConversationMessage = PetChatConversationMessagesProps['messages'][number];

interface StoryTurnContentCardProps {
  conversation: PetChatConversationMessagesProps;
  message: ConversationMessage;
  messageKey: string;
  session: StorySessionState;
  showVoiceOutputStatus: boolean;
}

export function StoryTurnContentCard(props: StoryTurnContentCardProps) {
  const { conversation, message, messageKey, session, showVoiceOutputStatus } = props;
  return (
    <>
      <div style={resolveChatBubbleBackgroundStyle(conversation.config.settings.chatBubbleTransparency, 0.95)} className="story-turn-content-card mx-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-[0_12px_30px_rgba(158,84,140,0.12)] backdrop-blur-sm">
        <StoryTurnReview embedded session={session} />
        <PetChatConversationMessageBubble
          chatBracketOuterTextColor={conversation.chatBracketOuterTextColor}
          config={conversation.config}
          embeddedStoryNarration
          message={message}
          messageKey={messageKey}
          onPlayMessageVoice={conversation.onPlayMessageVoice}
          onResolveAgentApproval={conversation.onResolveAgentApproval}
          onSaveMessageToMemory={conversation.onSaveMessageToMemory}
          onSendMessage={conversation.onSendMessage}
          onStopAgentRun={conversation.onStopAgentRun}
          showVoiceOutputStatus={showVoiceOutputStatus}
        />
        <StoryStateOverview embedded participants={conversation.petOptions} session={session} />
      </div>
      <StoryTurnControls
        onChooseAction={conversation.onChooseStoryAction}
        session={session}
      />
    </>
  );
}
