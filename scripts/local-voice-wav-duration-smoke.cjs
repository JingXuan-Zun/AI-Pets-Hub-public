const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const modulePath = path.join(__dirname, '../electron/localVoiceRuntimeAudioUtils.cjs');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
function chunk(name, content, declaredSize = content.length) {
  const header = Buffer.alloc(8); header.write(name); header.writeUInt32LE(declaredSize, 4);
  return Buffer.concat([header, content, content.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
}
function wave({ channels = 1, rate = 16000, bits = 16, dataSize = 96000, junk = 0, reversed = false } = {}) {
  const fmt = Buffer.alloc(16); fmt.writeUInt16LE(1); fmt.writeUInt16LE(channels, 2);
  fmt.writeUInt32LE(rate, 4); fmt.writeUInt16LE(bits, 14);
  const format = chunk('fmt ', fmt), data = chunk('data', Buffer.alloc(0), dataSize);
  const header = Buffer.alloc(12); header.write('RIFF'); header.write('WAVE', 8);
  return Buffer.concat([header, ...(junk ? [chunk('JUNK', Buffer.alloc(junk))] : []), ...(reversed ? [data, format] : [format, data])]);
}
function scenario(config, original = false) {
  const trace = [], failure = new Error('wav failure');
  const fileMap = new Map([['voice.wav', config.buffer], ['short.wav', wave({ dataSize: 16000 })],
    ['ideal.wav', wave()], ['long.wav', wave({ dataSize: 256000 })]]);
  let current;
  function call(name, args, run) { trace.push([name, ...args]); if (name === config.fail) throw failure; return run(); }
  const fakeFs = {
    openSync: (file, mode) => call('open', [file, mode], () => { current = file; return config.fd ?? 0; }),
    readSync: (fd, buffer, offset, length, position) => call('read', [fd, offset, length, position], () => {
      const content = fileMap.get(current) || Buffer.alloc(0);
      const count = Math.min(content.length, length, config.limit ?? length); content.copy(buffer, offset, 0, count); return count;
    }),
    closeSync: fd => call('close', [fd], () => undefined),
    statSync: file => call('stat', [file], () => ({ size: (fileMap.get(file)?.length || 0) + 1000, isFile: () => file !== 'references' })),
    readdirSync: (...args) => call('readdir', args, () => ['long.wav', 'short.wav', 'ideal.wav', 'ignore.txt'].map(name => ({ name, isFile: () => true }))),
  };
  const module = { exports: {} };
  vm.runInNewContext(original ? baseline : fs.readFileSync(modulePath, 'utf8'), {
    module, exports: module.exports,
    Buffer: { alloc: size => call('alloc', [size], () => Buffer.alloc(size)) },
    require: name => name === 'fs' ? fakeFs : name === 'path' ? {
      ...path.posix, extname: file => call('extension', [file], () => path.posix.extname(file)),
      join: (root, name) => name,
    } : { pathExists: file => call('exists', [file], () => true) },
  });
  let result, error;
  try {
    if (config.operation === 'resolve') result = module.exports.resolveReferenceAudioPath('references');
    else if (config.operation === 'score') result = module.exports.scoreReferenceAudioCandidate(config.audioPath ?? 'voice.wav');
    else result = module.exports.getWavAudioDurationMs(config.audioPath === undefined ? 'voice.wav' : config.audioPath);
  } catch (e) { error = e === failure ? 'original-error' : e.message; }
  return structuredClone({ result, error, trace });
}
function compare(config) {
  const actual = scenario(config);
  if (baseline) assert.deepEqual(actual, scenario(config, true));
  if (actual.error !== undefined) assert.equal(actual.error, 'original-error');
  if (actual.trace.some(t => t[0] === 'open') && config.fail !== 'open') assert.equal(actual.trace.filter(t => t[0] === 'close').length,
    config.operation === 'resolve' ? 3 : 1, 'close every successfully opened descriptor, including zero');
  return actual;
}
let count = 0;
const fixtures = [];
for (const channels of [0, 1, 2]) for (const rate of [0, 16000, 44100]) for (const bits of [0, 8, 16, 24]) {
  for (const dataSize of [0, 96000, 0xffffffff]) fixtures.push(wave({ channels, rate, bits, dataSize }));
}
fixtures.push(Buffer.alloc(0), Buffer.alloc(43), Buffer.alloc(44), wave({ junk: 3 }), wave({ reversed: true }), wave({ junk: 512 * 1024 }));
const wrongRiff = wave(); wrongRiff.write('RIFX'); fixtures.push(wrongRiff);
for (const buffer of fixtures) for (const limit of [undefined, 43, 44]) {
  compare({ buffer, limit }); count++;
}
for (const fail of [undefined, 'extension', 'open', 'alloc', 'read', 'close', 'stat']) for (const operation of ['duration', 'score']) {
  for (const fd of [0, 12]) { compare({ buffer: wave(), fail, operation, fd }); count++; }
}
for (const audioPath of ['', null, 'voice.mp3', 'voice.WAV']) { compare({ buffer: wave(), audioPath }); count++; }
assert.equal(compare({ buffer: wave() }).result, 3000);
assert.equal(compare({ buffer: wave({ channels: 2, bits: 16 }) }).result, 1500);
assert.equal(compare({ buffer: wave({ junk: 3 }) }).result, 3000);
assert.equal(compare({ buffer: wave({ reversed: true }) }).result, null);
assert.equal(compare({ buffer: wave({ junk: 512 * 1024 }) }).result, null, 'retain fixed 512KiB read limit');
assert.equal(compare({ buffer: wave(), fail: 'close' }).result, 3000);
assert.equal(compare({ buffer: wave(), fail: 'read' }).result, null);
assert.equal(compare({ buffer: wave(), fail: 'extension' }).error, 'original-error');
assert.equal(compare({ buffer: wave(), audioPath: '' }).trace.length, 0);
const selected = compare({ operation: 'resolve', buffer: wave() }); assert.equal(selected.result, 'ideal.wav');
const source = fs.readFileSync(modulePath, 'utf8'); assert.ok(source.split('\n').length <= 300);
const ast = ts.createSourceFile(modulePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
function walk(n) {
  if (ts.isFunctionLike(n) && n.body) assert.ok(ast.getLineAndCharacterOfPosition(n.end).line - ast.getLineAndCharacterOfPosition(n.getStart(ast)).line + 1 <= 50);
  ts.forEachChild(n, walk);
}
walk(ast);
console.log(`local voice WAV duration: ${count} header/chunk/duration/read/error cases, reference selection integration passed${baseline ? ' against baseline' : ''}`);
