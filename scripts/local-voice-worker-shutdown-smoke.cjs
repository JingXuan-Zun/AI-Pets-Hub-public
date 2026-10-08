const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sessionSource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntimeSessionAssembly.cjs'), 'utf8');
const ts = require('typescript');
const backendSource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntimeBackendAssembly.cjs'), 'utf8');
const { createLocalVoiceWorkerShutdown } = require('../electron/localVoiceRuntimeWorkerShutdown.cjs');
const { getWorkerForceTerminateDelayMs, isChildProcessRunning } = require('../electron/localVoiceRuntimeProcessUtils.cjs');
const rootPath = path.join(__dirname, '../electron/localVoiceRuntime.cjs');
const rootSource = fs.readFileSync(rootPath, 'utf8');
const stateSource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntimeState.cjs'), 'utf8');
const assemblySource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntimeWorkerAssembly.cjs'), 'utf8');

function loadBaseline(file) {
  const text = fs.readFileSync(file, 'utf8');
  const start = text.indexOf('  function destroyModeWorker(');
  const end = text.indexOf('  function createModeWorker(', start);
  assert.ok(start >= 0 && end > start);
  return new Function('modeWorkerPool', 'createWorkerUnavailableError', 'getModeLabel',
    'writeRuntimeLog', 'getWorkerForceTerminateDelayMs', 'isChildProcessRunning',
    'terminateChildProcess', 'setTimeout', `${text.slice(start, end)}; return destroyModeWorker;`);
}

function runScenario(config, baseline) {
  const { mode, reason, poolState, inputState, processState, unref, custom, fault } = config;
  const trace = [];
  const timers = [];
  const pool = new Map();
  const child = { pid: 1, exitCode: processState === 'exited' ? 0 : null, signalCode: null };
  const entry = { key: 'same-key', mode, modelPath: 'model', process: child,
    pending: new Map(), destroyed: false, shutdownReason: 'running' };
  const newer = { key: entry.key, marker: 'newer' };
  if (poolState !== 'absent') pool.set(entry.key, poolState === 'same' ? entry : newer);
  const fail = (stage) => { if (fault === stage) throw new Error(`${stage}_failure`); };
  if (inputState !== 'missing') child.stdin = {
    destroyed: inputState === 'destroyed',
    end() {
      trace.push(['end']);
      if (processState === 'exit-on-end') child.exitCode = 0;
      if (inputState === 'throws') throw new Error('stdin_failure');
    },
  };
  let customUses = 0;
  const customError = new Error('custom_failure');
  const pendingErrorIds = [];
  for (let i = 0; i < 2; i++) {
    entry.pending.set(i, {
      ...(i === 0 ? { abortCleanup() {
        trace.push(['cleanup', i, entry.pending.size, pool.get(entry.key) === entry]);
        fail('cleanup');
      } } : {}),
      reject(error) {
        trace.push(['reject', i, error.name, error.message, entry.pending.size]);
        if (error === customError) customUses++;
        pendingErrorIds.push(error);
        fail('reject');
      },
    });
  }
  const createError = (label, workerMode, workerReason) => {
    trace.push(['error', workerMode, workerReason]);
    fail('error');
    return new Error(`${label(workerMode)} worker unavailable: ${workerReason}`);
  };
  const getModeLabel = (workerMode) => workerMode.toUpperCase();
  const writeRuntimeLog = (message, details) => {
    trace.push(['log', message, details]);
    fail(message.includes('fallback') ? 'fallback-log' : 'shutdown-log');
  };
  const terminate = (process) => {
    assert.equal(process, child);
    trace.push(['terminate']);
    fail('terminate');
  };
  const setTimer = (callback, delay) => {
    trace.push(['timer', delay]);
    fail('timer');
    timers.push(callback);
    return unref ? { unref() { trace.push(['unref']); fail('unref'); } } : {};
  };
  const getDelay = (workerReason) => {
    trace.push(['delay', workerReason]);
    fail('delay');
    return getWorkerForceTerminateDelayMs(workerReason);
  };
  const destroy = baseline
    ? baseline(pool, createError, getModeLabel, writeRuntimeLog, getDelay, isChildProcessRunning, terminate, setTimer)
    : createLocalVoiceWorkerShutdown({ modeWorkerPool: pool, createWorkerUnavailableError: createError,
      getModeLabel, writeRuntimeLog, getDelay, isRunning: isChildProcessRunning, terminate, setTimer }).destroyModeWorker;
  let thrown = null;
  try { destroy(entry, reason, custom ? customError : null); }
  catch (error) { thrown = error.message; }
  const firstTraceLength = trace.length;
  destroy(entry, reason, customError);
  destroy(null);
  destroy(undefined);
  assert.equal(trace.length, firstTraceLength, 'repeat/absent destruction must be inert');
  assert.equal(entry.destroyed, true);
  assert.equal(entry.pending.size, 0);
  assert.equal(pool.get(entry.key), poolState === 'replacement' ? newer : undefined);
  assert.equal(entry.shutdownReason, reason === undefined ? 'dispose' : reason);
  if (processState === 'exit-before-timer') child.exitCode = 0;
  for (const callback of timers) {
    try { callback(); } catch (error) { thrown = error.message; }
  }
  if (!fault) {
    assert.equal(customUses, custom ? 2 : 0);
    assert.equal(pendingErrorIds[0] === pendingErrorIds[1], custom);
    const delay = getWorkerForceTerminateDelayMs(reason === undefined ? 'dispose' : reason);
    const scheduled = processState !== 'exited' && !(processState === 'exit-on-end' && inputState !== 'missing' && inputState !== 'destroyed') && delay > 0;
    assert.equal(timers.length, scheduled ? 1 : 0);
    assert.equal(trace.filter(([event]) => event === 'terminate').length,
      scheduled && processState === 'exit-before-timer' ? 0 : 1);
    assert.equal(trace.findIndex(([event]) => event === 'cleanup'), 0);
    assert.ok(trace.findIndex(([event]) => event === 'delay') > trace.findIndex(([event]) => event === 'reject'));
  }
  return { trace, thrown, customUses, pendingErrorShared: pendingErrorIds[0] === pendingErrorIds[1] };
}

