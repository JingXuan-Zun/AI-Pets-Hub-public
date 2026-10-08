const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const sourcePath = path.join(__dirname, '../electron/localVoiceRuntimeGeneratedAudioUtils.cjs');
const helperPath = path.join(__dirname, '../electron/localVoiceRuntimeGeneratedAudioCleanup.cjs');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;

function scenario(config, original = false) {
  const trace = [], calls = new Map(), files = new Map();
  const root = '/voice-cache', manifest = root + '/manifest.jsonl';
  const failure = new Error('controlled failure');
  function call(name, args, run) {
    trace.push([name, ...args]);
    const count = (calls.get(name) || 0) + 1; calls.set(name, count);
    if (config.fail === name && count === config.at) throw failure;
    return run();
  }
  const entries = [];
  function add(name, expiresAt, exists = true) {
    const audioFilePath = root + '/' + name;
    entries.push({ cacheKey: name, audioFilePath, createdAt: 100, expiresAt });
    if (exists) files.set(audioFilePath, { mtimeMs: 9999.9 });
  }
  if (config.fixture === 'kept') add('kept.wav', 10001);
  if (config.fixture === 'expired') add('expired.wav', 10000);
  if (config.fixture === 'missing') add('missing.wav', 10001, false);
  if (config.fixture === 'mixed') {
    add('kept.wav', 10001); add('expired.wav', 9999); add('missing.wav', 10001, false);
    entries.push({ cacheKey: 'outside', audioFilePath: '/outside.wav', createdAt: 100, expiresAt: 1 });
  }
  if (config.fixture === 'duplicate') { add('same.wav', 9999); add('same.wav', 10001); }
  for (const [name, mtimeMs] of [['old.wav', 8999.9], ['edge.wav', 9000], ['fresh.wav', 9000.9], ['future.wav', 10001]]) {
    if (config.strays) files.set(root + '/' + name, { mtimeMs });
  }
  if (config.rootExists) files.set(root, { directory: true });
  if (config.manifestExists) files.set(manifest, { text: entries.map(e => JSON.stringify(e)).join('\n') + '\ninvalid-json\n' });
  const fakeFs = {
    readFileSync: (p, encoding) => call('read', [p, encoding], () => files.get(p).text),
    writeFileSync: (p, text, encoding) => call('write', [p, text, encoding], () => files.set(p, { text })),
    readdirSync: (p, options) => call('readdir', [p, options], () => {
      const names = ['subdirectory', ...[...files.keys()].filter(f => f.startsWith(root + '/')).map(f => f.slice(root.length + 1))];
      return names.map(name => ({ name, isFile: () => call('isFile', [name], () => name !== 'subdirectory') }));
    }),
    statSync: p => call('stat', [p], () => { if (!files.has(p)) throw failure; return files.get(p); }),
    unlinkSync: p => call('unlink', [p], () => { if (!files.has(p)) throw failure; files.delete(p); }),
  };
  const context = {
    fs: fakeFs, generatedAudioCacheRoot: root, generatedAudioManifestPath: manifest,
    generatedAudioCacheManifestFile: 'manifest.jsonl', generatedAudioCacheTtlMs: 1000,
    generatedAudioCachePreviewLimit: 120,
    ensureGeneratedAudioCacheRoot: () => call('ensure', [], () => files.set(root, { directory: true })),
    pathExists: p => call('exists', [p], () => files.has(p)),
    isPathInside: (p, r) => call('inside', [p, r], () => p.startsWith(r + '/')),
    normalizeComparablePath: p => call('normalize', [p], () => p.toLowerCase()),
    path: {
      resolve: p => call('resolve', [p], () => p),
      basename: p => call('basename', [p], () => path.posix.basename(p)),
      join: (...args) => call('join', args, () => path.posix.join(...args)),
    },
    buildJsonError: e => call('error', [e === failure], () => ({ message: e.message })),
    writeRuntimeLog: (...args) => call('log', args, () => undefined),
  };
  function load(source) {
    const module = { exports: {} };
    vm.runInNewContext(source, { module, exports: module.exports,
      Date: { now: () => call('clock', [], () => 10000) },
      require: name => name.startsWith('./localVoiceRuntime')
        ? load(fs.readFileSync(path.join(path.dirname(sourcePath), name), 'utf8')) : require(name),
    });
    return module.exports;
  }
  const factory = load(original ? baseline : fs.readFileSync(sourcePath, 'utf8')).createLocalVoiceRuntimeGeneratedAudioUtils;
  const api = factory(context);
  assert.equal(trace.length, 0, 'assembly must not access cache or clock');
  let result, error;
  try { result = api.cleanupGeneratedAudioCache(config.reason); } catch (e) { error = e === failure ? 'original-error' : e.message; }
  return JSON.parse(JSON.stringify({ trace, result, error, files: [...files] }));
}

