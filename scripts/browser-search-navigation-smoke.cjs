const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const crypto = require('node:crypto');
const file = require.resolve('../electron/browserSearchNavigation.cjs');
const rootFile = require.resolve('../electron/browserSearchService.cjs');
const source = fs.readFileSync(file, 'utf8'), tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
assert.ok(source.split('\n').length <= 300);
function budgets(n) { if (ts.isFunctionLike(n) && n.body) assert.ok(tree.getLineAndCharacterOfPosition(n.end).line - tree.getLineAndCharacterOfPosition(n.getStart(tree)).line + 1 <= 50); ts.forEachChild(n, budgets); }
budgets(tree);
let oldSource;
if (process.argv[2]) {
  const old = fs.readFileSync(process.argv[2], 'utf8'), t = ts.createSourceFile(rootFile, old, ts.ScriptTarget.Latest, true);
  let fn;
  function find(n) { if (ts.isFunctionDeclaration(n) && n.name?.text === 'navigateOrOpenTarget') fn = n; ts.forEachChild(n, find); }
  find(t); assert.ok(fn);
  oldSource = source.slice(0, source.indexOf('async function navigateOrOpenTarget')) + fn.getText(t) + '\nmodule.exports = { navigateOrOpenTarget };';
  function retained(text) {
    const tree = ts.createSourceFile(rootFile, text.replace('const { delay, PAGE_LOAD_WAIT_MS }', 'const { delay }'), ts.ScriptTarget.Latest, true);
    const statements = tree.statements.filter(n => !/require\('\.\/browserSearch(?:Navigation|Target|DevToolsClient)\.cjs'\)/.test(n.getText(tree))).map(n => {
      if (!ts.isFunctionDeclaration(n) || n.name?.text !== 'createBrowserSearchService') return n;
      const body = ts.factory.updateBlock(n.body, n.body.statements.filter(n => !ts.isFunctionDeclaration(n) || n.name?.text !== 'navigateOrOpenTarget'));
      return ts.factory.updateFunctionDeclaration(n, n.modifiers, n.asteriskToken, n.name, n.typeParameters, n.parameters, n.type, body);
    });
    return ts.createPrinter().printFile(ts.factory.updateSourceFile(tree, statements));
  }
  assert.equal(retained(fs.readFileSync(rootFile, 'utf8')), retained(old), 'Remaining root helpers and service statements unchanged');
}
async function run(force, listMode, refreshMode, stage, original) {
  const trace = [], failure = Error('controlled navigation failure');
  const existing = { id: listMode === 'no-id' ? undefined : 'existing', type: 'page', url: 'about:blank', title: 'old', webSocketDebuggerUrl: 'ws://old' };
  const target = { id: 'new-target' }, url = 'https://example.org/中文?q=a b';
  const initial = listMode === 'empty' ? [] : listMode === 'null' ? null : listMode === 'object' ? {} : listMode === 'no-socket' ? [{ type: 'page' }] : listMode === 'worker' ? [{ type: 'worker', webSocketDebuggerUrl: 'ws://ignored' }]
    : [null, { type: 'worker', webSocketDebuggerUrl: 'ws://ignored' }, { type: 'page' }, existing, { type: 'page', webSocketDebuggerUrl: 'ws://later' }];
  const refreshed = { id: existing.id, type: refreshMode === 'worker' ? 'worker' : 'page', title: 'new', url: refreshMode === 'blank' ? 'about:blank' : refreshMode === 'empty-url' ? '' : 'https://redirected.example.org', webSocketDebuggerUrl: 'ws://new' };
  const refreshList = refreshMode === 'null' ? null : refreshMode === 'empty' ? [] : refreshMode === 'object' ? {} : refreshMode === 'other-id' ? [{ ...refreshed, id: 'other' }] : refreshMode === 'no-socket' ? [{ ...refreshed, webSocketDebuggerUrl: '' }] : [refreshed];
  let requests = 0;
  const http = { async requestJson(...args) {
    trace.push(['http', ...args]); assert.equal(args[0], 'http://127.0.0.1:9223/json/list');
    requests++;
    if (requests === 1 && stage === 'initial' || requests === 2 && stage === 'refresh') throw failure;
    return requests === 1 ? initial : refreshList;
  } };
  const client = {
    async send(method, params) { assert.equal(this, client); trace.push(['send', method, params]); if (stage === 'enable' && method === 'Page.enable' || stage === 'navigate' && method === 'Page.navigate') throw failure; },
    close() { assert.equal(this, client); trace.push(['close']); if (stage === 'close') throw failure; },
  };
  const dependencies = {
    './browserSearchHttp.cjs': http,
    './browserSearchDevToolsClient.cjs': { async createDevToolsClient(socket) { trace.push(['connect', socket]); assert.equal(socket, existing.webSocketDebuggerUrl); if (stage === 'connect') throw failure; return client; } },
    './browserSearchTarget.cjs': { async openSearchTarget(port, address) { trace.push(['new', port, address]); assert.equal(port, 9223); assert.equal(address, url); return target; } },
    './browserSearchTiming.cjs': { PAGE_LOAD_WAIT_MS: 4500, async delay(ms) { trace.push(['delay', ms]); assert.equal(ms, 4500); if (stage === 'delay') throw failure; } },
  };
  const module = { exports: {} };
  new Function('require', 'module', original ? oldSource : source)(id => { assert.ok(dependencies[id]); return dependencies[id]; }, module);
  let result, error;
  try { result = await module.exports.navigateOrOpenTarget(9223, url, force); } catch (e) { assert.equal(e, failure); error = e.message; }
  const reusable = ['normal', 'no-id'].includes(listMode);
  if (force) { assert.equal(result, target); assert.deepEqual(trace, [['new', 9223, url]]); }
  else if (stage === 'initial') { assert.equal(error, failure.message); assert.equal(trace.length, 1); }
  else if (!reusable) { assert.equal(result, target); assert.equal(trace.at(-1)[0], 'new'); }
  else if (['normal', 'refresh'].includes(stage)) {
    const match = stage !== 'refresh' && ['normal', 'worker', 'blank', 'empty-url'].includes(refreshMode);
    assert.notEqual(result, existing);
    assert.equal(result.webSocketDebuggerUrl, match ? 'ws://new' : 'ws://old');
    assert.equal(result.url, match && !['blank', 'empty-url'].includes(refreshMode) ? refreshed.url : url);
    assert.equal(result.title, match ? 'new' : 'old');
    assert.equal(trace.at(-1)[0], 'close');
    assert.ok(!trace.some(row => row[0] === 'new'));
  } else assert.equal(error, failure.message);
  const connected = trace.some(row => row[0] === 'connect') && stage !== 'connect';
  assert.equal(trace.filter(row => row[0] === 'close').length, connected ? 1 : 0);
  return { result, error, trace };
}
async function main() {
  const fingerprint = crypto.createHash('sha256'); let cases = 0;
  for (const force of [false, true]) for (const list of ['normal', 'no-id', 'empty', 'null', 'object', 'no-socket', 'worker'])
    for (const refresh of ['normal', 'worker', 'blank', 'empty-url', 'null', 'empty', 'object', 'other-id', 'no-socket']) for (const stage of ['normal', 'initial', 'connect', 'enable', 'navigate', 'delay', 'refresh', 'close']) {
      const actual = await run(force, list, refresh, stage, false);
      if (oldSource) assert.deepEqual(actual, await run(force, list, refresh, stage, true));
      fingerprint.update(JSON.stringify(actual) + '\n'); cases++;
    }
  const hash = fingerprint.digest('hex');
  assert.equal(hash, 'ac447646e6b28b008e166b1884edcdf1e256fd47f862da72714f5001dd53b2e5', 'Reviewed page navigation and refresh order remain unchanged');
  console.log('Browser navigation passed: ' + cases + ' force-new/selection/refresh/merge/protocol/timing/finally/error cases; hash ' + hash);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
