import { strict as assert } from 'node:assert';
import {
  createSkillTimelineEditorDraft,
  serializeSkillTimelineEditorDraft,
} from '../src/components/settings/settingsSkillTimelineEditorModel';
import {
  createSkillTimelineZoomStyle,
  labelSkillTimelineZoom,
  normalizeSkillTimelineZoomPolicy,
} from '../src/components/settings/settingsSkillTimelineZoomPolicy';
import { readProjectFile } from './smokeTestHarness.ts';

assert.deepEqual(normalizeSkillTimelineZoomPolicy({ scale: 1.4 }), { scale: 1.5 });
assert.deepEqual(normalizeSkillTimelineZoomPolicy({ scale: 9 }), { scale: 3 });
assert.deepEqual(createSkillTimelineZoomStyle({ scale: 2 }), { minWidth: '200%' });
assert.equal(labelSkillTimelineZoom({ scale: 3 }), '3x');

const draft = createSkillTimelineEditorDraft(JSON.stringify({
  beatCount: 8,
  bpm: 120,
  timeline: [
    { animationId: 'wave', beat: 1, track: 'motion' },
  ],
}));
const serialized = JSON.parse(serializeSkillTimelineEditorDraft(draft)) as Record<string, unknown>;
assert.equal(serialized.zoomPolicy, undefined);
assert.equal(serialized.zoomScale, undefined);

const editorSource = readProjectFile('src/components/settings/SettingsSkillTimelineEditor.tsx');
const controlsSource = readProjectFile('src/components/settings/SettingsSkillTimelineZoomControls.tsx');
const stripSource = readProjectFile('src/components/settings/SettingsSkillTimelineTrackStrip.tsx');
assert.match(editorSource, /SettingsSkillTimelineZoomControls/u);
assert.match(editorSource, /DEFAULT_SKILL_TIMELINE_ZOOM_POLICY/u);
assert.match(controlsSource, /SKILL_TIMELINE_ZOOM_OPTIONS/u);
assert.match(stripSource, /createSkillTimelineZoomStyle/u);
assert.match(stripSource, /overflow-x-auto/u);

console.log('agent skill timeline zoom smoke passed');
