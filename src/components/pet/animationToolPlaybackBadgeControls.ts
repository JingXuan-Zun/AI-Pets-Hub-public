import {
  type DesktopPetAnimationToolAudioPlaybackState,
  type DesktopPetAnimationToolPerformanceState,
  type DesktopPetAnimationToolTrigger,
} from '../../chatState';

export type AnimationToolPlaybackBadgeControlState = {
  disabled?: boolean;
  reason?: string;
  title: string;
  visible: boolean;
};

export type AnimationToolPlaybackBadgeControls = {
  pause: AnimationToolPlaybackBadgeControlState;
  replay: AnimationToolPlaybackBadgeControlState;
  resume: AnimationToolPlaybackBadgeControlState;
  seekBackward: AnimationToolPlaybackBadgeControlState;
  seekForward: AnimationToolPlaybackBadgeControlState;
  stop: AnimationToolPlaybackBadgeControlState;
};

const hiddenControl = (title: string): AnimationToolPlaybackBadgeControlState => ({
  title,
  visible: false,
});

const visibleControl = (
  title: string,
  reason?: string,
): AnimationToolPlaybackBadgeControlState => ({
  ...(reason ? { disabled: true, reason } : {}),
  title: reason ? `${title}: ${reason}` : title,
  visible: true,
});

function canPausePerformance(performanceState: DesktopPetAnimationToolPerformanceState | undefined) {
  return performanceState?.triggerKind === 'scheduled' && performanceState.status === 'playing';
}

function canResumePerformance(performanceState: DesktopPetAnimationToolPerformanceState | undefined) {
  return performanceState?.triggerKind === 'scheduled' && performanceState.status === 'paused';
}

function createPauseControl(
  audioState: DesktopPetAnimationToolAudioPlaybackState | null | undefined,
  performanceState: DesktopPetAnimationToolPerformanceState | undefined,
) {
  if (audioState?.status === 'playing' || (!audioState && canPausePerformance(performanceState))) {
    return visibleControl('Pause Skill performance');
  }
  if (audioState?.status === 'pending') {
    return visibleControl('Pause Skill performance', 'available after playback starts');
  }

  return hiddenControl('Pause Skill performance');
}

function createResumeControl(
  audioState: DesktopPetAnimationToolAudioPlaybackState | null | undefined,
  performanceState: DesktopPetAnimationToolPerformanceState | undefined,
) {
  if (audioState?.status === 'paused' || (!audioState && canResumePerformance(performanceState))) {
    return visibleControl('Resume Skill performance');
  }

  return hiddenControl('Resume Skill performance');
}

function createStopControl(
  audioState: DesktopPetAnimationToolAudioPlaybackState | null | undefined,
  performanceState: DesktopPetAnimationToolPerformanceState | undefined,
) {
  const visible = audioState?.status === 'pending'
    || audioState?.status === 'playing'
    || audioState?.status === 'paused'
    || performanceState?.status === 'playing'
    || performanceState?.status === 'paused';
  return visible ? visibleControl('Stop Skill performance') : hiddenControl('Stop Skill performance');
}

function createSeekControl(
  audioState: DesktopPetAnimationToolAudioPlaybackState | null | undefined,
  title: string,
) {
  if (
    (audioState?.status === 'playing' || audioState?.status === 'paused')
    && audioState.resumeSupported === true
  ) {
    return visibleControl(title);
  }

  return hiddenControl(title);
}

export function createAnimationToolPlaybackBadgeControls(options: {
  audioState: DesktopPetAnimationToolAudioPlaybackState | null | undefined;
  lastReplayableTrigger: DesktopPetAnimationToolTrigger | null | undefined;
  performanceState: DesktopPetAnimationToolPerformanceState | undefined;
}): AnimationToolPlaybackBadgeControls {
  return {
    pause: createPauseControl(options.audioState, options.performanceState),
    replay: options.lastReplayableTrigger
      ? visibleControl('Replay Skill performance')
      : hiddenControl('Replay Skill performance'),
    resume: createResumeControl(options.audioState, options.performanceState),
    seekBackward: createSeekControl(options.audioState, 'Seek back 5s'),
    seekForward: createSeekControl(options.audioState, 'Seek forward 5s'),
    stop: createStopControl(options.audioState, options.performanceState),
  };
}
