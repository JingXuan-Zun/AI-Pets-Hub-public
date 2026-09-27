import { createSkillTimelineWaveformPeaksFromAudioBuffer } from './settingsSkillTimelineWaveformPeaks';

export interface SkillTimelineWaveformLoadSuccess {
  peaks: number[];
  status: 'ready';
}

export interface SkillTimelineWaveformLoadFailure {
  error: string;
  status: 'failed';
}

export type SkillTimelineWaveformLoadResult =
  | SkillTimelineWaveformLoadFailure
  | SkillTimelineWaveformLoadSuccess;

type WindowWithAudioContextFallback = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

function createAudioContext() {
  const audioWindow = window as WindowWithAudioContextFallback;
  const AudioContextCtor = audioWindow.AudioContext || audioWindow.webkitAudioContext;
  return AudioContextCtor ? new AudioContextCtor() : null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function loadSkillTimelineWaveformPeaks(
  playbackUrl: string,
  bucketCount: number,
): Promise<SkillTimelineWaveformLoadResult> {
  const audioContext = createAudioContext();
  if (!audioContext) {
    return { error: 'AudioContext is not available', status: 'failed' };
  }

  try {
    const response = await fetch(playbackUrl);
    if (!response.ok) {
      return { error: `Audio fetch failed: ${response.status}`, status: 'failed' };
    }

    const encodedAudio = await response.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(encodedAudio);
    return {
      peaks: createSkillTimelineWaveformPeaksFromAudioBuffer(audioBuffer, { bucketCount }),
      status: 'ready',
    };
  } catch (error) {
    return { error: getErrorMessage(error), status: 'failed' };
  } finally {
    void audioContext.close();
  }
}
