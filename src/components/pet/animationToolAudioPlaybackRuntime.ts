import { type MutableRefObject } from 'react';
import {
  type DesktopPetAnimationToolAudioPlaybackState,
  type DesktopPetAnimationToolTrigger,
} from '../../chatState';
import { type VoicePlaybackSession } from '../../voice/types';
import { createSkippedAnimationToolAudioPlaybackState } from './animationToolAudioPlaybackState';
import { type AnimationToolAudioStatusPublisher, startAnimationToolAudioPlayback } from './animationToolAudioPlaybackController';
import { resolveAnimationToolAudioPlaybackStart } from './animationToolAudioPlaybackScheduler';
import { clearAnimationToolAudioScheduleTiming } from './animationToolAudioScheduleSync';
import {
  isNonStopAnimationToolControlTrigger,
  isPauseAnimationToolTrigger,
  isResumeAnimationToolTrigger,
  isSeekAnimationToolTrigger,
  resolveAnimationToolTriggerSeekPositionMs,
} from './animationToolTriggerControl';

export type AnimationToolAudioPlaybackRefs = {
  activeAudioTriggerRef: MutableRefObject<DesktopPetAnimationToolTrigger | null>;
  activePlaybackTokenRef: MutableRefObject<number | null>;
  playbackSessionRef: MutableRefObject<VoicePlaybackSession | null>;
  startTimerRef: MutableRefObject<number | null>;
};

export function clearAnimationToolAudioStartTimer(refs: AnimationToolAudioPlaybackRefs) {
  if (refs.startTimerRef.current !== null) {
    window.clearTimeout(refs.startTimerRef.current);
    refs.startTimerRef.current = null;
  }
}

export function stopAnimationToolAudioRuntime(
  refs: AnimationToolAudioPlaybackRefs,
  publishStatus: AnimationToolAudioStatusPublisher,
  status: 'cancelled' | null = 'cancelled',
) {
  const activeTrigger = refs.activeAudioTriggerRef.current;
  clearAnimationToolAudioStartTimer(refs);
  refs.activeAudioTriggerRef.current = null;
  refs.activePlaybackTokenRef.current = null;
  refs.playbackSessionRef.current?.stop();
  refs.playbackSessionRef.current = null;
  if (activeTrigger && status) {
    clearAnimationToolAudioScheduleTiming(activeTrigger.token);
    publishStatus(activeTrigger, status);
  }
  return activeTrigger;
}

export function controlAnimationToolAudioRuntime(
  refs: AnimationToolAudioPlaybackRefs,
  publishStatus: AnimationToolAudioStatusPublisher,
  trigger: DesktopPetAnimationToolTrigger,
) {
  const activeTrigger = refs.activeAudioTriggerRef.current;
  const playbackSession = refs.playbackSessionRef.current;
  if (!activeTrigger || refs.activePlaybackTokenRef.current !== activeTrigger.token) {
    return false;
  }

  if (isPauseAnimationToolTrigger(trigger) && playbackSession?.pause) {
    const snapshot = playbackSession.pause();
    if (!snapshot?.resumeSupported) {
      return false;
    }

    publishStatus(activeTrigger, 'paused', undefined, snapshot);
    return true;
  }

  if (isResumeAnimationToolTrigger(trigger) && playbackSession?.resume) {
    const snapshot = playbackSession.resume();
    if (!snapshot?.resumeSupported) {
      return false;
    }

    publishStatus(activeTrigger, 'playing', undefined, snapshot);
    return true;
  }

  if (isSeekAnimationToolTrigger(trigger) && playbackSession?.resume) {
    const seekPositionMs = resolveAnimationToolTriggerSeekPositionMs(trigger);
    if (seekPositionMs === null) {
      return false;
    }

    const snapshot = playbackSession.resume(seekPositionMs);
    if (!snapshot?.resumeSupported) {
      return false;
    }

    publishStatus(activeTrigger, 'playing', undefined, snapshot);
    return true;
  }

  return false;
}

function startScheduledAnimationToolAudioRuntime(options: {
  playbackStart: NonNullable<ReturnType<typeof resolveAnimationToolAudioPlaybackStart>>;
  petId: string;
  publishStatus: AnimationToolAudioStatusPublisher;
  refs: AnimationToolAudioPlaybackRefs;
  trigger: DesktopPetAnimationToolTrigger;
}) {
  if (options.refs.activePlaybackTokenRef.current !== options.trigger.token) {
    return;
  }

  startAnimationToolAudioPlayback({
    activeTokenRef: options.refs.activePlaybackTokenRef,
    onSessionDone: (playback, token) => {
      if (options.refs.playbackSessionRef.current === playback) {
        options.refs.playbackSessionRef.current = null;
      }
      if (options.refs.activePlaybackTokenRef.current === token) {
        options.refs.activePlaybackTokenRef.current = null;
        options.refs.activeAudioTriggerRef.current = null;
      }
    },
    playbackStart: options.playbackStart,
    petId: options.petId,
    publishStatus: options.publishStatus,
    sessionRef: options.refs.playbackSessionRef,
    trigger: options.trigger,
  });
}

export function handleAnimationToolAudioTrigger(options: {
  petId: string;
  publishState: (petId: string, state: DesktopPetAnimationToolAudioPlaybackState | null) => void;
  publishStatus: AnimationToolAudioStatusPublisher;
  refs: AnimationToolAudioPlaybackRefs;
  trigger: DesktopPetAnimationToolTrigger;
}) {
  if (isNonStopAnimationToolControlTrigger(options.trigger)) {
    controlAnimationToolAudioRuntime(options.refs, options.publishStatus, options.trigger);
    return;
  }

  const interruptedTrigger = stopAnimationToolAudioRuntime(options.refs, options.publishStatus);
  const playbackStart = resolveAnimationToolAudioPlaybackStart(options.trigger);
  if (!playbackStart) {
    const skippedState = createSkippedAnimationToolAudioPlaybackState({
      petId: options.petId,
      trigger: options.trigger,
    });
    if (skippedState || !interruptedTrigger) {
      options.publishState(options.petId, skippedState);
    }
    return;
  }

  options.refs.activeAudioTriggerRef.current = options.trigger;
  options.refs.activePlaybackTokenRef.current = options.trigger.token;
  options.publishStatus(options.trigger, 'pending');
  startScheduledAnimationToolAudioRuntime({
    playbackStart,
    petId: options.petId,
    publishStatus: options.publishStatus,
    refs: options.refs,
    trigger: options.trigger,
  });
}
