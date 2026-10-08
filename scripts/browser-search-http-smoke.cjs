const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const file = require.resolve('../electron/browserSearchHttp.cjs');
const rootFile = require.resolve('../electron/browserSearchService.cjs');
const source = fs.readFileSync(file, 'utf8');
const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
assert.ok(source.split('\n').length <= 300);
function budgets(n) {
  if (ts.isFunctionLike(n) && n.body) assert.ok(tree.getLineAndCharacterOfPosition(n.end).line - tree.getLineAndCharacterOfPosition(n.getStart(tree)).line + 1 <= 50);
  ts.forEachChild(n, budgets);
}
budgets(tree);
let oldSource;
if (process.argv[2]) {
  const old = fs.readFileSync(process.argv[2], 'utf8');
  const t = ts.createSourceFile(rootFile, old, ts.ScriptTarget.Latest, true);
  const selected = n => ts.isFunctionDeclaration(n) && ['requestJson', 'requestText'].includes(n.name.text)
    || ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(t) === 'DEVTOOLS_CONNECT_TIMEOUT_MS');
  oldSource = "const http = require('http');\n" + t.statements.filter(selected).map(n => n.getText(t)).join('\n') + '\nmodule.exports = { requestJson, requestText, DEVTOOLS_CONNECT_TIMEOUT_MS };';
  const printer = ts.createPrinter();
  const oldRetained = t.statements.filter(n => !selected(n) && n.getText(t) !== "const http = require('http');").map(n => printer.printNode(ts.EmitHint.Unspecified, n, t)).join('\n');
  const current = ts.createSourceFile(rootFile, fs.readFileSync(rootFile, 'utf8'), ts.ScriptTarget.Latest, true);
  assert.equal(current.statements.filter(n => !n.getText(current).includes("require('./browserSearchHttp.cjs')")).map(n => printer.printNode(ts.EmitHint.Unspecified, n, current)).join('\n'), oldRetained, 'Remaining discovery/DevTools/control/session statements unchanged');
}
async function run(name, status, body, sequence, options, original) {
  const trace = [], failure = Error('controlled request failure');
  const request = new EventEmitter(), response = new EventEmitter();
  response.statusCode = status;
  response.setEncoding = value => trace.push(['encoding', value]);
  for (const [emitter, label] of [[request, 'request'], [response, 'response']]) {
    const on = emitter.on;
    emitter.on = function (event, handler) { assert.equal(this, emitter); trace.push([label, 'on', event]); return on.call(this, event, handler); };
  }
  request.destroy = function (error) { assert.equal(this, request); trace.push(['destroy', error.message]); request.emit('error', error); };
  const chunks = body === 'object' ? ['{"text":', '"中文",', '"ok":true}'] : body === 'scalar' ? ['null'] : body === 'invalid' ? ['not ', 'json'] : body === 'empty' ? [] : ['[1,', '2,3]'];
  let responseCallback;
  request.end = function () {
    assert.equal(this, request); trace.push(['end-request']);
    if (sequence === 'end-throw') throw failure;
    queueMicrotask(() => {
      if (sequence === 'error') { trace.push(['error']); request.emit('error', failure); return; }
      if (sequence === 'timeout') { trace.push(['timeout']); request.emit('timeout'); return; }
      responseCallback(response);
      for (const chunk of chunks) { trace.push(['data', chunk]); response.emit('data', chunk); }
      trace.push(['end-response']); response.emit('end');
      if (sequence === 'late-error') { trace.push(['late-error']); request.emit('error', failure); }
      if (sequence === 'late-timeout') { trace.push(['late-timeout']); request.emit('timeout'); }
    });
  };
  const http = { request(url, settings, callback) { trace.push(['http', url, settings]); if (sequence === 'request-throw') throw failure; responseCallback = callback; return request; } };
  const module = { exports: {} };
  new Function('require', 'module', original ? oldSource : source)(id => { assert.equal(id, 'http'); return http; }, module);
  assert.equal(module.exports.DEVTOOLS_CONNECT_TIMEOUT_MS, 8000);
  const args = options === 'default' ? ['http://127.0.0.1:9223/json/list'] : options === 'put' ? ['http://127.0.0.1:9223/json/new', 1500, 'PUT'] : options === 'zero' ? ['http://test', 0, ''] : ['http://test', null, null];
  let value, error;
  try { value = await module.exports[name](...args); } catch (e) {
    if (['request-throw', 'end-throw', 'error'].includes(sequence)) assert.equal(e, failure);
    error = [e.name, e.message];
  }
  if (sequence === 'timeout') assert.deepEqual(error, ['Error', 'DevTools request timed out']);
  else if (['normal', 'late-error', 'late-timeout'].includes(sequence)) {
    if (!status || status < 200 || status >= 300) assert.deepEqual(error, ['Error', 'DevTools request failed (' + (status || 'unknown') + ')']);
    else if (name === 'requestText') assert.equal(value, chunks.join(''));
    else if (['invalid', 'empty'].includes(body)) assert.equal(error[0], 'SyntaxError');
    else assert.deepEqual(value, body === 'object' ? { text: '中文', ok: true } : body === 'scalar' ? null : [1, 2, 3]);
  }
  assert.deepEqual(trace[0][2], { method: args.length === 1 ? 'GET' : args[2], timeout: args.length === 1 ? 8000 : args[1] });
  return { value, error, trace };
}
async function main() {
  let cases = 0;
  const fingerprint = crypto.createHash('sha256');
  for (const name of ['requestJson', 'requestText']) for (const status of [undefined, null, 0, 199, 200, 204, 299, 300, 500, '200'])
    for (const body of ['object', 'scalar', 'invalid', 'empty', 'array']) for (const sequence of ['normal', 'request-throw', 'end-throw', 'error', 'timeout', 'late-error', 'late-timeout'])
      for (const options of ['default', 'put', 'zero', 'null']) {
        const actual = await run(name, status, body, sequence, options, false);
        if (oldSource) assert.deepEqual(actual, await run(name, status, body, sequence, options, true));
        fingerprint.update(JSON.stringify(actual) + '\n'); cases++;
      }
  const hash = fingerprint.digest('hex');
  assert.equal(hash, 'f17f43ae1f17dcf63d235b4cfaf3b1972b4d8eb5460e43e8acba04bea3ec33e4', 'Reviewed HTTP reads and event order remain unchanged');
  console.log('Browser HTTP reads passed: ' + cases + ' status/chunk/parse/method/timeout/error/settlement/order cases; hash ' + hash);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
