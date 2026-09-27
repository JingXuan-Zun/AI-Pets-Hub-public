import { type DesktopPetAnimationToolAudioPlaybackState } from '../../chatState';

export function shouldTickAnimationToolAudioProgress(
  state: DesktopPetAnimationToolAudioPlaybackState | null | undefined,
) {
  return Boolean(
    state?.status === 'playing'
      && (
        state.durationMs !== undefined
        || state.resumeSupported === true
      ),
  );
}
