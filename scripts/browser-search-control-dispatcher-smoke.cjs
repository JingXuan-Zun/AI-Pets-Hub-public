const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const crypto = require('node:crypto');
const file = require.resolve('../electron/browserSearchControlDispatcher.cjs');
const rootFile = require.resolve('../electron/browserSearchService.cjs');
const source = fs.readFileSync(file, 'utf8'), tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
const rules = require('../electron/browserSearchRules.cjs');
assert.ok(source.split('\n').length <= 300);
function budgets(n) { if (ts.isFunctionLike(n) && n.body) assert.ok(tree.getLineAndCharacterOfPosition(n.end).line - tree.getLineAndCharacterOfPosition(n.getStart(tree)).line + 1 <= 50); ts.forEachChild(n, budgets); }
budgets(tree);
let oldFunction, baselineText;
if (process.argv[2]) {
  const old = baselineText = fs.readFileSync(process.argv[2], 'utf8'), t = ts.createSourceFile(rootFile, old, ts.ScriptTarget.Latest, true);
  let fn;
  function visit(n) { if (ts.isFunctionDeclaration(n) && n.name?.text === 'controlBrowser') fn = n; ts.forEachChild(n, visit); }
  visit(t); assert.ok(fn);
  const split = fn.body.statements.findIndex(n => n.getText(t).startsWith('const session ='));
  assert.equal(split, 4);
  oldFunction = 'async function controlBrowser(request = {}, settings = {}) {\n' + fn.body.statements.slice(0, split).map(n => n.getText(t)).join('\n') + '\nreturn controlBrowserPage(action, request, settings); }';
  const currentText = fs.readFileSync(rootFile, 'utf8'), current = ts.createSourceFile(rootFile, currentText, ts.ScriptTarget.Latest, true);
  let page;
  function find(n) { if (ts.isFunctionDeclaration(n) && n.name?.text === 'controlBrowserPage') page = n; ts.forEachChild(n, find); }
  find(current); assert.ok(page);
  const printer = ts.createPrinter();
  const print = (statements, tree) => statements.map(n => printer.printNode(ts.EmitHint.Unspecified, n, tree)).join('\n');
  assert.equal(print(page.body.statements, current), print(fn.body.statements.slice(split), t), 'Page execution statements unchanged');
}
async function run(actionMode, forceMode, stage, original) {
  const trace = [], failure = Error('controlled dispatcher failure');
  const actionValue = actionMode === 'conversion-throw' ? { toString() { throw failure; } } : actionMode === 'alias' ? undefined : actionMode;
  const request = {};
  const requestValues = { action: actionValue, browserAction: actionMode === 'alias' ? ' NAVIGATE-URL ' : 'status', operation: 'read', query: stage === 'query-throw' ? { toString() { throw failure; } } : '  中文 query  ', target: 'ignored target', forceNewPage: forceMode === 'true' ? true : forceMode === 'false' ? false : forceMode === 'null' ? null : undefined };
  for (const key of Object.keys(requestValues)) Object.defineProperty(request, key, { get() { trace.push(['request', key]); if (stage === 'action-throw' && key === 'action') throw failure; return requestValues[key]; } });
  const settings = {};
  for (const [key, value] of Object.entries({ browserSearchForceNewPage: true, extra: 'kept' })) Object.defineProperty(settings, key, { enumerable: true, get() { trace.push(['settings', key]); if (stage === 'settings-throw') throw failure; return value; } });
  const pageResult = { ok: true, page: 'controlled' }, state = { status: 'idle', action: 'old', ok: false }, searchResult = { ok: false, action: 'old', text: 'text' };
  const dependencies = {
    getSessionState() { trace.push(['state']); if (stage === 'state-throw') throw failure; return state; },
    async search(query, givenSettings) { trace.push(['search', query, givenSettings]); assert.equal(query, '中文 query'); assert.equal(givenSettings.extra, 'kept'); assert.equal(givenSettings.browserSearchForceNewPage, forceMode === 'false' ? false : true); if (stage === 'search-throw') throw failure; return searchResult; },
    async controlBrowserPage(action, givenRequest, givenSettings) { assert.equal(givenRequest, request); assert.equal(givenSettings, settings); trace.push(['page', action]); if (stage === 'page-throw') throw failure; return pageResult; },
  };
  let control;
  if (original) control = new Function('normalizeBrowserControlAction', 'getSessionState', 'search', 'controlBrowserPage', oldFunction + '\nreturn controlBrowser;')(rules.normalizeBrowserControlAction, dependencies.getSessionState, dependencies.search, dependencies.controlBrowserPage);
  else {
    const module = { exports: {} };
    new Function('require', 'module', source)(id => { assert.equal(id, './browserSearchRules.cjs'); return rules; }, module);
    control = module.exports.createBrowserControlDispatcher(dependencies);
    assert.notEqual(control, module.exports.createBrowserControlDispatcher(dependencies));
  }
  let result, error;
  try { result = await control(request, settings); } catch (e) { assert.equal(e, failure); error = e.message; }
  if (result) {
    if (actionMode === 'status') { assert.notEqual(result, state); assert.equal(result.action, 'status'); assert.equal(result.ok, true); }
    else if (actionMode === 'search_web' || actionMode === 'search') { assert.notEqual(result, searchResult); assert.equal(result.action, 'search_web'); }
    else if (actionMode === 'unknown' || actionMode === '') assert.equal(result.error, 'Unsupported browser control action.');
    else assert.equal(result, pageResult);
  }
  return { result, error, trace };
}
async function main() {
  const fingerprint = crypto.createHash('sha256'); let cases = 0;
  for (const action of ['status', 'search_web', 'search', 'open_url', 'read_page', 'focus_tab', 'list_tabs', 'alias', 'unknown', '', 'conversion-throw'])
    for (const force of ['true', 'false', 'null', 'undefined']) for (const stage of ['normal', 'action-throw', 'query-throw', 'settings-throw', 'state-throw', 'search-throw', 'page-throw']) {
      const actual = await run(action, force, stage, false);
      if (oldFunction) assert.deepEqual(actual, await run(action, force, stage, true));
      fingerprint.update(JSON.stringify(actual) + '\n'); cases++;
    }
  const hash = fingerprint.digest('hex');
  assert.equal(hash, '85ab30c1a98633cb3ed10fe7ca0297420274107f3001a7f3598ce376c457b772', 'Reviewed control dispatcher and instance dependency order remain unchanged');
  const api = require('../electron/browserSearchService.cjs');
  let oldApi;
  if (baselineText) {
    const module = { exports: {} };
    new Function('require', 'module', baselineText)(id => require(id.startsWith('./') ? '../electron/' + id.slice(2) : id), module);
    oldApi = module.exports;
  }
  const app = { getPath() { throw Error('Unexpected profile access'); } };
  const first = api.createBrowserSearchService({ app, log() {} }), second = api.createBrowserSearchService({ app, log() {} });
  assert.notEqual(first.control, second.control);
  for (const request of [undefined, null, {}, { action: 'status' }, { browserAction: ' STATUS ' }]) {
    const actual = await first.control(request);
    if (oldApi) assert.deepEqual(actual, await oldApi.createBrowserSearchService({ app, log() {} }).control(request));
    assert.equal(actual.ok, request?.action === 'status' || Boolean(request?.browserAction));
  }
  console.log('Browser control dispatch passed: ' + cases + ' aliases/priority/state/search/settings/force/identity/error/order cases; hash ' + hash);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
