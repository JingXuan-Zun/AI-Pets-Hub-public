const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const ts = require('typescript');
const backendSource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntimeBackendAssembly.cjs'), 'utf8');
const command = require('../electron/localVoiceRuntimeCommandUtils.cjs');
const { createLocalVoiceRuntimeWorkerUtils } = require('../electron/localVoiceRuntimeWorkerUtils.cjs');
const { createLocalVoiceWorkerPool } = require('../electron/localVoiceRuntimeWorkerPool.cjs');
const { createLocalVoiceWorkerShutdown } = require('../electron/localVoiceRuntimeWorkerShutdown.cjs');
const { createLocalVoiceWorkerEvents } = require('../electron/localVoiceRuntimeWorkerEvents.cjs');
const { createLocalVoiceWorkerCreator } = require('../electron/localVoiceRuntimeWorkerCreator.cjs');
const rootPath = path.join(__dirname, '../electron/localVoiceRuntime.cjs');
const rootSource = fs.readFileSync(rootPath, 'utf8');
const assemblySource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntimeWorkerAssembly.cjs'), 'utf8');

function loadCreator(text) {
  if (text.includes('createLocalVoiceWorkerAssembly({') || text.includes('createLocalVoiceBackendAssembly({')) text = assemblySource;
  const start = text.indexOf('  function createModeWorker(');
  if (start < 0) {
    assert.match(text, /const \{ createModeWorker \} = createLocalVoiceWorkerCreator\(\{/u);
    const binding = text.match(/createLocalVoiceWorkerCreator\(\{([\s\S]*?)\}\)/u)[1];
    const names = binding.split(',').map((name) => name.trim()).filter(Boolean);
    assert.equal(new Set(names).size, names.length);
    return (dependencies) => createLocalVoiceWorkerCreator({
      ...Object.fromEntries(names.map((name) => {
        assert.ok(Object.hasOwn(dependencies, name), `missing root dependency ${name}`);
        return [name, dependencies[name]];
      })),
      spawnProcess: dependencies.spawn,
      createEvents: dependencies.createLocalVoiceWorkerEvents,
    }).createModeWorker;
  }
  const end = text.indexOf('  async function ensureModeWorkerReady(', start);
  assert.ok(start >= 0 && end > start);
  return (dependencies) => new Function(...Object.keys(dependencies),
    `${text.slice(start, end)}; return createModeWorker;`,
  )(...Object.values(dependencies));
}

const workerUtils = createLocalVoiceRuntimeWorkerUtils({
  bundledPythonPath: '', describeRuntimeCandidate: (candidate) => candidate.executable,
  getModeEnvDirectory: (root, mode) => path.join(root, mode),
  isPathInside: () => false, normalizeComparablePath: (value) => value,
  portableExecutableDir: '', projectRoot: 'project', runtimeRoot: 'runtime',
  splitOutputLines: command.splitOutputLines, takeTail: command.takeTail,
});

async function runScenario(config, creator) {
  const { mode, size, slot, scenario, fragmented, fault } = config;
  const trace = [];
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = { destroyed: false, end: () => trace.push(['stdin-end']) };
  const pool = new Map();
  const policy = createLocalVoiceWorkerPool({ modeWorkerPool: pool, ttsPoolSize: size, defaultPoolSize: size });
  const errorValue = (error) => error ? { name: error.name, message: error.message } : null;
  const fail = (target) => { if (fault === target) throw new Error(`${target}_failure`); };
  const writeRuntimeLog = (message, details) => {
    trace.push(['log', message, details]);
    if (message.endsWith('starting')) {
      const entry = [...pool.values()][0];
      assert.ok(entry.readyPromise instanceof Promise);
      assert.equal(child.stdout.listenerCount('data'), 1);
      assert.equal(child.listenerCount('close'), 1);
    }
    if (message.endsWith('ready')) fail('ready-log');
    if (message.endsWith('output')) fail('output-log');
    if (message.endsWith('completed')) fail('request-log');
    if (message.endsWith('stderr')) fail('stderr-log');
  };
  const shutdown = createLocalVoiceWorkerShutdown({ modeWorkerPool: pool,
    createWorkerUnavailableError: workerUtils.createWorkerUnavailableError,
    getModeLabel: (value) => value.toUpperCase(), writeRuntimeLog,
    isRunning: () => false, terminate: () => trace.push(['terminate']),
  });
  const createWorker = creator({ ...command, ...workerUtils, ...policy,
    modeWorkerPool: pool, createLocalVoiceWorkerEvents,
    spawn: (executable, args, options) => { trace.push(['spawn', executable, args, options]); return child; },
    getSharedOptions: () => ({ cwd: 'cwd', env: { TEST_VOICE: '1' }, windowsHide: false }),
    getModeLabel: (value) => value.toUpperCase(), describeRuntimeCandidate: (candidate) => candidate.executable,
    writeRuntimeLog, destroyModeWorker: (entry, reason, error) => {
      trace.push(['destroy', reason, errorValue(error)]);
      fail('destroy');
      shutdown.destroyModeWorker(entry, reason, error);
    }, summarizeWorkerResponse: (parsed) => { fail('summary'); return workerUtils.summarizeWorkerResponse(parsed); },
  });
  const candidate = { executable: 'python.exe', args: ['-u'] };
  const worker = createWorker(candidate, mode, 'model', 'runner.py', slot);
  assert.equal(worker.candidate, candidate);
  assert.equal(worker.process, child);
  assert.equal(pool.get(worker.key), worker);
  let readyState = 'pending';
  worker.readyPromise.then((entry) => { assert.equal(entry, worker); readyState = 'fulfilled'; },
    (error) => { readyState = errorValue(error); });
  const readyResolve = worker._resolveReady;
  worker._resolveReady = (entry) => { trace.push(['ready-resolve', entry === worker]); readyResolve(entry); fail('ready-resolve'); };
  const id = `${mode}-1`;
  let requestResolved = null;
  let sameResponse = false;
  worker.pending.set(id, {
    abortCleanup() { trace.push(['cleanup', worker.pending.has(id)]); fail('cleanup'); },
    resolve(parsed) { requestResolved = parsed; sameResponse = parsed.id === id;
      trace.push(['response', parsed]); fail('response'); },
    reject(error) { trace.push(['reject', errorValue(error)]); },
  });
  const send = (stream, text) => {
    if (fragmented) {
      const middle = Math.floor(text.length / 2);
      stream.emit('data', Buffer.from(text.slice(0, middle)));
      stream.emit('data', Buffer.from(text.slice(middle)));
    } else stream.emit('data', Buffer.from(text));
  };
  const ready = JSON.stringify({ event: 'ready', pid: 123, model_path: ' model ', runtime_device: ' cpu ' });
  const response = JSON.stringify({ id, ok: scenario !== 'failed', audio_file_path: 'audio.wav', error: 'error text' });
  let thrown = null;
  try {
    if (['ready', 'ready-twice', 'ready-close', 'tail-ready-close'].includes(scenario)) {
      send(child.stdout, ready + (scenario === 'tail-ready-close' ? '' : '\r\n'));
      if (scenario === 'ready-twice') send(child.stdout, ready + '\n');
    } else if (['success', 'failed', 'response-duplicate', 'tail-response-error'].includes(scenario)) {
      send(child.stdout, response + (scenario === 'tail-response-error' ? '' : '\n'));
      if (scenario === 'response-duplicate') send(child.stdout, response + '\n');
    } else if (scenario === 'invalid') send(child.stdout, 'not-json\n');
    else if (scenario === 'unknown') send(child.stdout, '{"id":"other","ok":true}\n');
    else if (scenario === 'null') send(child.stdout, 'null\n');
    else if (scenario === 'primitive') send(child.stdout, '123\n');
    send(child.stderr, 'stderr tail');
    if (['error', 'error-close', 'tail-response-error'].includes(scenario)) child.emit('error', new Error('child_error'));
    if (['close', 'error-close', 'ready-close', 'tail-ready-close'].includes(scenario)) child.emit('close', null, 'SIGTERM');
    if (scenario === 'stderr') send(child.stderr, '\n');
  } catch (error) { thrown = error.message; }
  await Promise.resolve();
  if (!fault) {
    assert.equal(worker.ready, scenario.startsWith('ready') || scenario === 'tail-ready-close');
    if (['success', 'failed', 'response-duplicate', 'tail-response-error'].includes(scenario)) {
      assert.equal(sameResponse, true);
      assert.equal(worker.pending.has(id), false);
      assert.equal(trace.filter(([event]) => event === 'response').length, 1);
    }
  }
  return { trace, thrown, readyState, requestResolved, ready: worker.ready,
    destroyed: worker.destroyed, startError: errorValue(worker.startError),
    shutdownReason: worker.shutdownReason, pending: [...worker.pending.keys()], poolKeys: [...pool.keys()] };
}

function checkStructure() {
  const file = path.join(__dirname, '../electron/localVoiceRuntimeWorkerEvents.cjs');
  const text = fs.readFileSync(file, 'utf8');
  assert.ok(text.split('\n').length <= 300);
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function visit(node) {
    if (ts.isFunctionLike(node) && node.body) assert.ok(node.getText().split('\n').length <= 50);
    ts.forEachChild(node, visit);
  }
  visit(source);
  const creatorFile = path.join(__dirname, '../electron/localVoiceRuntimeWorkerCreator.cjs');
  const creator = fs.readFileSync(creatorFile, 'utf8');
  assert.ok(creator.split('\n').length <= 300);
  const creatorAst = ts.createSourceFile(creatorFile, creator, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  visit(creatorAst);
  assert.ok(creator.indexOf('const workerEvents = createEvents(') < creator.indexOf('worker.readyPromise ='));
  assert.ok(creator.indexOf('worker.readyPromise =') < creator.indexOf('workerEvents.attach();'));
  assert.ok(creator.indexOf('workerEvents.attach();') < creator.indexOf('worker starting'));
  assert.doesNotMatch(creator, /child\.(stdout|stderr)\.on/u);
  assert.doesNotMatch(rootSource, /function createModeWorker\(/u);
  assert.match(rootSource, /createLocalVoiceBackendAssembly\(\{/u);
  assert.match(backendSource, /createLocalVoiceWorkerAssembly\(\{/u);
  assert.match(assemblySource, /createLocalVoiceWorkerCreator\(\{\s*buildModeWorkerKey, getModeWorkerPoolSize, buildModeWorkerSlotKey,\s*modeWorkerPool, getSharedOptions,/u);
}

function runStartup(config, creator) {
  const { mode, args, slot, fault } = config;
  const trace = [];
  const error = new Error('startup_failure');
  const step = (name, details) => {
    trace.push([name, details]);
    if (fault === name) throw error;
  };
  const child = new EventEmitter();
  child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
  const pool = new Map();
  const originalSet = pool.set.bind(pool);
  pool.set = (key, entry) => { step('pool', key); return originalSet(key, entry); };
  const candidate = {};
  Object.defineProperties(candidate, {
    executable: { get() { step('executable'); return 'python custom.exe'; } },
    args: { get() { step('args'); return args; } },
  });
  const make = creator({ ...command, ...workerUtils, modeWorkerPool: pool,
    buildModeWorkerKey: () => { step('key'); return 'base'; },
    getModeWorkerPoolSize: () => { step('size'); return 3; },
    buildModeWorkerSlotKey: (base, size, index) => { step('slot', [base, size, index]); return `slot-${index}`; },
    getSharedOptions: () => { step('shared'); return { cwd: 'cwd', env: { X: '1' }, stdio: ['ignore'], windowsHide: false }; },
    spawn: (executable, commandArgs, options) => { step('spawn', { executable, commandArgs, options }); return child; },
    createLocalVoiceWorkerEvents: (context) => {
      step('events', { pending: context.worker.pending.size, promise: context.worker.readyPromise });
      const events = createLocalVoiceWorkerEvents(context);
      return { attach() { step('attach', context.worker.readyPromise instanceof Promise); events.attach(); } };
    },
    getModeLabel: (value) => value,
    describeRuntimeCandidate: () => { step('describe'); return 'candidate'; },
    writeRuntimeLog: (message, details) => step('start-log', { message, details }),
    destroyModeWorker: () => { throw new Error('unexpected shutdown during creation'); },
  });
  let result;
  let thrown = null;
  try { result = make(candidate, mode, 'model path', 'script path', slot); }
  catch (caught) { assert.equal(caught, error); thrown = caught.message; }
  const effectiveSlot = slot === undefined ? 0 : slot;
  if (!fault) {
    assert.equal(result, pool.get(`slot-${effectiveSlot}`));
    assert.equal(result.candidate, candidate);
    assert.equal(result.process, child);
    assert.equal(result.activeRequestCount, 0);
    assert.equal(result.nextRequestId, 0);
    assert.equal(result.ready, false);
    assert.equal(result.destroyed, false);
    assert.equal(result.startError, null);
    assert.equal(result.shutdownReason, 'running');
    const spec = trace.find(([name]) => name === 'spawn')[1];
    assert.deepEqual(spec.commandArgs, [...args, 'script path', '--worker-mode', '--mode', mode,
      mode === 'tts' ? '--tts-model-path' : '--stt-model-path', 'model path']);
    assert.deepEqual(spec.options.stdio, ['pipe', 'pipe', 'pipe']);
    assert.equal(spec.options.windowsHide, true);
  } else assert.equal(thrown, 'startup_failure');
  return { trace, thrown, poolKeys: [...pool.keys()],
    stdoutListeners: child.stdout.listenerCount('data'), closeListeners: child.listenerCount('close'),
    states: [...pool.values()].map((entry) => ({ key: entry.key, baseKey: entry.baseKey,
      slotIndex: entry.slotIndex, mode: entry.mode, modelPath: entry.modelPath,
      pending: entry.pending.size, promise: entry.readyPromise instanceof Promise,
      activeRequestCount: entry.activeRequestCount, nextRequestId: entry.nextRequestId,
      ready: entry.ready, destroyed: entry.destroyed, shutdownReason: entry.shutdownReason })),
  };
}

async function main() {
  checkStructure();
  const creator = loadCreator(rootSource);
  const baseline = process.argv[2] ? loadCreator(fs.readFileSync(process.argv[2], 'utf8')) : null;
  let count = 0;
  for (const mode of ['tts', 'stt']) for (const size of [1, 3]) for (const slot of [0, 1]) {
    for (const fragmented of [false, true]) for (const scenario of ['ready', 'ready-twice', 'success', 'failed',
      'unknown', 'invalid', 'null', 'primitive', 'close', 'error', 'error-close', 'ready-close',
      'tail-ready-close', 'tail-response-error', 'response-duplicate', 'stderr']) {
      const config = { mode, size, slot, fragmented, scenario };
      const actual = await runScenario(config, creator);
      if (baseline) assert.deepEqual(actual, await runScenario(config, baseline));
      count++;
    }
  }
  for (const [fault, scenario] of [['ready-log', 'ready'], ['output-log', 'invalid'], ['request-log', 'success'],
    ['stderr-log', 'stderr'], ['destroy', 'error'], ['summary', 'success'], ['ready-resolve', 'ready'],
    ['cleanup', 'success'], ['response', 'success']]) {
    const config = { mode: 'tts', size: 1, slot: 0, fragmented: false, scenario, fault };
    const actual = await runScenario(config, creator);
    assert.equal(actual.thrown, `${fault}_failure`);
    if (baseline) assert.deepEqual(actual, await runScenario(config, baseline));
    count++;
  }
  let startupCount = 0;
  for (const mode of ['tts', 'stt']) for (const args of [[], ['-u']]) for (const slot of [undefined, 2]) {
    for (const fault of [null, 'key', 'size', 'slot', 'executable', 'args', 'shared', 'spawn',
      'pool', 'events', 'attach', 'describe', 'start-log']) {
      const config = { mode, args, slot, fault };
      const actual = runStartup(config, creator);
      if (baseline) assert.deepEqual(actual, runStartup(config, baseline));
      startupCount++;
    }
  }
  console.log(`local voice worker events: ${count} event scenarios, ${startupCount} startup/order/error scenarios passed${baseline ? ' against baseline' : ''}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
