import assert from 'node:assert/strict';
import { readProjectSources } from './smokeTestHarness';
import {
  buildDeepSeekHarnessAgentGoal,
  DEEPSEEK_HARNESS_AGENT_IMPORT_TEMPLATE,
  parseDeepSeekHarnessAgentImport,
} from '../src/agent/deepseekHarnessAgentLibrary';

const imported = parseDeepSeekHarnessAgentImport(JSON.stringify({
  description: 'Read project files and report findings.',
  id: 'workspace-analyst',
  instructions: 'Use only the approved Workspace. Summarize evidence before conclusions.',
  kind: 'ai-desktop-pet-harness-agent.v1',
  name: 'Workspace Analyst',
}));
assert.equal(imported.agent?.id, 'workspace-analyst');
assert.equal(imported.agent?.name, 'Workspace Analyst');
assert.match(
  buildDeepSeekHarnessAgentGoal('Review the notes.', imported.agent),
  /approved Workspace/u,
);
assert.equal(parseDeepSeekHarnessAgentImport('{"kind":"invalid"}').agent, null);
assert.equal(parseDeepSeekHarnessAgentImport(DEEPSEEK_HARNESS_AGENT_IMPORT_TEMPLATE).agent?.id, 'workspace-analyst');

const { runtimeSource, sectionSource, workbenchSource } = readProjectSources({
  runtimeSource: 'src/agent/agentProductionSession.ts',
  sectionSource: 'src/components/settings/SettingsAgentRuntimeSection.tsx',
  workbenchSource: 'src/components/settings/SettingsDeepSeekHarnessAgentWorkbench.tsx',
});
assert.match(runtimeSource, /getSelectedDeepSeekHarnessAgent/u);
assert.match(runtimeSource, /userGoal: harnessUserGoal/u);
assert.match(sectionSource, /展开 Harness 工作台/u);
assert.match(sectionSource, /SettingsDeepSeekHarnessAgentWorkbench/u);
assert.match(workbenchSource, /导入 Harness Agent JSON/u);
assert.match(workbenchSource, /查看 Agent JSON 模板/u);
assert.match(workbenchSource, /runDeepSeekHarness/u);

console.log('deepseek harness agent library smoke passed');
