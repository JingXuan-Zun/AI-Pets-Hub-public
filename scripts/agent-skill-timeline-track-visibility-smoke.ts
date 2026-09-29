import { strict as assert } from 'node:assert';
import {
  createSkillTimelineEditorDraft,
  serializeSkillTimelineEditorDraft,
} from '../src/components/settings/settingsSkillTimelineEditorModel';
import { createSkillTimelineEditorTrackRows } from '../src/components/settings/settingsSkillTimelineTrackModel';
import {
  clearSkillTimelineTrackVisibility,
  createDefaultSkillTimelineTrackVisibility,
  createSkillTimelineTrackVisibilitySummary,
  filterSkillTimelineRowsByVisibility,
  isSkillTimelineTrackVisible,
  toggleSkillTimelineTrackHidden,
  toggleSkillTimelineTrackSolo,
} from '../src/components/settings/settingsSkillTimelineTrackVisibility';
import { readProjectFile } from './smokeTestHarness.ts';

const draft = createSkillTimelineEditorDraft(JSON.stringify({
  beatCount: 8,
  bpm: 120,
  trackOrder: ['motion', 'expression', 'audio'],
  timeline: [
    { animationId: 'wave', beat: 1, label: 'Motion', track: 'motion' },
    { expressionId: 'happy', beat: 2, label: 'Face', track: 'expression' },
    { animationId: 'pulse', atMs: 1200, label: 'Audio cue', track: 'audio' },
  ],
}));

const rows = createSkillTimelineEditorTrackRows(draft);
assert.deepEqual(rows.map((row) => row.id), ['motion', 'expression', 'audio']);

const defaultVisibility = createDefaultSkillTimelineTrackVisibility();
assert.deepEqual(filterSkillTimelineRowsByVisibility(rows, defaultVisibility).map((row) => row.id), [
  'motion',
  'expression',
  'audio',
]);

const hiddenMotion = toggleSkillTimelineTrackHidden(defaultVisibility, 'motion');
assert.deepEqual(hiddenMotion.hiddenTrackIds, ['motion']);
assert.equal(isSkillTimelineTrackVisible(hiddenMotion, 'motion'), false);
assert.deepEqual(filterSkillTimelineRowsByVisibility(rows, hiddenMotion).map((row) => row.id), [
  'expression',
  'audio',
]);

const soloExpression = toggleSkillTimelineTrackSolo(hiddenMotion, 'expression');
assert.equal(soloExpression.soloTrackId, 'expression');
assert.deepEqual(filterSkillTimelineRowsByVisibility(rows, soloExpression).map((row) => row.id), [
  'expression',
]);

const summary = createSkillTimelineTrackVisibilitySummary(
  soloExpression,
  rows.map((row) => row.id),
);
assert.equal(summary.isFiltered, true);
assert.equal(summary.hiddenCount, 2);
assert.deepEqual(clearSkillTimelineTrackVisibility(), defaultVisibility);

const serialized = JSON.parse(serializeSkillTimelineEditorDraft(draft)) as Record<string, unknown>;
assert.equal(serialized.hiddenTrackIds, undefined);
assert.equal(serialized.soloTrackId, undefined);
assert.deepEqual(serialized.trackOrder, ['motion', 'expression', 'audio']);

const editorSource = readProjectFile('src/components/settings/SettingsSkillTimelineEditor.tsx');
const managerSource = readProjectFile('src/components/settings/SettingsSkillTimelineTrackManager.tsx');
const overviewSource = readProjectFile('src/components/settings/SettingsSkillTimelineTrackOverview.tsx');
const stripSource = readProjectFile('src/components/settings/SettingsSkillTimelineTrackStrip.tsx');
assert.match(editorSource, /createDefaultSkillTimelineTrackVisibility/u);
assert.match(managerSource, /toggleSkillTimelineTrackHidden/u);
assert.match(managerSource, /toggleSkillTimelineTrackSolo/u);
assert.match(overviewSource, /filterSkillTimelineRowsByVisibility/u);
assert.match(stripSource, /filterSkillTimelineRowsByVisibility/u);

console.log('agent skill timeline track visibility smoke passed');
