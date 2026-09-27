import { strict as assert } from 'node:assert';
import { callAvailableAgentMcpTool } from '../src/agent';
import { setAgentExternalMcpRuntimeOverride } from '../src/agent/agentExternalMcpBridge';

const cancelledRequestIds: string[] = [];

setAgentExternalMcpRuntimeOverride({
  async cancelMcpToolCall(request) {
    if (request?.requestId) {
      cancelledRequestIds.push(request.requestId);
    }

    return { cancelled: true, ok: true, requestId: request?.requestId };
  },
  async callMcpTool() {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    return { content: [{ text: 'too late', type: 'text' }] };
  },
  async loadMcpConfig() {
    return {
      config: {
        policies: {
          tools: {
            'external-fake/slow': { timeoutMs: 100 },
          },
        },
      },
      exists: true,
      ok: true,
      path: '.desktop-pet-mcp.json',
      rawText: '',
    };
  },
  async listMcpTools() {
    return {
      ok: true,
      servers: [{ id: 'external-fake', title: 'External Fake' }],
      tools: [{
        description: 'Slow test tool.',
        inputSchema: { additionalProperties: false, properties: {}, type: 'object' },
        name: 'slow',
        serverId: 'external-fake',
        title: 'Slow',
      }],
    };
  },
});

const result = await callAvailableAgentMcpTool({
  argumentsJson: '{}',
  name: 'slow',
  requestId: 'timeout-cancel-smoke',
  serverId: 'external-fake',
});

assert.equal(result.isError, true);
assert.match(result.content[0]?.text ?? '', /timed out/u);
assert.deepEqual(cancelledRequestIds, ['timeout-cancel-smoke']);

setAgentExternalMcpRuntimeOverride(null);

console.log('agent MCP policy timeout cancel smoke passed');
