const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const ts = require('typescript');
const api = require('../electron/browserTtsRules.cjs');
const source = fs.readFileSync(require.resolve('../electron/browserTtsRules.cjs'), 'utf8');
const old = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const names = new Set(['DEFAULT_BROWSER_TTS_API_URL', ...Object.keys(api)]);
const statements = text => ts.createSourceFile('tts.cjs', text, 99, true).statements;
const moved = n => names.has(n.name?.text || n.declarationList?.declarations[0]?.name?.text);
let previous;
if (old) {
  assert.deepEqual(statements(source).filter(moved).map(n => n.getText()), statements(old).filter(moved).map(n => n.getText()));
  const current = fs.readFileSync(require.resolve('../electron/browserTtsService.cjs'), 'utf8');
  assert.deepEqual(statements(current).filter(n => !n.getText().includes("require('./browserTtsRules.cjs')")).map(n => n.getText()), statements(old).filter(n => !moved(n)).map(n => n.getText()));
  previous = new Function(statements(old).filter(moved).map(n => n.getText()).join('\n') + '\nreturn { normalizeApiBaseUrl, buildEndpoint, parsePort, buildSpawnSpec };')();
}
assert.deepEqual(Object.keys(require('../electron/browserTtsService.cjs')), ['createBrowserTtsService']);
const hash = crypto.createHash('sha256'); let cases = 0;
function run(target, name, args) {
  try { const value = target[name](...args); return { value: value instanceof URL ? value.toString() : value }; }
  catch (e) { return { error: e.name, message: e.message }; }
}
function check(name, args) {
  const actual = run(api, name, args);
  if (old) assert.deepEqual(actual, run(previous, name, args));
  hash.update(JSON.stringify(actual)); cases++;
}
for (const value of [undefined, null, false, 0, {}, '', ' ', 'not-a-url', ' http://localhost:9881/tts/generate///?x=1#hash ', 'https://user:pass@localhost/tts/generate', 'http://localhost/custom/', 'http://[::1]:9880/tts/generate', 'http://localhost:0', 'ftp://localhost/path', 'https://localhost', 'http://localhost:65536']) check('normalizeApiBaseUrl', [value]);
for (const base of ['http://localhost:9880/tts/generate?old=1#hash', 'https://user:pass@localhost/prefix', 'http://[::1]:9880']) {
  for (const endpoint of ['health', '/health', '/speakers', '/tts/generate', '', '/中文?x#y', null, undefined]) check('buildEndpoint', [new URL(base), endpoint]);
}
for (const base of ['http://localhost', 'https://localhost', 'http://localhost:0', 'http://localhost:9880', 'ftp://localhost', 'ftp://localhost:21']) check('parsePort', [new URL(base)]);
for (const candidate of [undefined, null, {}, { executable: 'python' }, { executable: 'py', args: ['-3'] }, { executable: 'python', args: 'xy' }, { executable: 'python', args: 5 }])
for (const args of [undefined, [], ['server.py'], ['-m', 'pip', 'install', 'edge_tts'], 'ab'])
for (const options of [undefined, {}, { cwd: 'fixture', env: { ONLY: 'fixture' } }, null]) check('buildSpawnSpec', [candidate, args, options]);
assert.equal(api.normalizeApiBaseUrl('bad').toString(), 'http://127.0.0.1:9880/');
const base = new URL('https://user:pass@localhost:9443/tts/generate?old=1#hash');
const endpoint = api.buildEndpoint(base, '/health');
assert.equal(base.toString(), 'https://user:pass@localhost:9443/tts/generate?old=1#hash');
assert.equal(endpoint.toString(), 'https://user:pass@localhost:9443/health');
assert.equal(api.parsePort(new URL('https://localhost')), 443);
assert.equal(api.parsePort(new URL('http://localhost:0')), 0);
const prefix = ['-3'], args = ['server.py'], env = { ONLY: 'fixture' };
const spec = api.buildSpawnSpec({ executable: 'py', args: prefix }, args, { cwd: 'fixture', env });
assert.deepEqual(spec.args, ['-3', 'server.py']);
assert.deepEqual(prefix, ['-3']); assert.deepEqual(args, ['server.py']);
assert.equal(spec.options.env, env); assert.equal(spec.options.windowsHide, true);
assert.deepEqual(spec.options.stdio, ['ignore', 'pipe', 'pipe']);
const digest = hash.digest('hex');
if (!old) assert.equal(digest, '72d8673b84db354706284f946dc038dc112d37047b92a982514dd3b6b5c19ad2');
console.log(`Browser TTS rules passed: ${cases} cases; ${digest}`);
