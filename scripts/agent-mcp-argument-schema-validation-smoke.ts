import { strict as assert } from 'node:assert';
import { callAgentMcpTool } from '../src/agent';

const { validateMcpToolArguments } = await import('../electron/mcpArgumentSchemaValidation.cjs') as {
  validateMcpToolArguments: (
    schema: Record<string, unknown>,
    input: Record<string, unknown>,
  ) => { error: string | null; ok: boolean };
};

const schema = {
  additionalProperties: false,
  properties: {
    count: { maximum: 3, minimum: 1, type: 'integer' },
    mode: { enum: ['read', 'write'], type: 'string' },
    resourceId: { minLength: 1, type: 'string' },
  },
  required: ['mode', 'resourceId'],
  type: 'object',
};

assert.equal(validateMcpToolArguments(schema, { mode: 'read', resourceId: 'one' }).ok, true);
assert.equal(validateMcpToolArguments(schema, { mode: 'read' }).error, 'mcp_tool_arguments_schema_invalid');
assert.equal(validateMcpToolArguments(schema, { extra: true, mode: 'read', resourceId: 'one' }).ok, false);
assert.equal(validateMcpToolArguments(schema, { count: 4, mode: 'read', resourceId: 'one' }).ok, false);
assert.equal(validateMcpToolArguments({ $ref: 'https://example.invalid/schema.json' }, {}).error, 'mcp_tool_schema_remote_reference_rejected');
assert.equal(validateMcpToolArguments({ patternProperties: { '(a+)+$': { type: 'string' } } }, {}).error, 'mcp_tool_schema_pattern_rejected');
assert.equal(validateMcpToolArguments({ type: 'object' }, { items: Array.from({ length: 1_025 }, () => 1) }).error, 'mcp_tool_arguments_array_limit_exceeded');
assert.equal(validateMcpToolArguments({ description: '界'.repeat(22 * 1024), type: 'object' }, {}).error, 'mcp_tool_schema_size_limit_exceeded');

const oversized = callAgentMcpTool({
  argumentsJson: JSON.stringify({ query: 'x'.repeat(70 * 1024) }),
  name: 'skills.list',
  serverId: 'platform',
});
assert.equal(oversized.isError, true);
assert.match(oversized.content[0]?.text ?? '', /64 KiB/u);
const oversizedUtf8 = callAgentMcpTool({
  argumentsJson: JSON.stringify({ query: '界'.repeat(24 * 1024) }),
  name: 'skills.list',
  serverId: 'platform',
});
assert.equal(oversizedUtf8.isError, true);
assert.match(oversizedUtf8.content[0]?.text ?? '', /64 KiB/u);
console.log('agent MCP argument schema validation smoke passed');
