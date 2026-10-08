const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../electron');
const source = fs.readFileSync(path.join(root, 'mcpStdioPoolRpc.cjs'), 'utf8');
const controls = fs.readFileSync(path.join(root, 'mcpStdioPoolControls.cjs'), 'utf8');
let previous, previousControls;
if (process.argv[2]) {
  const text = fs.readFileSync(process.argv[2], 'utf8');
  const tree = ts.createSourceFile('old.cjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const factory = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createMcpStdioSessionPool');
  const named = name => factory.body.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === name).getText(tree);
  previous = "const { sendRpc } = require('./mcpStdioSession.cjs');\nconst { clearEntryIdleTimer } = require('./mcpStdioIdleEviction.cjs');\nfunction createMcpPoolRpc({ entries, getEntry, restartPolicy, history, scheduleIdleEviction, discardEntry, recordRestartFailure }) {\n" + named('runRpc') + '\nreturn runRpc;\n}\nmodule.exports = { createMcpPoolRpc };';
  previousControls = "const { createSessionPoolStatuses } = require('./mcpStdioSessionPoolStatus.cjs');\n" + tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'shouldResetRestartPolicy').getText(tree) + '\nfunction createMcpPoolControls({ entries, lastCloseEvents, restartPolicy, idleTimeoutMs, discardEntry }) {\n' + ['discard', 'getStatus', 'dispose'].map(named).join('\n') + '\nreturn { discard, dispose, getStatus };\n}\nmodule.exports = { createMcpPoolControls };';
}
function load(text, boundaries, now = () => 1234) {
  const module = { exports: {} };
  new Function('require', 'module', 'Date', text)(name => {
    assert.ok(Object.hasOwn(boundaries, name), 'Unexpected RPC/control dependency: ' + name);
    return boundaries[name];
  }, module, { now });
  return module.exports;
}

async function scenario(text, previousFailed, entryMode, recovering, mode, observer) {
  const calls = [];
  const failure = new Error('failure: ' + mode), result = { content: 'fixture' };
  const fail = name => { if (mode === name) throw failure; };
  const inFlight = previousFailed ? Promise.reject(new Error('previous RPC failure')) : Promise.resolve();
  inFlight.catch(() => {});
  const ready = mode === 'ready-reject' ? Promise.reject(failure) : Promise.resolve();
  ready.catch(() => {});
  const entry = { inFlight, ready, session: {}, lastUsedAt: 1 };
  const replacement = { marker: 'replacement' }, entries = new Map();
  if (entryMode !== 'missing') entries.set('server', entryMode === 'original' ? entry : replacement);
  const history = observer === 'absent' ? null : { recordSessionEvent(event) { assert.equal(this, history); calls.push(['history', event]); fail('history-throw'); } };
  const restartPolicy = {
    getStatus(id) { assert.equal(this, restartPolicy); calls.push(['status', id]); fail('status-throw'); return { consecutiveFailures: recovering }; },
    recordSuccess(id) { assert.equal(this, restartPolicy); calls.push(['success', id]); fail('success-throw'); },
  };
  const exported = load(text, {
    './mcpStdioSession.cjs': { sendRpc(session, method, params, timeout) {
      assert.equal(session, entry.session); calls.push(['rpc', method, params, timeout]);
      if (['rpc-reject', 'discard-throw', 'failure-record-throw'].includes(mode)) return Promise.reject(failure);
      return Promise.resolve(result);
    } },
    './mcpStdioIdleEviction.cjs': { clearEntryIdleTimer(value) { assert.equal(value, entry); calls.push(['clear']); fail('clear-throw'); } },
  }, () => { calls.push(['now']); fail('now-throw'); return 1234; });
  const runRpc = exported.createMcpPoolRpc({
    entries, history, restartPolicy,
    getEntry(server) { assert.equal(server.id, 'server'); calls.push(['get']); fail('get-throw'); return entry; },
    scheduleIdleEviction(id, value) { assert.equal(value, entry); calls.push(['schedule', id]); fail('schedule-throw'); },
    discardEntry(id, reason) { calls.push(['discard', id, reason]); fail('discard-throw'); entries.delete(id); return { closeEvent: { reason } }; },
    recordRestartFailure(id, event, error) { assert.equal(error, failure); calls.push(['failure-record', id, event]); fail('failure-record-throw'); },
  });
  assert.deepEqual(calls, [], 'RPC assembly must not run or access an entry');
  let outcome;
  try {
    const value = await runRpc({ id: 'server' }, 'tools/call', { arg: 1 }, 42);
    assert.equal(value, result);
    assert.equal(entry.lastUsedAt, 1234);
    outcome = { value };
  } catch (error) {
    if (error instanceof assert.AssertionError) throw error;
    assert.equal(error, failure, 'Original error must propagate'); outcome = { error: error.message };
  }
  if (entryMode !== 'original') assert.ok(!calls.some(call => call[0] === 'discard' || call[0] === 'failure-record'), 'Old failures must not discard replacement or missing entries');
  if (observer === 'absent' || !recovering) assert.ok(!calls.some(call => call[0] === 'history'));
  return { outcome, calls, lastUsedAt: entry.lastUsedAt, remaining: entries.size };
}

