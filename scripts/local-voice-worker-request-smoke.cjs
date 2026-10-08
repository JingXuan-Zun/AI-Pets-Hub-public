const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const ts = require('typescript');
const backendSource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntimeBackendAssembly.cjs'), 'utf8');
const command = require('../electron/localVoiceRuntimeCommandUtils.cjs');
const processUtils = require('../electron/localVoiceRuntimeProcessUtils.cjs');
const { createLocalVoiceRuntimeWorkerUtils } = require('../electron/localVoiceRuntimeWorkerUtils.cjs');
const { createLocalVoiceWorkerRequest } = require('../electron/localVoiceRuntimeWorkerRequest.cjs');
const { createLocalVoiceWorkerEvents } = require('../electron/localVoiceRuntimeWorkerEvents.cjs');
const { createLocalVoiceWorkerShutdown } = require('../electron/localVoiceRuntimeWorkerShutdown.cjs');
const rootSource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntime.cjs'), 'utf8');
const assemblySource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntimeWorkerAssembly.cjs'), 'utf8');
const helpers = createLocalVoiceRuntimeWorkerUtils({
  bundledPythonPath: '', describeRuntimeCandidate: (candidate) => candidate.executable,
  getModeEnvDirectory: (root, mode) => path.join(root, mode), isPathInside: () => false,
  normalizeComparablePath: (value) => value, portableExecutableDir: '', projectRoot: 'project',
  runtimeRoot: 'runtime', splitOutputLines: command.splitOutputLines, takeTail: command.takeTail,
});

function loadBaseline(file) {
  const text = fs.readFileSync(file, 'utf8');
  const start = text.indexOf('  async function requestModeWorker(');
  const end = text.indexOf('  async function warmupModeWorker(', start);
  assert.ok(start >= 0 && end > start);
  return (dependencies) => new Function(...Object.keys(dependencies),
    `${text.slice(start, end)}; return requestModeWorker;`,
  )(...Object.values(dependencies));
}

function createHarness(config, baseline) {
  const { mode, signalState, workerState, sequence, fault } = config;
  const trace = [];
  const listeners = new Set();
  const signal = signalState === 'none' ? undefined : {
    aborted: signalState === 'aborted',
    addEventListener(name, listener, options) {
      trace.push(['add', name, options]); listeners.add(listener);
      if (fault === 'add') throw new Error('add_failure');
    },
    removeEventListener(name, listener) { trace.push(['remove', name]); listeners.delete(listener); },
  };
  const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
  const writeCallbacks = [];
  const writeError = new Error('write_failure');
  child.stdin = {
    destroyed: workerState === 'stdin-destroyed',
    end: () => trace.push(['end']),
    write(input, encoding, callback) {
      trace.push(['write', input, encoding]); writeCallbacks.push(callback);
      if (sequence === 'write-throw') throw writeError;
      if (sequence === 'sync-write-error') callback(writeError);
    },
  };
  if (workerState === 'no-stdin') child.stdin = null;
  const candidate = { executable: 'python.exe', args: [] };
  const worker = workerState === 'null' ? null : { key: 'key', baseKey: 'base', mode, candidate,
    modelPath: 'model', slotIndex: 0, process: child, pending: new Map(), nextRequestId: 3,
    destroyed: workerState === 'destroyed', ready: true, shutdownReason: 'running' };
  const pool = new Map(worker ? [['key', worker]] : []);
  const errorValue = (error) => error ? { name: error.name, message: error.message } : null;
  const writeRuntimeLog = (message, details) => {
    trace.push(['log', message, details]);
    if (fault === 'sent-log' && message.endsWith('sent')) throw new Error('sent-log_failure');
  };
  const getModeLabel = (value) => value.toUpperCase();
  const shutdown = createLocalVoiceWorkerShutdown({ modeWorkerPool: pool,
    createWorkerUnavailableError: helpers.createWorkerUnavailableError, getModeLabel, writeRuntimeLog,
    isRunning: () => false, terminate: () => trace.push(['terminate']),
  });
  const dependencies = { ...command, ...processUtils, ...helpers, getModeLabel, writeRuntimeLog,
    describeRuntimeCandidate: (value) => value.executable, getModeWorkerPoolSize: () => 1,
    destroyModeWorker: (value, reason, error) => {
      trace.push(['destroy', reason, errorValue(error)]);
      shutdown.destroyModeWorker(value, reason, error);
    },
    summarizeWorkerPayload: (payload) => {
      if (fault === 'summary') throw new Error('summary_failure');
      return helpers.summarizeWorkerPayload(payload);
    },
    buildWorkerRequestInput: (id, payload) => {
      if (fault === 'input') throw new Error('input_failure');
      return helpers.buildWorkerRequestInput(id, payload);
    },
  };
  const request = baseline ? baseline(dependencies) : createLocalVoiceWorkerRequest(dependencies).requestModeWorker;
  if (worker) createLocalVoiceWorkerEvents({ ...dependencies, child, worker, mode, modelPath: 'model' }).attach();
  const abort = () => { if (signal) { signal.aborted = true; for (const listener of [...listeners]) listener(); } };
  const respond = (id, ok = true) => {
    child.stdout.emit('data', Buffer.from(JSON.stringify({ id, ok, audio_file_path: 'audio.wav' }) + '\n'));
  };
  return { request, worker, candidate, child, signal, listeners, trace, writeCallbacks, writeError, abort, respond, errorValue };
}

