import { useEffect, useRef } from 'react';
import { type DesktopPetAnimationToolAudioPlaybackState, type DesktopPetAnimationToolTrigger } from '../../chatState';
import { desktopPetChatStore } from '../../chatStore';
import { type VoicePlaybackSession } from '../../voice/types';
import { publishAnimationToolAudioStatus } from './animationToolAudioPlaybackController';
import {
  controlAnimationToolAudioRuntime,
  handleAnimationToolAudioTrigger,
  stopAnimationToolAudioRuntime,
} from './animationToolAudioPlaybackRuntime';
import {
  isPauseAnimationToolTrigger,
  isResumeAnimationToolTrigger,
  isNonStopAnimationToolControlTrigger,
  isStopAnimationToolTrigger,
} from './animationToolTriggerControl';

function publishChatAudioState(
  petId: string,
  state: DesktopPetAnimationToolAudioPlaybackState | null,
) {
  desktopPetChatStore.setAnimationToolAudioPlaybackState(petId, state);
}

export function useAnimationToolTriggerAudioPlayback(
  animationToolTrigger: DesktopPetAnimationToolTrigger | null | undefined,
  petId: string,
) {
  const lastAudioTriggerTokenRef = useRef<number | null>(null);
  const activeAudioTriggerRef = useRef<DesktopPetAnimationToolTrigger | null>(null);
  const activePlaybackTokenRef = useRef<number | null>(null);
  const playbackSessionRef = useRef<VoicePlaybackSession | null>(null);
  const startTimerRef = useRef<number | null>(null);
  const runtimeRefs = {
    activeAudioTriggerRef,
    activePlaybackTokenRef,
    playbackSessionRef,
    startTimerRef,
  };

  const setPlayableStatus = (
    trigger: DesktopPetAnimationToolTrigger,
    status: 'cancelled' | 'ended' | 'failed' | 'paused' | 'pending' | 'playing',
    errorMessage?: string,
    controlSnapshot?: Parameters<typeof publishAnimationToolAudioStatus>[0]['controlSnapshot'],
  ) => {
    publishAnimationToolAudioStatus({
      controlSnapshot,
      petId,
      publishState: publishChatAudioState,
      status,
      trigger,
      errorMessage,
    });
  };

  useEffect(() => () => {
    stopAnimationToolAudioRuntime(runtimeRefs, setPlayableStatus);
  }, []);

  useEffect(() => {
    if (
      !animationToolTrigger
      || lastAudioTriggerTokenRef.current === animationToolTrigger.token
    ) {
      return;
    }

    lastAudioTriggerTokenRef.current = animationToolTrigger.token;
    if (isStopAnimationToolTrigger(animationToolTrigger)) {
      stopAnimationToolAudioRuntime(runtimeRefs, setPlayableStatus);
      return;
    }

    if (isNonStopAnimationToolControlTrigger(animationToolTrigger)) {
      if (
        isPauseAnimationToolTrigger(animationToolTrigger)
        || isResumeAnimationToolTrigger(animationToolTrigger)
      ) {
        controlAnimationToolAudioRuntime(runtimeRefs, setPlayableStatus, animationToolTrigger);
      }
      return;
    }

    handleAnimationToolAudioTrigger({
      petId,
      publishState: publishChatAudioState,
      publishStatus: setPlayableStatus,
      refs: runtimeRefs,
      trigger: animationToolTrigger,
    });
  }, [animationToolTrigger, petId]);
}
