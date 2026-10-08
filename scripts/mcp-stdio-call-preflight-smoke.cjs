const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const base = path.resolve(__dirname, '../electron');
const source = fs.readFileSync(path.join(base, 'mcpStdioClientService.cjs'), 'utf8');
const preflightText = fs.readFileSync(path.join(base, 'mcpStdioCallPreflight.cjs'), 'utf8');
const schemaText = fs.readFileSync(path.join(base, 'mcpStdioCallSchema.cjs'), 'utf8');
const resultsText = fs.readFileSync(path.join(base, 'mcpStdioCallResults.cjs'), 'utf8');
const requestText = fs.readFileSync(path.join(base, 'mcpStdioCallRequest.cjs'), 'utf8');
const cancellationText = fs.readFileSync(path.join(base, 'mcpStdioCancellation.cjs'), 'utf8');
const handlerText = fs.readFileSync(path.join(base, 'mcpStdioToolCallHandler.cjs'), 'utf8');
const { normalizeMcpTool, parseJsonObject } = require('../electron/mcpServerConfigLoader.cjs');
const rules = require('../electron/mcpStdioClientRules.cjs');
const parse = text => ts.createSourceFile('fixture.cjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const rootAst = parse(source);
const rootFactory = rootAst.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createMcpStdioClientService');
assert.ok(rootAst.getLineAndCharacterOfPosition(rootFactory.end).line - rootAst.getLineAndCharacterOfPosition(rootFactory.getStart(rootAst)).line + 1 <= 50, 'Root factory must stay within the 50-line budget');
const handlerAst = parse(handlerText);
assert.ok(handlerText.split('\n').length <= 300);
const handlerFactory = handlerAst.statements.find(ts.isFunctionDeclaration);
assert.equal(handlerFactory.name.text, 'createMcpToolCallHandler');
const callToolFunction = handlerFactory.body.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'callTool');
for (const fn of [handlerFactory, callToolFunction]) assert.ok(handlerAst.getLineAndCharacterOfPosition(fn.end).line - handlerAst.getLineAndCharacterOfPosition(fn.getStart(handlerAst)).line + 1 <= 50, 'Call handler functions must stay within the 50-line budget');
const preflightAst = parse(preflightText);
assert.ok(preflightText.split('\n').length <= 300);
assert.equal(preflightAst.statements.filter(ts.isFunctionDeclaration).length, 3);
for (const fn of preflightAst.statements.filter(ts.isFunctionDeclaration)) assert.ok(preflightAst.getLineAndCharacterOfPosition(fn.end).line - preflightAst.getLineAndCharacterOfPosition(fn.getStart(preflightAst)).line + 1 <= 50);
const schemaAst = parse(schemaText);
assert.ok(schemaText.split('\n').length <= 300);
const schemaFunctions = schemaAst.statements.filter(ts.isFunctionDeclaration);
assert.deepEqual(schemaFunctions.map(fn => fn.name.text), ['discoverMcpCallSchemaTools', 'checkMcpCallSchema']);
for (const fn of schemaFunctions) assert.ok(schemaAst.getLineAndCharacterOfPosition(fn.end).line - schemaAst.getLineAndCharacterOfPosition(fn.getStart(schemaAst)).line + 1 <= 50);
const oneShotPromise = Promise.resolve({ tools: [] });
const pooledPromise = Promise.resolve({ tools: [] });
const schemaModule = { exports: {} };
new Function('require', 'module', schemaText)(name => {
  if (name === './mcpStdioSession.cjs') return { withMcpSession: () => oneShotPromise };
  if (name === './mcpStdioToolDiscovery.cjs') return { listToolsWithPooledSession: () => pooledPromise };
  return {};
}, schemaModule);
assert.equal(schemaModule.exports.discoverMcpCallSchemaTools({}, null, null), oneShotPromise);
assert.equal(schemaModule.exports.discoverMcpCallSchemaTools({}, {}, null), pooledPromise);
const resultsAst = parse(resultsText);
assert.ok(resultsText.split('\n').length <= 300);
const resultFunctions = resultsAst.statements.filter(ts.isFunctionDeclaration);
assert.deepEqual(resultFunctions.map(fn => fn.name.text), ['completeMcpToolCall', 'failMcpToolCall', 'cleanupMcpToolCall']);
for (const fn of resultFunctions) assert.ok(resultsAst.getLineAndCharacterOfPosition(fn.end).line - resultsAst.getLineAndCharacterOfPosition(fn.getStart(resultsAst)).line + 1 <= 50);
const requestAst = parse(requestText);
assert.ok(requestText.split('\n').length <= 300);
const requestFunction = requestAst.statements.find(ts.isFunctionDeclaration);
assert.equal(requestFunction.name.text, 'resolveMcpToolCallRequest');
assert.ok(requestAst.getLineAndCharacterOfPosition(requestFunction.end).line - requestAst.getLineAndCharacterOfPosition(requestFunction.getStart(requestAst)).line + 1 <= 50);
let previousSource;
if (process.argv[2]) {
  previousSource = fs.readFileSync(process.argv[2], 'utf8');
  const oldAst = parse(previousSource), nextAst = parse(source);
  const factory = tree => tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createMcpStdioClientService');
  const printer = ts.createPrinter();
  const unchanged = tree => factory(tree).body.statements.filter(n => !(ts.isFunctionDeclaration(n) && n.name.text === 'callTool') && !(ts.isVariableStatement(n) && n.getText(tree).includes('createMcpToolCallHandler('))).map(n => printer.printNode(ts.EmitHint.Unspecified, n, tree));
  assert.deepEqual(unchanged(oldAst), unchanged(nextAst), 'Other instance methods and state must remain unchanged');
  const oldCallTool = factory(oldAst).body.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'callTool');
  assert.equal(printer.printNode(ts.EmitHint.Unspecified, oldCallTool, oldAst), printer.printNode(ts.EmitHint.Unspecified, callToolFunction, handlerAst), 'Moved callTool AST must remain unchanged');
}

