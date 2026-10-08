const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createFixture } = require('./local-voice-root-success-fixture.cjs');

async function scenario(packaged) {
  const fixture = createFixture();
  const a = fixture.instance('A', packaged), b = fixture.instance('中文 B', packaged);
  if (packaged) assert.equal(a.runtimeRoot, b.runtimeRoot, 'packaged instances share the executable runtime directory');
  else assert.notEqual(a.runtimeRoot, b.runtimeRoot);
  const { runtime, settings, state } = a;
  assert.equal(fixture.trace.filter(item => item[0] === 'spawn').length, 0);
  const health = await runtime.getHealth(settings);
  assert.equal(health.status, 'ready'); assert.equal(health.ttsReady, true); assert.equal(health.sttReady, true);
  assert.equal(health.referenceReady, true); assert.deepEqual(health.missingPackages, []);
  assert.equal(health.executable, settings.localVoiceRuntimePath);
  assert.equal([...fixture.files.keys()].filter(file => /desktop-pet-probe-.*\.py$/.test(file)).length, 0);
  const warmup = await runtime.warmup(settings);
  assert.equal(warmup.ok, true); assert.equal(warmup.ttsInferenceReady, true);
  assert.deepEqual(warmup.warmedModes.sort(), ['stt', 'tts']);
  const runnerPath = path.join(a.runtimeRoot, 'local_voice_runner.py');
  assert.equal(fixture.files.get(path.resolve(runnerPath)).toString(), 'controlled runner source');
  const output = await runtime.synthesize({ text: 'hello', settings, seed: 12 });
  assert.equal(output.cacheHit, false); assert.equal(output.audioBase64, '');
  assert.equal(output.audioFileUrl, pathToFileURL(output.audioFilePath).href);
  assert.equal(fixture.files.get(path.resolve(output.audioFilePath)).toString(), 'voice:hello');
  const sent = fixture.trace.filter(item => item[0] === 'request').length;
  const cached = await runtime.synthesize({ text: 'hello', settings, seed: 12 });
  assert.equal(cached.cacheHit, true); assert.equal(cached.cacheKey, output.cacheKey);
  assert.equal(cached.audioFilePath, output.audioFilePath);
  assert.equal(fixture.trace.filter(item => item[0] === 'request').length, sent);
  const entries = fixture.files.get(path.resolve(a.runtimeRoot, 'generated-audio-cache', 'manifest.jsonl')).toString()
    .trim().split('\n').map(JSON.parse);
  assert.equal(entries.length, 1); assert.equal(entries[0].hitCount, 1); assert.equal(entries[0].textPreview, 'hello');
  const parallel = await Promise.all(['parallel-A', 'parallel-B'].map(text => runtime.synthesize({ text, settings })));
  assert.notEqual(parallel[0].cacheKey, parallel[1].cacheKey);
  for (const [index, item] of parallel.entries()) {
    assert.equal(fixture.files.get(path.resolve(item.audioFilePath)).toString(), 'voice:parallel-' + (index === 0 ? 'A' : 'B'));
  }
  assert.equal(state.activeSynthesisRequests.size, 0);
  const firstTranscription = runtime.transcribe({ audioBase64: Buffer.from('A-audio').toString('base64'), settings });
  if (a.runtimeRoot === b.runtimeRoot) await firstTranscription;
  const outputs = await Promise.all([firstTranscription,
    b.runtime.transcribe({ audioBase64: Buffer.from('B-audio').toString('base64'), settings: b.settings })]);
  assert.deepEqual(outputs, [{ text: 'transcript:A-audio' }, { text: 'transcript:B-audio' }]);
  assert.equal([...fixture.files.keys()].filter(file => /stt-input-.*\.wav$/.test(file)).length, 0);
  const sameRuntime = await Promise.all(['first', 'second'].map(audio => runtime.transcribe({
    audioBase64: Buffer.from(audio).toString('base64'), settings,
  })));
  assert.deepEqual(sameRuntime, [{ text: 'transcript:first' }, { text: 'transcript:second' }]);
  assert.equal([...fixture.files.keys()].filter(file => /stt-input-.*\.wav$/.test(file)).length, 0);
  assert.notEqual(state.modeWorkerPool, b.state.modeWorkerPool);
  for (const worker of state.modeWorkerPool.values()) {
    assert.equal(worker.pending.size, 0); assert.equal(worker.activeRequestCount, 0);
  }
  const progress = [];
  state.brokenModeRuntimeCandidates.set('controlled-old-failure', { message: 'before install' });
  const install = await runtime.installDependencies(settings, { onProgress: item => progress.push(item) });
  assert.equal(install.ok, true); assert.deepEqual(install.missingPackages, []);
  assert.equal(progress.at(-1).stage, 'completed');
  assert.equal(state.brokenModeRuntimeCandidates.size, 0);
  assert.equal(install.executable, path.join(a.runtimeRoot, 'venv-tts', 'Scripts', 'python.exe'));
  assert.equal(fixture.trace.filter(item => item[0] === 'spawn' && item[2].includes('venv')).length, 2);
  for (const mode of ['tts', 'stt']) assert.ok(fixture.files.has(path.resolve(a.runtimeRoot, 'venv-' + mode, 'Scripts', 'python.exe')));
  assert.equal([...fixture.files.keys()].filter(file => /desktop-pet-probe-.*\.py$/.test(file)).length, 0);
  runtime.dispose();
  assert.equal(state.modeWorkerPool.size, 0); assert.equal(fixture.timers[0].active, false);
  assert.equal(fixture.timers[1].active, true); assert.equal(b.state.modeWorkerPool.size, 1);
  const afterDispose = await b.runtime.transcribe({ audioBase64: Buffer.from('still-B').toString('base64'), settings: b.settings });
  assert.deepEqual(afterDispose, { text: 'transcript:still-B' });
  b.runtime.dispose();
  assert.equal(b.state.modeWorkerPool.size, 0); assert.equal(fixture.timers[1].active, false);
  assert.ok(fixture.children.every(child => child.exitCode === 0));
}
async function main() {
  await scenario(false); await scenario(true);
  console.log('Local voice root success integration: packaged/dev roots, two instances each; health, warmup, synthesis/cache, concurrent transcription, installation and disposal passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
