import { type DesktopPetChatSendOptions } from '../../../chatState';
import { type ChatAgentApprovalDecision, type ChatMessage, type PetConfig } from '../../../types';
import { type ChatMemorySaveTarget } from '../chatMemorySaveUtils';

export interface PetChatConversationMessageBubbleProps {
  chatBracketOuterTextColor: string;
  config: PetConfig;
  embeddedStoryNarration?: boolean;
  message: ChatMessage;
  messageKey: string;
  onPlayMessageVoice?: (text: string) => void | Promise<void>;
  onResolveAgentApproval?: (messageId: string, decision: ChatAgentApprovalDecision) => void | Promise<void>;
  onSaveMessageToMemory?: (
    message: ChatMessage, target: ChatMemorySaveTarget, groupId?: string,
  ) => void;
  onSendMessage: (
    textOverride?: string,
    options?: DesktopPetChatSendOptions,
  ) => void | Promise<void>;
  onStopAgentRun?: (messageId?: string | null) => void;
  showVoiceOutputStatus?: boolean;
}
