import assert from 'node:assert/strict';
import { readProjectFile } from './smokeTestHarness.ts';

const source = readProjectFile('electron/windowManager.cjs');

assert.match(source, /if \(isAgentDesktopExecutionActive\) \{\s*return;\s*\}/u);
assert.match(source, /const nextIgnore = isAgentDesktopExecutionActive\s*\? !hasInteractiveWindowShape\(\)/u);
assert.match(source, /if \(!nextActive\) \{\s*applyInteractiveWindowShape\(\);/u);
assert.match(source, /nextActive && win !== mainWindow/u);
assert.doesNotMatch(source, /chatWindow\.setFocusable\(!nextActive\)/u);
assert.doesNotMatch(source, /settingsWindow\.setFocusable\(!nextActive\)/u);
assert.doesNotMatch(source, /chatWindow\.setIgnoreMouseEvents\(nextActive/u);
assert.doesNotMatch(source, /settingsWindow\.setIgnoreMouseEvents\(nextActive/u);

console.log('agent desktop execution shape suspension smoke ok');
