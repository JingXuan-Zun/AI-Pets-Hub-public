import { strict as assert } from 'node:assert';
import { executeListMcpTools } from '../src/agent/agentRuntimeSkillTools';
import {
  createAgentMcpToolRiskLine,
  summarizeAgentMcpToolRisk,
} from '../src/agent/agentMcpRiskSummary';
import { setAgentExternalMcpRuntimeOverride } from '../src/agent/agentExternalMcpBridge';
import { type AgentMcpToolDefinition } from '../src/agent/agentMcpTypes';

const platformListTool: AgentMcpToolDefinition = {
  description: 'List skills.',
  inputSchema: { type: 'object' },
  name: 'skills.list',
  serverId: 'platform',
  title: 'List Agent Skills',
};

const platformExecuteTool: AgentMcpToolDefinition = {
  description: 'Execute skills.',
  inputSchema: { type: 'object' },
  name: 'skills.execute',
  serverId: 'platform',
  title: 'Execute Agent Skill',
};

const externalTool: AgentMcpToolDefinition = {
  description: 'Echo text through an external MCP tool.',
  inputSchema: { properties: { text: { type: 'string' } }, type: 'object' },
  name: 'echo',
  serverId: 'external-fake',
  title: 'Echo',
};

const externalSearchTool: AgentMcpToolDefinition = {
  description: 'Search documentation and return matching snippets.',
  inputSchema: {
    properties: {
      limit: { type: 'number' },
      query: { type: 'string' },
    },
    type: 'object',
  },
  name: 'search_docs',
  serverId: 'external-fake',
  title: 'Search Docs',
};

const externalCommandTool: AgentMcpToolDefinition = {
  description: 'Run a controlled project command.',
  inputSchema: {
    properties: {
      command: { description: 'Command to run', type: 'string' },
      cwd: { type: 'string' },
    },
    required: ['command'],
    type: 'object',
  },
  name: 'project_action',
  serverId: 'external-fake',
  title: 'Project Action',
};

const externalCredentialTool: AgentMcpToolDefinition = {
  description: 'Create a remote ticket.',
  inputSchema: {
    properties: {
      apiKey: { type: 'string' },
      title: { type: 'string' },
    },
    type: 'object',
  },
  name: 'ticket_create',
  serverId: 'external-fake',
  title: 'Ticket Create',
};

const externalSchemaOperationTool: AgentMcpToolDefinition = {
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
  serverId: 'external-fake',
  title: 'Resource Action',
};

const externalAnnotatedReadTool: AgentMcpToolDefinition = {
  annotations: { openWorldHint: false, readOnlyHint: true },
  description: 'Returns one catalog entry.',
  inputSchema: { properties: { id: { type: 'string' } }, type: 'object' },
  name: 'catalog_entry',
  serverId: 'external-fake',
  title: 'Catalog Entry',
};

const externalAnnotatedDestructiveTool: AgentMcpToolDefinition = {
  annotations: { destructiveHint: true, readOnlyHint: true },
  description: 'Changes one catalog entry.',
  inputSchema: { type: 'object' },
  name: 'catalog_change',
  serverId: 'external-fake',
  title: 'Catalog Change',
};

