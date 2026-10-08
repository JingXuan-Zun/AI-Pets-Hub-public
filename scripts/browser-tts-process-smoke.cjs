const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const ts = require('typescript');
const rules = require('../electron/browserTtsRules.cjs');
const { createLineReporter } = require('../electron/localVoiceRuntimeCommandUtils.cjs');
const source = fs.readFileSync(require.resolve('../electron/browserTtsProcess.cjs'), 'utf8');
const old = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const tree = text => ts.createSourceFile('tts.cjs', text, 99, true);
const factory = text => tree(text).statements.find(n => n.name?.text === 'createBrowserTtsService');
const assignment = fn => fn.body.statements.find(n => ts.isExpressionStatement(n) && n.expression.left?.getText() === 'startPromise');
const oldEnsure = old && factory(old).body.statements.find(n => n.name?.text === 'ensureStarted');
const oldArrow = old && assignment(oldEnsure).expression.right.expression.expression;
const printer = ts.createPrinter();
const canonical = n => printer.printNode(ts.EmitHint.Unspecified, n, n.getSourceFile());
if (old) {
  const processTree = tree(source);
  const fn = processTree.statements.find(n => n.name?.text === 'startBrowserTtsProcess');
  assert.deepEqual(fn.body.statements.slice(1).map(n => canonical(n).replace(/state\.(childBaseUrl|child)/g, '$1')), oldArrow.body.statements.map(canonical));
  const current = fs.readFileSync(require.resolve('../electron/browserTtsService.cjs'), 'utf8');
  const currentEnsure = factory(current).body.statements.find(n => n.name?.text === 'ensureStarted');
  const normalize = fn => fn.body.statements.map(n => n === assignment(fn) ? 'START_OPERATION;' : canonical(n)).join('\n');
  assert.equal(normalize(currentEnsure), normalize(oldEnsure), 'Root startup gate and finally remain unchanged');
  const stop = processTree.statements.find(n => n.name?.text === 'stopBrowserTtsProcess');
  const oldStop = factory(old).body.statements.find(n => n.name?.text === 'dispose');
  assert.deepEqual(stop.body.statements.slice(1).map(n => canonical(n).replace(/state\.(childBaseUrl|child)/g, '$1')), oldStop.body.statements.map(canonical));
  const retained = text => factory(text).body.statements.filter(n => !['child', 'childBaseUrl', 'ensureStarted', 'dispose'].includes(n.name?.text || n.declarationList?.declarations[0]?.name?.text) && !n.getText().includes('createBrowserTtsProcess(')).map(canonical);
  assert.deepEqual(retained(current), retained(old));
}
async function run(baseline, present, url, failure, action) {
  const trace = [], children = [], settings = { marker: 'settings' };
  function call(name, args) { trace.push([name, ...args]); if (failure === name) throw new Error(name + ' failure'); }
  const deps = {
    ...rules, runtimeRoot: 'runtime', createLineReporter,
    getCandidate(value) { assert.equal(value, settings); call('candidate', []); return present ? { executable: 'fixture-python', args: ['-3'] } : null; },
    ensureServerScript() { call('script', []); return 'server.py'; },
    getSharedEnv() { call('env', []); return { FIXTURE: 'yes' }; },
    writeLog(...args) { call('log', args); },
    async waitUntilReady(value) { call('ready', [value.toString()]); },
    buildJsonError(error) { return { message: error.message }; },
    terminateChildProcess(child) { call('terminate', [child.id]); },
    spawn(command, args, options) {
      call('spawn', [command, args, options]);
      const child = new EventEmitter(); child.id = children.length + 1;
      child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.exitCode = null; child.signalCode = null;
      children.push(child); return child;
    },
  };
  let api;
  if (baseline) {
    const dispose = factory(old).body.statements.find(n => n.name?.text === 'dispose').getText();
    const body = 'let child = null; let childBaseUrl = null;\nasync function startProcess(baseUrl, settings) ' + oldArrow.body.getText() + '\n' + dispose + '\nreturn { startProcess, dispose };';
    api = new Function(...Object.keys(deps), body)(...Object.values(deps));
  } else {
    const module = { exports: {} };
    new Function('require', 'module', source)(id => id === 'child_process' ? { spawn: deps.spawn } : id.endsWith('Rules.cjs') ? rules : id.endsWith('CommandUtils.cjs') ? { createLineReporter } : { buildJsonError: deps.buildJsonError, terminateChildProcess: deps.terminateChildProcess }, module);
    api = module.exports.createBrowserTtsProcess(deps);
  }
  assert.deepEqual(trace, [], 'Assembly performs no spawn or termination');
  let result, error, actionError;
  try { result = await api.startProcess(new URL(url), settings); } catch (e) { error = e.message; }
  try {
    const first = children[0];
    if (first) {
      first.stdout.emit('data', Buffer.from('中文\npartial'));
      first.stderr.emit('data', Buffer.from('diagnostic\n'));
      if (action === 'error') first.emit('error', new Error('fixture process error'));
      if (action === 'matching-close' || action === 'mismatching-close') {
        first.exitCode = 0; first.signalCode = null;
        first.emit('close', action === 'matching-close' ? 0 : 1, null);
      }
      if (action === 'restart') {
        await api.startProcess(new URL('http://fixture:9882'), settings);
        first.exitCode = 1; first.signalCode = null;
        first.emit('close', 1, null);
      }
    }
    api.dispose();
    if (action === 'double-dispose') api.dispose();
  } catch (e) { actionError = e.message; }
  return { result, error, actionError, trace };
}
async function main() {
  const hash = crypto.createHash('sha256'); let cases = 0;
  for (const present of [false, true]) for (const url of ['http://127.0.0.1:9880', 'https://fixture', 'http://[::1]:9881'])
  for (const failure of ['none', 'candidate', 'script', 'env', 'spawn', 'ready', 'log', 'terminate'])
  for (const action of ['dispose', 'double-dispose', 'matching-close', 'mismatching-close', 'error', 'restart']) {
    const actual = await run(false, present, url, failure, action);
    if (old) assert.deepEqual(actual, await run(true, present, url, failure, action));
    hash.update(JSON.stringify(actual)); cases++;
  }
  const sample = action => run(false, true, 'http://fixture:9880', 'none', action);
  assert.equal((await sample('double-dispose')).trace.filter(row => row[0] === 'terminate').length, 1);
  assert.equal((await sample('matching-close')).trace.filter(row => row[0] === 'terminate').length, 0);
  assert.equal((await sample('mismatching-close')).trace.filter(row => row[0] === 'terminate').length, 1);
  const restart = await sample('restart');
  assert.deepEqual(restart.trace.filter(row => row[0] === 'terminate').map(row => row[1]), [2], 'Old mismatching close preserves current process');
  assert.ok(restart.trace.some(row => row[1] === 'Browser TTS stdout: partial'), 'Close flushes pending output');
  const failed = await run(false, true, 'http://fixture:9880', 'ready', 'dispose');
  assert.equal(failed.error, 'ready failure');
  assert.equal(failed.trace.filter(row => row[0] === 'terminate').length, 1, 'Failed readiness retains child for dispose');
  const digest = hash.digest('hex');
  if (!old) assert.equal(digest, '9f0e005872551f719ee4e4141281bca2a074110e3cbbad7d149ec3d975ec9bdf');
  console.log(`Browser TTS process passed: ${cases} cases; ${digest}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
