const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const modulePath = path.join(__dirname, '../electron/localVoiceRuntimeBackendAssembly.cjs');
const source = fs.readFileSync(modulePath, 'utf8');
const realRequire = createRequire(modulePath);
const factoryNames = ['createLocalVoiceWorkerAssembly', 'createLocalVoiceSupportAssembly',
  'createLocalVoiceCandidateExecution'];
const groups = [['describeRuntimeEnvironment', 'getWorkerModeModelPath', 'parseRunnerPayload',
  'destroyModeWorker', 'requestModeWorker', 'ensureModeWorker', 'acquireModeWorker'],
['getModeRuntimeCandidates', 'resolveBasePythonRuntime', 'getHealth', 'ensureReferenceTextPrepared'],
['warmupModeWorker', 'runRunnerCommand']];
const publicKeys = ['destroyModeWorker', 'requestModeWorker', 'resolveBasePythonRuntime',
  'getHealth', 'ensureReferenceTextPrepared', 'warmupModeWorker', 'runRunnerCommand'];
const inputKeys = ['bundledPythonPath', 'portableExecutableDir', 'projectRoot', 'runtimeRoot',
  'modeWorkerPool', 'writeRuntimeLog', 'getModeWorkerPoolSize', 'buildModeWorkerSlotKey',
  'getSharedOptions', 'ensureRunnerScriptPath', 'getModeWorkers', 'getNextModeWorkerSlotIndex',
  'selectLeastBusyModeWorker', 'releaseModeWorkerReservation', 'getBrokenModeRuntimeCandidate',
  'buildReferenceTextCacheKey', 'readPersistedReferenceText', 'spawnCommand', 'runInlinePythonScript',
  'markBrokenModeRuntimeCandidate', 'resolveAssetSelection', 'getConfiguredReferenceText',
  'persistReferenceText', 'referenceTextCache', 'clearBrokenModeRuntimeCandidate'];

function loadBaseline(file) {
  const root = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const start = root.indexOf('  const {\n    describeRuntimeEnvironment, getWorkerModeModelPath, parseRunnerPayload,');
  const end = root.indexOf('  const { warmup, installDependencies, synthesize, transcribe }', start);
  assert.ok(start >= 0 && end > start);
  return context => new Function(...Object.keys(context),
    `${root.slice(start, end)} return { ${publicKeys.join(', ')} };`)(...Object.values(context));
}

function controlled(tag, failIndex, baseline) {
  const context = Object.fromEntries(inputKeys.map(key => [key, { key, tag }]));
  const helpers = Object.assign({}, ...['ModeUtils', 'ProcessUtils', 'CommandUtils', 'PathUtils']
    .map(name => realRequire(`./localVoiceRuntime${name}.cjs`)));
  const trace = [], tokens = new Map(), failure = new Error('backend stage failed');
  const factories = Object.fromEntries(factoryNames.map((name, index) => [name, input => {
    for (const [key, value] of Object.entries(input)) {
      assert.equal(value, tokens.get(key) ?? context[key] ?? helpers[key], `${name}.${key}`);
    }
    trace.push([name, Object.keys(input)]);
    if (index === failIndex) throw failure;
    return Object.fromEntries(groups[index].map(key => {
      const token = () => key; tokens.set(key, token); return [key, token];
    }));
  }]));
  let result;
  try {
    if (baseline) result = baseline({ ...helpers, ...context, ...factories });
    else {
      const loaded = { exports: {} };
      new Function('require', 'module', source)(name => {
        if (/localVoiceRuntime(WorkerAssembly|SupportAssembly|CandidateExecution)\.cjs$/.test(name)) return factories;
        return realRequire(name);
      }, loaded);
      result = loaded.exports.createLocalVoiceBackendAssembly(context);
    }
  } catch (error) { assert.equal(error, failure); }
  assert.equal(trace.length, failIndex < 0 ? 3 : failIndex + 1);
  if (result) {
    assert.deepEqual(Object.keys(result), publicKeys);
    for (const key of publicKeys) assert.equal(result[key], tokens.get(key));
  }
  return { trace, result: result ? Object.keys(result) : null };
}

const baseline = process.argv[2] ? loadBaseline(process.argv[2]) : null;
for (const tag of ['A', 'B']) for (const failIndex of [-1, 0, 1, 2]) {
  const actual = controlled(tag, failIndex);
  if (baseline) assert.deepEqual(actual, controlled(tag, failIndex, baseline));
}
const root = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntime.cjs'), 'utf8');
assert.match(root, /createLocalVoiceBackendAssembly\(\{/);
for (const name of factoryNames) assert.ok(!root.includes(`${name}(`));
console.log(`Local voice backend assembly: 8 dependency/order/failure scenarios and public function identity passed${baseline ? ' against baseline' : ''}.`);
