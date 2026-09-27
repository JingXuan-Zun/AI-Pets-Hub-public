import { strict as assert } from 'node:assert';
import {
  applyMcpServerDraftToConfigText,
  parseMcpConfigText,
  removeMcpServerFromConfigText,
  type SettingsMcpServerDraft,
} from '../src/components/settings/settingsMcpConfigFormUtils';
import {
  createSettingsMcpConfigPreflight,
} from '../src/components/settings/settingsMcpConfigPreflight';
import {
  createSettingsMcpServerDraftApplyGate,
  createSettingsMcpServerDraftPreflight,
} from '../src/components/settings/settingsMcpServerDraftPreflight';
import {
  cloneMcpServerTemplateDraft,
  createMcpServerTemplates,
} from '../src/components/settings/settingsMcpServerTemplateUtils';
import { readProjectFile } from './smokeTestHarness.ts';

const baseConfigText = JSON.stringify({
  servers: [
    {
      args: ['server.js'],
      command: 'node',
      description: 'keep me',
      env: { A: '1' },
      id: 'existing',
      timeoutMs: 3000,
      title: 'Existing',
    },
  ],
}, null, 2);

const draft: SettingsMcpServerDraft = {
  argsText: 'fake-server.cjs\n--verbose',
  command: 'node',
  cwd: '.',
  envJson: '{"TOKEN":"test"}',
  id: 'fake',
  title: 'Fake MCP',
};

const applyResult = applyMcpServerDraftToConfigText(baseConfigText, draft);
assert.equal(applyResult.error, null);

const parsedResult = parseMcpConfigText(applyResult.rawText);
assert.equal(parsedResult.error, null);
assert.deepEqual(parsedResult.servers.map((server) => server.id), ['existing', 'fake']);

const savedConfig = JSON.parse(applyResult.rawText) as {
  servers: Array<Record<string, unknown>>;
};
const existingServer = savedConfig.servers.find((server) => server.id === 'existing');
assert.equal(existingServer?.description, 'keep me');
assert.equal(existingServer?.timeoutMs, 3000);

const fakeServer = savedConfig.servers.find((server) => server.id === 'fake');
assert.deepEqual(fakeServer?.args, ['fake-server.cjs', '--verbose']);
assert.deepEqual(fakeServer?.env, { TOKEN: 'test' });

const removeResult = removeMcpServerFromConfigText(applyResult.rawText, 'existing');
assert.equal(removeResult.error, null);
const removedConfig = JSON.parse(removeResult.rawText) as {
  servers: Array<Record<string, unknown>>;
};
assert.deepEqual(removedConfig.servers.map((server) => server.id), ['fake']);

const invalidEnvResult = applyMcpServerDraftToConfigText(baseConfigText, {
  ...draft,
  envJson: '[]',
});
assert.match(String(invalidEnvResult.error), /env JSON/u);

const templates = createMcpServerTemplates();
assert.deepEqual(templates.map((template) => template.id), ['local-node-stdio', 'npx-package']);
assert.equal(templates[0]?.draft.command, 'node');
assert.equal(templates[0]?.draft.argsText.includes('real-mcp-server.js'), true);
assert.equal(templates[1]?.draft.command, 'npx.cmd');
assert.equal(templates[1]?.draft.envJson.includes('replace-me'), true);
assert.match(`${templates[0]?.description} ${templates[1]?.description}`, /Replace/u);

const templateDraft = cloneMcpServerTemplateDraft(templates[0]);
templateDraft.argsText = 'server-a.js';
assert.notEqual(templateDraft.argsText, templates[0]?.draft.argsText);

const templateApplyResult = applyMcpServerDraftToConfigText('{"servers":[]}', templates[1]?.draft as SettingsMcpServerDraft);
assert.equal(templateApplyResult.error, null);
assert.equal(JSON.stringify(JSON.parse(templateApplyResult.rawText)).includes('replace-me'), true);

const emptyPreflight = createSettingsMcpServerDraftPreflight({
  argsText: '',
  command: '',
  cwd: '',
  envJson: '{}',
  id: '',
  title: '',
});
assert.equal(emptyPreflight.status, 'blocked');
assert.deepEqual(emptyPreflight.checks.filter((check) => check.status === 'blocked').map((check) => check.id), [
  'server-id',
  'command',
]);

