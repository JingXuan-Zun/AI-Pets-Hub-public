import assert from 'node:assert/strict';
import { splitStoryNarrativeText } from '../src/components/chat/story/storyNarrativeTextSegments';

const segments = splitStoryNarrativeText('雨声落在窗外。\u201c别出声。\u201d她压低声音。\u300c跟我来。\u300d');

assert.deepEqual(segments, [
  { kind: 'narration', text: '雨声落在窗外。' },
  { kind: 'dialogue', text: '\u201c别出声。\u201d' },
  { kind: 'narration', text: '她压低声音。' },
  { kind: 'dialogue', text: '\u300c跟我来。\u300d' },
]);
assert.deepEqual(splitStoryNarrativeText('只有场景描写。'), [
  { kind: 'narration', text: '只有场景描写。' },
]);
assert.deepEqual(splitStoryNarrativeText('\u201c尚未说完'), [
  { kind: 'dialogue', text: '\u201c尚未说完' },
]);

console.log('story narrative text segments smoke: PASS');
