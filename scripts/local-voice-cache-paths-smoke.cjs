const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');
const { createLocalVoiceRuntimeCacheUtils } = require('../electron/localVoiceRuntimeCacheUtils.cjs');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
function original(context) {
  const module = { exports: {} };
  new Function('require', 'module', 'exports', baseline)(createRequire(require.resolve('../electron/localVoiceRuntimeCacheUtils.cjs')), module, module.exports);
  return module.exports.createLocalVoiceRuntimeCacheUtils(context);
}
function scenario(config, useOriginal = false) {
  const trace = [], failure = new Error('cache key/path failure');
  function call(name, args, run) {
    trace.push([name, ...args]);
    if (name === config.fail) throw failure;
    return run();
  }
  const pathApi = config.windows ? path.win32 : path.posix;
  const context = {
    generatedAudioCacheRoot: config.root,
    fs: { statSync: function(p) {
      return call('stat', [p, this === context.fs], () => ({
        get size() { return call('size', [], () => config.size); },
        get mtimeMs() { return call('mtime', [], () => config.mtimeMs); },
      }));
    } },
    ensureDir: function(p) { 'use strict'; return call('ensure', [p, this === undefined], () => undefined); },
    path: { join: function(...args) { return call('join', [...args, this === context.path], () => pathApi.join(...args)); } },
  };
  const api = useOriginal ? original(context) : createLocalVoiceRuntimeCacheUtils(context);
  assert.equal(trace.length, 0, 'assembly must not access files or create directories');
  let result, error;
  try {
    if (config.operation === 'key') result = api.buildReferenceTextCacheKey(config.audio, config.model, config.language);
    if (config.operation === 'path') result = api.getGeneratedAudioCacheFilePath(config.key);
    if (config.operation === 'root') result = api.ensureGeneratedAudioCacheRoot();
  } catch (e) { error = e === failure ? 'original-error' : e.message; }
  return { result, error, trace };
}
function compare(config) {
  const actual = scenario(config);
  if (baseline) assert.deepEqual(actual, scenario(config, true), JSON.stringify(config));
  if (actual.error !== undefined) assert.equal(actual.error, 'original-error');
  return actual;
}
let keys = 0, paths = 0;
for (const audio of [undefined, '', 'C:\\参考 空格\\voice.wav']) for (const model of [undefined, '', 'stt-model']) {
  for (const language of [undefined, '', 'zh-CN', 'en']) for (const size of [0, 123]) for (const mtimeMs of [0, 123.9, -1.2]) {
    for (const fail of [undefined, 'stat', 'size', 'mtime']) {
      compare({ operation: 'key', audio, model, language, size, mtimeMs, fail }); keys++;
    }
  }
}
for (const windows of [true, false]) for (const root of ['', 'cache', 'C:\\缓存 空格\\音频']) {
  for (const key of [undefined, '', 0, 'key', '中文键']) for (const fail of [undefined, 'ensure', 'join']) {
    compare({ operation: 'path', windows, root, key, fail }); paths++;
  }
  for (const fail of [undefined, 'ensure']) { compare({ operation: 'root', windows, root, fail }); paths++; }
}
const base = { operation: 'key', audio: 'audio', model: 'model', size: 123, mtimeMs: 456.9 };
assert.equal(compare(base).result, 'audio::model::zh-CN::123::456');
assert.equal(compare({ ...base, fail: 'stat' }).result, 'audio::model::zh-CN::0::0');
assert.equal(compare({ ...base, fail: 'size' }).result, 'audio::model::zh-CN::0::0');
assert.equal(compare({ ...base, fail: 'mtime' }).result, 'audio::model::zh-CN::123::0', 'retain size when later metadata lookup fails');
assert.deepEqual(compare({ ...base, audio: '' }).trace, []);
assert.deepEqual(compare({ operation: 'path', key: '' }).trace, []);
const joined = compare({ operation: 'path', windows: true, root: 'C:\\缓存 空格', key: 'key' });
assert.equal(joined.result, 'C:\\缓存 空格\\key.wav');
assert.deepEqual(joined.trace.map(t => t[0]), ['ensure', 'join']);
const failedEnsure = compare({ operation: 'path', root: 'cache', key: 'key', fail: 'ensure' });
assert.equal(failedEnsure.error, 'original-error');
assert.equal(failedEnsure.trace.some(t => t[0] === 'join'), false);
const { createLocalVoiceGeneratedAudioPaths } = require('../electron/localVoiceRuntimeGeneratedAudioPaths.cjs');
const trace = [];
const services = ['first', 'second'].map(root => createLocalVoiceGeneratedAudioPaths({ generatedAudioCacheRoot: root,
  ensureDir: dir => trace.push(dir), path: path.posix }));
assert.equal(services[0].getGeneratedAudioCacheFilePath('same'), 'first/same.wav');
assert.equal(services[1].getGeneratedAudioCacheFilePath('same'), 'second/same.wav');
assert.deepEqual(trace, ['first', 'second']);
for (const name of ['ReferenceTextKey', 'GeneratedAudioPaths']) {
  const file = path.join(__dirname, `../electron/localVoiceRuntime${name}.cjs`), source = fs.readFileSync(file, 'utf8');
  assert.ok(source.split('\n').length <= 300);
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function walk(n) {
    if (ts.isFunctionLike(n) && n.body) assert.ok(ast.getLineAndCharacterOfPosition(n.end).line - ast.getLineAndCharacterOfPosition(n.getStart(ast)).line + 1 <= 50);
    ts.forEachChild(n, walk);
  }
  walk(ast);
}
console.log(`local voice cache paths: ${keys} metadata/key and ${paths} root/path/error cases, two-instance paths passed${baseline ? ' against baseline' : ''}`);
