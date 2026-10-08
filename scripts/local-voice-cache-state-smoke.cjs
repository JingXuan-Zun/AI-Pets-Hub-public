const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const sourcePath = path.join(__dirname, '../electron/localVoiceRuntimeCacheUtils.cjs');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
function scenario(config, original = false) {
  const trace = [], counts = new Map(), broken = new Map(), failure = new Error('cache failure');
  let content = config.content ?? '{}';
  function call(name, args, run) {
    trace.push([name, ...args]); const count = (counts.get(name) || 0) + 1; counts.set(name, count);
    if (name === config.fail && count === config.at) throw failure;
    return run();
  }
  function load(source) {
    const module = { exports: {} };
    vm.runInNewContext(source, { module, exports: module.exports,
      Date: { now: () => call('clock', [], () => 123) },
      require: name => name.startsWith('./localVoiceRuntime')
        ? load(fs.readFileSync(path.join(path.dirname(sourcePath), name), 'utf8')) : require(name),
    });
    return module.exports;
  }
  const context = {
    referenceTextCachePath: 'reference.json',
    fs: {
      readFileSync: (...args) => call('read', args, () => content),
      writeFileSync: (...args) => call('write', args, () => { content = args[1]; }),
    },
    pathExists: p => call('exists', [p], () => config.exists !== false),
    ensureRuntimeRoot: () => call('ensure', [], () => undefined),
    buildJsonError: e => call('error', [e === failure, e?.message], () => ({ message: e?.message })),
    writeRuntimeLog: (...args) => call('log', args, () => undefined),
    describeRuntimeCandidate: c => call('describe', [c], () => c?.label || 'none'),
    brokenModeRuntimeCandidates: {
      get: key => call('get', [key], () => broken.get(key)),
      set: (key, value) => call('set', [key, value], () => broken.set(key, value)),
      delete: key => call('delete', [key], () => broken.delete(key)),
    },
  };
  const api = load(original ? baseline : fs.readFileSync(sourcePath, 'utf8')).createLocalVoiceRuntimeCacheUtils(context);
  assert.equal(trace.length, 0, 'factories must not perform IO or access candidate state');
  let result, error;
  try {
    if (config.operation === 'read') result = api.readPersistedReferenceText(config.key);
    if (config.operation === 'readAll') result = api.readPersistedReferenceTextCache();
    if (config.operation === 'write') result = api.writePersistedReferenceTextCache(config.entries);
    if (config.operation === 'persist') result = api.persistReferenceText(config.key, config.text, config.metadata);
    if (config.operation === 'broken') {
      result = [];
      for (const mode of ['tts', 'stt']) {
        api.markBrokenModeRuntimeCandidate(mode, config.candidate, failure);
        const first = api.getBrokenModeRuntimeCandidate(mode, config.candidate);
        assert.equal(first, api.getBrokenModeRuntimeCandidate(mode, config.candidate));
        result.push(first);
        api.clearBrokenModeRuntimeCandidate(mode, config.candidate);
        result.push(api.getBrokenModeRuntimeCandidate(mode, config.candidate));
      }
    }
  } catch (e) { error = e === failure ? 'original-error' : e.message; }
  return JSON.parse(JSON.stringify({ result, error, trace, content, broken: [...broken] }));
}
function compare(config) {
  const actual = scenario(config);
  if (baseline) assert.deepEqual(actual, scenario(config, true), JSON.stringify(config));
  assert.ok(actual.trace.filter(t => t[0] === 'write').length <= 1);
  return actual;
}
let storeCount = 0, stateCount = 0;
for (const content of ['{}', 'invalid', 'null', '[]', '42', '{"key":{"text":" hello "}}', '{"key":{"text":4}}']) {
  for (const exists of [true, false]) for (const operation of ['read', 'readAll', 'write', 'persist']) {
    for (const fail of [undefined, 'exists', 'read', 'write', 'ensure', 'clock', 'error', 'log']) for (const at of [1, 2]) {
      compare({ content, exists, operation, key: 'key', text: ' text ', entries: { key: { text: ' raw ' } }, fail, at }); storeCount++;
    }
  }
}
for (const candidate of [null, {}, { label: 'system' }, { label: 'venv-tts' }, { label: 'venv-stt' }, { label: 12 }]) {
  for (const fail of [undefined, 'describe', 'error', 'clock', 'set', 'get', 'delete']) for (const at of [1, 2]) {
    compare({ operation: 'broken', candidate, fail, at }); stateCount++;
  }
}
const persisted = compare({ operation: 'persist', key: 'key', text: ' text ', metadata: { source: 'test' } });
assert.equal(persisted.result, true);
assert.deepEqual(JSON.parse(persisted.content), { key: { text: 'text', updatedAt: 123, source: 'test' } });
assert.deepEqual(persisted.trace.map(t => t[0]), ['exists', 'read', 'clock', 'ensure', 'write']);
const override = compare({ operation: 'persist', key: 'key', text: 'text', metadata: { text: 'override', updatedAt: 1 } });
assert.equal(JSON.parse(override.content).key.updatedAt, 1, 'metadata retains original override order');
for (const key of ['', undefined]) {
  assert.deepEqual(compare({ operation: 'read', key }).trace, []);
  assert.deepEqual(compare({ operation: 'persist', key, text: 'text' }).trace, []);
}
assert.equal(compare({ operation: 'read', key: 'key', content: '{"key":{"text":" hi "}}' }).result, 'hi');
assert.equal(compare({ operation: 'write', fail: 'ensure', at: 1 }).error, 'original-error');
assert.equal(compare({ operation: 'write', fail: 'write', at: 1 }).result, false);
const { createLocalVoiceBrokenCandidates } = require('../electron/localVoiceRuntimeBrokenCandidates.cjs');
const maps = [new Map(), new Map()];
const states = maps.map(brokenModeRuntimeCandidates => createLocalVoiceBrokenCandidates({ brokenModeRuntimeCandidates,
  describeRuntimeCandidate: c => c.label, buildJsonError: e => e.message }));
const candidate = { label: 'venv-local' }; states[0].markBrokenModeRuntimeCandidate('tts', candidate, new Error('first'));
assert.equal(states[1].getBrokenModeRuntimeCandidate('tts', candidate), null);
assert.equal(states[0].getBrokenModeRuntimeCandidate('stt', candidate), null);
assert.equal(states[0].getBrokenModeRuntimeCandidate('tts', candidate).message, 'first');
states[1].clearBrokenModeRuntimeCandidate('tts', candidate); assert.equal(maps[0].size, 1);
for (const name of ['ReferenceTextStore', 'BrokenCandidates']) {
  const file = path.join(__dirname, `../electron/localVoiceRuntime${name}.cjs`), source = fs.readFileSync(file, 'utf8');
  assert.ok(source.split('\n').length <= 300);
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function walk(n) {
    if (ts.isFunctionLike(n) && n.body) assert.ok(ast.getLineAndCharacterOfPosition(n.end).line - ast.getLineAndCharacterOfPosition(n.getStart(ast)).line + 1 <= 50);
    ts.forEachChild(n, walk);
  }
  walk(ast);
}
console.log(`local voice cache state: ${storeCount} store and ${stateCount} broken-candidate cases, real map isolation passed${baseline ? ' against baseline' : ''}`);
