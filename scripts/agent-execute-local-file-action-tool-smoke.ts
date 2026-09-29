import assert from 'node:assert/strict';
import path from 'node:path';
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
import { readProjectSources, projectRoot } from './smokeTestHarness.ts';

const toolName = 'execute_local_file_action' satisfies AgentToolCallName;

function createToolCommand(input: Record<string, unknown>): AgentChatCommand {
  return {
    capabilityId: 'local-file-system',
    instruction: 'test execute_local_file_action',
    kind: 'tool-call',
    sourceText: '/agent test execute_local_file_action',
    toolCall: {
      goal: 'test execute_local_file_action',
      input,
      name: toolName,
    },
  };
}

const registeredTools = new Set(listAgentToolNames());
assert.equal(registeredTools.has(toolName), true);
assert.equal(isAgentToolAvailableInMode(toolName, 'agent'), true);
assert.equal(isAgentToolAvailableInMode(toolName, 'developer'), true);
assert.deepEqual(listRegisteredAgentToolNamesOutsideModePolicies(), []);

const lifecycle = getAgentToolLifecycleMetadata(toolName);
assert.equal(lifecycle.mutates.length, 0);
assert.equal(lifecycle.observes.includes('local-path'), true);
assert.equal(lifecycle.observes.includes('directory-entries'), true);
assert.equal(lifecycle.verifies.includes('local-file-action-result'), true);

const schema = AGENT_TOOL_INPUT_PARAM_SPECS[toolName];
const actionSpec = schema.find((spec) => spec.key === 'action');
assert.equal(actionSpec?.required, true);
assert.equal(actionSpec?.enumValues?.includes('get_path_info'), true);
assert.equal(actionSpec?.enumValues?.includes('list_dir'), true);
assert.equal(actionSpec?.enumValues?.includes('find_file'), true);
assert.equal(actionSpec?.enumValues?.includes('read_file'), true);

for (const input of [
  { action: 'get_path_info', path: projectRoot },
  { action: 'list_dir', path: projectRoot },
  { action: 'find_file', path: projectRoot, query: 'package' },
  { action: 'read_file', path: path.join(projectRoot, 'package.json') },
]) {
  const route = buildAgentPermissionRoute(createToolCommand(input));
  assert.equal(route.status, 'silent');
  assert.equal(route.maxRisk, 'read');
  assert.equal(route.requiresApproval, false);
  assert.equal(isAgentPermissionRouteSilentReadOnly(route), true);
}

const {
  registrySource,
  orchestratorSource,
  runtimeSource,
  localFileToolsSource,
  sessionSource,
  coreSource,
} = readProjectSources({
  registrySource: 'src/agent/agentToolRegistry.ts',
  orchestratorSource: 'src/agent/agentOrchestrator.ts',
  runtimeSource: 'src/agent/agentRuntimeExecutor.ts',
  localFileToolsSource: 'src/agent/agentRuntimeLocalFileTools.ts',
  sessionSource: 'src/agent/agentProductionSessionImplementation.ts',
  coreSource: 'src/agent/agentCore.ts',
});

assert.match(registrySource, /name: 'execute_local_file_action'/u);
assert.match(orchestratorSource, /buildExecuteLocalFileActionPlan/u);
assert.match(runtimeSource, /execute_local_file_action: \(\{ toolCall \}\) => executeLocalFileAction\(toolCall\)/u);
assert.match(localFileToolsSource, /export async function executeLocalFileAction/u);
assert.match(localFileToolsSource, /Local file action:/u);
assert.match(sessionSource, /execute_local_file_action/u);
assert.match(coreSource, /toolName === 'execute_local_file_action'/u);

const settings = {} as PetConfig['settings'];
let modelCallCount = 0;
const sessionResult = await runAgentProductionSession({
  maxSteps: 3,
  modelCaller: async ({ systemInstruction, userInput }) => {
    modelCallCount += 1;
    assert.match(systemInstruction, /execute_local_file_action/u);
    assert.match(systemInstruction, /read-only/u);

    if (modelCallCount === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: { action: 'list_dir', path: projectRoot },
        reason: 'Need to observe the directory entries before deciding the next file action.',
        tool: toolName,
        understanding: {
          neededCapability: 'read-only local filesystem observation',
          successCriteria: 'directory entries are observed',
          userNeed: 'look at a local folder',
        },
      });
    }

    assert.match(userInput, /tool=execute_local_file_action/u);
    assert.match(userInput, /package.json/u);
    return JSON.stringify({
      action: 'final_answer',
      message: 'I can see package.json in this folder.',
      understanding: {
        successCriteria: 'tool result was observed',
        userNeed: 'look at a local folder',
      },
    });
  },
  settings,
  sourceText: `/agent look at ${projectRoot}`,
  toolExecutor: async (command) => {
    assert.equal(command.capabilityId, 'local-file-system');
    assert.equal(command.toolCall?.name, toolName);
    assert.equal(command.toolCall?.input.action, 'list_dir');
    return {
      observations: ['Local file action: list_directory', '1. package.json file'],
      ok: true,
      responseText: '1. package.json',
      verification: 'listed directory entries',
    };
  },
  userGoal: `look at ${projectRoot}`,
});

assert.equal(sessionResult.status, 'completed');
assert.equal(sessionResult.toolResults.length, 1);
assert.equal(sessionResult.toolResults[0]?.command.toolCall?.name, toolName);

console.log('agent execute local file action tool smoke ok');
