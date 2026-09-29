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
import { type PetConfig } from '../src/types.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const expectedTools: AgentToolCallName[] = [
  'get_active_window_info',
  'list_capture_sources',
  'get_cursor_position',
];

const actionKindByTool: Record<(typeof expectedTools)[number], string> = {
  get_active_window_info: 'get-active-window-info',
  get_cursor_position: 'get-cursor-position',
  list_capture_sources: 'list-capture-sources',
};

const bridgeMethodByTool: Record<(typeof expectedTools)[number], string> = {
  get_active_window_info: 'getActiveWindowInfo',
  get_cursor_position: 'getCursorScreenPoint',
  list_capture_sources: 'listCaptureSources',
};

function createToolCommand(
  name: AgentToolCallName,
  input: Record<string, unknown> = {},
): AgentChatCommand {
  return {
    capabilityId: 'desktop-observation',
    instruction: `test ${name}`,
    kind: 'tool-call',
    sourceText: `/agent test ${name}`,
    toolCall: {
      goal: `test ${name}`,
      input,
      name,
    },
  };
}

const registeredTools = new Set(listAgentToolNames());
for (const toolName of expectedTools) {
  assert.equal(registeredTools.has(toolName), true, `${toolName} should be registered`);
  assert.equal(isAgentToolAvailableInMode(toolName, 'agent'), true, `${toolName} should be available in Agent mode`);
  assert.equal(getAgentToolLifecycleMetadata(toolName).mutates.length, 0, `${toolName} should not mutate state`);
}

assert.deepEqual(listRegisteredAgentToolNamesOutsideModePolicies(), []);
assert.deepEqual(AGENT_TOOL_INPUT_PARAM_SPECS.get_active_window_info, []);
assert.deepEqual(AGENT_TOOL_INPUT_PARAM_SPECS.get_cursor_position, []);
assert.equal(
  AGENT_TOOL_INPUT_PARAM_SPECS.list_capture_sources.some((spec) => spec.key === 'captureSourceTypes'),
  true,
  'list_capture_sources should accept a source type selector',
);

const activeWindowRoute = buildAgentPermissionRoute(createToolCommand('get_active_window_info'));
assert.equal(activeWindowRoute.status, 'silent');
assert.equal(activeWindowRoute.routeMode, 'agent');
assert.equal(activeWindowRoute.maxRisk, 'read');
assert.equal(isAgentPermissionRouteSilentReadOnly(activeWindowRoute), true);

const cursorRoute = buildAgentPermissionRoute(createToolCommand('get_cursor_position'));
assert.equal(cursorRoute.status, 'silent');
assert.equal(cursorRoute.maxRisk, 'read');
assert.equal(isAgentPermissionRouteSilentReadOnly(cursorRoute), true);

const captureRoute = buildAgentPermissionRoute(createToolCommand('list_capture_sources', {
  captureSourceTypes: 'window',
  includeCaptureThumbnails: true,
}));
assert.equal(captureRoute.status, 'notify');
assert.equal(captureRoute.routeMode, 'agent');
assert.equal(captureRoute.maxRisk, 'visual');
assert.equal(captureRoute.requiresApproval, false);
assert.equal(isAgentPermissionRouteSilentReadOnly(captureRoute), false);

const {
  actionPolicySource,
  appLauncherSource,
  capabilitySource,
  desktopBridgeSource,
  desktopObservationToolsSource,
  desktopRuntimeSource,
  ipcSource,
  orchestratorSource,
  preloadSource,
  registrySource,
  runtimeSource,
  sessionV2Source,
  visualToolsSource,
  viteEnvSource,
} = readProjectSources({
  actionPolicySource: 'src/agent/agentActionPolicy.ts',
  appLauncherSource: 'electron/appLauncherService.cjs',
  capabilitySource: 'src/agent/agentCapabilityTypes.ts',
  desktopBridgeSource: 'src/desktopShellBridge.ts',
  desktopObservationToolsSource: 'src/agent/agentRuntimeDesktopObservationTools.ts',
  desktopRuntimeSource: 'src/desktopShellRuntime.ts',
  ipcSource: 'electron/ipcHandlers.cjs',
  orchestratorSource: 'src/agent/agentOrchestrator.ts',
  preloadSource: 'electron/preload.cjs',
  registrySource: 'src/agent/agentToolRegistry.ts',
  runtimeSource: 'src/agent/agentRuntimeExecutor.ts',
  sessionV2Source: 'src/agent/agentProductionSessionImplementation.ts',
  visualToolsSource: 'src/agent/agentRuntimeVisualTools.ts',
  viteEnvSource: 'src/vite-env.d.ts',
});

