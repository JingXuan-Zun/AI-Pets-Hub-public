import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
} from '../src/agent/legacy/index.ts';
import {
  createAgentCommandFromPlannerDecision,
  resolveAgentChatCommand,
} from '../src/agent/agentLegacy.ts';
import { type PetConfig } from '../src/types.ts';
import { readProjectFile } from './smokeTestHarness.ts';

const chatCommandSource = readProjectFile('src/agent/agentChatCommand.ts');
const legacyChatCommandSource = readProjectFile('src/agent/agentLegacyChatCommand.ts');
const plannerSource = readProjectFile('src/agent/agentPlanner.ts');
const plannerRelevanceSource = readProjectFile('src/agent/agentPlannerRelevance.ts');
const agentIndexSource = readProjectFile('src/agent/index.ts');
const agentLegacySource = readProjectFile('src/agent/agentLegacy.ts');
const sessionSource = readProjectFile('src/agent/agentProductionSessionImplementation.ts');
const runtimeSource = readProjectFile('src/agent/agentRuntimeExecutor.ts');
const registrySource = readProjectFile('src/agent/agentToolRegistry.ts');
const chatEntryRouterSource = readProjectFile('src/agent/agentChatEntryRouter.ts');
const typesSource = readProjectFile('src/types.ts');
const agentRunControllerSource = readProjectFile('src/components/chat/agentRunController.ts');
const appLauncherSource = readProjectFile('electron/appLauncherService.cjs');
const showcaseSource = readProjectFile('src/components/pet/useDesktopOrganizationShowcase.ts');

assert.equal(
  resolveAgentChatCommand('open browser naturally'),
  null,
  'natural app launch text should not become a deterministic app-launch command',
);
assert.equal(
  resolveAgentChatCommand('甯垜鎶婂洖鏀剁珯鏁寸悊鍒版帶鍒堕潰鏉夸笅闈㈡斁鏁撮綈'),
  null,
  'single-icon placement text should not become a deterministic desktop-icon-placement command',
);
assert.equal(
  resolveAgentChatCommand('organize secondary display icons naturally'),
  null,
  'desktop organization text should not bypass planner through fixed parsing',
);

const unsupportedApp = createAgentCommandFromPlannerDecision('open browser naturally', {
  intent: 'unsupported',
  message: 'model did not select a tool',
});
assert.equal(unsupportedApp?.kind, 'unsupported');

const modelProvidedApp = createAgentCommandFromPlannerDecision('open browser naturally', {
  args: {
    query: 'browser',
  },
  intent: 'tool',
  tool: 'launch_local_app',
});
assert.equal(modelProvidedApp?.kind, 'tool-call');
assert.equal(modelProvidedApp?.toolCall?.name, 'launch_local_app');
assert.equal(modelProvidedApp?.toolCall?.input.query, 'browser');

const modelOmittedPlacement = createAgentCommandFromPlannerDecision('鎶婂洖鏀剁珯鏀惧埌鎺у埗闈㈡澘涓嬮潰', {
  args: {},
  intent: 'tool',
  tool: 'place_desktop_icon',
});
assert.equal(modelOmittedPlacement?.kind, 'unsupported');

