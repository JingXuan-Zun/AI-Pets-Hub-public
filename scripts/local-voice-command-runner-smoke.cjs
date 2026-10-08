const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const ts = require('typescript');
const commandUtils = require('../electron/localVoiceRuntimeCommandUtils.cjs');
const processUtils = require('../electron/localVoiceRuntimeProcessUtils.cjs');
const { createLocalVoiceCommandRunner } = require('../electron/localVoiceRuntimeCommandRunner.cjs');

function loadBaseline(file, dependencies) {
  const source = fs.readFileSync(file, 'utf8');
  const start = source.indexOf('function spawnCommand(');
  const end = source.indexOf('function createLocalVoiceRuntime(', start);
  assert.ok(start >= 0 && end > start);
  return new Function(...Object.keys(dependencies),
    `${source.slice(start, end)}; return { spawnCommand, runInlinePythonScript };`,
  )(...Object.values(dependencies));
}

function createHarness(platform, mode, baseline) {
  const trace = [];
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  const listeners = new Set();
  const signal = {
    aborted: mode === 'pre-abort',
    addEventListener(name, listener, options) {
      trace.push(['add', name, options]);
      listeners.add(listener);
    },
    removeEventListener(name, listener) {
      trace.push(['remove', name]);
      listeners.delete(listener);
    },
  };
  const spawnProcess = (command, args, options) => {
    trace.push(['spawn', command, args, options]);
    if (mode === 'spawn-throw') throw new Error('spawn_failure');
    return child;
  };
  const terminate = () => trace.push(['terminate']);
  const executeTemporaryScript = async ({ cwd, execute, scriptContent }) => {
    trace.push(['write', cwd, scriptContent]);
    try { return await execute('temporary-probe.py'); }
    finally { trace.push(['unlink']); }
  };
  const runner = baseline ? loadBaseline(baseline, {
    ...commandUtils, ...processUtils,
    spawn: spawnProcess, process: { platform },
    terminateChildProcess: terminate, withTemporaryPythonScript: executeTemporaryScript,
  }) : createLocalVoiceCommandRunner({ platform, spawnProcess, terminate, executeTemporaryScript });
  const abort = () => {
    signal.aborted = true;
    for (const listener of [...listeners]) listener();
  };
  return { runner, child, trace, signal, listeners, abort };
}

async function runScenario(platform, mode, chunks, inline, baseline) {
  const harness = createHarness(platform, mode, baseline);
  const { runner, child, trace, signal, listeners, abort } = harness;
  const options = {
    cwd: 'voice-cwd', env: { VOICE_TEST: '1' },
    onStdoutLine: (line) => trace.push(['stdout', line]),
    onStderrLine: (line) => trace.push(['stderr', line]),
  };
  let signalReads = 0;
  Object.defineProperty(options, 'signal', { get() { signalReads++; return signal; } });
  const candidate = { executable: 'python custom.exe', args: ['-u'] };
  const pending = inline
    ? runner.runInlinePythonScript(candidate, 'print("probe")', options)
    : runner.spawnCommand(candidate, ['-c', 'print("probe")'], options);
  for (const text of chunks) {
    child.stdout.emit('data', Buffer.from(text));
    child.stderr.emit('data', Buffer.from(`err:${text}`));
  }
  if (mode === 'cancel') abort();
  else if (mode === 'error' || mode === 'error-close') child.emit('error', new Error('child_failure'));
  else if (mode !== 'pre-abort' && mode !== 'spawn-throw') {
    child.emit('close', mode === 'close-one' ? 1 : mode === 'close-null' ? null : 0);
  }
  if (mode !== 'spawn-throw') {
    child.emit('close', 9);
    if (mode !== 'error' && mode !== 'error-close') child.emit('error', new Error('late_error'));
    abort();
    child.stdout.emit('data', Buffer.from('late\n'));
  }
  const result = await pending;
  assert.equal(listeners.size, 0);
  assert.equal(signalReads, mode === 'spawn-throw' ? 0 : 1);
  assert.equal(trace.filter(([event]) => event === 'terminate').length,
    mode === 'cancel' || mode === 'pre-abort' ? 1 : 0);
  assert.equal(result.canceled === true, mode === 'cancel' || mode === 'pre-abort');
  assert.equal(result.ok, mode === 'close-zero' || mode === 'close-abort');
  assert.equal(result.exitCode, result.ok ? 0 : mode === 'close-one' ? 1 : null);
  if (mode === 'spawn-throw' || mode === 'pre-abort') assert.equal(result.stdout, '');
  else assert.equal(result.stdout, chunks.join(''));
  if (inline) assert.equal(trace.at(-1)[0], 'unlink');
  if (mode === 'cancel') {
    assert.ok(trace.findIndex(([event]) => event === 'remove')
      < trace.findIndex(([event]) => event === 'terminate'));
  }
  return { trace, result: {
    ...result, error: result.error ? { name: result.error.name, message: result.error.message } : null,
  } };
}

