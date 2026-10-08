const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const crypto = require('node:crypto');
const moduleFile = require.resolve('../electron/localProjectInspectorTerminal.cjs');
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
let originalTerminal;
if (baseline) {
  const tree = ts.createSourceFile(rootFile, baseline, ts.ScriptTarget.Latest, true);
  function find(n) {
    if (ts.isFunctionDeclaration(n) && n.name?.text === 'runTerminalCommand') originalTerminal = n.getText(tree);
    ts.forEachChild(n, find);
  }
  find(tree);
  assert.ok(originalTerminal);
  originalTerminal = "const path = require('path'); const { spawn } = require('child_process'); const { getSafeStat } = require('./localProjectInspectorReader.cjs');\n"
    + originalTerminal + '\nmodule.exports = { runTerminalCommand };';
}
async function run(platform, input, launch, original, integration) {
  const trace = [], cache = new Map();
  const cwd = input === 'relative' ? 'relative' : input === 'empty-cwd' ? '' : 'C:\\controlled\\project';
  const command = input === 'empty-command' ? '  ' : '  npm run dev & echo "中文"  ';
  const failure = Error('controlled launch failure');
  const action = { kind: 'terminal-command', risk: 'launch', label: 'run' };
  Object.defineProperties(action, {
    cwd: { enumerable: true, get() { trace.push(['cwd']); if (input === 'cwd-throw') throw failure; return '  ' + cwd + '  '; } },
    command: { enumerable: true, get() { trace.push(['command']); if (input === 'command-throw') throw failure; return command; } },
  });
  const clock = { now() { assert.equal(this, clock); trace.push(['clock']); return 123456; } };
  const io = { statSync(target) {
    trace.push(['stat', target]);
    if (input === 'missing-cwd') throw Error('missing');
    const stat = { isDirectory() { assert.equal(this, stat); trace.push(['isDirectory']); if (input === 'stat-method-throw') throw failure; return input !== 'file-cwd'; } };
    return stat;
  } };
  const processTools = { spawn(...args) {
    trace.push(['spawn', ...args]);
    if (launch === 'spawn-error') throw failure;
    if (launch === 'spawn-string') throw 'string failure';
    if (launch === 'spawn-null') throw null;
    const child = {
      unref() { assert.equal(this, child); trace.push(['unref']); if (launch === 'unref-error') throw failure; },
      get pid() { trace.push(['pid']); if (launch === 'pid-error') throw failure; return launch === 'missing-pid' ? undefined : launch === 'zero-pid' ? 0 : 4321; },
    };
    return child;
  } };
  function load(file) {
    if (path.basename(file) === 'ipcSenderGuard.cjs') return require(file);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const code = original && file === rootFile ? baseline : original && file === moduleFile ? originalTerminal : fs.readFileSync(file, 'utf8');
    new Function('require', 'module', 'process', 'Date', code)(id => {
      if (id.startsWith('./')) return load(path.resolve(path.dirname(file), id));
      if (id === 'path') return path.win32;
      if (id === 'fs') return io;
      if (id === 'child_process') return processTools;
      throw Error('Unexpected dependency ' + id);
    }, module, { platform }, clock);
    return module.exports;
  }
  let value, error;
  try {
    value = integration
      ? await load(rootFile).createLocalProjectInspectorService({ log: (...args) => trace.push(['log', ...args]) }).runLocalProjectAction({ inspection: { ok: true, rootPath: cwd, suggestedActions: [action] } })
      : load(moduleFile).runTerminalCommand(action, clock);
  } catch (e) { assert.equal(e, failure); error = e.message; }
  if (!integration) {
    assert.deepEqual(trace[0], ['clock']);
    if (platform !== 'win32') { assert.equal(value.error, 'Project command execution is currently only supported on Windows.'); assert.equal(trace.length, 1); }
    else if (['cwd-throw', 'command-throw', 'stat-method-throw'].includes(input)) assert.equal(error, failure.message);
    else if (['relative', 'empty-cwd', 'missing-cwd', 'file-cwd'].includes(input)) assert.equal(value.error, 'Invalid working directory.');
    else if (input === 'empty-command') assert.equal(value.error, 'Missing command.');
    else {
      assert.deepEqual(trace.find(row => row[0] === 'spawn'), ['spawn', 'cmd.exe', ['/d', '/s', '/k', command.trim()], { cwd, detached: true, stdio: 'ignore', windowsHide: false }]);
      assert.equal(value.ok, ['normal', 'missing-pid', 'zero-pid'].includes(launch));
      assert.equal(value.verification.confidence, value.ok ? 'started' : 'failed');
      if (value.ok) assert.equal(value.pid, launch === 'missing-pid' ? null : launch === 'zero-pid' ? 0 : 4321);
    }
    assert.equal(trace.some(row => row[0] === 'spawn'), platform === 'win32' && input === 'valid');
  }
  // Snapshot values rather than getter-bearing action objects.
  if (integration && value) value = { ...value, action: 'selected-action', inspection: 'provided-inspection' };
  return { value, error, trace };
}
async function main() {
  const outcomes = [];
  for (const integration of [false, true]) for (const platform of ['win32', 'linux'])
    for (const input of ['valid', 'relative', 'empty-cwd', 'missing-cwd', 'file-cwd', 'empty-command', 'cwd-throw', 'command-throw', 'stat-method-throw'])
      for (const launch of ['normal', 'missing-pid', 'zero-pid', 'spawn-error', 'spawn-string', 'spawn-null', 'unref-error', 'pid-error']) {
        const actual = await run(platform, input, launch, false, integration);
        if (baseline) assert.deepEqual(actual, await run(platform, input, launch, true, integration));
        outcomes.push(actual);
      }
  const hash = crypto.createHash('sha256').update(JSON.stringify(outcomes)).digest('hex');
  assert.equal(hash, 'ec11b26d7d6b93d567c69a84650a65c68407420cc76e463941f40fa681b28daf', 'Reviewed terminal results and actual-root call order remain unchanged');
  console.log('Terminal execution passed: ' + outcomes.length + ' validation/launch/exception/order/real-root cases; hash ' + hash);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
