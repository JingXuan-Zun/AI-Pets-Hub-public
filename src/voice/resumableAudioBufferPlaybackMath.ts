export const WEB_AUDIO_PLAYBACK_LEAD_SEC = 0.012;
const WEB_AUDIO_CROSSFADE_MAX_SEC = 0.032;
const WEB_AUDIO_FADE_IN_MAX_SEC = 0.012;
const WEB_AUDIO_MIN_UNFADED_BODY_SEC = 0.09;

export function disconnectAudioNode(node: AudioNode | null) {
  if (!node) {
    return;
  }

  try {
    node.disconnect();
  } catch {
    // Ignore disconnect failures for already-disposed nodes.
  }
}

export function resolveWebAudioCrossfadeWindow(durationSec: number) {
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    return { fadeInSec: 0, fadeOutSec: 0 };
  }

  const availableFadeSec = Math.max(0, durationSec - WEB_AUDIO_MIN_UNFADED_BODY_SEC);
  const overlapSec = Math.min(WEB_AUDIO_CROSSFADE_MAX_SEC, availableFadeSec * 0.5);
  if (overlapSec <= 0.004) {
    return { fadeInSec: 0, fadeOutSec: 0 };
  }

  return {
    fadeInSec: Math.min(WEB_AUDIO_FADE_IN_MAX_SEC, overlapSec),
    fadeOutSec: overlapSec,
  };
}

export function resolveWebAudioPlaybackPositionMs(options: {
  audioContext: AudioContext;
  bufferDurationMs: number;
  offsetMs: number;
  playbackRate: number;
  startedAtTime: number | null;
}) {
  if (options.startedAtTime === null) {
    return Math.max(0, Math.round(options.offsetMs));
  }

  const elapsedSec = Math.max(0, options.audioContext.currentTime - options.startedAtTime);
  const elapsedMs = options.offsetMs + (elapsedSec * options.playbackRate * 1000);
  return Math.min(options.bufferDurationMs, Math.max(0, Math.round(elapsedMs)));
}
