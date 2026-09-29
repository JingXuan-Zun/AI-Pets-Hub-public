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

function createLoadingResult(label: string, visibleText: string): AgentChatCommandResult {
  return {
    ok: true,
    receipt: {
      evidenceLines: [`${label}: Post-action visual state: loading`, `Visible text: ${visibleText}`],
      status: 'unverified',
      summaryLines: ['Call: execute_desktop_observation', 'State: loading'],
      title: `${label} loading observation`,
      toolName: 'execute_desktop_observation',
      verification: visibleText,
    },
    responseText: `${label}: ${visibleText}`,
    stateSummary: {
      missingEvidence: ['Example App is not fully launched yet.'],
      observedState: [`${label}: Post-action visual state: loading`, `Visible text: ${visibleText}`],
      recommendedRecovery: ['tool:execute_desktop_observation action=wait_and_observe'],
      structuredEvidence: {
        postActionState: 'loading',
        status: 'unverified',
      },
      verificationEvidence: [visibleText],
    },
    verification: visibleText,
  };
}

function createWaitCapReadResult(): AgentChatCommandResult {
  return {
    observations: [
      'Visible text: Connecting to service for Example App.',
      'The launcher has advanced from preparing runtime to connecting.',
      'No error, modal, or login prompt is visible.',
    ],
    ok: true,
    receipt: {
      evidenceLines: [
        'Visible text: Connecting to service for Example App.',
        'No error, modal, or login prompt is visible.',
      ],
      status: 'unverified',
      summaryLines: ['Call: locate_screen_elements', 'Result: progress still advancing'],
      title: 'Wait cap state read',
      toolName: 'locate_screen_elements',
      verification: 'The UI is still transitional, but the visible phase advanced to connecting.',
    },
    responseText: 'The UI is still transitional, but it advanced to Connecting to service.',
    stateSummary: {
      missingEvidence: ['Example App is not fully launched yet.'],
      observedState: ['Visible text: Connecting to service for Example App.'],
      recommendedRecovery: ['Continue wait_and_observe because the launch phase is still advancing.'],
      verificationEvidence: [
        'The visible phase changed from preparing runtime to connecting.',
      ],
    },
    verification: 'The UI is still transitional, but the visible phase advanced to connecting.',
  };
}

function createLaunchedResult(): AgentChatCommandResult {
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
}

function createContinuationWithLoadingWaits() {
  return {
    historyLines: [],
    sourceText: '/agent start Example App from launcher',
    steps: [],
    toolResults: [
      'Launching client.',
      'Connecting to account service.',
      'Preparing runtime.',
    ].map((visibleText, index) => ({
      command: createToolCommand('execute_desktop_observation', {
        action: 'wait_and_observe',
        question: `${autoRecoveryMarker} Post-action state is loading. Automatic wait attempt ${index + 1}/3 for this state.`,
        recoveryAttempt: index + 1,
        recoveryMaxAttempts: 3,
        recoveryPostActionState: 'loading',
        waitMs: index === 0 ? 2500 : index === 1 ? 4000 : 6500,
      }),
      result: createLoadingResult(`wait ${index + 1}`, visibleText),
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

const recoveryCommands: AgentChatCommand[] = [];
let modelCallCount = 0;

const result = await runAgentProductionSession({
  approvedToolResult: {
    command: approvedCommand,
    result: createLoadingResult('verification', 'Preparing runtime.'),
  },
  continuation: createContinuationWithLoadingWaits(),
  maxSteps: 3,
  modelCaller: async () => {
    modelCallCount += 1;
    throw new Error('model should not be called when wait-cap read proves progress is still advancing');
  },
  settings,
  sourceText: '/agent start Example App from launcher',
  toolExecutor: async (command) => {
    recoveryCommands.push(command);

    if (recoveryCommands.length === 1) {
      assert.equal(command.toolCall?.name, 'locate_screen_elements');
      assert.equal(command.toolCall?.input.action, 'describe_elements');
      assert.match(String(command.toolCall?.input.question), /Automatic wait budget for this state is exhausted/u);
      assert.equal(command.toolCall?.input.recoveryReadPurpose, 'wait-cap:loading');
      return createWaitCapReadResult();
    }

    assert.equal(recoveryCommands.length, 2);
    assert.equal(command.toolCall?.name, 'execute_desktop_observation');
    assert.equal(command.toolCall?.input.action, 'wait_and_observe');
    assert.equal(command.toolCall?.input.recoveryAttempt, 1);
    assert.equal(command.toolCall?.input.recoveryMaxAttempts, 2);
    assert.equal(command.toolCall?.input.recoveryPostActionState, 'updating');
    assert.match(String(command.toolCall?.input.question), /Automatic wait attempt 1\/2/u);
    return createLaunchedResult();
  },
  userGoal: 'start Example App from launcher',
});

assert.equal(modelCallCount, 0);
assert.equal(recoveryCommands.length, 2);
assert.equal(result.status, 'completed', JSON.stringify(result, null, 2));
assert.match(result.continuation.historyLines.join('\n'), /Automatic wait budget/u);
assert.match(result.continuation.historyLines.join('\n'), /postActionState=updating/u);
assert.match(result.continuation.historyLines.join('\n'), /postActionState=launched/u);

console.log('agent session v2 auto recovery wait cap progress smoke ok');
