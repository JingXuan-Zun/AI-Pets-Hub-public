import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];
const autoRecoveryMarker = 'AgentSessionV2 auto recovery observation';

function createToolCommand(name: AgentChatCommand['toolCall']['name'], input: Record<string, unknown>): AgentChatCommand {
  return {
    capabilityId: name === 'execute_desktop_observation' ? 'desktop-observation' : 'app-launcher',
    instruction: 'start Example App from launcher',
    kind: 'tool-call',
    sourceText: '/agent start Example App from launcher',
    toolCall: {
      goal: 'start Example App from launcher',
      input,
      name,
    },
  };
}

function createTransitionalResult(
  state: 'loading' | 'updating',
  label: string,
  visibleText: string,
): AgentChatCommandResult {
  return {
    ok: true,
    receipt: {
      evidenceLines: [`${label}: Post-action visual state: ${state}`, `Visible text: ${visibleText}`],
      status: 'unverified',
      summaryLines: ['Call: execute_desktop_observation', `State: ${state}`],
      title: `${label} ${state} observation`,
      toolName: 'execute_desktop_observation',
      verification: visibleText,
    },
    responseText: `${label}: ${visibleText}`,
    stateSummary: {
      missingEvidence: ['Example App is not fully launched yet.'],
      observedState: [`${label}: Post-action visual state: ${state}`, `Visible text: ${visibleText}`],
      recommendedRecovery: ['tool:execute_desktop_observation action=wait_and_observe'],
      structuredEvidence: {
        postActionState: state,
        status: 'unverified',
      },
      verificationEvidence: [visibleText],
    },
    verification: visibleText,
  };
}

function createContinuationWithUpdatingWaits(progressTexts: string[]) {
  return {
    historyLines: [],
    sourceText: '/agent start Example App from launcher',
    steps: [],
    toolResults: progressTexts.map((progressText, index) => ({
      command: createToolCommand('execute_desktop_observation', {
        action: 'wait_and_observe',
        question: `${autoRecoveryMarker} Post-action state is updating. Automatic wait attempt ${index + 1}/2 for this state.`,
        recoveryAttempt: index + 1,
        recoveryMaxAttempts: 2,
        recoveryPostActionState: 'updating',
        waitMs: index === 0 ? 5000 : 8000,
      }),
      result: createTransitionalResult('updating', `wait ${index + 1}`, progressText),
    })),
    userGoal: 'start Example App from launcher',
  };
}

function createContinuationWithLoadingPhases(phaseTexts: string[]) {
  return {
    historyLines: [],
    sourceText: '/agent start Example App from launcher',
    steps: [],
    toolResults: phaseTexts.map((phaseText, index) => ({
      command: createToolCommand('execute_desktop_observation', {
        action: 'wait_and_observe',
        question: `${autoRecoveryMarker} Post-action state is loading. Automatic wait attempt ${index + 1}/3 for this state.`,
        recoveryAttempt: index + 1,
        recoveryMaxAttempts: 3,
        recoveryPostActionState: 'loading',
        waitMs: index === 0 ? 2500 : index === 1 ? 4000 : 6500,
      }),
      result: createTransitionalResult('loading', `wait ${index + 1}`, phaseText),
    })),
    userGoal: 'start Example App from launcher',
  };
}

const approvedCommand = createToolCommand('execute_desktop_sequence', {
  postVerifyVisualQuery: 'Example App',
  stepsJson: JSON.stringify([
    {
      args: {
        action: 'click',
        button: 'left',
        x: 1440,
        y: 920,
      },
      reason: 'Click the located Start button.',
      tool: 'execute_desktop_input',
    },
  ]),
});

