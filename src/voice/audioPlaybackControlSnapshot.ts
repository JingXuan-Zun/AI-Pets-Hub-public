import { type VoicePlaybackControlSnapshot } from './types';

export function createPlaybackControlSnapshot(
  playbackPositionMs: number,
  playbackState: VoicePlaybackControlSnapshot['playbackState'],
): VoicePlaybackControlSnapshot {
  return {
    playbackPositionMs: Math.max(0, Math.round(playbackPositionMs)),
    playbackState,
    resumeSupported: true,
  };
}

export function createUnsupportedPlaybackControlSnapshot(
  reason: string,
): VoicePlaybackControlSnapshot {
  return {
    playbackPositionMs: 0,
    resumeSupported: false,
    resumeUnsupportedReason: reason,
  };
}

export function createDeferredPlaybackDone() {
  let resolveDone = () => undefined;
  let rejectDone = (_error: Error) => undefined;
  const done = Promise.race([
    new Promise<void>((resolve) => {
      resolveDone = resolve;
    }),
    new Promise<void>((_resolve, reject) => {
      rejectDone = reject;
    }),
  ]);

  return { done, rejectDone, resolveDone };
}
