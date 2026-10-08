const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sessionSource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntimeSessionAssembly.cjs'), 'utf8');
const { createRequire } = require('node:module');
const ts = require('typescript');
const requests = require('../electron/localVoiceRuntimeRequestUtils.cjs');
const processes = require('../electron/localVoiceRuntimeProcessUtils.cjs');
const paths = require('../electron/localVoiceRuntimePathUtils.cjs');
const modulePath = path.join(__dirname, '../electron/localVoiceRuntimeSynthesis.cjs');
const clock = { now: () => 1000 };
const loaded = { exports: {} };
new Function('require', 'module', 'Date', fs.readFileSync(modulePath, 'utf8'))(createRequire(modulePath), loaded, clock);
const factory = loaded.exports.createLocalVoiceSynthesis;

function baselineFactory(file) {
  const source = fs.readFileSync(file, 'utf8');
  const start = source.indexOf('  async function synthesize('), end = source.indexOf('  async function transcribe(', start);
  assert.ok(start >= 0 && end > start);
  return (context) => new Function(...Object.keys(context), 'Date',
    `let synthesisSequence = 0; ${source.slice(start, end)}; return { synthesize };`,
  )(...Object.values(context), clock);
}

async function run(config, baseline) {
  const trace = [], activeSynthesisRequests = new Map();
  let sequence = 0, faulted = false;
  const error = config.cancel ? processes.createLocalVoiceCancelledError() : new Error('controlled_failure');
  const fail = (stage) => { if (!faulted && config.fault === stage) { faulted = true; throw error; } };
  const cache = { cacheHit: true, marker: 'cached' };
  const assetSelection = { ttsModel: { path: 'tts-model' }, reference: { path: 'reference' },
    referenceAudioPath: 'reference.wav', sttModel: config.stt ? { path: 'stt-model' } : null };
  if (config.assetMissing) assetSelection[config.assetMissing] = null;
  const root = path.join(__dirname, 'controlled-audio');
  const context = { ...requests, ...processes, ...paths, activeSynthesisRequests,
    generatedAudioCacheRoot: root,
    createSynthesisRequest() {
      const request = { id: `tts-${++sequence}`, controller: new AbortController(), cancelReason: 'active', startedAt: 1000 };
      activeSynthesisRequests.set(request.id, request); return request;
    },
    writeRuntimeLog(message, details) { trace.push(['log', message, details]); fail(message); },
    cleanupGeneratedAudioCacheBeforeSynthesize() { trace.push(['cleanup']); fail('cleanup'); },
    resolveAssetSelection(settings) { trace.push(['assets', settings]); fail('assets'); return assetSelection; },
    ensureReferenceTextPrepared: async (input) => {
      assert.equal(input.assetSelection, assetSelection); assert.equal(input.runRunnerCommand, context.runRunnerCommand);
      assert.equal(input.signal, activeSynthesisRequests.get(input.requestId).controller.signal);
      trace.push(['reference', input.settings, input.requestId, input.signal.aborted]); fail('reference');
      return { referenceText: config.emptyReference ? '' : '参考文本' };
    },
    buildGeneratedAudioCacheKey(input) { trace.push(['key', input]); fail('key'); return 'cache-key'; },
    resolveGeneratedAudioCacheHit(key, id) { trace.push(['cache', key, id]); fail('cache'); return config.cache ? cache : null; },
    getGeneratedAudioCacheFilePath(key) { trace.push(['path', key]); fail('path'); return path.join(root, 'output.wav'); },
    runRunnerCommand: async (input) => {
      assert.equal(input.signal, [...activeSynthesisRequests.values()].at(-1).controller.signal);
      trace.push(['runner', input.settings, input.mode, input.extraArgs, input.signal.aborted]); fail('runner');
      const parsed = { ok: config.result !== 'parsed-fail', error: config.result === 'parsed-fail' ? 'parsed failure' : '',
        audio_base64: 'YXVkaW8=', audio_file_path: config.outside ? path.join(__dirname, 'outside.wav') : path.join(root, 'output.wav'),
        mime_type: config.mime, prompt_cache_hit: config.prompt };
      return { ok: config.result !== 'outer-fail', parsed: config.result === 'empty' ? null : parsed };
    },
    persistGeneratedAudioCache(input) {
      trace.push(['persist', input]); fail('persist');
      return { audioFilePath: config.file ? path.join(root, 'stored.wav') : null, audioFileUrl: config.file ? 'controlled://audio' : null };
    },
  };
  const service = baseline ? baseline(context) : factory(context);
  const settings = config.nullSettings ? null : { speechRecognitionLang: config.language ?? ' en-US ' };
  let result;
  try {
    result = await service.synthesize({ text: config.text, seed: config.seed, settings });
    if (config.cache && !config.fault && !config.assetMissing) assert.equal(result, cache);
  } catch (caught) {
    result = { rejected: true, message: caught.message, code: caught.code, sameError: caught === error };
  }
  const leaked = config.fault === 'Starting local voice synthesis' || config.fault === 'cleanup';
  assert.equal(activeSynthesisRequests.size, leaked ? 1 : 0);
  if (config.cache && !config.fault && !config.assetMissing) assert.ok(!trace.some(x => x[0] === 'runner' || x[0] === 'persist'));
  return { result, trace, active: [...activeSynthesisRequests.keys()], faulted };
}

