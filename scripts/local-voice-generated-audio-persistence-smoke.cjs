const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const modulePath = path.join(__dirname, '../electron/localVoiceRuntimeGeneratedAudioResultUtils.cjs');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const samples = [
  {}, { cacheKey: 'key' }, { cacheKey: 'key', audioBase64: Buffer.from('audio').toString('base64') },
  { cacheKey: 'key', audioFilePath: 'explicit.wav', audioBase64: '!!!' },
  { cacheKey: 'key', audioFilePath: 'explicit.wav', audioBase64: { invalid: true } },
  { cacheKey: 'key', audioBase64: 'YQ==', languageCode: 'en', mimeType: 'audio/custom', seed: -2.9,
    text: ' hello 世界 ', referenceText: 'ref', referencePath: 'reference', referenceAudioPath: 'audio',
    referenceSttModelPath: 'stt', ttsModelPath: 'tts', requestId: 'request' },
  { cacheKey: 'key', seed: '3', text: 42, referenceText: null },
];
function scenario(config, original = false) {
  const trace = [], calls = new Map(), files = new Map(), failure = new Error('persist failure');
  let registered = null, clock = 100, updaterIdentity;
  function call(name, args, run) {
    trace.push([name, ...args]); const count = (calls.get(name) || 0) + 1; calls.set(name, count);
    if (config.fail === name && count === config.at) throw failure;
    return run();
  }
  function load(source) {
    const module = { exports: {} };
    vm.runInNewContext(source, { module, exports: module.exports, Buffer,
      Date: { now: () => call('clock', [], () => clock++) },
      require: name => name.startsWith('./localVoiceRuntime')
        ? load(fs.readFileSync(path.join(path.dirname(modulePath), name), 'utf8')) : require(name),
    });
    return module.exports;
  }
  const context = {
    generatedAudioCacheTtlMs: 1000,
    getGeneratedAudioCacheFilePath: key => call('path', [key], () => config.pathMissing ? null : 'cache.wav'),
    fs: { writeFileSync: (file, bytes) => call('write', [file, bytes.toString('hex')], () => files.set(file, bytes.toString('hex'))) },
    pathExists: file => call('exists', [file], () => config.exists || files.has(file)),
    path: { basename: file => call('basename', [file], () => path.basename(file)) },
    buildGeneratedAudioTextPreview: text => call('preview', [text], () => String(text ?? '').trim()),
    updateGeneratedAudioManifestEntry: (key, updater) => call('update', [key], () => {
      const next = updater(registered); const again = updater(registered);
      updaterIdentity = next === again;
      trace.push(['record', next]); registered = next;
      return call('afterUpdate', [], () => ({ entry: next }));
    }),
    writeRuntimeLog: (...args) => call('log', args, () => undefined),
    getGeneratedAudioFileUrl: file => call('url', [file], () => 'file://' + file),
    buildJsonError: error => call('error', [error === failure, error.message], () => ({ message: error.message })),
  };
  const api = load(original ? baseline : fs.readFileSync(modulePath, 'utf8')).createLocalVoiceRuntimeGeneratedAudioResultUtils(context);
  assert.equal(trace.length, 0, 'factory must not write, allocate time or read cache');
  const input = {};
  for (const name of ['audioBase64', 'audioFilePath', 'cacheKey', 'languageCode', 'mimeType', 'seed', 'referenceAudioPath',
    'referencePath', 'referenceSttModelPath', 'referenceText', 'requestId', 'text', 'ttsModelPath']) {
    Object.defineProperty(input, name, { get() { trace.push(['input', name]); return config.input[name]; } });
  }
  let result, error, hit;
  try { result = api.persistGeneratedAudioCache(input); } catch (e) { error = e === failure ? 'original-error' : e.message; }
  if (config.hit && !error) {
    try { hit = api.resolveGeneratedAudioCacheHit(config.input.cacheKey, 'hit-request'); } catch (e) { error = e === failure ? 'original-error' : e.message; }
  }
  return JSON.parse(JSON.stringify({ trace, result, error, hit, registered, updaterIdentity, files: [...files] }));
}
function compare(config) {
  const actual = scenario(config);
  if (baseline) assert.deepEqual(actual, scenario(config, true), JSON.stringify(config));
  if (actual.result?.audioFilePath === null) assert.equal(actual.result.audioFileUrl, null);
  assert.equal(actual.trace.filter(t => t[0] === 'input').length, 13, 'read input properties only once');
  return actual;
}
let count = 0;
for (const input of samples) for (const exists of [true, false]) for (const pathMissing of [true, false]) {
  for (const fail of [undefined, 'path', 'clock', 'write', 'exists', 'preview', 'basename', 'update', 'afterUpdate', 'log', 'url', 'error']) {
    for (const at of [1, 2]) { compare({ input, exists, pathMissing, fail, at }); count++; }
  }
}
const written = compare({ input: samples[5], exists: true });
assert.equal(written.result.audioFilePath, 'cache.wav');
assert.equal(written.registered.createdAt, 100);
assert.equal(written.registered.expiresAt, 1100);
assert.equal(written.registered.seed, -2);
assert.equal(written.updaterIdentity, true);
assert.deepEqual(written.trace.filter(t => ['write', 'preview', 'basename', 'update', 'log', 'url'].includes(t[0])).map(t => t[0]),
  ['write', 'preview', 'basename', 'update', 'log', 'url']);
const missing = compare({ input: samples[1], exists: false });
assert.equal(missing.result.audioFilePath, null);
assert.equal(missing.trace.some(t => t[0] === 'update'), false);
const hit = compare({ input: samples[2], exists: true, hit: true });
assert.equal(hit.hit.cacheHit, true);
assert.equal(hit.registered.hitCount, 1);
assert.equal(hit.registered.expiresAt, 1102, 'store retains the first updater result');
assert.equal(hit.trace.filter(t => t[0] === 'clock').length, 5, 'persist plus two clock reads for each updater call');
for (const fail of ['path', 'clock']) {
  const escaped = compare({ input: samples[2], fail, at: 1 });
  assert.equal(escaped.error, 'original-error');
  assert.equal(escaped.trace.some(t => t[0] === 'log'), false);
}
const file = path.join(__dirname, '../electron/localVoiceRuntimeGeneratedAudioPersistence.cjs'), source = fs.readFileSync(file, 'utf8');
assert.ok(source.split('\n').length <= 300);
const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
function walk(n) {
  if (ts.isFunctionLike(n) && n.body) assert.ok(ast.getLineAndCharacterOfPosition(n.end).line - ast.getLineAndCharacterOfPosition(n.getStart(ast)).line + 1 <= 50);
  ts.forEachChild(n, walk);
}
walk(ast);
console.log(`local voice generated audio persistence: ${count} file/manifest/order/error cases and cache-hit integration passed${baseline ? ' against baseline' : ''}`);
