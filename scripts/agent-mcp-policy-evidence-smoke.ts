import { strict as assert } from 'node:assert';
import {
  createSettingsMcpPolicyEvidenceReport,
  createSettingsMcpPolicyEvidenceText,
  createSettingsMcpPolicyEvidenceToolKey,
} from '../src/components/settings/settingsMcpPolicyEvidence';

const configText = JSON.stringify({ servers: [{ command: 'node', id: 'fake' }] }, null, 2);
const tools = [
  {
    description: 'Search docs and return matching snippets.',
    inputSchema: {
      properties: {
        query: { type: 'string' },
      },
      type: 'object',
    },
    name: 'search_docs',
    serverId: 'fake',
    title: 'Search Docs',
  },
  {
    description: 'Create a ticket in a remote tracker.',
    inputSchema: {
      properties: {
        title: { type: 'string' },
      },
      type: 'object',
    },
    name: 'ticket_create',
    serverId: 'fake',
    title: 'Ticket Create',
  },
  {
    description: 'Run a project command.',
    inputSchema: {
      properties: {
        command: { type: 'string' },
        cwd: { type: 'string' },
      },
      required: ['command'],
      type: 'object',
    },
    name: 'project_action',
    serverId: 'fake',
    title: 'Project Action',
  },
];

const report = createSettingsMcpPolicyEvidenceReport({
  configText,
  presetId: 'deny-high-risk',
  tools,
});
assert.equal(report.kind, 'settings-mcp-policy-evidence');
assert.equal(report.status, 'ready');
assert.equal(report.changedCount, 3);
assert.equal(report.readyCount, 3);
assert.match(report.summaryText, /MCPPolicyEvidence status=ready preset=deny-high-risk ready=3\/3/u);

const searchRow = report.rows.find((row) => row.toolName === 'search_docs');
assert.equal(searchRow?.risk, 'read');
assert.equal(searchRow?.expectedMode, 'allow');
assert.equal(searchRow?.decisionMode, 'allow');
assert.equal(searchRow?.allowed, true);

const ticketRow = report.rows.find((row) => row.toolName === 'ticket_create');
assert.equal(ticketRow?.risk, 'reversible-write');
assert.equal(ticketRow?.expectedMode, 'allow');
assert.equal(ticketRow?.decisionMode, 'allow');

const projectRow = report.rows.find((row) => row.toolName === 'project_action');
assert.equal(projectRow?.risk, 'destructive-like');
assert.equal(projectRow?.expectedMode, 'deny');
assert.equal(projectRow?.decisionMode, 'deny');
assert.equal(projectRow?.allowed, false);
assert.ok(projectRow?.riskSignals.includes('schema:execution-arguments'));

const scopedReport = createSettingsMcpPolicyEvidenceReport({
  configText,
  presetId: 'short-timeout',
  serverId: 'fake',
  tools,
});
assert.equal(scopedReport.status, 'ready');
assert.ok(scopedReport.rows.every((row) => row.expectedMode === 'allow'));
assert.ok(scopedReport.rows.every((row) => row.decisionMode === 'allow'));

assert.match(createSettingsMcpPolicyEvidenceText(report), /settings-mcp-policy-evidence/u);
assert.equal(createSettingsMcpPolicyEvidenceToolKey(tools[0]), 'fake/search_docs');

assert.throws(
  () => createSettingsMcpPolicyEvidenceReport({
    configText: '[]',
    presetId: 'deny-high-risk',
    tools,
  }),
  /MCP config JSON/u,
);

console.log('agent MCP policy evidence smoke passed');
