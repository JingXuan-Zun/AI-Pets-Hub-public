import assert from 'node:assert/strict';
import {
  AGENT_DESKTOP_AUTO_RECOVERY_MARKER,
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentToolCallName,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';
import {
  assertSourceDoesNotMatch,
  assertSourceMatches,
  readProjectSources,
} from './smokeTestHarness.ts';

const settings = {} as PetConfig['settings'];
const autoRecoveryMarker = AGENT_DESKTOP_AUTO_RECOVERY_MARKER;
const {
  autoRecoveryBuilder: autoRecoveryBuilderSource,
  compatibilityBuilder: compatibilityBuilderSource,
  session: sessionSource,
} = readProjectSources({
  autoRecoveryBuilder: 'src/agent/capabilities/agentDesktopRecoveryObservationBuilder.ts',
  compatibilityBuilder: 'src/agent/capabilities/agentDesktopRecoveryObservationBuilder.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
});

assertSourceMatches(
  autoRecoveryBuilderSource,
  /export function createAgentDesktopAutoRecoveryObservationCommand/u,
  'Desktop Recovery Capability should own auto recovery observation command construction.',
);
assertSourceMatches(
  autoRecoveryBuilderSource,
  /export function resolveAgentDesktopAutoRecoveryMaxWaits/u,
  'Desktop Recovery Capability should own wait budget calculation.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /function createAgentSessionV2AutoRecoveryObservationCommand/u,
  'AgentSessionV2 should not own auto recovery observation command construction.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /function resolveAgentSessionV2AutoRecoveryMaxWaits/u,
  'AgentSessionV2 should not own auto recovery wait budget calculation.',
);
assertSourceMatches(
  sessionSource,
  /from '\.\/capabilities\/agentDesktopRecoveryObservationBuilder'/u,
  'AgentSessionV2 should consume the Desktop Recovery Observation Capability directly.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /from '\.\/agentSessionV2AutoRecoveryObservationBuilder'/u,
  'AgentSessionV2 should not depend on the Legacy auto-recovery observation wrapper.',
);

function createToolCommand(
  name: AgentToolCallName,
  input: Record<string, unknown>,
  goal = 'start launcher item and wait for loading',
): AgentChatCommand {
  return {
    capabilityId: name === 'execute_desktop_observation' ? 'screen-vision' : 'app-launcher',
    instruction: goal,
    kind: 'tool-call',
    sourceText: '/agent start launcher item',
    toolCall: {
      goal,
      input,
      name,
    },
  };
}

function createLoadingSequenceResult(): AgentChatCommandResult {
  return {
    ok: true,
    receipt: {
      evidenceLines: ['Post-action visual state: loading'],
      status: 'unverified',
      summaryLines: ['Call: execute_desktop_sequence', 'Post-action visual state: loading'],
      title: 'Sequence result',
      toolName: 'execute_desktop_sequence',
      verification: 'Post-sequence visual state is loading.',
    },
    responseText: 'Clicked the launcher button, but the target is still loading.',
    stateSummary: {
      missingEvidence: ['Post-sequence visual state is loading, so the requested final state is not yet confirmed.'],
      observedState: ['Post-action visual state: loading'],
      recommendedRecovery: ['tool:execute_desktop_observation action=wait_and_observe'],
      structuredEvidence: {
        postActionRecovery: {
          nextArgs: {
            action: 'wait_and_observe',
            forceRefresh: true,
            includeVisual: true,
            query: 'League of Legends',
            waitMs: 2500,
          },
          nextTool: 'execute_desktop_observation',
          reason: 'The visible UI is still launching/loading.',
          strategy: 'wait-and-observe',
        },
        postActionState: 'loading',
        status: 'unverified',
      },
    },
    verification: 'Post-sequence visual state is loading.',
  };
}

function createAutoWaitObservationResult(waitMs = 2500): AgentChatCommandResult {
  return {
    ok: true,
    receipt: {
      evidenceLines: [`Waited ${waitMs}ms before observing.`, 'Post-action visual state: launched'],
      status: 'success',
      summaryLines: ['Call: execute_desktop_observation wait_and_observe'],
      title: 'Agent wait and observe',
      toolName: 'execute_desktop_observation',
      verification: 'The target is now visible after waiting.',
    },
    responseText: `Waited ${waitMs}ms, then observed that League of Legends is now visible.`,
    stateSummary: {
      observedState: ['Post-action visual state: launched'],
      structuredEvidence: {
        postActionState: 'launched',
        status: 'success',
        targetMatched: 'League of Legends',
      },
      verificationEvidence: ['League of Legends is now visible after waiting.'],
    },
    verification: 'League of Legends is now visible after waiting.',
  };
}

const approvedCommand = createToolCommand('execute_desktop_sequence', {
  postVerifyVisualQuery: 'League of Legends',
  stepsJson: JSON.stringify([
    {
      args: {
        action: 'open_app',
        target: 'League of Legends',
      },
      tool: 'execute_desktop_action',
    },
  ]),
});
const executedCommands: AgentChatCommand[] = [];
let modelCallCount = 0;

const result = await runAgentProductionSession({
  approvedToolResult: {
    command: approvedCommand,
    result: createLoadingSequenceResult(),
  },
  maxSteps: 3,
  modelCaller: async ({ userInput }) => {
    modelCallCount += 1;
    assert.equal(
      executedCommands.length,
      1,
      'auto recovery wait-and-observe should run before the next model decision',
    );
    assert.match(userInput, /automatic recovery observation result/u);
    assert.match(userInput, /League of Legends is now visible after waiting/u);
    return JSON.stringify({
      action: 'final_answer',
      message: 'Waited until League of Legends became visible.',
      understanding: {
        completedGoals: ['waited through loading', 'verified target is visible'],
        remainingGoals: [],
        successCriteria: 'League of Legends is visible after the approved action.',
        userNeed: 'start the launcher item and confirm it opened',
        verificationEvidence: ['League of Legends is now visible after waiting.'],
        verificationGaps: [],
        verificationStatus: 'satisfied',
      },
    });
  },
  settings,
  sourceText: '/agent start launcher item',
  toolExecutor: async (command) => {
    executedCommands.push(command);
    assert.equal(command.toolCall?.name, 'execute_desktop_observation');
    assert.equal(command.toolCall?.input.action, 'wait_and_observe');
    assert.equal(command.toolCall?.input.forceRefresh, true);
    assert.equal(command.toolCall?.input.includeVisual, true);
    assert.equal(command.toolCall?.input.query, 'League of Legends');
    assert.equal(command.toolCall?.input.waitMs, 2500);
    assert.equal(command.toolCall?.input.recoveryAttempt, 1);
    assert.equal(command.toolCall?.input.recoveryMaxAttempts, 3);
    assert.equal(command.toolCall?.input.recoveryPostActionState, 'loading');
    assert.match(String(command.toolCall?.input.question), /AgentSessionV2 auto recovery observation/u);
    assert.match(String(command.toolCall?.input.question), /Automatic wait attempt 1\/3/u);
    return createAutoWaitObservationResult();
  },
  userGoal: 'start launcher item',
});

assert.equal(result.status, 'completed', JSON.stringify(result, null, 2));
assert.equal(modelCallCount, 0);
assert.equal(executedCommands.length, 1);
assert.ok(
  result.steps.some((step) => (
    step.action === 'tool_call'
    && step.tool === 'execute_desktop_observation'
    && step.summary.includes('Auto recovery')
  )),
  'auto recovery should be visible in AgentSessionV2 structured steps',
);

const secondWaitCommands: AgentChatCommand[] = [];
const secondWaitResult = await runAgentProductionSession({
  approvedToolResult: {
    command: approvedCommand,
    result: createLoadingSequenceResult(),
  },
  continuation: {
    historyLines: [],
    sourceText: '/agent start launcher item',
    steps: [],
    toolResults: [
      {
        command: createToolCommand('execute_desktop_observation', {
          action: 'wait_and_observe',
          question: `${autoRecoveryMarker} Post-action state is loading. Automatic wait attempt 1/3 for this state.`,
          recoveryAttempt: 1,
          recoveryMaxAttempts: 3,
          recoveryPostActionState: 'loading',
          waitMs: 2500,
        }),
        result: createLoadingSequenceResult(),
      },
    ],
    userGoal: 'start launcher item',
  },
  maxSteps: 3,
  modelCaller: async ({ userInput }) => {
    assert.match(userInput, /automatic recovery observation result/u);
    assert.match(userInput, /Waited 4000ms, then observed that League of Legends is now visible/u);
    return JSON.stringify({
      action: 'final_answer',
      message: 'The target became visible after the second wait.',
      understanding: {
        completedGoals: ['waited through loading again', 'verified target is visible'],
        remainingGoals: [],
        successCriteria: 'League of Legends is visible after the approved action.',
        userNeed: 'start the launcher item and confirm it opened',
        verificationEvidence: ['League of Legends is now visible after waiting.'],
        verificationGaps: [],
        verificationStatus: 'satisfied',
      },
    });
  },
  settings,
  sourceText: '/agent start launcher item',
  toolExecutor: async (command) => {
    secondWaitCommands.push(command);
    assert.equal(command.toolCall?.name, 'execute_desktop_observation');
    assert.equal(command.toolCall?.input.action, 'wait_and_observe');
    assert.equal(command.toolCall?.input.waitMs, 4000);
    assert.equal(command.toolCall?.input.recoveryAttempt, 2);
    assert.equal(command.toolCall?.input.recoveryMaxAttempts, 3);
    assert.equal(command.toolCall?.input.recoveryPostActionState, 'loading');
    assert.match(String(command.toolCall?.input.question), /Automatic wait attempt 2\/3/u);
    return createAutoWaitObservationResult(4000);
  },
  userGoal: 'start launcher item',
});

assert.equal(secondWaitResult.status, 'completed');
assert.equal(secondWaitCommands.length, 1);

const waitCapReadCommands: AgentChatCommand[] = [];
const cappedResult = await runAgentProductionSession({
  approvedToolResult: {
    command: approvedCommand,
    result: createLoadingSequenceResult(),
  },
  continuation: {
    historyLines: [],
    sourceText: '/agent start launcher item',
    steps: [],
    toolResults: Array.from({ length: 3 }).map(() => ({
      command: createToolCommand('execute_desktop_observation', {
        action: 'wait_and_observe',
        question: autoRecoveryMarker,
      }),
      result: createAutoWaitObservationResult(),
    })),
    userGoal: 'start launcher item',
  },
  maxSteps: 4,
  modelCaller: async () => JSON.stringify({
    action: 'final_answer',
    message: 'The automatic wait budget was reached, so I am reporting the current state.',
    understanding: {
      blockedGoals: ['loading did not resolve within automatic wait budget'],
      completedGoals: [],
      remainingGoals: [],
      successCriteria: 'Do not wait forever.',
      userNeed: 'start launcher item',
      verificationEvidence: ['auto wait budget reached'],
      verificationGaps: [],
      verificationStatus: 'blocked',
    },
  }),
  settings,
  sourceText: '/agent start launcher item',
  toolExecutor: async (command) => {
    waitCapReadCommands.push(command);
    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    assert.equal(command.toolCall?.input.action, 'describe_elements');
    assert.equal(command.toolCall?.input.forceRefresh, true);
    assert.match(String(command.toolCall?.input.question), /Automatic wait budget for this state is exhausted/u);
    assert.match(String(command.toolCall?.input.question), /Do not click anything/u);
    return {
      observations: ['Visible progress text: still loading with a retry button'],
      ok: true,
      receipt: {
        evidenceLines: ['Visible progress text: still loading with a retry button'],
        status: 'unverified',
        summaryLines: ['Call: locate_screen_elements', 'Result: loading evidence read after wait cap'],
        title: 'Agent post-wait-cap read recovery',
        toolName: 'locate_screen_elements',
        verification: 'Visible progress text: still loading with a retry button',
      },
      responseText: 'Visible progress text: still loading with a retry button',
      stateSummary: {
        missingEvidence: ['Target has not launched after wait cap.'],
        observedState: ['Visible progress text: still loading with a retry button'],
        recommendedRecovery: ['Report blocked with concrete evidence or ask one short question.'],
        verificationEvidence: ['Visible progress text: still loading with a retry button'],
      },
      verification: 'Visible progress text: still loading with a retry button',
    };
  },
  userGoal: 'start launcher item',
});

assert.equal(cappedResult.status, 'needs-user', JSON.stringify(cappedResult, null, 2));
assert.equal(waitCapReadCommands.length, 1);

console.log('agent session v2 auto recovery wait smoke ok');
