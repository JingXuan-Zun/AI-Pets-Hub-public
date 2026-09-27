import assert from 'node:assert/strict';
import {
  prepareAgentToolInput,
  type AgentChatCommand,
} from '../src/agent/index.ts';
import {
  createAgentCorePlan,
  executeAgentCoreRunLoop,
} from '../src/agent/agentLegacy.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  coreSource,
  runtimeSource,
  runtimePreparationSource,
  schemaSource,
} = readProjectSources({
  coreSource: 'src/agent/agentCore.ts',
  runtimeSource: 'src/agent/agentRuntimeExecutor.ts',
  runtimePreparationSource: 'src/agent/agentRuntimeToolPreparation.ts',
  schemaSource: 'src/agent/agentToolInputSchema.ts',
});

assert.match(
  schemaSource,
  /export const AGENT_TOOL_INPUT_PARAM_SPECS/u,
  'tool input schema should be shared outside the runtime executor',
);

assert.match(
  runtimeSource,
  /prepareAgentRuntimeToolCall/u,
  'runtime executor should prepare tool calls through the shared preparation module',
);

assert.match(
  runtimePreparationSource,
  /import \{ prepareAgentToolInput \} from '\.\/agentToolInputSchema';/u,
  'runtime preparation should use the shared tool input schema',
);

