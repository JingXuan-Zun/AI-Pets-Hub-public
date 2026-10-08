const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../electron/localVoiceRuntime.cjs');

function loadRuntime({ cacheExists, earlyTimer, failStartup }) {
  const modules = new Map(), states = [], timers = [], trace = [], assemblies = [];
  const writes = [], logs = [], cleanupCalls = [], publicOutputs = [];
  let creationFailure = false;
  const failure = new Error('controlled mkdir failure');
  const memoryFs = new Proxy({
    existsSync: value => cacheExists && value.endsWith('generated-audio-cache'),
    mkdirSync: value => {
      trace.push(['mkdir', value]);
      if (creationFailure) throw failure;
    },
    readdirSync: () => [],
  }, { get(target, key) {
    if (key in target) return target[key];
    return (...args) => { writes.push([key, ...args]); throw new Error(`unexpected fs.${String(key)}`); };
  } });
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} }; modules.set(file, module);
    const realRequire = createRequire(file);
    const source = fs.readFileSync(file === root && process.argv[2] ? process.argv[2] : file, 'utf8');
    new Function('require', 'module', '__dirname', 'setInterval', 'clearInterval', source)(name => {
      if (name === 'fs' || name === 'node:fs') return memoryFs;
      if (name === 'child_process' || name === 'node:child_process') return new Proxy({}, {
        get: (_, key) => () => { throw new Error(`unexpected process.${String(key)}`); },
      });
      if (name.startsWith('./localVoiceRuntime')) return load(path.resolve(path.dirname(file), name));
      return realRequire(name);
    }, module, path.dirname(file), (callback, interval) => {
      const timer = { callback, interval, active: true, unref() { trace.push(['unref']); } };
      timers.push(timer); trace.push(['timer', interval]);
      if (earlyTimer) callback();
      return timer;
    }, timer => { timer.active = false; trace.push(['clear']); });
    for (const [name, value] of Object.entries(module.exports)) {
      if (typeof value !== 'function' || !/^createLocalVoice|^createRuntime/.test(name)
        || name === 'createLocalVoiceRuntime') continue;
      module.exports[name] = (...args) => {
        assemblies.push(name);
        const result = value(...args);
        if (name === 'createLocalVoiceRuntimeState') states.push(result);
        if (name === 'createLocalVoiceGeneratedAudioCleanup') {
          const cleanup = result.cleanupGeneratedAudioCache;
          result.cleanupGeneratedAudioCache = reason => {
            cleanupCalls.push(reason); return cleanup(reason);
          };
        }
        if (name === 'createLocalVoiceServiceAssembly') publicOutputs.push(result);
        return result;
      };
    }
    return module.exports;
  }
  const { createLocalVoiceRuntime } = load(root);
  function create(tag, isPackaged, projectRoot) {
    creationFailure = failStartup;
    return createLocalVoiceRuntime({
      app: { isPackaged, getPath: () => path.resolve('controlled-userdata', tag) },
      projectRoot, log: message => logs.push([tag, message]),
      localVoiceLibrary: { getCatalog: () => ({ ttsModels: [], sttModels: [], references: [] }) },
    });
  }
  return { create, states, timers, trace, assemblies, writes, logs, cleanupCalls, publicOutputs, failure };
}

function assertRootOrder(names) {
  const stages = ['createLocalVoiceRuntimePaths', 'createLocalVoiceRuntimeState', 'createRuntimeLogger',
    'createLocalVoiceLifecycle', 'createLocalVoiceWorkerPool', 'createRuntimeRootHelpers',
    'createLocalVoiceCacheAssembly', 'createLocalVoiceRuntimeSelectionUtils',
    'createLocalVoiceWorkerAssembly', 'createLocalVoiceSupportAssembly',
    'createLocalVoiceCandidateExecution', 'createLocalVoiceServiceAssembly'];
  let previous = -1;
  for (const stage of stages) {
    const index = names.indexOf(stage);
    assert.ok(index > previous, `root initialization order: ${stage}`); previous = index;
  }
}

