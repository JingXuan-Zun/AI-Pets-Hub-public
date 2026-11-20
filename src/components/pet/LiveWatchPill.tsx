import { useEffect, useRef } from 'react';
import { Ear, MonitorPlay, Square } from 'lucide-react';
import { liveWatchStore, useLiveWatchState } from '../../live-watch/liveWatchStore';

/**
 * Pill under the model while watching a video together: shows that she watches (and hears),
 * with one-click 停止. Follows the pet shell every frame like the screen-watch pill.
 */
export function LiveWatchPill(props: { centerShift: number; offsetBelowCenter: number; ownerId: string }) {
  const state = useLiveWatchState();
  const ref = useRef<HTMLDivElement>(null);
  const { centerShift, offsetBelowCenter, ownerId } = props;
  useEffect(() => {
    if (!state.active) return undefined;
    let frame = 0;
    const follow = () => {
      const pill = ref.current;
      const shell = document.querySelector<HTMLElement>(`[data-desktop-pet-owner-id="${ownerId}"]`);
      const parent = pill?.offsetParent?.getBoundingClientRect();
      if (pill && shell && parent) {
        const box = shell.getBoundingClientRect();
        pill.style.left = `${box.left - parent.left + box.width / 2 + centerShift}px`;
        pill.style.top = `${box.top - parent.top + box.height / 2 + offsetBelowCenter}px`;
        pill.style.visibility = 'visible';
      }
      frame = requestAnimationFrame(follow);
    };
    frame = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(frame);
  }, [centerShift, offsetBelowCenter, ownerId, state.active]);
  if (!state.active) return null;
  return (
    <div
      ref={ref}
      data-desktop-pet-interactive="true"
      data-desktop-pet-window-shape="true"
      data-desktop-pet-native-scope="pet"
      data-live-watch-pill="watching"
      className="absolute z-[72] flex items-center gap-1.5 whitespace-nowrap rounded-full border border-primary/45 bg-white/90 py-1 pl-2.5 pr-1 text-[11px] font-semibold text-foreground shadow-[0_8px_20px_rgba(214,84,140,0.22)] backdrop-blur-md"
      style={{ left: 0, top: 0, transform: 'translateX(-50%)', visibility: 'hidden' }}
      title={state.note || state.lastLine || '正在陪你看视频'}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
      </span>
      <MonitorPlay className="h-3.5 w-3.5 text-primary" />
      {state.hearing && <Ear className="h-3.5 w-3.5 text-primary" aria-label="听得到声音" />}
      <span>一起看中</span>
      <button
        type="button"
        onClick={() => liveWatchStore.stopFromPill()}
        className="ml-0.5 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-white hover:bg-primary/85"
        title="停止一起看"
      >
        <Square className="h-3 w-3" />停止
      </button>
    </div>
  );
}
