import { useEffect, useRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { screenWatchStore, useScreenWatchState } from '../../life-companion/screen-watch/screenWatchStore';

/**
 * Small pill under the model: asks for permission to watch, or shows that the
 * character is watching with a one-click 断开. Hidden otherwise.
 *
 * The pet walks by moving its shell element directly, without re-rendering this
 * layer, so the pill follows that element every frame instead of using props.
 */
export function LifeCompanionScreenWatchPill(props: {
  /** Horizontal shift from the shell center to the drawn model's center. */
  centerShift: number;
  /** From the shell's top edge to just below the drawn model's feet (the visual box is taller). */
  offsetBelowTop: number;
  ownerId: string;
}) {
  const state = useScreenWatchState();
  const ref = useRef<HTMLDivElement>(null);
  const visible = state.asking || state.watching;
  const { centerShift, offsetBelowTop, ownerId } = props;
  useEffect(() => {
    if (!visible) return undefined;
    let frame = 0;
    const follow = () => {
      const pill = ref.current;
      const shell = document.querySelector<HTMLElement>(`[data-desktop-pet-owner-id="${ownerId}"]`);
      const parent = pill?.offsetParent?.getBoundingClientRect();
      if (pill && shell && parent) {
        const box = shell.getBoundingClientRect();
        pill.style.left = `${box.left - parent.left + box.width / 2 + centerShift}px`;
        pill.style.top = `${box.top - parent.top + offsetBelowTop}px`;
        pill.style.visibility = 'visible';
      }
      frame = requestAnimationFrame(follow);
    };
    frame = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(frame);
  }, [centerShift, offsetBelowTop, ownerId, visible]);
  if (!visible) return null;
  return (
    <div
      ref={ref}
      data-desktop-pet-interactive="true"
      data-desktop-pet-window-shape="true"
      data-desktop-pet-native-scope="pet"
      data-life-companion-watch-pill={state.watching ? 'watching' : 'asking'}
      className="absolute z-[72] flex items-center gap-1.5 whitespace-nowrap rounded-full border border-primary/45 bg-white/90 py-1 pl-2.5 pr-1 text-[11px] font-semibold text-foreground shadow-[0_8px_20px_rgba(214,84,140,0.22)] backdrop-blur-md"
      style={{ left: 0, top: 0, transform: 'translateX(-50%)', visibility: 'hidden' }}
      title={state.watching ? state.lastSummary || '正在陪你看屏幕' : undefined}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {state.watching ? (
        <>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          <Eye className="h-3.5 w-3.5 text-primary" />
          <span>{state.looking ? '正在看…' : '观看中'}</span>
          <button
            type="button"
            onClick={() => screenWatchStore.disconnect()}
            className="ml-0.5 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-white hover:bg-primary/85"
            title="断开观看"
          >
            <EyeOff className="h-3 w-3" />断开
          </button>
        </>
      ) : (
        <>
          <Eye className="h-3.5 w-3.5 text-primary" />
          <span>让我看看你在做什么？</span>
          <button type="button" onClick={() => screenWatchStore.answer(true)} className="rounded-full bg-primary px-2 py-0.5 text-white hover:bg-primary/85">同意</button>
          <button type="button" onClick={() => screenWatchStore.answer(false)} className="rounded-full px-2 py-0.5 text-muted-foreground hover:bg-black/5">不用了</button>
        </>
      )}
    </div>
  );
}