async function runScenario(config, baseline) {
  const h = createHarness(config, baseline);
  const { worker, signal, trace, writeCallbacks, writeError, abort, respond, errorValue } = h;
  const payload = { text: '你好', seed: 1 };
  const pending = h.request(worker, payload, signal);
  const observed = pending.then((value) => {
    assert.equal(value.candidate, h.candidate);
    return { status: 'fulfilled', value: { ...value, candidate: value.candidate } };
  }, (error) => ({ status: 'rejected', error: errorValue(error), sameWriteError: error === writeError }));
  const valid = worker && config.workerState === 'normal' && config.signalState !== 'aborted';
  if (valid && !config.fault) {
    const id = `${config.mode}-4`;
    const callback = writeCallbacks[0];
    if (config.sequence === 'abort' && signal) abort();
    else if (config.sequence === 'async-write-error') callback(writeError);
    else if (config.sequence === 'response-then-write-error') { respond(id); callback(writeError); }
    else if (config.sequence === 'write-error-then-response') { callback(writeError); respond(id); }
    else if (!['write-throw', 'sync-write-error'].includes(config.sequence)) {
      callback(null); respond(id, config.sequence !== 'failed');
      if (config.sequence === 'double-response') respond(id);
    }
  }
  const result = await observed;
  assert.equal(worker?.nextRequestId ?? 3, valid ? 4 : 3);
  if (!config.fault && valid) {
    assert.equal(worker.pending.size, 0);
    assert.equal(h.listeners.size, 0);
    const rejected = ['async-write-error', 'sync-write-error', 'write-throw', 'write-error-then-response'].includes(config.sequence)
      || (config.sequence === 'abort' && signal);
    assert.equal(result.status, rejected ? 'rejected' : 'fulfilled');
    if (result.status === 'fulfilled') assert.equal(result.value.ok, config.sequence !== 'failed');
  }
  return { trace, result, nextId: worker?.nextRequestId, pending: worker ? [...worker.pending.keys()] : [],
    destroyed: worker?.destroyed, reason: worker?.shutdownReason, listeners: h.listeners.size };
}

async function runConcurrent(aborted, baseline) {
  const h = createHarness({ mode: 'tts', signalState: 'active', workerState: 'normal', sequence: 'success' }, baseline);
  const requests = [h.request(h.worker, { text: 'one' }, h.signal), h.request(h.worker, { text: 'two' }, h.signal)];
  const pending = Promise.allSettled(requests);
  assert.deepEqual([...h.worker.pending.keys()], ['tts-4', 'tts-5']);
  if (aborted) h.abort();
  else { h.respond('tts-5'); h.respond('tts-4'); }
  const results = await pending;
  assert.equal(h.worker.pending.size, 0);
  assert.equal(h.listeners.size, 0);
  if (aborted) {
    assert.equal(results[0].reason, results[1].reason);
    assert.equal(results[0].reason.name, 'AbortError');
  } else {
    assert.equal(results[0].value.parsed.id, 'tts-4');
    assert.equal(results[1].value.parsed.id, 'tts-5');
  }
  return { trace: h.trace, results: results.map((result) => result.status === 'fulfilled'
    ? { status: result.status, value: result.value } : { status: result.status, error: h.errorValue(result.reason) }) };
}

function checkStructure() {
  const file = path.join(__dirname, '../electron/localVoiceRuntimeWorkerRequest.cjs');
  const text = fs.readFileSync(file, 'utf8');
  assert.ok(text.split('\n').length <= 300);
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function visit(node) {
    if (ts.isFunctionLike(node) && node.body) assert.ok(node.getText().split('\n').length <= 50);
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.doesNotMatch(rootSource, /async function requestModeWorker\(/u);
  assert.match(rootSource, /createLocalVoiceBackendAssembly\(\{/u);
  assert.match(backendSource, /createLocalVoiceWorkerAssembly\(\{/u);
  assert.match(assemblySource, /createLocalVoiceWorkerRequest\(\{\s*createWorkerUnavailableError, getModeLabel, destroyModeWorker,\s*buildWorkerRequestResult, writeRuntimeLog, describeRuntimeCandidate,\s*getModeWorkerPoolSize, summarizeWorkerPayload, buildWorkerRequestInput, buildJsonError,/u);
}

async function main() {
  checkStructure();
  const baseline = process.argv[2] ? loadBaseline(process.argv[2]) : null;
  let count = 0;
  for (const mode of ['tts', 'stt']) for (const signalState of ['none', 'active', 'aborted']) {
    for (const workerState of ['normal', 'destroyed', 'no-stdin', 'stdin-destroyed', 'null']) {
      for (const sequence of ['success', 'failed', 'async-write-error', 'sync-write-error', 'write-throw',
        'abort', 'response-then-write-error', 'write-error-then-response', 'double-response']) {
        const config = { mode, signalState, workerState, sequence };
        const actual = await runScenario(config);
        if (baseline) assert.deepEqual(actual, await runScenario(config, baseline));
        count++;
      }
    }
  }
  for (const fault of ['add', 'sent-log', 'summary', 'input']) {
    const config = { mode: 'tts', signalState: 'active', workerState: 'normal', sequence: 'success', fault };
    const actual = await runScenario(config);
    assert.equal(actual.result.error.message, `${fault}_failure`);
    if (baseline) assert.deepEqual(actual, await runScenario(config, baseline));
    count++;
  }
  for (const aborted of [false, true]) {
    const actual = await runConcurrent(aborted);
    if (baseline) assert.deepEqual(actual, await runConcurrent(aborted, baseline));
  }
  console.log(`local voice worker request: ${count} request/error scenarios and 2 concurrent scenarios passed${baseline ? ' against baseline' : ''}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
