const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const crypto = require('node:crypto');
const file = require.resolve('../electron/browserSearchOpenPage.cjs');
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
  const branch = fn.body.statements.find(n => ts.isIfStatement(n) && n.expression.getText(t) === "action === 'open_url'");
  assert.ok(branch);
  oldSource = source.slice(0, source.indexOf('async function openBrowserControlPage')) + 'async function openBrowserControlPage(action, request, port, browserLabel) {\n'
    + branch.thenStatement.statements.map(n => n.getText(t)).join('\n') + '\n}\nmodule.exports = { openBrowserControlPage };';
  const currentText = fs.readFileSync(rootFile, 'utf8'), current = ts.createSourceFile(rootFile, currentText, ts.ScriptTarget.Latest, true);
  let page;
  function find(n) { if (ts.isFunctionDeclaration(n) && n.name?.text === 'controlBrowserPage') page = n; ts.forEachChild(n, find); }
  find(current); assert.ok(page);
  const printer = ts.createPrinter();
  const remaining = (body, tree) => body.statements.filter(n => !(ts.isIfStatement(n) && n.expression.getText(tree) === "action === 'open_url'")).map(n => printer.printNode(ts.EmitHint.Unspecified, n, tree)).join('\n');
  assert.equal(remaining(page.body, current), remaining(fn.body, t), 'Session preparation and other page operations unchanged');
  assert.match(currentText, /return openBrowserControlPage\(action, request, port, browserLabel\)/);
}
async function run(urlMode, readMode, pageMode, stage, original) {
  const trace = [], failure = Error('controlled open-page failure');
  const values = { url: urlMode === 'normal' ? ' https://example.org/中文 ' : urlMode === 'domain' ? ' example.org/path ' : urlMode === 'invalid' ? 'javascript:alert(1)' : urlMode === 'missing' ? '' : urlMode === 'whitespace' ? ' ' : undefined,
    target: urlMode === 'target' || urlMode === 'whitespace' ? 'https://target.example.org' : undefined,
    query: urlMode === 'query' ? 'https://query.example.org' : undefined, site: urlMode === 'site' ? 'example.org/site' : undefined,
    website: urlMode === 'website' ? 'example.org/website' : undefined,
    forceNewPage: urlMode === 'normal', readPage: readMode === 'false' ? false : readMode === 'true' ? true : readMode === 'null' ? null : readMode === 'zero' ? 0 : undefined };
  if (urlMode === 'conversion-throw') values.url = { toString() { throw failure; } };
  const request = {};
  for (const key of Object.keys(values)) Object.defineProperty(request, key, { get() { trace.push(['request', key]); return values[key]; } });
  const page = pageMode === 'null' ? null : {};
  const pageValues = { id: 'page-id', title: 'page title', type: 'page', url: pageMode === 'blank' ? 'about:blank' : pageMode === 'empty-url' ? '' : 'https://redirect.example.org', webSocketDebuggerUrl: pageMode === 'no-socket' ? '' : 'ws://controlled' };
  if (page) for (const key of Object.keys(pageValues)) Object.defineProperty(page, key, { get() { trace.push(['page', key]); if (pageMode === key + '-throw') throw failure; return pageValues[key]; } });
  const rules = require('../electron/browserSearchRules.cjs'), pages = require('../electron/browserSearchPages.cjs');
  const deps = {
    './browserSearchRules.cjs': rules,
    './browserSearchPages.cjs': pages,
    './browserSearchNavigation.cjs': { async navigateOrOpenTarget(...args) { trace.push(['navigate', ...args]); assert.equal(args[0], 9223); if (stage === 'navigate') throw failure; return page; } },
    './browserSearchPageText.cjs': { extractPageText(socket) { trace.push(['extract', socket]); assert.equal(socket, 'ws://controlled'); if (stage === 'extract-sync') throw failure; return stage === 'extract-reject' ? Promise.reject(failure) : Promise.resolve('中文 text\nraw'); } },
  };
  const module = { exports: {} };
  new Function('require', 'module', original ? oldSource : source)(id => { assert.ok(deps[id]); return deps[id]; }, module);
  let result, error;
  try { result = await module.exports.openBrowserControlPage('open_url', request, 9223, 'Chrome'); } catch (e) { assert.equal(e, failure); error = e.message; }
  const invalid = ['missing', 'invalid', 'whitespace'].includes(urlMode);
  if (invalid) {
    assert.equal(result.ok, false);
    assert.equal(result.error, 'open_url needs an http(s) URL or a domain-like target.');
    assert.ok(!trace.some(row => row[0] === 'navigate' || row[0] === 'extract'));
  } else if (result) {
    assert.equal(result.ok, true); assert.equal(result.action, 'open_url'); assert.equal(result.browserLabel, 'Chrome');
    const read = readMode !== 'false' && !['null', 'no-socket'].includes(pageMode);
    assert.equal(result.text, read && stage !== 'extract-reject' ? '中文 text\nraw' : '');
    assert.equal(result.page.webSocketDebuggerUrl, ['null', 'no-socket'].includes(pageMode) ? '' : 'available');
    const navigation = trace.find(row => row[0] === 'navigate');
    assert.equal(result.url, ['blank', 'empty-url', 'null'].includes(pageMode) ? navigation[2] : 'https://redirect.example.org');
    assert.equal(navigation[3], urlMode === 'normal');
  } else assert.equal(error, failure.message);
  if (stage === 'extract-reject' && !invalid && urlMode !== 'conversion-throw' && !pageMode.endsWith('-throw')) assert.ok(result || stage === 'navigate');
  return { result, error, trace };
}
async function main() {
  const fingerprint = crypto.createHash('sha256'); let cases = 0;
  for (const url of ['normal', 'domain', 'invalid', 'missing', 'whitespace', 'target', 'query', 'site', 'website', 'conversion-throw'])
    for (const read of ['false', 'true', 'null', 'zero', 'undefined']) for (const page of ['normal', 'null', 'no-socket', 'blank', 'empty-url', 'id-throw', 'url-throw', 'webSocketDebuggerUrl-throw'])
      for (const stage of ['normal', 'navigate', 'extract-sync', 'extract-reject']) {
        const actual = await run(url, read, page, stage, false);
        if (oldSource) assert.deepEqual(actual, await run(url, read, page, stage, true));
        fingerprint.update(JSON.stringify(actual) + '\n'); cases++;
      }
  const hash = fingerprint.digest('hex');
  assert.equal(hash, '8b1602be611a8558f25527ff3ec0e86b16f2e7ad5a56348f1f51a140b4f103e9', 'Reviewed open-page execution and read-failure behavior remain unchanged');
  console.log('Open-page control passed: ' + cases + ' aliases/url/navigation/read/projection/getter/error/order cases; hash ' + hash);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
