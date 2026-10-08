const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const backendSource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntimeBackendAssembly.cjs'), 'utf8');
const execution = require('../electron/localVoiceRuntimeExecutionUtils.cjs');
const processes = require('../electron/localVoiceRuntimeProcessUtils.cjs');
const { createLocalVoiceCandidateExecution } = require('../electron/localVoiceRuntimeCandidateExecution.cjs');
const modulePath = path.join(__dirname, '../electron/localVoiceRuntimeCandidateExecution.cjs');

function loadBaseline(file) {
  const source = fs.readFileSync(file, 'utf8');
  const a = source.indexOf('  async function warmupModeWorker('), b = source.indexOf('  function dispose()', a);
  assert.ok(a >= 0 && b > a);
  return context => new Function(...Object.keys(context),
    `${source.slice(a, b)}; return { warmupModeWorker, runRunnerCommand };`,
  )(...Object.values(context));
}

async function run(config, baseline) {
  const trace = [], error = config.outcome === 'cancel' ? processes.createLocalVoiceCancelledError() : new Error('controlled_failure');
  const candidates = Array.from({ length: config.count }, (_, index) => ({ index, executable: `python-${index}`, args: [] }));
  const workers = candidates.map(candidate => ({ index: candidate.index, pending: new Map() }));
  const resultValue = { ok: true, parsed: { ok: true, marker: 'result' } };
  const payload = { model: config.emptyModel ? '' : 'model' };
  const settings = { tag: 'settings' }, args = ['--payload-json', '{}'];
  const signal = config.signal === 'none' ? undefined : { aborted: config.signal === 'aborted' };
  const fail = stage => { if (config.fault === stage) throw error; };
  const failing = candidate => config.outcome !== 'success' && (config.outcome !== 'retry' || candidate.index === 0);
  const context = { ...execution, ...processes,
    getModeRuntimeCandidates(input, mode) {
      assert.equal(input, settings); assert.equal(mode, config.mode); trace.push(['candidates']); fail('candidates'); return candidates;
    },
    getModeLabel: mode => mode.toUpperCase(),
    parseRunnerPayload(input) { assert.equal(input, args); trace.push(['parse']); fail('parse'); return payload; },
    getWorkerModeModelPath(mode, input) {
      assert.equal(mode, config.mode); assert.equal(input, payload); trace.push(['model']); fail('model'); return payload.model;
    },
    ensureModeWorker: async (candidate, mode, model) => {
      assert.equal(mode, config.mode); assert.equal(model, payload.model);
      trace.push(['ensure', candidate.index]); fail('ensure');
      if (failing(candidate)) throw error;
      return workers[candidate.index];
    },
    acquireModeWorker: async (candidate, mode, model, inputSignal) => {
      assert.equal(mode, config.mode); assert.equal(model, payload.model); assert.equal(inputSignal, signal);
      trace.push(['acquire', candidate.index]); fail('acquire');
      if (config.failAcquire && failing(candidate)) throw error;
      return { worker: workers[candidate.index], release() { trace.push(['release', candidate.index]); fail('release'); } };
    },
    clearBrokenModeRuntimeCandidate(mode, candidate) {
      assert.equal(mode, config.mode); trace.push(['clear', candidate.index]); fail('clear');
    },
    markBrokenModeRuntimeCandidate(mode, candidate, caught) {
      assert.equal(mode, config.mode); assert.equal(caught, error);
      trace.push(['mark', candidate.index]); fail('mark');
    },
    requestModeWorker: async (worker, input, inputSignal) => {
      assert.equal(worker, workers[worker.index]); assert.equal(input, payload); assert.equal(inputSignal, signal);
      trace.push(['request', worker.index]); fail('request');
      if (config.abortDuringRequest && signal) signal.aborted = true;
      if (failing(candidates[worker.index])) throw error;
      return resultValue;
    },
  };
  const api = baseline ? baseline(context) : createLocalVoiceCandidateExecution(context);
  let result;
  try {
    const value = config.method === 'warmup' ? await api.warmupModeWorker(settings, config.mode, payload.model)
      : await api.runRunnerCommand({ settings, mode: config.mode, extraArgs: args, signal });
    if (config.method === 'warmup') {
      assert.equal(value, workers[value.index]); result = { worker: value.index };
    } else { assert.equal(value, resultValue); result = { returnedOriginal: true }; }
  } catch (caught) {
    result = { rejected: true, message: caught.message, code: caught.code, sameError: caught === error };
  }
  if (config.method === 'runner' && trace.some(item => item[0] === 'request')) {
    assert.equal(trace.filter(item => item[0] === 'request').length, trace.filter(item => item[0] === 'release').length);
  }
  if (config.fault === 'clear') assert.ok(!trace.some(item => item[0] === 'release'));
  if (config.outcome === 'cancel' && config.method === 'runner' && trace.some(item => item[0] === 'request')) {
    assert.ok(!trace.some(item => item[0] === 'mark'));
  }
  if (!config.fault && !config.emptyModel && config.outcome === 'success' && config.count > 0
    && (config.method === 'warmup' || config.signal !== 'aborted')) assert.ok(!result.rejected);
  return { result, trace, aborted: signal?.aborted };
}

