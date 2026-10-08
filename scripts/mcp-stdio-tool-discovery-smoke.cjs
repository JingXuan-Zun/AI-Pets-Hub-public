const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { normalizeMcpTool } = require('../electron/mcpServerConfigLoader.cjs');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'electron/mcpStdioToolDiscovery.cjs'), 'utf8');
const parse = text => ts.createSourceFile('fixture.cjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const ast = parse(source);
const names = ['recordListFailure', 'listToolsForServer', 'listToolsWithPooledSession'];
const functions = ast.statements.filter(ts.isFunctionDeclaration);
assert.deepEqual(functions.map(n => n.name.text), names);
assert.ok(source.split('\n').length <= 300);
for (const fn of functions) assert.ok(ast.getLineAndCharacterOfPosition(fn.end).line - ast.getLineAndCharacterOfPosition(fn.getStart(ast)).line + 1 <= 50);
let previousSource;
if (process.argv[2]) {
  const oldAst = parse(fs.readFileSync(process.argv[2], 'utf8'));
  const moved = oldAst.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name.text));
  assert.deepEqual(moved.map(n => n.getText(oldAst)), functions.map(n => n.getText(ast)));
  previousSource = "const { normalizeMcpTool } = require('./mcpServerConfigLoader.cjs');\nconst { sendRpc, withMcpSession } = require('./mcpStdioSession.cjs');\n" + moved.map(n => n.getText(oldAst)).join('\n') + '\nmodule.exports = { listToolsForServer, listToolsWithPooledSession };';
  const nextAst = parse(fs.readFileSync(path.join(root, 'electron/mcpStdioClientService.cjs'), 'utf8'));
  const printer = ts.createPrinter();
  const print = (n, tree) => printer.printNode(ts.EmitHint.Unspecified, n, tree);
  const imports = n => ts.isVariableStatement(n) && n.getText().includes('require(');
  assert.deepEqual(oldAst.statements.filter(n => !moved.includes(n) && !imports(n)).map(n => print(n, oldAst)), nextAst.statements.filter(n => !imports(n)).map(n => print(n, nextAst)));
}

async function scenario(text, pooled, gate, payload, observer) {
  const calls = [];
  let now = 100;
  const server = { id: 'fixture', title: 'Fixture', timeoutMs: 1234 };
  const log = () => {};
  const session = {};
  function response() {
    if (payload === 'reject') return Promise.reject(new Error('RPC failure'));
    if (payload === 'throw') throw new Error('RPC synchronous failure');
    if (payload === 'null') return Promise.resolve(null);
    if (payload === 'missing') return Promise.resolve({});
    if (payload === 'non-array') return Promise.resolve({ tools: {} });
    if (payload === 'getter') return Promise.resolve({ get tools() { throw new Error('tools getter failure'); } });
    if (payload === 'invalid-tool') return Promise.resolve({ tools: [{ get name() { throw new Error('tool name failure'); } }] });
    return Promise.resolve({ tools: [null, { name: '' }, { name: ' echo ', inputSchema: { type: 'object' }, description: ' Echo ' }] });
  }
  const host = {
    sendRpc(value, method, args, timeout) {
      assert.equal(value, session);
      calls.push(['rpc', method, args, timeout]);
      return response();
    },
    async withMcpSession(value, logger, callback) {
      assert.equal(value, server); assert.equal(logger, log);
      calls.push(['open']);
      try { return await callback(session); }
      finally { calls.push(['close']); }
    },
  };
  const pool = pooled ? { runRpc(value, method, args, timeout) {
    assert.equal(this, pool); assert.equal(value, server);
    calls.push(['pool', method, args, timeout]);
    return response();
  } } : null;
  const health = observer === 'absent' ? undefined : {
    getRetryGate(id) {
      assert.equal(this, health); calls.push(['gate', id]);
      if (gate === 'throw') throw new Error('gate failure');
      return gate === 'none' ? undefined : { allowed: gate === 'allowed' };
    },
    recordSuccess(id) {
      assert.equal(this, health); calls.push(['success', id]);
      if (observer === 'success-throw') throw new Error('success observer failure');
    },
    recordFailure(id, error) {
      assert.equal(this, health); calls.push(['failure', id, error.message]);
      if (observer === 'failure-throw') throw new Error('failure observer failure');
    },
  };
  const history = observer === 'absent' ? undefined : { recordDiagnostic(value) {
    assert.equal(this, history); calls.push(['diagnostic', value]);
    if (observer === 'history-throw') throw new Error('history observer failure');
  } };
  const module = { exports: {} };
  new Function('require', 'module', 'Date', text)(name => {
    if (name === './mcpServerConfigLoader.cjs') return { normalizeMcpTool };
    assert.equal(name, './mcpStdioSession.cjs'); return host;
  }, module, { now: () => { calls.push(['now']); now += 10; return now; } });
  let result;
  try { result = { value: await module.exports.listToolsForServer(server, log, history, health, pool) }; }
  catch (error) { result = { error: error.name, message: error.message }; }
  if (observer !== 'absent' && gate === 'blocked') {
    assert.deepEqual(result, { value: [] });
    assert.deepEqual(calls, [['gate', 'fixture']], 'Cooldown must prevent time lookup and RPC');
  }
  if (observer !== 'absent' && gate === 'throw') assert.deepEqual(calls, [['gate', 'fixture']], 'Gate exception must propagate before discovery observers');
  if (pooled) assert.ok(!calls.some(call => call[0] === 'open' || call[0] === 'close'));
  for (const call of calls.filter(call => call[0] === 'diagnostic')) {
    assert.equal(call[1].durationMs, 10);
    assert.equal(call[1].serverId, 'fixture');
    assert.equal(call[1].toolCount, 0);
    assert.equal(call[1].status, 'error');
    assert.equal(call[1].ok, false);
  }
  if (payload === 'valid' && observer === 'normal' && ['none', 'allowed'].includes(gate)) {
    assert.equal(result.value.length, 1);
    assert.equal(result.value[0].name, ' echo ');
    assert.ok(calls.some(call => call[0] === 'success'));
    assert.ok(!calls.some(call => call[0] === 'failure' || call[0] === 'diagnostic'));
  }
  return { result, calls };
}

(async () => {
  const results = [];
  for (const pooled of [false, true]) {
    for (const gate of ['none', 'allowed', 'blocked', 'throw']) {
      for (const payload of ['valid', 'missing', 'non-array', 'null', 'getter', 'invalid-tool', 'reject', 'throw']) {
        for (const observer of ['normal', 'absent', 'success-throw', 'failure-throw', 'history-throw']) {
          const result = await scenario(source, pooled, gate, payload, observer);
          if (previousSource) assert.deepEqual(result, await scenario(previousSource, pooled, gate, payload, observer));
          results.push(result);
        }
      }
    }
  }
  const digest = crypto.createHash('sha256').update(JSON.stringify(results)).digest('hex');
  const expected = '7838164b4cdbff3d3f59f3dbcbc477ce34e0915180d33f67f45ab99a21c4ebee';
  assert.equal(digest, expected);
  console.log(`MCP tool discovery passed: ${results.length} cases; ${digest}${previousSource ? '; original functions and remaining root AST unchanged' : ''}; controlled session boundaries only.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
