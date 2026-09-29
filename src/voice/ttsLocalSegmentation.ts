import { getLocalTtsVoiceToneStability } from './ttsLocalProfile';
import { type VoiceSettings } from './types';

const LOCAL_TTS_CHUNK_SOFT_LIMIT = 24;
const LOCAL_TTS_CHUNK_HARD_LIMIT = 36;
const STABLE_LOCAL_TTS_CHUNK_SOFT_LIMIT = 96;
const STABLE_LOCAL_TTS_CHUNK_HARD_LIMIT = 140;
const MOSS_LOCAL_TTS_CHUNK_SOFT_LIMIT = 48;
const MOSS_LOCAL_TTS_CHUNK_HARD_LIMIT = 72;
const MOSS_STABLE_LOCAL_TTS_CHUNK_SOFT_LIMIT = 120;
const MOSS_STABLE_LOCAL_TTS_CHUNK_HARD_LIMIT = 180;
const LOCAL_TTS_VOICE_TONE_STABILITY_MAX = 100;
const LOCAL_TTS_BREAK_REGEX = /(?<=[。！？!?；;])/u;

function interpolateChunkLimit(baseLimit: number, stableLimit: number, stabilityRate: number) {
  return Math.round(baseLimit + ((stableLimit - baseLimit) * stabilityRate));
}

function isMossLocalTtsModel(settings: VoiceSettings) {
  return (settings.localTtsModelId || '').toLowerCase().includes('moss');
}

function getLocalTtsChunkLimits(settings: VoiceSettings) {
  const stabilityRate = getLocalTtsVoiceToneStability(settings) / LOCAL_TTS_VOICE_TONE_STABILITY_MAX;
  if (isMossLocalTtsModel(settings)) {
    return {
      softLimit: interpolateChunkLimit(
        MOSS_LOCAL_TTS_CHUNK_SOFT_LIMIT,
        MOSS_STABLE_LOCAL_TTS_CHUNK_SOFT_LIMIT,
        stabilityRate,
      ),
      hardLimit: interpolateChunkLimit(
        MOSS_LOCAL_TTS_CHUNK_HARD_LIMIT,
        MOSS_STABLE_LOCAL_TTS_CHUNK_HARD_LIMIT,
        stabilityRate,
      ),
    };
  }

  return {
    softLimit: interpolateChunkLimit(
      LOCAL_TTS_CHUNK_SOFT_LIMIT,
      STABLE_LOCAL_TTS_CHUNK_SOFT_LIMIT,
      stabilityRate,
    ),
    hardLimit: interpolateChunkLimit(
      LOCAL_TTS_CHUNK_HARD_LIMIT,
      STABLE_LOCAL_TTS_CHUNK_HARD_LIMIT,
      stabilityRate,
    ),
  };
}

function joinSpeechPieces(left: string, right: string) {
  if (!left) {
    return right;
  }

  return /[A-Za-z0-9]$/u.test(left) && /^[A-Za-z0-9]/u.test(right)
    ? `${left} ${right}`
    : `${left}${right}`;
}

function hardSplitSpeechPiece(piece: string, maxChars: number) {
  const segments: string[] = [];
  let remaining = piece.trim();

  while (remaining.length > maxChars) {
    let splitIndex = remaining.lastIndexOf(' ', maxChars);
    if (splitIndex < Math.floor(maxChars * 0.6)) {
      splitIndex = maxChars;
    }

    const current = remaining.slice(0, splitIndex).trim();
    if (current) {
      segments.push(current);
    }
    remaining = remaining.slice(splitIndex).trim();
  }

  if (remaining) {
    segments.push(remaining);
  }

  return segments;
}

export function splitLocalSpeechText(text: string, settings: VoiceSettings) {
  const normalized = text.trim();

  if (!normalized) {
    return [];
  }

  const { softLimit, hardLimit } = getLocalTtsChunkLimits(settings);

  const pieces = normalized
    .split(LOCAL_TTS_BREAK_REGEX)
    .map((piece) => piece.trim())
    .filter(Boolean)
    .flatMap((piece) => (
      piece.length > hardLimit
        ? hardSplitSpeechPiece(piece, hardLimit)
        : [piece]
    ));

  const chunks: string[] = [];
  let current = '';

  const pushCurrent = () => {
    if (!current) {
      return;
    }

    chunks.push(current);
    current = '';
  };

  for (const piece of pieces) {
    if (!current) {
      current = piece;
      continue;
    }

    const nextChunk = joinSpeechPieces(current, piece);
    if (nextChunk.length <= softLimit) {
      current = nextChunk;
      continue;
    }

    pushCurrent();
    current = piece;
  }

  pushCurrent();
  return chunks.length > 0 ? chunks : [normalized];
}