async function scenario(text, mode, pooled, observer, args) {
  const calls = [];
  let now = 100;
  const schema = { type: 'object' };
  const server = { id: 'fixture', timeoutMs: 1234 };
  const config = { fixture: true };
  const decision = { allowed: mode !== 'policy-denied', reason: 'denied by fixture policy' };
  const validation = { ok: mode !== 'schema-rejected', errors: ['fixture schema error'] };
  const session = {};
  const health = {
    getRetryGate(id) {
      assert.equal(this, health); calls.push(['gate', id]);
      if (mode === 'gate-throw') throw new Error('gate failure');
      return { allowed: mode !== 'cooldown', reason: 'cooldown fixture', waitMs: 12.5, status: { status: 'unhealthy' } };
    },
    recordSuccess(id) { assert.equal(this, health); calls.push(['success', id]); if (mode === 'health-success-throw') throw new Error('success observer failure'); },
    recordFailure(id, error) { assert.equal(this, health); calls.push(['failure', id, error.message]); if (mode === 'health-failure-throw') throw new Error('failure observer failure'); },
  };
  const history = observer === 'absent' ? null : {
    recordToolCallResult(value) { assert.equal(this, history); calls.push(['history-result', value]); if (observer === 'throw') throw new Error('history failure'); },
    recordToolCallStart(value) { assert.equal(this, history); calls.push(['history-start', value]); if (mode === 'start-history-throw') throw new Error('start history failure'); },
  };
  async function discovery() {
    calls.push(['discovery']);
    if (mode === 'discovery-reject') throw new Error('discovery failure');
    if (mode === 'discovery-null') return null;
    if (mode === 'tools-non-array') return { tools: {} };
    if (mode === 'tool-getter-throw') return { tools: [{ name: 'tool', inputSchema: schema }, { get name() { throw new Error('tool getter failure'); } }] };
    if (mode === 'name-whitespace') return { tools: [{ name: ' tool ', inputSchema: schema }] };
    if (mode === 'duplicate-tools') return { tools: [{ name: 'tool', inputSchema: schema }, { name: 'tool', inputSchema: { type: 'null' } }] };
    return { tools: mode === 'schema-unavailable' ? [] : [{ name: 'tool', inputSchema: schema }] };
  }
  const pool = { runRpc(value, method, params, timeout) {
    assert.equal(this, pool); assert.equal(value, server);
    calls.push(['pool-rpc', method, params, timeout]); return discovery();
  } };
  const hostSession = {
    async withMcpSession(value, log, callback) {
      assert.equal(value, server); calls.push(['open']);
      try { return await callback(session); } finally { calls.push(['close']); }
    },
    sendRpc(value, method, params, timeout) {
      assert.equal(value, session); calls.push(['rpc', method, params, timeout]); return discovery();
    },
  };
  const boundaries = {
    './mcpServerConfigLoader.cjs': {
      normalizeMcpTool, parseJsonObject,
      loadExternalMcpServers(projectRoot) { assert.equal(projectRoot, 'fixture-root'); calls.push(['servers']); if (mode === 'servers-throw') throw new Error('server config failure'); return [server]; },
      loadExternalMcpPolicyConfig(projectRoot) { assert.equal(projectRoot, 'fixture-root'); calls.push(['policy-config']); return config; },
    },
    './mcpStdioClientRules.cjs': rules,
    './mcpStdioSession.cjs': hostSession,
    './mcpStdioSessionPool.cjs': { createMcpStdioSessionPool() { throw new Error('Only the provided fixture pool may be used'); } },
    './mcpStdioToolDiscovery.cjs': { listToolsWithPooledSession: (value, entry) => value.runRpc(entry, 'tools/list', {}, entry.timeoutMs) },
    './mcpFieldPolicy.cjs': { evaluateMcpFieldPolicy(value, request) {
      assert.equal(value, config); calls.push(['policy', request]);
      if (mode === 'policy-throw') throw new Error('policy failure');
      return decision;
    } },
    './mcpArgumentSchemaValidation.cjs': { validateMcpToolArguments(value, argumentsValue) {
      assert.equal(value, schema); calls.push(['schema', argumentsValue]);
      if (mode === 'schema-throw') throw new Error('schema failure');
      return validation;
    } },
    './mcpStdioToolCallRunner.cjs': {
      async runMcpStdioToolCall(options) {
        calls.push(['execute', options.arguments]);
        options.clearActiveToolCallRef.current = () => { calls.push(['clear-active']); if (mode === 'cleanup-clear-throw') throw new Error('active cleanup failure'); };
        if (['execution-reject', 'health-failure-throw'].includes(mode)) throw new Error('execution failure');
        if (mode === 'execution-timeout') throw new Error('RPC timeout');
        if (mode === 'execution-cancelled') throw new Error('RPC closed: cancelled');
        if (mode === 'execution-result-error') return { content: [{ type: 'text', text: 'tool result error' }], isError: true };
        if (mode === 'execution-normalize-throw') return { content: [{ type: 'json', data: 3n }] };
        return { content: [{ type: 'text', text: 'ok' }] };
      },
      closeOneShotSession() { calls.push(['close-one-shot']); if (mode === 'cleanup-close-throw') throw new Error('session cleanup failure'); },
    },
    path,
  };
  const module = { exports: {} };
  const fakeDate = { now: () => { calls.push(['now']); now += 10; return now; } };
  const requireLocal = name => {
    if (name === './mcpStdioToolCallHandler.cjs') {
      const handler = { exports: {} };
      new Function('require', 'module', 'Date', handlerText)(requireLocal, handler, fakeDate);
      return handler.exports;
    }
    if (name === './mcpStdioToolCatalog.cjs') {
      const catalog = { exports: {} };
      const text = fs.readFileSync(path.join(base, 'mcpStdioToolCatalog.cjs'), 'utf8');
      new Function('require', 'module', text)(requireLocal, catalog);
      return catalog.exports;
    }
    if (name === './mcpStdioSessionManagement.cjs') {
      const management = { exports: {} };
      const text = fs.readFileSync(path.join(base, 'mcpStdioSessionManagement.cjs'), 'utf8');
      new Function('module', 'Date', text)(management, fakeDate);
      return management.exports;
    }
    if (name === './mcpStdioCancellation.cjs') {
      const cancellation = { exports: {} };
      new Function('module', cancellationText)(cancellation);
      return cancellation.exports;
    }
    if (['./mcpStdioCallPreflight.cjs', './mcpStdioCallSchema.cjs', './mcpStdioCallResults.cjs', './mcpStdioCallRequest.cjs'].includes(name)) {
      const preflight = { exports: {} };
      const moduleText = name === './mcpStdioCallPreflight.cjs' ? preflightText : name === './mcpStdioCallSchema.cjs' ? schemaText : name === './mcpStdioCallResults.cjs' ? resultsText : requestText;
      new Function('require', 'module', 'Date', moduleText)(requireLocal, preflight, fakeDate);
      return preflight.exports;
    }
    assert.ok(Object.hasOwn(boundaries, name), 'Unexpected dependency: ' + name);
    return boundaries[name];
  };
  new Function('require', 'module', '__dirname', 'Date', text)(requireLocal, module, base, fakeDate);
  const service = module.exports.createMcpStdioClientService({ projectRoot: 'fixture-root', history, health, reuseSessions: pooled, sessionPool: pool });
  assert.deepEqual(calls, [], 'Construction must not execute preflight');
  const request = {};
  let argumentReads = 0;
  let requestIdReads = 0;
  const fields = { serverId: mode === 'unknown' ? 'missing' : ' fixture ', name: mode === 'blank-name' ? ' ' : ' tool ', requestId: ' request ', arguments: args };
  if (mode === 'server-id-nonstring') fields.serverId = 7;
  if (mode === 'name-nonstring') fields.name = null;
  if (mode === 'request-id-nonstring') fields.requestId = 7;
  for (const [key, value] of Object.entries(fields)) Object.defineProperty(request, key, { get() {
    calls.push(['get', key]);
    if ((key === 'serverId' && mode === 'server-id-throw') || (key === 'name' && mode === 'name-throw') || (key === 'requestId' && mode === 'request-id-throw')) throw new Error('request ' + key + ' failure');
    if (key === 'requestId' && mode === 'request-id-changing' && ++requestIdReads === 2) return 7;
    if (key === 'arguments' && mode === 'arguments-throw') throw new Error('arguments failure');
    if (key === 'arguments' && mode === 'schema-args-throw' && ++argumentReads === 2) throw new Error('schema arguments failure');
    return value;
  } });
  let result;
  try { result = { value: await service.callTool(mode === 'request-null' ? null : request) }; }
  catch (error) { result = { error: error.name, message: error.message }; }
  const early = ['unknown', 'blank-name', 'cooldown', 'policy-denied', 'gate-throw', 'policy-throw', 'arguments-throw', 'server-id-nonstring', 'name-nonstring', 'server-id-throw', 'name-throw', 'request-id-throw', 'servers-throw', 'request-id-changing', 'request-null'];
  if (early.includes(mode)) assert.ok(!calls.some(call => call[0] === 'discovery' || call[0] === 'execute' || call[0] === 'schema'));
  if (mode === 'cooldown') assert.ok(!calls.some(call => call[0] === 'policy-config'));
  if (['schema-unavailable', 'schema-rejected', 'discovery-reject', 'schema-throw', 'discovery-null', 'tools-non-array', 'tool-getter-throw', 'name-whitespace', 'schema-args-throw'].includes(mode)) assert.ok(!calls.some(call => call[0] === 'execute'));
  if (observer === 'absent' && ['cooldown', 'policy-denied', 'schema-unavailable', 'schema-rejected', 'discovery-null', 'tools-non-array', 'name-whitespace'].includes(mode)) assert.equal(calls.filter(call => call[0] === 'now').length, 1, 'Missing history must not evaluate duration');
  const recorded = calls.find(call => call[0] === 'history-result');
  if (mode === 'cooldown' && recorded) assert.equal(recorded[1].durationMs, 0);
  if (mode === 'policy-denied' && observer === 'normal') assert.equal(result.value.structuredContent.fieldPolicy, decision);
  if (mode === 'schema-rejected' && observer === 'normal') assert.equal(result.value.structuredContent.schemaValidation, validation);
  if (['discovery-null', 'tools-non-array', 'name-whitespace'].includes(mode) && observer !== 'throw') assert.equal(result.value.structuredContent.schemaValidation.error, 'mcp_tool_schema_unavailable');
  if (mode === 'tool-getter-throw') assert.ok(!calls.some(call => call[0] === 'schema'), 'All tools are normalized before first-match lookup');
  if (mode === 'schema-args-throw') assert.ok(!calls.some(call => call[0] === 'schema'), 'Argument getter error must propagate before validator call');
  if (mode === 'execution-cancelled' && observer !== 'throw') {
    assert.ok(!calls.some(call => call[0] === 'failure'), 'Cancellation must not count as a server failure');
    if (recorded) assert.equal(recorded[1].status, 'cancelled');
  }
  if (mode === 'execution-timeout' && observer !== 'throw' && recorded) assert.equal(recorded[1].status, 'timeout');
  if (mode === 'execution-result-error' && observer !== 'throw') {
    assert.equal(result.value.isError, true);
    assert.ok(calls.some(call => call[0] === 'success'));
    assert.ok(!calls.some(call => call[0] === 'failure'));
  }
  if (mode === 'cleanup-clear-throw') {
    assert.equal(result.message, 'active cleanup failure');
    assert.ok(!calls.some(call => call[0] === 'close-one-shot'));
  }
  if (mode === 'cleanup-close-throw') {
    assert.equal(result.message, 'session cleanup failure');
    assert.ok(calls.findIndex(call => call[0] === 'clear-active') < calls.findIndex(call => call[0] === 'close-one-shot'));
  }
  if (mode === 'start-history-throw' && observer !== 'absent') assert.ok(!calls.some(call => call[0] === 'execute'));
  if (['unknown', 'blank-name', 'server-id-nonstring', 'name-nonstring', 'server-id-throw', 'name-throw', 'request-id-throw', 'servers-throw', 'request-id-changing', 'request-null'].includes(mode)) assert.ok(!calls.some(call => call[0] === 'now' || call[0] === 'gate'));
  if (['unknown', 'blank-name', 'server-id-nonstring', 'name-nonstring'].includes(mode)) assert.ok(!calls.some(call => call[0] === 'get' && call[1] === 'requestId'), 'Unknown target must not read requestId');
  if (mode === 'request-id-nonstring' && observer !== 'absent') assert.equal(recorded[1].requestId, '');
  return { result, calls };
}

