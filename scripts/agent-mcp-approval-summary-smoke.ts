import { strict as assert } from 'node:assert';
import {
  createAgentMcpApprovalSummary,
  createAgentMcpApprovalSummaryWithSchema,
} from '../src/components/chat/agentMcpApprovalSummary';
import { type AgentChatCommand, type AgentExecutionPlan } from '../src/agent';
import { setAgentExternalMcpRuntimeOverride } from '../src/agent/agentExternalMcpBridge';

function createCallMcpCommand(input: Record<string, unknown>): AgentChatCommand {
  return {
    instruction: 'Call fake MCP tool',
    kind: 'tool-call',
    sourceText: 'Call fake MCP tool',
    toolCall: {
      input,
      name: 'call_mcp_tool',
    },
  };
}

function createPlan(goal = 'Call MCP tool'): AgentExecutionPlan {
  return {
    commandKind: 'tool-call',
    goal,
    instruction: goal,
    steps: [],
  };
}

const externalSummary = createAgentMcpApprovalSummary(
  createCallMcpCommand({
    argumentsJson: JSON.stringify({
      nested: { token: 'abc123' },
      password: 'secret-password',
      text: 'hello world',
    }),
    name: 'echo',
    serverId: 'external-fake',
  }),
  createPlan('External MCP approval'),
);

assert.equal(externalSummary?.title, 'Confirm external MCP tool call');
assert.ok(externalSummary?.warning);
assert.ok(externalSummary?.lines.some((line) => line === 'tool: external-fake/echo'));
assert.ok(externalSummary?.lines.some((line) => line === 'source/risk: external, reversible-write'));
assert.ok(externalSummary?.lines.some((line) => line.startsWith('risk reason:')));
assert.ok(externalSummary?.lines.some((line) => line.includes('"password":"[redacted]"')));
assert.ok(externalSummary?.lines.some((line) => line.includes('"token":"[redacted]"')));
assert.ok(externalSummary?.lines.every((line) => !line.includes('secret-password')));
assert.ok(externalSummary?.lines.every((line) => !line.includes('abc123')));

const platformSummary = createAgentMcpApprovalSummary(
  createCallMcpCommand({
    argumentsJson: '{}',
    name: 'skills.list',
    serverId: 'platform',
  }),
  createPlan('Platform MCP approval'),
);

assert.equal(platformSummary?.title, 'Confirm platform MCP tool call');
assert.equal(platformSummary?.warning, null);
assert.ok(platformSummary?.lines.some((line) => line === 'source/risk: platform, read-only'));
assert.ok(platformSummary?.lines.some((line) => line === 'approval: silent'));

const nonMcpSummary = createAgentMcpApprovalSummary(
  {
    instruction: 'List skills',
    kind: 'tool-call',
    sourceText: 'List skills',
    toolCall: {
      input: {},
      name: 'list_agent_skills',
    },
  },
  createPlan(),
);

assert.equal(nonMcpSummary, null);

setAgentExternalMcpRuntimeOverride({
  async callMcpTool() {
    return { content: [{ text: 'ok', type: 'text' }] };
  },
  async listMcpTools() {
    return {
      ok: true,
      servers: [{ id: 'external-fake', title: 'External Fake MCP' }],
      tools: [
        {
          description: 'Run a controlled command.',
          inputSchema: {
            properties: {
              command: { type: 'string' },
              cwd: { type: 'string' },
            },
            type: 'object',
          },
          name: 'project_action',
          serverId: 'external-fake',
          title: 'Project Action',
        },
      ],
    };
  },
});

const schemaAwareSummary = await createAgentMcpApprovalSummaryWithSchema(
  createCallMcpCommand({
    argumentsJson: JSON.stringify({ command: 'npm test' }),
    name: 'project_action',
    serverId: 'external-fake',
  }),
  createPlan('Schema-aware MCP approval'),
);

assert.ok(schemaAwareSummary?.lines.some((line) => line === 'source/risk: external, destructive-like'));
assert.ok(schemaAwareSummary?.lines.some((line) => line.includes('schema:execution-arguments')));
setAgentExternalMcpRuntimeOverride(null);

console.log('agent MCP approval summary smoke passed');
