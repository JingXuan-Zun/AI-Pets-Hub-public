export type ReplyMouthSignalMode = 'audio' | 'text' | 'inactive';

export type ReplyMouthSignalFrame = {
  intensity: number;
  mode: ReplyMouthSignalMode;
};

type ReplyMouthPlaybackLike = {
  getPlaybackPositionMs?: () => number | null;
  isPlaybackActive?: () => boolean;
  sampleOutputLevel?: () => number | null;
};

type ReplyMouthPlaybackSource = {
  createdAtMs: number;
  playback: ReplyMouthPlaybackLike;
  sourceId: string;
  text: string;
};

type ReplyTextActivity = {
  active: boolean;
  lastActivityAtMs: number;
  sourceId: string;
  text: string;
};

const TEXT_ACTIVITY_RELEASE_MS = 260;
const playbackSourcesByPetId = new Map<string, Map<string, ReplyMouthPlaybackSource>>();
const textActivityByPetId = new Map<string, ReplyTextActivity>();

function clamp01(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function resolveNowMs() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function resolveTextCharacterIntensity(character: string, phase: number) {
  if (!character.trim() || /[,.!?;:\u3002\uff0c\uff01\uff1f\uff1b\uff1a\u3001\u2026]/u.test(character)) {
    return 0;
  }
  const characterSeed = character.codePointAt(0) ?? 0;
  const wave = Math.abs(Math.sin(phase * Math.PI * 2 + (characterSeed % 11) * 0.19));
  return 0.24 + wave * 0.62;
}

export function resolveDeterministicTextMouthIntensity(
  text: string,
  elapsedMs: number,
) {
  const characters = Array.from(text.trim());
  if (characters.length === 0 || elapsedMs < 0) {
    return 0;
  }
  const characterDurationMs = 105;
  const characterIndex = Math.floor(elapsedMs / characterDurationMs) % characters.length;
  const characterPhase = (elapsedMs % characterDurationMs) / characterDurationMs;
  return resolveTextCharacterIntensity(characters[characterIndex] ?? '', characterPhase);
}

function samplePlaybackSource(source: ReplyMouthPlaybackSource, nowMs: number) {
  try {
    if (source.playback.isPlaybackActive?.() === false) {
      return null;
    }
    const sampledLevel = source.playback.sampleOutputLevel?.();
    if (typeof sampledLevel === 'number' && Number.isFinite(sampledLevel)) {
      return clamp01(sampledLevel);
    }
    const playbackPositionMs = source.playback.getPlaybackPositionMs?.();
    const elapsedMs = typeof playbackPositionMs === 'number'
      ? playbackPositionMs
      : nowMs - source.createdAtMs;
    return resolveDeterministicTextMouthIntensity(source.text, elapsedMs);
  } catch {
    return null;
  }
}

function sampleAudioSources(petId: string, nowMs: number) {
  const sources = playbackSourcesByPetId.get(petId);
  if (!sources?.size) {
    return null;
  }
  const samples = Array.from(sources.values())
    .map((source) => samplePlaybackSource(source, nowMs))
    .filter((value): value is number => value !== null);
  return samples.length > 0 ? Math.max(...samples) : null;
}

function sampleTextActivity(petId: string, nowMs: number) {
  const activity = textActivityByPetId.get(petId);
  if (!activity) {
    return null;
  }
  const elapsedSinceActivityMs = nowMs - activity.lastActivityAtMs;
  if (!activity.active && elapsedSinceActivityMs > TEXT_ACTIVITY_RELEASE_MS) {
    textActivityByPetId.delete(petId);
    return null;
  }
  const intensity = resolveDeterministicTextMouthIntensity(
    activity.text,
    Math.max(0, elapsedSinceActivityMs),
  );
  const releaseWeight = activity.active
    ? 1
    : clamp01(1 - elapsedSinceActivityMs / TEXT_ACTIVITY_RELEASE_MS);
  return intensity * releaseWeight;
}

export function registerReplyMouthPlayback(options: {
  petId: string | null;
  playback: ReplyMouthPlaybackLike;
  sourceId: string;
  text: string;
}) {
  const petId = options.petId?.trim();
  const sourceId = options.sourceId.trim();
  if (!petId || !sourceId) {
    return () => undefined;
  }
  const sources = playbackSourcesByPetId.get(petId) ?? new Map();
  sources.set(sourceId, {
    createdAtMs: resolveNowMs(),
    playback: options.playback,
    sourceId,
    text: options.text,
  });
  playbackSourcesByPetId.set(petId, sources);
  return () => {
    const currentSources = playbackSourcesByPetId.get(petId);
    currentSources?.delete(sourceId);
    if (currentSources?.size === 0) {
      playbackSourcesByPetId.delete(petId);
    }
  };
}

export function beginReplyTextMouthActivity(
  petId: string,
  sourceId: string,
  nowMs = resolveNowMs(),
) {
  textActivityByPetId.set(petId, {
    active: true,
    lastActivityAtMs: nowMs,
    sourceId,
    text: '',
  });
}

export function writeReplyTextMouthActivity(
  petId: string,
  sourceId: string,
  textChunk: string,
  nowMs = resolveNowMs(),
) {
  if (!textChunk) {
    return;
  }
  const current = textActivityByPetId.get(petId);
  const text = `${current?.sourceId === sourceId ? current.text : ''}${textChunk}`.slice(-240);
  textActivityByPetId.set(petId, {
    active: true,
    lastActivityAtMs: nowMs,
    sourceId,
    text,
  });
}

export function endReplyTextMouthActivity(
  petId: string,
  sourceId: string,
  nowMs = resolveNowMs(),
) {
  const current = textActivityByPetId.get(petId);
  if (!current || current.sourceId !== sourceId) {
    return;
  }
  textActivityByPetId.set(petId, {
    ...current,
    active: false,
    lastActivityAtMs: nowMs,
  });
}

export function sampleReplyMouthSignal(
  petId: string,
  nowMs = resolveNowMs(),
): ReplyMouthSignalFrame {
  const audioIntensity = sampleAudioSources(petId, nowMs);
  if (audioIntensity !== null) {
    return { intensity: audioIntensity, mode: 'audio' };
  }
  const textIntensity = sampleTextActivity(petId, nowMs);
  if (textIntensity !== null) {
    return { intensity: textIntensity, mode: 'text' };
  }
  return { intensity: 0, mode: 'inactive' };
}

export function resetReplyMouthSignals(petId?: string) {
  if (petId) {
    playbackSourcesByPetId.delete(petId);
    textActivityByPetId.delete(petId);
    return;
  }
  playbackSourcesByPetId.clear();
  textActivityByPetId.clear();
}
