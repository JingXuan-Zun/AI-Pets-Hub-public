import assert from 'node:assert/strict';
import {
  AGENT_TOOL_INPUT_PARAM_SPECS,
  buildAgentPermissionRoute,
  getAgentToolLifecycleMetadata,
  isAgentToolAvailableInMode,
  listAgentToolNames,
  listRegisteredAgentToolNamesOutsideModePolicies,
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentToolCallName,
} from '../src/agent/legacy/index.ts';
import { inferAgentRuntimeDesktopSequencePostActionState } from '../src/agent/agentRuntimeDesktopSequenceTools.ts';
import { type PetConfig } from '../src/types.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const toolName = 'execute_desktop_sequence' satisfies AgentToolCallName;

function createToolCommand(input: Record<string, unknown>): AgentChatCommand {
  return {
    capabilityId: 'app-launcher',
    instruction: 'test execute_desktop_sequence',
    kind: 'tool-call',
    sourceText: '/agent test execute_desktop_sequence',
    toolCall: {
      goal: 'test execute_desktop_sequence',
      input,
      name: toolName,
    },
  };
}

const stepsJson = JSON.stringify([
  {
    args: { action: 'open_resource', resourceType: 'url', target: 'https://example.com' },
    reason: 'Open requested site.',
    tool: 'execute_desktop_action',
  },
  {
    args: { action: 'control_window', fallbackToActiveWindow: true, snap: 'center', targetDisplay: 'secondary' },
    reason: 'Place resulting active window.',
    tool: 'execute_desktop_action',
  },
]);

const registeredTools = new Set(listAgentToolNames());
assert.equal(registeredTools.has(toolName), true);
assert.equal(isAgentToolAvailableInMode(toolName, 'agent'), true);
assert.deepEqual(listRegisteredAgentToolNamesOutsideModePolicies(), []);

const lifecycle = getAgentToolLifecycleMetadata(toolName);
assert.equal(lifecycle.observes.includes('step-result-evidence'), true);
assert.equal(lifecycle.mutates.includes('window-bounds'), true);
assert.equal(lifecycle.verifies.includes('desktop-sequence-result'), true);

const schema = AGENT_TOOL_INPUT_PARAM_SPECS[toolName];
assert.equal(schema.find((spec) => spec.key === 'stepsJson')?.required, true);
assert.equal(schema.some((spec) => spec.key === 'postVerifyVisualQuery'), true);

const route = buildAgentPermissionRoute(createToolCommand({ stepsJson }));
assert.equal(route.status, 'needs-approval');
assert.equal(route.maxRisk, 'launch');
assert.equal(route.requiresApproval, true);
assert.equal(route.plan?.steps[0]?.action.kind, 'execute-desktop-sequence');

const { registrySource, runtimeSource, sequenceSource, sessionSource } = readProjectSources({
  registrySource: 'src/agent/agentToolRegistry.ts',
  runtimeSource: 'src/agent/agentRuntimeExecutor.ts',
  sequenceSource: 'src/agent/agentRuntimeDesktopSequenceTools.ts',
  sessionSource: 'src/agent/agentProductionSessionImplementation.ts',
});

assert.match(registrySource, /name: 'execute_desktop_sequence'/u);
assert.match(runtimeSource, /execute_desktop_sequence: \(\{ runtime, toolCall \}\) => executeDesktopSequence/u);
assert.match(sequenceSource, /function executeDesktopSequence/u);
assert.match(sequenceSource, /postVerifyVisualQuery/u);
assert.match(sequenceSource, /postActionRecoveryStrategy/u);
assert.match(sessionSource, /execute_desktop_sequence/u);
assert.doesNotMatch(registrySource, /open_or_focus_then_control_window/u);

assert.equal(inferAgentRuntimeDesktopSequencePostActionState({
  ok: true,
  stateSummary: { structuredEvidence: { postActionState: 'loading' } },
}), 'loading');
assert.equal(inferAgentRuntimeDesktopSequencePostActionState({
  ok: true,
  responseText: 'Start action was triggered; waiting for target process/window to appear.',
}), 'waiting_target');
assert.equal(inferAgentRuntimeDesktopSequencePostActionState({
  ok: true,
  responseText: 'The same screen is unchanged after clicking.',
}), 'unchanged');
assert.equal(inferAgentRuntimeDesktopSequencePostActionState({
  ok: true,
  responseText: 'A permission modal blocked continuing the launch.',
}), 'blocked');

const settings = {} as PetConfig['settings'];
let modelCallCount = 0;
const result = await runAgentProductionSession({
  modelCaller: async ({ systemInstruction }) => {
    modelCallCount += 1;
    assert.match(systemInstruction, /execute_desktop_sequence/u);
    return JSON.stringify({
      action: 'tool_call',
      args: { stepsJson },
      reason: 'Known multi-step desktop action can run as one approved sequence.',
      tool: toolName,
      understanding: {
        neededCapability: 'desktop primitive sequence',
        successCriteria: 'steps are approved before mutation',
        userNeed: 'open a site and place the resulting window',
      },
    });
  },
  settings,
  sourceText: '/agent open example.com and put it on the secondary display',
  toolExecutor: async () => {
    throw new Error('execute_desktop_sequence should pause for approval before running');
  },
  userGoal: 'open example.com and put it on the secondary display',
});

assert.equal(modelCallCount, 1);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, toolName);
assert.equal(result.pendingApproval?.command.toolCall?.input.stepsJson, stepsJson);

console.log('agent execute desktop sequence tool smoke ok');
