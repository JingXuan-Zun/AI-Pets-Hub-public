import { ScrollArea } from '../../../components/ui/scroll-area';
import {
  buildChatBackgroundImageStyle,
  buildChatBackgroundOverlayStyle,
  resolveChatBackgroundImageUrl,
} from './chatAppearanceUtils';
import { PetChatConversationMessageFeed } from './PetChatConversationMessageFeed';
import { type PetChatConversationMessagesProps } from './petChatConversationMessageTypes';

export function PetChatConversationMessages(props: PetChatConversationMessagesProps) {
  const backgroundImageUrl = resolveChatBackgroundImageUrl(props.config);
  const backgroundImageStyle = buildChatBackgroundImageStyle(props.config);
  const backgroundOverlayStyle = buildChatBackgroundOverlayStyle(props.config);
  return (
    <div ref={props.scrollRegionRef} className={`relative min-h-0 flex-1 overflow-hidden ${props.isInteractiveDialogue ? 'bg-transparent' : 'bg-white'}`}>
      {backgroundImageUrl && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <img
            alt=""
            src={backgroundImageUrl}
            className="h-full w-full object-cover"
            draggable={false}
            style={backgroundImageStyle}
          />
          <div className="absolute inset-0" style={backgroundOverlayStyle} />
        </div>
      )}
      <ScrollArea className="relative z-10 h-full">
        <PetChatConversationMessageFeed conversation={props} />
      </ScrollArea>
    </div>
  );
}
