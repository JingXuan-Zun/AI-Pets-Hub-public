const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sessionSource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntimeSessionAssembly.cjs'), 'utf8');
const ts = require('typescript');
const core = require('../electron/localVoiceRuntimeCoreUtils.cjs');
const processes = require('../electron/localVoiceRuntimeProcessUtils.cjs');
const { createLocalVoiceLifecycle } = require('../electron/localVoiceRuntimeLifecycle.cjs');

function loadBaseline(file) {
  const s = fs.readFileSync(file, 'utf8');
  const timerStart = s.indexOf('  const generatedAudioCleanupTimer =');
  const timerEnd = s.indexOf('  const {\n    getModeWorkerPoolSize,', timerStart);
  const cleanStart = s.indexOf('  function cleanupGeneratedAudioCacheBeforeSynthesize()');
  const cleanEnd = s.indexOf('  function ensureRunnerScriptPath()', cleanStart);
  const disposeStart = s.indexOf('  function dispose()');
  const disposeEnd = s.indexOf('  return {\n    cancelSynthesis,', disposeStart);
  assert.ok(timerStart >= 0 && timerEnd > timerStart && cleanStart >= 0 && disposeStart >= 0);
  const body = `let lastSynthesisCacheCleanupAt = 0; ${s.slice(timerStart, timerEnd)}
    ${s.slice(cleanStart, cleanEnd)} ${s.slice(disposeStart, disposeEnd)}
    return { cleanupGeneratedAudioCacheBeforeSynthesize, cancelSynthesis, dispose };`;
  return context => {
    const deps = { ...core, ...processes, ...context, Date: { now: context.now },
      GENERATED_AUDIO_CACHE_CLEANUP_INTERVAL_MS: context.cleanupIntervalMs,
      GENERATED_AUDIO_SYNTHESIS_CLEANUP_MIN_INTERVAL_MS: context.cleanupMinIntervalMs,
      cleanupGeneratedAudioCache: (...args) => context.getCleanupGeneratedAudioCache()(...args),
      destroyModeWorker: (...args) => context.getDestroyModeWorker()(...args) };
    return new Function(...Object.keys(deps), body)(...Object.values(deps));
  };
}

function run(config, baseline) {
  const trace = [], error = new Error('controlled_lifecycle_error');
  const requests = new Map(), workers = new Map(), reference = new Map([['ref', 'text']]);
  let callback, now = 0, stage = '', ready = false;
  const fail = name => { if (config.fault === name) throw error; };
  for (let i = 0; i < config.requests; i++) {
    const signal = { aborted: config.alreadyAborted };
    const request = { id: `tts-${i}`, cancelReason: 'active', controller: { signal,
      abort() { trace.push(['abort', request.id, request.cancelReason]); fail('abort'); signal.aborted = true; } } };
    requests.set(request.id, request);
  }
  for (let i = 0; i < config.workers; i++) workers.set(`worker-${i}`, { id: i });
  reference.clear = () => { trace.push(['reference-clear']); fail('reference-clear'); Map.prototype.clear.call(reference); };
  const timer = {};
  if (config.unref) timer.unref = () => { trace.push(['unref']); fail('unref'); };
  const context = { activeSynthesisRequests: requests, modeWorkerPool: workers, referenceTextCache: reference,
    cleanupIntervalMs: 3600000, cleanupMinIntervalMs: 60000,
    now: () => { trace.push(['now', now]); fail('clock'); return now; },
    setInterval(cb, delay) { trace.push(['interval', delay]); fail('interval'); callback = cb;
      if (config.immediate) cb(); return timer; },
    clearInterval(input) { assert.equal(input, timer); trace.push(['clear-interval']); fail('clear-interval'); },
    getCleanupGeneratedAudioCache: () => reason => {
      trace.push(['cleanup', reason]);
      if (!ready) throw new Error('not_ready');
      fail('cleanup');
    },
    getDestroyModeWorker: () => (worker, reason) => {
      assert.equal(reason, 'runtime_dispose'); trace.push(['destroy', worker.id]); fail('destroy');
      workers.delete(`worker-${worker.id}`);
      if (config.replaceWorkers && worker.id === 0) workers.set('replacement', { id: 'replacement' });
    },
    writeRuntimeLog(message, details) {
      trace.push(['log', message, details]);
      if (message === '请求取消本地语音合成') fail('cancel-log');
      if (message === 'generated_audio_cache_cleanup_failed') fail('cleanup-log');
      if (message === 'Local voice runtime disposed') fail('disposed-log');
    },
  };
  const results = [];
  const call = (name, fn) => {
    stage = name;
    try { results.push([name, fn()]); }
    catch (caught) { results.push([name, { error: caught.message, sameError: caught === error }]); }
  };
  let api;
  call('create', () => { api = baseline ? baseline(context) : createLocalVoiceLifecycle(context); return Boolean(api); });
  ready = true;
  if (api) {
    call('tick', callback);
    for (const time of [0, 59999, 60000, 60001, 10000, 120000]) {
      now = time; call(`before:${time}`, api.cleanupGeneratedAudioCacheBeforeSynthesize);
    }
    call('cancel', () => config.defaultReason ? api.cancelSynthesis() : api.cancelSynthesis('controlled'));
    call('dispose', api.dispose); call('dispose-again', api.dispose);
  }
  assert.notEqual(stage, '');
  return { trace, results, requests: [...requests].map(([key, item]) => [key, item.cancelReason, item.controller.signal.aborted]),
    workers: [...workers.keys()], reference: [...reference] };
}

