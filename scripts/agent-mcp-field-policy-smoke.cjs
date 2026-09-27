const assert = require('assert/strict');
const { evaluateMcpFieldPolicy } = require('../electron/mcpFieldPolicy.cjs');

function evaluate(fields, argumentsValue) {
  return evaluateMcpFieldPolicy({
    policies: { tools: { 'server/tool': { fields } } },
  }, {
    arguments: argumentsValue,
    serverId: 'server',
    toolName: 'tool',
  });
}

assert.equal(evaluate({ '/operation': { mode: 'deny', values: ['delete'] } }, { operation: 'read' }).allowed, true);
assert.equal(evaluate({ '/operation': { mode: 'deny', values: ['delete'] } }, { operation: 'delete' }).error, 'mcp_field_policy_denied');
assert.equal(evaluate({ '/token': { mode: 'deny' } }, { token: 'hidden-value' }).error, 'mcp_field_policy_denied');
assert.equal(evaluate({ '/mode': { mode: 'allow', values: ['read'] } }, { mode: 'write' }).error, 'mcp_field_policy_denied');
assert.equal(evaluate({ '/mode': { mode: 'allow', values: ['read'] } }, { mode: 'read' }).allowed, true);
assert.equal(evaluate({ '/nested/action': { mode: 'deny' } }, { nested: { action: true } }).error, 'mcp_field_policy_denied');
assert.equal(evaluate({ '/tuple/1': { mode: 'deny', values: [2] } }, { tuple: ['one', 2] }).error, 'mcp_field_policy_denied');
assert.equal(evaluate({ '/items': { mode: 'deny-items', values: ['blocked'] } }, { items: ['safe', 'blocked'] }).error, 'mcp_field_policy_denied');
assert.equal(evaluate({ '/items': { mode: 'deny-items', values: ['blocked'] } }, { items: ['safe'] }).allowed, true);
assert.equal(evaluate({ '/items': { mode: 'allow-items', values: ['one', 'two'] } }, { items: ['one', 'two'] }).allowed, true);
assert.equal(evaluate({ '/items': { mode: 'allow-items', values: ['one', 'two'] } }, { items: ['three'] }).error, 'mcp_field_policy_denied');
assert.equal(evaluate({ '/items': { mode: 'allow-items', values: ['one'] } }, { items: [] }).allowed, true);
assert.equal(evaluate({ '/items': { mode: 'allow-items', values: ['one'] } }, { items: [{ value: 'one' }] }).error, 'mcp_field_policy_denied');
assert.equal(evaluate({ '/items': { mode: 'allow-items', values: ['one'] } }, { items: 'one' }).error, 'mcp_field_policy_denied');
assert.equal(evaluate({ '/items': { mode: 'allow-items', values: ['one'] } }, { items: Array.from({ length: 1025 }, () => 'one') }).error, 'mcp_field_policy_denied');
assert.equal(evaluate({ '/items': { mode: 'allow-items', values: ['one'] } }, { items: new Array(1) }).error, 'mcp_field_policy_denied');
assert.equal(evaluate({ '/items': { mode: 'allow-items' } }, { items: ['one'] }).error, 'mcp_field_policy_invalid');
assert.equal(evaluate({ '/missing': { mode: 'deny' } }, {}).allowed, true);
assert.equal(evaluate({ '/__proto__/x': { mode: 'deny' } }, {}).error, 'mcp_field_policy_invalid');
assert.equal(evaluate({ '/mode': { mode: 'allow' } }, { mode: 'read' }).error, 'mcp_field_policy_invalid');
assert.equal(JSON.stringify(evaluate({ '/token': { mode: 'deny' } }, { token: 'hidden-value' })).includes('hidden-value'), false);
assert.equal(evaluateMcpFieldPolicy({ policies: { tools: { 'server/tool': 'invalid' } } }, {
  arguments: {},
  serverId: 'server',
  toolName: 'tool',
}).error, 'mcp_field_policy_invalid');
assert.equal(evaluateMcpFieldPolicy({ policies: { tools: [] } }, {
  arguments: {},
  serverId: 'server',
  toolName: 'tool',
}).error, 'mcp_field_policy_invalid');

console.log('agent MCP field policy smoke passed');
