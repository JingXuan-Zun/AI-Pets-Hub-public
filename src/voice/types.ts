import { type LocalVoiceAssets, type PetConfig } from '../types';

export type VoiceSettings = PetConfig['settings'];

export interface VoicePlaybackStartOptions {
  playbackRate?: number;
  startAtTime?: number;
}

export interface VoicePlaybackControlSnapshot {
  playbackPositionMs: number;
  playbackState?: 'paused' | 'pending' | 'playing';
  resumeSupported: boolean;
  resumeUnsupportedReason?: string;
}

export interface VoicePlaybackSession {
  stop: () => void;
  done: Promise<void>;
  pause?: () => VoicePlaybackControlSnapshot | null;
  resume?: (positionMs?: number) => VoicePlaybackControlSnapshot | null;
  getPlaybackPositionMs?: () => number | null;
  isPlaybackActive?: () => boolean;
  sampleOutputLevel?: () => number | null;
  scheduler?: 'immediate' | 'clocked';
  scheduledStartTime?: number | null;
  scheduledEndTime?: number | null;
}

export interface PreparedVoicePlayback {
  play: (options?: VoicePlaybackStartOptions) => VoicePlaybackSession;
  dispose: () => void;
  supportsGaplessScheduling?: boolean;
  durationMs?: number | null;
}

export interface VoicePlaybackOptions {
  force?: boolean;
}

export interface VoiceInputSession {
  stop: () => void;
}

export interface StartVoiceInputOptions {
  settings: VoiceSettings;
  localVoiceAssets?: LocalVoiceAssets | null;
  onError: (message: string) => void;
  onFinalTranscript: (transcript: string) => void;
  onInterimTranscript: (transcript: string) => void;
  onListeningChange: (isListening: boolean) => void;
}
