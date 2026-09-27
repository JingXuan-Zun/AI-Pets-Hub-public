import assert from 'node:assert/strict';
import { type AgentChatCommand } from '../src/agent/index.ts';
import {
  AGENT_CORE_RUN_LOOP_MAX_ROUNDS,
  createAgentCorePlan,
  executeAgentCoreRunLoop,
} from '../src/agent/agentLegacy.ts';
import { readProjectFile } from './smokeTestHarness.ts';

const coreSource = readProjectFile('src/agent/agentCore.ts');
const plannerSource = readProjectFile('src/agent/agentPlanner.ts');
const controllerSource = readProjectFile('src/components/chat/agentRunController.ts');

assert.match(
  coreSource,
  /export interface AgentCoreRecoveryRequest[\s\S]*resultSummary[\s\S]*roundIndex/u,
  'Agent Core should expose result summaries to recovery planning',
);

assert.match(
  coreSource,
  /onAgentCoreRecovery[\s\S]*shouldRequestAgentCoreRecovery[\s\S]*createAgentCoreResultSummary/u,
  'Agent Core should request recovery after failed or unverified results',
);

assert.match(
  plannerSource,
  /RECOVERY_SYSTEM_INSTRUCTION[\s\S]*failed, unverified, or needs user input[\s\S]*resolveAgentRecoveryCommandWithPlanner/u,
  'Agent planner should provide a dedicated result recovery entrypoint',
);

assert.match(
  controllerSource,
  /runAgentSessionV2\(/u,
  'Chat controller should route active Agent work through AgentSessionV2 instead of the old Core recovery adapter',
);

assert.doesNotMatch(
  controllerSource,
  /resolveAgentRecoveryCommandWithPlanner|onAgentCoreRecovery/u,
  'Chat controller should not keep the old Core recovery adapter',
);

const initialCommand: AgentChatCommand = {
  capabilityId: 'app-launcher',
  instruction: 'open browser and verify result',
  kind: 'tool-call',
  sourceText: '/agent open browser and verify result',
  toolCall: {
    goal: 'open browser and verify result',
    input: {
      query: 'browser',
    },
    name: 'launch_local_app',
  },
};

const readOnlyRecoveryTools: string[] = [];
let readOnlyRecoveryRequests = 0;

const readOnlyRecoveryResult = await executeAgentCoreRunLoop({
  approved: true,
  command: initialCommand,
  corePlan: createAgentCorePlan(initialCommand),
  onAgentChatCommand: async (command) => {
    const toolName = command.toolCall?.name ?? command.kind;
    readOnlyRecoveryTools.push(toolName);
    if (toolName === 'launch_local_app') {
      return {
        ok: true,
        responseText: 'launch accepted but focus not verified',
        assessment: {
          evidence: ['launch command returned without focus evidence'],
          nextStep: 'read displays to recover verification context',
          status: 'unverified',
          summary: 'launch accepted but focus was not verified',
        },
      };
    }

    return {
      observations: ['display info read after unverified launch'],
      ok: true,
      responseText: 'display info ok',
      assessment: {
        evidence: ['display info read after unverified launch'],
        status: 'completed',
        summary: 'display info verified recovery context',
      },
      verification: 'display info verified',
    };
  },
  onAgentCoreRecovery: async (request) => {
    readOnlyRecoveryRequests += 1;
    assert.equal(request.currentCommand.toolCall?.name, 'launch_local_app');
    assert.match(request.resultSummary, /status=unverified/u);
    return {
      command: {
        capabilityId: 'system-inspector',
        instruction: 'read displays to recover verification context',
        kind: 'tool-call',
        sourceText: request.originalCommand.sourceText,
        toolCall: {
          goal: 'read displays to recover verification context',
          input: {},
          name: 'get_display_info',
        },
      },
      reason: 'Read-only verification can continue automatically.',
    };
  },
});

assert.deepEqual(readOnlyRecoveryTools, ['launch_local_app', 'get_display_info']);
assert.equal(readOnlyRecoveryRequests, 1);
assert.equal(readOnlyRecoveryResult.pause, null);
assert.equal(readOnlyRecoveryResult.finalCommand.toolCall?.name, 'get_display_info');
assert.equal(readOnlyRecoveryResult.rounds[0]?.status, 'auto-continued');
assert.equal(readOnlyRecoveryResult.rounds[1]?.status, 'completed');

let riskyRecoveryRequests = 0;

const riskyRecoveryResult = await executeAgentCoreRunLoop({
  approved: true,
  command: initialCommand,
  corePlan: createAgentCorePlan(initialCommand),
  onAgentChatCommand: async () => ({
    ok: true,
    responseText: 'launch accepted but focus not verified',
    assessment: {
      evidence: ['launch command returned without focus evidence'],
      nextStep: 'retry launch requires approval',
      status: 'unverified',
      summary: 'launch accepted but focus was not verified',
    },
  }),
  onAgentCoreRecovery: async (request) => {
    riskyRecoveryRequests += 1;
    return {
      command: {
        capabilityId: 'app-launcher',
        instruction: 'try launching again',
        kind: 'tool-call',
        sourceText: request.originalCommand.sourceText,
        toolCall: {
          goal: 'try launching again',
          input: {
            query: 'browser',
          },
          name: 'launch_local_app',
        },
      },
      reason: 'Retrying launch requires approval.',
    };
  },
});

assert.equal(riskyRecoveryRequests, 1);
assert.equal(riskyRecoveryResult.pause?.action.command.toolCall?.name, 'launch_local_app');
assert.equal(riskyRecoveryResult.rounds.length, 1);
assert.equal(riskyRecoveryResult.rounds[0]?.status, 'awaiting-approval');

let cappedRecoveryRequests = 0;

const cappedRecoveryResult = await executeAgentCoreRunLoop({
  command: {
    capabilityId: 'system-inspector',
    instruction: 'keep reading until capped',
    kind: 'tool-call',
    sourceText: '/agent keep reading until capped',
    toolCall: {
      input: {},
      name: 'get_display_info',
    },
  },
  onAgentChatCommand: async (command) => ({
    ok: true,
    responseText: `unverified ${command.toolCall?.name}`,
    assessment: {
      evidence: [`unverified ${command.toolCall?.name}`],
      nextStep: 'repeat read-only recovery',
      status: 'unverified',
      summary: `unverified ${command.toolCall?.name}`,
    },
  }),
  onAgentCoreRecovery: async (request) => {
    cappedRecoveryRequests += 1;
    return {
      command: {
        capabilityId: 'system-inspector',
        instruction: 'repeat read-only recovery',
        kind: 'tool-call',
        sourceText: request.originalCommand.sourceText,
        toolCall: {
          input: {},
          name: 'get_display_info',
        },
      },
      reason: 'Repeat read-only recovery.',
    };
  },
});

assert.equal(cappedRecoveryRequests, AGENT_CORE_RUN_LOOP_MAX_ROUNDS - 1);
assert.equal(cappedRecoveryResult.rounds.length, AGENT_CORE_RUN_LOOP_MAX_ROUNDS);
assert.equal(cappedRecoveryResult.rounds.at(-1)?.status, 'max-rounds');

console.log('agent core v1.5 recovery smoke ok');
