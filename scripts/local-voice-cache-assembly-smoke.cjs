const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sessionSource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntimeSessionAssembly.cjs'), 'utf8');
const { createRequire } = require('node:module');
const ts = require('typescript');
const resourceSource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntimeResourceAssembly.cjs'), 'utf8');
const modulePath = path.join(__dirname, '../electron/localVoiceRuntimeCacheAssembly.cjs');
const source = fs.readFileSync(modulePath, 'utf8');
const { createLocalVoiceCacheAssembly } = require(modulePath);
const groups = [
  ['buildReferenceTextCacheKey', 'clearBrokenModeRuntimeCandidate', 'ensureGeneratedAudioCacheRoot',
    'getBrokenModeRuntimeCandidate', 'getGeneratedAudioCacheFilePath', 'markBrokenModeRuntimeCandidate',
    'persistReferenceText', 'readPersistedReferenceText'],
  ['buildGeneratedAudioCacheKey', 'buildGeneratedAudioTextPreview', 'cleanupGeneratedAudioCache',
    'getGeneratedAudioFileUrl', 'updateGeneratedAudioManifestEntry'],
  ['persistGeneratedAudioCache', 'resolveGeneratedAudioCacheHit'],
];
const factoryNames = ['createLocalVoiceRuntimeCacheUtils', 'createLocalVoiceRuntimeGeneratedAudioUtils',
  'createLocalVoiceRuntimeGeneratedAudioResultUtils'];

function loadBaseline(file) {
  const root = fs.readFileSync(file, 'utf8');
  const a = root.indexOf('  const {\n    buildReferenceTextCacheKey,'), b = root.indexOf('  const {\n    getConfiguredReferenceText,', a);
  assert.ok(a >= 0 && b > a);
  return context => new Function(...Object.keys(context),
    `${root.slice(a, b)} return { ${groups.flat().join(', ')} };`,
  )(...Object.values(context));
}

function controlled(context, failIndex, baseline) {
  const trace = [], tokens = new Map(), failure = new Error('assembly failed');
  const factories = Object.fromEntries(factoryNames.map((name, index) => [name, input => {
    const normalized = {};
    for (const [key, value] of Object.entries(input)) {
      const expectedKey = { generatedAudioCacheManifestFile: 'GENERATED_AUDIO_CACHE_MANIFEST_FILE',
        generatedAudioCachePreviewLimit: 'GENERATED_AUDIO_CACHE_PREVIEW_LIMIT',
        generatedAudioCacheTtlMs: 'GENERATED_AUDIO_CACHE_TTL_MS' }[key] ?? key;
      assert.equal(value, tokens.get(key) ?? context[expectedKey], `dependency identity: ${name}.${key}`);
      normalized[key] = tokens.has(key) ? `output:${key}` : expectedKey;
    }
    trace.push([name, normalized]);
    if (index === failIndex) throw failure;
    return Object.fromEntries(groups[index].map(key => {
      const token = () => key; tokens.set(key, token); return [key, token];
    }));
  }]));
  let result;
  try {
    if (baseline) result = baseline({ ...context, ...factories });
    else {
      const loaded = { exports: {} };
      const realRequire = createRequire(modulePath);
      new Function('require', 'module', source)(name => {
        if (/localVoiceRuntime(CacheUtils|GeneratedAudioUtils|GeneratedAudioResultUtils)/.test(name)) return factories;
        return realRequire(name);
      }, loaded);
      result = loaded.exports.createLocalVoiceCacheAssembly(context);
    }
    assert.deepEqual(Object.keys(result), groups.flat());
    for (const [key, value] of Object.entries(result)) assert.equal(value, tokens.get(key));
  } catch (error) {
    assert.equal(error, failure); result = { failed: true };
  }
  assert.equal(trace.length, failIndex < 0 ? 3 : failIndex + 1);
  return { trace, result: result.failed ? result : Object.keys(result) };
}

