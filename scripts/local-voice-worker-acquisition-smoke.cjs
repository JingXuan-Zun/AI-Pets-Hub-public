const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const backendSource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntimeBackendAssembly.cjs'), 'utf8');
const { createLocalVoiceWorkerAcquisition } = require('../electron/localVoiceRuntimeWorkerAcquisition.cjs');
const { createLocalVoiceWorkerPool } = require('../electron/localVoiceRuntimeWorkerPool.cjs');
const processUtils = require('../electron/localVoiceRuntimeProcessUtils.cjs');
const rootSource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntime.cjs'), 'utf8');
const assemblySource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntimeWorkerAssembly.cjs'), 'utf8');

function loadBaseline(file) {
  const text = fs.readFileSync(file, 'utf8');
  const start = text.indexOf('  async function ensureModeWorkerReady(');
  const end = text.indexOf('  async function warmupModeWorker(', start);
  assert.ok(start >= 0 && end > start);
  return (dependencies) => new Function(...Object.keys(dependencies),
    `${text.slice(start, end)}; return { ensureModeWorkerReady, ensureModeWorker, acquireModeWorker };`,
  )(...Object.values(dependencies));
}

function createHarness(config, baseline) {
  const { size, workerState, signalState, mode } = config;
  const trace = [];
  const map = new Map();
  const gates = [];
  const listeners = new Set();
  const policy = createLocalVoiceWorkerPool({ modeWorkerPool: map, ttsPoolSize: size, defaultPoolSize: size });
  const makeWorker = (slot, ready) => {
    let resolve, reject;
    const readyPromise = new Promise((yes, no) => { resolve = yes; reject = no; });
    // Observe the source promise so this regression isolates the cleanup-derived promise.
    readyPromise.catch(() => {});
    const worker = { key: policy.buildModeWorkerSlotKey('base', size, slot), baseKey: 'base',
      mode, slotIndex: slot, destroyed: false, ready, readyPromise,
      pending: new Map(), activeRequestCount: 0 };
    gates.push({ worker, resolve: () => { worker.ready = true; resolve(worker); }, reject });
    map.set(worker.key, worker);
    return worker;
  };
  if (workerState !== 'missing') {
    const worker = makeWorker(0, workerState === 'ready');
    worker.destroyed = workerState === 'destroyed';
  }
  const signal = signalState === 'none' ? undefined : {
    aborted: signalState === 'aborted',
    addEventListener(name, listener, options) { trace.push(['add', name, options]); listeners.add(listener); },
    removeEventListener(name, listener) { trace.push(['remove', name]); listeners.delete(listener); },
  };
  const destroyModeWorker = (worker, reason, error) => {
    trace.push(['destroy', reason, error.name, error.message]);
    worker.destroyed = true;
    if (map.get(worker.key) === worker) map.delete(worker.key);
    gates.find((gate) => gate.worker === worker).reject(error);
  };
  const dependencies = { ...policy, ...processUtils, modeWorkerPool: map,
    buildModeWorkerKey: () => 'base', getModeLabel: (value) => value.toUpperCase(),
    createWorkerUnavailableError: (label, value, reason) => new Error(`${label(value)}:${reason}`),
    ensureRunnerScriptPath: () => { trace.push(['script']); return 'runner.py'; },
    createModeWorker: (_, value, model, script, slot) => {
      trace.push(['create', value, model, script, slot]); return makeWorker(slot, false);
    }, destroyModeWorker,
  };
  const api = baseline ? baseline(dependencies) : createLocalVoiceWorkerAcquisition(dependencies);
  return { api, trace, map, gates, listeners, signal,
    abort() { if (signal) { signal.aborted = true; for (const listener of [...listeners]) listener(); } } };
}

