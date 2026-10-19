import { Brain, MessageSquareText } from 'lucide-react';
import { Fragment, memo, useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { resolveChatBubbleBackgroundStyle, resolveChatMessageTextStyle } from '../../chatAppearanceSettings';
import { resolveChatAvatarDisplaySize, resolveChatMessageAvatarUrl } from './chatAppearanceUtils';
import { type ChatMemorySaveTarget } from './chatMemorySaveUtils';
import { GroupMemoryCandidateSaveButton } from './group/memory/GroupMemoryCandidateSaveButton';
import { GroupMemorySaveButton } from './group/memory/GroupMemorySaveButton';
import { PetChatAgentApprovalPanel } from './message/AgentMessageApprovalPanel';
import { PetChatAgentRunPanel } from './message/AgentMessageRunPanel';
import { AgentLoopRunPanel } from './message/AgentLoopRunPanel';
import { AvatarBadge, OrderedMessageContent, PetChatMessageImageAttachments } from './message/MessageContent';
import { type PetChatConversationMessageBubbleProps } from './message/messageContentTypes';
import { clampMemoryMenuPosition, isPointInsideElement, isPromiseLike, resolveAvatarFallbackText, resolveModelMessagePetId, splitMessageTextByBrackets, type MemoryMenuPosition } from './message/messageTextUtils';
import { formatMessageTime, MessageMetaRow, resolveUserBubbleBackgroundStyle } from './message/MessageMetaRow';
import { resolveConversationMessageLabel } from './petChatConversationMessageUtils';
import { StoryNarrativeText } from './story/StoryNarrativeText';

function PetChatConversationMessageBubbleComponent({
  chatBracketOuterTextColor,
  config,
  embeddedStoryNarration = false,
  message,
  messageKey,
  onPlayMessageVoice,
  onResolveAgentApproval,
  onSaveMessageToMemory,
  onSendMessage,
  onStopAgentRun,
  showVoiceOutputStatus = false,
}: PetChatConversationMessageBubbleProps) {
  const messageContainerRef = useRef<HTMLDivElement | null>(null);
  const memoryMenuRef = useRef<HTMLDivElement | null>(null);
  const textSegments = splitMessageTextByBrackets(message.text);
  // A task card's text is a record for the conversation history; the card itself is shown instead.
  const hasMessageText = message.text.trim().length > 0 && !message.agentLoopRun;
  const canSaveMemory = Boolean(onSaveMessageToMemory && message.text.trim());
  const showAvatars = config.settings.chatAvatarsEnabled;
  const avatarDisplaySize = resolveChatAvatarDisplaySize(config);
  const avatarUrl = resolveChatMessageAvatarUrl(config, message);
  const avatarFallbackText = resolveAvatarFallbackText(message, config);
  const messageLabel = resolveConversationMessageLabel(message, config);
  const isModelMessage = message.role === 'model';
  const hasOrderedContent = isModelMessage && Boolean(message.content?.length);
  const isNarration = message.storyMessageKind === 'narration';
  const hasVoicePlaybackHandler = Boolean(onPlayMessageVoice);
  const shouldShowVoiceOutputStatus = Boolean(
    showVoiceOutputStatus
      && isModelMessage
      && !isNarration
      && resolveModelMessagePetId(message),
  );
  const [isManualPlaybackPending, setIsManualPlaybackPending] = useState(false);
  const [isMemoryMenuOpen, setIsMemoryMenuOpen] = useState(false);
  const [memoryMenuPosition, setMemoryMenuPosition] = useState<MemoryMenuPosition>({ x: 0, y: 0 });
  const isVoicePlaybackActive = shouldShowVoiceOutputStatus || isManualPlaybackPending;

  useEffect(() => {
    if (!isMemoryMenuOpen) {
      return;
    }

    const closeMenu = () => setIsMemoryMenuOpen(false);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };
    const closeAfterLeavingMessageAndMenu = (event: PointerEvent) => {
      const isInsideMessage = isPointInsideElement(messageContainerRef.current, event.clientX, event.clientY);
      const isInsideMenu = isPointInsideElement(memoryMenuRef.current, event.clientX, event.clientY);

      if (!isInsideMessage && !isInsideMenu) {
        closeMenu();
      }
    };

    window.addEventListener('pointerdown', closeMenu);
    window.addEventListener('pointermove', closeAfterLeavingMessageAndMenu);
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      window.removeEventListener('pointerdown', closeMenu);
      window.removeEventListener('pointermove', closeAfterLeavingMessageAndMenu);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isMemoryMenuOpen]);

  const saveMessageToMemory = (target: ChatMemorySaveTarget, groupId?: string) => {
    onSaveMessageToMemory?.(message, target, groupId);
    setIsMemoryMenuOpen(false);
  };

  const handlePlayMessageVoice = async () => {
    if (!onPlayMessageVoice || isManualPlaybackPending) {
      return;
    }

    setIsManualPlaybackPending(true);

    try {
      const playbackResult = onPlayMessageVoice(message.text);

      if (isPromiseLike(playbackResult)) {
        await playbackResult;
      } else {
        await new Promise((resolve) => {
          window.setTimeout(resolve, 280);
        });
      }
    } finally {
      setIsManualPlaybackPending(false);
    }
  };

  const isUserMessage = message.role === 'user';
  const timeLabel = formatMessageTime(message.createdAt);
  // 单聊只有一个角色，名字不必占位置；群聊里要分清是谁在说话。
  const showSpeakerName = !isNarration && message.chatMode === 'group';
  // A conversation step the user already answered shrinks to one quiet line; several of
  // them in a task used to stack full cards and push the conversation out of view.
  const settledLoopApproval = message.id?.startsWith('agent-loop-approval') && message.agentApproval
    && ['approved', 'denied', 'failed'].includes(message.agentApproval.status)
    ? message.agentApproval
    : null;
  if (settledLoopApproval) {
    const statusLabel = settledLoopApproval.status === 'approved' ? '✓ 已允许：' : settledLoopApproval.status === 'denied' ? '✕ 已拒绝：' : '· 已失效：';
    return (
      <div key={messageKey} className="max-w-[92%] self-start px-1 text-2xs text-muted-foreground" title={settledLoopApproval.plan.goal}>
        <span className="block truncate">{statusLabel}{settledLoopApproval.plan.goal}</span>
      </div>
    );
  }

  return (
    <div
      key={messageKey}
      className={isNarration
        ? 'flex w-full justify-center'
        : `flex max-w-[92%] items-start gap-2.5 ${isUserMessage ? 'self-end flex-row-reverse' : 'self-start'}`}
    >
      {showAvatars && !isNarration && (
        <AvatarBadge avatarUrl={avatarUrl} fallbackText={avatarFallbackText} size={avatarDisplaySize} />
      )}
      <div
        ref={messageContainerRef}
        aria-label={isNarration ? undefined : `${messageLabel}的消息`}
        className={`relative min-w-0 flex flex-col ${isNarration ? 'w-full max-w-4xl items-center' : isUserMessage ? 'items-end' : 'items-start'}`}
      >
        {showSpeakerName ? (
          <div className="mb-1 px-1 text-2xs font-semibold text-primary">{messageLabel}</div>
        ) : null}
        <div
          className={isNarration
            ? embeddedStoryNarration
              ? 'relative w-full px-6 py-5 text-left text-[15px] font-normal not-italic leading-8 text-foreground'
              : 'relative w-full rounded-2xl border border-border bg-white/95 px-6 py-5 text-left text-[15px] font-normal not-italic leading-8 text-foreground shadow-[0_12px_30px_rgba(158,84,140,0.12)] backdrop-blur-sm'
            : `relative w-fit max-w-full rounded-[15px] border px-4 py-3 text-xs font-medium leading-relaxed text-foreground shadow-[0_8px_22px_rgba(158,84,140,0.12)] backdrop-blur-xl ${
              isUserMessage ? 'border-white/70' : 'border-white/80 bg-white'
            }`}
          style={isNarration && embeddedStoryNarration ? undefined
            : isUserMessage
              ? resolveUserBubbleBackgroundStyle(config.settings.chatBubbleTransparency)
              : resolveChatBubbleBackgroundStyle(config.settings.chatBubbleTransparency, isNarration ? 0.95 : 1)}
          onContextMenu={(event) => {
            if (!canSaveMemory) {
              return;
            }

            event.preventDefault();
            event.stopPropagation();
            setMemoryMenuPosition(clampMemoryMenuPosition(event.clientX, event.clientY));
            setIsMemoryMenuOpen(true);
          }}
          title={canSaveMemory ? '右键可保存到记忆库' : undefined}
        >
          <PetChatMessageImageAttachments attachments={message.attachments} />
          {(hasMessageText || hasOrderedContent) && (
            <div
              className={`whitespace-pre-wrap break-words ${message.attachments?.length ? 'mt-2' : ''}`}
              style={resolveChatMessageTextStyle(config.settings.chatFontSize, config.settings.chatFontWeight)}
            >
              {isNarration ? (
                <StoryNarrativeText
                  dialogueColor={chatBracketOuterTextColor}
                  text={message.text}
                />
              ) : hasOrderedContent ? (
                <OrderedMessageContent color={chatBracketOuterTextColor} content={message.content!} messageKey={messageKey} />
              ) : textSegments.map((segment, index) => (
                <Fragment key={`${messageKey}-segment-${index}`}>
                  <span style={{
                    ...(!segment.isBracketContent && isModelMessage ? { color: chatBracketOuterTextColor } : {}),
                    ...(segment.bold ? { fontWeight: 700 } : {}),
                  }}
                  >{segment.text}</span>
                </Fragment>
              ))}
            </div>
          )}
          <PetChatAgentApprovalPanel
            message={message}
            onResolveAgentApproval={onResolveAgentApproval}
            onSendMessage={onSendMessage}
            onStopAgentRun={onStopAgentRun}
          />
          <AgentLoopRunPanel message={message} onResolveAgentApproval={onResolveAgentApproval} onStopAgentRun={onStopAgentRun} />
          {!message.agentApproval ? (
            <PetChatAgentRunPanel
              message={message}
              onSendMessage={onSendMessage}
              onStopAgentRun={onStopAgentRun}
            />
          ) : null}
        </div>
        {!isNarration ? (
          <MessageMetaRow
            alignEnd={isUserMessage}
            canSaveMemory={canSaveMemory}
            hasVoicePlaybackHandler={hasVoicePlaybackHandler}
            isMemoryMenuOpen={isMemoryMenuOpen}
            isModelMessage={isModelMessage}
            isVoicePlaybackActive={isVoicePlaybackActive}
            timeLabel={timeLabel}
            onOpenMemoryMenu={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setMemoryMenuPosition(clampMemoryMenuPosition(rect.left, rect.bottom));
              setIsMemoryMenuOpen(true);
            }}
            onPlayVoice={() => void handlePlayMessageVoice()}
          />
        ) : null}
        {canSaveMemory && isMemoryMenuOpen && (
          <div
            ref={memoryMenuRef}
            className="fixed z-max flex gap-1 rounded-full border border-border bg-white/95 p-1 shadow-[0_14px_30px_rgba(148,163,184,0.16)]"
            style={{
              left: memoryMenuPosition.x,
              top: memoryMenuPosition.y,
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {message.chatMode === 'group' ? (
              <>
                <GroupMemoryCandidateSaveButton
                  onSave={() => saveMessageToMemory('groupMemoryCandidate')}
                />
                <GroupMemorySaveButton
                  onSave={(groupId) => saveMessageToMemory('groupMemory', groupId)}
                  repository={config.groupMemoryRepository}
                />
              </>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => saveMessageToMemory('roleMemory')}
              className="h-7 rounded-full px-2 text-2xs text-primary hover:bg-muted hover:text-foreground"
              title="存入角色记忆库"
            >
              <Brain className="mr-1 h-3 w-3" />
              角色记忆
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => saveMessageToMemory('chatMemory')}
              className="h-7 rounded-full px-2 text-2xs text-primary hover:bg-muted hover:text-foreground"
              title="存入聊天记忆库"
            >
              <MessageSquareText className="mr-1 h-3 w-3" />
              聊天记忆
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export const PetChatConversationMessageBubble = memo(PetChatConversationMessageBubbleComponent);

PetChatConversationMessageBubble.displayName = 'PetChatConversationMessageBubble';
