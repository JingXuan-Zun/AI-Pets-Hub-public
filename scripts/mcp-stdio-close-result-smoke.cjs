const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.resolve(__dirname, '../electron/mcpStdioSession.cjs'), 'utf8');

function scenario(fixture) {
  const calls = [], rejected = [];
  const killError = new Error('direct kill failure');
  const state = {
    closed: fixture.closed,
    pending: new Map(Array.from({ length: fixture.pending }, (_, i) => [i, {
      timeoutId: i + 10,
      reject(error) { calls.push(['reject', i]); rejected.push(error); },
    }])),
    child: {
      pid: fixture.pid,
      stdin: { end() { calls.push(['end']); if (fixture.endError) throw new Error('stdin failure'); } },
      kill() { calls.push(['kill']); if (fixture.kill === 'throw') throw killError; return fixture.kill; },
    },
  };
  const module = { exports: {} };
  const hostRequire = name => {
    if (name === 'child_process') return {
      spawn() { throw new Error('No process spawning in close regression'); },
      execFileSync(command, args, options) {
        calls.push(['taskkill', command, args, options]);
        if (fixture.taskkillError) throw new Error('tree kill failure');
        return Buffer.alloc(0);
      },
    };
    if (name === './mcpChildEnvironment.cjs') return { createMcpChildEnvironment() { throw new Error('Unused environment boundary'); } };
    if (name === './mcpStdioSpawnSpec.cjs') return { createMcpStdioSpawnSpec() { throw new Error('Unused spawn boundary'); } };
    throw new Error('Unexpected boundary: ' + name);
  };
  new Function('require', 'module', 'process', 'clearTimeout', source)(hostRequire, module, { platform: fixture.platform }, id => calls.push(['clear', id]));
  let result;
  try { result = { value: module.exports.closeMcpProcess(state, 'cancelled') }; }
  catch (error) { assert.equal(error, killError); result = { error: error.message }; }
  if (fixture.closed) {
    assert.deepEqual(result, { value: false });
    assert.deepEqual(calls, []);
    assert.equal(state.pending.size, fixture.pending);
    return;
  }
  assert.equal(state.closed, true);
  assert.equal(state.closeReason, 'cancelled');
  assert.equal(state.pending.size, 0);
  assert.equal(rejected.length, fixture.pending);
  for (const error of rejected) assert.equal(error.message, 'MCP session closed: cancelled');
  if (rejected.length > 1) assert.equal(rejected[0], rejected[1]);
  const treeAttempted = fixture.platform === 'win32' && Boolean(fixture.pid);
  const treeSucceeded = treeAttempted && !fixture.taskkillError;
  assert.deepEqual(result, treeSucceeded ? { value: true } : fixture.kill === 'throw' ? { error: 'direct kill failure' } : { value: fixture.kill }, 'Successful process-tree termination must not become a false cancellation');
  const expectedCalls = [['end']];
  for (let i = 0; i < fixture.pending; i++) expectedCalls.push(['clear', i + 10], ['reject', i]);
  if (treeAttempted) expectedCalls.push(['taskkill', 'taskkill', ['/pid', String(fixture.pid), '/T', '/F'], { stdio: 'ignore' }]);
  if (!treeSucceeded) expectedCalls.push(['kill']);
  assert.deepEqual(calls, expectedCalls);
  const before = calls.length;
  assert.equal(module.exports.closeMcpProcess(state, 'again'), false);
  assert.equal(calls.length, before, 'Duplicate close must not terminate or reject twice');
}

let cases = 0;
for (const platform of ['win32', 'linux']) {
  for (const pid of [undefined, 42]) {
    for (const taskkillError of [false, true]) {
      for (const kill of [false, true, 'throw']) {
        for (const closed of [false, true]) {
          for (const endError of [false, true]) {
            for (const pending of [0, 2]) {
              scenario({ platform, pid, taskkillError, kill, closed, endError, pending });
              cases++;
            }
          }
        }
      }
    }
  }
}
const ast = ts.createSourceFile('session.cjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const close = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'closeMcpProcess');
assert.ok(ast.getLineAndCharacterOfPosition(close.end).line - ast.getLineAndCharacterOfPosition(close.getStart(ast)).line + 1 <= 50);
assert.ok(source.split('\n').length <= 300);
console.log(`MCP close result passed: ${cases} tree/direct termination, closed state, stdin failure and pending RPC cases; tree success is true, fallback and duplicate close semantics preserved; no real processes.`);
