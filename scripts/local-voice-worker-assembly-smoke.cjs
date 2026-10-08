const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sessionSource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntimeSessionAssembly.cjs'), 'utf8');
const { createRequire } = require('node:module');
const ts = require('typescript');
const backendSource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntimeBackendAssembly.cjs'), 'utf8');
const modulePath = path.join(__dirname, '../electron/localVoiceRuntimeWorkerAssembly.cjs');
const source = fs.readFileSync(modulePath, 'utf8');
const { createLocalVoiceWorkerAssembly } = require(modulePath);
const groups = [
  ['buildModeWorkerKey', 'buildWorkerExitReason', 'buildWorkerReadyLogDetails', 'buildWorkerRequestInput',
    'buildWorkerRequestResult', 'createWorkerUnavailableError', 'describeRuntimeEnvironment', 'getWorkerModeModelPath',
    'getWorkerResponseRequestId', 'parseRunnerPayload', 'summarizeWorkerPayload', 'summarizeWorkerResponse'],
  ['destroyModeWorker'], ['createModeWorker'], ['requestModeWorker'], ['ensureModeWorker', 'acquireModeWorker'],
];
const factoryNames = ['createLocalVoiceRuntimeWorkerUtils', 'createLocalVoiceWorkerShutdown',
  'createLocalVoiceWorkerCreator', 'createLocalVoiceWorkerRequest', 'createLocalVoiceWorkerAcquisition'];

function loadBaseline(file) {
  const root = fs.readFileSync(file, 'utf8');
  const a = root.indexOf('  const {\n    buildModeWorkerKey,'), b = root.indexOf('  const {\n    getFallbackRuntimeCandidates,', a);
  assert.ok(a >= 0 && b > a);
  return context => new Function(...Object.keys(context),
    `${root.slice(a, b)} return { ${groups.flat().join(', ')} };`,
  )(...Object.values(context));
}

function controlled(context, failIndex, baseline) {
  const trace = [], tokens = new Map(), failure = new Error('assembly failed');
  const factories = Object.fromEntries(factoryNames.map((name, index) => [name, input => {
    const normalized = {};
    for (const [key, value] of Object.entries(input)) {
      const expectedKey = key;
      assert.equal(value, tokens.get(key) ?? context[expectedKey], `dependency identity: ${name}.${key}`);
      normalized[key] = tokens.has(key) ? `output:${key}` : expectedKey;
    }
    trace.push([name, normalized]);
    if (index === failIndex) throw failure;
    return Object.fromEntries(groups[index].map(key => {
      const token = () => key; tokens.set(key, token); return [key, token];
    }));
  }]));
  let result;
  try {
    if (baseline) result = baseline({ ...context, ...factories });
    else {
      const loaded = { exports: {} };
      const realRequire = createRequire(modulePath);
      new Function('require', 'module', source)(name => {
        if (/localVoiceRuntimeWorker(Utils|Shutdown|Creator|Request|Acquisition)/.test(name)) return factories;
        return realRequire(name);
      }, loaded);
      result = loaded.exports.createLocalVoiceWorkerAssembly(context);
    }
    assert.deepEqual(Object.keys(result), groups.flat());
    for (const [key, value] of Object.entries(result)) assert.equal(value, tokens.get(key));
  } catch (error) {
    assert.equal(error, failure); result = { failed: true };
  }
  assert.equal(trace.length, failIndex < 0 ? 5 : failIndex + 1);
  return { trace, result: result.failed ? result : Object.keys(result) };
}

