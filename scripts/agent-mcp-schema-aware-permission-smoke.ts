import { strict as assert } from 'node:assert';
import { callAvailableAgentMcpTool, listAvailableAgentMcpTools } from '../src/agent';
import { setAgentExternalMcpRuntimeOverride } from '../src/agent/agentExternalMcpBridge';
import { applyMcpPolicyPresetToConfigText } from '../src/components/settings/settingsMcpPolicyBulkUtils';

const tools = [
  {
    description: 'Manage one resource.',
    inputSchema: {
      properties: {
        operation: { enum: ['inspect', 'delete'], type: 'string' },
        resourceId: { type: 'string' },
      },
      required: ['operation', 'resourceId'],
      type: 'object',
    },
    name: 'resource_action',
    serverId: 'schema-server',
    title: 'Resource Action',
  },
  {
    annotations: { readOnlyHint: true },
    description: 'Returns one catalog entry.',
    inputSchema: { properties: { id: { type: 'string' } }, type: 'object' },
    name: 'catalog_entry',
    serverId: 'schema-server',
    title: 'Catalog Entry',
  },
];

const preset = applyMcpPolicyPresetToConfigText(
  JSON.stringify({ servers: [{ command: 'node', id: 'schema-server' }] }),
  tools,
  'deny-high-risk',
);
assert.equal(preset.error, null);
const activeConfig = JSON.parse(preset.rawText) as Record<string, unknown>;
let externalCallCount = 0;

setAgentExternalMcpRuntimeOverride({
  async loadMcpConfig() {
    return {
      config: activeConfig,
      exists: true,
      ok: true,
      path: '.desktop-pet-mcp.json',
      rawText: preset.rawText,
    };
  },
  async listMcpTools() {
    return {
      ok: true,
      servers: [{ id: 'schema-server', title: 'Schema Server' }],
      tools,
    };
  },
  async callMcpTool() {
    externalCallCount += 1;
    return { content: [{ text: 'called', type: 'text' }] };
  },
});

const listed = await listAvailableAgentMcpTools('schema-server');
assert.equal(listed.find((tool) => tool.name === 'catalog_entry')?.annotations?.readOnlyHint, true);

const denied = await callAvailableAgentMcpTool({
  argumentsJson: '{"operation":"delete","resourceId":"one"}',
  name: 'resource_action',
  serverId: 'schema-server',
});
assert.equal(denied.isError, true);
assert.match(denied.content[0]?.text ?? '', /policy denied/u);
assert.equal(externalCallCount, 0);

const allowed = await callAvailableAgentMcpTool({
  argumentsJson: '{"id":"one"}',
  name: 'catalog_entry',
  serverId: 'schema-server',
});
assert.equal(allowed.isError, false);
assert.equal(externalCallCount, 1);

setAgentExternalMcpRuntimeOverride(null);
console.log('agent MCP schema-aware permission smoke passed');
