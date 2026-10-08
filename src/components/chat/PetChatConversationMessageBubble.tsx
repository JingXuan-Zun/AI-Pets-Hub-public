import { Brain, MessageSquareText, Play, Volume2 } from 'lucide-react';
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
import { PetChatConversationVoiceUnavailableStatus, VoicePlaybackDots } from './message/MessageVoiceStatus';
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
  const hasMessageText = message.text.trim().length > 0;
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

  return (
    <div
      key={messageKey}
      className={isNarration
        ? 'flex w-full justify-center'
        : `flex max-w-[92%] items-end gap-2 ${message.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}
    >
      {showAvatars && !isNarration && (
        <AvatarBadge avatarUrl={avatarUrl} fallbackText={avatarFallbackText} size={avatarDisplaySize} />
      )}
      <div
        ref={messageContainerRef}
        className={`relative min-w-0 flex flex-col ${isNarration ? 'w-full max-w-4xl items-center' : message.role === 'user' ? 'items-end' : 'items-start'}`}
      >
        <div
          className={isNarration
            ? embeddedStoryNarration
              ? 'relative w-full px-6 py-5 text-left text-[15px] font-normal not-italic leading-8 text-foreground'
              : 'relative w-full rounded-2xl border border-border bg-white/95 px-6 py-5 text-left text-[15px] font-normal not-italic leading-8 text-foreground shadow-[0_12px_30px_rgba(158,84,140,0.12)] backdrop-blur-sm'
            : 'relative w-fit max-w-full rounded-[15px] border border-white/80 bg-white px-4 py-3 text-xs font-medium leading-relaxed text-foreground shadow-[0_10px_28px_rgba(158,84,140,0.14)] backdrop-blur-xl'}
          style={isNarration && embeddedStoryNarration ? undefined
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
          {!isNarration && <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-border pb-2 text-2xs tracking-[0.12em] text-primary">
            <span className="font-semibold">{messageLabel}</span>
            {isModelMessage && !isNarration ? (
              hasVoicePlaybackHandler ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isVoicePlaybackActive}
                  onClick={() => void handlePlayMessageVoice()}
                  className={`h-6 rounded-full border px-2 text-2xs tracking-[0.08em] transition-colors ${
                    isVoicePlaybackActive
                      ? 'border-primary/40 bg-primary/10 text-foreground'
                      : 'border-border bg-muted text-primary hover:bg-primary/10 hover:text-foreground'
                  } disabled:opacity-100`}
                  title={isVoicePlaybackActive ? '当前正在播放语音' : '播放这条回复语音'}
                >
                  {isVoicePlaybackActive ? (
                    <>
                      <Volume2 className="mr-1 h-3 w-3 animate-pulse" />
                      <span className="inline-flex items-center">
                        语音播放
                        <VoicePlaybackDots />
                      </span>
                    </>
                  ) : (
                    <>
                      <Play className="mr-1 h-3 w-3" />
                      播放语音
                    </>
                  )}
                </Button>
              ) : (
                <PetChatConversationVoiceUnavailableStatus />
              )
            ) : null}
          </div>}
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
                  <span style={!segment.isBracketContent && isModelMessage
                    ? { color: chatBracketOuterTextColor }
                    : undefined}
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
          <AgentLoopRunPanel message={message} onStopAgentRun={onStopAgentRun} />
          {!message.agentApproval ? (
            <PetChatAgentRunPanel
              message={message}
              onSendMessage={onSendMessage}
              onStopAgentRun={onStopAgentRun}
            />
          ) : null}
        </div>
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
