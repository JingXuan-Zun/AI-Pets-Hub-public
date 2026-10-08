const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const sessionSource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntimeSessionAssembly.cjs'), 'utf8');
const { createLocalVoiceRuntime } = require('../electron/localVoiceRuntime.cjs');

const runtime = createLocalVoiceRuntime({
  app: {
    isPackaged: false,
    getPath(name) {
      return path.join(process.cwd(), '.tmp-smoke-userdata', name || 'userData');
    },
  },
  localVoiceLibrary: {},
  log() {},
  projectRoot: process.cwd(),
});

assert.equal(typeof runtime.cancelSynthesis, 'function');
assert.equal(typeof runtime.dispose, 'function');
assert.equal(typeof runtime.getHealth, 'function');
assert.equal(typeof runtime.installDependencies, 'function');
assert.equal(typeof runtime.synthesize, 'function');
assert.equal(typeof runtime.transcribe, 'function');

const runtimeSource = fs.readFileSync(
  require.resolve('../electron/localVoiceRuntime.cjs'),
  'utf8',
);
const stateSource = fs.readFileSync(require.resolve('../electron/localVoiceRuntimeState.cjs'), 'utf8');
const transcriptionSource = fs.readFileSync(
  require.resolve('../electron/localVoiceRuntimeTranscription.cjs'),
  'utf8',
);
assert.match(runtimeSource, /createLocalVoiceSessionAssembly\(\{/u);
  assert.match(sessionSource, /createLocalVoiceRuntimeState\(\)/u);
assert.match(stateSource, /nextTranscriptionRequestId: \(\) => `stt-\$\{\+\+transcriptionSequence\}`/u);
assert.match(transcriptionSource, /stt-input-\$\{requestId\}\.wav/u);

runtime.dispose();
console.log('localVoiceRuntime smoke ok');
