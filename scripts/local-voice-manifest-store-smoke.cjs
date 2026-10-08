const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');
const { createLocalVoiceManifestStore } = require('../electron/localVoiceRuntimeManifestStore.cjs');
const { normalizeGeneratedAudioManifestEntry } = require('../electron/localVoiceRuntimeManifestEntry.cjs');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8').replace(/\r\n/g, '\n') : null;
const entry = overrides => ({ cacheKey: 'key', audioFilePath: 'C:\\cache\\voice.wav', createdAt: 10, expiresAt: 20, ...overrides });
const values = [null, undefined, 1, '', [], {}, entry(), entry({ cacheKey: '  ' }), entry({ audioFilePath: '' }),
  entry({ createdAt: 'invalid' }), entry({ expiresAt: Infinity }), entry({ audioFilePath: 'D:\\outside.wav' }),
  entry({ lastAccessedAt: 'invalid', hitCount: -3, textLength: -1, seed: '2.9', mimeType: ' ', languageCode: '' }),
  entry({ cacheKey: ' key ', audioFilePath: ' C:\\cache\\voice.wav ', createdAt: '12', expiresAt: '30',
    lastAccessedAt: '17', hitCount: '4', mimeType: ' audio/custom ', languageCode: ' en ', audioFileName: ' custom.wav ',
    textPreview: 'preview', referenceTextLength: '9', referencePath: 'ref', seed: null }),
];
function originalFactory(context) {
  const module = { exports: {} };
  const source = baseline.replace('  return {\n    buildGeneratedAudioCacheKey,',
    '  return {\n    normalizeGeneratedAudioManifestEntry, readGeneratedAudioManifestEntries, writeGeneratedAudioManifestEntries,\n    buildGeneratedAudioCacheKey,');
  new Function('require', 'module', 'exports', source)(createRequire(require.resolve('../electron/localVoiceRuntimeGeneratedAudioUtils.cjs')), module, module.exports);
  return module.exports.createLocalVoiceRuntimeGeneratedAudioUtils(context);
}
function scenario(config, original = false) {
  const trace = [], calls = new Map(), failure = new Error('manifest failure');
  const base = [entry({ cacheKey: 'later', createdAt: 15 }), entry(), entry({ createdAt: 5 }), null,
    entry({ audioFilePath: 'D:\\outside.wav' })];
  let content = base.map(value => JSON.stringify(value)).join('\r\n') + '\n invalid-json \n\n';
  let next, seenCurrent, updatedEntry;
  function call(name, args, run) {
    trace.push([name, ...args]); const count = (calls.get(name) || 0) + 1; calls.set(name, count);
    if (config.fail === name && count === config.at) throw failure;
    return run();
  }
  const context = {
    generatedAudioCacheRoot: 'C:\\cache', generatedAudioManifestPath: 'manifest.jsonl',
    fs: {
      readFileSync: (...args) => call('read', args, () => content),
      writeFileSync: (...args) => call('write', args, () => { content = args[1]; }),
    },
    pathExists: p => call('exists', [p], () => config.exists !== false),
    ensureGeneratedAudioCacheRoot: () => call('ensure', [], () => undefined),
    isPathInside: (p, root) => call('inside', [p, root], () => p.startsWith(root + '\\')),
    path: {
      resolve: p => call('resolve', [p], () => path.win32.resolve(p)),
      basename: p => call('basename', [p], () => path.win32.basename(p)),
    },
    buildJsonError: error => call('error', [error === failure], () => ({ message: error.message })),
    writeRuntimeLog: (...args) => call('log', args, () => undefined),
  };
  const api = original ? originalFactory(context) : createLocalVoiceManifestStore(context);
  assert.equal(trace.length, 0, 'store creation must not read/write or normalize');
  let result, error;
  try {
    if (config.operation === 'normalize') result = original
      ? api.normalizeGeneratedAudioManifestEntry(values[config.index]) : normalizeGeneratedAudioManifestEntry(context, values[config.index]);
    if (config.operation === 'read') result = api.readGeneratedAudioManifestEntries();
    if (config.operation === 'write') result = api.writeGeneratedAudioManifestEntries(config.nonArray ? null : base);
    if (config.operation === 'update') result = api.updateGeneratedAudioManifestEntry(config.key, config.updater === 'none' ? null : current => {
      seenCurrent = current;
      call('updater', [current], () => undefined);
      if (config.updater === 'delete') return null;
      if (config.updater === 'mutate' && current) current.textPreview = 'mutated';
      next = entry({ cacheKey: config.updater === 'rename' ? 'renamed' : config.key,
        createdAt: 1, audioFilePath: config.updater === 'invalid' ? 'D:\\outside.wav' : 'C:\\cache\\new.wav' });
      updatedEntry = next;
      return next;
    });
  } catch (e) { error = e === failure ? 'original-error' : e.message; }
  return { trace, result, error, content,
    nextInEntries: !!updatedEntry && !!result?.entries?.includes(updatedEntry),
    entryWasNormalized: !!result?.entry && result.entry !== updatedEntry,
    currentWasFound: !!seenCurrent };
}
function compare(config) {
  const actual = scenario(config);
  if (baseline) assert.deepEqual(actual, scenario(config, true), JSON.stringify(config));
  if (actual.error !== undefined) assert.equal(actual.error, 'original-error');
  assert.ok(actual.trace.filter(t => t[0] === 'write').length <= 1);
  return actual;
}
let count = 0;
for (let index = 0; index < values.length; index++) for (const fail of [undefined, 'resolve', 'inside', 'basename']) {
  compare({ operation: 'normalize', index, fail, at: 1 }); count++;
}
for (const exists of [true, false]) for (const fail of [undefined, 'exists', 'read', 'ensure', 'write', 'resolve', 'inside', 'basename', 'error', 'log', 'updater']) {
  for (const at of [1, 2]) {
    for (const operation of ['read', 'write']) { compare({ operation, exists, fail, at }); count++; }
    for (const key of ['key', 'absent']) for (const updater of ['none', 'delete', 'replace', 'rename', 'invalid', 'mutate']) {
      compare({ operation: 'update', key, updater, exists, fail, at }); count++;
    }
  }
}
const written = compare({ operation: 'write' });
assert.deepEqual(written.result.map(e => e.createdAt), [5, 10, 15]);
assert.ok(written.content.endsWith('\n'));
const deleted = compare({ operation: 'update', key: 'key', updater: 'delete' });
assert.equal(deleted.result.entry, null);
assert.equal(deleted.result.entries.filter(e => e.cacheKey === 'key').length, 1, 'remove only first duplicate');
const replaced = compare({ operation: 'update', key: 'key', updater: 'replace' });
assert.equal(replaced.nextInEntries, true);
assert.equal(replaced.entryWasNormalized, true);
const empty = compare({ operation: 'write', nonArray: true }); assert.equal(empty.content, '');
const absent = compare({ operation: 'update', key: 'absent', updater: 'delete' });
assert.equal(absent.trace.some(t => t[0] === 'ensure' || t[0] === 'write'), false);
for (const name of ['ManifestEntry', 'ManifestStore']) {
  const file = path.join(__dirname, `../electron/localVoiceRuntime${name}.cjs`), source = fs.readFileSync(file, 'utf8');
  assert.ok(source.split('\n').length <= 300);
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function walk(n) {
    if (ts.isFunctionLike(n) && n.body) assert.ok(ast.getLineAndCharacterOfPosition(n.end).line - ast.getLineAndCharacterOfPosition(n.getStart(ast)).line + 1 <= 50);
    ts.forEachChild(n, walk);
  }
  walk(ast);
}
console.log(`local voice manifest store: ${count} normalization/read/write/update/error scenarios passed${baseline ? ' against baseline' : ''}`);