const failures = [undefined, 'exists', 'ensure', 'clock', 'read', 'write', 'readdir', 'isFile',
  'stat', 'unlink', 'inside', 'normalize', 'resolve', 'basename', 'join', 'error', 'log'];
let count = 0;
for (const fixture of ['empty', 'kept', 'expired', 'missing', 'mixed', 'duplicate']) {
  for (const reason of [undefined, 'startup']) for (const fail of failures) for (const at of [1, 2]) {
    const config = { fixture, reason, fail, at, rootExists: true, manifestExists: true, strays: true };
    const actual = scenario(config);
    if (baseline) assert.deepEqual(actual, scenario(config, true), JSON.stringify(config));
    if (actual.error !== undefined) assert.equal(actual.error, 'original-error');
    assert.ok(actual.trace.filter(t => t[0] === 'write').length <= 1);
    for (const deletion of actual.trace.filter(t => t[0] === 'unlink')) {
      assert.ok(deletion[1].startsWith('/voice-cache/'));
      assert.notEqual(deletion[1], '/voice-cache/manifest.jsonl');
    }
    const clockIndex = actual.trace.findIndex(t => t[0] === 'clock');
    if (clockIndex >= 0) assert.ok(actual.trace.findIndex(t => t[0] === 'ensure') < clockIndex);
    count++;
  }
}
for (const rootExists of [false, true]) for (const manifestExists of [false, true]) {
  const config = { fixture: 'empty', reason: 'startup', rootExists, manifestExists, strays: false };
  const actual = scenario(config);
  if (baseline) assert.deepEqual(actual, scenario(config, true));
  if (!rootExists && !manifestExists) assert.deepEqual(actual.trace, [['exists', '/voice-cache'], ['exists', '/voice-cache/manifest.jsonl']]);
  count++;
}
const normal = scenario({ fixture: 'mixed', rootExists: true, manifestExists: true, strays: true });
assert.equal(normal.result.length, 1);
assert.equal(normal.result[0].cacheKey, 'kept.wav');
assert.deepEqual(normal.trace.filter(t => t[0] === 'unlink').map(t => t[1]),
  ['/voice-cache/expired.wav', '/voice-cache/old.wav', '/voice-cache/edge.wav', '/voice-cache/fresh.wav']);
assert.equal(normal.trace.at(-1)[2].removedCount, 5);
for (const file of [sourcePath, helperPath]) {
  const source = fs.readFileSync(file, 'utf8');
  assert.ok(source.split('\n').length <= 300);
  if (file !== helperPath) continue;
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function walk(n) {
    if (ts.isFunctionLike(n) && n.body) {
      const size = ast.getLineAndCharacterOfPosition(n.end).line - ast.getLineAndCharacterOfPosition(n.getStart(ast)).line + 1;
      assert.ok(size <= 50, `${n.name?.getText(ast)}: ${size}`);
    }
    ts.forEachChild(n, walk);
  }
  walk(ast);
}
console.log(`local voice generated audio cleanup: ${count} expiry/stray/order/error scenarios passed${baseline ? ' against baseline' : ''}`);
