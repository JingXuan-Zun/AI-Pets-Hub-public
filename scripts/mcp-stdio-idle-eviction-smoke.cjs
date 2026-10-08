const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../electron');
const source = fs.readFileSync(path.join(root, 'mcpStdioSessionPool.cjs'), 'utf8');
const idle = fs.readFileSync(path.join(root, 'mcpStdioIdleEviction.cjs'), 'utf8');
const closure = fs.readFileSync(path.join(root, 'mcpStdioPoolClosure.cjs'), 'utf8');
const entryText = fs.readFileSync(path.join(root, 'mcpStdioPoolEntry.cjs'), 'utf8');
const rpcText = fs.readFileSync(path.join(root, 'mcpStdioPoolRpc.cjs'), 'utf8');
const controlsText = fs.readFileSync(path.join(root, 'mcpStdioPoolControls.cjs'), 'utf8');
const previous = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const parse = text => ts.createSourceFile('fixture.cjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const idleAst = parse(idle);
assert.ok(idle.split('\n').length <= 300);
function functions(tree) {
  const found = [];
  function walk(node) { if (ts.isFunctionDeclaration(node)) found.push(node); ts.forEachChild(node, walk); }
  walk(tree); return found;
}
for (const fn of functions(idleAst)) assert.ok(idleAst.getLineAndCharacterOfPosition(fn.end).line - idleAst.getLineAndCharacterOfPosition(fn.getStart(idleAst)).line + 1 <= 50);
if (previous) {
  const oldAst = parse(previous), nextAst = parse(source), printer = ts.createPrinter();
  const print = (fn, tree) => printer.printNode(ts.EmitHint.Unspecified, fn, tree);
  const nextFunctions = [nextAst, idleAst, parse(closure), parse(entryText), parse(rpcText), parse(controlsText)].flatMap(tree => functions(tree).map(fn => ({ fn, tree })));
  for (const fn of functions(oldAst).filter(fn => fn.name.text !== 'createMcpStdioSessionPool')) {
    const next = nextFunctions.find(item => item.fn.name.text === fn.name.text);
    assert.ok(next, 'Missing original function: ' + fn.name.text);
    assert.equal(print(fn, oldAst), print(next.fn, next.tree), 'Moved and remaining pool functions must stay unchanged');
  }
  const factoryState = tree => tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createMcpStdioSessionPool').body.statements.filter(n => !ts.isFunctionDeclaration(n) && !(ts.isVariableStatement(n) && /createMcp(?:IdleEviction|PoolClosure|PoolEntryGetter|PoolRpc|PoolControls)\(/.test(n.getText(tree)))).map(n => print(n, tree));
  assert.deepEqual(factoryState(oldAst), factoryState(nextAst), 'Pool state and API assembly must stay unchanged');
}

async function scenario(text, idleTimeoutMs, pendingSize, timerMode, action, closeMode) {
  const calls = [], timers = [], sessions = [];
  let now = 100;
  const closeError = new Error('close failure');
  const restartPolicy = {
    reset(id) { calls.push(['reset', id]); }, resetAll() { calls.push(['reset-all']); },
    recordStart(id) { calls.push(['restart-start', id]); }, recordSuccess(id) { calls.push(['restart-success', id]); },
    getGate(id) { calls.push(['gate', id]); return { allowed: true }; },
    getStatus() { return { consecutiveFailures: 0 }; },
    recordFailure(id, error) { calls.push(['restart-failure', id, String(error)]); return { lastError: String(error), restartWaitMs: 0 }; },
  };
  const sessionHost = {
    createMcpProcess(server) {
      const session = { id: sessions.length, closed: false, pending: new Map() };
      sessions.push(session); calls.push(['create', session.id, server.id]); return session;
    },
    initializeMcpSession(session) { calls.push(['initialize', session.id]); return Promise.resolve(); },
    sendRpc(session, method) { calls.push(['rpc', session.id, method]); return Promise.resolve({ ok: true }); },
    closeMcpProcess(session, reason) {
      calls.push(['close', session.id, reason]);
      if (closeMode === 'throw') throw closeError;
      session.closed = true; session.closeReason = reason; return closeMode;
    },
  };
  const fakeSetTimeout = (callback, delay) => {
    const timer = { id: timers.length, callback };
    Object.defineProperty(timer, 'unref', { get() {
      calls.push(['unref-get', timer.id]);
      if (timerMode === 'getter-throw') throw new Error('unref getter failure');
      if (timerMode === 'missing') return undefined;
      return function () { assert.equal(this, timer); calls.push(['unref', timer.id]); };
    } });
    timers.push(timer); calls.push(['set', timer.id, delay]); return timer;
  };
  const fakeClearTimeout = timer => { calls.push(['clear', timer.id]); };
  const fakeDate = { now() { calls.push(['now']); return ++now; } };
  const boundaries = {
    './mcpStdioSession.cjs': sessionHost,
    './mcpStdioSessionCloseReason.cjs': require('../electron/mcpStdioSessionCloseReason.cjs'),
    './mcpStdioSessionRestartPolicy.cjs': {},
    './mcpStdioSessionPoolStatus.cjs': { createSessionPoolStatuses(entries, events) {
      return { active: [...entries].map(([id, entry]) => [id, entry.session.id, entry.idleTimer?.id ?? null, entry.session.closed]), events: [...events] };
    } },
  };
  const requireLocal = name => {
    if (name === './mcpStdioPoolRpc.cjs' || name === './mcpStdioPoolControls.cjs') {
      const module = { exports: {} };
      new Function('require', 'module', 'Date', name === './mcpStdioPoolRpc.cjs' ? rpcText : controlsText)(requireLocal, module, fakeDate);
      return module.exports;
    }
    if (name === './mcpStdioPoolEntry.cjs') {
      const module = { exports: {} };
      new Function('require', 'module', 'Date', entryText)(requireLocal, module, fakeDate);
      return module.exports;
    }
    if (name === './mcpStdioPoolClosure.cjs') {
      const module = { exports: {} };
      new Function('require', 'module', 'Date', closure)(requireLocal, module, fakeDate);
      return module.exports;
    }
    if (name === './mcpStdioIdleEviction.cjs') {
      const module = { exports: {} };
      new Function('module', 'setTimeout', 'clearTimeout', idle)(module, fakeSetTimeout, fakeClearTimeout);
      return module.exports;
    }
    assert.ok(Object.hasOwn(boundaries, name), 'Unexpected pool boundary: ' + name);
    return boundaries[name];
  };
  const module = { exports: {} };
  new Function('require', 'module', 'Date', 'setTimeout', 'clearTimeout', text)(requireLocal, module, fakeDate, fakeSetTimeout, fakeClearTimeout);
  const pool = module.exports.createMcpStdioSessionPool({ idleTimeoutMs, restartPolicy, history: { recordSessionEvent: event => calls.push(['history', event]) } });
  assert.deepEqual(calls, [], 'Pool assembly must not start sessions or timers');
  const server = { id: 'fixture', command: 'fixture', args: [] };
  const outcome = [];
  const capture = async (name, callback) => {
    try { outcome.push([name, await callback()]); }
    catch (error) {
      if (error instanceof assert.AssertionError) throw error;
      if (error.message === 'close failure') assert.equal(error, closeError);
      outcome.push([name, { error: error.message }]);
    }
  };
  await capture('rpc', () => pool.runRpc(server, 'tools/list', {}, 100));
  const selected = timers.at(-1), session = sessions.at(-1);
  if (session) session.pending = pendingSize === null ? null : new Map(Array.from({ length: pendingSize }, (_, index) => [index, {}]));
  if (action === 'stale') await capture('replacement', () => pool.runRpc({ ...server, args: ['changed'] }, 'tools/list', {}, 100));
  if (action === 'discard' || action === 'reset') await capture(action, () => pool.discard(server.id, action === 'reset' ? 'manual-reset' : 'cancelled'));
  if (action === 'dispose') await capture('dispose', () => pool.dispose('client-dispose'));
  if (action === 'closed' && session) session.closed = true;
  const before = calls.length;
  if (selected) await capture('timer', () => { calls.push(['fire', selected.id]); return selected.callback(); });
  const tick = calls.slice(before);
  if (['stale', 'discard', 'reset', 'dispose', 'closed'].includes(action)) assert.ok(!tick.some(call => call[0] === 'close'), 'Stale/removed/closed entries must not be closed by old timers');
  if (action === 'fire' && selected && pendingSize === 1) {
    assert.ok(!tick.some(call => call[0] === 'close'));
    assert.ok(tick.some(call => call[0] === 'set'), 'Pending requests must reschedule idle eviction');
  }
  if (action === 'fire' && selected && pendingSize !== 1) assert.ok(tick.some(call => call[0] === 'close' && call[2] === 'idle-timeout'));
  const status = pool.getStatus();
  await capture('cleanup', () => pool.dispose('client-dispose'));
  return { outcome, calls, status };
}

(async () => {
  const results = [];
  for (const idleTimeoutMs of [undefined, 0, -5, 10, '10', 'bad']) for (const pendingSize of [null, 0, 1]) {
    for (const timerMode of ['normal', 'missing', 'getter-throw']) for (const action of ['fire', 'stale', 'discard', 'reset', 'dispose', 'closed']) {
      for (const closeMode of [true, false, 'throw']) {
        const result = await scenario(source, idleTimeoutMs, pendingSize, timerMode, action, closeMode);
        if (previous) assert.deepEqual(result, await scenario(previous, idleTimeoutMs, pendingSize, timerMode, action, closeMode));
        results.push(result);
      }
    }
  }
  const digest = crypto.createHash('sha256').update(JSON.stringify(results)).digest('hex');
  const expected = '8428427ec54653cf0bffb630e39733eec6c0ea2c97ea510fe2eabfa42439974e';
  assert.equal(digest, expected);
  console.log(`MCP idle eviction passed: ${results.length} actual-pool cases; ${digest}; virtual timers/process boundaries only.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
