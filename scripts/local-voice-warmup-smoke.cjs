const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');
const planHelpers = require('../electron/localVoiceRuntimeWarmupUtils.cjs');
const requestHelpers = require('../electron/localVoiceRuntimeRequestUtils.cjs');
const { buildJsonError } = require('../electron/localVoiceRuntimeProcessUtils.cjs');
const modulePath = path.join(__dirname, '../electron/localVoiceRuntimeWarmup.cjs');
const moduleText = fs.readFileSync(modulePath, 'utf8');
const rootSource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntime.cjs'), 'utf8');
const assemblySource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntimeServiceAssembly.cjs'), 'utf8');

function loadBaseline(file) {
  const text = fs.readFileSync(file, 'utf8');
  const start = text.indexOf('  async function warmup(');
  const end = text.indexOf('  async function ensureVenv(', start);
  assert.ok(start >= 0 && end > start);
  return (dependencies, clock) => new Function(...Object.keys(dependencies), 'Date', 'Math',
    `${text.slice(start, end)}; return warmup;`,
  )(...Object.values(dependencies), clock.Date, clock.Math);
}

function loadCurrent(dependencies, clock) {
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'Date', 'Math', moduleText)(
    createRequire(modulePath), module, module.exports, clock.Date, clock.Math,
  );
  return module.exports.createLocalVoiceRuntimeWarmup(dependencies).warmup;
}

async function runScenario(config, baseline) {
  const trace = [];
  const gates = [];
  const { mask, providers, text, ttsFailure, sttFailure, referenceOutcome, inferenceOutcome, reverse, fault } = config;
  const safeSettings = providers === null ? {} : {
    ttsProvider: providers[0], sttProvider: providers[1], speechLang: 'en-US', localVoiceReferenceText: text ? 'reference text' : '',
  };
  const assets = { ttsModel: mask & 1 ? { path: 'tts-model' } : null,
    sttModel: mask & 2 ? { path: 'stt-model' } : null,
    reference: mask & 4 ? { path: 'reference', id: 'ref-id' } : null,
    referenceAudioPath: mask & 8 ? 'reference.wav' : '' };
  const referenceInfo = { referenceText: text ? 'reference text' : '', source: text ? 'configured' : 'none' };
  const ttsWorker = { mode: 'tts', marker: 'tts-worker' };
  const runner = () => { throw new Error('unexpected runner invocation by fixture'); };
  const clock = {
    Date: { now: () => { trace.push(['clock']); return 123456; } },
    Math: { random: () => { trace.push(['random']); return 0.125; } },
  };
  const fail = (name) => { if (fault === name) throw new Error(`${name}_failure`); };
  const faultMessages = {
    'start-log': 'Starting local voice warmup', 'tts-success-log': 'Local TTS worker warmed',
    'stt-success-log': 'Local STT worker warmed', 'prepare-log': 'Local voice reference text prepared',
    'inference-log': 'Local TTS prompt warmed', 'completion-log': 'Local voice warmup completed',
    'tts-failure-log': 'Local TTS warmup failed', 'reference-failure-log': 'Local voice reference text warmup failed',
    'inference-failure-log': 'Local TTS prompt warmup failed',
  };
  const dependencies = { ...planHelpers, ...requestHelpers, buildJsonError,
    resolveAssetSelection: (settings) => { trace.push(['assets', settings]); fail('assets'); return assets; },
    getConfiguredReferenceText: (settings, selection) => {
      assert.equal(selection, assets); trace.push(['configured', settings]); fail('configured'); return referenceInfo;
    },
    writeRuntimeLog: (message, details) => {
      trace.push(['log', message, details]);
      if (faultMessages[fault] === message) throw new Error(`${fault}_failure`);
    },
    warmupModeWorker: (settings, mode, modelPath) => {
      trace.push(['worker-start', mode, modelPath, settings]); fail(`sync-${mode}`);
      return new Promise((resolve, reject) => gates.push({ mode, settled: false, settle() {
        this.settled = true;
        if (mode === 'tts' ? ttsFailure : sttFailure) reject(new Error(`${mode}_startup_failure`));
        else resolve(mode === 'tts' ? ttsWorker : { mode: 'stt' });
      } }));
    },
    ensureReferenceTextPrepared: async (input) => {
      assert.equal(input.assetSelection, assets); assert.equal(input.runRunnerCommand, runner);
      assert.ok(gates.every((gate) => gate.settled));
      trace.push(['prepare', input.settings, input.requestId, input.purpose]);
      if (referenceOutcome === 'failure') throw new Error('reference_failure');
      return { referenceText: referenceOutcome === 'text' ? 'prepared text' : '', source: 'prepared' };
    },
    runRunnerCommand: runner,
    requestModeWorker: async (worker, payload) => {
      assert.equal(worker, ttsWorker); assert.ok(gates.every((gate) => gate.settled));
      trace.push(['inference', payload]);
      if (inferenceOutcome === 'throw') throw new Error('inference_failure');
      if (inferenceOutcome === 'null') return null;
      if (inferenceOutcome === 'outer-failure') return { ok: false, parsed: { ok: true } };
      if (inferenceOutcome === 'parsed-failure') return { ok: true, parsed: { ok: false, error: 'parsed_failure' } };
      return { ok: true, parsed: { ok: true, runtime_device: 'cpu', warmup_audio_path: 'audio.wav' } };
    },
  };
  const warmup = baseline ? baseline(dependencies, clock) : loadCurrent(dependencies, clock);
  const settings = providers === null ? null : safeSettings;
  const promise = warmup(settings);
  const observed = promise.then((result) => ({ status: 'fulfilled', result }),
    (error) => ({ status: 'rejected', message: error.message }));
  for (const gate of reverse ? gates.slice().reverse() : gates) gate.settle();
  const result = await observed;
  if (!fault) {
    assert.equal(result.status, 'fulfilled');
    if (result.result.ttsInferenceReady) assert.equal(result.result.ok, true);
    assert.equal(new Set(result.result.warmedModes).size, result.result.warmedModes.length);
    assert.equal(trace[0][0], 'clock'); assert.equal(trace[1][0], 'random');
  }
  return { trace, result };
}

