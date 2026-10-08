const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const crypto = require('node:crypto');
const file = require.resolve('../electron/browserSearchReadPage.cjs');
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
  const index = fn.body.statements.findIndex(n => ts.isIfStatement(n) && n.expression.getText(t) === '!page.webSocketDebuggerUrl');
  assert.ok(index >= 0);
  oldSource = source.slice(0, source.indexOf('async function readBrowserControlPage')) + 'async function readBrowserControlPage(action, browserLabel, page, pages) {\n'
    + fn.body.statements.slice(index).map(n => n.getText(t)).join('\n') + '\n}\nmodule.exports = { readBrowserControlPage };';
  const currentText = fs.readFileSync(rootFile, 'utf8'), current = ts.createSourceFile(rootFile, currentText, ts.ScriptTarget.Latest, true);
  let page;
  function find(n) { if (ts.isFunctionDeclaration(n) && n.name?.text === 'controlBrowserPage') page = n; ts.forEachChild(n, find); }
  find(current); assert.ok(page);
  const printer = ts.createPrinter(), print = (statements, t) => statements.map(n => printer.printNode(ts.EmitHint.Unspecified, n, t)).join('\n');
  assert.equal(print(page.body.statements.slice(0, -1), current), print(fn.body.statements.slice(0, index), t), 'Session, list, selection, open and focus statements unchanged');
  assert.match(currentText, /return readBrowserControlPage\(action, browserLabel, page, pages\)/);
}
async function run(socketMode, textMode, stage, projectionMode, original) {
  const trace = [], failure = Error('controlled read failure');
  const text = textMode === 'empty' ? '' : textMode === 'whitespace' ? '   ' : textMode === 'zero' ? 0 : textMode === 'false' ? false : textMode === 'null' ? null : textMode === 'undefined' ? undefined : textMode === 'number' ? 42 : '中文\nraw text';
  let socketReads = 0;
  const values = { id: 'page', title: 'title', type: 'page', url: socketMode === 'empty-url' ? '' : 'https://example.org', webSocketDebuggerUrl: socketMode === 'empty' ? '' : socketMode === 'null' ? null : socketMode === 'missing' ? undefined : 'ws://controlled' };
  const page = {};
  for (const [key, value] of Object.entries(values)) Object.defineProperty(page, key, { get() {
    trace.push(['page', key]);
    if (key === 'webSocketDebuggerUrl') { socketReads++; if (socketMode === 'getter-throw') throw failure; if (socketMode === 'changing' && socketReads === 2) return ''; }
    if (projectionMode === key + '-throw') throw failure;
    return value;
  } });
  const pages = {};
  Object.defineProperty(pages, 'length', { get() { trace.push(['length']); if (projectionMode === 'length-throw') throw failure; return 2; } });
  const module = { exports: {} };
  new Function('require', 'module', original ? oldSource : source)(id => {
    if (id.endsWith('browserSearchPageText.cjs')) return { extractPageText(socket) {
      trace.push(['extract', socket]);
      if (stage === 'sync-throw') throw failure;
      return stage === 'reject' ? Promise.reject(failure) : Promise.resolve(text);
    } };
    assert.equal(id, './browserSearchPages.cjs'); return require('../electron/browserSearchPages.cjs');
  }, module);
  let result, error;
  try { result = await module.exports.readBrowserControlPage('read_page', 'Edge', page, pages); } catch (e) { assert.equal(e, failure); error = e.message; }
  if (result) {
    assert.equal(result.action, 'read_page'); assert.equal(result.browserLabel, 'Edge'); assert.equal(result.pageCount, 2);
    if (['empty', 'null', 'missing'].includes(socketMode)) {
      assert.equal(result.ok, false); assert.equal(result.error, 'The selected tab does not expose a readable DevTools websocket.');
      assert.ok(!trace.some(row => row[0] === 'extract')); assert.ok(!Object.hasOwn(result, 'text'));
    } else {
      assert.equal(result.ok, Boolean(text)); assert.equal(result.text, text);
      assert.equal(Object.hasOwn(result, 'error'), !text);
      if (!text) assert.equal(result.error, 'No usable page text was extracted.');
      assert.equal(result.url, socketMode === 'empty-url' ? '' : 'https://example.org');
      if (socketMode === 'changing') assert.equal(trace.find(row => row[0] === 'extract')[1], '');
    }
  } else assert.equal(error, failure.message);
  return { result, error, trace };
}
async function main() {
  const fingerprint = crypto.createHash('sha256'); let cases = 0;
  for (const socket of ['normal', 'empty', 'null', 'missing', 'getter-throw', 'changing', 'empty-url'])
    for (const text of ['normal', 'empty', 'whitespace', 'zero', 'false', 'null', 'undefined', 'number']) for (const stage of ['normal', 'reject', 'sync-throw'])
      for (const projection of ['normal', 'title-throw', 'url-throw', 'length-throw']) {
        const actual = await run(socket, text, stage, projection, false);
        if (oldSource) assert.deepEqual(actual, await run(socket, text, stage, projection, true));
        fingerprint.update(JSON.stringify(actual) + '\n'); cases++;
      }
  const hash = fingerprint.digest('hex');
  assert.equal(hash, '88527ca5ae368c13561239fe24229a502a8bd1bc32f1d725e8711af609f379a7', 'Reviewed selected-page reading and error propagation remain unchanged');
  console.log('Read-page control passed: ' + cases + ' socket/text/truthiness/projection/getter/error/order cases; hash ' + hash);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
