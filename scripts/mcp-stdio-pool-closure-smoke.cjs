const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../electron');
const source = fs.readFileSync(path.join(root, 'mcpStdioPoolClosure.cjs'), 'utf8');
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
  const names = ['shouldRecordRestartFailure', 'createCloseEvent', 'closeEntry', 'getEntryCloseReason', 'discardEntry', 'recordRestartFailure'];
  const original = functions(oldAst).filter(fn => names.includes(fn.name.text));
  assert.equal(original.length, 6);
  const top = original.filter(fn => ['shouldRecordRestartFailure', 'createCloseEvent', 'closeEntry'].includes(fn.name.text));
  const nested = original.filter(fn => !top.includes(fn));
  previous = "const { closeMcpProcess } = require('./mcpStdioSession.cjs');\nconst { normalizeMcpSessionCloseReason } = require('./mcpStdioSessionCloseReason.cjs');\nconst { clearEntryIdleTimer } = require('./mcpStdioIdleEviction.cjs');\n" + top.map(fn => fn.getText(oldAst)).join('\n') + '\nfunction createMcpPoolClosure({ entries, lastCloseEvents, restartPolicy, history }) {\n' + nested.map(fn => fn.getText(oldAst)).join('\n') + '\nreturn { discardEntry, recordRestartFailure };\n}\nmodule.exports = { createMcpPoolClosure };';
}

function scenario(text, present, closed, reason, existingReason, closeMode, mapMode, observer, failureMode) {
  const calls = [];
  const closeError = new Error('close failure'), failureError = new Error('restart failure');
  class Entries extends Map {
    get(id) { calls.push(['get', id]); if (mapMode === 'get-throw') throw new Error('get failure'); return super.get(id); }
    delete(id) { calls.push(['delete', id]); if (mapMode === 'delete-throw') throw new Error('delete failure'); return super.delete(id); }
  }
  class Events extends Map {
    set(id, value) { calls.push(['event', id, value]); if (mapMode === 'set-throw') throw new Error('set failure'); return super.set(id, value); }
  }
  const entries = new Entries(), events = new Events();
  const session = { closed, closeReason: existingReason };
  const entry = { session, idleTimer: { id: 1 } };
  if (present) entries.set('server', entry);
  const restartPolicy = { recordFailure(id, error) {
    assert.equal(this, restartPolicy); calls.push(['failure', id, error?.message || error]);
    if (failureMode === 'throw') throw failureError;
    return { lastError: 'recorded error', restartWaitMs: 42 };
  } };
  const history = observer === 'absent' ? null : { recordSessionEvent(event) {
    assert.equal(this, history); calls.push(['history', event]);
    if (observer === 'throw') throw new Error('history failure');
  } };
  const boundaries = {
    './mcpStdioSessionCloseReason.cjs': require('../electron/mcpStdioSessionCloseReason.cjs'),
    './mcpStdioIdleEviction.cjs': {
      clearEntryIdleTimer(value) { assert.equal(value, entry); calls.push(['clear']); value.idleTimer = null; },
    },
    './mcpStdioSession.cjs': { closeMcpProcess(value, why) {
      assert.equal(value, session);
      assert.equal(entries.size, 0, 'Active entry must be deleted before closing');
      assert.equal(events.size, 1, 'Close event must be stored before closing');
      assert.equal(entry.idleTimer, null);
      calls.push(['close', why]);
      if (closeMode === 'throw') throw closeError;
      return closeMode;
    } },
  };
  const module = { exports: {} };
  new Function('require', 'module', 'Date', text)(name => {
    assert.ok(Object.hasOwn(boundaries, name), 'Unexpected closure dependency: ' + name);
    return boundaries[name];
  }, module, { now() { calls.push(['now']); return 1234; } });
  const lifecycle = module.exports.createMcpPoolClosure({ entries, lastCloseEvents: events, restartPolicy, history });
  assert.deepEqual(calls, [], 'Lifecycle assembly must not read maps or observers');
  let outcome;
  try {
    const discarded = lifecycle.discardEntry('server', reason);
    lifecycle.recordRestartFailure('server', discarded.closeEvent, undefined);
    outcome = { value: discarded };
  } catch (error) {
    if (error instanceof assert.AssertionError) throw error;
    if (error.message === 'close failure') assert.equal(error, closeError);
    if (error.message === 'restart failure') assert.equal(error, failureError);
    outcome = { error: error.message };
  }
  if (!present) assert.ok(!calls.some(call => ['now', 'event', 'clear', 'close', 'failure', 'history'].includes(call[0])));
  if (mapMode === 'delete-throw' && present) assert.equal(entries.size, 1);
  if (calls.some(call => call[0] === 'close')) assert.equal(entries.size, 0);
  if (closeMode === 'throw' && calls.some(call => call[0] === 'close')) {
    assert.equal(events.size, 1);
    assert.ok(!calls.some(call => call[0] === 'failure' || call[0] === 'history'));
  }
  return { outcome, calls, entries: entries.size, events: [...events] };
}

const results = [];
for (const present of [false, true]) for (const closed of [false, true]) {
  for (const reason of [undefined, null, 'manual-reset', 'rpc-failed:tools/call']) for (const existingReason of ['', 'cancelled', 'rpc-failed:tools/list']) {
    for (const closeMode of [true, false, 'throw']) for (const mapMode of ['normal', 'get-throw', 'delete-throw', 'set-throw']) {
      for (const observer of ['normal', 'absent', 'throw']) for (const failureMode of ['normal', 'throw']) {
        const result = scenario(source, present, closed, reason, existingReason, closeMode, mapMode, observer, failureMode);
        if (previous) assert.deepEqual(result, scenario(previous, present, closed, reason, existingReason, closeMode, mapMode, observer, failureMode));
        results.push(result);
      }
    }
  }
}
const digest = crypto.createHash('sha256').update(JSON.stringify(results)).digest('hex');
const expected = '1be67245b94b2de0d68076bf208e04dd8a65d65fa9b84978a79b00e99b1ba7e1';
assert.equal(digest, expected);
console.log(`MCP pool closure passed: ${results.length} cases; ${digest}; deletion/event/close/failure order and original errors; controlled map/process/observer boundaries only.`);
