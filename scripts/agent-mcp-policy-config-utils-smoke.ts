import { strict as assert } from 'node:assert';
import {
  applyMcpToolPolicyDraftToConfigText,
  applyMcpPolicyTextToConfigText,
  getMcpToolPolicyDraft,
  getMcpPolicyText,
} from '../src/components/settings/settingsMcpPolicyConfigUtils';
import {
  applyMcpPolicyPresetToConfigText,
  clearMcpToolPoliciesInConfigText,
} from '../src/components/settings/settingsMcpPolicyBulkUtils';

const baseConfig = JSON.stringify({
  servers: [{ command: 'node', id: 'fake' }],
}, null, 2);
const policyText = JSON.stringify({
  servers: {
    fake: { retryCount: 1, timeoutMs: 2000 },
  },
  tools: {
    'fake/echo': { mode: 'deny' },
  },
}, null, 2);

const applied = applyMcpPolicyTextToConfigText(baseConfig, policyText);
assert.equal(applied.error, null);
assert.match(applied.rawText, /"policies"/u);
assert.match(getMcpPolicyText(applied.rawText), /fake\/echo/u);

const invalid = applyMcpPolicyTextToConfigText(baseConfig, '[]');
assert.equal(invalid.error, 'MCP policies must be a JSON object.');

const toolApplied = applyMcpToolPolicyDraftToConfigText(baseConfig, { name: 'echo', serverId: 'fake' }, {
  mode: 'deny',
  retryCountText: '2',
  timeoutMsText: '5000',
});
assert.equal(toolApplied.error, null);
const toolDraft = getMcpToolPolicyDraft(toolApplied.rawText, { name: 'echo', serverId: 'fake' });
assert.deepEqual(toolDraft, {
  mode: 'deny',
  retryCountText: '2',
  timeoutMsText: '5000',
});

const reset = applyMcpToolPolicyDraftToConfigText(toolApplied.rawText, { name: 'echo', serverId: 'fake' }, {
  mode: 'inherit',
  retryCountText: '',
  timeoutMsText: '',
});
assert.equal(reset.error, null);
assert.deepEqual(getMcpToolPolicyDraft(reset.rawText, { name: 'echo', serverId: 'fake' }), {
  mode: 'inherit',
  retryCountText: '',
  timeoutMsText: '',
});

const policyTools = [
  {
    annotations: { destructiveHint: true },
    description: 'Change one catalog entry.',
    inputSchema: { type: 'object' },
    name: 'catalog_change',
    serverId: 'fake',
    title: 'Catalog Change',
  },
  {
    description: 'Search documents.',
    inputSchema: { properties: { query: { type: 'string' } }, type: 'object' },
    name: 'search_docs',
    serverId: 'fake',
    title: 'Search Docs',
  },
  {
    description: 'Run a project action.',
    inputSchema: { properties: { command: { type: 'string' } }, type: 'object' },
    name: 'project_action',
    serverId: 'fake',
    title: 'Project Action',
  },
  {
    description: 'Echo text.',
    inputSchema: { properties: { text: { type: 'string' } }, type: 'object' },
    name: 'echo',
    serverId: 'other',
    title: 'Echo',
  },
];

const highRiskPreset = applyMcpPolicyPresetToConfigText(baseConfig, policyTools, 'deny-high-risk', 'fake');
assert.equal(highRiskPreset.error, null);
assert.equal(highRiskPreset.changedCount, 3);
assert.deepEqual(getMcpToolPolicyDraft(highRiskPreset.rawText, { name: 'project_action', serverId: 'fake' }), {
  mode: 'deny',
  retryCountText: '',
  timeoutMsText: '',
});
assert.deepEqual(getMcpToolPolicyDraft(highRiskPreset.rawText, { name: 'search_docs', serverId: 'fake' }), {
  mode: 'allow',
  retryCountText: '',
  timeoutMsText: '',
});
assert.equal(getMcpToolPolicyDraft(highRiskPreset.rawText, { name: 'catalog_change', serverId: 'fake' }).mode, 'deny');

const timeoutPreset = applyMcpPolicyPresetToConfigText(highRiskPreset.rawText, policyTools, 'short-timeout');
assert.equal(timeoutPreset.error, null);
assert.equal(timeoutPreset.changedCount, 4);
assert.equal(getMcpToolPolicyDraft(timeoutPreset.rawText, { name: 'echo', serverId: 'other' }).timeoutMsText, '10000');

const cleared = clearMcpToolPoliciesInConfigText(timeoutPreset.rawText, policyTools, 'fake');
assert.equal(cleared.error, null);
assert.equal(cleared.changedCount, 3);
assert.equal(getMcpToolPolicyDraft(cleared.rawText, { name: 'project_action', serverId: 'fake' }).mode, 'inherit');
assert.equal(getMcpToolPolicyDraft(cleared.rawText, { name: 'echo', serverId: 'other' }).timeoutMsText, '10000');

console.log('agent MCP policy config utils smoke passed');
