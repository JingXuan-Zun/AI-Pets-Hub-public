import { strict as assert } from 'node:assert';
import { callAvailableAgentMcpTool, listAvailableAgentMcpTools } from '../src/agent/agentMcpRegistry';
import { executeCallMcpTool, executeListMcpTools } from '../src/agent/agentRuntimeSkillTools';
import { setAgentExternalMcpRuntimeOverride } from '../src/agent/agentExternalMcpBridge';

let activeMcpConfig: Record<string, unknown> = {};
let callCount = 0;

setAgentExternalMcpRuntimeOverride({
  async loadMcpConfig() {
    return {
      config: activeMcpConfig,
      exists: true,
      ok: true,
      path: '.desktop-pet-mcp.json',
      rawText: JSON.stringify(activeMcpConfig),
    };
  },
  async listMcpTools() {
    return {
      ok: true,
      servers: [{ id: 'external-fake', title: 'External Fake MCP' }],
      tools: [
        {
          description: 'Echo text through an external MCP tool.',
          inputSchema: { properties: { text: { type: 'string' } }, type: 'object' },
          name: 'echo',
          serverId: 'external-fake',
          title: 'Echo',
        },
      ],
    };
  },
  async callMcpTool(request) {
    callCount += 1;
    return {
      content: [{ text: `external:${String(request?.arguments?.text ?? '')}`, type: 'text' }],
      isError: false,
      structuredContent: { echoed: request?.arguments?.text ?? null },
    };
  },
});

const listedTools = await listAvailableAgentMcpTools();
// The built-in "platform" server (old built-in skills over MCP) was removed; only configured servers list.
assert.ok(!listedTools.some((tool) => tool.serverId === 'platform'));
assert.ok(listedTools.some((tool) => tool.serverId === 'external-fake' && tool.name === 'echo'));

const filteredTools = await listAvailableAgentMcpTools('external-fake');
assert.deepEqual(filteredTools.map((tool) => `${tool.serverId}/${tool.name}`), ['external-fake/echo']);

const directCall = await callAvailableAgentMcpTool({
  argumentsJson: '{"text":"hello"}',
  name: 'echo',
  serverId: 'external-fake',
});
assert.equal(directCall.isError, false);
assert.equal(directCall.content[0]?.text, 'external:hello');
assert.equal(directCall.structuredContent?.echoed, 'hello');
assert.equal(callCount, 1);

activeMcpConfig = {
  policies: {
    tools: {
      'external-fake/echo': { mode: 'deny' },
    },
  },
};
const deniedCall = await callAvailableAgentMcpTool({
  argumentsJson: '{"text":"blocked"}',
  name: 'echo',
  serverId: 'external-fake',
});
assert.equal(deniedCall.isError, true);
assert.match(deniedCall.content[0]?.text ?? '', /policy denied/i);
assert.equal(callCount, 1);
activeMcpConfig = {};

const listRuntimeResult = await executeListMcpTools({
  input: { serverId: 'external-fake' },
  name: 'list_mcp_tools',
});
assert.equal(listRuntimeResult.ok, true);
assert.match(listRuntimeResult.responseText, /【external-fake】\n- echo\(/u);

const callRuntimeResult = await executeCallMcpTool({
  input: {
    argumentsJson: '{"text":"runtime"}',
    name: 'echo',
    serverId: 'external-fake',
  },
  name: 'call_mcp_tool',
});
assert.equal(callRuntimeResult.ok, true);
assert.match(callRuntimeResult.responseText, /external:runtime/u);

setAgentExternalMcpRuntimeOverride(null);

console.log('agent external MCP registry smoke passed');