async function checkQueue(text, previousFailed, firstFails, replace) {
  const calls = [], release = [], started = [];
  let initialize;
  const previousRun = previousFailed ? Promise.reject(new Error('earlier failure')) : Promise.resolve();
  previousRun.catch(() => {});
  const entry = { inFlight: previousRun, ready: new Promise(resolve => { initialize = resolve; }), session: {} };
  const entries = new Map([['server', entry]]), replacement = {};
  const starts = [0, 1].map(index => new Promise(resolve => { started[index] = resolve; }));
  const exported = load(text, {
    './mcpStdioSession.cjs': { sendRpc(session, method) {
      assert.equal(session, entry.session); const index = method === 'first' ? 0 : 1;
      calls.push(['send', index]); started[index]();
      return new Promise((resolve, reject) => { release[index] = { resolve, reject }; });
    } },
    './mcpStdioIdleEviction.cjs': { clearEntryIdleTimer() { calls.push(['clear']); } },
  });
  const run = exported.createMcpPoolRpc({ entries, getEntry: () => entry, restartPolicy: { getStatus: () => ({ consecutiveFailures: 0 }), recordSuccess() {} }, history: null,
    scheduleIdleEviction() { calls.push(['schedule']); },
    discardEntry() { calls.push(['discard']); entries.delete('server'); return { closeEvent: {} }; },
    recordRestartFailure() { calls.push(['failure']); },
  });
  const first = run({ id: 'server' }, 'first', {}, 42), second = run({ id: 'server' }, 'second', {}, 42);
  const settledFirst = first.then(value => ({ value }), error => ({ error }));
  await Promise.resolve(); await Promise.resolve();
  assert.ok(!calls.some(call => call[0] === 'send'), 'RPC must wait for initialization');
  initialize();
  const premature = promise => promise.then(() => { throw new Error('RPC settled before expected transport start'); });
  await Promise.race([starts[0], premature(settledFirst)]);
  assert.deepEqual(calls.filter(call => call[0] === 'send'), [['send', 0]], 'Second call must remain queued');
  if (replace) entries.set('server', replacement);
  const failure = new Error('first failed');
  if (firstFails) release[0].reject(failure); else release[0].resolve('first result');
  await Promise.race([starts[1], premature(second)]);
  release[1].resolve('second result');
  const firstResult = await settledFirst;
  if (firstFails) assert.equal(firstResult.error, failure); else assert.equal(firstResult.value, 'first result');
  assert.equal(await second, 'second result');
  assert.deepEqual(calls.filter(call => call[0] === 'send'), [['send', 0], ['send', 1]]);
  if (replace) { assert.equal(entries.get('server'), replacement); assert.ok(!calls.some(call => call[0] === 'discard')); }
}

function checkControls(text, reason) {
  const calls = [], entries = new Map([['a', {}], ['b', {}]]), events = new Map(), statuses = {};
  const policy = { reset(id) { calls.push(['reset', id]); }, resetAll() { calls.push(['reset-all']); } };
  const exported = load(text, { './mcpStdioSessionPoolStatus.cjs': { createSessionPoolStatuses(a, b, c, d) { assert.equal(a, entries); assert.equal(b, events); assert.equal(c, policy); assert.equal(d, 42); return statuses; } } });
  const control = exported.createMcpPoolControls({ entries, lastCloseEvents: events, restartPolicy: policy, idleTimeoutMs: 42,
    discardEntry(id, why) { calls.push(['discard', id, why]); entries.delete(id); if (id === 'a') entries.set('added', {}); return { closed: true }; },
  });
  assert.equal(control.getStatus(), statuses);
  assert.equal(control.dispose(reason), 2);
  assert.deepEqual([...entries.keys()], ['added'], 'Dispose must iterate the original key snapshot');
  assert.deepEqual(calls.filter(call => call[0] === 'discard').map(call => call[1]), ['a', 'b']);
  return calls;
}

(async () => {
  const results = [];
  for (const previousFailed of [false, true]) for (const entryMode of ['original', 'replacement', 'missing']) for (const recovering of [0, 1]) {
    for (const mode of ['normal', 'rpc-reject', 'ready-reject', 'get-throw', 'clear-throw', 'status-throw', 'success-throw', 'history-throw', 'schedule-throw', 'discard-throw', 'failure-record-throw', 'now-throw']) for (const observer of ['normal', 'absent']) {
      const result = await scenario(source, previousFailed, entryMode, recovering, mode, observer);
      if (previous) assert.deepEqual(result, await scenario(previous, previousFailed, entryMode, recovering, mode, observer));
      results.push(result);
    }
  }
  for (const previousFailed of [false, true]) for (const firstFails of [false, true]) for (const replace of [false, true]) {
    await checkQueue(source, previousFailed, firstFails, replace);
    if (previous) await checkQueue(previous, previousFailed, firstFails, replace);
  }
  for (const reason of [undefined, null, 'manual-reset', 'custom']) {
    const result = checkControls(controls, reason);
    if (previousControls) assert.deepEqual(result, checkControls(previousControls, reason));
    results.push(result);
  }
  const digest = crypto.createHash('sha256').update(JSON.stringify(results)).digest('hex');
  const expected = 'be868fb93b1cef0572a307a6a04e59190094ba4aeb643d391f697ee1b75bc407';
  assert.equal(digest, expected);
  console.log(`MCP pool RPC passed: ${results.length} cases, 8 concurrent queue scenarios; ${digest}; controlled transport/state boundaries only.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
