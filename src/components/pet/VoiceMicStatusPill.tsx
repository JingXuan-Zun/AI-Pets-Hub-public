import { useEffect, useRef } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { useDesktopPetChatStore } from '../../chatStore';
import { useScreenWatchState } from '../../life-companion/screen-watch/screenWatchStore';
import { useVoiceMicStatus, voiceMicStatusStore } from '../../voice/voiceMicStatus';

const SHELL_BOTTOM_GAP = 8;
// The screen-watch pill sits under slot 1; the mic pill goes below it when both show.
const WATCH_PILL_HEIGHT = 34;

/**
 * Mic status under the selected character: waiting for a wake phrase, listening, or the
 * character's turn — with one click to end the conversation or switch wake listening off.
 * Follows the character's shell every frame because walking does not re-render this layer.
 */
export function VoiceMicStatusPill(props: {
  ownerId: string;
  /** Horizontal shift from the shell center to the drawn model's center (slot 1 only). */
  centerShift?: number;
  /** From the shell's top to just below the model's feet (slot 1 only); else the shell bottom is used. */
  offsetBelowTop?: number;
  onDisableWake: () => void;
}) {
  const mic = useVoiceMicStatus();
  const { isListening, isSpeaking, isTyping } = useDesktopPetChatStore();
  const watch = useScreenWatchState();
  const ref = useRef<HTMLDivElement>(null);
  const visible = mic.conversationActive || mic.wakeListening;
  const watchPillShown = props.ownerId === 'primary' && (watch.asking || watch.watching);
  const { centerShift = 0, offsetBelowTop, ownerId } = props;

  useEffect(() => {
    if (!visible) return undefined;
    let frame = 0;
    const follow = () => {
      const pill = ref.current;
      const shell = document.querySelector<HTMLElement>(`[data-desktop-pet-owner-id="${ownerId}"]`);
      const parent = pill?.offsetParent?.getBoundingClientRect();
      if (pill && shell && parent) {
        const box = shell.getBoundingClientRect();
        const below = (offsetBelowTop ?? box.height + SHELL_BOTTOM_GAP) + (watchPillShown ? WATCH_PILL_HEIGHT : 0);
        pill.style.left = `${box.left - parent.left + box.width / 2 + centerShift}px`;
        pill.style.top = `${box.top - parent.top + below}px`;
        pill.style.visibility = 'visible';
      }
      frame = requestAnimationFrame(follow);
    };
    frame = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(frame);
  }, [centerShift, offsetBelowTop, ownerId, visible, watchPillShown]);

  if (!visible) return null;
  const listening = mic.conversationActive && isListening;
  const label = !mic.conversationActive ? '待唤醒'
    : listening ? '正在听你说…'
      : isSpeaking ? '她在说话，说完继续听'
        : isTyping ? '她在想…' : '稍等，马上继续听';

  return (
    <div
      ref={ref}
      data-desktop-pet-interactive="true"
      data-desktop-pet-window-shape="true"
      data-desktop-pet-native-scope="pet"
      data-voice-mic-pill={mic.conversationActive ? (listening ? 'listening' : 'paused') : 'wake'}
      className={'absolute z-[72] flex items-center gap-1.5 whitespace-nowrap rounded-full border bg-white/90 py-1 pl-2.5 pr-1 text-[11px] font-semibold shadow-[0_8px_20px_rgba(214,84,140,0.18)] backdrop-blur-md '
        + (mic.conversationActive ? 'border-primary/45 text-foreground' : 'border-border text-muted-foreground')}
      style={{ left: 0, top: 0, transform: 'translateX(-50%)', visibility: 'hidden' }}
      title={mic.conversationActive ? '实时对话中' : '说出角色的唤醒词就能开始对话'}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {listening ? (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
      ) : null}
      <Mic className={'h-3.5 w-3.5 ' + (mic.conversationActive ? 'text-primary' : 'text-muted-foreground')} />
      <span>{label}</span>
      {mic.conversationActive ? (
        <button
          type="button"
          onClick={() => voiceMicStatusStore.stopConversation()}
          className="ml-0.5 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-white hover:bg-primary/85"
          title="结束实时对话"
        >
          <MicOff className="h-3 w-3" />结束
        </button>
      ) : (
        <button
          type="button"
          onClick={props.onDisableWake}
          className="rounded-full px-2 py-0.5 text-muted-foreground hover:bg-black/5"
          title="关闭语音唤醒（可在语音模型设置里重新打开）"
        >
          关闭
        </button>
      )}
    </div>
  );
}
