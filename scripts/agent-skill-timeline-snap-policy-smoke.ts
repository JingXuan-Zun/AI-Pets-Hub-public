import { strict as assert } from 'node:assert';
import {
  createSkillTimelineStripDragTimingPreview,
  updateSkillTimelineStepTimingFromStripDrag,
} from '../src/components/settings/settingsSkillTimelineStripDragTiming';
import { updateSkillTimelineStepDurationFromStripResize } from '../src/components/settings/settingsSkillTimelineStripResizeDuration';
import { normalizeSkillTimelineSnapPolicy } from '../src/components/settings/settingsSkillTimelineSnapPolicy';
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
      beat: 1,
      durationMs: '',
      expressionId: '',
      holdBeats: '',
      id: 'beat-step',
      label: 'Beat step',
      timingMode: 'beat',
      track: 'motion',
    },
    {
      animationId: 'jump',
      atMs: 0,
      beat: 1,
      durationMs: '',
      expressionId: '',
      holdBeats: '',
      id: 'ms-step',
      label: 'Ms step',
      timingMode: 'atMs',
      track: 'motion',
    },
  ],
  trackOrder: [],
};

const snapPolicy = normalizeSkillTimelineSnapPolicy({
  beatStep: 2,
  holdBeatStep: 0.5,
  msStep: 250,
});

const beatDrag = updateSkillTimelineStepTimingFromStripDrag({
  draft,
  durationMs: 4000,
  leftPercent: 31,
  snapPolicy,
  step: draft.steps[0]!,
});
assert.equal(beatDrag.beat, 4);

const beatPreview = createSkillTimelineStripDragTimingPreview({
  draft,
  durationMs: 4000,
  leftPercent: 31,
  snapPolicy,
  step: draft.steps[0]!,
});
assert.equal(beatPreview.label, 'b4');

const msDrag = updateSkillTimelineStepTimingFromStripDrag({
  draft,
  durationMs: 4000,
  leftPercent: 31,
  snapPolicy,
  step: draft.steps[1]!,
});
assert.equal(msDrag.atMs, 1250);

const resizedMs = updateSkillTimelineStepDurationFromStripResize({
  draft,
  durationMs: 4000,
  rightPercent: 31,
  snapPolicy,
  step: draft.steps[1]!,
});
assert.equal(resizedMs.durationMs, '1250');

const resizedBeat = updateSkillTimelineStepDurationFromStripResize({
  draft,
  durationMs: 4000,
  rightPercent: 31,
  snapPolicy,
  step: draft.steps[0]!,
});
assert.equal(resizedBeat.holdBeats, '2.5');

const editorSource = readProjectFile('src/components/settings/SettingsSkillTimelineEditor.tsx');
const stripSource = readProjectFile('src/components/settings/SettingsSkillTimelineTrackStrip.tsx');
assert.match(editorSource, /SettingsSkillTimelineSnapControls/u);
assert.match(editorSource, /snapPolicy=\{snapPolicy\}/u);
assert.match(stripSource, /snapPolicy\?: Partial<SkillTimelineSnapPolicy>/u);

console.log('agent skill timeline snap policy smoke passed');
