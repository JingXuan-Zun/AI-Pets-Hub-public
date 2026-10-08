const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const crypto = require('node:crypto');
const file = require.resolve('../electron/browserSearchFocusPage.cjs');
const rootFile = require.resolve('../electron/browserSearchService.cjs');
const source = fs.readFileSync(file, 'utf8'), tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
assert.ok(source.split('\n').length <= 300);
function budgets(n) { if (ts.isFunctionLike(n) && n.body) assert.ok(tree.getLineAndCharacterOfPosition(n.end).line - tree.getLineAndCharacterOfPosition(n.getStart(tree)).line + 1 <= 50); ts.forEachChild(n, budgets); }
budgets(tree);
let oldSource;
if (process.argv[2]) {
  const old = fs.readFileSync(process.argv[2], 'utf8'), t = ts.createSourceFile(rootFile, old, ts.ScriptTarget.Latest, true);
  let fn;
  function visit(n) { if (ts.isFunctionDeclaration(n) && n.name?.text === 'controlBrowserPage') fn = n; ts.forEachChild(n, visit); }
  visit(t); assert.ok(fn);
  const branch = fn.body.statements.find(n => ts.isIfStatement(n) && n.expression.getText(t) === "action === 'focus_tab'");
  assert.ok(branch);
  oldSource = source.slice(0, source.indexOf('async function focusBrowserControlPage')) + 'async function focusBrowserControlPage(action, browserLabel, port, page, pages) {\n'
    + branch.thenStatement.statements.map(n => n.getText(t)).join('\n') + '\n}\nmodule.exports = { focusBrowserControlPage };';
  const currentText = fs.readFileSync(rootFile, 'utf8'), current = ts.createSourceFile(rootFile, currentText, ts.ScriptTarget.Latest, true);
  let page;
  function find(n) { if (ts.isFunctionDeclaration(n) && n.name?.text === 'controlBrowserPage') page = n; ts.forEachChild(n, find); }
  find(current); assert.ok(page);
  const printer = ts.createPrinter(), retained = (body, t) => body.statements.filter(n => !(ts.isIfStatement(n) && n.expression.getText(t) === "action === 'focus_tab'")).map(n => printer.printNode(ts.EmitHint.Unspecified, n, t)).join('\n');
  assert.equal(retained(page.body, current), retained(fn.body, t), 'Session, open/list/read controls remain unchanged');
  assert.match(currentText, /return focusBrowserControlPage\(action, browserLabel, port, page, pages\)/);
}
async function run(idMode, httpMode, projectionMode, original) {
  const trace = [], failure = Error('controlled focus failure');
  const idValue = idMode === 'undefined' ? undefined : idMode === 'null' ? null : idMode === 'number' ? 42 : idMode === 'unicode' ? '中文 /?#' : idMode === 'invalid-unicode' ? '\ud800' : idMode === 'convert-throw' ? { toString() { trace.push(['convert']); throw failure; } } : 'page one';
  let idReads = 0, titleReads = 0;
  const page = {};
  for (const [key, value] of Object.entries({ id: idValue, title: 'title', type: 'page', url: 'https://example.org', webSocketDebuggerUrl: 'ws://controlled' })) Object.defineProperty(page, key, { get() {
    trace.push(['page', key]);
    if (key === 'id') {
      idReads++;
      if (idMode === 'getter-throw' || idMode === 'second-getter-throw' && idReads === 2) throw failure;
      if (idMode === 'changing' && idReads > 1) return 'page two';
    }
    if (key === 'title') { titleReads++; if (projectionMode === 'title-throw' || projectionMode === 'first-title-throw' && titleReads === 1) throw failure; }
    return value;
  } });
  const pages = {};
  Object.defineProperty(pages, 'length', { get() { trace.push(['length']); if (projectionMode === 'length-throw') throw failure; return 3; } });
  let calls = 0;
  const http = { DEVTOOLS_CONNECT_TIMEOUT_MS: 8000, requestText(...args) {
    trace.push(['http', ...args]); calls++;
    if (httpMode === 'sync-throw') throw failure;
    if (calls === 1 && ['put-reject', 'both-reject', 'string-reject'].includes(httpMode) || calls === 2 && httpMode === 'both-reject') return Promise.reject(failure);
    if (calls === 2 && httpMode === 'string-reject') return Promise.reject('focus string failure');
    return Promise.resolve(httpMode === 'nonempty-success' ? 'not parsed' : '');
  } };
  const module = { exports: {} };
  new Function('require', 'module', original ? oldSource : source)(id => id.endsWith('browserSearchHttp.cjs') ? http : require('../electron/browserSearchPages.cjs'), module);
  let result, error;
  try { result = await module.exports.focusBrowserControlPage('focus_tab', 'Chrome', 9223, page, pages); } catch (e) { assert.equal(e, failure); error = e.message; }
  if (result) {
    assert.equal(result.action, 'focus_tab'); assert.equal(result.browserLabel, 'Chrome'); assert.equal(result.pageCount, 3); assert.equal(result.page.webSocketDebuggerUrl, 'available');
    if (idMode === 'convert-throw') { assert.equal(result.page.id, idValue); result = { ...result, page: { ...result.page, id: 'original-id-object' } }; }
  }
  const requests = trace.filter(row => row[0] === 'http');
  if (requests.length) assert.deepEqual(requests[0].slice(2), [8000, 'PUT']);
  if (requests.length === 2) { assert.equal(requests[1].length, 2); if (idMode === 'changing') assert.ok(requests[1][1].endsWith('page%20two')); }
  if (httpMode === 'sync-throw') assert.ok(requests.length <= 1, 'Synchronous request throw does not enter promise catch fallback');
  if (['normal', 'undefined', 'null', 'number', 'unicode', 'changing'].includes(idMode) && projectionMode === 'normal') {
    assert.equal(result.ok, !['both-reject', 'string-reject', 'sync-throw'].includes(httpMode));
    if (httpMode === 'put-reject') assert.equal(requests.length, 2);
    if (httpMode === 'string-reject') assert.equal(result.error, 'focus string failure');
  }
  return { result, error, trace };
}
async function main() {
  const fingerprint = crypto.createHash('sha256'); let cases = 0;
  for (const id of ['normal', 'undefined', 'null', 'number', 'unicode', 'invalid-unicode', 'convert-throw', 'getter-throw', 'second-getter-throw', 'changing'])
    for (const http of ['normal', 'nonempty-success', 'put-reject', 'both-reject', 'string-reject', 'sync-throw'])
      for (const projection of ['normal', 'title-throw', 'first-title-throw', 'length-throw']) {
        const actual = await run(id, http, projection, false);
        if (oldSource) assert.deepEqual(actual, await run(id, http, projection, true));
        fingerprint.update(JSON.stringify(actual) + '\n'); cases++;
      }
  const hash = fingerprint.digest('hex');
  assert.equal(hash, 'f918f01b9e20b001fb1bdb4c26adfe374476715ab6fe412972f9541164c55a7c', 'Reviewed page focus request fallback and error boundaries remain unchanged');
  console.log('Focus-page control passed: ' + cases + ' encoding/PUT/GET/return/projection/getter/error/order cases; hash ' + hash);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