function checkStructure() {
  const file = path.join(__dirname, '../electron/localVoiceRuntimeCommandRunner.cjs');
  const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  assert.ok(text.split('\n').length <= 300);
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function visit(node) {
    if (ts.isFunctionLike(node) && node.body) {
      assert.ok(node.getText(source).split('\n').length <= 50,
        `function exceeds 50 lines at ${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  const root = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntime.cjs'), 'utf8');
  assert.match(root, /require\('\.\/localVoiceRuntimeCommandRunner\.cjs'\)/u);
  assert.match(root, /const \{ spawnCommand, runInlinePythonScript \} = createLocalVoiceCommandRunner\(\);/u);
  assert.doesNotMatch(root, /function spawnCommand\(/u);
}

async function runWithoutSignal(platform, mode, baseline) {
  const { runner, child, trace } = createHarness(platform, mode, baseline);
  const candidate = mode === 'invalid-candidate' ? {} : { executable: 'python', args: [] };
  const pending = runner.spawnCommand(candidate, []);
  if (mode !== 'invalid-candidate' && mode !== 'spawn-throw') {
    child.stdout.emit('data', Buffer.from('plain output'));
    child.stderr.emit('data', Buffer.from('warning'));
    if (mode === 'error') child.emit('error', new Error('child_failure'));
    else child.emit('close', mode === 'close-one' ? 1 : mode === 'close-null' ? null : 0);
  }
  const result = await pending;
  assert.equal(result.ok, mode === 'close-zero');
  assert.equal(trace.some(([event]) => ['add', 'remove', 'terminate'].includes(event)), false);
  assert.equal(result.stdout, ['invalid-candidate', 'spawn-throw'].includes(mode) ? '' : 'plain output');
  return { trace, result: {
    ...result, error: result.error ? { name: result.error.name, message: result.error.message } : null,
  } };
}

async function main() {
  checkStructure();
  let count = 0;
  for (const platform of ['win32', 'linux']) {
    for (const mode of ['close-zero', 'close-one', 'close-null', 'error', 'spawn-throw', 'invalid-candidate']) {
      const actual = await runWithoutSignal(platform, mode);
      if (process.argv[2]) assert.deepEqual(actual, await runWithoutSignal(platform, mode, process.argv[2]));
      count++;
    }
    for (const mode of ['close-zero', 'close-one', 'close-null', 'error', 'cancel',
      'pre-abort', 'spawn-throw', 'close-abort', 'error-close']) {
      for (const chunks of [[], ['tail'], ['first\r\n', '中文', '\nlast'], ['\n', ' ', '\n'], ['a', 'b\n', 'c']]) {
        for (const inline of [false, true]) {
          const actual = await runScenario(platform, mode, chunks, inline);
          if (process.argv[2]) assert.deepEqual(actual,
            await runScenario(platform, mode, chunks, inline, process.argv[2]));
          count++;
        }
      }
    }
  }
  console.log(`local voice command runner: ${count} scenarios passed${process.argv[2] ? ' against baseline' : ''}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
