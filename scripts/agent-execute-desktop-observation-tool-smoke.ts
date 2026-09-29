import assert from 'node:assert/strict';
import {
  AGENT_TOOL_INPUT_PARAM_SPECS,
  buildAgentPermissionRoute,
  getAgentToolLifecycleMetadata,
  isAgentPermissionRouteSilentReadOnly,
  isAgentToolAvailableInMode,
  listAgentToolNames,
  listRegisteredAgentToolNamesOutsideModePolicies,
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentToolCallName,
} from '../src/agent/legacy/index.ts';
import { executeObserveWindowsAndApps } from '../src/agent/agentRuntimeDesktopObservationTools.ts';
import { desktopPetShellRuntime } from '../src/desktopShellRuntime.ts';
import { type PetConfig } from '../src/types.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const toolName = 'execute_desktop_observation' satisfies AgentToolCallName;

function createToolCommand(input: Record<string, unknown>): AgentChatCommand {
  return {
    capabilityId: 'desktop-observation',
    instruction: 'test execute_desktop_observation',
    kind: 'tool-call',
    sourceText: '/agent test execute_desktop_observation',
    toolCall: {
      goal: 'test execute_desktop_observation',
      input,
      name: toolName,
    },
  };
}

const registeredTools = new Set(listAgentToolNames());
assert.equal(registeredTools.has(toolName), true);
assert.equal(isAgentToolAvailableInMode(toolName, 'agent'), true);
assert.equal(isAgentToolAvailableInMode(toolName, 'developer'), false);
assert.deepEqual(listRegisteredAgentToolNamesOutsideModePolicies(), []);

const lifecycle = getAgentToolLifecycleMetadata(toolName);
assert.equal(lifecycle.mutates.length, 0);
assert.equal(lifecycle.observes.includes('display-list'), true);
assert.equal(lifecycle.observes.includes('window-ui-controls'), true);
assert.equal(lifecycle.observes.includes('visual-summary'), true);
assert.equal(lifecycle.verifies.includes('desktop-observation-result'), true);

const schema = AGENT_TOOL_INPUT_PARAM_SPECS[toolName];
const actionSpec = schema.find((spec) => spec.key === 'action');
for (const action of [
  'screen_info',
  'list_desktop_items',
  'diagnose_desktop_icons',
  'active_window',
  'inspect_window_ui',
  'visual_snapshot',
  'cursor_position',
  'wait_and_observe',
]) {
  assert.equal(actionSpec?.enumValues?.includes(action), true);
}

for (const input of [
  { action: 'screen_info' },
  { action: 'active_window' },
  { action: 'inspect_window_ui', query: 'Launcher', targetText: 'Example Game' },
  { action: 'list_desktop_items', category: 'image', limit: 12 },
  { action: 'wait_and_observe', waitMs: 500 },
]) {
  const route = buildAgentPermissionRoute(createToolCommand(input));
  assert.equal(route.status, 'silent');
  assert.equal(route.maxRisk, 'read');
  assert.equal(route.requiresApproval, false);
  assert.equal(isAgentPermissionRouteSilentReadOnly(route), true);
}

const visualRoute = buildAgentPermissionRoute(createToolCommand({
  action: 'visual_snapshot',
  question: 'What is visible?',
  sourceType: 'screen',
}));
assert.equal(visualRoute.status, 'notify');
assert.equal(visualRoute.maxRisk, 'visual');

const {
  itemToolsSource,
  registrySource,
  runtimeSource,
  sessionSource,
} = readProjectSources({
  itemToolsSource: 'src/agent/agentRuntimeDesktopItemTools.ts',
  registrySource: 'src/agent/agentToolRegistry.ts',
  runtimeSource: 'src/agent/agentRuntimeExecutor.ts',
  sessionSource: 'src/agent/agentProductionSessionImplementation.ts',
});

