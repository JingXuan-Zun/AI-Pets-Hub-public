const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const crypto = require('node:crypto');
const file = require.resolve('../electron/browserSearchPageText.cjs');
const rootFile = require.resolve('../electron/browserSearchService.cjs');
const source = fs.readFileSync(file, 'utf8');
const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
const names = ['normalizeExtractedText', 'extractTextFromDocumentLike', 'extractPageText'];
assert.ok(source.split('\n').length <= 300);
function budgets(n) {
  if (ts.isFunctionLike(n) && n.body) assert.ok(tree.getLineAndCharacterOfPosition(n.end).line - tree.getLineAndCharacterOfPosition(n.getStart(tree)).line + 1 <= 50);
  ts.forEachChild(n, budgets);
}
budgets(tree);
let oldSource;
if (process.argv[2]) {
  const old = fs.readFileSync(process.argv[2], 'utf8'), t = ts.createSourceFile(rootFile, old, ts.ScriptTarget.Latest, true);
  const selected = n => ts.isFunctionDeclaration(n) && names.includes(n.name.text)
    || ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(t) === 'MAX_RESULT_TEXT_LENGTH');
  oldSource = "const { createDevToolsClient } = require('./browserSearchDevToolsClient.cjs');\n" + t.statements.filter(selected).map(n => n.getText(t)).join('\n') + '\nmodule.exports = { ' + names.join(',') + ' };';
  const printer = ts.createPrinter();
  const retained = t.statements.filter(n => !selected(n)).map(n => printer.printNode(ts.EmitHint.Unspecified, n, t)).join('\n');
  const current = ts.createSourceFile(rootFile, fs.readFileSync(rootFile, 'utf8'), ts.ScriptTarget.Latest, true);
  assert.equal(current.statements.filter(n => !n.getText(current).includes("require('./browserSearchPageText.cjs')")).map(n => printer.printNode(ts.EmitHint.Unspecified, n, current)).join('\n'), retained, 'Remaining production statements unchanged');
}
function load(original, create) {
  const module = { exports: {} };
  new Function('require', 'module', original ? oldSource : source)(id => { assert.equal(id, './browserSearchDevToolsClient.cjs'); return { createDevToolsClient: create }; }, module);
  return module.exports;
}
function dom(titleMode, bodyMode, noiseMode, original) {
  const trace = [], failure = Error('controlled DOM failure');
  const title = titleMode === 'empty' ? '  ' : titleMode === 'missing' ? undefined : titleMode === 'number' ? 42 : '  页面 标题  ';
  const cloned = {};
  Object.defineProperty(cloned, 'innerText', { get() { trace.push('innerText'); if (bodyMode === 'text-throw') throw failure; return bodyMode === 'non-text' ? 42 : '  可见 正文\n内容  '; } });
  cloned.querySelectorAll = bodyMode === 'no-query' ? undefined : function (selector) {
    assert.equal(this, cloned); trace.push(['query', selector]);
    assert.equal(selector, 'script,style,noscript,svg,canvas,iframe,[aria-hidden="true"]');
    if (bodyMode === 'query-throw') throw failure;
    const removable = { remove() { assert.equal(this, removable); trace.push('remove'); if (noiseMode === 'throw') throw failure; } };
    return noiseMode === 'none' ? [] : [null, {}, { remove: 42 }, removable];
  };
  const live = { cloneNode(deep) { assert.equal(this, live); assert.equal(deep, true); trace.push('clone'); if (bodyMode === 'clone-throw') throw failure; return bodyMode === 'null-clone' ? null : cloned; } };
  const document = {};
  Object.defineProperties(document, {
    title: { get() { trace.push('title'); if (titleMode === 'throw') throw failure; return title; } },
    body: { get() { trace.push('body'); return bodyMode === 'missing' ? null : bodyMode === 'no-clone' ? {} : live; } },
  });
  let value, error;
  try { value = load(original).extractTextFromDocumentLike(document); } catch (e) { assert.equal(e, failure); error = e.message; }
  assert.ok(!trace.includes('remove') || trace.includes('clone'));
  if (bodyMode === 'missing' && titleMode === 'normal') assert.equal(value, 'Title: 页面 标题');
  if (bodyMode === 'normal' && titleMode === 'normal' && noiseMode !== 'throw') assert.equal(value, 'Title: 页面 标题\n  可见 正文\n内容  ');
  return { value, error, trace };
}
async function runtime(stage, resultMode, original) {
  const trace = [], failure = Error('controlled runtime failure');
  const value = resultMode === 'long' ? ' x\n'.repeat(7000) : resultMode === 'number' ? 42 : resultMode === 'false' ? false : resultMode === 'object' ? { text: 'object' } : resultMode === 'convert-throw' ? { toString() { throw failure; } } : '  中文\n  内容  ';
  const client = {
    async send(method, params) {
      assert.equal(this, client); trace.push(['send', method, params]);
      if (stage === 'enable' && method === 'Runtime.enable' || stage === 'evaluate' && method === 'Runtime.evaluate') throw failure;
      if (method === 'Runtime.evaluate') {
        assert.equal(params.awaitPromise, true); assert.equal(params.returnByValue, true);
        assert.equal(new Function('document', 'return ' + params.expression)({ title: 'sample', body: null }), 'Title: sample');
        return resultMode === 'missing' ? undefined : { result: { value } };
      }
    },
    close() { assert.equal(this, client); trace.push(['close']); if (stage === 'close') throw failure; },
  };
  const api = load(original, async url => { trace.push(['connect', url]); if (stage === 'connect') throw failure; return client; });
  let result, error;
  try { result = await api.extractPageText('ws://controlled/page'); } catch (e) { assert.equal(e, failure); error = e.message; }
  assert.equal(trace.filter(row => row[0] === 'close').length, stage === 'connect' ? 0 : 1);
  if (stage === 'normal' && resultMode !== 'convert-throw') {
    assert.equal(result.length <= 6000, true);
    assert.equal(result, resultMode === 'missing' || resultMode === 'false' ? '' : resultMode === 'number' ? '42' : resultMode === 'object' ? '[object Object]' : resultMode === 'long' ? ('x '.repeat(7000)).slice(0, 6000) : '中文 内容');
  }
  return { result, error, trace };
}
async function main() {
  const fingerprint = crypto.createHash('sha256'); let cases = 0;
  function record(actual, original) { if (oldSource) assert.deepEqual(actual, original); fingerprint.update(JSON.stringify(actual) + '\n'); cases++; }
  for (const title of ['normal', 'empty', 'missing', 'number', 'throw']) for (const body of ['normal', 'missing', 'no-clone', 'null-clone', 'no-query', 'non-text', 'clone-throw', 'query-throw', 'text-throw'])
    for (const noise of ['none', 'nodes', 'throw']) record(dom(title, body, noise, false), oldSource && dom(title, body, noise, true));
  for (const stage of ['normal', 'connect', 'enable', 'evaluate', 'close']) for (const result of ['normal', 'missing', 'long', 'number', 'false', 'object', 'convert-throw']) record(await runtime(stage, result, false), oldSource && await runtime(stage, result, true));
  for (const value of [null, undefined, '', 0, 42, false, '  a\n b\t c  ', 'x'.repeat(6001)]) record(load(false).normalizeExtractedText(value), oldSource && load(true).normalizeExtractedText(value));
  const root = require('../electron/browserSearchService.cjs');
  assert.equal(root.extractTextFromDocumentLike, require(file).extractTextFromDocumentLike, 'Public root extractor uses the actual module');
  const hash = fingerprint.digest('hex');
  assert.equal(hash, '2383ab46b403da59303ccf265124512fca36e3c4579b7468cfb94c0dbb9ffa4a', 'Reviewed DOM extraction, expression and finally behavior remain unchanged');
  console.log('Browser page text passed: ' + cases + ' DOM/getter/clone/removal/protocol/limit/error/finally cases; hash ' + hash);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
