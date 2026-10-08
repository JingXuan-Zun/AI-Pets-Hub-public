const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const crypto = require('node:crypto');
const file = require.resolve('../electron/browserSearchRules.cjs');
const rootFile = require.resolve('../electron/browserSearchService.cjs');
const source = fs.readFileSync(file, 'utf8');
const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
const names = ['resolveDebugPort', 'resolveDefaultSearchUrlTemplate', 'shouldPreferChineseSearch', 'resolveBrowserSearchUrlTemplate', 'buildSearchUrl', 'normalizeBrowserUrl', 'normalizeBrowserControlAction'];
const constants = ['CHROME_SEARCH_URL_TEMPLATE', 'EDGE_SEARCH_URL_TEMPLATE', 'SEARCH_URL_TEMPLATES', 'DEFAULT_DEBUG_PORT'];
assert.ok(source.split('\n').length <= 300);
function budgets(n) {
  if (ts.isFunctionLike(n) && n.body) assert.ok(tree.getLineAndCharacterOfPosition(n.end).line - tree.getLineAndCharacterOfPosition(n.getStart(tree)).line + 1 <= 50);
  ts.forEachChild(n, budgets);
}
budgets(tree);
let oldSource;
if (process.argv[2]) {
  const baseline = fs.readFileSync(process.argv[2], 'utf8');
  const tree = ts.createSourceFile(rootFile, baseline, ts.ScriptTarget.Latest, true);
  const selected = n => ts.isFunctionDeclaration(n) && names.includes(n.name.text)
    || ts.isVariableStatement(n) && n.declarationList.declarations.some(d => constants.includes(d.name.getText(tree)));
  oldSource = tree.statements.filter(selected).map(n => n.getText(tree)).join('\n') + '\nmodule.exports = { ' + names.join(',') + ' };';
  const printer = ts.createPrinter();
  const oldRetained = tree.statements.filter(n => !selected(n)).map(n => printer.printNode(ts.EmitHint.Unspecified, n, tree)).join('\n');
  const current = ts.createSourceFile(rootFile, fs.readFileSync(rootFile, 'utf8'), ts.ScriptTarget.Latest, true);
  const newRetained = current.statements.filter(n => !n.getText(current).includes("require('./browserSearchRules.cjs')")).map(n => printer.printNode(ts.EmitHint.Unspecified, n, current)).join('\n');
  assert.equal(newRetained, oldRetained, 'Browser discovery, DevTools, extraction and lifecycle statements remain unchanged');
}
const outcomes = [];
function load(code, locale, language) {
  const trace = [];
  const env = {};
  for (const key of ['LANG', 'LANGUAGE', 'LC_ALL', 'LC_MESSAGES']) Object.defineProperty(env, key, { get() { trace.push(key); return language; } });
  const module = { exports: {} };
  new Function('module', 'process', 'Intl', code)(module, { env }, { DateTimeFormat() { trace.push('locale'); return { resolvedOptions: () => ({ locale }) }; } });
  return { api: module.exports, trace };
}
function compare(name, args, locale = 'en-US', language = undefined) {
  function run(code) {
    const { api, trace } = load(code, locale, language);
    let value, error;
    try { value = api[name](...args); } catch (e) { error = [e.name, e.message]; }
    return { name, value, error, trace };
  }
  const actual = run(source);
  if (oldSource) assert.deepEqual(actual, run(oldSource));
  outcomes.push(actual);
  return actual;
}
for (const value of [undefined, null, '', false, 0, -1, 1023, 1024, 9223.5, 65535, 65536, Infinity, NaN, '1234', 'invalid', { valueOf: () => 1234 }]) compare('resolveDebugPort', [value]);
assert.equal(compare('resolveDebugPort', ['invalid']).value, 9223);
assert.equal(compare('resolveDebugPort', [0]).value, 1024);
for (const browser of ['Chrome', 'Edge', 'chrome', '', null, undefined]) compare('resolveDefaultSearchUrlTemplate', [browser]);
for (const locale of ['en-US', 'zh-CN', 'zh_TW', 'ZH-hans', 'fr-FR', 'chinese', 'cn', 'azhan'])
  for (const language of [undefined, '', 'en_US', 'zh-CN', 'china', 'x cn', 'french']) {
    compare('shouldPreferChineseSearch', [], locale, language);
    for (const browser of ['Chrome', 'Edge']) for (const engine of [undefined, 'auto', ' baidu ', 'BING', 'google', 'sogou', 'custom', 'unknown', 'constructor']) {
      const settings = { browserSearchEngine: engine, browserSearchUrlTemplate: 'https://example.org/?query={query}' };
      compare('resolveBrowserSearchUrlTemplate', [settings, browser], locale, language);
      compare('buildSearchUrl', ['中文 a&b', settings, browser], locale, language);
    }
  }
for (const template of ['', 'invalid', 'https://example.org/path?q=old#hash', 'https://example.org/{query}/{query}', '  https://example.org/  ', null, 42])
  for (const query of ['', 'a b', '中文', 'a&b/#', '\ud800']) compare('buildSearchUrl', [query, { browserSearchEngine: 'custom', browserSearchUrlTemplate: template }, 'Chrome']);
assert.equal(compare('buildSearchUrl', ['a b', { browserSearchEngine: 'custom', browserSearchUrlTemplate: 'https://example.org/{query}/{query}' }, 'Chrome']).value, 'https://example.org/a%20b/a%20b');
for (const target of [undefined, null, '', ' example.org/path ', 'localhost', 'https://example.org', 'HTTP://example.org', 'mailto:a@example.org', 'file:///tmp/a', 'javascript:alert(1)', 'data:text/plain,x', 'two words.org', 42, { toString: () => 'example.org' }]) compare('normalizeBrowserUrl', [target]);
assert.equal(compare('normalizeBrowserUrl', ['javascript:alert(1)']).value, '');
for (const action of ['open', 'open_url', 'navigate', 'navigate_url', 'search', 'search_web', 'read', 'read_page', 'extract_page', 'get_page_text', 'focus', 'focus_tab', 'activate_tab', 'list', 'list_tabs', 'tabs', 'status', 'session_status', '', 'unknown'])
  for (const value of [action, ' ' + action.toUpperCase() + ' ', action.replaceAll('_', '-'), action.replaceAll('_', ' ')]) compare('normalizeBrowserControlAction', [value]);
for (const value of [null, undefined, 42, { toString() { throw Error('conversion failure'); } }]) {
  compare('normalizeBrowserControlAction', [value]); compare('normalizeBrowserUrl', [value]);
}
const api = require('../electron/browserSearchService.cjs');
assert.deepEqual(Object.keys(api), ['createBrowserSearchService', 'extractTextFromDocumentLike', 'getDetectedBrowserCandidates']);
const first = api.createBrowserSearchService({ app: {}, log() {} }), second = api.createBrowserSearchService({ app: {}, log() {} });
assert.notEqual(first.search, second.search);
assert.deepEqual(first.getSessionState(), second.getSessionState());
const hash = crypto.createHash('sha256').update(JSON.stringify(outcomes)).digest('hex');
assert.equal(hash, 'fb9804075bd97c1261dc8846d70445c9523bfdb8ec6b2d64bd9a19bab2ff608b', 'Reviewed browser search rules remain unchanged');
console.log('Browser search rules passed: ' + outcomes.length + ' port/locale/engine/template/encoding/url/action/error cases; hash ' + hash);
