const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const ts = require('typescript');
const rules = require('../electron/browserTtsRules.cjs');
const source = fs.readFileSync(require.resolve('../electron/browserTtsHealth.cjs'), 'utf8');
const old = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const tree = text => ts.createSourceFile('tts.cjs', text, 99, true);
const factory = text => tree(text).statements.find(n => n.name?.text === 'createBrowserTtsService');
const original = old && factory(old).body.statements.find(n => n.name?.text === 'getHealth');
const printer = ts.createPrinter();
const canonical = n => printer.printNode(ts.EmitHint.Unspecified, n, n.getSourceFile());
if (old) {
  const retained = text => factory(text).body.statements.filter(n => n.name?.text !== 'getHealth' && !/createBrowserTts(Health|Installer)\(/.test(n.getText())).map(canonical);
  assert.deepEqual(retained(fs.readFileSync(require.resolve('../electron/browserTtsService.cjs'), 'utf8')), retained(old));
  const body = original.body.statements, branches = body.filter(ts.isIfStatement), attempt = body.at(-1);
  const helper = name => tree(source).statements.find(n => n.name?.text === name).body.statements[0];
  for (const [name, statement] of [['missingRuntimeHealth', branches[0].thenStatement.statements[0]], ['missingDependencyHealth', branches[1].thenStatement.statements[0]], ['responseHealth', attempt.tryBlock.statements[1]], ['stoppedHealth', attempt.catchClause.block.statements[0]]]) assert.equal(canonical(helper(name)), canonical(statement));
}
async function run(baseline, url, present, probe, response, failure) {
  const trace = [], settings = { browserTtsApiUrl: url }, candidate = present ? { executable: 'fixture-python' } : null;
  const required = ['edge_tts'];
  function call(name, args) { trace.push([name, ...args]); if (failure === name) throw new Error(name + ' failure'); }
  const deps = {
    ...rules, BROWSER_TTS_REQUIRED_PACKAGES: required, HEALTH_TIMEOUT_MS: 3000,
    getCandidate(value) { assert.equal(value, settings); call('candidate', []); return candidate; },
    async probePackages(value) { assert.equal(value, candidate); call('probe', []); return probe; },
    async requestJson(endpoint, options) {
      call('request', [endpoint.toString(), options]);
      if (failure === 'request-string') throw 'fixture request error';
      if (failure === 'format') throw new Error('fixture request error');
      return response;
    },
    buildJsonError(error) { call('format', [error instanceof Error ? error.message : error]); return { message: String(error instanceof Error ? error.message : error) }; },
  };
  let getHealth;
  if (baseline) getHealth = new Function(...Object.keys(deps), original.getText() + '\nreturn getHealth;')(...Object.values(deps));
  else {
    const module = { exports: {} };
    new Function('require', 'module', source)(id => id.endsWith('Python.cjs') ? { BROWSER_TTS_REQUIRED_PACKAGES: required } : id.endsWith('Rules.cjs') ? rules : id.endsWith('Http.cjs') ? { HEALTH_TIMEOUT_MS: 3000, requestJson: deps.requestJson } : { buildJsonError: deps.buildJsonError }, module);
    getHealth = module.exports.createBrowserTtsHealth(deps);
  }
  assert.deepEqual(trace, [], 'Assembly does not probe or request');
  let result, error;
  try { result = await getHealth(settings); } catch (e) { error = e.message; }
  if (result?.status === 'missing-runtime') assert.equal(result.missingPackages, required);
  if (result?.status === 'missing-dependencies') assert.equal(result.missingPackages, probe.missingPackages.length ? probe.missingPackages : required);
  return { result, error, trace };
}
async function main() {
  const hash = crypto.createHash('sha256'); let cases = 0;
  const probes = [undefined, { ok: false, missingPackages: [], error: 'probe-error' }, { ok: false, missingPackages: ['other'], error: null }, { ok: true, missingPackages: [], error: null }, { ok: true, missingPackages: ['edge_tts'], error: null }];
  for (const url of [undefined, 'invalid', 'http://[::1]:9881/tts/generate?fixture=1#hash'])
  for (const present of [false, true]) for (const probe of probes) for (const ok of [false, true])
  for (const body of [null, { status: 'ok', voices_count: '5' }, { status: 'bad', voices_count: 'invalid' }, { error: 'server-error', detail: 'server-detail' }, { detail: 'server-detail', voices_count: -1 }])
  for (const failure of ['none', 'candidate', 'probe', 'request', 'request-string', 'format']) {
    const response = { ok, statusCode: ok ? 200 : 503, body };
    const actual = await run(false, url, present, probe, response, failure);
    if (old) assert.deepEqual(actual, await run(true, url, present, probe, response, failure));
    hash.update(JSON.stringify(actual)); cases++;
  }
  const probe = { ok: true, missingPackages: [], error: null };
  const ready = await run(false, undefined, true, probe, { ok: true, body: { status: 'ok', voices_count: '5' } }, 'none');
  assert.equal(ready.result.status, 'ready'); assert.equal(ready.result.voicesCount, 5);
  assert.deepEqual(ready.trace.map(row => row[0]), ['candidate', 'probe', 'request']);
  assert.equal(ready.trace[2][2].timeoutMs, 3000);
  assert.equal((await run(false, undefined, true, probe, {}, 'request')).result.status, 'stopped');
  assert.equal((await run(false, undefined, true, probe, {}, 'probe')).error, 'probe failure');
  const unavailable = await run(false, undefined, true, probe, { ok: true, body: null }, 'none');
  assert.equal(unavailable.result.running, true); assert.equal(unavailable.result.available, false); assert.equal(unavailable.result.error, null);
  const { createBrowserTtsService } = require('../electron/browserTtsService.cjs');
  const service = createBrowserTtsService({ app: { isPackaged: false, getPath: () => 'fixture-user' }, projectRoot: 'fixture-project' });
  assert.deepEqual(Object.keys(service), ['dispose', 'ensureStarted', 'getHealth', 'getSpeakers', 'installDependencies']);
  const digest = hash.digest('hex');
  if (!old) assert.equal(digest, 'b316ac52ba9a533fbd4835276a7e4203f77f24517a46fc82b595205ea3fd5de6');
  console.log(`Browser TTS health passed: ${cases} cases; ${digest}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