function independent() {
  const controls = [];
  for (const tag of ['A', 'B']) {
    const requests = new Map(), workers = new Map(), cache = new Map([['ref', tag]]), cleanups = [];
    let tick, now = 60000, clears = 0;
    const api = createLocalVoiceLifecycle({ activeSynthesisRequests: requests, modeWorkerPool: workers,
      referenceTextCache: cache, cleanupIntervalMs: 100, cleanupMinIntervalMs: 60000, writeRuntimeLog() {},
      setInterval: cb => { tick = cb; return {}; }, clearInterval: () => clears++, now: () => now,
      getCleanupGeneratedAudioCache: () => reason => cleanups.push(reason), getDestroyModeWorker: () => () => {} });
    controls.push({ api, cache, cleanups, tick, setTime: time => { now = time; }, clears: () => clears });
  }
  controls[0].api.cleanupGeneratedAudioCacheBeforeSynthesize();
  controls[1].api.cleanupGeneratedAudioCacheBeforeSynthesize();
  controls[0].setTime(60001); controls[0].api.cleanupGeneratedAudioCacheBeforeSynthesize();
  assert.deepEqual(controls.map(x => x.cleanups), [['before_synthesize'], ['before_synthesize']]);
  controls[0].api.dispose(); assert.equal(controls[0].cache.size, 0); assert.equal(controls[1].cache.size, 1);
  assert.equal(controls[0].clears(), 1); assert.equal(controls[1].clears(), 0);
  controls[1].tick(); assert.deepEqual(controls[1].cleanups, ['before_synthesize', 'interval']);
  controls[1].api.dispose();
}

function structure() {
  const p = path.join(__dirname, '../electron/localVoiceRuntimeLifecycle.cjs'), s = fs.readFileSync(p, 'utf8');
  assert.ok(s.split('\n').length <= 300);
  const ast = ts.createSourceFile(p, s, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function visit(n) {
    if (ts.isFunctionDeclaration(n) && n.body) assert.ok(
      ast.getLineAndCharacterOfPosition(n.end).line - ast.getLineAndCharacterOfPosition(n.getStart(ast)).line + 1 <= 50);
    ts.forEachChild(n, visit);
  }
  visit(ast);
  const root = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntime.cjs'), 'utf8');
  assert.match(root, /getCleanupGeneratedAudioCache: \(\) => cleanupGeneratedAudioCache/);
  assert.match(root, /getDestroyModeWorker: \(\) => destroyModeWorker/);
  assert.match(root, /createLocalVoiceSessionAssembly\(\{/);
  assert.ok(sessionSource.indexOf('createLocalVoiceLifecycle({') < sessionSource.indexOf('createLocalVoiceWorkerPool({'));
  assert.doesNotMatch(root, /function (dispose|cancelSynthesis|cleanupGeneratedAudioCacheBeforeSynthesize)\(/);
}

structure();
const baseline = process.argv[2] ? loadBaseline(process.argv[2]) : null;
let count = 0;
for (const requests of [0, 1, 2]) for (const workers of [0, 1, 2]) for (const unref of [false, true]) {
  for (const alreadyAborted of [false, true]) for (const replaceWorkers of [false, true]) for (const defaultReason of [false, true]) {
    const config = { requests, workers, unref, alreadyAborted, replaceWorkers, defaultReason };
    const actual = run(config); if (baseline) assert.deepEqual(actual, run(config, baseline)); count++;
  }
}
for (const fault of ['interval', 'unref', 'clock', 'cleanup', 'abort', 'cancel-log', 'clear-interval', 'destroy',
  'reference-clear', 'disposed-log', 'cleanup-log']) for (const immediate of [false, true]) {
  const config = { requests: 2, workers: 2, unref: true, fault, immediate, replaceWorkers: true };
  const actual = run(config); if (baseline) assert.deepEqual(actual, run(config, baseline)); count++;
}
independent();
console.log(`local voice lifecycle: ${count} timer/throttle/cancel/dispose/error cases and two-instance isolation passed${baseline ? ' against baseline' : ''}`);
