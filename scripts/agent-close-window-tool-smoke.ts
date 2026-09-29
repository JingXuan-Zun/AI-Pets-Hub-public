import assert from 'node:assert/strict';
import {
  AGENT_TOOL_INPUT_PARAM_SPECS,
  buildAgentPermissionRoute,
  getAgentToolLifecycleMetadata,
  isAgentToolAvailableInMode,
  listAgentToolNames,
  listRegisteredAgentToolNamesOutsideModePolicies,
  type AgentChatCommand,
  type AgentToolCallName,
} from '../src/agent/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const toolName = 'close_window' satisfies AgentToolCallName;

function createCloseWindowCommand(input: Record<string, unknown> = {}): AgentChatCommand {
  return {
    capabilityId: 'app-launcher',
    instruction: 'close a matching window',
    kind: 'tool-call',
    sourceText: '/agent close notepad',
    toolCall: {
      goal: 'close a matching window',
      input,
      name: toolName,
    },
  };
}

const registeredTools = new Set(listAgentToolNames());
assert.equal(registeredTools.has(toolName), true, 'close_window should be registered');
assert.equal(isAgentToolAvailableInMode(toolName, 'agent'), true, 'close_window should be available in Agent mode');
assert.deepEqual(listRegisteredAgentToolNamesOutsideModePolicies(), []);

const lifecycle = getAgentToolLifecycleMetadata(toolName);
assert.equal(lifecycle.mutates.includes('window-state'), true);
assert.equal(lifecycle.observes.includes('window-list'), true);
assert.equal(lifecycle.verifies.includes('window-close-request'), true);

const schema = AGENT_TOOL_INPUT_PARAM_SPECS[toolName];
assert.equal(schema.some((spec) => spec.key === 'query'), true);
assert.equal(schema.some((spec) => spec.key === 'pid'), true);
assert.equal(schema.some((spec) => spec.key === 'hwnd'), true);

const route = buildAgentPermissionRoute(createCloseWindowCommand({ query: 'notepad' }));
assert.equal(route.status, 'needs-approval');
assert.equal(route.routeMode, 'agent');
assert.equal(route.maxRisk, 'launch');
assert.equal(route.requiresApproval, true);
assert.equal(route.plan?.steps.some((step) => step.action.kind === 'close-window'), true);

const {
  appLauncherSource,
  ipcSource,
  preloadSource,
  bridgeSource,
  runtimeFacadeSource,
  viteEnvSource,
  registrySource,
  orchestratorSource,
  runtimeSource,
  windowToolsSource,
  sessionSource,
} = readProjectSources({
  appLauncherSource: 'electron/appLauncherService.cjs',
  ipcSource: 'electron/ipcHandlers.cjs',
  preloadSource: 'electron/preload.cjs',
  bridgeSource: 'src/desktopShellBridge.ts',
  runtimeFacadeSource: 'src/desktopShellRuntime.ts',
  viteEnvSource: 'src/vite-env.d.ts',
  registrySource: 'src/agent/agentToolRegistry.ts',
  orchestratorSource: 'src/agent/agentOrchestrator.ts',
  runtimeSource: 'src/agent/agentRuntimeExecutor.ts',
  windowToolsSource: 'src/agent/agentRuntimeWindowTools.ts',
  sessionSource: 'src/agent/agentProductionSessionImplementation.ts',
});

assert.match(appLauncherSource, /function closeWindow/u);
assert.match(appLauncherSource, /WM_CLOSE/u);
assert.match(ipcSource, /desktop-pet:close-window/u);
assert.match(preloadSource, /closeWindow: \(request\)/u);
assert.match(bridgeSource, /closeWindow:/u);
assert.match(runtimeFacadeSource, /closeWindow: desktopPetShellBridge\.closeWindow/u);
assert.match(viteEnvSource, /closeWindow\?:/u);
assert.match(registrySource, /name: 'close_window'/u);
assert.match(orchestratorSource, /case 'close_window'/u);
assert.match(runtimeSource, /close_window: \(\{ toolCall \}\) => executeCloseWindow\(toolCall\)/u);
assert.match(windowToolsSource, /export async function executeCloseWindow/u);
assert.match(sessionSource, /focus\/open\/close\/control\/move intent/u);

console.log('agent close window tool smoke ok');