async function realIsolation() {
  const { createLocalVoiceWorkerPool } = require('../electron/localVoiceRuntimeWorkerPool.cjs');
  const commands = require('../electron/localVoiceRuntimeCommandUtils.cjs');
  const paths = require('../electron/localVoiceRuntimePathUtils.cjs');
  const instances = [];
  for (const tag of ['A', 'B']) {
    const pool = new Map(), calls = [];
    const policy = createLocalVoiceWorkerPool({ modeWorkerPool: pool, ttsPoolSize: 1, defaultPoolSize: 1 });
    const candidate = { executable: 'controlled.exe', args: [], label: 'candidate' };
    const api = createLocalVoiceWorkerAssembly({ ...commands, ...paths, ...policy,
      bundledPythonPath: '', portableExecutableDir: '', projectRoot: 'project', runtimeRoot: 'runtime',
      modeWorkerPool: pool, getModeEnvDirectory: (root, mode) => path.join(root, mode),
      getModeLabel: mode => mode, describeRuntimeCandidate: input => input.executable,
      getSharedOptions: () => { throw new Error('must not spawn'); },
      ensureRunnerScriptPath: () => { throw new Error('must not sync scripts'); },
      writeRuntimeLog: (...args) => calls.push(args), buildJsonError: error => error.message,
    });
    assert.equal(pool.size, 0); assert.deepEqual(calls, []);
    const baseKey = api.buildModeWorkerKey(candidate, 'tts', 'model');
    const worker = { mode: 'tts', key: baseKey, baseKey, slotIndex: 0, ready: true, destroyed: false,
      activeRequestCount: 0, pending: new Map(), tag };
    pool.set(baseKey, worker);
    assert.equal(await api.ensureModeWorker(candidate, 'tts', 'model'), worker);
    const assignment = await api.acquireModeWorker(candidate, 'tts', 'model');
    assert.equal(assignment.worker, worker); assert.equal(worker.activeRequestCount, 1);
    instances.push({ api, pool, worker, assignment, calls });
  }
  assert.notEqual(instances[0].worker, instances[1].worker);
  instances[0].assignment.release();
  assert.equal(instances[0].worker.activeRequestCount, 0);
  assert.equal(instances[1].worker.activeRequestCount, 1);
  instances[1].assignment.release();
  assert.equal(instances[1].worker.activeRequestCount, 0);
  for (const instance of instances) {
    assert.equal(instance.pool.size, 1); assert.deepEqual(instance.calls, []);
    instance.worker.destroyed = true;
    instance.api.destroyModeWorker(instance.worker, 'already_destroyed');
    assert.equal(instance.pool.size, 1);
  }
}

function structure() {
  const stateSource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntimeState.cjs'), 'utf8');
  assert.ok(source.split('\n').length <= 300);
  const ast = ts.createSourceFile(modulePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.body) assert.ok(
      ast.getLineAndCharacterOfPosition(node.end).line - ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 <= 50);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const root = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntime.cjs'), 'utf8');
  assert.match(root, /createLocalVoiceBackendAssembly\(\{/);
  assert.match(backendSource, /createLocalVoiceWorkerAssembly\(\{/);
  for (const name of factoryNames) assert.ok(!root.includes(`${name}(`));
  assert.match(root, /createLocalVoiceSessionAssembly\(\{/u);
  assert.match(sessionSource, /createLocalVoiceRuntimeState\(\)/u);
  assert.match(stateSource, /const modeWorkerPool = new Map\(\)/);
}

async function main() {
  structure();
  const baseline = process.argv[2] ? loadBaseline(process.argv[2]) : null;
  for (const suffix of ['A', 'B']) {
    const context = Object.fromEntries(['bundledPythonPath', 'describeRuntimeCandidate', 'getModeEnvDirectory', 'isPathInside',
      'normalizeComparablePath', 'portableExecutableDir', 'projectRoot', 'runtimeRoot', 'splitOutputLines', 'takeTail',
      'modeWorkerPool', 'getModeLabel', 'writeRuntimeLog', 'getModeWorkerPoolSize', 'buildModeWorkerSlotKey',
      'getSharedOptions', 'parseJsonFromCommandOutput', 'buildJsonError', 'ensureRunnerScriptPath', 'getModeWorkers',
      'getNextModeWorkerSlotIndex', 'selectLeastBusyModeWorker', 'releaseModeWorkerReservation']
      .map(name => [name, { name, suffix }]));
    for (const failIndex of [-1, 0, 1, 2, 3, 4]) {
      const actual = controlled(context, failIndex);
      if (baseline) assert.deepEqual(actual, controlled(context, failIndex, baseline));
    }
  }
  await realIsolation();
  console.log('local voice worker assembly: 12 dependency/order/failure cases and real two-instance ready-worker acquisition passed' + (baseline ? ' against baseline' : ''));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
