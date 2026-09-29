import { Music2, PauseCircle, PlayCircle, RotateCcw, SkipBack, SkipForward, StopCircle } from 'lucide-react';
import { type ComponentType } from 'react';
import { useEffect, useState } from 'react';
import { desktopPetChatStore, useDesktopPetChatStore } from '../../chatStore';
import {
  createAnimationToolAudioPlaybackDisplay,
  resolveVisibleAnimationToolAudioPlaybackState,
} from './animationToolAudioPlaybackDisplay';
import { shouldTickAnimationToolAudioProgress } from './animationToolAudioProgressTicker';
import { AnimationToolPlaybackScrubber } from './AnimationToolPlaybackScrubber';
import { createAnimationToolBadgeScrubberState } from './animationToolBadgeScrubberControls';
import { createAnimationToolBadgeSeekTarget } from './animationToolBadgeSeekControls';
import {
  createAnimationToolPlaybackBadgeControls,
  type AnimationToolPlaybackBadgeControlState,
} from './animationToolPlaybackBadgeControls';
import { createAnimationToolPerformanceDisplay } from './animationToolPerformanceDisplay';

interface AnimationToolAudioPlaybackBadgeProps {
  activePetId: string;
  position: { x: number; y: number };
}

interface ControlButtonProps {
  control: AnimationToolPlaybackBadgeControlState;
  icon: ComponentType<{ className?: string }>;
  onAction: () => void;
}

const TONE_CLASS_NAMES: Record<NonNullable<ReturnType<typeof createAnimationToolAudioPlaybackDisplay>>['tone'], string> = {
  active: 'border-emerald-100 bg-emerald-50/95 text-emerald-800 shadow-[0_14px_32px_rgba(16,185,129,0.14)]',
  failed: 'border-rose-100 bg-rose-50/95 text-rose-800 shadow-[0_14px_32px_rgba(244,63,94,0.14)]',
  idle: 'border-slate-100 bg-white/94 text-slate-700 shadow-[0_14px_32px_rgba(148,163,184,0.16)]',
  pending: 'border-amber-100 bg-amber-50/95 text-amber-800 shadow-[0_14px_32px_rgba(245,158,11,0.14)]',
};

const CONTROL_BUTTON_CLASS_NAME = [
  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/80 transition-colors hover:bg-white',
  'disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-white/80',
].join(' ');

function mergeSeekControl(
  control: AnimationToolPlaybackBadgeControlState,
  target: ReturnType<typeof createAnimationToolBadgeSeekTarget>,
): AnimationToolPlaybackBadgeControlState {
  return {
    ...control,
    disabled: control.disabled || target.disabled,
    title: target.title,
    visible: control.visible && target.visible,
  };
}

function useAnimationToolAudioProgressTick(shouldTick: boolean) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!shouldTick) {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      setTick((currentTick) => currentTick + 1);
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [shouldTick]);

  return tick;
}

function ControlButton({ control, icon: Icon, onAction }: ControlButtonProps) {
  if (!control.visible) {
    return null;
  }

  return (
    <button
      type="button"
      className={CONTROL_BUTTON_CLASS_NAME}
      disabled={control.disabled}
      title={control.title}
      onClick={(event) => {
        event.stopPropagation();
        if (!control.disabled) {
          onAction();
        }
      }}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

export function AnimationToolAudioPlaybackBadge({
  activePetId,
  position,
}: AnimationToolAudioPlaybackBadgeProps) {
  const {
    animationToolAudioPlaybackByPetId,
    animationToolPerformanceByPetId,
    lastReplayableAnimationToolTriggersByPetId,
  } = useDesktopPetChatStore();
  const playbackState = resolveVisibleAnimationToolAudioPlaybackState(
    animationToolAudioPlaybackByPetId,
    activePetId,
  );
  const playbackPetPerformanceState = playbackState
    ? animationToolPerformanceByPetId[playbackState.petId]
    : undefined;
  const activePerformanceState = animationToolPerformanceByPetId[activePetId];
  const progressTick = useAnimationToolAudioProgressTick(
    shouldTickAnimationToolAudioProgress(playbackState),
  );
  const audioDisplay = createAnimationToolAudioPlaybackDisplay(playbackState, {
    tick: progressTick,
  });
  const performanceDisplay = audioDisplay ? null : createAnimationToolPerformanceDisplay(activePerformanceState);
  const display = audioDisplay ?? performanceDisplay;

  if (!display) {
    return null;
  }

  const performanceState = audioDisplay ? playbackPetPerformanceState : activePerformanceState;
  const controls = createAnimationToolPlaybackBadgeControls({
    audioState: playbackState,
    lastReplayableTrigger: lastReplayableAnimationToolTriggersByPetId[display.petId],
    performanceState,
  });
  const tone = audioDisplay?.tone ?? 'active';
  const title = audioDisplay?.sourceRef
    ? `${display.title}: ${audioDisplay.sourceRef}`
    : display.title;
  const seekBackwardTarget = createAnimationToolBadgeSeekTarget({
    direction: 'backward',
    state: playbackState,
  });
  const seekForwardTarget = createAnimationToolBadgeSeekTarget({
    direction: 'forward',
    state: playbackState,
  });
  const scrubberState = createAnimationToolBadgeScrubberState({
    state: playbackState,
  });

  return (
    <div
      data-desktop-pet-interactive="true"
      data-desktop-pet-window-shape="true"
      data-desktop-pet-native-scope="pet"
      className={[
        'absolute z-[73] flex max-w-[320px] items-center gap-2 rounded-full border px-3 py-2 text-[10px] backdrop-blur-xl',
        TONE_CLASS_NAMES[tone],
      ].join(' ')}
      style={{ left: position.x, top: position.y }}
      title={title}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/75">
        <Music2 className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{display.title}</span>
        <span className="block truncate opacity-75">{display.detail}</span>
      </span>
      <ControlButton
        control={controls.replay}
        icon={RotateCcw}
        onAction={() => desktopPetChatStore.replayAnimationToolTrigger(display.petId)}
      />
      <ControlButton
        control={controls.pause}
        icon={PauseCircle}
        onAction={() => desktopPetChatStore.pauseAnimationToolTrigger(display.petId)}
      />
      <ControlButton
        control={controls.resume}
        icon={PlayCircle}
        onAction={() => desktopPetChatStore.resumeAnimationToolTrigger(display.petId)}
      />
      <ControlButton
        control={mergeSeekControl(controls.seekBackward, seekBackwardTarget)}
        icon={SkipBack}
        onAction={() => desktopPetChatStore.seekAnimationToolTrigger(
          display.petId,
          seekBackwardTarget.positionMs,
        )}
      />
      <ControlButton
        control={mergeSeekControl(controls.seekForward, seekForwardTarget)}
        icon={SkipForward}
        onAction={() => desktopPetChatStore.seekAnimationToolTrigger(
          display.petId,
          seekForwardTarget.positionMs,
        )}
      />
      <AnimationToolPlaybackScrubber
        state={scrubberState}
        onSeek={(positionMs) => desktopPetChatStore.seekAnimationToolTrigger(display.petId, positionMs)}
      />
      <ControlButton
        control={controls.stop}
        icon={StopCircle}
        onAction={() => desktopPetChatStore.stopAnimationToolTrigger(display.petId)}
      />
    </div>
  );
}
