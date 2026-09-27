const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
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
assert.match(runtimeSource, /stt-input-\$\{requestId\}\.wav/u);

runtime.dispose();
console.log('localVoiceRuntime smoke ok');
