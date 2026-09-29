import assert from 'node:assert/strict';
import {
  AGENT_TOOL_INPUT_PARAM_SPECS,
  buildAgentPermissionRoute,
  executeAgentChatCommand,
  getAgentToolLifecycleMetadata,
  isAgentPermissionRouteSilentReadOnly,
  isAgentToolAvailableInMode,
  listAgentToolNames,
  listRegisteredAgentToolNamesOutsideModePolicies,
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentRuntimeExecutorContext,
  type AgentToolCallName,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const toolName = 'execute_memory_action' satisfies AgentToolCallName;

function createToolCommand(input: Record<string, unknown>): AgentChatCommand {
  return {
    capabilityId: 'agent-memory',
    instruction: 'test execute_memory_action',
    kind: 'tool-call',
    sourceText: '/agent test execute_memory_action',
    toolCall: {
      goal: 'test execute_memory_action',
      input,
      name: toolName,
    },
  };
}

let config = {
  settings: {
    globalKnowledgeBase: [
      'Agent memory [browser]: default = Chrome',
      'Manual note: user likes concise replies',
    ].join('\n'),
  },
} as PetConfig;

const runtimeContext = {
  configRef: { current: config },
  desktopOrganizationRef: { current: null },
  lastDesktopOrganizationPlanRef: { current: null },
  lastLocalProjectInspectionRef: { current: null },
  onUpdateConfig: (nextConfig: PetConfig) => {
    config = nextConfig;
    runtimeContext.configRef.current = nextConfig;
  },
  startDesktopIconPlacementRef: { current: null },
} satisfies AgentRuntimeExecutorContext;

const registeredTools = new Set(listAgentToolNames());
assert.equal(registeredTools.has(toolName), true);
assert.equal(isAgentToolAvailableInMode(toolName, 'agent'), true);
assert.equal(isAgentToolAvailableInMode(toolName, 'developer'), false);
assert.deepEqual(listRegisteredAgentToolNamesOutsideModePolicies(), []);

const lifecycle = getAgentToolLifecycleMetadata(toolName);
assert.equal(lifecycle.observes.includes('agent-global-memory'), true);
assert.equal(lifecycle.mutates.includes('agent-global-memory'), true);
assert.equal(lifecycle.verifies.includes('agent-memory-action-result'), true);

const schema = AGENT_TOOL_INPUT_PARAM_SPECS[toolName];
const actionSpec = schema.find((spec) => spec.key === 'action');
for (const action of ['recall', 'remember', 'forget']) {
  assert.equal(actionSpec?.enumValues?.includes(action), true);
}

const recallRoute = buildAgentPermissionRoute(createToolCommand({ action: 'recall', query: 'browser' }));
assert.equal(recallRoute.status, 'silent');
assert.equal(recallRoute.maxRisk, 'read');
assert.equal(isAgentPermissionRouteSilentReadOnly(recallRoute), true);

const rememberRoute = buildAgentPermissionRoute(createToolCommand({
  action: 'remember',
  category: 'browser',
  key: 'default',
  value: 'Edge',
}));
assert.equal(rememberRoute.requiresApproval, true);
assert.equal(rememberRoute.maxRisk, 'reversible-write');

const recallResult = await executeAgentChatCommand(createToolCommand({ action: 'recall', query: 'Chrome' }), runtimeContext);
assert.equal(recallResult.ok, true);
assert.match(recallResult.responseText, /Chrome/u);

const rememberResult = await executeAgentChatCommand(createToolCommand({
  action: 'remember',
  category: 'browser',
  key: 'default',
  value: 'Edge',
}), runtimeContext);
assert.equal(rememberResult.ok, true);
assert.match(config.settings.globalKnowledgeBase, /Agent memory \[browser\]: default = Edge/u);
assert.doesNotMatch(config.settings.globalKnowledgeBase, /Agent memory \[browser\]: default = Chrome/u);

const { registrySource, runtimeSource, memoryToolsSource, sessionSource } = readProjectSources({
  registrySource: 'src/agent/agentToolRegistry.ts',
  runtimeSource: 'src/agent/agentRuntimeExecutor.ts',
  memoryToolsSource: 'src/agent/agentRuntimeMemoryTools.ts',
  sessionSource: 'src/agent/agentProductionSessionImplementation.ts',
});

assert.match(registrySource, /name: 'execute_memory_action'/u);
assert.match(runtimeSource, /execute_memory_action: \(\{ runtime, toolCall \}\) => executeMemoryAction\(runtime, toolCall\)/u);
assert.match(memoryToolsSource, /export async function executeMemoryAction/u);
assert.match(memoryToolsSource, /Memory action: recall/u);
assert.match(sessionSource, /execute_memory_action/u);

const settings = {} as PetConfig['settings'];
let modelCallCount = 0;
const sessionResult = await runAgentProductionSession({
  maxSteps: 3,
  modelCaller: async ({ systemInstruction, userInput }) => {
    modelCallCount += 1;
    assert.match(systemInstruction, /execute_memory_action/u);

    if (modelCallCount === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: { action: 'recall', query: 'browser' },
        reason: 'Recall stored browser preferences before deciding.',
        tool: toolName,
      });
    }

    assert.match(userInput, /tool=execute_memory_action/u);
    assert.match(userInput, /Edge/u);
    return JSON.stringify({
      action: 'final_answer',
      message: 'I found your remembered browser preference: Edge.',
    });
  },
  settings,
  sourceText: '/agent recall saved browser preference',
  toolExecutor: async (command) => {
    assert.equal(command.capabilityId, 'agent-memory');
    assert.equal(command.toolCall?.name, toolName);
    assert.equal(command.toolCall?.input.action, 'recall');
    return {
      observations: ['Memory action: recall', 'Agent memory [browser]: default = Edge'],
      ok: true,
      responseText: 'Agent memory [browser]: default = Edge',
      verification: 'memory recalled',
    };
  },
  userGoal: 'recall saved browser preference',
});

assert.equal(sessionResult.status, 'completed');
assert.equal(sessionResult.toolResults.length, 1);
assert.equal(sessionResult.toolResults[0]?.command.toolCall?.name, toolName);

console.log('agent execute memory action tool smoke ok');
