const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
const modulePath = path.join(__dirname, '../electron/localVoiceRuntimeGeneratedAudioUtils.cjs');
const source = fs.readFileSync(modulePath, 'utf8');
const original = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const names = ['createLocalVoiceGeneratedAudioKey', 'createLocalVoiceManifestStore',
  'createLocalVoiceGeneratedAudioCleanup'];
const groups = [['buildGeneratedAudioCacheKey', 'buildGeneratedAudioTextPreview'],
  ['readGeneratedAudioManifestEntries', 'writeGeneratedAudioManifestEntries', 'updateGeneratedAudioManifestEntry'],
  ['cleanupGeneratedAudioCache']];
const publicKeys = ['buildGeneratedAudioCacheKey', 'buildGeneratedAudioTextPreview',
  'cleanupGeneratedAudioCache', 'getGeneratedAudioFileUrl', 'updateGeneratedAudioManifestEntry'];
const contextKeys = ['buildJsonError', 'ensureGeneratedAudioCacheRoot', 'fs',
  'generatedAudioCacheManifestFile', 'generatedAudioCachePreviewLimit', 'generatedAudioCacheRoot',
  'generatedAudioCacheTtlMs', 'generatedAudioManifestPath', 'isPathInside', 'normalizeComparablePath',
  'path', 'pathExists', 'writeRuntimeLog'];

function controlled(code, suffix, failIndex) {
  const context = Object.fromEntries(contextKeys.map(key => [key, { key, suffix }]));
  const trace = [], outputs = new Map(), failure = new Error('factory failed');
  const factories = Object.fromEntries(names.map((name, index) => [name, input => {
    for (const [key, value] of Object.entries(input)) assert.equal(value, outputs.get(key) ?? context[key]);
    trace.push([name, Object.keys(input)]);
    if (index === failIndex) throw failure;
    return Object.fromEntries(groups[index].map(key => {
      const value = () => key; outputs.set(key, value); return [key, value];
    }));
  }]));
  const loaded = { exports: {} }, realRequire = createRequire(modulePath);
  new Function('require', 'module', code)(name => {
    if (name.startsWith('./localVoiceRuntime')) return factories;
    if (name === 'url') return { pathToFileURL: value => {
      trace.push(['url', value]);
      if (value === 'converter-failure') throw failure;
      if (value === 'href-failure') return { get href() { throw failure; } };
      return { href: `controlled:${value}` };
    } };
    return realRequire(name);
  }, loaded);
  let result;
  try { result = loaded.exports.createLocalVoiceRuntimeGeneratedAudioUtils(context); }
  catch (error) { assert.equal(error, failure); }
  assert.equal(trace.length, failIndex < 0 ? 3 : failIndex + 1);
  if (!result) return trace;
  assert.deepEqual(Object.keys(result), publicKeys);
  for (const key of publicKeys.filter(key => key !== 'getGeneratedAudioFileUrl')) {
    assert.equal(result[key], outputs.get(key));
  }
  for (const value of [undefined, null, '', 0, false, 'audio.wav', '中文 空格.wav',
    'converter-failure', 'href-failure']) {
    const expected = !value || value.endsWith('failure') ? null : `controlled:${value}`;
    assert.equal(result.getGeneratedAudioFileUrl(value), expected);
  }
  return trace;
}

for (const suffix of ['A', 'B']) {
  for (const failIndex of [-1, 0, 1, 2]) {
    const actual = controlled(source, suffix, failIndex);
    if (original) assert.deepEqual(actual, controlled(original, suffix, failIndex));
  }
}
const { createLocalVoiceRuntimeGeneratedAudioUtils } = require(modulePath);
const context = { fs: {}, path, pathExists: () => false };
const a = createLocalVoiceRuntimeGeneratedAudioUtils(context);
const b = createLocalVoiceRuntimeGeneratedAudioUtils(context);
assert.notEqual(a.getGeneratedAudioFileUrl, b.getGeneratedAudioFileUrl);
const audioPath = path.resolve('controlled-cache', '中文 空格.wav');
assert.equal(a.getGeneratedAudioFileUrl(audioPath), pathToFileURL(audioPath).href);
assert.equal(a.getGeneratedAudioFileUrl({}), null);
assert.equal(b.getGeneratedAudioFileUrl(null), null);
console.log(`Generated audio assembly: 8 order/dependency/failure cases, URL errors and instance isolation passed${original ? ' against baseline' : ''}.`);
