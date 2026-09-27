import { type DesktopPetAnimationToolTrigger } from '../../chatState';
import { pushFrontendRuntimeError, pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import { type VoicePlaybackControlSnapshot, type VoicePlaybackSession } from '../../voice/types';
import { createPlayableAnimationToolAudioPlaybackState } from './animationToolAudioPlaybackState';
import { type AnimationToolAudioPlaybackStart } from './animationToolAudioPlaybackScheduler';
import { createAnimationToolAudioPlaybackSession } from './animationToolAudioPlaybackSession';
import {
  clearAnimationToolAudioScheduleTiming,
  publishAnimationToolAudioScheduleTiming,
} from './animationToolAudioScheduleSync';

export type AnimationToolAudioStatusPublisher = (
  trigger: DesktopPetAnimationToolTrigger,
  status: 'cancelled' | 'ended' | 'failed' | 'paused' | 'pending' | 'playing',
  errorMessage?: string,
  controlSnapshot?: VoicePlaybackControlSnapshot | null,
) => void;

export function publishAnimationToolAudioStatus(options: {
  petId: string;
  publishState: (petId: string, state: ReturnType<typeof createPlayableAnimationToolAudioPlaybackState>) => void;
  status: Parameters<AnimationToolAudioStatusPublisher>[1];
  trigger: DesktopPetAnimationToolTrigger;
  errorMessage?: string;
  controlSnapshot?: VoicePlaybackControlSnapshot | null;
}) {
  const state = createPlayableAnimationToolAudioPlaybackState({
    controlSnapshot: options.controlSnapshot,
    petId: options.petId,
    status: options.status,
    trigger: options.trigger,
  });
  if (!state) {
    return;
  }

  options.publishState(options.petId, {
    ...state,
    ...(options.errorMessage ? { errorMessage: options.errorMessage } : {}),
  });
}

export function startAnimationToolAudioPlayback(options: {
  activeTokenRef: { current: number | null };
  onSessionDone: (playback: VoicePlaybackSession, token: number) => void;
  playbackStart: AnimationToolAudioPlaybackStart;
  petId: string;
  publishStatus: AnimationToolAudioStatusPublisher;
  sessionRef: { current: VoicePlaybackSession | null };
  trigger: DesktopPetAnimationToolTrigger;
}) {
  void createAnimationToolAudioPlaybackSession(
    options.playbackStart,
    () => {
      if (options.activeTokenRef.current === options.trigger.token) {
        options.publishStatus(options.trigger, 'playing');
      }
    },
  )
    .then(({ playback, scheduleBaseDelayMs, scheduler }) => {
      if (options.activeTokenRef.current !== options.trigger.token) {
        playback.stop();
        return;
      }

      options.sessionRef.current = playback;
      publishAnimationToolAudioScheduleTiming({
        baseDelayMs: scheduleBaseDelayMs,
        scheduler,
        token: options.trigger.token,
      });
      pushFrontendRuntimeLog('character-animation', 'skill animation audio playback started', {
        petId: options.petId,
        scheduledDelayMs: options.playbackStart.startDelayMs,
        scheduler,
      });

      void playback.done
        .then(() => {
          if (options.activeTokenRef.current === options.trigger.token) {
            options.publishStatus(options.trigger, 'ended');
          }
        })
        .catch((error) => {
          if (options.activeTokenRef.current !== options.trigger.token) {
            return;
          }
          pushFrontendRuntimeError('character-animation', 'skill animation audio playback failed', error, {
            petId: options.petId,
          });
          options.publishStatus(
            options.trigger,
            'failed',
            error instanceof Error ? error.message : String(error),
          );
        })
        .finally(() => {
          clearAnimationToolAudioScheduleTiming(options.trigger.token);
          options.onSessionDone(playback, options.trigger.token);
        });
    })
    .catch((error) => {
      if (options.activeTokenRef.current !== options.trigger.token) {
        return;
      }
      pushFrontendRuntimeError('character-animation', 'skill animation audio playback setup failed', error, {
        petId: options.petId,
      });
      options.publishStatus(
        options.trigger,
        'failed',
        error instanceof Error ? error.message : String(error),
      );
      clearAnimationToolAudioScheduleTiming(options.trigger.token);
    });
}
