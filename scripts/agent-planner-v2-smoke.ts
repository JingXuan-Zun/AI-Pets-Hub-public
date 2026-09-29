import assert from 'node:assert/strict';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  planner: plannerSource,
  registry: registrySource,
} = readProjectSources({
  planner: 'src/agent/agentPlanner.ts',
  registry: 'src/agent/agentToolRegistry.ts',
});

assert.match(
  plannerSource,
  /interface AgentPlannerToolStep[\s\S]*tool\?: string \| null;[\s\S]*steps\?: AgentPlannerToolStep\[\];/u,
  'Planner v2 should accept model-proposed tool steps',
);

assert.match(
  plannerSource,
  /"steps": \[\{ "tool": "optional tool name"[\s\S]*createAgentPlannerAvailableToolLines\(\)/u,
  'Planner prompt should expose tools and allow structured step hints',
);

assert.match(
  plannerSource,
  /function scorePlannerToolDefinition\([\s\S]*if \(!isObservationOnlyPlannerFallbackTool\(definition\.name\)\) \{[\s\S]*return 0;[\s\S]*get_display_info[\s\S]*inspect_local_project/u,
  'Planner fallback scoring should be limited to observation-only tools',
);

assert.match(
  plannerSource,
  /function normalizePlannerToolArgs\([\s\S]*launch_local_app[\s\S]*query: getStringArg\(args, \['query', 'appName', 'name'\]\)[\s\S]*organize_desktop_icons[\s\S]*resolveSafeDesktopOrganizationScope/u,
  'Planner fallback should normalize only explicit model-provided tool arguments',
);

assert.doesNotMatch(
  plannerSource,
  /inferAppQueryFromText|inferDesktopIconPlacementArgs|inferDesktopOrganizationPlacementAreaFromText|inferBrowserSearchQueryFromText|inferVoiceProviderFromText|parseChineseActionIndex/u,
  'Planner should not restore fixed natural-language argument extractors',
);

assert.match(
  plannerSource,
  /function createAgentCommandFromPlannerFallback\([\s\S]*resolvePlannerFallbackToolName\(sourceText\)[\s\S]*isObservationOnlyPlannerFallbackTool\(toolName\)[\s\S]*normalizePlannerToolArgs\(sourceText, toolName, \{\}\)/u,
  'Planner v2 fallback should be registry-driven but limited to observation-only tools',
);

assert.match(
  plannerSource,
  /if \(!decision\) \{[\s\S]*createAgentCommandFromPlannerFallback\(sourceText/u,
  'Planner v2 should fallback when model JSON cannot be parsed',
);

assert.match(
  plannerSource,
  /catch \(error\) \{[\s\S]*createAgentCommandFromPlannerFallback\(text\.trim\(\)/u,
  'Planner v2 should fallback when model planner call fails',
);

assert.match(
  plannerSource,
  /const toolName = normalizeToolName\(decision\.tool\)[\s\S]*primaryStep\?\.toolName;/u,
  'Planner v2 should resolve action tools only from direct model output or model-provided steps',
);

assert.match(
  registrySource,
  /AGENT_TOOL_REGISTRY[\s\S]*launch_local_app[\s\S]*organize_desktop_icons[\s\S]*get_system_info[\s\S]*inspect_local_project/u,
  'Planner v2 should be grounded in the registered Agent tools',
);

console.log('agent planner v2 smoke ok');
