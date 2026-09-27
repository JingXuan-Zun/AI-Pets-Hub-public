import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

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

function createApprovedSequenceResult(): AgentChatCommandResult {
  return {
    ok: true,
    receipt: {
      evidenceLines: ['Step 1/1 tool=execute_desktop_input status=ok'],
      status: 'success',
      summaryLines: ['Call: execute_desktop_sequence', 'Completed: 1/1'],
      title: 'Agent desktop sequence',
      toolName: 'execute_desktop_sequence',
      verification: 'execute_desktop_sequence completed all steps in order.',
    },
    responseText: 'execute_desktop_sequence completed all steps in order.',
    stateSummary: {
      changedState: ['cursor-position', 'active-window-input-state'],
      observedState: ['Step 1/1 tool=execute_desktop_input status=ok'],
      verificationEvidence: ['Sequence steps completed.'],
    },
    verification: 'execute_desktop_sequence completed all steps in order.',
  };
}

function createPostActionResult(state: 'loading' | 'launched', label: string): AgentChatCommandResult {
  const launched = state === 'launched';
  return {
    ok: true,
    receipt: {
      evidenceLines: [`${label}: Post-action visual state: ${state}`],
      status: launched ? 'success' : 'unverified',
      summaryLines: ['Call: execute_desktop_observation', `State: ${state}`],
      title: `${label} post-action observation`,
      toolName: 'execute_desktop_observation',
      verification: launched
        ? 'Example Game is visible and running.'
        : 'Example Game is still loading.',
    },
    responseText: launched
      ? `${label}: Example Game is visible and running.`
      : `${label}: Example Game is still loading.`,
    stateSummary: {
      missingEvidence: launched ? [] : ['Example Game is not fully launched yet.'],
      observedState: [`${label}: Post-action visual state: ${state}`],
      recommendedRecovery: launched ? [] : ['tool:execute_desktop_observation action=wait_and_observe'],
      structuredEvidence: {
        postActionState: state,
        status: launched ? 'success' : 'unverified',
        targetMatched: launched ? 'Example Game' : undefined,
      },
      verificationEvidence: launched
        ? ['Example Game is visible and running.']
        : ['Example Game is still loading.'],
    },
    verification: launched
      ? 'Example Game is visible and running.'
      : 'Example Game is still loading.',
  };
}

const approvedCommand = createToolCommand('execute_desktop_sequence', {
  postVerifyQuery: 'Example Game',
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

const executedCommands: AgentChatCommand[] = [];
let modelCallCount = 0;

const result = await runAgentProductionSession({
  approvedToolResult: {
    command: approvedCommand,
    result: createApprovedSequenceResult(),
  },
  maxSteps: 2,
  modelCaller: async () => {
    modelCallCount += 1;
    throw new Error('model should not be called while auto recovery loop can finish the task');
  },
  settings,
  sourceText: '/agent start Example Game from launcher',
  toolExecutor: async (command) => {
    executedCommands.push(command);
    if (executedCommands.length === 1) {
      assert.equal(command.toolCall?.name, 'execute_desktop_observation');
      assert.equal(command.toolCall?.input.action, 'summarize_visual_snapshot');
      return createPostActionResult('loading', 'verification');
    }

    assert.equal(command.toolCall?.name, 'execute_desktop_observation');
    assert.equal(command.toolCall?.input.action, 'wait_and_observe');
    assert.match(String(command.toolCall?.input.question), /AgentSessionV2 auto recovery observation/u);

    if (executedCommands.length === 2) {
      assert.equal(command.toolCall?.input.waitMs, 2500);
      return createPostActionResult('loading', 'wait 1');
    }

    assert.equal(command.toolCall?.input.waitMs, 4000);
    return createPostActionResult('launched', 'wait 2');
  },
  userGoal: 'start Example Game from launcher',
});

assert.equal(result.status, 'completed');
assert.equal(modelCallCount, 0);
assert.equal(executedCommands.length, 3);
assert.match(result.finalAnswer, /opened\/launched successfully|Example Game is visible and running/u);
assert.match(result.continuation.historyLines.join('\n'), /automatic recovery loop continued/u);
assert.match(result.continuation.historyLines.join('\n'), /postActionState=loading/u);
assert.match(result.continuation.historyLines.join('\n'), /postActionState=launched/u);

console.log('agent session v2 auto recovery loop loading smoke ok');