function checkStructure() {
  const file = path.join(__dirname, '../electron/localVoiceRuntimeWorkerShutdown.cjs');
  const text = fs.readFileSync(file, 'utf8');
  assert.ok(text.split('\n').length <= 300);
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function visit(node) {
    if (ts.isFunctionLike(node) && node.body) assert.ok(node.getText(source).split('\n').length <= 50);
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.match(rootSource, /createLocalVoiceBackendAssembly\(\{/u);
  assert.match(backendSource, /createLocalVoiceWorkerAssembly\(\{/u);
  assert.match(assemblySource, /const \{ destroyModeWorker \} = createLocalVoiceWorkerShutdown\(\{\s*modeWorkerPool,\s*createWorkerUnavailableError,\s*getModeLabel,\s*writeRuntimeLog,/u);
  assert.doesNotMatch(rootSource, /function destroyModeWorker\(/u);
  assert.match(rootSource, /createLocalVoiceSessionAssembly\(\{/u);
  assert.match(sessionSource, /createLocalVoiceRuntimeState\(\)/u);
  assert.equal((stateSource.match(/const modeWorkerPool = new Map\(\)/gu) || []).length, 1);
  assert.doesNotMatch(text, /new Map\(/u);
}

checkStructure();
const baseline = process.argv[2] ? loadBaseline(process.argv[2]) : null;
let count = 0;
for (const mode of ['tts', 'stt']) for (const reason of [undefined, '', 'dispose', 'runtime_dispose',
  'request_aborted', 'aborted_before_ready', 'spawn_error', 'closed_0']) {
  for (const poolState of ['same', 'replacement', 'absent']) {
    for (const inputState of ['open', 'missing', 'destroyed', 'throws']) {
      for (const processState of ['running', 'exited', 'exit-on-end', 'exit-before-timer']) {
        for (const unref of [false, true]) for (const custom of [false, true]) {
          const config = { mode, reason, poolState, inputState, processState, unref, custom };
          const actual = runScenario(config);
          if (baseline) assert.deepEqual(actual, runScenario(config, baseline));
          count++;
        }
      }
    }
  }
}
for (const fault of ['cleanup', 'reject', 'error', 'delay', 'timer', 'unref', 'terminate', 'shutdown-log', 'fallback-log']) {
  const config = { mode: 'tts', reason: 'dispose', poolState: 'replacement', inputState: 'open',
    processState: 'running', unref: true, custom: false, fault };
  const actual = runScenario(config);
  assert.equal(actual.thrown, `${fault}_failure`);
  if (baseline) assert.deepEqual(actual, runScenario(config, baseline));
  count++;
}
console.log(`local voice worker shutdown: ${count} state/order/error scenarios passed${baseline ? ' against baseline' : ''}`);
