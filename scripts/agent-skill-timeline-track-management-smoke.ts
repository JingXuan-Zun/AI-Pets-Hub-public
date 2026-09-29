import { strict as assert } from 'node:assert';
import { type SkillTimelineEditorDraft } from '../src/components/settings/settingsSkillTimelineEditorModel';
import {
  deleteSkillTimelineEditorTrackSteps,
  renameSkillTimelineEditorTrack,
} from '../src/components/settings/settingsSkillTimelineTrackManagement';
import { createSkillTimelineEditorTrackRows } from '../src/components/settings/settingsSkillTimelineTrackModel';
import { moveSkillTimelineEditorTrackOrder } from '../src/components/settings/settingsSkillTimelineTrackOrder';
import { readProjectFile } from './smokeTestHarness.ts';

const draft: SkillTimelineEditorDraft = {
  audioStartDelayMs: '',
  audioUrl: '',
  beatCount: 8,
  bpm: 120,
  durationMs: '4000',
  offsetMs: 0,
  rootExtras: {},
  songId: '',
  steps: [
    {
      animationId: 'wave',
      atMs: 0,
      beat: 1,
      durationMs: '',
      expressionId: '',
      holdBeats: '',
      id: 'motion-1',
      label: 'Motion 1',
      timingMode: 'beat',
      track: 'motion',
    },
    {
      animationId: '',
      atMs: 500,
      beat: 2,
      durationMs: '',
      expressionId: 'happy',
      holdBeats: '',
      id: 'face-1',
      label: 'Face 1',
      timingMode: 'atMs',
      track: 'expression',
    },
    {
      animationId: 'jump',
      atMs: 1000,
      beat: 3,
      durationMs: '',
      expressionId: '',
      holdBeats: '',
      id: 'motion-2',
      label: 'Motion 2',
      timingMode: 'beat',
      track: 'motion',
    },
  ],
  trackOrder: ['expression', 'motion'],
};

assert.deepEqual(createSkillTimelineEditorTrackRows(draft).map((track) => track.id), [
  'expression',
  'motion',
]);

const movedDraft = moveSkillTimelineEditorTrackOrder(draft, 'motion', -1);
assert.deepEqual(movedDraft.trackOrder, ['motion', 'expression']);
assert.deepEqual(createSkillTimelineEditorTrackRows(movedDraft).map((track) => track.id), [
  'motion',
  'expression',
]);
assert.equal(moveSkillTimelineEditorTrackOrder(movedDraft, 'motion', -1), movedDraft);

const renamedDraft = renameSkillTimelineEditorTrack(draft, 'motion', 'Main Motion!');
assert.deepEqual(renamedDraft.steps.map((step) => step.track), [
  'mainmotion',
  'expression',
  'mainmotion',
]);
assert.deepEqual(renamedDraft.trackOrder, ['expression', 'mainmotion']);

const mergedDraft = renameSkillTimelineEditorTrack(renamedDraft, 'mainmotion', 'expression');
assert.deepEqual(mergedDraft.steps.map((step) => step.track), [
  'expression',
  'expression',
  'expression',
]);

const unchangedDraft = renameSkillTimelineEditorTrack(draft, 'missing', 'other');
assert.equal(unchangedDraft, draft);

const deletedDraft = deleteSkillTimelineEditorTrackSteps(draft, 'motion');
assert.deepEqual(deletedDraft.steps.map((step) => step.id), ['face-1']);
assert.deepEqual(deletedDraft.trackOrder, ['expression']);

const editorSource = readProjectFile('src/components/settings/SettingsSkillTimelineEditor.tsx');
const managerSource = readProjectFile('src/components/settings/SettingsSkillTimelineTrackManager.tsx');
const stripSource = readProjectFile('src/components/settings/SettingsSkillTimelineTrackStrip.tsx');
const stripPiecesSource = readProjectFile('src/components/settings/SettingsSkillTimelineTrackStripPieces.tsx');
assert.match(editorSource, /SettingsSkillTimelineTrackManager/u);
assert.match(editorSource, /appendSkillTimelineEditorStepOnTrack/u);
assert.match(managerSource, /renameSkillTimelineEditorTrack/u);
assert.match(managerSource, /deleteSkillTimelineEditorTrackSteps/u);
assert.match(managerSource, /moveSkillTimelineEditorTrackOrder/u);
assert.match(stripSource, /onAddStepOnTrack/u);
assert.match(stripPiecesSource, /title=\{`Add step on \$\{row\.label\}`\}/u);

console.log('agent skill timeline track management smoke passed');
