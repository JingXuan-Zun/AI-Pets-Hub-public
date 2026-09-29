export interface AgentCharacterAnimationTimelineSync {
  audioOffsetMs?: number;
  audioStartDelayMs?: number;
  audioUrl?: string;
  beatCount: number;
  bpm?: number;
  durationMs?: number;
  source: 'audio' | 'metadata' | 'music' | 'song';
  sourceRef: string;
}

export interface AgentCharacterAnimationTimelineStepSync {
  beat?: number;
  bar?: number;
  holdBeats?: number;
}

const AUDIO_SOURCE_KEYS = ['songId', 'song', 'musicId', 'music', 'audioId', 'audioUrl'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function finiteNumberInput(value: unknown) {
  const numberValue = typeof value === 'number'
    ? value
    : trimString(value) ? Number(value) : NaN;

  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function finitePositiveNumberInput(value: unknown) {
  const numberValue = finiteNumberInput(value);
  return numberValue !== undefined && numberValue > 0 ? numberValue : undefined;
}

function finiteMsInput(value: unknown) {
  const numberValue = finiteNumberInput(value);
  return numberValue === undefined ? undefined : Math.max(0, Math.round(numberValue));
}

function resolveNestedSyncInput(input: Record<string, unknown>) {
  return isRecord(input.sync)
    ? input.sync
    : isRecord(input.musicSync)
      ? input.musicSync
      : null;
}

function getInputValue(input: Record<string, unknown>, key: string) {
  const nestedSync = resolveNestedSyncInput(input);
  return input[key] ?? nestedSync?.[key];
}

function resolveAudioSource(input: Record<string, unknown>) {
  for (const key of AUDIO_SOURCE_KEYS) {
    const value = trimString(getInputValue(input, key));
    if (value) {
      return {
        source: key.startsWith('audio') ? 'audio' as const : key.startsWith('music') ? 'music' as const : 'song' as const,
        sourceRef: value,
      };
    }
  }

  return null;
}

function resolveAudioUrl(input: Record<string, unknown>) {
  return trimString(getInputValue(input, 'audioUrl'));
}

export function resolveAgentCharacterAnimationTimelineSync(
  input: Record<string, unknown>,
): AgentCharacterAnimationTimelineSync | null {
  const audioSource = resolveAudioSource(input);
  const bpm = finitePositiveNumberInput(getInputValue(input, 'bpm'));
  const durationMs = finiteMsInput(getInputValue(input, 'durationMs') ?? getInputValue(input, 'audioDurationMs'));
  const audioOffsetMs = finiteMsInput(getInputValue(input, 'audioOffsetMs') ?? getInputValue(input, 'offsetMs'));
  const audioStartDelayMs = finiteMsInput(getInputValue(input, 'audioStartDelayMs') ?? getInputValue(input, 'startDelayMs'));
  const beatCount = finitePositiveNumberInput(getInputValue(input, 'beatCount'));

  if (
    !audioSource
    && !bpm
    && !durationMs
    && audioOffsetMs === undefined
    && audioStartDelayMs === undefined
    && !beatCount
  ) {
    return null;
  }

  return {
    audioOffsetMs,
    audioStartDelayMs,
    audioUrl: resolveAudioUrl(input) || undefined,
    beatCount: beatCount === undefined ? 0 : Math.round(beatCount),
    bpm,
    durationMs,
    source: audioSource?.source ?? 'metadata',
    sourceRef: audioSource?.sourceRef ?? 'timeline-sync',
  };
}

export function resolveAgentCharacterAnimationTimelineStepSync(
  value: Record<string, unknown>,
): AgentCharacterAnimationTimelineStepSync | null {
  const beat = finitePositiveNumberInput(value.beat ?? value.beatIndex);
  const bar = finitePositiveNumberInput(value.bar ?? value.measure);
  const holdBeats = finitePositiveNumberInput(value.holdBeats ?? value.beats);

  if (beat === undefined && bar === undefined && holdBeats === undefined) {
    return null;
  }

  return {
    beat,
    bar,
    holdBeats,
  };
}

export function createAgentCharacterAnimationTimelineSyncObservations(
  sync: AgentCharacterAnimationTimelineSync | null,
  steps: Array<{ sync?: AgentCharacterAnimationTimelineStepSync | null }>,
) {
  if (!sync) {
    return [];
  }

  const syncedStepCount = steps.filter((step) => step.sync).length;
  const timingParts = [
    sync.bpm === undefined ? '' : `bpm=${sync.bpm}`,
    sync.audioOffsetMs === undefined ? '' : `offset=${sync.audioOffsetMs}ms`,
    sync.audioStartDelayMs === undefined ? '' : `audioStartDelay=${sync.audioStartDelayMs}ms`,
    sync.durationMs === undefined ? '' : `duration=${sync.durationMs}ms`,
    sync.beatCount > 0 ? `beats=${sync.beatCount}` : '',
  ].filter(Boolean);

  return [
    `Timeline sync: ${sync.source}:${sync.sourceRef}`,
    timingParts.length > 0 ? `Timeline sync timing: ${timingParts.join(', ')}` : '',
    `Timeline sync steps: ${syncedStepCount}`,
  ].filter(Boolean);
}
