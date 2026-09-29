import { strict as assert } from 'node:assert';
import { readProjectFile } from './smokeTestHarness.ts';

const stripSource = readProjectFile('src/components/settings/SettingsSkillTimelineTrackStrip.tsx');
const stripPiecesSource = readProjectFile('src/components/settings/SettingsSkillTimelineTrackStripPieces.tsx');
const editorSource = readProjectFile('src/components/settings/SettingsSkillTimelineEditor.tsx');

assert.match(stripSource, /selectedStepIds\?: string\[\]/u);
assert.match(stripSource, /selectedStepIds=\{selectedStepIds\}/u);
assert.match(stripPiecesSource, /selectedStepIds\.includes\(item\.id\)/u);
assert.match(stripPiecesSource, /ring-1 ring-primary\/30/u);
assert.match(stripPiecesSource, /TimelineBatchDragPreview/u);
assert.match(stripPiecesSource, /batchDragPreviews\.filter/u);
assert.match(stripPiecesSource, /rowCollisionCount/u);
assert.match(stripPiecesSource, /outline-amber-500/u);
assert.match(stripSource, /createSkillTimelineStripCollisionSummary/u);
assert.match(editorSource, /selectedStepIds=\{selectedStepIds\}/u);

console.log('agent skill timeline strip selection smoke passed');