const stalledCommands: AgentChatCommand[] = [];
const stalledResult = await runAgentProductionSession({
  approvedToolResult: {
    command: approvedCommand,
    result: createTransitionalResult('updating', 'verification', 'Downloading resources 62%. 1.2 GB / 2.0 GB.'),
  },
  continuation: createContinuationWithUpdatingWaits([
    'Downloading resources 35%. 0.7 GB / 2.0 GB.',
    'Downloading resources 62%. 1.2 GB / 2.0 GB.',
  ]),
  maxSteps: 4,
  modelCaller: async ({ userInput }) => {
    assert.match(userInput, /budget=exhausted/u);
    assert.match(userInput, /still shows the same progress/u);
    return JSON.stringify({
      action: 'final_answer',
      message: 'Progress appears stalled at the same value, so I checked the visible state instead of waiting again.',
      understanding: {
        blockedGoals: ['progress did not advance after automatic waits'],
        completedGoals: ['read visible state after wait cap'],
        remainingGoals: [],
        successCriteria: 'Do not keep waiting when progress is unchanged.',
        userNeed: 'start Example App from launcher',
        verificationEvidence: ['visible state was read after unchanged progress'],
        verificationGaps: [],
        verificationStatus: 'blocked',
      },
    });
  },
  settings,
  sourceText: '/agent start Example App from launcher',
  toolExecutor: async (command) => {
    stalledCommands.push(command);
    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    assert.equal(command.toolCall?.input.action, 'describe_elements');
    assert.match(String(command.toolCall?.input.question), /Automatic wait budget for this state is exhausted/u);
    return {
      observations: ['Visible text: Example App still shows the same progress, 62%.'],
      ok: true,
      responseText: 'Visible text: Example App still shows the same progress, 62%.',
      stateSummary: {
        missingEvidence: ['Progress did not advance beyond 62%.'],
        observedState: ['Visible text: Example App still shows the same progress, 62%.'],
        verificationEvidence: ['Progress stayed at 62%.'],
      },
      verification: 'Visible text: Example App still shows the same progress, 62%.',
    };
  },
  userGoal: 'start Example App from launcher',
});

assert.equal(stalledResult.status, 'needs-user', JSON.stringify(stalledResult, null, 2));
assert.equal(stalledCommands.length, 1);

const changingPhaseCommands: AgentChatCommand[] = [];
const changingPhaseResult = await runAgentProductionSession({
  approvedToolResult: {
    command: approvedCommand,
    result: createTransitionalResult('loading', 'verification', 'Loading resources for Example App.'),
  },
  continuation: createContinuationWithLoadingPhases([
    'Launching client.',
    'Connecting to service.',
    'Preparing runtime.',
  ]),
  maxSteps: 3,
  modelCaller: async () => {
    throw new Error('model should not be called when changing phase evidence allows one more automatic wait');
  },
  settings,
  sourceText: '/agent start Example App from launcher',
  toolExecutor: async (command) => {
    changingPhaseCommands.push(command);
    assert.equal(command.toolCall?.name, 'execute_desktop_observation');
    assert.equal(command.toolCall?.input.action, 'wait_and_observe');
    assert.equal(command.toolCall?.input.recoveryAttempt, 4);
    assert.equal(command.toolCall?.input.recoveryMaxAttempts, 4);
    assert.equal(command.toolCall?.input.recoveryPostActionState, 'loading');
    assert.match(String(command.toolCall?.input.question), /Automatic wait attempt 4\/4/u);
    return {
      ok: true,
      responseText: 'Example App is visible and running.',
      stateSummary: {
        observedState: ['Post-action visual state: launched'],
        structuredEvidence: {
          postActionState: 'launched',
          status: 'success',
          targetMatched: 'Example App',
        },
        verificationEvidence: ['Example App is visible and running.'],
      },
      verification: 'Example App is visible and running.',
    };
  },
  userGoal: 'start Example App from launcher',
});

assert.equal(changingPhaseResult.status, 'completed', JSON.stringify(changingPhaseResult, null, 2));
assert.equal(changingPhaseCommands.length, 1);

console.log('agent session v2 auto recovery progress stall smoke ok');
