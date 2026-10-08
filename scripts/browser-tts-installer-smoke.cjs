const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const ts = require('typescript');
const source = fs.readFileSync(require.resolve('../electron/browserTtsInstaller.cjs'), 'utf8');
const old = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const tree = text => ts.createSourceFile('tts.cjs', text, 99, true);
const factory = text => tree(text).statements.find(n => n.name?.text === 'createBrowserTtsService');
const original = old && factory(old).body.statements.find(n => n.name?.text === 'installDependencies');
const printer = ts.createPrinter();
const canonical = n => printer.printNode(ts.EmitHint.Unspecified, n, n.getSourceFile());
if (old) {
  const retained = text => factory(text).body.statements.filter(n => n.name?.text !== 'installDependencies' && !n.getText().includes('createBrowserTtsInstaller(')).map(canonical);
  assert.deepEqual(retained(fs.readFileSync(require.resolve('../electron/browserTtsService.cjs'), 'utf8')), retained(old));
  const statements = original.body.statements;
  const resultIndex = statements.findIndex(n => n.declarationList?.declarations[0]?.name?.text === 'result');
  const healthIndex = statements.findIndex(n => n.declarationList?.declarations[0]?.name?.text === 'health');
  const helper = name => tree(source).statements.find(n => n.name?.text === name).body.statements;
  assert.deepEqual(helper('createInstallReporter').slice(0, -1).map(canonical), statements.slice(3, 5).map(canonical));
  assert.deepEqual(helper('installFailed').map(canonical), statements[resultIndex + 1].thenStatement.statements.map(canonical));
  assert.deepEqual(helper('installFinished').map(canonical), statements.slice(healthIndex + 1).map(canonical));
}
async function run(baseline, present, commandOk, status, progress, failure) {
  const trace = [], candidate = present ? { executable: 'fixture-python' } : null;
  const settings = { marker: 'settings' }, env = { FIXTURE: 'yes' };
  const health = { status, missingPackages: status === 'missing-dependencies' ? ['edge_tts'] : [], error: status === 'missing-runtime' ? 'fixture-health-error' : null };
  const progressValues = [];
  function call(name, args) { trace.push([name, ...args]); if (failure === name) throw new Error(name + ' failure'); }
  const options = progress === 'null' ? null : progress === 'none' ? {} : { onProgress(value) {
    trace.push(['progress', structuredClone(value)]); progressValues.push(value);
    if (progress === 'mutate') value.messages.push('callback-added');
    if (progress === 'throw-' + value.stage) throw new Error('progress-' + value.stage + ' failure');
  } };
  const deps = {
    runtimeRoot: 'runtime', BROWSER_TTS_REQUIRED_PACKAGES: ['edge_tts'],
    getCandidate(value) { assert.equal(value, settings); call('candidate', []); return candidate; },
    getSharedEnv() { call('env', []); return env; },
    async spawnCommand(value, args, spec) { assert.equal(value, candidate); assert.equal(spec.env, env); call('spawn', [value, args, spec]); return { ok: commandOk, stderr: 'fixture' }; },
    async getHealth(value) { assert.equal(value, settings); call('health', []); return health; },
    writeLog(value) { call('log', [value]); },
    formatSpawnFailure(value) { call('format', [value]); return 'fixture-command-error'; },
  };
  let install;
  if (baseline) install = new Function(...Object.keys(deps), original.getText() + '\nreturn installDependencies;')(...Object.values(deps));
  else {
    const module = { exports: {} };
    new Function('require', 'module', source)(id => id.endsWith('Python.cjs') ? { BROWSER_TTS_REQUIRED_PACKAGES: deps.BROWSER_TTS_REQUIRED_PACKAGES } : id.endsWith('Commands.cjs') ? { spawnCommand: deps.spawnCommand } : { formatSpawnFailure: deps.formatSpawnFailure }, module);
    install = module.exports.createBrowserTtsInstaller(deps);
  }
  assert.deepEqual(trace, [], 'Assembly does not install');
  let result, error;
  try { result = await install(settings, options); } catch (e) { error = e.message; }
  if (result && present && !error && progressValues.length) {
    const last = progressValues.at(-1);
    if (!commandOk) assert.equal(last.messages, result.messages, 'Command failure shares its messages');
    else assert.notEqual(last.messages, result.messages, 'Final health progress and result have separate snapshots');
  }
  return { result, error, trace };
}
async function main() {
  const hash = crypto.createHash('sha256'); let cases = 0;
  for (const present of [false, true]) for (const commandOk of [false, true])
  for (const status of ['ready', 'missing-runtime', 'missing-dependencies', 'error', undefined])
  for (const progress of ['none', 'observe', 'mutate', 'null', 'throw-starting', 'throw-running', 'throw-failed', 'throw-completed'])
  for (const failure of ['none', 'candidate', 'env', 'spawn', 'health', 'log', 'format']) {
    const actual = await run(false, present, commandOk, status, progress, failure);
    if (old) assert.deepEqual(actual, await run(true, present, commandOk, status, progress, failure));
    hash.update(JSON.stringify(actual)); cases++;
  }
  const success = await run(false, true, true, 'ready', 'observe', 'none');
  assert.deepEqual(success.trace.filter(row => row[0] === 'progress').map(row => row[1].stage), ['starting', 'running', 'running', 'completed']);
  assert.equal(success.result.ok, true);
  assert.deepEqual(success.trace.find(row => row[0] === 'spawn')[2], ['-m', 'pip', 'install', '--upgrade', '--no-cache-dir', 'edge-tts']);
  const failed = await run(false, true, false, 'ready', 'observe', 'none');
  assert.ok(!failed.trace.some(row => row[0] === 'health'));
  assert.equal(failed.result.error, 'fixture-command-error');
  assert.equal((await run(false, true, true, 'error', 'none', 'none')).result.ok, true, 'Original readiness criterion excludes only missing dependencies/runtime');
  assert.equal((await run(false, true, true, 'missing-runtime', 'none', 'none')).result.ok, false);
  const missing = await run(false, false, true, 'ready', 'observe', 'none');
  assert.deepEqual(missing.trace.map(row => row[0]), ['candidate']);
  const digest = hash.digest('hex');
  if (!old) assert.equal(digest, '9e5ff2739183582bbfd1e0e593b05c4745d08a11d6500aa9fed4a63573b0fe39');
  console.log(`Browser TTS installer passed: ${cases} cases; ${digest}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
