import assert from 'node:assert/strict';
import { type AgentChatCommand } from '../src/agent/index.ts';
import {
  AGENT_CORE_REPLAN_MAX_DEPTH,
  createAgentCorePlan,
  executeAgentCoreRunLoop,
} from '../src/agent/agentLegacy.ts';
import { readProjectFile } from './smokeTestHarness.ts';

const coreSource = readProjectFile('src/agent/agentCore.ts');
const plannerSource = readProjectFile('src/agent/agentPlanner.ts');
const controllerSource = readProjectFile('src/components/chat/agentRunController.ts');

assert.match(
  coreSource,
  /export const AGENT_CORE_REPLAN_MAX_DEPTH = 2/u,
  'Agent Core should cap observation-driven replanning depth',
);

assert.match(
  coreSource,
  /export interface AgentCoreReplanRequest[\s\S]*observationSummary[\s\S]*remainingPlannerSteps/u,
  'Agent Core should expose observation summaries and remaining steps for replanning',
);

assert.match(
  coreSource,
  /onAgentCoreReplan[\s\S]*createAgentCoreObservationSummary[\s\S]*createAgentCorePlan\(replanDecision\.command\)/u,
  'Agent Core should request replanning after observation and route the returned command through Core planning',
);

assert.match(
  plannerSource,
  /REPLAN_SYSTEM_INSTRUCTION[\s\S]*Use the observation summary as ground truth[\s\S]*resolveAgentReplanCommandWithPlanner/u,
  'Agent planner should provide a dedicated observation-driven replan entrypoint',
);

assert.match(
  controllerSource,
  /runAgentSessionV2\(/u,
  'Chat controller should route active Agent work through AgentSessionV2 instead of the old Core replan adapter',
);

assert.doesNotMatch(
  controllerSource,
  /resolveAgentReplanCommandWithPlanner|onAgentCoreReplan/u,
  'Chat controller should not keep the old Core replan adapter',
);

function createObservationThenLaunchCommand(): AgentChatCommand {
  return {
    capabilityId: 'app-launcher',
    instruction: 'observe then launch by replanning',
    kind: 'tool-call',
    plannerSteps: [
      {
        args: {},
        index: 1,
        phase: 'observe',
        reason: 'observe displays first',
        tool: 'get_display_info',
      },
      {
        args: {
          query: 'browser',
        },
        index: 2,
        phase: 'execute',
        reason: 'launch after observing',
        tool: 'launch_local_app',
      },
    ],
    sourceText: '/agent observe then launch by replanning',
    toolCall: {
      goal: 'observe then launch by replanning',
      input: {
        query: 'browser',
      },
      name: 'launch_local_app',
    },
  };
}

const observationThenLaunchCommand = createObservationThenLaunchCommand();
const observationThenLaunchPlan = createAgentCorePlan(observationThenLaunchCommand);
const calledTools: string[] = [];
let replanRequestCount = 0;

const observationThenLaunchResult = await executeAgentCoreRunLoop({
  command: observationThenLaunchCommand,
  corePlan: observationThenLaunchPlan,
  onAgentChatCommand: async (command) => {
    const toolName = command.toolCall?.name ?? command.kind;
    calledTools.push(toolName);
    return {
      observations: [`called ${toolName}`],
      ok: true,
      responseText: `screen observation for ${toolName}; next approval-required launch still needs planning`,
      assessment: {
        evidence: [`called ${toolName}`],
        nextStep: 'launch browser after observing display',
        status: 'can-continue',
        summary: 'observation completed; replan required before launch',
      },
    };
  },
  onAgentCoreReplan: async (request) => {
    replanRequestCount += 1;
    assert.equal(request.currentCommand.toolCall?.name, 'get_display_info');
    assert.equal(request.remainingPlannerSteps.length, 1);
    assert.match(request.observationSummary, /tool=get_display_info/u);
    return {
      command: {
        capabilityId: 'app-launcher',
        instruction: 'launch browser after observation',
        kind: 'tool-call',
        sourceText: request.originalCommand.sourceText,
        toolCall: {
          goal: 'launch browser after observation',
          input: {
            query: 'browser',
          },
          name: 'launch_local_app',
        },
      },
      reason: 'Launch still needs approval after observing the desktop.',
    };
  },
});

assert.deepEqual(calledTools, ['get_display_info']);
assert.equal(replanRequestCount, 1);
assert.equal(observationThenLaunchResult.pause?.action.command.toolCall?.name, 'launch_local_app');
assert.equal(observationThenLaunchResult.rounds.length, 1);
assert.equal(observationThenLaunchResult.rounds[0]?.status, 'awaiting-approval');

const observationThenReadCommand = {
  ...observationThenLaunchCommand,
  capabilityId: 'system-inspector' as const,
  sourceText: '/agent observe then read system by replanning',
};
const readCalledTools: string[] = [];
let readReplanRequestCount = 0;

const observationThenReadResult = await executeAgentCoreRunLoop({
  command: observationThenReadCommand,
  corePlan: createAgentCorePlan(observationThenReadCommand),
  onAgentChatCommand: async (command) => {
    const toolName = command.toolCall?.name ?? command.kind;
    readCalledTools.push(toolName);
    return {
      observations: [`called ${toolName}`],
      ok: true,
      responseText: `ok ${toolName}`,
      assessment: toolName === 'get_display_info'
        ? {
            evidence: [`called ${toolName}`],
            nextStep: 'read system info after observing display',
            status: 'can-continue',
            summary: 'observation completed; replan can continue read-only',
          }
        : {
            evidence: [`called ${toolName}`],
            status: 'completed',
            summary: 'replanned read-only command completed',
          },
      verification: toolName === 'get_system_info' ? `verified ${toolName}` : undefined,
    };
  },
  onAgentCoreReplan: async (request) => {
    readReplanRequestCount += 1;
    return {
      command: {
        capabilityId: 'system-inspector',
        instruction: 'read system info after observing display',
        kind: 'tool-call',
        sourceText: request.originalCommand.sourceText,
        toolCall: {
          goal: 'read system info after observing display',
          input: {
            includeDisplays: false,
          },
          name: 'get_system_info',
        },
      },
      reason: 'Read-only replan can continue automatically.',
    };
  },
});

assert.deepEqual(readCalledTools, ['get_display_info', 'get_system_info']);
assert.equal(readReplanRequestCount, 1);
assert.equal(observationThenReadResult.pause, null);
assert.equal(observationThenReadResult.finalCommand.toolCall?.name, 'get_system_info');
assert.equal(observationThenReadResult.rounds.length, 2);
assert.equal(AGENT_CORE_REPLAN_MAX_DEPTH, 2);

console.log('agent core v1.3 replan smoke ok');
