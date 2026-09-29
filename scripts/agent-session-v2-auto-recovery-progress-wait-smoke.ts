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
    instruction: 'start Example Game from launcher',
    kind: 'tool-call',
    sourceText: '/agent start Example Game from launcher',
    toolCall: {
      goal: 'start Example Game from launcher',
      input,
      name,
    },
  };
}

function createUpdatingResult(label: string, progressText?: string): AgentChatCommandResult {
  const visibleText = progressText || 'Example Game is updating.';
  return {
    ok: true,
    receipt: {
      evidenceLines: [`${label}: Post-action visual state: updating`, `Visible text: ${visibleText}`],
      status: 'unverified',
      summaryLines: ['Call: execute_desktop_observation', 'State: updating'],
      title: `${label} updating observation`,
      toolName: 'execute_desktop_observation',
      verification: visibleText,
    },
    responseText: `${label}: ${visibleText}`,
    stateSummary: {
      missingEvidence: ['Example Game is not fully launched yet.'],
      observedState: [`${label}: Post-action visual state: updating`, `Visible text: ${visibleText}`],
      recommendedRecovery: ['tool:execute_desktop_observation action=wait_and_observe'],
      structuredEvidence: {
        postActionState: 'updating',
        status: 'unverified',
      },
      verificationEvidence: [visibleText],
    },
    verification: visibleText,
  };
}

function createLaunchedResult(): AgentChatCommandResult {
  return {
    ok: true,
    receipt: {
      evidenceLines: ['Post-action visual state: launched', 'Example Game is visible and running.'],
      status: 'success',
      summaryLines: ['Call: execute_desktop_observation wait_and_observe', 'State: launched'],
      title: 'Agent wait and observe',
      toolName: 'execute_desktop_observation',
      verification: 'Example Game is visible and running.',
    },
    responseText: 'Example Game is visible and running.',
    stateSummary: {
      observedState: ['Post-action visual state: launched'],
      structuredEvidence: {
        postActionState: 'launched',
        status: 'success',
        targetMatched: 'Example Game',
      },
      verificationEvidence: ['Example Game is visible and running.'],
    },
    verification: 'Example Game is visible and running.',
  };
}

function createPreviousUpdatingWaits(): AgentChatCommandResult[] {
  return [
    createUpdatingResult('wait 1', 'Downloading resources 35%.'),
    createUpdatingResult('wait 2', 'Downloading resources 54%.'),
  ];
}

function createContinuationWithUpdatingWaits() {
  return {
    historyLines: [],
    sourceText: '/agent start Example Game from launcher',
    steps: [],
    toolResults: createPreviousUpdatingWaits().map((result, index) => ({
      command: createToolCommand('execute_desktop_observation', {
        action: 'wait_and_observe',
        question: `${autoRecoveryMarker} Post-action state is updating. Automatic wait attempt ${index + 1}/2 for this state.`,
        recoveryAttempt: index + 1,
        recoveryMaxAttempts: 2,
        recoveryPostActionState: 'updating',
        waitMs: index === 0 ? 5000 : 8000,
      }),
      result,
    })),
    userGoal: 'start Example Game from launcher',
  };
}

const approvedCommand = createToolCommand('execute_desktop_sequence', {
  postVerifyVisualQuery: 'Example Game',
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

const progressWaitCommands: AgentChatCommand[] = [];
let progressModelCallCount = 0;

const progressResult = await runAgentProductionSession({
  approvedToolResult: {
    command: approvedCommand,
    result: createUpdatingResult('verification', 'Downloading resources 62%. 1.2 GB / 2.0 GB.'),
  },
  continuation: createContinuationWithUpdatingWaits(),
  maxSteps: 3,
  modelCaller: async () => {
    progressModelCallCount += 1;
    throw new Error('model should not be called when progress-aware wait can continue and then finish');
  },
  settings,
  sourceText: '/agent start Example Game from launcher',
  toolExecutor: async (command) => {
    progressWaitCommands.push(command);
    assert.equal(command.toolCall?.name, 'execute_desktop_observation');
    assert.equal(command.toolCall?.input.action, 'wait_and_observe');
    assert.equal(command.toolCall?.input.waitMs, 8000);
    assert.equal(command.toolCall?.input.recoveryAttempt, 3);
    assert.equal(command.toolCall?.input.recoveryMaxAttempts, 4);
    assert.equal(command.toolCall?.input.recoveryPostActionState, 'updating');
    assert.match(String(command.toolCall?.input.question), /Automatic wait attempt 3\/4/u);
    return createLaunchedResult();
  },
  userGoal: 'start Example Game from launcher',
});

assert.equal(progressResult.status, 'completed');
assert.equal(progressModelCallCount, 0);
assert.equal(progressWaitCommands.length, 1);
assert.match(progressResult.continuation.historyLines.join('\n'), /postActionState=launched/u);

const stalledCommands: AgentChatCommand[] = [];
const stalledResult = await runAgentProductionSession({
  approvedToolResult: {
    command: approvedCommand,
    result: createUpdatingResult('verification'),
  },
  continuation: createContinuationWithUpdatingWaits(),
  maxSteps: 4,
  modelCaller: async ({ userInput }) => {
    assert.match(userInput, /budget=exhausted/u);
    assert.match(userInput, /No progress percentage/u);
    return JSON.stringify({
      action: 'final_answer',
      message: 'The update still has no visible progress; the current visible state was recorded.',
      understanding: {
        blockedGoals: ['updating did not show progress after automatic waits'],
        completedGoals: [],
        remainingGoals: [],
        successCriteria: 'Do not wait forever without visible progress evidence.',
        userNeed: 'start Example Game from launcher',
        verificationEvidence: ['visible state was read after wait cap'],
        verificationGaps: [],
        verificationStatus: 'blocked',
      },
    });
  },
  settings,
  sourceText: '/agent start Example Game from launcher',
  toolExecutor: async (command) => {
    stalledCommands.push(command);
    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    assert.equal(command.toolCall?.input.action, 'describe_elements');
    assert.match(String(command.toolCall?.input.question), /Automatic wait budget for this state is exhausted/u);
    return {
      observations: ['Visible text: Example Game is updating, no progress number is visible.'],
      ok: true,
      responseText: 'Visible text: Example Game is updating, no progress number is visible.',
      stateSummary: {
        missingEvidence: ['No progress percentage or recovery control is visible.'],
        observedState: ['Visible text: Example Game is updating, no progress number is visible.'],
        verificationEvidence: ['Visible updating text without progress details.'],
      },
      verification: 'Visible updating text without progress details.',
    };
  },
  userGoal: 'start Example Game from launcher',
});

assert.equal(stalledResult.status, 'needs-user', JSON.stringify(stalledResult, null, 2));
assert.equal(stalledCommands.length, 1);

console.log('agent session v2 auto recovery progress wait smoke ok');
