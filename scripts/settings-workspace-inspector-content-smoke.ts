import assert from 'node:assert/strict';
import { parseAgentExternalSkillImport } from '../src/agent/agentExternalSkillLibrary';
import { SETTINGS_CONTROL_CENTER_MODULES, getSettingsControlCenterPage } from '../src/components/settings/settingsControlCenterNavigation';
import {
  createSettingsWorkspaceInspectorMcpItems,
  createSettingsWorkspaceInspectorSkillItems,
  getSettingsWorkspaceInspectorModuleGuide,
  SETTINGS_WORKSPACE_INSPECTOR_MODULE_GUIDES,
} from '../src/components/settings/settingsWorkspaceInspectorContent';
import { readProjectSources } from './smokeTestHarness';

const importedSkill = parseAgentExternalSkillImport('---\nname: h3-prompt-writing\ndescription: Write video prompts\n---\n# H3', 'h3-prompt-writing.md').skill;
assert.ok(importedSkill);
assert.deepEqual(createSettingsWorkspaceInspectorSkillItems([importedSkill]), [{
  detail: 'h3-prompt-writing.md',
  id: 'external.h3-prompt-writing',
  status: '已启用 · 按需运行',
  title: 'H3',
}]);

assert.deepEqual(createSettingsWorkspaceInspectorMcpItems([{
  id: 'filesystem',
  title: 'Filesystem MCP',
  tools: [{}, {}],
}]), [{
  id: 'filesystem',
  status: '已发现 · 2 项工具',
  title: 'Filesystem MCP',
}]);

const pageIds = SETTINGS_CONTROL_CENTER_MODULES.flatMap((module) => module.pages.map((page) => page.id));
assert.deepEqual(Object.keys(SETTINGS_WORKSPACE_INSPECTOR_MODULE_GUIDES).sort(), [...pageIds].sort());
for (const pageId of pageIds) {
  const guide = getSettingsWorkspaceInspectorModuleGuide(getSettingsControlCenterPage(pageId));
  assert.ok(guide.purpose.length > 0, `${pageId} needs a purpose`);
  assert.ok(guide.useCases.length > 0, `${pageId} needs use cases`);
  assert.ok(guide.affects.length > 0, `${pageId} needs effects`);
}
assert.match(
  getSettingsWorkspaceInspectorModuleGuide(getSettingsControlCenterPage('extension-deepseek-harness')).purpose,
  /DeepSeek Harness/u,
);

const { inspectorSource } = readProjectSources({
  inspectorSource: 'src/components/settings/SettingsWorkspaceInspector.tsx',
});
assert.match(inspectorSource, /getSettingsWorkspaceInspectorModuleGuide/u);
assert.match(inspectorSource, /模块说明/u);
assert.match(inspectorSource, /props\.page\.label/u);
assert.match(inspectorSource, /loadEnabledAgentImportedSkills/u);
assert.match(inspectorSource, /listExternalAgentMcpRegistry/u);
assert.doesNotMatch(inspectorSource, /createAgentSkillManifest|listAvailableAgentMcpServers/u);

console.log('settings workspace inspector content smoke passed');