function realIsolation() {
  const logs = [], writes = [], mapA = new Map(), mapB = new Map();
  const context = { buildJsonError: error => error.message, describeRuntimeCandidate: candidate => candidate.label,
    ensureDir: target => writes.push(target), ensureRuntimeRoot: () => writes.push('runtime'),
    fs: { statSync: () => ({ size: 16, mtimeMs: 12.9 }) }, path,
    generatedAudioCacheRoot: 'controlled-audio', referenceTextCachePath: 'reference.json',
    pathExists: () => false, writeRuntimeLog: (...args) => logs.push(args),
    GENERATED_AUDIO_CACHE_MANIFEST_FILE: 'manifest.jsonl', GENERATED_AUDIO_CACHE_PREVIEW_LIMIT: 120,
    GENERATED_AUDIO_CACHE_TTL_MS: 3600000, generatedAudioManifestPath: 'manifest.jsonl',
    isPathInside: () => true, normalizeComparablePath: value => value,
  };
  const a = createLocalVoiceCacheAssembly({ ...context, brokenModeRuntimeCandidates: mapA });
  const b = createLocalVoiceCacheAssembly({ ...context, brokenModeRuntimeCandidates: mapB });
  assert.deepEqual(logs, []); assert.deepEqual(writes, []);
  const candidate = { label: 'venv-tts' };
  a.markBrokenModeRuntimeCandidate('tts', candidate, new Error('broken A'));
  assert.equal(mapA.size, 1); assert.equal(mapB.size, 0);
  assert.equal(a.getBrokenModeRuntimeCandidate('tts', candidate).message, 'broken A');
  assert.equal(b.getBrokenModeRuntimeCandidate('tts', candidate), null);
  b.markBrokenModeRuntimeCandidate('tts', candidate, new Error('broken B'));
  a.clearBrokenModeRuntimeCandidate('tts', candidate);
  assert.equal(mapA.size, 0); assert.equal(mapB.size, 1);
  assert.equal(b.getBrokenModeRuntimeCandidate('tts', candidate).message, 'broken B');
  assert.equal(a.buildReferenceTextCacheKey('audio', 'model', ''), 'audio::model::zh-CN::16::12');
  assert.equal(a.getGeneratedAudioCacheFilePath('key'), path.join('controlled-audio', 'key.wav'));
  assert.deepEqual(writes, ['controlled-audio']);
  assert.equal(a.readPersistedReferenceText('missing'), '');
}

function structure() {
  const stateSource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntimeState.cjs'), 'utf8');
  assert.ok(source.split('\n').length <= 300);
  const ast = ts.createSourceFile(modulePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.body) assert.ok(
      ast.getLineAndCharacterOfPosition(node.end).line - ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 <= 50);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const root = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntime.cjs'), 'utf8');
  assert.match(root, /createLocalVoiceResourceAssembly\(\{/);
  assert.match(resourceSource, /createLocalVoiceCacheAssembly\(\{/);
  for (const name of factoryNames) assert.ok(!root.includes(`${name}(`));
  assert.match(root, /createLocalVoiceSessionAssembly\(\{/u);
  assert.match(sessionSource, /createLocalVoiceRuntimeState\(\)/u);
  assert.match(stateSource, /const brokenModeRuntimeCandidates = new Map\(\)/);
}

structure();
const baseline = process.argv[2] ? loadBaseline(process.argv[2]) : null;
for (const suffix of ['A', 'B']) {
  const context = Object.fromEntries(['buildJsonError', 'brokenModeRuntimeCandidates', 'describeRuntimeCandidate',
    'ensureDir', 'ensureRuntimeRoot', 'fs', 'generatedAudioCacheRoot', 'path', 'pathExists',
    'referenceTextCachePath', 'writeRuntimeLog', 'GENERATED_AUDIO_CACHE_MANIFEST_FILE',
    'GENERATED_AUDIO_CACHE_PREVIEW_LIMIT', 'GENERATED_AUDIO_CACHE_TTL_MS', 'generatedAudioManifestPath',
    'isPathInside', 'normalizeComparablePath'].map(name => [name, { name, suffix }]));
  for (const failIndex of [-1, 0, 1, 2]) {
    const actual = controlled(context, failIndex);
    if (baseline) assert.deepEqual(actual, controlled(context, failIndex, baseline));
  }
}
realIsolation();
console.log(`local voice cache assembly: 8 dependency/order/failure cases and real two-instance state isolation passed${baseline ? ' against baseline' : ''}`);
