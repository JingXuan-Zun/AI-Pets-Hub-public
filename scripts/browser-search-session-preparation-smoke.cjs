const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const crypto = require('node:crypto');
const path = require('node:path');
const file = require.resolve('../electron/browserSearchSessionPreparation.cjs');
const rootFile = require.resolve('../electron/browserSearchService.cjs');
const source = fs.readFileSync(file, 'utf8');
const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
assert.ok(source.split('\n').length <= 300);
function budgets(n) {
  if (ts.isFunctionLike(n) && n.body) assert.ok(tree.getLineAndCharacterOfPosition(n.end).line - tree.getLineAndCharacterOfPosition(n.getStart(tree)).line + 1 <= 50);
  ts.forEachChild(n, budgets);
}
budgets(tree);
let oldFunctions;
if (process.argv[2]) {
  const old = fs.readFileSync(process.argv[2], 'utf8');
  const t = ts.createSourceFile(rootFile, old, ts.ScriptTarget.Latest, true);
  const factory = t.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'createBrowserSearchService');
  oldFunctions = factory.body.statements.filter(n => ts.isFunctionDeclaration(n) && ['resolveBrowserSessionOptions', 'ensureControlBrowserSession'].includes(n.name.text)).map(n => n.getText(t)).join('\n');
  assert.ok(oldFunctions.includes('async function ensureControlBrowserSession'));
  function retained(text) {
    const t = ts.createSourceFile(rootFile, text, ts.ScriptTarget.Latest, true);
    const statements = t.statements.filter(n => !n.getText(t).includes("require('./browserSearchSessionPreparation.cjs')")).map(n => {
      if (!ts.isFunctionDeclaration(n) || n.name?.text !== 'createBrowserSearchService') return n;
      const body = ts.factory.updateBlock(n.body, n.body.statements.filter(n => {
        if (ts.isFunctionDeclaration(n)) return !['resolveBrowserSessionOptions', 'ensureControlBrowserSession'].includes(n.name?.text);
        return !(ts.isVariableStatement(n) && n.getText(t).includes('createBrowserSessionPreparation('));
      }));
      return ts.factory.updateFunctionDeclaration(n, n.modifiers, n.asteriskToken, n.name, n.typeParameters, n.parameters, n.type, body);
    });
    return ts.createPrinter().printFile(ts.factory.updateSourceFile(t, statements));
  }
  assert.equal(retained(fs.readFileSync(rootFile, 'utf8')), retained(old), 'Other root session/search/lifecycle statements unchanged');
}
async function run(browserPath, blocked, forceMode, stage, operation, original) {
  const trace = [], failure = Error('controlled preparation failure');
  const values = { browserSearchBrowserPath: browserPath, browserSearchDebugPort: 9229, browserSearchForceOpenBrowser: forceMode === 'settings' };
  const settings = {}, request = {};
  for (const [key, value] of Object.entries(values)) Object.defineProperty(settings, key, { enumerable: true, get() { trace.push(['settings', key]); return value; } });
  for (const [key, value] of Object.entries({ forceOpen: forceMode === 'request', forceOpenBrowser: forceMode === 'alternate' })) Object.defineProperty(request, key, { enumerable: true, get() { trace.push(['request', key]); return value; } });
  let cleared = false, attempts = 0, firstOptions;
  const sessionResult = {};
  Object.defineProperty(sessionResult, 'blockedByManualClose', { enumerable: true, get() { trace.push(['blocked']); return blocked; } });
  const state = {};
  Object.defineProperty(state, 'manualCloseRequested', { set(value) { assert.equal(value, false); trace.push(['clear']); if (stage === 'clear') throw failure; cleared = true; } });
  const app = { getPath(key) { assert.equal(this, app); trace.push(['getPath', key]); if (stage === 'profile') throw failure; return '/controlled-profile'; } };
  const discovery = {
    resolveBrowserPath(value) { trace.push(['path', value]); if (stage === 'path') throw failure; return value; },
    resolveBrowserLabel(value) { trace.push(['label', value]); if (stage === 'label') throw failure; return value ? 'Chrome' : null; },
  };
  const rules = { resolveDebugPort(value) { trace.push(['port', value]); if (stage === 'port') throw failure; return value; } };
  async function ensureBrowserSession(options) {
    trace.push(['ensure', ++attempts, options]);
    if (attempts === 1) firstOptions = options; else assert.equal(options, firstOptions, 'Forced reopen reuses options identity');
    if (stage === 'first' && attempts === 1 || stage === 'second' && attempts === 2) throw failure;
    return attempts === 1 ? sessionResult : { blockedByManualClose: false, launched: true };
  }
  let api;
  if (original) api = new Function('app', 'path', 'resolveBrowserPath', 'resolveBrowserLabel', 'resolveDebugPort', 'ensureBrowserSession', 'browserSessionState', oldFunctions + '\nreturn {resolveBrowserSessionOptions,ensureControlBrowserSession};')(app, path, discovery.resolveBrowserPath, discovery.resolveBrowserLabel, rules.resolveDebugPort, ensureBrowserSession, state);
  else {
    const module = { exports: {} };
    new Function('require', 'module', source)(id => {
      if (id === 'path') return path;
      if (id.endsWith('Discovery.cjs')) return discovery;
      if (id.endsWith('Rules.cjs')) return rules;
      throw Error('Unexpected dependency ' + id);
    }, module);
    const deps = { app, ensureBrowserSession, clearManualCloseRequest: () => { state.manualCloseRequested = false; } };
    api = module.exports.createBrowserSessionPreparation(deps);
    assert.notEqual(api.ensureControlBrowserSession, module.exports.createBrowserSessionPreparation(deps).ensureControlBrowserSession);
  }
  let result, error;
  try { result = operation === 'resolve' ? api.resolveBrowserSessionOptions(settings) : await api.ensureControlBrowserSession(settings, request); }
  catch (e) { assert.equal(e, failure); error = e.message; }
  if (operation === 'ensure' && result?.ok) {
    assert.equal(result.sessionResult, sessionResult, 'Successful response keeps first session result');
    assert.equal(attempts, blocked && forceMode !== 'none' ? 2 : 1);
  }
  if (operation === 'ensure' && !browserPath && !error) { assert.equal(result.ok, false); assert.equal(attempts, 0); }
  if (operation === 'ensure' && blocked && forceMode === 'none' && result && browserPath) { assert.equal(result.blockedByManualClose, true); assert.equal(cleared, false); }
  // Snapshot accessor traces before comparison so assertions cannot add reads.
  return JSON.parse(JSON.stringify({ result, error, trace, attempts, cleared }));
}
async function main() {
  const hash = crypto.createHash('sha256'); let cases = 0;
  for (const browserPath of ['', '/controlled/chrome.exe']) for (const blocked of [false, true])
    for (const force of ['none', 'settings', 'request', 'alternate']) for (const stage of ['normal', 'path', 'port', 'label', 'profile', 'first', 'second', 'clear'])
      for (const operation of ['resolve', 'ensure']) {
        const actual = await run(browserPath, blocked, force, stage, operation, false);
        if (oldFunctions) assert.deepEqual(actual, await run(browserPath, blocked, force, stage, operation, true));
        hash.update(JSON.stringify(actual) + '\n'); cases++;
      }
  const fingerprint = hash.digest('hex');
  assert.equal(fingerprint, '958d89a982dc78a6763740f987b14ad91a5f21399642f7bf3afcc581924e2c1a', 'Reviewed session preparation behavior and read order');
  console.log('Session preparation passed: ' + cases + ' configuration/force/reopen/error/order cases');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
