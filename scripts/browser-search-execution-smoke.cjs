const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const crypto = require('node:crypto');
const path = require('node:path');
const file = require.resolve('../electron/browserSearchExecution.cjs');
const rootFile = require.resolve('../electron/browserSearchService.cjs');
const source = fs.readFileSync(file, 'utf8');
const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
assert.ok(source.split('\n').length <= 300);
function budgets(n) {
  if (ts.isFunctionLike(n) && n.body) assert.ok(tree.getLineAndCharacterOfPosition(n.end).line - tree.getLineAndCharacterOfPosition(n.getStart(tree)).line + 1 <= 50);
  ts.forEachChild(n, budgets);
}
budgets(tree);
let oldFunction;
if (process.argv[2]) {
  const old = fs.readFileSync(process.argv[2], 'utf8');
  const t = ts.createSourceFile(rootFile, old, ts.ScriptTarget.Latest, true);
  const factory = t.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'createBrowserSearchService');
  oldFunction = factory.body.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'search').getText(t);
  function retained(text) {
    const t = ts.createSourceFile(rootFile, text, ts.ScriptTarget.Latest, true);
    const statements = t.statements.filter(n => !/require\('(?:path|\.\/browserSearchRules.cjs|\.\/browserSearchNavigation.cjs|\.\/browserSearchExecution.cjs)'\)/.test(n.getText(t))).map(n => {
      if (!ts.isFunctionDeclaration(n) || n.name?.text !== 'createBrowserSearchService') return n;
      const body = ts.factory.updateBlock(n.body, n.body.statements.filter(n => !(ts.isFunctionDeclaration(n) && n.name?.text === 'search') && !(ts.isVariableStatement(n) && n.getText(t).includes('createBrowserSearchExecution('))));
      return ts.factory.updateFunctionDeclaration(n, n.modifiers, n.asteriskToken, n.name, n.typeParameters, n.parameters, n.type, body);
    });
    return ts.createPrinter().printFile(ts.factory.updateSourceFile(t, statements)).replace('extractTextFromDocumentLike, extractPageText', 'extractTextFromDocumentLike').replace(', resolveBrowserPath, resolveBrowserLabel', ', resolveBrowserLabel');
  }
  assert.equal(retained(fs.readFileSync(rootFile, 'utf8')), retained(old), 'Root discovery/session/page control/lifecycle/API unchanged');
}
async function run(queryMode, found, blocked, force, targetMode, stage, original) {
  const trace = [], failure = Error('controlled search failure');
  const query = queryMode === 'empty' ? '  ' : queryMode === 'zero' ? 0 : queryMode === 'long' ? ' x'.repeat(70) : { toString() { trace.push(['query-string']); if (stage === 'query') throw failure; return '  查询 & text  '; } };
  const settings = {};
  for (const [key, value] of Object.entries({ browserSearchBrowserPath: found ? '/controlled/chrome.exe' : '', browserSearchDebugPort: 9223, browserSearchForceOpenBrowser: force, browserSearchForceNewPage: true })) Object.defineProperty(settings, key, { get() { trace.push(['settings', key]); return value; } });
  const discovery = {
    resolveBrowserPath(value) { trace.push(['path', value]); if (stage === 'path') throw failure; return value; },
    resolveBrowserLabel(value) { trace.push(['label', value]); if (stage === 'label') throw failure; return 'Chrome'; },
  };
  const rules = {
    resolveDebugPort(value) { trace.push(['port', value]); if (stage === 'port') throw failure; return value; },
    buildSearchUrl(q, s, label) { assert.equal(s, settings); trace.push(['url', q, label]); if (stage === 'url') throw failure; return 'https://search.example/?q=' + encodeURIComponent(q); },
  };
  const app = { getPath(key) { assert.equal(this, app); trace.push(['profile', key]); if (stage === 'profile') throw failure; return '/controlled/profile'; } };
  let attempts = 0;
  const deps = { app,
    log(...args) { trace.push(['log', ...args]); if (stage === 'log') throw failure; },
    async ensureBrowserSession(options) {
      trace.push(['ensure', ++attempts, options]);
      if (stage === 'first' && attempts === 1 || stage === 'second' && attempts === 2) throw failure;
      return { get blockedByManualClose() { trace.push(['blocked', attempts]); return blocked; } };
    },
    clearManualCloseRequest() { trace.push(['clear']); if (stage === 'clear') throw failure; },
  };
  async function navigateOrOpenTarget(...args) {
    trace.push(['navigate', ...args]); if (stage === 'navigate') throw failure;
    if (targetMode === 'null') return null;
    const target = {};
    for (const [key, value] of Object.entries({ webSocketDebuggerUrl: targetMode === 'no-socket' ? '' : 'ws://controlled', url: targetMode === 'blank' ? 'about:blank' : targetMode === 'empty-url' ? '' : 'https://redirect.example' })) Object.defineProperty(target, key, { get() { trace.push(['target', key]); if (stage === 'target') throw failure; return value; } });
    return target;
  }
  async function extractPageText(socket) { trace.push(['extract', socket]); if (stage === 'extract') throw failure; return targetMode === 'empty-text' ? '' : 'original page text'; }
  let search;
  if (original) search = new Function('app', 'path', 'resolveBrowserPath', 'resolveBrowserLabel', 'resolveDebugPort', 'buildSearchUrl', 'log', 'ensureBrowserSession', 'clearManualCloseRequest', 'navigateOrOpenTarget', 'extractPageText', oldFunction + '\nreturn search;')(app, path, discovery.resolveBrowserPath, discovery.resolveBrowserLabel, rules.resolveDebugPort, rules.buildSearchUrl, deps.log, deps.ensureBrowserSession, deps.clearManualCloseRequest, navigateOrOpenTarget, extractPageText);
  else {
    const module = { exports: {} };
    new Function('require', 'module', source)(id => {
      if (id === 'path') return path;
      if (id.endsWith('Discovery.cjs')) return discovery;
      if (id.endsWith('Rules.cjs')) return rules;
      if (id.endsWith('Navigation.cjs')) return { navigateOrOpenTarget };
      if (id.endsWith('PageText.cjs')) return { extractPageText };
      throw Error('Unexpected dependency ' + id);
    }, module);
    search = module.exports.createBrowserSearchExecution(deps);
    assert.notEqual(search, module.exports.createBrowserSearchExecution(deps));
  }
  let result, error;
  try { result = await search(query, settings); } catch (e) { assert.equal(e, failure); error = e.message; }
  if (queryMode === 'empty' || queryMode === 'zero') assert.equal(trace.length, 0, 'Empty query reads no settings or dependencies');
  if (result?.ok) assert.equal(result.text, 'original page text');
  if (blocked && !force && result && found && !['empty', 'zero'].includes(queryMode)) assert.ok(!trace.some(row => row[0] === 'navigate'));
  return { result, error, trace };
}
async function main() {
  const hash = crypto.createHash('sha256'); let cases = 0;
  for (const query of ['empty', 'zero', 'normal', 'long']) for (const found of [false, true]) for (const blocked of [false, true]) for (const force of [false, true])
    for (const target of ['normal', 'null', 'no-socket', 'blank', 'empty-url', 'empty-text'])
      for (const stage of ['normal', 'query', 'path', 'port', 'label', 'url', 'profile', 'log', 'first', 'second', 'clear', 'navigate', 'target', 'extract']) {
        const actual = await run(query, found, blocked, force, target, stage, false);
        if (oldFunction) assert.deepEqual(actual, await run(query, found, blocked, force, target, stage, true));
        hash.update(JSON.stringify(actual) + '\n'); cases++;
      }
  const fingerprint = hash.digest('hex');
  assert.equal(fingerprint, 'aee346109c6e2a81c761af8edcf295c8c5460ec31310285e7f4c6ecdb867ca14', 'Reviewed search results and dependency read order');
  console.log('Search execution passed: ' + cases + ' query/configuration/session/force/target/extraction/error/order cases');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
