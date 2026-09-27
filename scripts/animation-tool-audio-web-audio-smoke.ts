import assert from 'node:assert/strict';
import { readProjectFile } from './smokeTestHarness.ts';

const sessionSource = readProjectFile('src/components/pet/animationToolAudioPlaybackSession.ts');
const controllerSource = readProjectFile('src/components/pet/animationToolAudioPlaybackController.ts');
const runtimeSource = readProjectFile('src/components/pet/animationToolAudioPlaybackRuntime.ts');
const primitiveSource = readProjectFile('src/voice/ttsPlaybackPrimitives.ts');

assert.match(sessionSource, /createPreparedAudioPlayback/u);
assert.match(sessionSource, /supportsGaplessScheduling/u);
assert.match(sessionSource, /resolvePreparedAudioClockStartTime/u);
assert.match(sessionSource, /resolvePreparedAudioClockDelayMs/u);
assert.match(sessionSource, /createAudioPlaybackSession/u);
assert.match(sessionSource, /createDelayedPlaybackSession/u);
assert.match(sessionSource, /wrapPlaybackStartStatus/u);
assert.match(sessionSource, /scheduleBaseDelayMs/u);

assert.match(controllerSource, /createAnimationToolAudioPlaybackSession\(/u);
assert.match(controllerSource, /publishAnimationToolAudioScheduleTiming/u);
assert.match(controllerSource, /clearAnimationToolAudioScheduleTiming/u);
assert.match(controllerSource, /options\.publishStatus\(options\.trigger, 'playing'\)/u);
assert.doesNotMatch(controllerSource, /createAudioPlaybackSession/u);

assert.doesNotMatch(runtimeSource, /scheduleAnimationToolAudioPlaybackStart/u);
assert.match(runtimeSource, /options\.publishStatus\(options\.trigger, 'pending'\)/u);

assert.match(primitiveSource, /export function resolvePreparedAudioClockStartTime/u);
assert.match(primitiveSource, /export function resolvePreparedAudioClockDelayMs/u);

console.log('animation tool audio web audio smoke ok');