async function runScenario(config, baseline) {
  const h = createHarness(config, baseline);
  const unhandled = [];
  const capture = (error, promise) => unhandled.push({ message: error.message,
    source: h.gates.some((gate) => gate.worker.readyPromise === promise) });
  process.on('unhandledRejection', capture);
  try {
    // Treat unused seeded workers as observed by a different consumer.
    h.gates.forEach((gate) => gate.worker.readyPromise.catch(() => {}));
    const promises = [];
    for (let i = 0; i < config.calls; i++) {
      promises.push(h.api[config.method]({}, config.mode, 'model', h.signal));
    }
    const pending = Promise.allSettled(promises);
    const startupError = new Error('startup_failure');
    if (config.outcome === 'abort' && h.signal && !h.signal.aborted) h.abort();
    else for (const gate of h.gates) {
      if (gate.worker.destroyed) continue;
      if (config.outcome === 'failure' && !gate.worker.ready) gate.reject(startupError);
      else gate.resolve();
    }
    const results = await pending;
    const values = results.map((result) => {
      if (result.status === 'rejected') return { status: result.status,
        name: result.reason.name, message: result.reason.message, startupError: result.reason === startupError };
      const worker = result.value.worker || result.value;
      assert.ok(h.gates.some((gate) => gate.worker === worker));
      result.value.release?.();
      return { status: result.status, slot: worker.slotIndex };
    });
    await new Promise(setImmediate);
    await new Promise(setImmediate);
    if (!baseline) assert.deepEqual(unhandled, [], 'observed readiness failures must not create orphan rejections');
    else assert.ok(unhandled.every((item) => !item.source), 'baseline orphan must be a derived promise');
    assert.equal(h.listeners.size, 0);
    for (const gate of h.gates) assert.equal(gate.worker.activeRequestCount, 0);
    return { trace: h.trace, values, keys: [...h.map.keys()], orphanCount: unhandled.length };
  } finally {
    process.removeListener('unhandledRejection', capture);
  }
}

async function runReadyGuards(baseline) {
  const h = createHarness({ size: 1, workerState: 'missing', signalState: 'active', mode: 'tts' }, baseline);
  for (const worker of [null, { mode: 'stt', destroyed: true }]) {
    await assert.rejects(h.api.ensureModeWorkerReady(worker, h.signal), /:destroyed/u);
  }
  assert.equal(h.listeners.size, 0);
  assert.deepEqual(h.trace, []);
}

function checkStructure() {
  const file = path.join(__dirname, '../electron/localVoiceRuntimeWorkerAcquisition.cjs');
  const text = fs.readFileSync(file, 'utf8');
  assert.ok(text.split('\n').length <= 300);
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function visit(node) {
    if (ts.isFunctionLike(node) && node.body) assert.ok(node.getText().split('\n').length <= 50);
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.match(rootSource, /createLocalVoiceBackendAssembly\(\{/u);
  assert.match(backendSource, /createLocalVoiceWorkerAssembly\(\{/u);
  assert.match(assemblySource, /const \{ ensureModeWorker, acquireModeWorker \} = createLocalVoiceWorkerAcquisition\(\{/u);
  assert.doesNotMatch(rootSource, /async function (ensureModeWorkerReady|ensureModeWorker|acquireModeWorker)\(/u);
  assert.doesNotMatch(text, /\.finally\(/u);
}

async function main() {
  checkStructure();
  const baseline = process.argv[2] ? loadBaseline(process.argv[2]) : null;
  let count = 0, reproduced = 0;
  for (const method of ['ensureModeWorker', 'acquireModeWorker']) for (const mode of ['tts', 'stt']) {
    for (const size of [1, 2]) for (const workerState of ['missing', 'ready', 'starting', 'destroyed']) {
      for (const signalState of ['none', 'active', 'aborted']) for (const outcome of ['success', 'failure', 'abort']) {
        const config = { method, mode, size, workerState, signalState, outcome, calls: 2 };
        const actual = await runScenario(config);
        if (baseline) {
          const original = await runScenario(config, baseline);
          reproduced += original.orphanCount;
          assert.deepEqual({ ...actual, orphanCount: 0 }, { ...original, orphanCount: 0 });
        }
        count++;
      }
    }
  }
  await runReadyGuards();
  if (baseline) { await runReadyGuards(baseline); assert.ok(reproduced > 0); }
  console.log(`local voice worker acquisition: ${count} two-call readiness/acquisition scenarios passed${baseline ? `; baseline reproduced ${reproduced} orphan rejections, fixed version 0` : '; 0 orphan rejections'}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
