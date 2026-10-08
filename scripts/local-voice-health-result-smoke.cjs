const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');
const { createLocalVoiceRuntimeStatusUtils } = require('../electron/localVoiceRuntimeStatusUtils.cjs');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
function original(context) {
  const module = { exports: {} };
  new Function('require', 'module', 'exports', baseline)(createRequire(require.resolve('../electron/localVoiceRuntimeStatusUtils.cjs')), module, module.exports);
  return module.exports.createLocalVoiceRuntimeStatusUtils(context);
}
function scenario(config, useOriginal = false) {
  const trace = [], counts = new Map(), failure = new Error('health failure');
  function call(name, args, run) {
    trace.push([name, ...args]); const count = (counts.get(name) || 0) + 1; counts.set(name, count);
    if (name === config.fail && count === config.at) throw failure;
    return run();
  }
  const context = {
    runtimeRoot: 'C:\\语音 环境',
    buildReferenceTextCacheKey: (...args) => call('key', args, () => 'reference-key'),
    readPersistedReferenceText: key => call('read', [key], () => config.persisted || ''),
    uniqueStrings: items => call('unique', [items], () => [...new Set(items.filter(Boolean))]),
    getModeRuntimeCandidates: (settings, mode) => call('candidates', [settings, mode], () => [{ label: mode + '-1' }, { label: mode + '-2' }]),
    describeRuntimeCandidate: candidate => call('describe', [candidate], () => candidate.label),
  };
  const assetSelection = {
    catalog: { rootPath: config.catalog ? 'models' : '' },
    ttsModel: config.assets & 1 ? { path: 'tts' } : null,
    sttModel: config.assets & 2 ? { path: 'stt' } : null,
    reference: config.assets & 4 ? { path: 'reference' } : null,
    referenceAudioPath: config.reference === 'audio' ? 'audio.wav' : '',
    referenceTextFromFiles: config.reference === 'files' ? ' text ' : '',
    referenceTextFromAudioFileName: config.reference === 'filename' ? ' name ' : '',
  };
  const safeSettings = { ttsProvider: config.providers & 1 ? 'local' : 'remote',
    sttProvider: config.providers & 2 ? 'local' : 'remote', speechRecognitionLang: 'en',
    localVoiceReferenceText: config.reference === 'settings' ? ' text ' : '' };
  const runtimes = ['tts', 'stt'].map((mode, index) => ({
    available: !!(config.available & (1 << index)),
    missingPackages: config.missing & (1 << index) ? ['shared', mode + '-missing'] : [],
    detectedPackages: ['shared', mode + '-detected'],
    messages: ['shared message', mode + ' message'],
    executable: config.noExecutable ? null : mode + '-python', runtimeLabel: mode, pythonVersion: '3.11',
    device: mode === 'tts' ? 'cpu' : 'cuda',
  }));
  const input = { assetSelection, safeSettings, ttsRuntime: runtimes[0], sttRuntime: runtimes[1] };
  const snapshot = structuredClone(input);
  const api = useOriginal ? original(context) : createLocalVoiceRuntimeStatusUtils(context);
  assert.equal(trace.length, 0, 'status creation must not build health or probe candidates');
  let result, error;
  try { result = api.buildLocalVoiceHealth(input); } catch (e) { error = e === failure ? 'original-error' : e.message; }
  assert.deepEqual(input, snapshot, 'health construction must not mutate input');
  return { trace, result, error };
}
function compare(config) {
  const actual = scenario(config);
  if (baseline) assert.deepEqual(actual, scenario(config, true), JSON.stringify(config));
  if (actual.error !== undefined) assert.equal(actual.error, 'original-error');
  if (actual.result) assert.ok(['ready', 'missing-runtime', 'missing-dependencies', 'missing-assets'].includes(actual.result.status));
  return actual;
}
const base = { providers: 3, available: 3, missing: 0, assets: 7, reference: 'audio', catalog: true };
let count = 0;
for (const providers of [0, 1, 2, 3]) for (const available of [0, 1, 2, 3]) for (const missing of [0, 1, 2, 3]) {
  for (const assets of [0, 1, 2, 3, 4, 5, 6, 7]) for (const reference of ['', 'audio']) {
    compare({ ...base, providers, available, missing, assets, reference }); count++;
  }
}
for (const available of [0, 3]) for (const fail of ['key', 'read', 'unique', 'candidates', 'describe']) {
  for (const at of [1, 2, 3]) { compare({ ...base, available, fail, at }); count++; }
}
for (const reference of ['', 'audio', 'files', 'filename', 'settings']) for (const persisted of ['', 'cached']) {
  compare({ ...base, reference, persisted, catalog: false, noExecutable: true }); count++;
}
const ready = compare(base);
assert.equal(ready.result.status, 'ready');
assert.equal(ready.result.ttsReady, true);
assert.equal(ready.result.sttReady, true);
assert.equal(ready.result.runtimeLabel, 'tts');
assert.equal(ready.result.device, 'cuda');
assert.deepEqual(ready.trace.map(t => t[0]), ['key', 'read', 'unique', 'unique', 'unique']);
const sttOnly = compare({ ...base, providers: 2, available: 2, missing: 1 });
assert.equal(sttOnly.result.status, 'ready');
assert.deepEqual(sttOnly.result.missingPackages, []);
assert.equal(sttOnly.result.runtimeLabel, 'tts', 'retain descriptor selection independently of required modes');
const missing = compare({ ...base, available: 0 });
assert.equal(missing.result.status, 'missing-runtime');
assert.deepEqual(missing.trace.filter(t => t[0] === 'candidates').map(t => t[2]), ['tts', 'stt']);
assert.equal(missing.result.messages.length, 6);
assert.equal(compare({ ...base, reference: '' }).result.referenceReady, false);
assert.equal(compare({ ...base, reference: '', persisted: 'cached' }).result.referenceReady, true);
for (const name of ['StatusUtils', 'Health']) {
  const file = path.join(__dirname, `../electron/localVoiceRuntime${name}.cjs`), source = fs.readFileSync(file, 'utf8');
  assert.ok(source.split('\n').length <= 300);
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function walk(n) {
    if (ts.isFunctionLike(n) && n.body) assert.ok(ast.getLineAndCharacterOfPosition(n.end).line - ast.getLineAndCharacterOfPosition(n.getStart(ast)).line + 1 <= 50);
    ts.forEachChild(n, walk);
  }
  walk(ast);
}
console.log(`local voice health result: ${count} mode/availability/package/asset/reference/order/error scenarios passed${baseline ? ' against baseline' : ''}`);