function assertRiskSummary() {
  const platformListSummary = summarizeAgentMcpToolRisk(platformListTool);
  assert.equal(platformListSummary.approvalMode, 'silent');
  assert.equal(platformListSummary.risk, 'read');
  assert.equal(platformListSummary.source, 'platform');
  assert.equal(platformListSummary.riskReason, 'platform list tool is read-only');

  assert.equal(summarizeAgentMcpToolRisk(platformExecuteTool).approvalMode, 'confirm');
  assert.equal(summarizeAgentMcpToolRisk(platformExecuteTool).risk, 'reversible-write');
  assert.equal(summarizeAgentMcpToolRisk(platformExecuteTool).source, 'platform');
  assert.equal(summarizeAgentMcpToolRisk(externalTool).approvalMode, 'confirm');
  assert.equal(summarizeAgentMcpToolRisk(externalTool).source, 'external');
  assert.equal(summarizeAgentMcpToolRisk(externalSearchTool).risk, 'read');
  assert.equal(summarizeAgentMcpToolRisk(externalCommandTool).risk, 'destructive-like');
  assert.ok(summarizeAgentMcpToolRisk(externalCommandTool).schemaSignals.includes('schema:execution-arguments'));
  assert.equal(summarizeAgentMcpToolRisk(externalCredentialTool).risk, 'reversible-write');
  assert.ok(summarizeAgentMcpToolRisk(externalCredentialTool).schemaSignals.includes('schema:sensitive-arguments'));
  assert.equal(summarizeAgentMcpToolRisk(externalSchemaOperationTool).risk, 'destructive-like');
  assert.ok(summarizeAgentMcpToolRisk(externalSchemaOperationTool).schemaSignals.includes('schema:destructive-arguments'));
  assert.equal(summarizeAgentMcpToolRisk(externalAnnotatedReadTool).risk, 'read');
  assert.ok(summarizeAgentMcpToolRisk(externalAnnotatedReadTool).schemaSignals.includes('annotation:read-only'));
  assert.equal(summarizeAgentMcpToolRisk(externalAnnotatedDestructiveTool).risk, 'destructive-like');
  assert.ok(summarizeAgentMcpToolRisk(externalAnnotatedDestructiveTool).schemaSignals.includes('annotation:destructive'));
  assert.match(createAgentMcpToolRiskLine(externalTool), /external-fake\/echo: reversible-write, confirm, external/u);
  assert.match(createAgentMcpToolRiskLine(externalCommandTool), /schema:execution-arguments/u);
}

async function assertRuntimeRiskOutput() {
  setAgentExternalMcpRuntimeOverride({
    async callMcpTool() {
      return { content: [{ text: 'ok', type: 'text' }] };
    },
    async listMcpTools() {
      return {
        ok: true,
        servers: [{ id: 'external-fake', title: 'External Fake MCP' }],
        tools: [
          externalTool,
          externalSearchTool,
          externalCommandTool,
          externalCredentialTool,
          externalSchemaOperationTool,
          externalAnnotatedReadTool,
          externalAnnotatedDestructiveTool,
        ],
      };
    },
  });

  const result = await executeListMcpTools({
    input: { serverId: 'external-fake' },
    name: 'list_mcp_tools',
  });
  assert.equal(result.ok, true);
  // The character reads one short line per tool; the detailed risk reasoning goes to the log.
  assert.match(result.responseText, /【external-fake】/u);
  assert.match(result.responseText, /- echo\([^)]*\) 需确认/u);
  assert.match(result.responseText, /- search_docs\([^)]*\) 需确认/u, 'read-looking by name only still asks');
  assert.match(result.responseText, /- catalog_entry\(id\) 只读/u, 'declared read-only runs without a card');
  assert.match(result.responseText, /- project_action\([^)]*\) 需确认/u);
  const riskLog = result.observations.join('\n');
  assert.match(riskLog, /external-fake\/echo: reversible-write, confirm, external/u);
  assert.match(riskLog, /external-fake\/search_docs: read, confirm, external/u);
  assert.match(riskLog, /external-fake\/catalog_entry: read, silent, external/u);
  assert.match(riskLog, /external-fake\/project_action: destructive-like, confirm, external/u);
  assert.match(riskLog, /schema:execution-arguments/u);
  assert.match(riskLog, /external-fake\/resource_action/u);
  assert.match(riskLog, /annotation:destructive/u);
  assert.ok(result.observations.some((line) => /MCP tool risk: external-fake\/echo/u.test(line)));
  setAgentExternalMcpRuntimeOverride(null);
}

assertRiskSummary();
await assertRuntimeRiskOutput();

console.log('agent MCP risk summary smoke passed');
