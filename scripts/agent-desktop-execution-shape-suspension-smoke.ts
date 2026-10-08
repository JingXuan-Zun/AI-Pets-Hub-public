import assert from 'node:assert/strict';
import { readModuleProjectFile } from './projectModuleSource.mjs';

const source = readModuleProjectFile('electron/windowManager.cjs');

assert.match(source, /if \(getIsAgentDesktopExecutionActive\(\)\) \{\s*return;\s*\}/u);
assert.match(source, /const nextIgnore = getIsAgentDesktopExecutionActive\(\)\s*\? !hasInteractiveWindowShape\(\)/u);
assert.match(source, /if \(!nextActive\) \{\s*applyInteractiveWindowShape\(\);/u);
assert.match(source, /nextActive && win !== getMainWindow\(\)/u);
assert.doesNotMatch(source, /chatWindow\.setFocusable\(!nextActive\)/u);
assert.doesNotMatch(source, /settingsWindow\.setFocusable\(!nextActive\)/u);
assert.doesNotMatch(source, /chatWindow\.setIgnoreMouseEvents\(nextActive/u);
assert.doesNotMatch(source, /settingsWindow\.setIgnoreMouseEvents\(nextActive/u);

console.log('agent desktop execution shape suspension smoke ok');
