import { strict as assert } from 'node:assert';
import {
  createSkillTimelineEditorDraft,
  serializeSkillTimelineEditorDraft,
} from '../src/components/settings/settingsSkillTimelineEditorModel';
import { readProjectFile } from './smokeTestHarness.ts';

const draft = createSkillTimelineEditorDraft(JSON.stringify({
  audioUrl: 'C:/music/song.mp3',
  durationMs: 4000,
  timeline: [],
}));
const serialized = JSON.parse(serializeSkillTimelineEditorDraft(draft)) as Record<string, unknown>;
assert.equal(serialized.showAudioMetadataLane, undefined);
assert.equal(serialized.audioMetadataLaneEnabled, undefined);

const editorSource = readProjectFile('src/components/settings/SettingsSkillTimelineEditor.tsx');
const controlsSource = readProjectFile('src/components/settings/SettingsSkillTimelineAudioLaneControls.tsx');
const stripSource = readProjectFile('src/components/settings/SettingsSkillTimelineTrackStrip.tsx');
assert.match(editorSource, /SettingsSkillTimelineAudioLaneControls/u);
assert.match(editorSource, /showAudioMetadataLane/u);
assert.match(controlsSource, /Show audio metadata lane/u);
assert.match(stripSource, /showAudioMetadataLane \? createSkillTimelineAudioMetadataLane/u);

console.log('agent skill timeline audio lane toggle smoke passed');
