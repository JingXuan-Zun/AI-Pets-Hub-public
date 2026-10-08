const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const crypto = require('node:crypto');
const moduleFile = require.resolve('../electron/localProjectInspectorOpenUrl.cjs');
const rootFile = require.resolve('../electron/localProjectInspectorService.cjs');
const source = fs.readFileSync(moduleFile, 'utf8');
const tree = ts.createSourceFile(moduleFile, source, ts.ScriptTarget.Latest, true);
assert.ok(source.split('\n').length <= 300);
function budgets(n) {
  if (ts.isFunctionLike(n) && n.body) assert.ok(tree.getLineAndCharacterOfPosition(n.end).line - tree.getLineAndCharacterOfPosition(n.getStart(tree)).line + 1 <= 50);
  ts.forEachChild(n, budgets);
}
budgets(tree);
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
let oldImplementation;
if (baseline) {
  const tree = ts.createSourceFile(rootFile, baseline, ts.ScriptTarget.Latest, true);
  function find(n) {
    if (ts.isFunctionDeclaration(n) && n.name?.text === 'openUrlAction') oldImplementation = n.getText(tree);
    ts.forEachChild(n, find);
  }
  find(tree);
  assert.ok(oldImplementation);
  oldImplementation = "const { isSafeExternalUrl } = require('./ipcSenderGuard.cjs');\n" + oldImplementation + '\nmodule.exports = { openUrlAction };';
}
async function run(input, shellMode, outcome, original, integration) {
  const trace = [], cache = new Map(), failure = Error('controlled failure');
  const errorObject = { code: 'open-failure' };
  const action = { kind: 'open-url', risk: 'launch', label: 'open' };
  const urls = { https: 'https://example.org/路径?q=x', http: 'http://127.0.0.1:3000/', mailto: 'mailto:user@example.org', uppercase: 'HTTPS://example.org', javascript: 'javascript:alert(1)', file: 'file:///C:/demo.exe', data: 'data:text/plain,test', invalid: 'relative/url', number: 42 };
  const target = input === 'object' || input === 'throw' ? urls.https : urls[input];
  const value = input === 'empty' ? '   ' : input === 'null' ? null : input === 'object' ? { toString() { trace.push(['convert']); return '  ' + target + '  '; } } : target;
  Object.defineProperty(action, 'command', { get() { trace.push(['command']); if (input === 'throw') throw failure; return value; } });
  const clock = { now() { assert.equal(this, clock); trace.push(['clock']); return 123456; } };
  let shell = shellMode === 'null' ? null : {};
  let accesses = 0;
  if (shell) Object.defineProperty(shell, 'openExternal', { get() {
    accesses++;
    trace.push(['openExternal-get', accesses]);
    if (shellMode === 'getter-throw' || shellMode === 'second-getter-throw' && accesses === 2) throw failure;
    if (shellMode === 'non-function') return 'unavailable';
    return function (path) {
      assert.equal(this, shell);
      assert.equal(path, target);
      trace.push(['openExternal-call', path]);
      if (shellMode === 'sync-throw') throw failure;
      if (shellMode === 'reject') return Promise.reject(failure);
      const result = outcome === 'empty' ? '' : outcome === 'undefined' ? undefined : outcome === 'null' ? null : outcome === 'zero' ? 0 : outcome === 'false' ? false : outcome === 'string-error' ? 'open error' : outcome === 'object-error' ? errorObject : '';
      if (outcome === 'reject-string') return Promise.reject('rejected string');
      if (outcome === 'reject-null') return Promise.reject(null);
      if (outcome === 'delayed') return new Promise(resolve => queueMicrotask(() => { trace.push(['settled']); resolve(''); }));
      return result;
    };
  } });
  function load(file) {
    if (path.basename(file) === 'ipcSenderGuard.cjs') return require(file);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const code = original && file === rootFile ? baseline : original && file === moduleFile ? oldImplementation : fs.readFileSync(file, 'utf8');
    new Function('require', 'module', 'process', 'Date', code)(id => {
      if (id.startsWith('./')) return load(path.resolve(path.dirname(file), id));
      if (id === 'path') return path.win32;
      if (id === 'fs') return { statSync() { throw Error('Unexpected filesystem access'); } };
      if (id === 'child_process') return { spawn() { throw Error('Unexpected process launch'); } };
      throw Error('Unexpected dependency ' + id);
    }, module, { platform: 'win32' }, clock);
    return module.exports;
  }
  let result, error;
  try {
    result = integration
      ? await load(rootFile).createLocalProjectInspectorService({ log: (message, details) => {
        assert.equal(details.command, value);
        trace.push(['log', message, { ...details, command: input === 'object' ? 'original-command-object' : details.command }]);
      } }).runLocalProjectAction({ inspection: { ok: true, rootPath: 'C:\\项目', suggestedActions: [action] }, shell })
      : await load(moduleFile).openUrlAction(action, shell, clock);
  } catch (e) { assert.equal(e, failure); error = e.message; }
  if (!integration) {
    assert.deepEqual(trace[0], ['clock']);
    const allowed = ['https', 'http', 'mailto', 'uppercase', 'object'].includes(input);
    if (input === 'throw' || allowed && shellMode === 'getter-throw') assert.equal(error, failure.message);
    else if (['empty', 'null'].includes(input)) { assert.equal(result.error, 'Missing URL.'); assert.equal(accesses, 0); }
    else if (!allowed) { assert.equal(result.error, 'Only http, https and mailto links can be opened.'); assert.equal(accesses, 0); }
    else if (['null', 'non-function'].includes(shellMode)) assert.equal(result.error, 'Electron shell.openExternal is unavailable.');
    else {
      assert.equal(accesses, 2);
      const exception = ['second-getter-throw', 'sync-throw', 'reject'].includes(shellMode) || ['reject-string', 'reject-null'].includes(outcome);
      assert.equal(result.ok, !exception);
      assert.equal(result.verification.reason, exception ? 'shell-open-url-exception' : 'shell-open-url-accepted');
      assert.equal(result.verification.confidence, exception ? 'failed' : 'request-accepted');
      if (outcome === 'delayed' && shellMode === 'method') assert.ok(trace.some(row => row[0] === 'settled'));
    }
  }
  if (integration && result) result = { ...result, action: 'selected-action', inspection: 'provided-inspection' };
  return { result, error, trace };
}
async function main() {
  const outcomes = [];
  for (const integration of [false, true]) for (const input of ['empty', 'null', 'number', 'object', 'https', 'http', 'mailto', 'uppercase', 'javascript', 'file', 'data', 'invalid', 'throw'])
    for (const shell of ['null', 'non-function', 'method', 'getter-throw', 'second-getter-throw', 'sync-throw', 'reject'])
      for (const outcome of ['empty', 'undefined', 'null', 'zero', 'false', 'string-error', 'object-error', 'reject-string', 'reject-null', 'delayed']) {
        const actual = await run(input, shell, outcome, false, integration);
        if (baseline) assert.deepEqual(actual, await run(input, shell, outcome, true, integration));
        outcomes.push(actual);
      }
  const hash = crypto.createHash('sha256').update(JSON.stringify(outcomes)).digest('hex');
  assert.equal(hash, 'd435f2e3415dee906cb230409d6540a22c03cba7203800701189ebff32f01ce1', 'Reviewed URL opening results and call order remain unchanged');
  console.log('URL opening passed: ' + outcomes.length + ' conversion/shell/return/rejection/timing/real-root cases; hash ' + hash);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
