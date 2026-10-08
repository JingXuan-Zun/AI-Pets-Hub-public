const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../electron');
const source = fs.readFileSync(path.join(root, 'mcpStdioClientService.cjs'), 'utf8');
const management = fs.readFileSync(path.join(root, 'mcpStdioSessionManagement.cjs'), 'utf8');
const previous = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const parse = text => ts.createSourceFile('fixture.cjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const ast = parse(management);
assert.ok(management.split('\n').length <= 300);
const names = [];
function checkFunctions(node) {
  if (ts.isFunctionDeclaration(node)) {
    names.push(node.name.text);
    assert.ok(ast.getLineAndCharacterOfPosition(node.end).line - ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 <= 50);
  }
  ts.forEachChild(node, checkFunctions);
}
checkFunctions(ast);
assert.deepEqual(names, ['createMcpSessionManagement', 'dispose', 'getSessionStatus', 'resetSession']);
if (previous) {
  const printer = ts.createPrinter();
  const unchanged = text => {
    const tree = parse(text);
    const factory = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createMcpStdioClientService');
    return factory.body.statements.filter(n => !(ts.isFunctionDeclaration(n) && ['dispose', 'getSessionStatus', 'resetSession'].includes(n.name.text)) && !(ts.isVariableStatement(n) && n.getText(tree).includes('createMcpSessionManagement('))).map(n => printer.printNode(ts.EmitHint.Unspecified, n, tree));
  };
  assert.deepEqual(unchanged(source), unchanged(previous), 'Other root methods and pool/state construction must stay unchanged');
}

function load(text, options, fakeDate, createPool) {
  const module = { exports: {} };
  new Function('require', 'module', '__dirname', 'Date', text)(name => {
    if (name === 'path') return path;
    if (name === './mcpStdioToolCallHandler.cjs') return require('../electron/mcpStdioToolCallHandler.cjs');
    if (name === './mcpStdioToolCatalog.cjs') return require('../electron/mcpStdioToolCatalog.cjs');
    if (name === './mcpStdioSessionManagement.cjs') {
      const child = { exports: {} };
      new Function('module', 'Date', management)(child, fakeDate);
      return child.exports;
    }
    if (name === './mcpStdioSessionPool.cjs') return { createMcpStdioSessionPool: createPool };
    return {};
  }, module, root, fakeDate);
  return module.exports.createMcpStdioClientService(options);
}

function scenario(text, action, input, poolMode, returnValue, methodMode, clockThrows = false) {
  const calls = [];
  const methodError = new Error('pool method failure');
  const pool = {};
  for (const name of ['discard', 'dispose', 'getStatus']) {
    Object.defineProperty(pool, name, {
      get() {
        calls.push(['method-get', name]);
        if (methodMode === 'getter-throw') throw new Error('pool getter failure');
        if (methodMode === 'missing') return undefined;
        if (methodMode === 'noncallable') return 7;
        return function (...args) {
          assert.equal(this, pool);
          calls.push(['method-call', name, args]);
          if (methodMode === 'throw') throw methodError;
          return returnValue;
        };
      },
    });
  }
  const history = {}, log = () => {};
  const options = { reuseSessions: poolMode !== 'none', sessionPool: poolMode === 'created' ? null : pool, history, log, idleSessionTimeoutMs: 42 };
  const fakeDate = { now() { calls.push(['now']); if (clockThrows) throw new Error('clock failure'); return 1234; } };
  const client = load(text, options, fakeDate, received => {
    assert.deepEqual(received, { history, idleTimeoutMs: 42, log });
    calls.push(['pool-create']);
    return pool;
  });
  assert.deepEqual(calls, poolMode === 'created' ? [['pool-create']] : [], 'Assembly must not read pool methods or clock');
  assert.deepEqual(Object.keys(client), ['callTool', 'cancelToolCall', 'dispose', 'getSessionStatus', 'listServers', 'listTools', 'resetSession']);
  for (const name of ['dispose', 'getSessionStatus', 'resetSession']) assert.equal(client[name].name, name);
  let reads = 0;
  const request = input === 'null' ? null : input === 'undefined' ? undefined : input === 'absent' ? {} : {
    get serverId() {
      calls.push(['serverId']); reads += 1;
      if (input === 'throw') throw new Error('request getter failure');
      if (input === 'changing') return reads === 1 ? 'server' : 7;
      return { normal: 'server', whitespace: ' server ', blank: ' ', nonstring: 7, missing: 'missing' }[input];
    },
  };
  let outcome;
  try {
    const value = action === 'reset' ? client.resetSession(request) : action === 'dispose' ? client.dispose(input) : client.getSessionStatus();
    if (poolMode !== 'none' && methodMode === 'normal' && action !== 'reset' && returnValue != null) assert.equal(value, returnValue, 'Raw pool result identity must be preserved');
    if (action === 'reset') {
      if (poolMode === 'none') assert.ok(!Object.hasOwn(value, 'closedAt'));
      else assert.equal(value.closedAt, value.closedCount ? 1234 : null);
    }
    outcome = { value };
  } catch (error) {
    if (error.message === 'pool method failure') assert.equal(error, methodError);
    outcome = { error: error.message };
  }
  const methodCalls = calls.filter(call => call[0] === 'method-call');
  if (poolMode === 'none') assert.equal(methodCalls.length, 0);
  if (action === 'reset' && methodCalls.length) {
    const hasId = ['normal', 'whitespace', 'missing'].includes(input);
    assert.equal(methodCalls[0][1], hasId ? 'discard' : 'dispose');
    assert.equal(methodCalls[0][2].at(-1), 'manual-reset');
    if (hasId && outcome.value) assert.equal(outcome.value.closedCount, Number(Boolean(returnValue)));
    if (!hasId && outcome.value) assert.equal(outcome.value.closedCount, returnValue);
  }
  if (action !== 'reset') assert.ok(!calls.some(call => call[0] === 'now'));
  if (calls.some(call => call[0] === 'now')) assert.ok(methodCalls.length === 1);
  return { outcome, calls };
}

function checkIsolation(text) {
  const pools = [], calls = [];
  const createPool = () => {
    const index = pools.length;
    const pool = { getStatus: () => pool.status, status: [{ serverId: `server-${index}` }], discard(id, reason) { calls.push([index, id, reason]); this.status = []; return true; }, dispose(reason) { calls.push([index, reason]); this.status = []; return 1; } };
    pools.push(pool); return pool;
  };
  const first = load(text, { reuseSessions: true }, { now: () => 1 }, createPool);
  const second = load(text, { reuseSessions: true }, { now: () => 1 }, createPool);
  assert.notEqual(pools[0], pools[1]);
  const firstStatus = first.getSessionStatus();
  assert.equal(firstStatus, pools[0].status);
  first.resetSession({ serverId: 'server-0' });
  assert.equal(second.getSessionStatus().length, 1);
  second.dispose();
  assert.deepEqual(calls, [[0, 'server-0', 'manual-reset'], [1, 'client-dispose']]);
}

const results = [];
for (const action of ['reset', 'dispose', 'status']) {
  const inputs = action === 'reset' ? ['normal', 'whitespace', 'blank', 'nonstring', 'null', 'undefined', 'absent', 'throw', 'changing', 'missing'] : action === 'dispose' ? [undefined, null, '', 'manual', { reason: 'fixture' }] : [undefined];
  for (const input of inputs) for (const poolMode of ['none', 'supplied', 'created']) {
    for (const value of [undefined, null, false, 0, 1, 2, '2', NaN, {}, []]) {
      for (const methodMode of ['normal', 'throw', 'getter-throw', 'missing', 'noncallable']) {
        const result = scenario(source, action, input, poolMode, value, methodMode);
        if (previous) assert.deepEqual(result, scenario(previous, action, input, poolMode, value, methodMode));
        results.push(result);
      }
    }
  }
}
for (const input of ['normal', 'blank']) for (const value of [0, 1]) {
  const result = scenario(source, 'reset', input, 'supplied', value, 'normal', true);
  if (previous) assert.deepEqual(result, scenario(previous, 'reset', input, 'supplied', value, 'normal', true));
  results.push(result);
}
checkIsolation(source);
if (previous) checkIsolation(previous);
const digest = crypto.createHash('sha256').update(JSON.stringify(results, (_, value) => value === undefined ? '$undefined' : Number.isNaN(value) ? '$NaN' : value)).digest('hex');
const expected = 'fc072a33b3138396d7343255bfbeb48205341de2ff9a8e334f03cb9e6892450e';
assert.equal(digest, expected);
console.log(`MCP session management passed: ${results.length} real-root cases; ${digest}; raw result identity, clock order and two-instance pool isolation; controlled pool boundaries only.`);