async function concurrent() {
  const pending = [], releases = [], workers = [{ id: 'first' }, { id: 'second' }];
  const context = { getModeRuntimeCandidates: () => [{}], getModeLabel: mode => mode,
    parseRunnerPayload: input => input, getWorkerModeModelPath: () => 'model',
    ensureModeWorker: async () => workers[0], clearBrokenModeRuntimeCandidate() {}, markBrokenModeRuntimeCandidate() {},
    acquireModeWorker: async () => {
      const worker = workers.shift(); return { worker, release: () => releases.push(worker.id) };
    },
    requestModeWorker: (worker, input, signal) => new Promise((resolve, reject) => pending.push({ worker, input, signal, resolve, reject })),
  };
  const api = createLocalVoiceCandidateExecution(context);
  const inputs = ['first', 'second'].map(id => ({ settings: {}, mode: 'tts', extraArgs: { id }, signal: { id, aborted: false } }));
  const results = inputs.map(input => api.runRunnerCommand(input).then(value => ({ value }), error => ({ error })));
  for (let i = 0; i < 10 && pending.length < 2; i++) await Promise.resolve();
  assert.equal(pending.length, 2);
  for (let i = 0; i < 2; i++) {
    assert.equal(pending[i].input, inputs[i].extraArgs); assert.equal(pending[i].signal, inputs[i].signal);
  }
  const cancelled = processes.createLocalVoiceCancelledError();
  pending[1].reject(cancelled); assert.equal((await results[1]).error, cancelled);
  assert.deepEqual(releases, ['second']);
  const response = { ok: true }; pending[0].resolve(response);
  assert.equal((await results[0]).value, response); assert.deepEqual(releases, ['second', 'first']);
}

function structure() {
  const source = fs.readFileSync(modulePath, 'utf8'); assert.ok(source.split('\n').length <= 300);
  const ast = ts.createSourceFile(modulePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.body) assert.ok(
      ast.getLineAndCharacterOfPosition(node.end).line - ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 <= 50);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const root = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntime.cjs'), 'utf8');
  assert.match(root, /createLocalVoiceBackendAssembly\(\{/);
  assert.match(backendSource, /createLocalVoiceCandidateExecution\(\{/);
  assert.doesNotMatch(root, /async function (warmupModeWorker|runRunnerCommand)\(/);
}

async function main() {
  structure(); const baseline = process.argv[2] ? loadBaseline(process.argv[2]) : null; let count = 0;
  async function check(config) {
    const actual = await run(config); if (baseline) assert.deepEqual(actual, await run(config, baseline)); count++;
  }
  for (const method of ['warmup', 'runner']) for (const mode of ['tts', 'stt']) for (const count of [0, 1, 2]) {
    for (const outcome of ['success', 'failure', 'retry', 'cancel']) for (const signal of ['none', 'active', 'aborted']) {
      for (const failAcquire of [false, true]) await check({ method, mode, count, outcome, signal, failAcquire });
    }
  }
  for (const method of ['warmup', 'runner']) for (const fault of ['candidates', 'parse', 'model', 'ensure', 'acquire',
    'clear', 'request', 'release', 'mark']) await check({ method, count: 2, outcome: 'failure', mode: 'tts', signal: 'active', fault });
  for (const method of ['warmup', 'runner']) await check({ method, count: 2, mode: 'stt', outcome: 'success', emptyModel: true });
  await check({ method: 'runner', count: 2, mode: 'tts', outcome: 'retry', signal: 'active', abortDuringRequest: true });
  await concurrent();
  console.log(`local voice candidate execution: ${count} fallback/cancel/order/error cases and concurrent response/release isolation passed${baseline ? ' against baseline' : ''}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
