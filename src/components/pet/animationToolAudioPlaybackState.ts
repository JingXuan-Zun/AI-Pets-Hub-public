import {
  type DesktopPetAnimationToolAudioPlaybackState,
  type DesktopPetAnimationToolAudioPlaybackStatus,
  type DesktopPetAnimationToolTrigger,
  type DesktopPetAnimationToolTriggerAudio,
} from '../../chatState';
import { type VoicePlaybackControlSnapshot } from '../../voice/types';
import {
  resolveAnimationToolTriggerAudioStartDelayMs,
  resolveAnimationToolTriggerPlayableAudio,
} from './animationToolTriggerAudio';

const DEFAULT_AUDIO_RESUME_UNSUPPORTED_REASON = 'Audio resume needs a playback session with a saved playback position.';

function createAudioResumeCapabilityFields(options: {
  controlSnapshot?: VoicePlaybackControlSnapshot | null;
  status: DesktopPetAnimationToolAudioPlaybackStatus;
}) {
  if (options.controlSnapshot) {
    return {
      playbackPositionMs: options.controlSnapshot.playbackPositionMs,
      resumeSupported: options.controlSnapshot.resumeSupported,
      ...(options.controlSnapshot.resumeUnsupportedReason
        ? { resumeUnsupportedReason: options.controlSnapshot.resumeUnsupportedReason }
        : {}),
    };
  }

  if (options.status !== 'pending' && options.status !== 'playing') {
    return {};
  }

  return {
    playbackPositionMs: 0,
    resumeSupported: false,
    resumeUnsupportedReason: DEFAULT_AUDIO_RESUME_UNSUPPORTED_REASON,
  };
}

export function createAnimationToolAudioPlaybackState(options: {
  audio: DesktopPetAnimationToolTriggerAudio;
  controlSnapshot?: VoicePlaybackControlSnapshot | null;
  errorMessage?: string;
  petId: string;
  status: DesktopPetAnimationToolAudioPlaybackStatus;
  token: number;
}): DesktopPetAnimationToolAudioPlaybackState {
  return {
    ...(options.audio.durationMs === undefined ? {} : { durationMs: options.audio.durationMs }),
    ...(options.errorMessage ? { errorMessage: options.errorMessage } : {}),
    ...(options.audio.playbackUrl ? { playbackUrl: options.audio.playbackUrl } : {}),
    ...createAudioResumeCapabilityFields({
      controlSnapshot: options.controlSnapshot,
      status: options.status,
    }),
    petId: options.petId,
    scheduledDelayMs: resolveAnimationToolTriggerAudioStartDelayMs(options.audio),
    source: options.audio.source,
    sourceRef: options.audio.sourceRef,
    status: options.status,
    ...(options.audio.offsetMs === undefined ? {} : { syncOffsetMs: options.audio.offsetMs }),
    token: options.token,
    updatedAt: Date.now(),
  };
}

export function createSkippedAnimationToolAudioPlaybackState(options: {
  petId: string;
  trigger: DesktopPetAnimationToolTrigger;
}) {
  if (!options.trigger.audio) {
    return null;
  }

  return createAnimationToolAudioPlaybackState({
    audio: options.trigger.audio,
    petId: options.petId,
    status: 'skipped',
    token: options.trigger.token,
  });
}

export function createPlayableAnimationToolAudioPlaybackState(options: {
  controlSnapshot?: VoicePlaybackControlSnapshot | null;
  petId: string;
  status: Exclude<DesktopPetAnimationToolAudioPlaybackStatus, 'skipped'>;
  trigger: DesktopPetAnimationToolTrigger;
}) {
  const audio = resolveAnimationToolTriggerPlayableAudio(options.trigger.audio);
  if (!audio) {
    return null;
  }

  return createAnimationToolAudioPlaybackState({
    audio,
    controlSnapshot: options.controlSnapshot,
    petId: options.petId,
    status: options.status,
    token: options.trigger.token,
  });
}