assert.match(appLauncherSource, /function getActiveWindowInfo/u);
assert.match(appLauncherSource, /GetForegroundWindow/u);
assert.match(viteEnvSource, /DesktopPetActiveWindowInfoResultLike/u);
assert.match(sessionV2Source, /get_active_window_info/u);
assert.match(sessionV2Source, /list_capture_sources/u);
assert.match(sessionV2Source, /get_cursor_position/u);
assert.match(runtimeSource, /from '.\/agentRuntimeDesktopTools'/u);
assert.match(runtimeSource, /from '.\/agentRuntimeDesktopObservationTools'/u);
assert.match(runtimeSource, /from '.\/agentRuntimeVisualTools'/u);
assert.match(desktopObservationToolsSource, /export async function executeGetActiveWindowInfo/u);
assert.match(visualToolsSource, /export async function executeListCaptureSources/u);
assert.match(desktopObservationToolsSource, /export async function executeGetCursorPosition/u);

for (const toolName of expectedTools) {
  const actionKind = actionKindByTool[toolName];
  const bridgeMethod = bridgeMethodByTool[toolName];
  assert.match(capabilitySource, new RegExp(`'${actionKind}'`, 'u'), `${actionKind} should be typed`);
  assert.match(orchestratorSource, new RegExp(`case '${toolName}'`, 'u'), `${toolName} should have a plan`);
  assert.match(runtimeSource, new RegExp(`${toolName}:`, 'u'), `${toolName} should have a runtime handler`);
  assert.match(desktopBridgeSource, new RegExp(`${bridgeMethod}:`, 'u'), `${bridgeMethod} should be bridged`);
  assert.match(desktopRuntimeSource, new RegExp(`${bridgeMethod}: desktopPetShellBridge\\.${bridgeMethod}`, 'u'), `${bridgeMethod} should be in runtime facade`);
}

assert.match(actionPolicySource, /'get-active-window-info': 'read'/u);
assert.match(actionPolicySource, /'get-cursor-position': 'read'/u);
assert.match(actionPolicySource, /'list-capture-sources': 'visual'/u);
assert.match(ipcSource, /desktop-pet:get-active-window-info/u);
assert.match(ipcSource, /desktop-pet:list-capture-sources/u);
assert.match(preloadSource, /getActiveWindowInfo/u);
assert.match(preloadSource, /listCaptureSources: \(request\)/u);

let modelCallCount = 0;
const settings = {} as PetConfig['settings'];
const sessionResult = await runAgentProductionSession({
  maxSteps: 3,
  modelCaller: async ({ systemInstruction, userInput }) => {
    modelCallCount += 1;
    assert.match(systemInstruction, /get_active_window_info/u);
    assert.match(systemInstruction, /list_capture_sources/u);
    assert.match(systemInstruction, /get_cursor_position/u);

    if (modelCallCount === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: {
          action: 'get_active_window_info',
        },
        reason: 'Need to observe the current foreground window before answering.',
        tool: 'execute_desktop_observation',
        understanding: {
          neededCapability: 'desktop observation',
          successCriteria: 'foreground window process and title are observed',
          userNeed: 'know the current active window',
        },
      });
    }

    assert.match(userInput, /tool=execute_desktop_observation/u);
    assert.match(userInput, /ok=true/u);
    return JSON.stringify({
      action: 'final_answer',
      message: 'Read the current active window.',
      understanding: {
        successCriteria: 'tool result was observed',
        userNeed: 'know the current active window',
      },
    });
  },
  settings,
  sourceText: '/agent what is the current window?',
  toolExecutor: async (command) => {
    assert.equal(command.capabilityId, 'desktop-observation');
    assert.equal(command.toolCall?.name, 'execute_desktop_observation');
    assert.equal(command.toolCall?.input.action, 'get_active_window_info');
    return {
      ok: true,
      responseText: '当前活动窗口：Smoke Window\n进程：smoke',
      verification: 'smoke verified active window',
    };
  },
  userGoal: 'what is the current window?',
});

assert.equal(sessionResult.status, 'completed');
assert.equal(sessionResult.toolResults.length, 1);
assert.equal(sessionResult.toolResults[0]?.command.capabilityId, 'desktop-observation');

console.log('agent desktop observation tools v2 smoke ok');
