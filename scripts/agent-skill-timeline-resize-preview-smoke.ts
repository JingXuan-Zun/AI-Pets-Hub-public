import { strict as assert } from 'node:assert';
import { createSkillTimelineStripResizePreview } from '../src/components/settings/settingsSkillTimelineStripResizeDuration';
import { type SkillTimelineEditorDraft } from '../src/components/settings/settingsSkillTimelineEditorModel';
import { readProjectFile } from './smokeTestHarness.ts';

const draft: SkillTimelineEditorDraft = {
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
      beat: 2,
      durationMs: '',
      expressionId: '',
      holdBeats: '',
      id: 'beat-step',
      label: 'Beat step',
      timingMode: 'beat',
      track: 'motion',
    },
  ],
  trackOrder: [],
};

const beatResizePreview = createSkillTimelineStripResizePreview({
  draft,
  durationMs: 4000,
  rightPercent: 50,
  snapPolicy: { holdBeatStep: 0.5 },
  step: draft.steps[0]!,
});
assert.equal(beatResizePreview.leftPercent, 12.5);
assert.equal(beatResizePreview.rightPercent, 50);
assert.equal(beatResizePreview.widthPercent, 37.5);
assert.equal(beatResizePreview.durationMs, 1500);
assert.equal(beatResizePreview.label, '3 beats');
assert.equal(beatResizePreview.isAtMinimum, false);

const minimumResizePreview = createSkillTimelineStripResizePreview({
  draft,
  durationMs: 4000,
  rightPercent: 0,
  snapPolicy: { holdBeatStep: 0.5 },
  step: draft.steps[0]!,
});
assert.equal(minimumResizePreview.widthPercent, 0);
assert.equal(minimumResizePreview.durationMs, 0);
assert.equal(minimumResizePreview.isAtMinimum, true);

const piecesSource = readProjectFile('src/components/settings/SettingsSkillTimelineTrackStripPieces.tsx');
const componentSource = readProjectFile('src/components/settings/SettingsSkillTimelineResizePreview.tsx');
assert.match(piecesSource, /SettingsSkillTimelineResizePreview/u);
assert.match(componentSource, /border-dashed/u);
assert.match(componentSource, /isAtMinimum/u);
assert.match(componentSource, /rounded-full/u);

console.log('agent skill timeline resize preview smoke passed');