function structure() {
  const source = fs.readFileSync(modulePath, 'utf8');
  assert.ok(source.split('\n').length <= 300);
  const ast = ts.createSourceFile(modulePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function visit(node) {
    if ((ts.isFunctionDeclaration(node) || ts.isArrowFunction(node)) && node.body) {
      assert.ok(ast.getLineAndCharacterOfPosition(node.end).line - ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 <= 50);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const assemblySource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntimeServiceAssembly.cjs'), 'utf8');
  const stateSource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntimeState.cjs'), 'utf8');
  const root = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntime.cjs'), 'utf8');
  assert.doesNotMatch(root, /async function synthesize\(/);
  assert.match(root, /createLocalVoiceSessionAssembly\(\{/u);
  assert.match(sessionSource, /createLocalVoiceRuntimeState\(\)/u);
  assert.match(stateSource, /id: `tts-\$\{\+\+synthesisSequence\}`/);
  assert.match(root, /createLocalVoiceServiceAssembly\(\{/u);
  assert.match(assemblySource, /createLocalVoiceSynthesis\(\{/);
}

async function concurrent(cancel) {
  const activeSynthesisRequests = new Map(), waiting = [], events = [];
  let sequence = 0;
  const assets = { ttsModel: { path: 'tts' }, reference: { path: 'ref' }, referenceAudioPath: 'ref.wav' };
  const context = {
    activeSynthesisRequests, generatedAudioCacheRoot: path.join(__dirname, 'controlled-audio'),
    createSynthesisRequest() {
      const request = { id: `tts-${++sequence}`, controller: new AbortController(), startedAt: 1000, cancelReason: 'active' };
      activeSynthesisRequests.set(request.id, request); return request;
    },
    writeRuntimeLog: (message, detail) => events.push([message, detail]),
    cleanupGeneratedAudioCacheBeforeSynthesize() {}, resolveAssetSelection: () => assets,
    ensureReferenceTextPrepared: async () => ({ referenceText: 'reference' }),
    buildGeneratedAudioCacheKey: input => input.text, resolveGeneratedAudioCacheHit: () => null,
    getGeneratedAudioCacheFilePath: key => key,
    runRunnerCommand: input => new Promise((resolve, reject) => waiting.push({ input, resolve, reject })),
    persistGeneratedAudioCache: input => ({ audioFilePath: input.text, audioFileUrl: input.text }),
  };
  const service = factory(context);
  const calls = ['first', 'second'].map(text => service.synthesize({ text }));
  const observed = calls.map(promise => promise.then(value => ({ value }), error => ({ error })));
  for (let i = 0; i < 10 && waiting.length < 2; i++) await Promise.resolve();
  assert.equal(waiting.length, 2); assert.equal(activeSynthesisRequests.size, 2);
  assert.notEqual(waiting[0].input.signal, waiting[1].input.signal);
  assert.equal(waiting[0].input.signal, activeSynthesisRequests.get('tts-1').controller.signal);
  assert.equal(waiting[1].input.signal, activeSynthesisRequests.get('tts-2').controller.signal);
  if (cancel) {
    for (const request of activeSynthesisRequests.values()) { request.cancelReason = 'controlled'; request.controller.abort(); }
    waiting[1].reject(processes.createLocalVoiceCancelledError());
    waiting[0].reject(processes.createLocalVoiceCancelledError());
  } else {
    waiting[1].resolve({ ok: true, parsed: { ok: true, audio_base64: 'second' } });
    waiting[0].resolve({ ok: true, parsed: { ok: true, audio_base64: 'first' } });
  }
  const results = await Promise.all(observed);
  assert.equal(activeSynthesisRequests.size, 0);
  if (cancel) assert.ok(results.every(item => processes.isLocalVoiceCancelledError(item.error)));
  else assert.deepEqual(results.map(item => item.value.audioFilePath), ['first', 'second']);
  const terminal = events.filter(item => /completed|cancelled/.test(item[0]));
  assert.deepEqual(terminal.map(item => item[1].requestId), ['tts-2', 'tts-1']);
  assert.deepEqual(terminal.map(item => item[1].activeRequestCount), [2, 1]);
}

async function main() {
  structure();
  const baseline = process.argv[2] ? baselineFactory(process.argv[2]) : null;
  let count = 0;
  async function check(config) {
    const actual = await run(config);
    if (baseline) assert.deepEqual(actual, await run(config, baseline));
    count++;
  }
  for (const cache of [false, true]) for (const file of [false, true]) for (const seed of [undefined, 3.9, 'bad']) {
    for (const nullSettings of [false, true]) for (const stt of [false, true]) for (const outside of [false, true]) {
      await check({ cache, file, seed, nullSettings, stt, outside, text: '合成文本', prompt: true });
    }
  }
  for (const fault of ['Starting local voice synthesis', 'cleanup', 'assets', 'reference', 'key', 'cache', 'path', 'runner',
    'persist', 'Local voice synthesis completed']) for (const cancel of [false, true]) await check({ fault, cancel, text: 'text' });
  for (const assetMissing of ['ttsModel', 'reference', 'referenceAudioPath']) await check({ assetMissing });
  for (const result of ['outer-fail', 'parsed-fail', 'empty']) await check({ result });
  for (const text of [null, '', 42]) await check({ text, emptyReference: true, language: '', mime: 'audio/custom' });
  await concurrent(false); await concurrent(true);
  console.log(`local voice synthesis: ${count} cache/inference/cancel/order/error scenarios and 2 concurrent scenarios passed${baseline ? ' against baseline' : ''}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