assert.match(registrySource, /name: 'execute_desktop_observation'/u);
assert.match(runtimeSource, /function executeDesktopObservation/u);
assert.match(runtimeSource, /function executeWaitAndObserveDesktop/u);
assert.match(itemToolsSource, /export async function executeListDesktopItems/u);
assert.match(itemToolsSource, /includeFileSystemFallback: true/u);
assert.match(itemToolsSource, /includeReadOnlyPositionFallback: true/u);
assert.match(sessionSource, /execute_desktop_observation/u);
assert.match(sessionSource, /wait_and_observe/u);

const originalObserveWindowsAndApps = desktopPetShellRuntime.observeWindowsAndApps;
try {
  desktopPetShellRuntime.observeWindowsAndApps = async () => ({
    installedApps: [{
      name: 'ExampleLauncher',
      path: 'C:\\Example\\ExampleLauncher.exe',
      type: 'start-menu',
    }],
    installedCount: 1,
    ok: true,
    query: 'ExampleLauncher',
    runningApps: [],
    runningCount: 0,
    taskbarPinnedApps: [{
      name: 'ExamplePinned',
      path: 'C:\\Example\\ExamplePinned.lnk',
      shortcutTargetPath: 'C:\\Example\\ExamplePinned.exe',
      taskbarPinned: true,
      type: 'taskbar',
    }],
    taskbarPinnedCount: 1,
  });

  const observeResult = await executeObserveWindowsAndApps({
    goal: 'open ExampleLauncher',
    input: {
      includeInstalledApps: true,
      includeRunningApps: true,
      includeTaskbarPinned: true,
      query: 'ExampleLauncher',
    },
    name: 'observe_windows_and_apps',
  });
  const candidates = observeResult.stateSummary?.structuredEvidence?.targetCandidates ?? [];
  assert.equal(observeResult.ok, true);
  assert.equal(candidates.some((candidate) => (
    candidate.label === 'ExampleLauncher'
    && candidate.relation === 'installed-app'
    && candidate.actions?.includes('launch_local_app')
  )), true);
  assert.equal(candidates.some((candidate) => (
    candidate.label === 'ExamplePinned'
    && candidate.relation === 'taskbar-pinned'
    && candidate.actions?.includes('launch_local_app')
  )), true);
} finally {
  desktopPetShellRuntime.observeWindowsAndApps = originalObserveWindowsAndApps;
}

const settings = {} as PetConfig['settings'];
let modelCallCount = 0;
const sessionResult = await runAgentProductionSession({
  maxSteps: 3,
  modelCaller: async ({ systemInstruction, userInput }) => {
    modelCallCount += 1;
    assert.match(systemInstruction, /execute_desktop_observation/u);

    if (modelCallCount === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: { action: 'screen_info' },
        reason: 'Need live display facts before answering.',
        tool: toolName,
        understanding: {
          neededCapability: 'desktop environment observation',
          successCriteria: 'current display data is observed',
          userNeed: 'check the current screen setup',
        },
      });
    }

    assert.match(userInput, /tool=execute_desktop_observation/u);
    assert.match(userInput, /2560x1440/u);
    return JSON.stringify({
      action: 'final_answer',
      message: 'I read the current screen information.',
      understanding: {
        successCriteria: 'tool result was observed',
        userNeed: 'check the current screen setup',
      },
    });
  },
  settings,
  sourceText: '/agent check my screens',
  toolExecutor: async (command) => {
    assert.equal(command.capabilityId, 'desktop-observation');
    assert.equal(command.toolCall?.name, toolName);
    assert.equal(command.toolCall?.input.action, 'screen_info');
    return {
      observations: ['Desktop observation: get_display_info', 'Display 1 primary 2560x1440'],
      ok: true,
      responseText: 'Display 1 primary 2560x1440',
      verification: 'read display info',
    };
  },
  userGoal: 'check my screens',
});

assert.equal(sessionResult.status, 'completed');
assert.equal(sessionResult.toolResults.length, 1);
assert.equal(sessionResult.toolResults[0]?.command.toolCall?.name, toolName);

console.log('agent execute desktop observation tool smoke ok');
