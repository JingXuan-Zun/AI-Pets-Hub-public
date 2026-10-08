const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../electron');
const source = fs.readFileSync(path.join(root, 'mcpStdioPoolEntry.cjs'), 'utf8');
const parse = text => ts.createSourceFile('fixture.cjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
function functions(tree) {
  const found = [];
  function walk(node) { if (ts.isFunctionDeclaration(node)) found.push(node); ts.forEachChild(node, walk); }
  walk(tree); return found;
}
const ast = parse(source);
assert.ok(source.split('\n').length <= 300);
for (const fn of functions(ast)) assert.ok(ast.getLineAndCharacterOfPosition(fn.end).line - ast.getLineAndCharacterOfPosition(fn.getStart(ast)).line + 1 <= 50);
let previous;
if (process.argv[2]) {
  const oldAst = parse(fs.readFileSync(process.argv[2], 'utf8'));
  const names = ['createSessionKey', 'createPoolEntry', 'shouldReuseEntry', 'getEntry'];
  const original = functions(oldAst).filter(fn => names.includes(fn.name.text));
  assert.equal(original.length, 4);
  previous = "const { createMcpProcess, initializeMcpSession } = require('./mcpStdioSession.cjs');\n" + original.filter(fn => fn.name.text !== 'getEntry').map(fn => fn.getText(oldAst)).join('\n') + '\nfunction createMcpPoolEntryGetter({ entries, log, history, restartPolicy, discardEntry, recordRestartFailure, scheduleIdleEviction }) {\n' + original.find(fn => fn.name.text === 'getEntry').getText(oldAst) + '\nreturn getEntry;\n}\nmodule.exports = { createMcpPoolEntryGetter };';
}

function scenario(text, currentMode, gateMode, failureMode, serverMode, observer) {
  const calls = [];
  const injected = new Error('injected ' + failureMode);
  const fail = name => { if (failureMode === name) throw injected; };
  class Entries extends Map {
    get(id) { calls.push(['get', id]); return super.get(id); }
    set(id, entry) { calls.push(['store', id]); fail('store'); return super.set(id, entry); }
  }
  const entries = new Entries();
  const existing = { key: ['server', 'fixture', '[]', undefined].join('\u001f') + (currentMode === 'changed' ? '-changed' : ''), session: { closed: currentMode === 'closed' } };
  if (currentMode !== 'none') Map.prototype.set.call(entries, 'server', existing);
  const circular = []; circular.push(circular);
  let argReads = 0;
  const server = {
    get id() { calls.push(['id']); if (serverMode === 'id-throw') throw new Error('id getter failure'); return 'server'; },
    command: 'fixture',
    get args() {
      calls.push(['args']); argReads += 1;
      if (serverMode === 'args-throw') throw new Error('args getter failure');
      if (serverMode === 'args-circular') return circular;
      if (serverMode === 'args-changing') return argReads === 1 ? [] : ['changed'];
      return [];
    },
  };
  const log = () => {};
  const ready = Promise.resolve('ready');
  const session = { marker: 'created-session' };
  const restartPolicy = {
    reset(id) { assert.equal(this, restartPolicy); calls.push(['reset', id]); fail('reset'); },
    getGate(id) {
      assert.equal(this, restartPolicy); calls.push(['gate', id]);
      if (gateMode === 'throw') throw new Error('gate failure');
      if (gateMode === 'null') return null;
      return { allowed: gateMode === 'allowed', reason: 'blocked', waitMs: gateMode === 'blocked-fraction' ? 2.3 : 0 };
    },
    recordStart(id) { assert.equal(this, restartPolicy); calls.push(['start', id]); fail('start'); },
  };
  const history = observer === 'absent' ? null : { recordSessionEvent(event) {
    assert.equal(this, history); calls.push(['history', event]);
    if (observer === 'throw') throw new Error('history failure');
  } };
  const module = { exports: {} };
  new Function('require', 'module', 'Date', text)(name => {
    assert.equal(name, './mcpStdioSession.cjs');
    return {
      createMcpProcess(received, logger) { assert.equal(received, server); assert.equal(logger, log); calls.push(['create']); fail('create'); return session; },
      initializeMcpSession(received, config) { assert.equal(received, session); assert.equal(config, server); calls.push(['initialize']); fail('initialize'); return ready; },
    };
  }, module, { now() { calls.push(['now']); return 1234; } });
  const getEntry = module.exports.createMcpPoolEntryGetter({
    entries, log, history, restartPolicy,
    discardEntry(id, reason) { calls.push(['discard', id, reason]); fail('discard'); entries.delete(id); return { closeEvent: { kind: 'crash' } }; },
    recordRestartFailure(id, event) { calls.push(['record-failure', id, event]); fail('failure-record'); },
    scheduleIdleEviction(id, entry) { calls.push(['schedule', id]); assert.equal(Map.prototype.get.call(entries, id), entry); fail('schedule'); },
  });
  assert.deepEqual(calls, [], 'Entry getter assembly must not access state or start sessions');
  let outcome;
  try {
    const entry = getEntry(server);
    if (entry === existing) {
      assert.ok(!calls.some(call => ['discard', 'gate', 'reset', 'start', 'create', 'store', 'schedule'].includes(call[0])));
      outcome = { reused: true };
    } else {
      assert.equal(entry.session, session);
      assert.equal(entry.ready, ready, 'Initialization Promise identity must be preserved');
      assert.equal(entry.idleTimer, null);
      assert.equal(entry.lastUsedAt, 1234);
      assert.equal(Map.prototype.get.call(entries, 'server'), entry);
      outcome = { reused: false, key: entry.key };
    }
  } catch (error) {
    if (error instanceof assert.AssertionError) throw error;
    if (error.message === injected.message) assert.equal(error, injected);
    outcome = { error: error.message };
  }
  const kinds = calls.map(call => call[0]);
  if (kinds.includes('reset')) assert.ok(kinds.indexOf('discard') < kinds.indexOf('reset'));
  if (kinds.includes('gate')) assert.ok(kinds.indexOf('discard') < kinds.indexOf('gate'));
  if (kinds.includes('create')) assert.ok(kinds.indexOf('start') < kinds.indexOf('create'));
  if (kinds.includes('store')) assert.ok(kinds.indexOf('initialize') < kinds.indexOf('store'));
  if (kinds.includes('schedule')) assert.ok(kinds.indexOf('store') < kinds.indexOf('schedule'));
  if (outcome.error?.startsWith('blocked')) assert.ok(!kinds.includes('start') && !kinds.includes('create'));
  return { outcome, calls, remaining: entries.size };
}

const results = [];
for (const currentMode of ['none', 'open', 'closed', 'changed']) for (const gateMode of ['allowed', 'blocked-zero', 'blocked-fraction', 'throw', 'null']) {
  for (const failureMode of ['none', 'discard', 'reset', 'failure-record', 'start', 'create', 'initialize', 'schedule', 'store']) {
    for (const serverMode of ['normal', 'id-throw', 'args-throw', 'args-changing', 'args-circular']) for (const observer of ['normal', 'absent', 'throw']) {
      const result = scenario(source, currentMode, gateMode, failureMode, serverMode, observer);
      if (previous) assert.deepEqual(result, scenario(previous, currentMode, gateMode, failureMode, serverMode, observer));
      results.push(result);
    }
  }
}
const digest = crypto.createHash('sha256').update(JSON.stringify(results)).digest('hex');
const expected = '8c08849473a59282dd75c093837ba8fb1c06078945fa3352e7994855da077fb3';
assert.equal(digest, expected);
console.log(`MCP pool entry passed: ${results.length} cases; ${digest}; reuse/config replacement/restart gate/create/store ordering; controlled process/policy/observer boundaries only.`);
