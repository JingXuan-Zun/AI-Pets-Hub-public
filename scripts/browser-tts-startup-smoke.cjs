const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const ts = require('typescript');
const rules = require('../electron/browserTtsRules.cjs');
const sources = Object.fromEntries(['Startup', 'Readiness', 'Speakers'].map(name => [name, fs.readFileSync(require.resolve('../electron/browserTts' + name + '.cjs'), 'utf8')]));
const old = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const tree = text => ts.createSourceFile('tts.cjs', text, 99, true);
const factory = text => tree(text).statements.find(n => n.name?.text === 'createBrowserTtsService');
const oldMethod = name => factory(old).body.statements.find(n => n.name?.text === name).getText();
const printer = ts.createPrinter();
const canonical = n => printer.printNode(ts.EmitHint.Unspecified, n, n.getSourceFile());
if (old) {
  for (const [file, method, assembly] of [['Startup', 'ensureStarted', 'createBrowserTtsStartup'], ['Speakers', 'getSpeakers', 'createBrowserTtsSpeakers']]) {
    const moved = tree(sources[file]).statements.find(n => n.name?.text === assembly).body.statements.find(n => n.name?.text === method);
    assert.equal(canonical(moved), canonical(factory(old).body.statements.find(n => n.name?.text === method)));
  }
  const readiness = tree(sources.Readiness).statements.find(n => n.name?.text === 'waitUntilReady');
  assert.equal(canonical(readiness), canonical(factory(old).body.statements.find(n => n.name?.text === 'waitUntilReady')));
  const retained = text => factory(text).body.statements.filter(n => !['ensureStarted', 'waitUntilReady', 'getSpeakers', 'startPromise'].includes(n.name?.text || n.declarationList?.declarations[0]?.name?.text) && !/createBrowserTts(Startup|Speakers)\(/.test(n.getText())).map(canonical);
  assert.deepEqual(retained(fs.readFileSync(require.resolve('../electron/browserTtsService.cjs'), 'utf8')), retained(old));
}
function startup(baseline, deps) {
  if (baseline) return new Function('normalizeApiBaseUrl', 'getHealth', 'startProcess', 'let startPromise = null;\n' + oldMethod('ensureStarted') + '\nreturn ensureStarted;')(rules.normalizeApiBaseUrl, deps.getHealth, deps.startProcess);
  const module = { exports: {} }; new Function('require', 'module', sources.Startup)(() => rules, module);
  return module.exports.createBrowserTtsStartup(deps);
}
const settle = promise => promise.then(value => ({ value }), error => ({ error: error.message }));
async function sequential(baseline, initial, failure, url) {
  const trace = []; let fail = true, starting = false;
  const deps = {
    async getHealth(settings) {
      trace.push(['health', settings.browserTtsApiUrl, starting]);
      if (fail && failure === (starting ? 'health-final' : 'health-initial')) { fail = false; throw new Error(failure); }
      return starting ? { available: true, status: 'ready' } : { available: initial === 'ready', status: initial, error: 'fixture-error', missingPackages: ['edge_tts'] };
    },
    startProcess(base) {
      trace.push(['start', base.toString()]);
      if (fail && failure === 'start') { fail = false; return Promise.reject(new Error('start')); }
      starting = true; return Promise.resolve(true);
    },
  };
  const ensure = startup(baseline, deps), settings = { browserTtsApiUrl: url };
  const first = await settle(ensure(settings)); starting = false;
  const second = await settle(ensure(settings));
  return { first, second, trace };
}
async function concurrent(baseline, rejectStart, rejectFinal) {
  const trace = []; let resolveGate, rejectGate, started = false, starts = 0, finalFailure = rejectFinal;
  const gate = new Promise((resolve, reject) => { resolveGate = resolve; rejectGate = reject; });
  const ensure = startup(baseline, {
    async getHealth(settings) {
      trace.push(['health', settings.id, started]);
      if (started && finalFailure) { finalFailure = false; throw new Error('final-health'); }
      return { available: started, status: started ? 'ready' : 'stopped' };
    },
    async startProcess(base) {
      trace.push(['start', base.toString()]); starts++;
      if (starts === 1) { await gate; }
      started = true; return true;
    },
  });
  const a = settle(ensure({ id: 'owner', browserTtsApiUrl: 'http://fixture:9880' }));
  const b = settle(ensure({ id: 'waiter', browserTtsApiUrl: 'http://fixture:9881' }));
  for (let i = 0; i < 4; i++) await Promise.resolve();
  assert.equal(starts, 1, 'One startup operation shared across same-instance callers');
  let peerReady = false;
  const peer = startup(baseline, {
    async getHealth() { trace.push(['peer-health', peerReady]); return { available: peerReady, status: peerReady ? 'ready' : 'stopped' }; },
    async startProcess() { trace.push(['peer-start']); peerReady = true; return true; },
  });
  const peerResult = await peer({ browserTtsApiUrl: 'http://peer:9882' });
  assert.equal(peerResult.started, true, 'Peer startup progresses while first instance waits');
  if (rejectStart) rejectGate(new Error('startup-failure')); else resolveGate(true);
  const results = await Promise.all([a, b]);
  const retried = await settle(ensure({ id: 'retry', browserTtsApiUrl: 'http://fixture:9880' }));
  if (rejectStart) {
    assert.equal(starts, 2);
    if (rejectFinal) assert.equal(retried.error, 'final-health');
    else assert.equal(retried.value.started, true);
  }
  else { assert.equal(starts, 1); assert.equal(results[1].value.started, false); }
  return { results, peerResult, retried, trace };
}
async function readiness(baseline, readyAfter, duration, throws) {
  const trace = []; let now = 0, requests = 0;
  const requestJson = async (endpoint, options) => {
    trace.push(['request', endpoint.toString(), options, now]); now += duration; requests++;
    if (requests <= readyAfter) { if (throws) throw new Error('network'); return { ok: false, body: null }; }
    return { ok: true, body: { status: 'ok' } };
  };
  const setTimeout = (fn, ms) => { trace.push(['wait', ms]); now += ms; queueMicrotask(fn); };
  const module = { exports: {} };
  const body = baseline ? 'const START_TIMEOUT_MS = 15000;\n' + tree(old).statements.find(n => n.name?.text === 'wait').getText() + '\n' + oldMethod('waitUntilReady') + '\nmodule.exports = { waitUntilReady };' : sources.Readiness;
  const imports = "const { buildEndpoint } = require('./browserTtsRules.cjs');\nconst { requestJson } = require('./browserTtsHttp.cjs');\n";
  new Function('require', 'module', 'Date', 'setTimeout', (baseline ? imports : '') + body)(id => id.endsWith('Rules.cjs') ? rules : { requestJson }, module, { now: () => now }, setTimeout);
  const result = await settle(module.exports.waitUntilReady(new URL('http://fixture:9880/path?x=1')));
  return { result, trace };
}
async function speakers(baseline, ok, body, failure) {
  const trace = [];
  const ensureStarted = async settings => { trace.push(['start', settings]); if (failure === 'start') throw new Error('start-failure'); };
  const requestJson = async (url, options) => { trace.push(['request', url.toString(), options]); if (failure === 'request') throw new Error('request-failure'); return { ok, statusCode: 503, body }; };
  let query;
  if (baseline) query = new Function('ensureStarted', 'normalizeApiBaseUrl', 'buildEndpoint', 'requestJson', oldMethod('getSpeakers') + '\nreturn getSpeakers;')(ensureStarted, rules.normalizeApiBaseUrl, rules.buildEndpoint, requestJson);
  else { const module = { exports: {} }; new Function('require', 'module', sources.Speakers)(id => id.endsWith('Rules.cjs') ? rules : { requestJson }, module); query = module.exports.createBrowserTtsSpeakers({ ensureStarted }); }
  const result = await settle(query({ browserTtsApiUrl: 'http://fixture:9880/tts/generate?x=1' }));
  if (result.value) assert.equal(result.value, body, 'Speaker body identity preserved');
  return { result, trace };
}
async function main() {
  const hash = crypto.createHash('sha256'); let cases = 0;
  async function check(fn, args) { const actual = await fn(false, ...args); if (old) assert.deepEqual(actual, await fn(true, ...args)); hash.update(JSON.stringify(actual)); cases++; }
  for (const initial of ['ready', 'missing-runtime', 'missing-dependencies', 'stopped', 'error']) for (const failure of ['none', 'health-initial', 'health-final', 'start']) for (const url of [undefined, 'http://fixture:9881']) await check(sequential, [initial, failure, url]);
  for (const reject of [false, true]) for (const final of [false, true]) await check(concurrent, [reject, final]);
  for (const readyAfter of [0, 1, 2, 10, Infinity]) for (const duration of [0, 2000, 15000]) for (const throws of [false, true]) await check(readiness, [readyAfter, duration, throws]);
  for (const ok of [false, true]) for (const body of [null, ['voice'], { detail: 'detail', error: 'error' }, { error: 'error' }]) for (const failure of ['none', 'start', 'request']) await check(speakers, [ok, body, failure]);
  const digest = hash.digest('hex'); if (!old) assert.equal(digest, 'f68c78a5f9bab8ec2436c2097d1d477bd44bb48be74add480444fc21a9ac1284');
  console.log(`Browser TTS startup/readiness/speakers passed: ${cases} cases; ${digest}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
