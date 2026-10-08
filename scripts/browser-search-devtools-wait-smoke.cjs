const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const crypto = require('node:crypto');
const file = require.resolve('../electron/browserSearchDevToolsWait.cjs');
const rootFile = require.resolve('../electron/browserSearchService.cjs');
const source = fs.readFileSync(file, 'utf8'), tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
assert.ok(source.split('\n').length <= 300);
const fn = tree.statements.find(n => ts.isFunctionDeclaration(n));
assert.ok(tree.getLineAndCharacterOfPosition(fn.end).line - tree.getLineAndCharacterOfPosition(fn.getStart(tree)).line + 1 <= 50);
let oldSource;
if (process.argv[2]) {
  const old = fs.readFileSync(process.argv[2], 'utf8'), t = ts.createSourceFile(rootFile, old, ts.ScriptTarget.Latest, true);
  const fn = t.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'waitForDevTools');
  assert.ok(fn);
  oldSource = source.slice(0, source.indexOf('async function waitForDevTools')) + fn.getText(t) + '\nmodule.exports = { waitForDevTools };';
  function retained(text) {
    const t = ts.createSourceFile(rootFile, text, ts.ScriptTarget.Latest, true);
    return t.statements.filter(n => !(ts.isFunctionDeclaration(n) && n.name?.text === 'waitForDevTools') && !/require\('\.\/browserSearch(?:Http|Timing|DevToolsWait)\.cjs'\)/.test(n.getText(t))).map(n => ts.createPrinter().printNode(ts.EmitHint.Unspecified, n, t)).join('\n');
  }
  assert.equal(retained(fs.readFileSync(rootFile, 'utf8')), retained(old), 'Root session and search statements unchanged');
}
async function run(successAfter, step, errorMode, delayFails, port, original) {
  const trace = [], errors = [], sleepError = Error('sleep failed'), response = { browser: 'controlled' };
  let reads = 0, attempts = 0;
  const clock = { now() { trace.push(['clock', reads]); return 1000 + reads++ * step; } };
  const deps = {
    './browserSearchHttp.cjs': { DEVTOOLS_CONNECT_TIMEOUT_MS: 8000, async requestJson(...args) {
      trace.push(['request', ...args]); attempts++;
      assert.deepEqual(args, ['http://127.0.0.1:' + port + '/json/version', 1500]);
      if (attempts > successAfter) return response;
      const error = errorMode === 'error' ? Error('attempt ' + attempts) : errorMode === 'string' ? 'attempt ' + attempts : null;
      errors.push(error); throw error;
    } },
    './browserSearchTiming.cjs': { async delay(ms) { trace.push(['delay', ms]); assert.equal(ms, 300); if (delayFails) throw sleepError; } },
  };
  const module = { exports: {} };
  new Function('require', 'module', 'Date', original ? oldSource : source)(id => deps[id], module, clock);
  let result, error;
  try { result = await module.exports.waitForDevTools(port); assert.equal(result, response); } catch (e) {
    if (delayFails && attempts) assert.equal(e, sleepError);
    else if (errors.length && errorMode !== 'null') assert.equal(e, errors.at(-1));
    else assert.equal(e.message, 'DevTools endpoint is not ready');
    error = typeof e === 'string' ? e : e.message;
  }
  if (step >= 8000) assert.equal(attempts, 0);
  assert.equal(trace.filter(row => row[0] === 'delay').length, errors.length);
  return { result, error, trace };
}
async function main() {
  const fingerprint = crypto.createHash('sha256'); let cases = 0;
  for (const after of [0, 1, 3, Infinity]) for (const step of [100, 300, 4000, 8000]) for (const error of ['error', 'string', 'null'])
    for (const delay of [false, true]) for (const port of [9223, 0, 'custom']) {
      const actual = await run(after, step, error, delay, port, false);
      if (oldSource) assert.deepEqual(actual, await run(after, step, error, delay, port, true));
      fingerprint.update(JSON.stringify(actual) + '\n'); cases++;
    }
  const hash = fingerprint.digest('hex');
  assert.equal(hash, '63eb2af820e1f5a7e86859b9b22a81eeadf2a7156f8f30bee5764ac72c91151f', 'Reviewed DevTools wait and last-error behavior remain unchanged');
  console.log('DevTools wait passed: ' + cases + ' retry/deadline/last-error/clock/delay/identity cases; hash ' + hash);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
