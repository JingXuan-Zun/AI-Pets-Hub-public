import { Heart, Play, Volume2 } from 'lucide-react';
import { type MouseEvent } from 'react';
import { resolveChatBubbleBackgroundStyle } from '../../../chatAppearanceSettings';
import { PetChatConversationVoiceUnavailableStatus, VoicePlaybackDots } from './MessageVoiceStatus';

function padTime(value: number) {
  return String(value).padStart(2, '0');
}

/** 今天的消息只显示时:分，更早的带上月/日。 */
export function formatMessageTime(createdAt: number | undefined) {
  if (!createdAt || !Number.isFinite(createdAt)) return '';
  const date = new Date(createdAt);
  const time = `${padTime(date.getHours())}:${padTime(date.getMinutes())}`;
  return date.toDateString() === new Date().toDateString()
    ? time
    : `${padTime(date.getMonth() + 1)}/${padTime(date.getDate())} ${time}`;
}

/** 用户气泡用淡粉色，透明度跟随聊天外观里的气泡透明度设置。 */
export function resolveUserBubbleBackgroundStyle(transparency: unknown) {
  const { backgroundColor } = resolveChatBubbleBackgroundStyle(transparency, 1);
  const alpha = Number(/,\s*([\d.]+)\)$/.exec(backgroundColor)?.[1] ?? 1);
  return { backgroundColor: `rgba(248, 222, 238, ${alpha})` };
}

interface MessageMetaRowProps {
  alignEnd: boolean;
  canSaveMemory: boolean;
  hasVoicePlaybackHandler: boolean;
  isMemoryMenuOpen: boolean;
  isModelMessage: boolean;
  isVoicePlaybackActive: boolean;
  timeLabel: string;
  onOpenMemoryMenu: (event: MouseEvent<HTMLButtonElement>) => void;
  onPlayVoice: () => void;
}

/** 气泡下方的一行：时间、播放语音、存到记忆（爱心）。 */
export function MessageMetaRow({
  alignEnd,
  canSaveMemory,
  hasVoicePlaybackHandler,
  isMemoryMenuOpen,
  isModelMessage,
  isVoicePlaybackActive,
  timeLabel,
  onOpenMemoryMenu,
  onPlayVoice,
}: MessageMetaRowProps) {
  if (!timeLabel && !isModelMessage && !canSaveMemory) return null;

  return (
    <div className={`mt-1 flex items-center gap-1.5 px-1 text-2xs text-muted-foreground ${alignEnd ? 'flex-row-reverse' : ''}`}>
      {timeLabel ? <span className="font-mono">{timeLabel}</span> : null}
      {isModelMessage ? (
        hasVoicePlaybackHandler ? (
          <button
            type="button"
            disabled={isVoicePlaybackActive}
            onClick={onPlayVoice}
            className={`inline-flex h-5 items-center rounded-full px-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ${
              isVoicePlaybackActive ? 'bg-primary/15 text-primary' : 'text-primary/80 hover:bg-primary/10 hover:text-primary'
            }`}
            title={isVoicePlaybackActive ? '当前正在播放语音' : '播放这条回复语音'}
            aria-label={isVoicePlaybackActive ? '正在播放语音' : '播放语音'}
          >
            {isVoicePlaybackActive ? (
              <>
                <Volume2 className="h-3 w-3 animate-pulse" />
                <VoicePlaybackDots />
              </>
            ) : <Play className="h-3 w-3" />}
          </button>
        ) : (
          <PetChatConversationVoiceUnavailableStatus />
        )
      ) : null}
      {canSaveMemory ? (
        <button
          type="button"
          onClick={onOpenMemoryMenu}
          className={`inline-flex h-5 w-5 items-center justify-center rounded-full transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ${isMemoryMenuOpen ? 'text-primary' : 'text-primary/60'}`}
          title="存到记忆"
          aria-label="存到记忆"
        >
          <Heart className="h-3 w-3" fill={isMemoryMenuOpen ? 'currentColor' : 'none'} />
        </button>
      ) : null}
    </div>
  );
}
