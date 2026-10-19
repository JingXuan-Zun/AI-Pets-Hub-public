import { strict as assert } from 'node:assert';
import { readProjectFile } from './smokeTestHarness.ts';

const navigationSource = readProjectFile('src/components/settings/settingsControlCenterNavigation.ts');
const mcpSectionSource = readProjectFile('src/components/settings/SettingsMcpSection.tsx');
const mcpOverviewSource = readProjectFile('src/components/settings/SettingsMcpBeginnerOverview.tsx');

assert.match(navigationSource, /id: 'platform-mcp', label: 'MCP 管理'/u);
assert.match(navigationSource, /id: 'platform-skills-api', label: 'Skills'/u);

assert.match(mcpSectionSource, /useState\(false\)/u);
assert.match(mcpSectionSource, /SettingsMcpBeginnerOverview/u);
assert.match(mcpSectionSource, /advancedOpen \? \(/u);
assert.match(mcpSectionSource, /SettingsMcpAdvancedWorkspace/u);
assert.match(mcpOverviewSource, /普通|还没有添加外部工具/u);
assert.doesNotMatch(mcpOverviewSource, /stdio|JSON Pointer|Schema|Manifest/u);

// The Skills page lists imported skills only; the built-in skill panels were removed.

console.log('settings capability progressive disclosure smoke passed');
