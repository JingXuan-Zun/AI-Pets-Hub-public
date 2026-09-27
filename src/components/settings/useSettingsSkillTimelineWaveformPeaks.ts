import { useEffect, useState } from 'react';
import { loadSkillTimelineWaveformPeaks } from './settingsSkillTimelineWaveformLoader';

export interface SettingsSkillTimelineWaveformPeakState {
  error?: string;
  peaks: number[];
  status: 'failed' | 'idle' | 'loading' | 'ready';
}

const EMPTY_WAVEFORM_STATE: SettingsSkillTimelineWaveformPeakState = {
  peaks: [],
  status: 'idle',
};

export function useSettingsSkillTimelineWaveformPeaks(
  playbackUrl: string | null | undefined,
  bucketCount: number,
) {
  const [state, setState] = useState<SettingsSkillTimelineWaveformPeakState>(EMPTY_WAVEFORM_STATE);

  useEffect(() => {
    let cancelled = false;
    if (!playbackUrl) {
      setState(EMPTY_WAVEFORM_STATE);
      return () => {
        cancelled = true;
      };
    }

    setState({ peaks: [], status: 'loading' });
    void loadSkillTimelineWaveformPeaks(playbackUrl, bucketCount).then((result) => {
      if (cancelled) {
        return;
      }

      setState(result.status === 'ready'
        ? { peaks: result.peaks, status: 'ready' }
        : { error: result.error, peaks: [], status: 'failed' });
    });

    return () => {
      cancelled = true;
    };
  }, [bucketCount, playbackUrl]);

  return state;
}
