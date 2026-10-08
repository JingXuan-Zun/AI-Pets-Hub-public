const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const sourcePath = path.join(__dirname, '../electron/localVoiceRuntimeGeneratedAudioResultUtils.cjs');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
function scenario(config, original = false) {
  const trace = [], calls = new Map(), failure = new Error('hit failure'); let nextEntry, current;
  const clockValues = [...config.clocks];
  if (config.current) current = { audioFilePath: 'voice.wav', expiresAt: config.expiry, hitCount: config.hitCount,
    mimeType: config.mimeType, metadata: { token: 'keep' } };
  function call(name, args, run) {
    trace.push([name, ...args]); const count = (calls.get(name) || 0) + 1; calls.set(name, count);
    if (config.fail === name && count === config.at) throw failure;
    return run();
  }
  function load(source) {
    const module = { exports: {} };
    vm.runInNewContext(source, { module, exports: module.exports,
      Date: { now: () => call('clock', [], () => clockValues.shift()) },
      require: name => name.startsWith('./localVoiceRuntime')
        ? load(fs.readFileSync(path.join(path.dirname(sourcePath), name), 'utf8')) : require(name),
    });
    return module.exports;
  }
  const context = {
    generatedAudioCacheTtlMs: 1000,
    pathExists: p => call('exists', [p], () => config.exists),
    updateGeneratedAudioManifestEntry: function(key, updater) {
      'use strict';
      return call('update', [key, this === undefined], () => {
        nextEntry = updater(current); trace.push(['next', nextEntry]);
        if (config.repeat) trace.push(['next-again', updater(current)]);
        return call('afterUpdate', [], () => ({ entry: config.returnEmpty ? null : nextEntry && { ...nextEntry, audioFilePath: 'normalized.wav' } }));
      });
    },
    getGeneratedAudioFileUrl: p => call('url', [p], () => config.nullUrl ? null : 'file://' + p),
    writeRuntimeLog: (...args) => call('log', args, () => undefined),
  };
  const api = load(original ? baseline : fs.readFileSync(sourcePath, 'utf8')).createLocalVoiceRuntimeGeneratedAudioResultUtils(context);
  assert.equal(trace.length, 0, 'creation must not read or renew cache');
  let result, error;
  try { result = api.resolveGeneratedAudioCacheHit(config.key, 'request'); } catch (e) { error = e === failure ? 'original-error' : e.message; }
  return JSON.parse(JSON.stringify({ result, error, trace,
    unchanged: !current || current.expiresAt === config.expiry && current.hitCount === config.hitCount,
    sharedMetadata: !!nextEntry && nextEntry.metadata === current.metadata,
    sameObject: !!nextEntry && nextEntry === current }));
}
function compare(config) {
  const actual = scenario(config);
  if (baseline) assert.deepEqual(actual, scenario(config, true), JSON.stringify(config));
  assert.equal(actual.unchanged, true);
  assert.equal(actual.sameObject, false);
  if (actual.error !== undefined) assert.equal(actual.error, 'original-error');
  return actual;
}
const base = { key: 'key', current: true, exists: true, expiry: 101, hitCount: 3, clocks: [100, 102, 103, 104] };
let count = 0;
for (const key of ['', 'key']) for (const current of [false, true]) for (const exists of [false, true]) {
  for (const expiry of [99, 100, 101]) for (const repeat of [false, true]) {
    for (const fail of [undefined, 'update', 'exists', 'clock', 'afterUpdate', 'url', 'log']) for (const at of [1, 2]) {
      compare({ ...base, key, current, exists, expiry, repeat, fail, at }); count++;
    }
  }
}
const success = compare(base);
assert.equal(success.result.audioFilePath, 'normalized.wav', 'project the store result, not the raw updater output');
assert.equal(success.result.mimeType, 'audio/wav');
assert.equal(success.trace.find(t => t[0] === 'next')[1].expiresAt, 1102);
assert.equal(success.trace.find(t => t[0] === 'next')[1].hitCount, 4);
assert.equal(success.sharedMetadata, true);
assert.deepEqual(success.trace.map(t => t[0]), ['update', 'exists', 'clock', 'clock', 'next', 'afterUpdate', 'url', 'log']);
for (const expiry of [99, 100]) {
  const expired = compare({ ...base, expiry }); assert.equal(expired.result, null);
  assert.equal(expired.trace.filter(t => t[0] === 'clock').length, 1);
}
assert.deepEqual(compare({ ...base, key: '' }).trace, []);
assert.equal(compare({ ...base, returnEmpty: true }).trace.some(t => t[0] === 'url' || t[0] === 'log'), false);
assert.equal(compare({ ...base, nullUrl: true, mimeType: 'audio/custom' }).result.audioFileUrl, null);
assert.equal(compare({ ...base, clocks: [100, 90] }).trace.find(t => t[0] === 'next')[1].expiresAt, 1090);
assert.equal(compare({ ...base, hitCount: '3' }).trace.find(t => t[0] === 'next')[1].hitCount, '31', 'retain original field coercion');
const file = path.join(__dirname, '../electron/localVoiceRuntimeGeneratedAudioHit.cjs'), source = fs.readFileSync(file, 'utf8');
assert.ok(source.split('\n').length <= 300);
const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
function walk(n) {
  if (ts.isFunctionLike(n) && n.body) assert.ok(ast.getLineAndCharacterOfPosition(n.end).line - ast.getLineAndCharacterOfPosition(n.getStart(ast)).line + 1 <= 50);
  ts.forEachChild(n, walk);
}
walk(ast);
console.log(`local voice generated audio hit: ${count} expiry/renewal/projection/order/error cases passed${baseline ? ' against baseline' : ''}`);
