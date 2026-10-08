const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const modulePath = path.join(__dirname, '../electron/localVoiceRuntimeSessionAssembly.cjs');
const source = fs.readFileSync(modulePath, 'utf8');
const names = ['createLocalVoiceRuntimeState', 'createRuntimeLogger', 'resolveBundledPythonPath',
  'resolvePortableExecutableDir', 'createLocalVoiceLifecycle', 'createLocalVoiceWorkerPool'];
const stateKeys = ['referenceTextCache', 'modeWorkerPool', 'brokenModeRuntimeCandidates',
  'activeSynthesisRequests', 'createSynthesisRequest', 'nextTranscriptionRequestId'];
const lifecycleKeys = ['cleanupGeneratedAudioCacheBeforeSynthesize', 'cancelSynthesis', 'dispose'];
const poolKeys = ['getModeWorkerPoolSize', 'buildModeWorkerSlotKey', 'getModeWorkers',
  'getNextModeWorkerSlotIndex', 'selectLeastBusyModeWorker', 'releaseModeWorkerReservation'];
const publicKeys = [...stateKeys, 'writeRuntimeLog', 'bundledPythonPath', 'portableExecutableDir',
  ...lifecycleKeys, ...poolKeys];

function loadBaseline(file) {
  const root = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const start = root.indexOf('  const { referenceTextCache, modeWorkerPool, brokenModeRuntimeCandidates,');
  const end = root.indexOf('  const {\n    getSharedOptions, buildReferenceTextCacheKey,', start);
  assert.ok(start >= 0 && end > start);
  return context => new Function(...Object.keys(context),
    `${root.slice(start, end)} return { ${publicKeys.join(', ')} };`)(...Object.values(context));
}

function controlled(tag, failIndex, baseline) {
  const context = Object.fromEntries(['log', 'GENERATED_AUDIO_CACHE_CLEANUP_INTERVAL_MS',
    'GENERATED_AUDIO_SYNTHESIS_CLEANUP_MIN_INTERVAL_MS', 'LOCAL_TTS_WORKER_POOL_SIZE',
    'LOCAL_DEFAULT_WORKER_POOL_SIZE'].map(key => [key, { key, tag }]));
  context.cleanupGeneratedAudioCache = () => { throw new Error('unexpected cleanup'); };
  context.destroyModeWorker = () => { throw new Error('unexpected destroy'); };
  context.getCleanupGeneratedAudioCache = () => context.cleanupGeneratedAudioCache;
  context.getDestroyModeWorker = () => context.destroyModeWorker;
  const outputs = new Map(), trace = [], failure = new Error('session stage failed');
  function group(keys) {
    return Object.fromEntries(keys.map(key => {
      const value = stateKeys.slice(0, 4).includes(key) ? new Map() : () => key;
      outputs.set(key, value); return [key, value];
    }));
  }
  const factories = Object.fromEntries(names.map((name, index) => [name, (...args) => {
    trace.push([name, index === 1 ? ['log'] : index < 4 ? [] : Object.keys(args[0])]);
    if (index === 1) assert.equal(args[0], context.log);
    if (index < 4 && index !== 1) assert.equal(args.length, 0);
    if (index === 4) {
      const input = args[0];
      for (const key of ['activeSynthesisRequests', 'modeWorkerPool', 'referenceTextCache', 'writeRuntimeLog']) {
        assert.equal(input[key], outputs.get(key));
      }
      assert.equal(input.cleanupIntervalMs, context.GENERATED_AUDIO_CACHE_CLEANUP_INTERVAL_MS);
      assert.equal(input.cleanupMinIntervalMs, context.GENERATED_AUDIO_SYNTHESIS_CLEANUP_MIN_INTERVAL_MS);
      assert.equal(input.getCleanupGeneratedAudioCache(), context.cleanupGeneratedAudioCache);
      assert.equal(input.getDestroyModeWorker(), context.destroyModeWorker);
      if (!baseline) {
        assert.equal(input.getCleanupGeneratedAudioCache, context.getCleanupGeneratedAudioCache);
        assert.equal(input.getDestroyModeWorker, context.getDestroyModeWorker);
      }
    }
    if (index === 5) {
      assert.equal(args[0].modeWorkerPool, outputs.get('modeWorkerPool'));
      assert.equal(args[0].ttsPoolSize, context.LOCAL_TTS_WORKER_POOL_SIZE);
      assert.equal(args[0].defaultPoolSize, context.LOCAL_DEFAULT_WORKER_POOL_SIZE);
    }
    if (index === failIndex) throw failure;
    if (index === 0) return group(stateKeys);
    if (index === 4) return group(lifecycleKeys);
    if (index === 5) return group(poolKeys);
    const key = ['writeRuntimeLog', 'bundledPythonPath', 'portableExecutableDir'][index - 1];
    const value = () => key; outputs.set(key, value); return value;
  }]));
  let result;
  try {
    if (baseline) result = baseline({ ...context, ...factories });
    else {
      const loaded = { exports: {} }, realRequire = createRequire(modulePath);
      new Function('require', 'module', source)(name => name.startsWith('./localVoiceRuntime')
        ? factories : realRequire(name), loaded);
      result = loaded.exports.createLocalVoiceSessionAssembly(context);
    }
  } catch (error) { assert.equal(error, failure); }
  assert.equal(trace.length, failIndex < 0 ? 6 : failIndex + 1);
  if (result) {
    assert.deepEqual(Object.keys(result), publicKeys);
    for (const key of publicKeys) assert.equal(result[key], outputs.get(key));
  }
  return { trace, result: result ? Object.keys(result) : null };
}

const baseline = process.argv[2] ? loadBaseline(process.argv[2]) : null;
for (const tag of ['A', 'B']) for (const failIndex of [-1, 0, 1, 2, 3, 4, 5]) {
  const actual = controlled(tag, failIndex);
  if (baseline) assert.deepEqual(actual, controlled(tag, failIndex, baseline));
}
console.log(`Local voice session assembly: 14 initialization/failure scenarios, shared map and callback identity passed${baseline ? ' against baseline' : ''}.`);
