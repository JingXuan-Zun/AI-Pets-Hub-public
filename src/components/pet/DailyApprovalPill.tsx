import { useEffect, useRef } from 'react';
import { ShieldCheck } from 'lucide-react';
import { revokeDailyApproval, useDailyApprovalActive } from '../../agent/approval/dailyApproval';
import { useScreenWatchState } from '../../life-companion/screen-watch/screenWatchStore';
import { useVoiceMicStatus } from '../../voice/voiceMicStatus';

// The screen-watch and mic pills sit under slot 1 first; this one goes below them.
const PILL_HEIGHT = 34;

/**
 * "今日已授权" under the model while the day's tool approval is on (src/agent/approval/
 * dailyApproval.ts), so the user always sees that she acts without asking, with one click to
 * take it back. Follows the shell every frame because walking does not re-render this layer.
 */
export function DailyApprovalPill(props: { centerShift: number; offsetBelowCenter: number; ownerId: string }) {
  const active = useDailyApprovalActive();
  const watch = useScreenWatchState();
  const mic = useVoiceMicStatus();
  const ref = useRef<HTMLDivElement>(null);
  const shift = ((watch.asking || watch.watching) ? PILL_HEIGHT : 0) + ((mic.conversationActive || mic.wakeListening) ? PILL_HEIGHT : 0);
  const { centerShift, offsetBelowCenter, ownerId } = props;

  useEffect(() => {
    if (!active) return undefined;
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
  }, [active, centerShift, offsetBelowCenter, ownerId, shift]);

  if (!active) return null;
  return (
    <div
      ref={ref}
      data-desktop-pet-interactive="true"
      data-desktop-pet-window-shape="true"
      data-desktop-pet-native-scope="pet"
      data-daily-approval-pill="on"
      className="absolute z-[72] flex items-center gap-1.5 whitespace-nowrap rounded-full border border-primary/45 bg-white/90 py-1 pl-2.5 pr-1 text-[11px] font-semibold text-foreground shadow-[0_8px_20px_rgba(214,84,140,0.18)] backdrop-blur-md"
      style={{ left: 0, top: 0, transform: 'translateX(-50%)', visibility: 'hidden' }}
      title="今天她操作电脑不再逐个问你；发送、删除、付款这类还会问。明天或你拒绝一次后会重新问。"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <ShieldCheck className="h-3.5 w-3.5 text-primary" />
      <span>今日已授权</span>
      <button
        type="button"
        onClick={() => revokeDailyApproval()}
        className="rounded-full px-2 py-0.5 text-muted-foreground hover:bg-black/5"
        title="收回今天的授权，之后每次都会问"
      >
        收回
      </button>
    </div>
  );
}
