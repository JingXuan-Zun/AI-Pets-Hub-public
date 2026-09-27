import { strict as assert } from 'node:assert';
import { createSkillTimelineStripCollisionSummary } from '../src/components/settings/settingsSkillTimelineStripCollision';
import { createSkillTimelineStripPreviewCollisionSummary } from '../src/components/settings/settingsSkillTimelineStripPreviewCollision';
import { type SkillTimelineEditorStripRow } from '../src/components/settings/settingsSkillTimelineStripModel';
import { readProjectFile } from './smokeTestHarness.ts';

const rows: SkillTimelineEditorStripRow[] = [
  {
    id: 'motion',
    label: 'motion',
    items: [
      {
        delayMs: 0,
        durationMs: 500,
        endMs: 500,
        id: 'first',
        label: 'First',
        leftPercent: 0,
        widthPercent: 10,
      },
      {
        delayMs: 1000,
        durationMs: 500,
        endMs: 1500,
        id: 'second',
        label: 'Second',
        leftPercent: 50,
        widthPercent: 10,
      },
    ],
  },
  {
    id: 'expression',
    label: 'expression',
    items: [
      {
        delayMs: 1000,
        durationMs: 500,
        endMs: 1500,
        id: 'parallel',
        label: 'Parallel',
        leftPercent: 50,
        widthPercent: 10,
      },
    ],
  },
];

const baseSummary = createSkillTimelineStripCollisionSummary(rows);
assert.deepEqual(baseSummary.collisionStepIds, []);

const dragPreviewSummary = createSkillTimelineStripPreviewCollisionSummary({
  baseSummary,
  preview: {
    durationMs: 500,
    leftPercent: 45,
    stepId: 'first',
  },
  rows,
  stripDurationMs: 2000,
});
assert.deepEqual(new Set(dragPreviewSummary.collisionStepIds), new Set(['first', 'second']));
assert.equal(dragPreviewSummary.rowCollisionCounts.motion, 2);
assert.equal(dragPreviewSummary.rowCollisionCounts.expression, undefined);

const resizePreviewSummary = createSkillTimelineStripPreviewCollisionSummary({
  baseSummary,
  preview: {
    durationMs: 1200,
    leftPercent: 0,
    stepId: 'first',
  },
  rows,
  stripDurationMs: 2000,
});
assert.deepEqual(new Set(resizePreviewSummary.collisionStepIds), new Set(['first', 'second']));

const stripSource = readProjectFile('src/components/settings/SettingsSkillTimelineTrackStrip.tsx');
assert.match(stripSource, /createSkillTimelineStripPreviewCollisionSummary/u);
assert.match(stripSource, /previewCollisionSummary\.collisionStepIds/u);

console.log('agent skill timeline preview collision smoke passed');