async function checkCallCancellationIsolation(text) {
  const maps = [], releases = [], ready = [], calls = [];
  const runner = {
    runMcpStdioToolCall(options) {
      const index = options.log();
      assert.equal(options.server.marker, `root-${index}`);
      assert.ok(options.activeToolCalls instanceof Map);
      maps[index] = options.activeToolCalls;
      calls.push(['execute', index]);
      const result = new Promise((resolve, reject) => {
        releases[index] = resolve;
        maps[index].set(options.requestId, { serverId: options.serverId, name: options.name, close() { calls.push(['close', index]); reject(new Error('RPC closed: cancelled')); return true; } });
      });
      options.clearActiveToolCallRef.current = () => { calls.push(['clear', index]); maps[index].delete(options.requestId); };
      ready[index]();
      return result;
    },
    closeOneShotSession() {},
  };
  const texts = {
    './mcpStdioToolCallHandler.cjs': handlerText,
    './mcpStdioCallRequest.cjs': requestText,
    './mcpStdioCallResults.cjs': resultsText,
    './mcpStdioCancellation.cjs': cancellationText,
    './mcpStdioSessionManagement.cjs': fs.readFileSync(path.join(base, 'mcpStdioSessionManagement.cjs'), 'utf8'),
    './mcpStdioToolCatalog.cjs': fs.readFileSync(path.join(base, 'mcpStdioToolCatalog.cjs'), 'utf8'),
  };
  const host = {
    path,
    './mcpServerConfigLoader.cjs': { loadExternalMcpServers: root => [{ id: 'fixture', marker: root }] },
    './mcpStdioClientRules.cjs': rules,
    './mcpStdioCallPreflight.cjs': { checkMcpCallCooldown: () => null, checkMcpCallFieldPolicy: () => null },
    './mcpStdioCallSchema.cjs': { discoverMcpCallSchemaTools: () => Promise.resolve([]), checkMcpCallSchema: () => null },
    './mcpStdioToolDiscovery.cjs': {},
    './mcpStdioSessionPool.cjs': {},
    './mcpStdioToolCallRunner.cjs': runner,
  };
  const requireLocal = name => {
    if (texts[name]) {
      const module = { exports: {} };
      new Function('require', 'module', texts[name])(requireLocal, module);
      return module.exports;
    }
    assert.ok(Object.hasOwn(host, name), 'Unexpected isolation dependency: ' + name);
    return host[name];
  };
  const module = { exports: {} };
  new Function('require', 'module', '__dirname', text)(requireLocal, module, base);
  const clients = [0, 1].map(index => module.exports.createMcpStdioClientService({ projectRoot: `root-${index}`, log: () => index }));
  const started = [0, 1].map(index => new Promise(resolve => { ready[index] = resolve; }));
  const pending = clients.map(client => client.callTool({ serverId: 'fixture', name: 'tool', requestId: 'same-id' }));
  await Promise.race([
    Promise.all(started),
    ...pending.map(call => call.then(() => { throw new Error('A call settled before both active requests were registered'); })),
  ]);
  assert.notEqual(maps[0], maps[1]);
  assert.equal(clients[0].cancelToolCall({ requestId: 'same-id' }).cancelled, true);
  assert.equal(maps[1].size, 1, 'Cancelling the first client must preserve the second active call');
  assert.equal(clients[0].cancelToolCall({ requestId: 'same-id' }).cancelled, false);
  releases[1]({ content: [{ type: 'text', text: 'second completed' }] });
  const [cancelled, completed] = await Promise.all(pending);
  assert.equal(cancelled.isError, true);
  assert.match(cancelled.content[0].text, /cancelled/);
  assert.equal(completed.isError, false);
  assert.equal(completed.content[0].text, 'second completed');
  assert.equal(maps[0].size, 0);
  assert.equal(maps[1].size, 0);
  assert.deepEqual(calls.filter(call => call[0] === 'close'), [['close', 0]]);
  assert.deepEqual(calls.filter(call => call[0] === 'clear').map(call => call[1]).sort(), [0, 1]);
}