async function scenario(isPackaged, projectRoot, cacheExists, earlyTimer) {
  const fixture = loadRuntime({ cacheExists, earlyTimer, failStartup: false });
  const a = fixture.create('A', isPackaged, projectRoot);
  assertRootOrder(fixture.assemblies);
  const b = fixture.create('B', isPackaged, projectRoot);
  const [stateA, stateB] = fixture.states;
  const keys = ['cancelSynthesis', 'dispose', 'getHealth', 'installDependencies', 'warmup', 'synthesize', 'transcribe'];
  assert.deepEqual(Object.keys(a), keys); assert.deepEqual(Object.keys(b), keys);
  for (const key of ['warmup', 'installDependencies', 'synthesize', 'transcribe']) {
    assert.equal(a[key], fixture.publicOutputs[0][key]);
    assert.notEqual(a[key], b[key]);
  }
  for (const key of ['referenceTextCache', 'modeWorkerPool', 'brokenModeRuntimeCandidates', 'activeSynthesisRequests']) {
    assert.notEqual(stateA[key], stateB[key]);
  }
  assert.deepEqual(fixture.cleanupCalls, ['startup', 'startup']);
  assert.equal(fixture.timers.length, 2);
  assert.equal(fixture.trace[0][0], 'timer');
  assert.equal(fixture.timers[0].interval, 3600000);
  if (earlyTimer) assert.equal(fixture.logs.filter(([, message]) => message.startsWith('generated_audio_cache_cleanup_failed')).length, 2);
  fixture.timers[0].callback();
  assert.equal(fixture.cleanupCalls.at(-1), 'interval');
  const before = fixture.cleanupCalls.length;
  const pending = a.synthesize({ text: 'missing assets' });
  assert.equal(stateA.activeSynthesisRequests.size, 1);
  assert.equal(stateB.activeSynthesisRequests.size, 0);
  assert.equal(b.cancelSynthesis(), false);
  assert.equal(a.cancelSynthesis('integration_cancel'), true);
  assert.equal(a.cancelSynthesis(), false);
  const request = [...stateA.activeSynthesisRequests.values()][0];
  assert.equal(request.controller.signal.aborted, true);
  assert.equal(request.cancelReason, 'integration_cancel');
  await assert.rejects(pending, /Local TTS model is not selected/);
  assert.equal(stateA.activeSynthesisRequests.size, 0);
  await assert.rejects(a.synthesize({ text: 'second missing assets' }), /Local TTS model is not selected/);
  assert.equal(fixture.cleanupCalls.length, before + 1, 'synthesis cleanup is throttled per instance');
  await assert.rejects(a.transcribe({ audioBase64: '' }), /Local STT model is not selected/);
  await assert.rejects(b.transcribe({ audioBase64: '' }), /Local STT model is not selected/);
  assert.equal(stateA.nextTranscriptionRequestId(), 'stt-2');
  assert.equal(stateB.nextTranscriptionRequestId(), 'stt-2');
  const warmup = await a.warmup({ ttsProvider: 'local', sttProvider: 'local' });
  assert.deepEqual(warmup, { ok: false, referenceTextReady: false, referenceTextSource: 'missing',
    ttsInferenceReady: false, warmedModes: [] });
  stateA.referenceTextCache.set('A', 'reference'); stateB.referenceTextCache.set('B', 'reference');
  const rejected = [];
  const worker = { key: 'controlled-worker', mode: 'tts', modelPath: 'controlled-model',
    process: { exitCode: 0, stdin: { end: () => fixture.trace.push(['stdin-end']) } },
    pending: new Map([['pending', { abortCleanup: () => fixture.trace.push(['abort-cleanup']),
      reject: error => rejected.push(error) }]]) };
  stateA.modeWorkerPool.set(worker.key, worker);
  const requestB = stateB.createSynthesisRequest();
  a.dispose();
  assert.equal(worker.destroyed, true); assert.equal(worker.shutdownReason, 'runtime_dispose');
  assert.equal(worker.pending.size, 0); assert.equal(stateA.modeWorkerPool.size, 0);
  assert.equal(rejected.length, 1);
  assert.ok(fixture.trace.findIndex(item => item[0] === 'abort-cleanup')
    < fixture.trace.findIndex(item => item[0] === 'stdin-end'));
  assert.equal(fixture.timers[0].active, false); assert.equal(fixture.timers[1].active, true);
  assert.equal(stateA.referenceTextCache.size, 0); assert.equal(stateB.referenceTextCache.size, 1);
  assert.equal(requestB.controller.signal.aborted, false);
  b.dispose();
  assert.equal(requestB.controller.signal.aborted, true);
  assert.equal(requestB.cancelReason, 'runtime_dispose');
  assert.equal(stateB.referenceTextCache.size, 0);
  assert.equal(fixture.timers[1].active, false);
  assert.deepEqual(fixture.writes, [], 'no real files or unexpected fixture writes');
}

async function main() {
  let count = 0;
  for (const isPackaged of [false, true]) for (const projectRoot of [path.resolve('controlled-project'), path.resolve('中文 项目')]) {
    for (const cacheExists of [false, true]) for (const earlyTimer of [false, true]) {
      await scenario(isPackaged, projectRoot, cacheExists, earlyTimer); count++;
    }
  }
  const failed = loadRuntime({ cacheExists: true, earlyTimer: false, failStartup: true });
  assert.throws(() => failed.create('failure', false, path.resolve('controlled-project')), error => error === failed.failure);
  assert.equal(failed.timers.length, 1);
  assert.equal(failed.timers[0].active, true, 'existing startup failure retains timer; no new cleanup policy');
  failed.timers[0].active = false;
  const missingRoot = loadRuntime({ cacheExists: false, earlyTimer: false, failStartup: false });
  assert.throws(() => missingRoot.create('missing-root', false, null), error => error.code === 'ERR_INVALID_ARG_TYPE');
  assert.equal(missingRoot.timers.length, 1);
  assert.equal(missingRoot.timers[0].active, true);
  missingRoot.timers[0].active = false;
  console.log(`Local voice root integration: ${count} configurations, two real runtimes each; early timer, startup failure, missing assets, cancellation and disposal passed.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