function checkStructure() {
  assert.ok(moduleText.split('\n').length <= 300);
  const source = ts.createSourceFile(modulePath, moduleText, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function visit(node) {
    if (ts.isFunctionLike(node) && node.body) assert.ok(node.getText().split('\n').length <= 50);
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.doesNotMatch(rootSource, /async function warmup\(/u);
  assert.match(rootSource, /createLocalVoiceServiceAssembly\(\{/u);
  assert.match(assemblySource, /createLocalVoiceRuntimeWarmup\(\{\s*resolveAssetSelection, getConfiguredReferenceText, writeRuntimeLog,\s*warmupModeWorker, ensureReferenceTextPrepared, runRunnerCommand, requestModeWorker,/u);
  assert.match(moduleText, /if \(tasks\.length > 0\) await Promise\.all\(tasks\)/u);
}

async function runIsolation(baseline) {
  const trace = [], gates = [];
  let time = 123456;
  const clock = { Date: { now: () => time++ }, Math: { random: () => 0.125 } };
  const assets = { ttsModel: { path: 'tts' }, sttModel: { path: 'stt' },
    reference: { path: 'ref', id: 'ref' }, referenceAudioPath: 'ref.wav' };
  const dependencies = { ...planHelpers, ...requestHelpers, buildJsonError,
    resolveAssetSelection: () => assets,
    getConfiguredReferenceText: (settings) => ({ referenceText: settings.marker, source: settings.marker }),
    writeRuntimeLog: (message, details) => trace.push(['log', message, details]),
    warmupModeWorker: (settings, mode) => new Promise((resolve) => gates.push({
      resolve: () => resolve({ mode, marker: settings.marker }),
    })),
    ensureReferenceTextPrepared: () => { throw new Error('unexpected reference preparation'); },
    runRunnerCommand: () => { throw new Error('unexpected runner'); },
    requestModeWorker: async (worker, payload) => {
      assert.equal(payload.reference_text, worker.marker);
      trace.push(['inference', worker.marker]);
      return { ok: true, parsed: { ok: true } };
    },
  };
  const warmup = baseline ? baseline(dependencies, clock) : loadCurrent(dependencies, clock);
  const results = Promise.all(['one', 'two'].map((marker) => warmup({ ttsProvider: 'local', sttProvider: 'local', marker })));
  assert.equal(gates.length, 4);
  for (const index of [3, 0, 2, 1]) gates[index].resolve();
  const actual = await results;
  assert.deepEqual(actual.map((result) => result.referenceTextSource), ['one', 'two']);
  assert.deepEqual(actual.map((result) => result.warmedModes), [['tts', 'stt'], ['stt', 'tts']]);
  assert.ok(actual.every((result) => result.ttsInferenceReady && result.ok));
  return { trace, actual };
}

async function main() {
  checkStructure();
  const baseline = process.argv[2] ? loadBaseline(process.argv[2]) : null;
  let count = 0;
  const providerOptions = [['local', 'local'], ['local', 'api'], ['api', 'local'], ['api', 'api']];
  for (let mask = 0; mask < 16; mask++) for (const providers of providerOptions) {
    for (const text of [false, true]) for (const failures of [0, 1, 2, 3]) for (const reverse of [false, true]) {
      const config = { mask, providers, text, ttsFailure: Boolean(failures & 1), sttFailure: Boolean(failures & 2),
        referenceOutcome: ['text', 'blank', 'failure'][(mask + failures) % 3],
        inferenceOutcome: ['ok', 'throw', 'null', 'outer-failure', 'parsed-failure'][(mask + failures + Number(reverse)) % 5], reverse };
      const actual = await runScenario(config);
      if (baseline) assert.deepEqual(actual, await runScenario(config, baseline));
      count++;
    }
  }
  for (const fault of ['assets', 'configured', 'start-log', 'tts-success-log', 'stt-success-log', 'prepare-log',
    'inference-log', 'completion-log', 'tts-failure-log', 'reference-failure-log', 'inference-failure-log', 'sync-tts', 'sync-stt']) {
    const config = { mask: 15, providers: ['local', 'local'], text: false,
      ttsFailure: fault === 'tts-failure-log', sttFailure: false,
      referenceOutcome: fault === 'reference-failure-log' ? 'failure' : 'text',
      inferenceOutcome: fault === 'inference-failure-log' ? 'throw' : 'ok', reverse: false, fault };
    const actual = await runScenario(config);
    assert.ok(actual.trace.some((entry) => entry[0] === 'log') || ['assets', 'configured'].includes(fault));
    if (baseline) assert.deepEqual(actual, await runScenario(config, baseline));
    count++;
  }
  const nullConfig = { mask: 0, providers: null, text: false, referenceOutcome: 'text', inferenceOutcome: 'ok' };
  const nullActual = await runScenario(nullConfig);
  if (baseline) assert.deepEqual(nullActual, await runScenario(nullConfig, baseline));
  count++;
  const isolation = await runIsolation();
  if (baseline) assert.deepEqual(isolation, await runIsolation(baseline));
  count++;
  console.log(`local voice warmup: ${count} plan/concurrency/reference/inference/error scenarios passed${baseline ? ' against baseline' : ''}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