const templatePreflight = createSettingsMcpServerDraftPreflight(templates[1]?.draft as SettingsMcpServerDraft);
assert.equal(templatePreflight.status, 'blocked');
assert.equal(templatePreflight.checks.some((check) => check.id === 'placeholder-values'), true);
const templateGate = createSettingsMcpServerDraftApplyGate(templatePreflight);
assert.equal(templateGate.canApply, false);
assert.match(templateGate.message, /Placeholder values/u);

const readyPreflight = createSettingsMcpServerDraftPreflight(draft);
assert.equal(readyPreflight.status, 'ready');
assert.match(readyPreflight.summaryText, /status=ready/u);
assert.equal(createSettingsMcpServerDraftApplyGate(readyPreflight).canApply, true);

const warningPreflight = createSettingsMcpServerDraftPreflight({
  ...draft,
  argsText: '',
});
assert.equal(warningPreflight.status, 'warning');
assert.equal(warningPreflight.checks.some((check) => check.id === 'missing-script-arg'), true);
assert.equal(createSettingsMcpServerDraftApplyGate(warningPreflight).canApply, true);

const emptyConfigPreflight = createSettingsMcpConfigPreflight('{"servers":[]}');
assert.equal(emptyConfigPreflight.status, 'blocked');
assert.equal(emptyConfigPreflight.serverCount, 0);
assert.equal(emptyConfigPreflight.checks.some((check) => check.id === 'server-count'), true);
assert.equal(emptyConfigPreflight.statusCounts.blocked, 1);

const invalidConfigPreflight = createSettingsMcpConfigPreflight('{ bad json');
assert.equal(invalidConfigPreflight.status, 'blocked');
assert.equal(invalidConfigPreflight.checks.some((check) => check.id === 'config-json'), true);

const duplicateConfigPreflight = createSettingsMcpConfigPreflight(JSON.stringify({
  servers: [{
    args: ['server-a.js'],
    command: 'node',
    id: 'dup',
  }, {
    args: ['server-b.js'],
    command: 'node',
    id: 'dup',
  }],
}));
assert.equal(duplicateConfigPreflight.status, 'blocked');
assert.equal(duplicateConfigPreflight.checks.some((check) => check.id === 'duplicate-dup'), true);

const templateConfigText = applyMcpServerDraftToConfigText(
  '{"servers":[]}',
  templates[1]?.draft as SettingsMcpServerDraft,
).rawText;
const templateConfigPreflight = createSettingsMcpConfigPreflight(templateConfigText);
assert.equal(templateConfigPreflight.status, 'blocked');
assert.equal(templateConfigPreflight.checks.some((check) => check.id.includes('blocked')), true);

const readyConfigPreflight = createSettingsMcpConfigPreflight(applyResult.rawText);
assert.equal(readyConfigPreflight.status, 'ready');
assert.match(readyConfigPreflight.summaryText, /servers=2/u);
assert.match(readyConfigPreflight.summaryText, /ready=/u);

const formSource = readProjectFile('src/components/settings/SettingsMcpServerForm.tsx');
const editorBlockSource = readProjectFile('src/components/settings/SettingsMcpConfigEditorBlock.tsx');
const configPreflightPanelSource = readProjectFile('src/components/settings/SettingsMcpConfigPreflightPanel.tsx');
const sectionSource = readProjectFile('src/components/settings/SettingsMcpSection.tsx');
const advancedWorkspaceSource = readProjectFile('src/components/settings/SettingsMcpAdvancedWorkspace.tsx');
const preflightPanelSource = readProjectFile('src/components/settings/SettingsMcpServerDraftPreflightPanel.tsx');
const panelSource = readProjectFile('src/components/settings/SettingsMcpServerTemplatePanel.tsx');
assert.match(formSource, /SettingsMcpServerTemplatePanel/u);
assert.match(formSource, /SettingsMcpServerDraftPreflightPanel/u);
assert.match(formSource, /createSettingsMcpServerDraftApplyGate/u);
assert.match(editorBlockSource, /SettingsMcpConfigPreflightPanel/u);
assert.match(editorBlockSource, /SettingsMcpServerForm/u);
assert.match(configPreflightPanelSource, /Config preflight/u);
assert.match(configPreflightPanelSource, /statusCounts\.warning/u);
assert.match(sectionSource, /SettingsMcpAdvancedWorkspace/u);
assert.match(advancedWorkspaceSource, /SettingsMcpConfigEditorBlock/u);
assert.match(preflightPanelSource, /Draft preflight/u);
assert.match(panelSource, /Config templates/u);
assert.match(panelSource, /Replace placeholders before saving/u);

console.log('agent MCP config form utils smoke passed');
