const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sessionSource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntimeSessionAssembly.cjs'), 'utf8');
const ts = require('typescript');
const { createLocalVoiceWorkerPool } = require('../electron/localVoiceRuntimeWorkerPool.cjs');
const rootPath = path.join(__dirname, '../electron/localVoiceRuntime.cjs');
const rootSource = fs.readFileSync(rootPath, 'utf8');
const stateSource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntimeState.cjs'), 'utf8');
const names = ['getModeWorkerPoolSize', 'buildModeWorkerSlotKey', 'getModeWorkers',
  'getNextModeWorkerSlotIndex', 'getModeWorkerLoad', 'selectLeastBusyModeWorker',
  'releaseModeWorkerReservation'];

function extractFunctions(text, wanted) {
  const source = ts.createSourceFile('runtime.cjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const found = new Map();
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && wanted.includes(node.name?.text)) {
      found.set(node.name.text, node.getText(source));
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return wanted.map((name) => { assert.ok(found.has(name), `missing ${name}`); return found.get(name); }).join('\n');
}

function createPolicy(map, ttsPoolSize, defaultPoolSize, baseline) {
  if (!baseline) return createLocalVoiceWorkerPool({ modeWorkerPool: map, ttsPoolSize, defaultPoolSize });
  return new Function('modeWorkerPool', 'LOCAL_TTS_WORKER_POOL_SIZE', 'LOCAL_DEFAULT_WORKER_POOL_SIZE',
    `${extractFunctions(baseline, names)}; return { ${names.join(',')} };`,
  )(map, ttsPoolSize, defaultPoolSize);
}

function worker(baseKey, slotIndex, activeRequestCount = 0, pendingCount = 0) {
  return { baseKey, slotIndex, activeRequestCount, destroyed: false,
    pending: new Map(Array.from({ length: pendingCount }, (_, i) => [i, {}])) };
}

function runPolicyChecks(baseline) {
  let count = 0;
  for (const size of [0, 1, 2, 3, 4]) {
    for (let mask = 0; mask < 3 ** size; mask++) {
      const map = new Map();
      const policy = createPolicy(map, size, size + 1, baseline);
      assert.equal(policy.getModeWorkerPoolSize('tts'), size);
      for (const mode of ['stt', '', undefined, 'TTS']) assert.equal(policy.getModeWorkerPoolSize(mode), size + 1);
      let firstFree = -1;
      const expectedWorkers = [];
      for (let slot = 0; slot < size; slot++) {
        const state = Math.floor(mask / 3 ** slot) % 3;
        const key = policy.buildModeWorkerSlotKey('base', size, slot);
        assert.equal(key, size > 1 ? `base::pool-${slot + 1}` : 'base');
        if (state) {
          const entry = worker('base', slot);
          entry.destroyed = state === 2;
          map.set(key, entry);
          if (state === 1) expectedWorkers.push(entry);
        }
        if (state !== 1 && firstFree < 0) firstFree = slot;
      }
      map.set('other', worker('other', 0));
      assert.deepEqual(policy.getModeWorkers('base'), expectedWorkers);
      assert.equal(policy.getNextModeWorkerSlotIndex('base', size), firstFree < 0 ? Math.max(0, size - 1) : firstFree);
      assert.equal(policy.selectLeastBusyModeWorker([]), undefined);
      // Read the root-owned map live after replacement, destruction and deletion.
      const replacement = worker('base', 0);
      map.set(policy.buildModeWorkerSlotKey('base', size, 0), replacement);
      assert.ok(policy.getModeWorkers('base').includes(replacement));
      replacement.destroyed = true;
      assert.equal(policy.getNextModeWorkerSlotIndex('base', size), 0);
      map.clear();
      assert.deepEqual(policy.getModeWorkers('base'), []);
      count++;
    }
  }
  const policy = createPolicy(new Map(), 1, 1, baseline);
  const loads = [undefined, 0, 1, 3, -1].flatMap((active) => [0, 1, 3].map((pending) => ({ active, pending })));
  for (const leftLoad of loads) for (const rightLoad of loads) {
    for (const equalSlots of [false, true]) for (const reverse of [false, true]) {
      const left = worker('base', 0, leftLoad.active, leftLoad.pending);
      const right = worker('base', equalSlots ? 0 : 1, rightLoad.active, rightLoad.pending);
      const input = reverse ? [right, left] : [left, right];
      const before = input.slice();
      const leftScore = (leftLoad.active || 0) + leftLoad.pending;
      const rightScore = (rightLoad.active || 0) + rightLoad.pending;
      assert.equal(policy.getModeWorkerLoad(left), leftScore);
      const expected = leftScore < rightScore ? left : leftScore > rightScore ? right
        : equalSlots ? input[0] : left;
      assert.equal(policy.selectLeastBusyModeWorker(input), expected);
      assert.deepEqual(input, before);
      count++;
    }
  }
  for (const active of [undefined, null, 0, 1, 3, -1]) {
    const entry = worker('base', 0);
    entry.activeRequestCount = active;
    const pending = entry.pending;
    policy.releaseModeWorkerReservation(entry);
    assert.equal(entry.activeRequestCount, Math.max(0, (active || 0) - 1));
    for (let i = 0; i < 5; i++) policy.releaseModeWorkerReservation(entry);
    assert.equal(entry.activeRequestCount, 0);
    assert.equal(entry.pending, pending);
    count++;
  }
  policy.releaseModeWorkerReservation(null);
  policy.releaseModeWorkerReservation(undefined);
  return count;
}

async function runAcquisition(size, rejectReady, baseline) {
  const map = new Map();
  const policy = createPolicy(map, size, size, baseline);
  const trace = [];
  const gates = [];
  const dependencies = { ...policy, buildModeWorkerKey: () => 'base',
    createModeWorker: (_, mode, modelPath, scriptPath, slotIndex) => {
    const entry = worker('base', slotIndex);
    map.set(policy.buildModeWorkerSlotKey('base', size, slotIndex), entry);
    trace.push(['create', mode, modelPath, scriptPath, slotIndex]);
    return entry;
  }, ensureRunnerScriptPath: () => { trace.push(['script']); return 'runner.py'; }, ensureModeWorkerReady: (entry, signal) => {
    trace.push(['ready', entry.slotIndex, entry.activeRequestCount, signal]);
    return new Promise((resolve, reject) => gates.push({ resolve, reject }));
  } };
  const acquisitionSource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntimeWorkerAcquisition.cjs'), 'utf8');
  const acquire = baseline
    ? new Function(...Object.keys(dependencies),
      `${extractFunctions(baseline, ['acquireModeWorker'])}; return acquireModeWorker;`,
    )(...Object.values(dependencies))
    : new Function('context', `${extractFunctions(acquisitionSource, ['acquireModeWorker'])}; return acquireModeWorker.bind(null, context);`)(dependencies);
  const signal = { marker: 'same signal' };
  const pending = [acquire({}, 'tts', 'model', signal), acquire({}, 'tts', 'model', signal)];
  // Install rejection observers before releasing the asynchronous readiness gates.
  const results = Promise.allSettled(pending);
  assert.equal([...map.values()].reduce((sum, entry) => sum + entry.activeRequestCount, 0), 2);
  const error = new Error('not_ready');
  gates.forEach((gate) => rejectReady ? gate.reject(error) : gate.resolve());
  const settled = await results;
  for (const result of settled) {
    if (rejectReady) { assert.equal(result.status, 'rejected'); assert.equal(result.reason, error); }
    else {
      assert.equal(result.status, 'fulfilled');
      assert.ok([...map.values()].includes(result.value.worker));
      result.value.release();
      result.value.release();
    }
  }
  assert.equal([...map.values()].reduce((sum, entry) => sum + entry.activeRequestCount, 0), 0);
  assert.equal(map.size, size === 1 ? 1 : 2);
  return trace;
}

function checkStructure() {
  const file = path.join(__dirname, '../electron/localVoiceRuntimeWorkerPool.cjs');
  const text = fs.readFileSync(file, 'utf8');
  assert.ok(text.split('\n').length <= 300);
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function visit(node) {
    if (ts.isFunctionLike(node) && node.body) assert.ok(node.getText(source).split('\n').length <= 50);
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.match(rootSource, /createLocalVoiceSessionAssembly\(\{/u);
  assert.match(sessionSource, /createLocalVoiceRuntimeState\(\)/u);
  assert.equal((stateSource.match(/const modeWorkerPool = new Map\(\)/gu) || []).length, 1);
  assert.match(sessionSource, /createLocalVoiceWorkerPool\(\{\s*modeWorkerPool,\s*ttsPoolSize: LOCAL_TTS_WORKER_POOL_SIZE,\s*defaultPoolSize: LOCAL_DEFAULT_WORKER_POOL_SIZE/u);
  for (const name of names) assert.doesNotMatch(rootSource, new RegExp(`function ${name}\\(`));
  assert.doesNotMatch(text, /new Map\(/u);
  const firstMap = new Map();
  const first = createPolicy(firstMap, 1, 1);
  const other = createPolicy(new Map(), 1, 1);
  const entry = worker('base', 0);
  firstMap.set('base', entry);
  assert.equal(first.getModeWorkers('base')[0], entry);
  assert.deepEqual(other.getModeWorkers('base'), []);
  firstMap.delete('base');
  assert.deepEqual(first.getModeWorkers('base'), []);
}

async function main() {
  const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
  checkStructure();
  const count = runPolicyChecks();
  if (baseline) assert.equal(runPolicyChecks(baseline), count);
  for (const size of [1, 2, 3]) for (const rejectReady of [false, true]) {
    const trace = await runAcquisition(size, rejectReady);
    if (baseline) assert.deepEqual(trace, await runAcquisition(size, rejectReady, baseline));
  }
  console.log(`local voice worker pool: ${count} policy scenarios, 6 concurrent acquisition scenarios passed${baseline ? ' against baseline' : ''}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