assert.match(
  coreSource,
  /function createAgentCoreRecoveryToolInput\(/u,
  'Agent Core recovery should derive schema-aware recovery input',
);

assert.match(
  coreSource,
  /prepareAgentToolInput\(toolName, filteredInput\)/u,
  'Agent Core recovery should validate derived input against the shared schema',
);

const preparedInspectInput = prepareAgentToolInput('inspect_local_project', {
  folderPath: ' D:\\Projects\\Pet ',
  question: 'how does this run?',
});
assert.equal(preparedInspectInput.ok, true);
if (preparedInspectInput.ok) {
  assert.equal(preparedInspectInput.input.path, 'D:\\Projects\\Pet');
}

const missingInspectInput = prepareAgentToolInput('inspect_local_project', {});
assert.equal(missingInspectInput.ok, false);

const projectCommand: AgentChatCommand = {
  capabilityId: 'local-project-inspector',
  instruction: 'inspect project',
  kind: 'tool-call',
  sourceText: '/agent inspect D:\\Projects\\Pet',
  toolCall: {
    goal: 'inspect project',
    input: {
      path: 'D:\\Projects\\Pet',
      question: 'how does this run?',
    },
    name: 'inspect_local_project',
  },
};

const executedProjectTools: Array<{ input: Record<string, unknown>; name: string }> = [];
const projectRecoveryResult = await executeAgentCoreRunLoop({
  approved: true,
  command: projectCommand,
  corePlan: createAgentCorePlan(projectCommand),
  onAgentChatCommand: async (currentCommand) => {
    const toolName = currentCommand.toolCall?.name ?? currentCommand.kind;
    executedProjectTools.push({
      input: currentCommand.toolCall?.input ?? {},
      name: toolName,
    });

    if (executedProjectTools.length === 1) {
      return {
        ok: false,
        responseText: 'Inspection did not return run candidate evidence.',
        stateSummary: {
          missingEvidence: ['missing:project-run-candidates'],
          recommendedRecovery: ['tool:get_display_info', 'tool:inspect_local_project'],
        },
      };
    }

    return {
      observations: ['display fallback observed'],
      ok: true,
      responseText: 'display fallback recovered',
      verification: 'display-list verified',
    };
  },
  onAgentCoreRecovery: async () => null,
});

assert.equal(projectRecoveryResult.rounds[0]?.status, 'auto-continued');
assert.deepEqual(executedProjectTools.map((tool) => tool.name), [
  'inspect_local_project',
  'get_display_info',
]);
assert.deepEqual(executedProjectTools[1]?.input, {});

const displayToProjectCommand: AgentChatCommand = {
  capabilityId: 'system-inspector',
  instruction: 'read display before inspecting project',
  kind: 'tool-call',
  plannerSteps: [
    {
      args: {},
      index: 1,
      phase: 'observe',
      reason: 'read display first',
      tool: 'get_display_info',
    },
    {
      args: {
        path: 'D:\\Projects\\Pet',
        question: 'how does this run?',
      },
      index: 2,
      phase: 'recover',
      reason: 'inspect project if display evidence is not enough',
      tool: 'inspect_local_project',
    },
  ],
  sourceText: '/agent inspect D:\\Projects\\Pet after display check',
  toolCall: {
    goal: 'read display before inspecting project',
    input: {},
    name: 'get_display_info',
  },
};

const executedDisplayToProjectTools: Array<{ input: Record<string, unknown>; name: string }> = [];
const displayToProjectResult = await executeAgentCoreRunLoop({
  approved: true,
  command: displayToProjectCommand,
  corePlan: createAgentCorePlan(displayToProjectCommand),
  onAgentChatCommand: async (currentCommand) => {
    const toolName = currentCommand.toolCall?.name ?? currentCommand.kind;
    executedDisplayToProjectTools.push({
      input: currentCommand.toolCall?.input ?? {},
      name: toolName,
    });

    if (toolName === 'get_display_info') {
      return {
        ok: false,
        responseText: 'Display did not answer the local project question.',
        stateSummary: {
          missingEvidence: ['missing:project-run-candidates'],
          recommendedRecovery: ['tool:inspect_local_project'],
        },
      };
    }

    return {
      observations: ['Detected project type: node'],
      ok: true,
      responseText: 'project recovered',
      verification: 'project-run-candidates verified',
    };
  },
  onAgentCoreRecovery: async () => null,
});

assert.equal(displayToProjectResult.rounds[0]?.status, 'auto-continued');
assert.deepEqual(executedDisplayToProjectTools.map((tool) => tool.name), [
  'get_display_info',
  'inspect_local_project',
]);
assert.equal(executedDisplayToProjectTools[1]?.input.path, 'D:\\Projects\\Pet');
assert.equal(executedDisplayToProjectTools[1]?.input.question, 'how does this run?');

const launchRecoveryCommand: AgentChatCommand = {
  capabilityId: 'system-inspector',
  instruction: 'read display before opening browser',
  kind: 'tool-call',
  plannerSteps: [
    {
      args: {
        query: 'browser',
      },
      index: 1,
      phase: 'recover',
      reason: 'launch app only after permission',
      tool: 'launch_local_app',
    },
  ],
  sourceText: '/agent open browser after display check',
  toolCall: {
    goal: 'read display before opening browser',
    input: {},
    name: 'get_display_info',
  },
};

const executedLaunchRecoveryTools: string[] = [];
const launchRecoveryResult = await executeAgentCoreRunLoop({
  approved: true,
  command: launchRecoveryCommand,
  corePlan: createAgentCorePlan(launchRecoveryCommand),
  onAgentChatCommand: async (currentCommand) => {
    const toolName = currentCommand.toolCall?.name ?? currentCommand.kind;
    executedLaunchRecoveryTools.push(toolName);

    return {
      ok: false,
      responseText: 'Display did not open the app.',
      stateSummary: {
        missingEvidence: ['missing:focused-window'],
        recommendedRecovery: ['tool:launch_local_app'],
      },
    };
  },
  onAgentCoreRecovery: async () => null,
});

assert.deepEqual(executedLaunchRecoveryTools, ['get_display_info']);
assert.equal(launchRecoveryResult.pause?.action.command.toolCall?.name, 'launch_local_app');
assert.equal(launchRecoveryResult.pause?.action.command.toolCall?.input.query, 'browser');

console.log('agent recovery schema-aware v1.10 smoke ok');
