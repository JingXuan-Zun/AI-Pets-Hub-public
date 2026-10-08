const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const crypto = require('node:crypto');
const file = require.resolve('../electron/browserSearchTarget.cjs');
const timingFile = require.resolve('../electron/browserSearchTiming.cjs');
const rootFile = require.resolve('../electron/browserSearchService.cjs');
for (const moduleFile of [file, timingFile]) {
  const text = fs.readFileSync(moduleFile, 'utf8'), t = ts.createSourceFile(moduleFile, text, ts.ScriptTarget.Latest, true);
  assert.ok(text.split('\n').length <= 300);
  function visit(n) { if (ts.isFunctionLike(n) && n.body) assert.ok(t.getLineAndCharacterOfPosition(n.end).line - t.getLineAndCharacterOfPosition(n.getStart(t)).line + 1 <= 50); ts.forEachChild(n, visit); }
  visit(t);
}
let oldSource;
if (process.argv[2]) {
  const old = fs.readFileSync(process.argv[2], 'utf8'), t = ts.createSourceFile(rootFile, old, ts.ScriptTarget.Latest, true);
  const selected = n => ts.isFunctionDeclaration(n) && ['delay', 'openSearchTarget'].includes(n.name.text)
    || ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(t) === 'PAGE_LOAD_WAIT_MS');
  oldSource = "const { requestJson, DEVTOOLS_CONNECT_TIMEOUT_MS } = require('./browserSearchHttp.cjs'); const { createDevToolsClient } = require('./browserSearchDevToolsClient.cjs');\n"
    + t.statements.filter(selected).map(n => n.getText(t)).join('\n') + '\nmodule.exports = { openSearchTarget };';
  const printer = ts.createPrinter(), retained = t.statements.filter(n => !selected(n)).map(n => printer.printNode(ts.EmitHint.Unspecified, n, t)).join('\n');
  const current = ts.createSourceFile(rootFile, fs.readFileSync(rootFile, 'utf8'), ts.ScriptTarget.Latest, true);
  assert.equal(current.statements.filter(n => !/require\('\.\/browserSearch(?:Target|Timing)\.cjs'\)/.test(n.getText(current))).map(n => printer.printNode(ts.EmitHint.Unspecified, n, current)).join('\n'), retained, 'Other production statements unchanged');
}
async function run(urlMode, newMode, listMode, stage, original) {
  const trace = [], initialError = Error('initial new-target failure'), stageError = Error('controlled stage failure');
  const url = urlMode === 'plain' ? 'https://example.org/' : urlMode === 'query' ? 'https://example.org/?q=a&b=x#hash' : urlMode === 'unicode' ? 'https://example.org/中文?q=a b' : '\ud800';
  const created = { id: 'created' }, fallback = { id: 'fallback', type: 'page', webSocketDebuggerUrl: 'ws://controlled/first' };
  const list = listMode === 'normal' ? [null, { type: 'worker', webSocketDebuggerUrl: 'ws://ignored' }, { type: 'page' }, fallback, { type: 'page', webSocketDebuggerUrl: 'ws://controlled/second' }]
    : listMode === 'empty' ? [] : listMode === 'null' ? null : listMode === 'object' ? { target: fallback } : listMode === 'no-page' ? [{ type: 'worker', webSocketDebuggerUrl: 'ws://ignored' }]
    : listMode === 'empty-socket' ? [{ type: 'page', webSocketDebuggerUrl: '' }] : [fallback];
  const http = { DEVTOOLS_CONNECT_TIMEOUT_MS: 8000, async requestJson(...args) {
    trace.push(['http', ...args]);
    if (args[0].includes('/json/new?')) {
      if (newMode === 'error') throw initialError;
      if (newMode === 'string') throw 'new target string failure';
      return newMode === 'null' ? null : newMode === 'false' ? false : created;
    }
    assert.equal(args[0], 'http://127.0.0.1:9223/json/list');
    if (stage === 'list') throw stageError;
    return list;
  } };
  const client = {
    async send(method, params) { assert.equal(this, client); trace.push(['send', method, params]); if (stage === 'enable' && method === 'Page.enable' || stage === 'navigate' && method === 'Page.navigate') throw stageError; },
    close() { assert.equal(this, client); trace.push(['close']); if (stage === 'close') throw stageError; },
  };
  const devtools = { async createDevToolsClient(target) { trace.push(['connect', target]); assert.equal(target, fallback.webSocketDebuggerUrl); if (stage === 'connect') throw stageError; return client; } };
  const timer = (callback, ms) => { trace.push(['timer', ms]); assert.equal(ms, 4500); if (stage === 'delay') throw stageError; queueMicrotask(() => { trace.push(['settled']); callback(); }); };
  const cache = new Map();
  function load(moduleFile) {
    if (cache.has(moduleFile)) return cache.get(moduleFile).exports;
    const module = { exports: {} }; cache.set(moduleFile, module);
    new Function('require', 'module', 'setTimeout', original && moduleFile === file ? oldSource : fs.readFileSync(moduleFile, 'utf8'))(id => {
      if (id.endsWith('browserSearchHttp.cjs')) return http;
      if (id.endsWith('browserSearchDevToolsClient.cjs')) return devtools;
      if (id.endsWith('browserSearchTiming.cjs')) return load(path.resolve(path.dirname(moduleFile), id));
      throw Error('Unexpected dependency ' + id);
    }, module, timer);
    return module.exports;
  }
  let result, error;
  try { result = await load(file).openSearchTarget(9223, url); } catch (e) {
    assert.ok(e === initialError || e === stageError || e === 'new target string failure' || e instanceof URIError);
    error = typeof e === 'string' ? ['string', e] : [e.name, e.message];
  }
  const newFailed = urlMode === 'invalid-unicode' || ['error', 'string'].includes(newMode);
  if (!newFailed) {
    assert.equal(result, newMode === 'null' ? null : newMode === 'false' ? false : created);
    assert.equal(trace.length, 1, 'New target response is returned without navigation');
    assert.deepEqual(trace[0], ['http', 'http://127.0.0.1:9223/json/new?' + encodeURIComponent(url), 8000, 'PUT']);
  } else if (['normal', 'single'].includes(listMode) && stage === 'normal') {
    assert.equal(result, fallback, 'First eligible page retains its identity');
    assert.deepEqual(trace.filter(row => row[0] === 'send'), [['send', 'Page.enable', undefined], ['send', 'Page.navigate', { url }]]);
    assert.deepEqual(trace.slice(-3), [['timer', 4500], ['settled'], ['close']]);
  } else assert.ok(error);
  const connected = trace.some(row => row[0] === 'connect') && stage !== 'connect';
  assert.equal(trace.filter(row => row[0] === 'close').length, connected ? 1 : 0);
  return { result, error, trace };
}
async function main() {
  const fingerprint = crypto.createHash('sha256'); let cases = 0;
  for (const url of ['plain', 'query', 'unicode', 'invalid-unicode']) for (const created of ['success', 'null', 'false', 'error', 'string'])
    for (const list of ['normal', 'empty', 'null', 'object', 'no-page', 'empty-socket', 'single']) for (const stage of ['normal', 'list', 'connect', 'enable', 'navigate', 'delay', 'close']) {
      const actual = await run(url, created, list, stage, false);
      if (oldSource) assert.deepEqual(actual, await run(url, created, list, stage, true));
      fingerprint.update(JSON.stringify(actual) + '\n'); cases++;
    }
  const hash = fingerprint.digest('hex');
  assert.equal(hash, '7c78e2285692e72875fff645ab9752b94b0d09b729b3bdce64f28c8a213b35d6', 'Reviewed target opening and navigation fallback remain unchanged');
  console.log('Browser target opening passed: ' + cases + ' new/fallback/identity/encoding/navigation/timing/finally/error cases; hash ' + hash);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
