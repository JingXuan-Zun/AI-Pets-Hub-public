import { useEffect, useState } from 'react';
import {
  type AnimationToolBadgeScrubberState,
  createAnimationToolBadgeScrubberLabel,
  resolveAnimationToolBadgeScrubberSeekPosition,
} from './animationToolBadgeScrubberControls';

interface AnimationToolPlaybackScrubberProps {
  state: AnimationToolBadgeScrubberState;
  onSeek: (positionMs: number) => void;
}

export function AnimationToolPlaybackScrubber({
  state,
  onSeek,
}: AnimationToolPlaybackScrubberProps) {
  const [draftPercent, setDraftPercent] = useState(state.percent);
  const draftPositionMs = resolveAnimationToolBadgeScrubberSeekPosition({
    durationMs: state.durationMs,
    percent: draftPercent,
  });
  const label = draftPercent === state.percent
    ? state.label
    : createAnimationToolBadgeScrubberLabel({
        durationMs: state.durationMs,
        positionMs: draftPositionMs,
      });

  useEffect(() => {
    setDraftPercent(state.percent);
  }, [state.percent]);

  if (!state.visible) {
    return null;
  }

  return (
    <span className="flex shrink-0 items-center gap-1">
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={draftPercent}
        disabled={state.disabled}
        title={state.title}
        className="h-1.5 w-24 shrink-0 cursor-pointer accent-current disabled:cursor-not-allowed disabled:opacity-45"
        onChange={(event) => setDraftPercent(Number(event.target.value))}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onPointerUp={(event) => {
          event.stopPropagation();
          if (state.disabled) {
            return;
          }

          onSeek(draftPositionMs);
        }}
        onKeyUp={(event) => {
          if (state.disabled || event.key !== 'Enter') {
            return;
          }

          onSeek(draftPositionMs);
        }}
      />
      <span className="w-14 shrink-0 text-right font-mono text-[9px] opacity-75">{label}</span>
    </span>
  );
}
