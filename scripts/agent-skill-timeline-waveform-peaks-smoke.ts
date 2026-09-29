import { strict as assert } from 'node:assert';
import {
  createSkillTimelineWaveformPeaksFromAudioBuffer,
  createSkillTimelineWaveformPeaksFromChannelData,
  type SkillTimelineWaveformAudioBufferLike,
} from '../src/components/settings/settingsSkillTimelineWaveformPeaks';
import { readProjectFile } from './smokeTestHarness.ts';

const peaks = createSkillTimelineWaveformPeaksFromChannelData(
  [0, 0.2, -0.4, 0.1, 0.8, -1, 0.5, 0],
  { bucketCount: 4 },
);
assert.deepEqual(peaks, [0.2, 0.4, 1, 0.5]);

const emptyPeaks = createSkillTimelineWaveformPeaksFromChannelData([], { bucketCount: 3 });
assert.deepEqual(emptyPeaks, [0, 0, 0]);

const minBucketPeaks = createSkillTimelineWaveformPeaksFromChannelData([0.5, -1], { bucketCount: 0 });
assert.deepEqual(minBucketPeaks, [1]);

const maxBucketPeaks = createSkillTimelineWaveformPeaksFromChannelData([1], { bucketCount: 999 });
assert.equal(maxBucketPeaks.length, 256);
assert.equal(maxBucketPeaks[0], 1);

const audioBuffer: SkillTimelineWaveformAudioBufferLike = {
  getChannelData: (channel) => (channel === 0 ? [0, 0.25, 0.5, 0.25] : [0, -1, -0.25, 0]),
  length: 4,
  numberOfChannels: 2,
};
assert.deepEqual(createSkillTimelineWaveformPeaksFromAudioBuffer(audioBuffer, { bucketCount: 2 }), [1, 0.5]);

const laneSource = readProjectFile('src/components/settings/SettingsSkillTimelineAudioMetadataLaneView.tsx');
const loaderSource = readProjectFile('src/components/settings/settingsSkillTimelineWaveformLoader.ts');
const hookSource = readProjectFile('src/components/settings/useSettingsSkillTimelineWaveformPeaks.ts');
const stripSource = readProjectFile('src/components/settings/SettingsSkillTimelineTrackStrip.tsx');
assert.match(laneSource, /peaks\?: number\[\]/u);
assert.match(laneSource, /SettingsSkillTimelineWaveformBars/u);
assert.match(laneSource, /bg-primary\/55/u);
assert.match(loaderSource, /decodeAudioData/u);
assert.match(loaderSource, /createSkillTimelineWaveformPeaksFromAudioBuffer/u);
assert.match(hookSource, /loadSkillTimelineWaveformPeaks/u);
assert.match(stripSource, /audioPreviewSource\?\.playbackUrl/u);
assert.match(stripSource, /waveformState\.peaks/u);

console.log('agent skill timeline waveform peaks smoke passed');
