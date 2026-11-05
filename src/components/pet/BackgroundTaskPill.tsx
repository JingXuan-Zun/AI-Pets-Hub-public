import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useDailyApprovalActive } from '../../agent/approval/dailyApproval';
import { cancelBackgroundTasks, useBackgroundTasks } from '../../agent/background/backgroundTasks';
import { useScreenWatchState } from '../../life-companion/screen-watch/screenWatchStore';
import { useVoiceMicStatus } from '../../voice/voiceMicStatus';

// The pills under slot 1 stack: screen watch, microphone, "今日已授权", then this one.
const PILL_HEIGHT = 34;

function formatElapsed(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * “正在画图… 1:20” under the model while she works on something in the background
 * (src/agent/background/backgroundTasks.ts), with a button to stop it. Follows the shell every
 * frame because walking does not re-render this layer.
 */
export function BackgroundTaskPill(props: { centerShift: number; offsetBelowCenter: number; ownerId: string }) {
  const tasks = useBackgroundTasks();
  const dailyApproval = useDailyApprovalActive();
  const watch = useScreenWatchState();
  const mic = useVoiceMicStatus();
  const ref = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const task = tasks[0];
  const shift = ((watch.asking || watch.watching) ? PILL_HEIGHT : 0)
    + ((mic.conversationActive || mic.wakeListening) ? PILL_HEIGHT : 0)
    + (dailyApproval ? PILL_HEIGHT : 0);
  const { centerShift, offsetBelowCenter, ownerId } = props;

  useEffect(() => {
    if (!task) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [task]);

  useEffect(() => {
    if (!task) return undefined;
    let frame = 0;
    const follow = () => {
      const pill = ref.current;
      const shell = document.querySelector<HTMLElement>(`[data-desktop-pet-owner-id="${ownerId}"]`);
      const parent = pill?.offsetParent?.getBoundingClientRect();
      if (pill && shell && parent) {
        const box = shell.getBoundingClientRect();
        pill.style.left = `${box.left - parent.left + box.width / 2 + centerShift}px`;
        pill.style.top = `${box.top - parent.top + box.height / 2 + offsetBelowCenter + shift}px`;
        pill.style.visibility = 'visible';
      }
      frame = requestAnimationFrame(follow);
    };
    frame = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(frame);
  }, [task, centerShift, offsetBelowCenter, ownerId, shift]);

  if (!task) return null;
  const label = task.kind === 'drawing' ? '正在画图…' : `${task.title.split('：')[0]}…`;
  return (
    <div
      ref={ref}
      data-desktop-pet-interactive="true"
      data-desktop-pet-window-shape="true"
      data-desktop-pet-native-scope="pet"
      data-background-task-pill={task.kind}
      className="absolute z-[72] flex items-center gap-1.5 whitespace-nowrap rounded-full border border-primary/45 bg-white/90 py-1 pl-2.5 pr-1 text-[11px] font-semibold text-foreground shadow-[0_8px_20px_rgba(214,84,140,0.18)] backdrop-blur-md"
      style={{ left: 0, top: 0, transform: 'translateX(-50%)', visibility: 'hidden' }}
      title={`${task.title}${tasks.length > 1 ? `（还有 ${tasks.length - 1} 件）` : ''}。做完她会告诉你；这期间照常聊天。`}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
      <span>{label}</span>
      <span className="tabular-nums text-muted-foreground">{formatElapsed(now - task.startedAt)}</span>
      <button
        type="button"
        onClick={() => cancelBackgroundTasks({ id: task.id })}
        className="rounded-full px-2 py-0.5 text-muted-foreground hover:bg-black/5"
        title="停掉这件事"
      >
        停止
      </button>
    </div>
  );
}
