const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const crypto = require('node:crypto');
const file = require.resolve('../electron/browserSearchPages.cjs');
const rootFile = require.resolve('../electron/browserSearchService.cjs');
const source = fs.readFileSync(file, 'utf8'), tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
const names = ['listDevToolsPages', 'selectBrowserPage', 'formatBrowserPage'];
assert.ok(source.split('\n').length <= 300);
function budgets(n) { if (ts.isFunctionLike(n) && n.body) assert.ok(tree.getLineAndCharacterOfPosition(n.end).line - tree.getLineAndCharacterOfPosition(n.getStart(tree)).line + 1 <= 50); ts.forEachChild(n, budgets); }
budgets(tree);
let oldSource;
if (process.argv[2]) {
  const old = fs.readFileSync(process.argv[2], 'utf8'), t = ts.createSourceFile(rootFile, old, ts.ScriptTarget.Latest, true), selected = [];
  function visit(n) { if (ts.isFunctionDeclaration(n) && names.includes(n.name?.text)) selected.push(n); ts.forEachChild(n, visit); }
  visit(t); assert.equal(selected.length, 3);
  oldSource = "const { requestJson } = require('./browserSearchHttp.cjs');\n" + selected.map(n => n.getText(t)).join('\n') + '\nmodule.exports = { ' + names.join(',') + ' };';
  function retained(text) {
    const t = ts.createSourceFile(rootFile, text, ts.ScriptTarget.Latest, true);
    const statements = t.statements.filter(n => !n.getText(t).includes("require('./browserSearchPages.cjs')")).map(n => {
      if (!ts.isFunctionDeclaration(n) || n.name?.text !== 'createBrowserSearchService') return n;
      const body = ts.factory.updateBlock(n.body, n.body.statements.filter(n => !ts.isFunctionDeclaration(n) || !names.includes(n.name?.text)));
      return ts.factory.updateFunctionDeclaration(n, n.modifiers, n.asteriskToken, n.name, n.typeParameters, n.parameters, n.type, body);
    });
    return ts.createPrinter().printFile(ts.factory.updateSourceFile(t, statements));
  }
  assert.equal(retained(fs.readFileSync(rootFile, 'utf8')), retained(old), 'Remaining root statements unchanged');
}
async function run(listMode, requestMode, failureMode, original) {
  const trace = [], failure = Error('controlled page failure');
  function page(label, values) {
    const object = {};
    for (const key of ['id', 'title', 'type', 'url', 'webSocketDebuggerUrl']) Object.defineProperty(object, key, { enumerable: true, get() {
      trace.push([label, key]); if (failureMode === key) throw failure; return values[key];
    } });
    return object;
  }
  const first = page('first', { id: 'a', type: 'page', title: 'First TITLE', url: 'https://one.example.org', webSocketDebuggerUrl: listMode === 'no-sockets' ? '' : 'ws://first' });
  const second = page('second', { id: 2, type: 'page', title: 'Second title', url: 'https://two.example.org', webSocketDebuggerUrl: '' });
  const third = page('third', { id: 'c', type: 'worker', title: 'worker', url: 'https://worker.example.org', webSocketDebuggerUrl: 'ws://worker' });
  const raw = listMode === 'null' ? null : listMode === 'object' ? { page: first } : listMode === 'empty' ? [] : listMode === 'workers' ? [third] : listMode === 'second-only' ? [second] : [null, third, first, second];
  const values = requestMode === 'id' ? { tabId: ' a ', query: 'two' } : requestMode === 'id-alias' ? { id: 'a' } : requestMode === 'id-miss' ? { tabId: 'missing' }
    : requestMode === 'numeric-id' ? { tabId: 2 } : requestMode === 'miss-with-query' ? { tabId: 'missing', query: 'two' }
    : requestMode === 'title' ? { title: ' FIRST ' } : requestMode === 'url' ? { url: 'TWO.EXAMPLE' } : requestMode === 'target' ? { target: 'two' }
    : requestMode === 'query-miss' ? { query: 'absent' } : requestMode === 'whitespace-query' ? { query: ' ', title: 'first' }
    : requestMode === 'priority' ? { query: 'first', target: 'two', title: 'second' } : requestMode === 'request-throw' ? { query: { toString() { throw failure; } } } : {};
  let request = requestMode === 'null' ? null : requestMode === 'undefined' ? undefined : {};
  if (request) for (const key of ['tabId', 'id', 'query', 'target', 'title', 'url']) Object.defineProperty(request, key, { get() { trace.push(['request', key]); return values[key]; } });
  const module = { exports: {} };
  new Function('require', 'module', original ? oldSource : source)(id => {
    assert.equal(id, './browserSearchHttp.cjs');
    return { async requestJson(...args) { trace.push(['http', ...args]); if (failureMode === 'http') throw failure; return raw; } };
  }, module);
  let result, error;
  try {
    const pages = await module.exports.listDevToolsPages(9223);
    assert.ok(pages.every(p => p === first || p === second));
    const selected = module.exports.selectBrowserPage(pages, request);
    assert.ok(selected === null || selected === first || selected === second);
    const formatted = pages.map(module.exports.formatBrowserPage);
    result = { pageCount: pages.length, selected: selected === first ? 'first' : selected === second ? 'second' : null, formatted };
    if (failureMode === 'normal' && ['normal', 'no-sockets'].includes(listMode)) {
      assert.equal(pages.length, 2);
      assert.equal(formatted[0].webSocketDebuggerUrl, listMode === 'no-sockets' ? '' : 'available');
      assert.equal(formatted[1].id, 2, 'Projection does not coerce id types');
      if (['id', 'id-alias', 'title', 'priority'].includes(requestMode)) assert.equal(selected, first);
      if (['miss-with-query', 'url', 'target'].includes(requestMode)) assert.equal(selected, second);
      if (requestMode === 'query-miss') assert.equal(selected, null);
      if (requestMode === 'numeric-id') assert.equal(selected, first, 'Requested id is normalized to string, while page id remains strict');
    }
  } catch (e) { assert.equal(e, failure); error = e.message; }
  return { result, error, trace };
}
async function main() {
  const fingerprint = crypto.createHash('sha256'); let cases = 0;
  for (const list of ['normal', 'no-sockets', 'null', 'object', 'empty', 'workers', 'second-only'])
    for (const request of ['default', 'null', 'undefined', 'id', 'id-alias', 'id-miss', 'numeric-id', 'miss-with-query', 'title', 'url', 'target', 'query-miss', 'whitespace-query', 'priority', 'request-throw'])
      for (const failure of ['normal', 'http', 'id', 'title', 'type', 'url', 'webSocketDebuggerUrl']) {
        const actual = await run(list, request, failure, false);
        if (oldSource) assert.deepEqual(actual, await run(list, request, failure, true));
        fingerprint.update(JSON.stringify(actual) + '\n'); cases++;
      }
  const api = require(file);
  assert.equal(api.selectBrowserPage([null, { id: 'fallback' }]), null);
  assert.deepEqual(api.formatBrowserPage(null), { id: '', title: '', type: '', url: '', webSocketDebuggerUrl: '' });
  const hash = fingerprint.digest('hex');
  assert.equal(hash, '47e713e846a37b2b3b5a172de47d049f6b988eeaea0bbf5712c0e1bdbe9093fa', 'Reviewed page selection, projection and read order remain unchanged');
  console.log('Browser page selection passed: ' + cases + ' filter/id/query/priority/projection/identity/getter/error cases; hash ' + hash);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
