const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const modulePath = path.join(__dirname, '../electron/localVoiceRuntimeResourceAssembly.cjs');
const source = fs.readFileSync(modulePath, 'utf8');
const realRequire = createRequire(modulePath);
const names = ['createRuntimeRootHelpers', 'createLocalVoiceCacheAssembly', 'createLocalVoiceRuntimeSelectionUtils'];
const groups = [['ensureRuntimeRoot', 'getSharedOptions'],
  ['buildReferenceTextCacheKey', 'clearBrokenModeRuntimeCandidate', 'ensureGeneratedAudioCacheRoot',
    'getBrokenModeRuntimeCandidate', 'getGeneratedAudioCacheFilePath', 'markBrokenModeRuntimeCandidate',
    'persistReferenceText', 'readPersistedReferenceText', 'buildGeneratedAudioCacheKey',
    'buildGeneratedAudioTextPreview', 'cleanupGeneratedAudioCache', 'getGeneratedAudioFileUrl',
    'updateGeneratedAudioManifestEntry', 'persistGeneratedAudioCache', 'resolveGeneratedAudioCacheHit'],
  ['getConfiguredReferenceText', 'resolveAssetSelection']];
const publicKeys = ['getSharedOptions', ...groups[1], ...groups[2]];
const inputKeys = ['runtimeRoot', 'brokenModeRuntimeCandidates', 'generatedAudioCacheRoot',
  'referenceTextCachePath', 'writeRuntimeLog', 'GENERATED_AUDIO_CACHE_MANIFEST_FILE',
  'GENERATED_AUDIO_CACHE_PREVIEW_LIMIT', 'GENERATED_AUDIO_CACHE_TTL_MS',
  'generatedAudioManifestPath', 'localVoiceLibrary', 'embeddedRunnerPath'];

function loadBaseline(file) {
  const root = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const start = root.indexOf('  const { ensureRuntimeRoot, getSharedOptions } = createRuntimeRootHelpers(');
  const end = root.indexOf('  const {\n    destroyModeWorker, requestModeWorker, resolveBasePythonRuntime, getHealth,', start);
  assert.ok(start >= 0 && end > start);
  return context => new Function(...Object.keys(context),
    `${root.slice(start, end)} return { ${publicKeys.join(', ')} };`)(...Object.values(context));
}

function controlled(tag, failIndex, baseline) {
  const context = Object.fromEntries(inputKeys.map(key => [key, { key, tag }]));
  const helpers = Object.assign({ fs, path }, ...['HostUtils', 'AudioUtils', 'ProcessUtils', 'PathUtils']
    .map(name => realRequire(`./localVoiceRuntime${name}.cjs`)));
  const trace = [], outputs = new Map(), failure = new Error('resource stage failed');
  const factories = Object.fromEntries(names.map((name, index) => [name, input => {
    for (const [key, value] of Object.entries(input)) {
      assert.equal(value, outputs.get(key) ?? context[key] ?? helpers[key], `${name}.${key}`);
    }
    trace.push([name, Object.keys(input)]);
    if (index === failIndex) throw failure;
    return Object.fromEntries(groups[index].map(key => {
      const token = () => { throw new Error(`unexpected eager call: ${key}`); };
      outputs.set(key, token); return [key, token];
    }));
  }]));
  let result;
  try {
    if (baseline) result = baseline({ ...helpers, ...context, ...factories });
    else {
      const loaded = { exports: {} };
      new Function('require', 'module', source)(name => {
        if (/localVoiceRuntime(CoreUtils|CacheAssembly|SelectionUtils)\.cjs$/.test(name)) return factories;
        return realRequire(name);
      }, loaded);
      result = loaded.exports.createLocalVoiceResourceAssembly(context);
    }
  } catch (error) { assert.equal(error, failure); }
  assert.equal(trace.length, failIndex < 0 ? 3 : failIndex + 1);
  if (result) {
    assert.deepEqual(Object.keys(result), baseline ? publicKeys : [...publicKeys, 'ensureRunnerScriptPath']);
    if (!baseline) assert.equal(typeof result.ensureRunnerScriptPath, 'function');
    for (const key of publicKeys) assert.equal(result[key], outputs.get(key));
  }
  return { trace, result: result ? publicKeys : null };
}

const baseline = process.argv[2] ? loadBaseline(process.argv[2]) : null;
for (const tag of ['A', 'B']) for (const failIndex of [-1, 0, 1, 2]) {
  const actual = controlled(tag, failIndex);
  if (baseline) assert.deepEqual(actual, controlled(tag, failIndex, baseline));
}
const root = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntime.cjs'), 'utf8');
assert.match(root, /createLocalVoiceResourceAssembly\(\{/);
for (const name of names) assert.ok(!root.includes(`${name}(`));
console.log(`Local voice resource assembly: 8 dependency/order/failure scenarios, callback identity and no eager effects passed${baseline ? ' against baseline' : ''}.`);
