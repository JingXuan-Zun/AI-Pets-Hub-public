import assert from 'node:assert/strict';
import { readProjectFile } from './smokeTestHarness.ts';

const source = readProjectFile('src/components/chat/story/StoryModePanel.tsx');

assert.match(source, /const scrollResetKey = `\$\{controller\.draft\.id\}:\$\{controller\.draft\.participantIds\.join\('\|'\)\}`;/u);
assert.match(source, /requestAnimationFrame\(\(\) =>/u);
assert.match(source, /window\.setTimeout\(reset, 120\)/u);
assert.match(source, /scrollTo\(\{ behavior: 'auto', top: 0 \}\)/u);
assert.match(source, /overflowAnchor: 'none'/u);
assert.doesNotMatch(source, /onWheel=\{\(event\) => \{ event\.preventDefault\(\)/u);

console.log('story editor scroll recovery smoke: PASS');