(async () => {
  const results = [];
  for (const mode of ['unknown', 'blank-name', 'cooldown', 'policy-denied', 'schema-unavailable', 'schema-rejected', 'success', 'gate-throw', 'policy-throw', 'arguments-throw', 'discovery-reject', 'schema-throw', 'execution-reject', 'discovery-null', 'tools-non-array', 'tool-getter-throw', 'name-whitespace', 'duplicate-tools', 'schema-args-throw', 'execution-timeout', 'execution-cancelled', 'execution-result-error', 'execution-normalize-throw', 'health-success-throw', 'health-failure-throw', 'cleanup-clear-throw', 'cleanup-close-throw', 'start-history-throw', 'server-id-nonstring', 'name-nonstring', 'request-id-nonstring', 'server-id-throw', 'name-throw', 'request-id-throw', 'servers-throw', 'request-id-changing', 'request-null']) {
    for (const pooled of [false, true]) {
      for (const observer of ['normal', 'absent', 'throw']) {
        for (const args of [undefined, null, { text: 'fixture' }]) {
          const result = await scenario(source, mode, pooled, observer, args);
          if (previousSource) assert.deepEqual(result, await scenario(previousSource, mode, pooled, observer, args));
          results.push(result);
        }
      }
    }
  }
  const digest = crypto.createHash('sha256').update(JSON.stringify(results)).digest('hex');
  const expected = '3a5ca6b07205d1caa1e248356beea0a288797e9032c4d5758e470b54372d28b2';
  assert.equal(digest, expected);
  await checkCallCancellationIsolation(source);
  if (previousSource) await checkCallCancellationIsolation(previousSource);
  console.log(`MCP call preflight passed: ${results.length} root cases; ${digest}${previousSource ? '; moved callTool and remaining instance AST unchanged' : ''}; concurrent call/cancel isolation passed; controlled authority/session boundaries only.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
