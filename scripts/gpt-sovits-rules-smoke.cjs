const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const rules = require('../electron/gptSovitsRules.cjs');
const { listGptSovitsModels, findGptSovitsModel } = require('../electron/gptSovitsModels.cjs');

let cases = 0;
const check = (actual, expected, label) => { assert.deepEqual(actual, expected, label); cases++; };

// Base URL: loopback http only, path/query stripped, everything else falls back to the default.
for (const [input, expected] of [
  [undefined, 'http://127.0.0.1:9881/'], ['', 'http://127.0.0.1:9881/'], ['not a url', 'http://127.0.0.1:9881/'],
  ['http://127.0.0.1:9999/tts?x=1#y', 'http://127.0.0.1:9999/'], ['http://localhost:9881', 'http://localhost:9881/'],
  ['http://[::1]:9881', 'http://[::1]:9881/'], ['http://192.168.1.5:9881', 'http://127.0.0.1:9881/'],
  ['https://127.0.0.1:9881', 'http://127.0.0.1:9881/'], ['http://evil.example:9881', 'http://127.0.0.1:9881/'],
]) check(rules.normalizeGptSovitsBaseUrl(input).toString(), expected, `url ${input}`);

for (const [input, expected] of [['auto', 'auto'], ['cuda', 'cuda'], ['cpu', 'cpu'], ['gpu', 'auto'], [null, 'auto']]) {
  check(rules.normalizeGptSovitsDevice(input), expected, `device ${input}`);
}
for (const [input, expected] of [
  ['xiaoling', 'xiaoling'], [' a_b-1 ', 'a_b-1'], ['../x', null], ['a/b', null], ['', null], [5, null], ['x'.repeat(65), null],
]) check(rules.normalizeGptSovitsModelId(input), expected, `model id ${input}`);

const winPaths = rules.resolveGptSovitsPaths({ runtimeRoot: 'R', platform: 'win32' });
check(winPaths.venvPython, path.join('R', 'gpt-sovits', 'venv', 'Scripts', 'python.exe'), 'win venv');
check(rules.resolveGptSovitsPaths({ runtimeRoot: 'R', platform: 'linux' }).venvPython, path.join('R', 'gpt-sovits', 'venv', 'bin', 'python'), 'posix venv');

// Manifest: version pinned, files must stay inside the model dir, neutral emotion required.
const modelDir = path.resolve('fixture-model');
const good = { version: 'v2ProPlus', gpt: 'g.ckpt', sovits: 's.pth', emotions: { neutral: { wav: 'refs/n.wav', text: '你好' } } };
const parsed = rules.parseGptSovitsManifest(good, modelDir);
check([parsed.ok, parsed.gptPath, parsed.emotions.neutral.wavPath], [true, path.join(modelDir, 'g.ckpt'), path.join(modelDir, 'refs', 'n.wav')], 'good manifest');
for (const [patch, error] of [
  [{ version: 'v2' }, 'version'], [{ gpt: '../g.ckpt' }, 'gpt'], [{ sovits: path.resolve('/abs.pth') }, 'sovits'],
  [{ emotions: {} }, 'emotion:neutral'], [{ emotions: { neutral: { wav: '../n.wav', text: 'x' } } }, 'emotion:neutral'],
  [{ emotions: { neutral: good.emotions.neutral, Bad: { wav: 'b.wav', text: 'x' } } }, 'emotion:Bad'],
]) check(rules.parseGptSovitsManifest({ ...good, ...patch }, modelDir).errors.includes(error), true, `manifest ${error}`);
check(rules.parseGptSovitsManifest(null, modelDir).ok, false, 'null manifest');
// Lite pack: no weights at all runs on the shared base model; naming only one weight file is an error.
const { gpt: _gpt, sovits: _sovits, ...liteManifest } = good;
const lite = rules.parseGptSovitsManifest({ ...liteManifest, name: '  轻量  ', description: 'd'.repeat(300) }, modelDir);
check([lite.ok, lite.kind, lite.gptPath, lite.sovitsPath, lite.name, lite.description.length], [true, 'lite', null, null, '轻量', 200], 'lite manifest');
check([parsed.kind, rules.parseGptSovitsManifest({ ...liteManifest, gpt: 'g.ckpt' }, modelDir).errors], ['full', ['sovits']], 'half-specified weights');

const args = rules.buildGptSovitsServerArgs('server.py', { baseUrl: new URL('http://localhost:9900/'), sourceDir: 'src', modelsRoot: 'models', device: 'bogus' });
check(args, ['server.py', '--host', '127.0.0.1', '--port', '9900', '--source-dir', 'src', '--models-root', 'models', '--device', 'auto'], 'server args');
check(rules.buildGptSovitsServerArgs('s', { baseUrl: new URL('http://[::1]:9881/'), sourceDir: 'a', modelsRoot: 'b', device: 'cpu' }).slice(1, 3), ['--host', '::1'], 'ipv6 host');

// Model listing against real temp folders.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gpt-sovits-models-'));
try {
  const write = (rel, content = 'x') => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), content); };
  write('ready/manifest.json', JSON.stringify({ ...good, name: '测试', emotions: { ...good.emotions, happy: { wav: 'refs/h.wav', text: '开心' } } }));
  ['ready/g.ckpt', 'ready/s.pth', 'ready/refs/n.wav'].forEach((rel) => write(rel));
  write('broken/manifest.json', JSON.stringify(good));
  write('nomanifest/readme.txt');
  write('bad name/manifest.json', JSON.stringify(good));
  const models = listGptSovitsModels(root);
  check(models.map((m) => m.id), ['broken', 'nomanifest', 'ready'], 'listed ids skip invalid names');
  const ready = models.find((m) => m.id === 'ready');
  check([ready.ready, ready.name, ready.emotions, ready.problems], [false, '测试', ['neutral'], ['emotion-file:happy']], 'missing emotion file');
  write('ready/refs/h.wav');
  check(findGptSovitsModel(root, 'ready').ready, true, 'ready after file added');
  check(findGptSovitsModel(root, 'broken').problems, ['gpt-file', 'sovits-file', 'emotion-file:neutral'], 'broken problems');
  check(findGptSovitsModel(root, 'nomanifest').problems, ['manifest'], 'no manifest');
  check([findGptSovitsModel(root, '../ready'), listGptSovitsModels(path.join(root, 'missing')), listGptSovitsModels(null)], [null, [], []], 'guards');
  check(JSON.stringify(models).includes(root), false, 'no absolute paths in listing');
  // A junction/symlink pointing at a model folder elsewhere is listed like a real folder.
  fs.symlinkSync(path.join(root, 'ready'), path.join(root, 'linked'), 'junction');
  fs.symlinkSync(path.join(root, 'missing-target'), path.join(root, 'dangling'), 'junction');
  check(listGptSovitsModels(root).map((m) => `${m.id}:${m.ready}`), ['broken:false', 'linked:true', 'nomanifest:false', 'ready:true'], 'linked folder followed, dangling skipped');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

console.log(`GPT-SoVITS rules/models passed: ${cases} cases`);
