import assert from 'node:assert/strict';
import { beginVoiceOutputJob, isVoiceOutputActive, setVoiceOutputJobExpiredListener } from '../src/voice/voiceOutputActivity';

// A voice job that never reports its end no longer keeps the pet "speaking" (and the
// hands-free microphone paused) forever: the watchdog ends it and reports it.
let expired = 0;
setVoiceOutputJobExpiredListener(() => { expired += 1; });
const finished = beginVoiceOutputJob(50);
finished();
assert.equal(isVoiceOutputActive(), false);
beginVoiceOutputJob(50); // leaked: never ended by its owner
assert.equal(isVoiceOutputActive(), true);
await new Promise((resolve) => { setTimeout(resolve, 120); });
assert.equal(isVoiceOutputActive(), false, 'the leaked job is released');
assert.equal(expired, 1, 'only the leaked job is reported');
console.log('voice output watchdog smoke ok');
