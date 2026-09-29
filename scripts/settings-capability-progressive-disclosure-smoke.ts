import { strict as assert } from 'node:assert';
import { readProjectFile } from './smokeTestHarness.ts';

const navigationSource = readProjectFile('src/components/settings/settingsControlCenterNavigation.ts');
const mcpSectionSource = readProjectFile('src/components/settings/SettingsMcpSection.tsx');
const mcpOverviewSource = readProjectFile('src/components/settings/SettingsMcpBeginnerOverview.tsx');
const skillPanelSource = readProjectFile('src/components/settings/SettingsAgentSkillManifestPanel.tsx');
const skillOverviewSource = readProjectFile('src/components/settings/SettingsAgentSkillOverview.tsx');
const skillDeveloperSource = readProjectFile('src/components/settings/SettingsAgentSkillDeveloperView.tsx');

assert.match(navigationSource, /id: 'platform-mcp', label: 'MCP 管理'/u);
assert.match(navigationSource, /id: 'platform-skills-api', label: 'Skills'/u);

assert.match(mcpSectionSource, /useState\(false\)/u);
assert.match(mcpSectionSource, /SettingsMcpBeginnerOverview/u);
assert.match(mcpSectionSource, /advancedOpen \? \(/u);
assert.match(mcpSectionSource, /SettingsMcpAdvancedWorkspace/u);
assert.match(mcpOverviewSource, /普通|还没有添加外部工具/u);
assert.doesNotMatch(mcpOverviewSource, /stdio|JSON Pointer|Schema|Manifest/u);

assert.match(skillPanelSource, /useState\(false\)/u);
assert.match(skillPanelSource, /SettingsAgentSkillOverview/u);
assert.match(skillPanelSource, /advancedOpen \? \(/u);
assert.match(skillPanelSource, /SettingsAgentSkillDeveloperView/u);
assert.match(skillOverviewSource, /角色动作/u);
assert.match(skillOverviewSource, /执行操作前会确认/u);
assert.doesNotMatch(skillOverviewSource, /WASM|JSON|runtime policy/u);
assert.match(skillDeveloperSource, /Manifest、路由、脚手架、签名包和运行时诊断/u);

console.log('settings capability progressive disclosure smoke passed');
