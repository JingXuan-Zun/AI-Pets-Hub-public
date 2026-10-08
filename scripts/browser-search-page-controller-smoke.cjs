const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const crypto = require('node:crypto');
const file = require.resolve('../electron/browserSearchPageController.cjs');
const rootFile = require.resolve('../electron/browserSearchService.cjs');
const source = fs.readFileSync(file, 'utf8'), tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
const pagesApi = require('../electron/browserSearchPages.cjs');
assert.ok(source.split('\n').length <= 300);
function budgets(n) { if (ts.isFunctionLike(n) && n.body) assert.ok(tree.getLineAndCharacterOfPosition(n.end).line - tree.getLineAndCharacterOfPosition(n.getStart(tree)).line + 1 <= 50); ts.forEachChild(n, budgets); }
budgets(tree);
let oldFunction;
if (process.argv[2]) {
  const old = fs.readFileSync(process.argv[2], 'utf8'), t = ts.createSourceFile(rootFile, old, ts.ScriptTarget.Latest, true);
  function visit(n) { if (ts.isFunctionDeclaration(n) && n.name?.text === 'controlBrowserPage') oldFunction = n.getText(t); ts.forEachChild(n, visit); }
  visit(t); assert.ok(oldFunction);
  function retained(text) {
    const t = ts.createSourceFile(rootFile, text, ts.ScriptTarget.Latest, true);
    const statements = t.statements.filter(n => !/require\('\.\/browserSearch(?:PageController|ReadPage|FocusPage|OpenPage|Pages)\.cjs'\)/.test(n.getText(t))).map(n => {
      if (!ts.isFunctionDeclaration(n) || n.name?.text !== 'createBrowserSearchService') return n;
      const body = ts.factory.updateBlock(n.body, n.body.statements.filter(n => !(ts.isFunctionDeclaration(n) && n.name?.text === 'controlBrowserPage') && !(ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(t) === 'controlBrowserPage'))));
      return ts.factory.updateFunctionDeclaration(n, n.modifiers, n.asteriskToken, n.name, n.typeParameters, n.parameters, n.type, body);
    });
    return ts.createPrinter().printFile(ts.factory.updateSourceFile(t, statements));
  }
  assert.equal(retained(fs.readFileSync(rootFile, 'utf8')), retained(old), 'Root discovery/session/search/lifecycle statements unchanged');
}
async function run(action, sessionMode, pageMode, requestMode, stage, original) {
  const trace = [], failure = Error('controlled controller failure');
  const request = requestMode === 'second' ? { tabId: 'b' } : requestMode === 'missing' ? { query: 'absent' } : requestMode === 'title' ? { title: 'second' } : {};
  const settings = { tag: 'original-settings' };
  const session = {};
  for (const [key, value] of Object.entries({ ok: sessionMode === 'failed' ? false : sessionMode === 'zero' ? 0 : true, port: 9223, browserLabel: 'Chrome', reason: 'kept', action: 'old' })) Object.defineProperty(session, key, { enumerable: true, get() { trace.push(['session', key]); return value; } });
  const first = { id: 'a', type: 'page', title: 'first', url: 'https://first.example', webSocketDebuggerUrl: pageMode === 'no-socket' ? '' : 'ws://first' };
  const second = { id: 'b', type: 'page', url: 'https://second.example', webSocketDebuggerUrl: '' };
  Object.defineProperty(second, 'title', { get() { trace.push(['second', 'title']); if (stage === 'projection') throw failure; return 'second'; } });
  const pages = pageMode === 'empty' ? [] : [first, second];
  const execution = { ok: true, result: 'original-execution' };
  const dependencies = {
    async ensureControlBrowserSession(givenSettings, givenRequest) { assert.equal(givenSettings, settings); assert.equal(givenRequest, request); trace.push(['ensure']); if (stage === 'ensure') throw failure; return session; },
    resolveBrowserSessionOptions(givenSettings) { assert.equal(givenSettings, settings); trace.push(['resolve']); if (stage === 'resolve') throw failure; return session; },
  };
  const list = async port => { assert.equal(port, 9223); trace.push(['list']); if (stage === 'list') throw failure; return pages; };
  async function open(a, r, port, label) { assert.equal(a, action); assert.equal(r, request); assert.equal(port, 9223); assert.equal(label, 'Chrome'); trace.push(['open']); if (stage === 'execute') throw failure; return execution; }
  async function focus(a, label, port, page, givenPages) { assert.equal(a, action); assert.equal(label, 'Chrome'); assert.equal(port, 9223); assert.equal(givenPages, pages); assert.ok(page === first || page === second); trace.push(['focus', page.id]); if (stage === 'execute') throw failure; return execution; }
  async function read(a, label, page, givenPages) { assert.equal(a, action); assert.equal(label, 'Chrome'); assert.equal(givenPages, pages); assert.ok(page === first || page === second); trace.push(['read', page.id]); if (stage === 'execute') throw failure; return execution; }
  let control;
  if (original) control = new Function('ensureControlBrowserSession', 'resolveBrowserSessionOptions', 'listDevToolsPages', 'selectBrowserPage', 'formatBrowserPage', 'openBrowserControlPage', 'focusBrowserControlPage', 'readBrowserControlPage', oldFunction + '\nreturn controlBrowserPage;')(dependencies.ensureControlBrowserSession, dependencies.resolveBrowserSessionOptions, list, pagesApi.selectBrowserPage, pagesApi.formatBrowserPage, open, focus, read);
  else {
    const module = { exports: {} };
    new Function('require', 'module', source)(id => {
      if (id.endsWith('browserSearchPages.cjs')) return { ...pagesApi, listDevToolsPages: list };
      if (id.endsWith('browserSearchOpenPage.cjs')) return { openBrowserControlPage: open };
      if (id.endsWith('browserSearchFocusPage.cjs')) return { focusBrowserControlPage: focus };
      if (id.endsWith('browserSearchReadPage.cjs')) return { readBrowserControlPage: read };
      throw Error('Unexpected dependency ' + id);
    }, module);
    control = module.exports.createBrowserPageController(dependencies);
    assert.notEqual(control, module.exports.createBrowserPageController(dependencies));
  }
  let result, error;
  try { result = await control(action, request, settings); } catch (e) { assert.equal(e, failure); error = e.message; }
  assert.equal(trace[0][0], action === 'open_url' ? 'ensure' : 'resolve');
  if (result) {
    if (sessionMode === 'failed') { assert.equal(result.action, action); assert.equal(result.ok, false); assert.ok(!trace.some(row => ['open', 'list', 'focus', 'read'].includes(row[0]))); }
    else if (action === 'open_url') { assert.equal(result, execution); assert.ok(!trace.some(row => row[0] === 'list')); }
    else if (stage === 'list') { assert.equal(result.ok, false); assert.equal(result.pageCount, 0); assert.equal(result.error, failure.message); }
    else if (action === 'list_tabs') { assert.equal(result.ok, true); assert.equal(result.pageCount, pages.length); assert.equal(result.pages.length, pages.length); }
    else if (pageMode === 'empty' || requestMode === 'missing') { assert.equal(result.ok, false); assert.equal(result.error, 'No matching controlled browser tab was found.'); }
    else assert.equal(result, execution);
  }
  return { result, error, trace };
}
async function main() {
  const fingerprint = crypto.createHash('sha256'); let cases = 0;
  for (const action of ['open_url', 'list_tabs', 'focus_tab', 'read_page', 'unknown']) for (const session of ['normal', 'failed', 'zero'])
    for (const pages of ['normal', 'empty', 'no-socket']) for (const request of ['default', 'second', 'missing', 'title'])
      for (const stage of ['normal', 'ensure', 'resolve', 'list', 'execute', 'projection']) {
        const actual = await run(action, session, pages, request, stage, false);
        if (oldFunction) assert.deepEqual(actual, await run(action, session, pages, request, stage, true));
        fingerprint.update(JSON.stringify(actual) + '\n'); cases++;
      }
  const hash = fingerprint.digest('hex');
  assert.equal(hash, '403468bc19f8b76156153ce8e6bfc6c152b21360c501256b5440c7ee064e6f4f', 'Reviewed page controller and instance dependency order remain unchanged');
  console.log('Page controller passed: ' + cases + ' session/list/selection/dispatch/identity/projection/error/order cases; hash ' + hash);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
