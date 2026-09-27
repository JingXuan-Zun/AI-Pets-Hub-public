export interface SkillTimelineWaveformPeakOptions {
  bucketCount: number;
}

export interface SkillTimelineWaveformAudioBufferLike {
  length: number;
  numberOfChannels: number;
  getChannelData: (channel: number) => ArrayLike<number>;
}

function clampBucketCount(bucketCount: number) {
  return Math.max(1, Math.min(256, Math.floor(bucketCount)));
}

function collectBucketPeaks(channelData: ArrayLike<number>, bucketCount: number) {
  const peaks = Array.from({ length: bucketCount }, () => 0);
  const sampleCount = channelData.length;

  for (let bucket = 0; bucket < bucketCount; bucket += 1) {
    const start = Math.floor((bucket / bucketCount) * sampleCount);
    const end = Math.max(start + 1, Math.floor(((bucket + 1) / bucketCount) * sampleCount));

    for (let index = start; index < end && index < sampleCount; index += 1) {
      peaks[bucket] = Math.max(peaks[bucket], Math.abs(channelData[index] ?? 0));
    }
  }

  return peaks;
}

function normalizePeaks(peaks: number[]) {
  const maxPeak = peaks.reduce((max, peak) => Math.max(max, peak), 0);
  if (maxPeak <= 0) {
    return peaks.map(() => 0);
  }

  return peaks.map((peak) => Math.round((peak / maxPeak) * 1000) / 1000);
}

export function createSkillTimelineWaveformPeaksFromChannelData(
  channelData: ArrayLike<number>,
  options: SkillTimelineWaveformPeakOptions,
) {
  const bucketCount = clampBucketCount(options.bucketCount);
  if (channelData.length <= 0) {
    return Array.from({ length: bucketCount }, () => 0);
  }

  return normalizePeaks(collectBucketPeaks(channelData, bucketCount));
}

export function createSkillTimelineWaveformPeaksFromAudioBuffer(
  audioBuffer: SkillTimelineWaveformAudioBufferLike,
  options: SkillTimelineWaveformPeakOptions,
) {
  const bucketCount = clampBucketCount(options.bucketCount);
  const peaks = Array.from({ length: bucketCount }, () => 0);
  const channelCount = Math.max(0, audioBuffer.numberOfChannels);
  if (audioBuffer.length <= 0 || channelCount <= 0) {
    return peaks;
  }

  for (let channel = 0; channel < channelCount; channel += 1) {
    collectBucketPeaks(audioBuffer.getChannelData(channel), bucketCount)
      .forEach((peak, index) => {
        peaks[index] = Math.max(peaks[index], peak);
      });
  }

  return normalizePeaks(peaks);
}