assert.doesNotMatch(chatCommandSource, /function parseAppLaunchIntent/u);
assert.doesNotMatch(chatCommandSource, /function parseDesktopIconPlacementIntent/u);
assert.doesNotMatch(chatCommandSource, /function parseDesktopOrganizationIntent/u);
assert.doesNotMatch(
  chatCommandSource,
  /resolveAgentChatCommand|AGENT_COMMAND_PREFIXES|parseSlashCommandBody|kind: 'unsupported'/u,
  'shared AgentChatCommand types should not create legacy slash/unsupported commands',
);
assert.match(
  legacyChatCommandSource,
  /resolveAgentChatCommand[\s\S]*kind: 'unsupported'/u,
  'legacy slash command resolver should stay behind the explicit legacy module',
);
assert.doesNotMatch(plannerSource, /inferAppQueryFromText|inferDesktopIconPlacementArgs|inferDesktopOrganizationPlacementAreaFromText/u);
assert.doesNotMatch(
  plannerSource,
  /inferBrowserSearchQueryFromText|inferVoiceProviderFromText|inferVoiceEnabledFromText|inferAutoSpeakFromText|inferVoiceInputEnabledFromText|inferVoiceInputAgentPrefixFromText|parseChineseActionIndex/u,
  'Planner should not restore fixed natural-language parameter inference for executable tools',
);
assert.doesNotMatch(
  registrySource,
  /relevanceKeywords|matchesAgentToolRelevance/u,
  'active tool registry should not carry legacy keyword relevance routing',
);
assert.match(
  plannerRelevanceSource,
  /AGENT_LEGACY_PLANNER_RELEVANCE_KEYWORDS[\s\S]*matchesAgentLegacyPlannerToolRelevance/u,
  'legacy keyword relevance should live in the legacy planner-only module',
);
assert.match(
  plannerSource,
  /agentPlannerRelevance[\s\S]*getAgentLegacyPlannerRelevanceKeywords[\s\S]*matchesAgentLegacyPlannerToolRelevance/u,
  'legacy planner should be the only active code path using keyword relevance',
);
assert.doesNotMatch(
  sessionSource,
  /agentPlannerRelevance|AGENT_LEGACY_PLANNER_RELEVANCE_KEYWORDS|matchesAgentLegacyPlannerToolRelevance/u,
  'AgentSessionV2 should not import legacy keyword relevance routing',
);
assert.doesNotMatch(
  chatEntryRouterSource,
  /agentPlannerRelevance|AGENT_LEGACY_PLANNER_RELEVANCE_KEYWORDS|matchesAgentLegacyPlannerToolRelevance/u,
  'active chat entry router should not import legacy keyword relevance routing',
);
assert.doesNotMatch(
  agentIndexSource,
  /agentCore|agentPlanner|agentFollowUpContinuation|agentLegacyChatCommand|resolveAgentChatCommand/u,
  'main agent barrel should not re-export the legacy Core/Planner/follow-up/slash command chain',
);
assert.match(
  agentLegacySource,
  /export \* from '.\/agentCore'[\s\S]*export \* from '.\/agentLegacyChatCommand'[\s\S]*export \* from '.\/agentPlanner'/u,
  'legacy Core/Planner exports should stay behind an explicit legacy module',
);
assert.doesNotMatch(
  typesSource,
  /agentLegacy|import type \{ AgentCorePlan \}|AgentCorePlan\[/u,
  'shared app types should not import legacy Agent Core types',
);
assert.doesNotMatch(
  agentRunControllerSource,
  /agentLegacy|AgentCoreAutoContinuationStartEvent/u,
  'active chat controller should not import legacy Agent Core event types',
);
assert.match(
  agentRunControllerSource,
  /type AgentRunControllerAutoContinuationStartEvent/u,
  'active chat controller should use a local minimal shape for legacy auto-continuation display data',
);
assert.match(
  sessionSource,
  /from '.\/agentResultAssessment'/u,
  'AgentSessionV2 should use shared result assessment helpers instead of importing the legacy core run loop',
);
assert.doesNotMatch(
  sessionSource,
  /AGENT_SESSION_V2_COMPATIBILITY_TOOL_REPLACEMENTS|Use execute_desktop_action action "launch_local_app"/u,
  'AgentSessionV2 should not keep a fixed legacy-tool-to-new-action replacement table',
);
assert.doesNotMatch(
  sessionSource,
  /supports actions such as|Do not use search_web\/browser_search\/control_browser search_web|Use execute_desktop_action action "/u,
  'AgentSessionV2 rules should describe capability selection instead of long fixed action enumerations',
);
assert.doesNotMatch(runtimeSource, /placementArea/u);
assert.doesNotMatch(registrySource, /placementArea/u);
assert.doesNotMatch(showcaseSource, /placementArea/u);
assert.doesNotMatch(appLauncherSource, /resolveKnownApp|resolveChromeApp|resolvePhotoshopApp|launchDefaultBrowser|PHOTOSHOP_ALIASES|CHROME_ALIASES|GENERIC_BROWSER_ALIASES/u);

let capturedSessionV2Instruction = '';
await runAgentProductionSession({
  modelCaller: async ({ systemInstruction }) => {
    capturedSessionV2Instruction = systemInstruction;
    return JSON.stringify({
      action: 'final_answer',
      message: 'ok',
    });
  },
  settings: {} as PetConfig['settings'],
  sourceText: '/agent ping',
  userGoal: 'ping',
});

function assertPrimaryToolLineVisible(toolName: string) {
  assert.match(capturedSessionV2Instruction, new RegExp(`\\n- ${toolName}:`, 'u'));
}

function assertCompatibilityToolLineHidden(toolName: string) {
  assert.doesNotMatch(capturedSessionV2Instruction, new RegExp(`\\n- ${toolName}:`, 'u'));
}

assertPrimaryToolLineVisible('execute_desktop_action');
assertPrimaryToolLineVisible('execute_desktop_observation');
assertPrimaryToolLineVisible('execute_local_file_action');
assertPrimaryToolLineVisible('execute_file_management_action');
assertPrimaryToolLineVisible('execute_memory_action');
assertPrimaryToolLineVisible('control_browser');
assertCompatibilityToolLineHidden('launch_local_app');
assertCompatibilityToolLineHidden('browser_search');
assertCompatibilityToolLineHidden('get_default_app_for_uri');
assertCompatibilityToolLineHidden('list_running_apps');
assertCompatibilityToolLineHidden('get_active_window_info');
assertCompatibilityToolLineHidden('focus_window');
assertCompatibilityToolLineHidden('open_resource');
assertCompatibilityToolLineHidden('search_web');
assertCompatibilityToolLineHidden('get_path_info');
assertCompatibilityToolLineHidden('list_directory');
assertCompatibilityToolLineHidden('search_files');
assertCompatibilityToolLineHidden('read_text_file');
assertCompatibilityToolLineHidden('get_system_info');
assertCompatibilityToolLineHidden('get_display_info');
assertCompatibilityToolLineHidden('summarize_visual_snapshot');
assertCompatibilityToolLineHidden('list_capture_sources');
assertCompatibilityToolLineHidden('get_cursor_position');
assertCompatibilityToolLineHidden('place_desktop_icon');

let compatibilityModelCallCount = 0;
let compatibilityToolExecutionCount = 0;
const compatibilityResult = await runAgentProductionSession({
  maxSteps: 3,
  modelCaller: async ({ userInput }) => {
    compatibilityModelCallCount += 1;
    if (compatibilityModelCallCount === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: {
          query: 'browser',
        },
        reason: 'Old wrapper should be rejected by V2 primary tool validation.',
        tool: 'launch_local_app',
      });
    }

    assert.match(userInput, /Compatibility-only tool "launch_local_app"/u);
    assert.match(userInput, /desktop\/app\/window\/browser\/resource task/u);
    assert.match(userInput, /choose the next primary tool from the available tool list/u);
    assert.doesNotMatch(userInput, /Use execute_desktop_action action "launch_local_app"/u);
    return JSON.stringify({
      action: 'tool_call',
      args: {
        action: 'focus_window',
        target: 'browser',
      },
      reason: 'After the compatibility-only wrapper was rejected, use the primary desktop action tool instead.',
      tool: 'execute_desktop_action',
    });
  },
  settings: {} as PetConfig['settings'],
  sourceText: '/agent open browser',
  toolExecutor: async () => {
    compatibilityToolExecutionCount += 1;
    throw new Error('compatibility-only tool should not execute in AgentSessionV2');
  },
  userGoal: 'open browser',
});

assert.equal(compatibilityResult.status, 'needs-approval');
assert.equal(compatibilityModelCallCount, 2);
assert.equal(compatibilityToolExecutionCount, 0);
assert.equal(compatibilityResult.pendingApproval?.command.toolCall?.name, 'execute_desktop_action');
assert.equal(compatibilityResult.pendingApproval?.command.toolCall?.input.action, 'focus_window');

console.log('agent fixed directives removed smoke ok');
