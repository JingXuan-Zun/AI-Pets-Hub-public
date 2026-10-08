const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { createLocalVoiceGeneratedAudioKey } = require('../electron/localVoiceRuntimeGeneratedAudioKey.cjs');
const ts = require('typescript');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
function original(context) {
  const module = { exports: {} };
  new Function('require', 'module', 'exports', baseline)(createRequire(require.resolve('../electron/localVoiceRuntimeGeneratedAudioUtils.cjs')), module, module.exports);
  return module.exports.createLocalVoiceRuntimeGeneratedAudioUtils(context);
}
function keyScenario(config, useOriginal = false) {
  const trace = [], failure = new Error('signature failure'); let callCount = 0;
  function call(name, value, run) {
    trace.push([name, value]);
    if (++callCount === config.failAt) throw failure;
    return run();
  }
  const context = {
    generatedAudioCachePreviewLimit: 120,
    pathExists: target => call('exists', target, () => config.exists),
    fs: { statSync: target => call('stat', target, () => ({
      size: config.size, mtimeMs: config.mtimeMs,
      isDirectory: () => call('directory', target, () => config.directory),
    })) },
  };
  const api = useOriginal ? original(context) : createLocalVoiceGeneratedAudioKey(context);
  assert.deepEqual(trace, [], 'factory must not access paths');
  let result, error;
  try { result = api.buildGeneratedAudioCacheKey(config.input); } catch (e) { error = e === failure ? 'same-error' : e.message; }
  return { result, error, trace };
}
let count = 0;
const inputs = [
  {}, { text: '  hello \n 世界  ', seed: 2.9 }, { text: 42, languageCode: '', seed: '3' },
  { text: '', languageCode: 'en', seed: NaN }, { text: 'x', seed: Infinity }, { text: 'x', seed: -3.8 },
  { text: 'voice', ttsModelPath: 'tts', referencePath: 'reference', referenceAudioPath: 'audio', referenceText: 'ref', referenceSttModelPath: 'stt' },
  { text: 'voice', ttsModelPath: '', referencePath: null, referenceAudioPath: 'audio', referenceSttModelPath: 'stt' },
];
for (const input of inputs) for (const exists of [true, false]) for (const directory of [true, false]) {
  for (const failAt of [undefined, ...Array.from({ length: 12 }, (_, i) => i + 1)]) {
    const config = { input, exists, directory, failAt, size: 123, mtimeMs: 456.9 };
    const actual = keyScenario(config);
    if (baseline) assert.deepEqual(actual, keyScenario(config, true), JSON.stringify(config));
    if (actual.result !== undefined) assert.match(actual.result, /^[a-f0-9]{64}$/);
    if (actual.error !== undefined) assert.equal(actual.error, 'same-error');
    count++;
  }
}
const blank = keyScenario({ input: {} });
const payload = { text: '', languageCode: 'zh-CN', seed: null,
  ttsModelPath: '', ttsModelSignature: null, referencePath: '', referencePathSignature: null,
  referenceAudioPath: '', referenceAudioSignature: null, referenceText: '',
  referenceSttModelPath: '', referenceSttModelSignature: null };
assert.equal(blank.result, crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex'));
assert.deepEqual(blank.trace, []);
const signatureInput = { text: 'a', ttsModelPath: 'tts' };
const stable = keyScenario({ input: signatureInput, exists: true, directory: false, size: 1, mtimeMs: 1.1 });
assert.equal(stable.result, keyScenario({ input: signatureInput, exists: true, directory: false, size: 1, mtimeMs: 1.9 }).result);
assert.notEqual(stable.result, keyScenario({ input: signatureInput, exists: true, directory: false, size: 1, mtimeMs: 2 }).result);
assert.notEqual(stable.result, keyScenario({ input: signatureInput, exists: true, directory: true, size: 1, mtimeMs: 1.1 }).result);
let previews = 0;
for (const limit of [undefined, 0, 2, 120, -1]) for (const text of [undefined, null, '', ' \n ', 42, ' a\t b\n c ', '世界😀'.repeat(50)]) {
  const api = createLocalVoiceGeneratedAudioKey({ generatedAudioCachePreviewLimit: limit });
  const result = api.buildGeneratedAudioTextPreview(text);
  if (baseline) assert.equal(result, original({ generatedAudioCachePreviewLimit: limit }).buildGeneratedAudioTextPreview(text));
  previews++;
}
assert.equal(createLocalVoiceGeneratedAudioKey({ generatedAudioCachePreviewLimit: 2 }).buildGeneratedAudioTextPreview(' a  b '), 'a ...');
const failure = new Error('string conversion');
assert.throws(() => createLocalVoiceGeneratedAudioKey({}).buildGeneratedAudioTextPreview({ toString() { throw failure; } }), e => e === failure);
const file = path.join(__dirname, '../electron/localVoiceRuntimeGeneratedAudioKey.cjs'), source = fs.readFileSync(file, 'utf8');
assert.ok(source.split('\n').length <= 300);
const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
function walk(n) {
  if (ts.isFunctionLike(n) && n.body) assert.ok(ast.getLineAndCharacterOfPosition(n.end).line - ast.getLineAndCharacterOfPosition(n.getStart(ast)).line + 1 <= 50);
  ts.forEachChild(n, walk);
}
walk(ast);
console.log(`local voice generated audio key: ${count} signature/hash/error and ${previews} preview cases passed${baseline ? ' against baseline' : ''}`);
