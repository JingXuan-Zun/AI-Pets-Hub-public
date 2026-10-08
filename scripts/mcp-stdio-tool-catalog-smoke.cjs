const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../electron');
const source = fs.readFileSync(path.join(root, 'mcpStdioClientService.cjs'), 'utf8');
const catalog = fs.readFileSync(path.join(root, 'mcpStdioToolCatalog.cjs'), 'utf8');
const previous = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const parse = text => ts.createSourceFile('fixture.cjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const ast = parse(catalog), names = [];
assert.ok(catalog.split('\n').length <= 300);
function walk(node) {
  if (ts.isFunctionDeclaration(node)) {
    names.push(node.name.text);
    assert.ok(ast.getLineAndCharacterOfPosition(node.end).line - ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 <= 50);
  }
  ts.forEachChild(node, walk);
}
walk(ast);
assert.deepEqual(names, ['createMcpToolCatalog', 'listServers', 'listTools']);
if (previous) {
  const printer = ts.createPrinter();
  const unchanged = text => {
    const tree = parse(text);
    const factory = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createMcpStdioClientService');
    return factory.body.statements.filter(n => !(ts.isFunctionDeclaration(n) && ['listServers', 'listTools'].includes(n.name.text)) && !(ts.isVariableStatement(n) && n.getText(tree).includes('createMcpToolCatalog('))).map(n => printer.printNode(ts.EmitHint.Unspecified, n, tree));
  };
  assert.deepEqual(unchanged(source), unchanged(previous), 'Other methods and instance state must remain unchanged');
}

async function scenario(text, input, pooled, configMode, healthMode, queryMode, direct = false) {
  const calls = [], pending = [];
  const history = {}, log = () => {}, pool = {};
  const statuses = [{ serverId: 'health-fixture' }];
  const servers = ['a', 'b', 'a'].map((id, index) => ({ id, title: `title-${index}`, description: `description-${index}`, privateField: true }));
  let reads = 0;
  const loadExternalMcpServers = projectRoot => {
    assert.equal(projectRoot, 'fixture-root'); reads += 1;
    calls.push(['config', reads]);
    if (configMode === 'first-throw' || (configMode === 'second-throw' && reads === 2)) throw new Error('config failure');
    if (configMode === 'nonarray') return null;
    if (configMode === 'changed' && reads === 2) return [{ id: 'c', title: 'latest', description: 'changed' }];
    return servers;
  };
  const health = healthMode === 'absent' ? null : {
    get listStatuses() {
      calls.push(['health-get']);
      if (healthMode === 'getter-throw') throw new Error('health getter failure');
      if (healthMode === 'noncallable') return 7;
      return function () {
        assert.equal(this, health); calls.push(['health-call']);
        if (healthMode === 'throw') throw new Error('health failure');
        return healthMode === 'null' ? null : statuses;
      };
    },
  };
  const listToolsForServer = function (server, logger, recorder, monitor, sessions) {
    assert.equal(logger, log); assert.equal(recorder, history); assert.equal(monitor, health);
    assert.equal(sessions, pooled ? pool : undefined);
    assert.equal(arguments.length, pooled ? 5 : 4);
    const index = servers.indexOf(server);
    calls.push(['query-start', index]);
    if (queryMode === 'sync-throw') throw new Error('query failure');
    if (queryMode === 'reject') return Promise.reject(new Error('query failure'));
    if (queryMode === 'reverse') return new Promise(resolve => pending.push({ index, resolve }));
    return Promise.resolve(queryMode === 'null' ? null : [{ name: `tool-${index}` }, [{ nested: index }]]);
  };
  const boundaries = {
    path,
    './mcpStdioToolCallHandler.cjs': require('../electron/mcpStdioToolCallHandler.cjs'),
    './mcpServerConfigLoader.cjs': { loadExternalMcpServers, normalizeMcpTool: () => {} },
    './mcpStdioToolDiscovery.cjs': { listToolsForServer },
    './mcpStdioSessionManagement.cjs': require('../electron/mcpStdioSessionManagement.cjs'),
  };
  const module = { exports: {} };
  const requireLocal = name => {
    if (name === './mcpStdioToolCatalog.cjs') {
      const child = { exports: {} };
      new Function('require', 'module', catalog)(requireLocal, child);
      return child.exports;
    }
    return boundaries[name] || {};
  };
  new Function('require', 'module', '__dirname', text)(requireLocal, module, root);
  const service = module.exports.createMcpStdioClientService({ projectRoot: 'fixture-root', history, log, health, reuseSessions: pooled, sessionPool: pool });
  assert.deepEqual(calls, [], 'Assembly must not query servers or health');
  let fieldReads = 0;
  const request = input === 'null' ? null : input === 'undefined' ? undefined : input === 'absent' ? {} : {
    get serverId() {
      calls.push(['request-id']); fieldReads += 1;
      if (input === 'getter-throw') throw new Error('request getter failure');
      if (input === 'changing') return fieldReads === 1 ? 'a' : 7;
      return { normal: 'a', whitespace: ' a ', blank: ' ', nonstring: 7, missing: 'missing' }[input];
    },
  };
  let outcome;
  try {
    const result = direct ? service.listServers() : service.listTools(request);
    if (!direct) assert.ok(result instanceof Promise);
    if (pending.length) {
      assert.equal(reads, 1);
      assert.ok(!calls.some(call => call[0] === 'health-get'), 'Health/config projection must wait for discovery');
      for (const item of [...pending].reverse()) {
        calls.push(['query-finish', item.index]);
        item.resolve([{ name: `tool-${item.index}` }]);
      }
    }
    const value = await result;
    if (!direct) {
      assert.equal(reads, 2, 'Successful listing must reread current server configuration');
      if (!['absent', 'null'].includes(healthMode)) assert.equal(value.serverHealth, statuses);
      const indexes = calls.filter(call => call[0] === 'query-start').map(call => call[1]);
      if (queryMode === 'reverse') assert.deepEqual(value.tools.map(tool => tool.name), indexes.map(index => `tool-${index}`));
      if (configMode === 'changed') assert.deepEqual(value.servers, [{ id: 'c', title: 'latest', description: 'changed' }]);
      if (queryMode === 'normal') assert.ok(value.tools.filter(Array.isArray).every(tool => tool.length === 1), 'Flatten only one level');
    } else {
      assert.equal(reads, 1);
      assert.ok(!calls.some(call => call[0].startsWith('query') || call[0].startsWith('health')));
    }
    assert.ok((direct ? value : value.servers).every(server => !Object.hasOwn(server, 'privateField')));
    outcome = { value };
  } catch (error) {
    if (error instanceof assert.AssertionError) throw error;
    outcome = { error: error.message };
  }
  return { outcome, calls };
}

(async () => {
  const results = [];
  for (const input of ['normal', 'whitespace', 'blank', 'nonstring', 'missing', 'null', 'undefined', 'absent', 'getter-throw', 'changing']) {
    for (const pooled of [false, true]) for (const configMode of ['normal', 'first-throw', 'second-throw', 'changed', 'nonarray']) {
      for (const healthMode of ['normal', 'absent', 'null', 'throw', 'getter-throw', 'noncallable']) {
        for (const queryMode of ['normal', 'null', 'reverse', 'sync-throw', 'reject']) {
          const result = await scenario(source, input, pooled, configMode, healthMode, queryMode);
          if (previous) assert.deepEqual(result, await scenario(previous, input, pooled, configMode, healthMode, queryMode));
          results.push(result);
        }
      }
    }
  }
  for (const configMode of ['normal', 'first-throw', 'second-throw', 'changed', 'nonarray']) {
    const result = await scenario(source, 'getter-throw', true, configMode, 'throw', 'sync-throw', true);
    if (previous) assert.deepEqual(result, await scenario(previous, 'getter-throw', true, configMode, 'throw', 'sync-throw', true));
    results.push(result);
  }
  const digest = crypto.createHash('sha256').update(JSON.stringify(results)).digest('hex');
  const expected = 'b3faad0bf23ac778ae42fce920dd424d42f84d193072e7326f9553b6e578a11b';
  assert.equal(digest, expected);
  console.log(`MCP tool catalog passed: ${results.length} real-root cases; ${digest}; parallel discovery/order/config reread; controlled config and discovery boundaries only.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
