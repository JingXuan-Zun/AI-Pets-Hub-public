import { strict as assert } from 'node:assert';
import {
  createSettingsMcpConfigPreflight,
} from '../src/components/settings/settingsMcpConfigPreflight';
import {
  createSettingsMcpConfigPreflightExportName,
  formatSettingsMcpConfigPreflightExportText,
  parseSettingsMcpConfigPreflightExportText,
} from '../src/components/settings/settingsMcpConfigPreflightExport';
import { readProjectFile } from './smokeTestHarness.ts';

const preflight = createSettingsMcpConfigPreflight(JSON.stringify({
  servers: [{
    args: ['-y', '@vendor/real-mcp-server'],
    command: 'npx.cmd',
    env: { API_KEY: 'replace-me-secret' },
    id: 'template-server',
  }],
}));

const exportText = formatSettingsMcpConfigPreflightExportText(preflight, '2026-06-30T00:00:00.000Z');
const parsed = JSON.parse(exportText) as {
  exportedAt: string;
  kind: string;
  preflight: typeof preflight;
  source: string;
  version: number;
};

assert.equal(parsed.kind, 'mcp-config-preflight-settings-export');
assert.equal(parsed.version, 1);
assert.equal(parsed.source, 'settings-draft');
assert.equal(parsed.exportedAt, '2026-06-30T00:00:00.000Z');
assert.equal(parsed.preflight.status, 'blocked');
assert.equal(parsed.preflight.serverCount, 1);
assert.equal(parsed.preflight.statusCounts.blocked > 0, true);
assert.equal(exportText.includes('replace-me-secret'), false);
assert.match(createSettingsMcpConfigPreflightExportName(preflight), /mcp-config-preflight-blocked-1-servers\.json/u);

const imported = parseSettingsMcpConfigPreflightExportText(exportText, 'settings-export.json');
assert.equal(imported.inputPath, 'settings-export.json');
assert.equal(imported.preflight.status, preflight.status);
assert.equal(imported.preflight.serverCount, preflight.serverCount);
assert.deepEqual(imported.preflight.statusCounts, preflight.statusCounts);
assert.equal(imported.preflight.checks.length, preflight.checks.length);

assert.throws(
  () => parseSettingsMcpConfigPreflightExportText('{"kind":"wrong"}', 'bad.json'),
  /not a valid MCP config preflight/u,
);

const panelSource = readProjectFile('src/components/settings/SettingsMcpConfigPreflightPanel.tsx');
const buttonSource = readProjectFile('src/components/settings/SettingsMcpConfigPreflightExportButton.tsx');
assert.match(panelSource, /SettingsMcpConfigPreflightExportButton/u);
assert.match(buttonSource, /formatSettingsMcpConfigPreflightExportText/u);
assert.match(buttonSource, /Download/u);

console.log('agent MCP config preflight export smoke passed');
