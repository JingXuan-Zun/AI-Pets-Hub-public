import { strict as assert } from 'node:assert';
import { createSkillTimelineEditorDraft } from '../src/components/settings/settingsSkillTimelineEditorModel';
import { createSkillTimelineAudioMetadataLane } from '../src/components/settings/settingsSkillTimelineAudioMetadataLane';
import { readProjectFile } from './smokeTestHarness.ts';

const draft = createSkillTimelineEditorDraft(JSON.stringify({
  audioStartDelayMs: 500,
  audioUrl: 'C:/music/song.mp3',
  beatCount: 8,
  bpm: 120,
  durationMs: 4000,
  offsetMs: 250,
  timeline: [
    { animationId: 'wave', beat: 1, track: 'motion' },
  ],
}));

const lane = createSkillTimelineAudioMetadataLane(draft, 5000);
assert.ok(lane);
assert.equal(lane.label, 'C:/music/song.mp3 / 4000ms');
assert.equal(lane.startPercent, 10);
assert.equal(lane.endPercent, 90);
assert.equal(lane.offsetPercent, 15);
assert.deepEqual(lane.beatMarkers.map((marker) => `${marker.label}:${marker.leftPercent}:${marker.timeMs}`), [
  'b1:15:750',
  'b2:25:1250',
  'b3:35:1750',
  'b4:45:2250',
  'b5:55:2750',
  'b6:65:3250',
  'b7:75:3750',
  'b8:85:4250',
]);

const missingDurationDraft = createSkillTimelineEditorDraft(JSON.stringify({
  audioUrl: 'C:/music/song.mp3',
  timeline: [],
}));
assert.equal(createSkillTimelineAudioMetadataLane(missingDurationDraft, 5000), null);

const missingSourceDraft = createSkillTimelineEditorDraft(JSON.stringify({
  durationMs: 4000,
  timeline: [],
}));
assert.equal(createSkillTimelineAudioMetadataLane(missingSourceDraft, 5000), null);

const stripSource = readProjectFile('src/components/settings/SettingsSkillTimelineTrackStrip.tsx');
const laneSource = readProjectFile('src/components/settings/SettingsSkillTimelineAudioMetadataLaneView.tsx');
assert.match(stripSource, /createSkillTimelineAudioMetadataLane/u);
assert.match(stripSource, /SettingsSkillTimelineAudioMetadataLaneView/u);
assert.match(laneSource, /Music2/u);
assert.match(laneSource, /beatMarkers/u);

console.log('agent skill timeline audio metadata lane smoke passed');
