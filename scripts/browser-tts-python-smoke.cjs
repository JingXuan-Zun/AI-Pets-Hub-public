const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const ts = require('typescript');
const source = fs.readFileSync(require.resolve('../electron/browserTtsPython.cjs'), 'utf8');
const old = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const tree = text => ts.createSourceFile('tts.cjs', text, 99, true);
const names = ['getCandidate', 'probePackages'];
const factory = text => tree(text).statements.find(n => n.name?.text === 'createBrowserTtsService');
const printer = ts.createPrinter();
const canonical = n => printer.printNode(ts.EmitHint.Unspecified, n, n.getSourceFile());
if (old) {
  const moved = tree(source).statements.find(n => n.name?.text === 'createBrowserTtsPython').body.statements;
  for (const name of names) assert.equal(canonical(moved.find(n => n.name?.text === name)), canonical(factory(old).body.statements.find(n => n.name?.text === name)));
  const retained = text => factory(text).body.statements.filter(n => !names.includes(n.name?.text) && !n.getText().includes('createBrowserTtsPython(')).map(canonical);
  assert.deepEqual(retained(fs.readFileSync(require.resolve('../electron/browserTtsService.cjs'), 'utf8')), retained(old));
}
function build(baseline, fixtures) {
  const trace = [], candidates = fixtures.candidates || [], required = ['edge_tts'], env = { FIXTURE: 'yes' };
  function call(name, args) { trace.push([name, ...args]); if (fixtures.failure === name) throw new Error(name + ' failure'); }
  const deps = {
    projectRoot: 'project', runtimeRoot: 'runtime', BROWSER_TTS_REQUIRED_PACKAGES: required,
    getPythonCandidates(preferred, options) { call('candidates', [preferred, options]); return candidates; },
    getSharedEnv() { call('env', []); return env; },
    async spawnCommand(candidate, args, options) {
      call('spawn', [candidate, args, options]);
      assert.equal(options.env, env);
      return fixtures.result;
    },
    formatSpawnFailure(result) { call('format', [result]); return 'formatted-failure'; },
  };
  let api;
  if (baseline) {
    const body = factory(old).body.statements.filter(n => names.includes(n.name?.text)).map(n => n.getText()).join('\n');
    api = new Function(...Object.keys(deps), body + '\nreturn { getCandidate, probePackages };')(...Object.values(deps));
  } else {
    const module = { exports: {} };
    new Function('require', 'module', source)(id => id.endsWith('PathUtils.cjs') ? { getPythonCandidates: deps.getPythonCandidates } : id.endsWith('CommandUtils.cjs') ? { formatSpawnFailure: deps.formatSpawnFailure } : { spawnCommand: deps.spawnCommand }, module);
    api = module.exports.createBrowserTtsPython(deps);
  }
  assert.deepEqual(trace, [], 'Assembly does not probe or choose a runtime');
  return { api, trace, candidates };
}
function candidateCase(baseline, settings, candidates, failure) {
  const { api, trace } = build(baseline, { candidates, failure }); let result, error;
  try { result = api.getCandidate(settings); } catch (e) { error = e.message; }
  if (!error) assert.equal(result, candidates[0] || null, 'First candidate only, identity preserved');
  return { result, error, trace };
}
async function probeCase(baseline, result, failure) {
  const { api, trace } = build(baseline, { result, failure }); let value, error;
  try { value = await api.probePackages({ executable: 'fixture-python', args: ['-3'] }); } catch (e) { error = e.message; }
  return { value, error, trace };
}
async function main() {
  const hash = crypto.createHash('sha256'); let candidateCases = 0, probeCases = 0;
  for (const settings of [undefined, null, {}, { localVoiceRuntimePath: '' }, { localVoiceRuntimePath: '  python.exe  ' }, { localVoiceRuntimePath: 5 }, { localVoiceRuntimePath: '中文路径' }])
  for (const candidates of [[], [{ executable: 'first' }], [{ executable: 'first' }, { executable: 'second' }], [null, { executable: 'second' }]])
  for (const failure of ['none', 'candidates']) {
    const actual = candidateCase(false, settings, candidates, failure);
    if (old) assert.deepEqual(actual, candidateCase(true, settings, candidates, failure));
    hash.update(JSON.stringify(actual)); candidateCases++;
  }
  for (const ok of [true, false]) for (const stdout of ['', 'edge_tts\n', ' \r\n edge_tts \r\n other\n', 'edge_tts\nedge_tts', undefined, 5])
  for (const failure of ['none', 'env', 'spawn', 'format']) {
    const result = { ok, stdout, stderr: 'fixture diagnostic', exitCode: ok ? 0 : 1 };
    const actual = await probeCase(false, result, failure);
    if (old) assert.deepEqual(actual, await probeCase(true, result, failure));
    hash.update(JSON.stringify(actual)); probeCases++;
  }
  const success = await probeCase(false, { ok: true, stdout: ' edge_tts\r\n\r\n other \n' }, 'none');
  assert.deepEqual(success.value, { ok: true, missingPackages: ['edge_tts', 'other'], error: null });
  assert.deepEqual(success.trace.map(row => row[0]), ['env', 'spawn']);
  assert.equal(success.trace[1][2][0], '-c');
  assert.ok(success.trace[1][2][1].includes('packages = ["edge_tts"]'));
  const failed = await probeCase(false, { ok: false }, 'none');
  assert.deepEqual(failed.value, { ok: false, missingPackages: ['edge_tts'], error: 'formatted-failure' });
  const first = build(false, {}), second = build(false, {});
  assert.notEqual(first.api.getCandidate, second.api.getCandidate);
  assert.notEqual(first.api.probePackages, second.api.probePackages);
  const digest = hash.digest('hex');
  if (!old) assert.equal(digest, '7c44bfc484eb9a478e89c24b4790fae3f1b7c35785de52bc913b4520465a7829');
  console.log(`Browser TTS Python passed: ${candidateCases} candidate and ${probeCases} package-probe cases; ${digest}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
