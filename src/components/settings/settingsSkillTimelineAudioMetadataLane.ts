import { type SkillTimelineEditorDraft } from './settingsSkillTimelineEditorModel';

export interface SkillTimelineAudioBeatMarker {
  label: string;
  leftPercent: number;
  timeMs: number;
}

export interface SkillTimelineAudioMetadataLane {
  beatMarkers: SkillTimelineAudioBeatMarker[];
  endPercent: number;
  label: string;
  offsetPercent: number;
  startPercent: number;
}

const MAX_AUDIO_BEAT_MARKERS = 16;

function optionalPositiveNumber(value: string) {
  const parsed = value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function optionalNonNegativeNumber(value: string) {
  const parsed = value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
}

function createAudioLabel(draft: SkillTimelineEditorDraft, durationMs: number) {
  const sourceLabel = draft.songId.trim() || draft.audioUrl.trim() || 'audio';
  return `${sourceLabel} / ${Math.round(durationMs)}ms`;
}

function createBeatMarkers(
  draft: SkillTimelineEditorDraft,
  stripDurationMs: number,
  audioStartDelayMs: number,
  audioDurationMs: number,
) {
  const beatDurationMs = 60_000 / Math.max(1, draft.bpm);
  const beatCount = Math.max(1, Math.ceil(audioDurationMs / beatDurationMs));
  const beatStep = Math.max(1, Math.ceil(beatCount / MAX_AUDIO_BEAT_MARKERS));
  const markers: SkillTimelineAudioBeatMarker[] = [];

  for (let beat = 1; beat <= beatCount; beat += beatStep) {
    const timeMs = audioStartDelayMs + draft.offsetMs + ((beat - 1) * beatDurationMs);
    if (timeMs >= audioStartDelayMs && timeMs <= audioStartDelayMs + audioDurationMs) {
      markers.push({
        label: `b${beat}`,
        leftPercent: clampPercent((timeMs / stripDurationMs) * 100),
        timeMs: Math.round(timeMs),
      });
    }
  }

  return markers;
}

export function createSkillTimelineAudioMetadataLane(
  draft: SkillTimelineEditorDraft,
  stripDurationMs: number,
): SkillTimelineAudioMetadataLane | null {
  const audioDurationMs = optionalPositiveNumber(draft.durationMs);
  if (audioDurationMs <= 0 || (!draft.songId.trim() && !draft.audioUrl.trim())) {
    return null;
  }

  const audioStartDelayMs = optionalNonNegativeNumber(draft.audioStartDelayMs);
  const audioEndMs = audioStartDelayMs + audioDurationMs;
  return {
    beatMarkers: createBeatMarkers(draft, stripDurationMs, audioStartDelayMs, audioDurationMs),
    endPercent: clampPercent((audioEndMs / stripDurationMs) * 100),
    label: createAudioLabel(draft, audioDurationMs),
    offsetPercent: clampPercent(((audioStartDelayMs + draft.offsetMs) / stripDurationMs) * 100),
    startPercent: clampPercent((audioStartDelayMs / stripDurationMs) * 100),
  };
}
