import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];
const sourceText = '/agent open Example Game inside Example Launcher';
const userGoal = 'open Example Game inside Example Launcher';

const approvedClickCommand: AgentChatCommand = {
  capabilityId: 'desktop-input',
  instruction: userGoal,
  kind: 'tool-call',
  sourceText,
  toolCall: {
    goal: userGoal,
    input: {
      postVerifyQuery: 'Example Game',
      postVerifyVisualQuery: 'Example Game',
      stepsJson: JSON.stringify([
        {
          args: {
            action: 'click',
            button: 'left',
            x: 1440,
            y: 920,
          },
          reason: 'Click the located Play button for Example Game.',
          tool: 'execute_desktop_input',
        },
      ]),
    },
    name: 'execute_desktop_sequence',
  },
};

const approvedClickResult: AgentChatCommandResult = {
  ok: true,
  receipt: {
    evidenceLines: ['Step 1/1 tool=execute_desktop_input status=ok'],
    status: 'success',
    summaryLines: ['Call: execute_desktop_sequence', 'Completed: 1/1'],
    title: 'Agent desktop sequence',
    toolName: 'execute_desktop_sequence',
    verification: 'execute_desktop_sequence completed all steps in order.',
  },
  responseText: 'Clicked the Example Game Play button.',
  stateSummary: {
    changedState: ['active-window-input-state'],
    observedState: ['Step 1/1 tool=execute_desktop_input status=ok'],
    verificationEvidence: ['Sequence steps completed.'],
  },
  verification: 'Click sequence completed; post-action verification is required.',
};

function createLaunchedVerificationResult(): AgentChatCommandResult {
  return {
    ok: true,
    receipt: {
      evidenceLines: ['Post-action visual state: launched', 'Target matched: Example Game'],
      status: 'success',
      summaryLines: ['Call: execute_desktop_observation summarize_visual_snapshot'],
      title: 'Post approval visual verification',
      toolName: 'execute_desktop_observation',
      verification: 'Example Game is visible and running.',
    },
    responseText: 'Example Game is now visible and running.',
    stateSummary: {
      observedState: ['Example Game main window is visible.'],
      structuredEvidence: {
        finalWindow: {
          hwnd: 200,
          processName: 'example-game',
          title: 'Example Game',
        },
        postActionState: 'launched',
        status: 'success',
        targetMatched: 'Example Game',
      },
      verificationEvidence: ['Example Game is visible and running.'],
    },
    verification: 'Example Game is visible and running.',
  };
}

const toolCommands: AgentChatCommand[] = [];
let modelCallCount = 0;

const result = await runAgentProductionSession({
  approvedToolResult: {
    command: approvedClickCommand,
    result: approvedClickResult,
  },
  maxSteps: 3,
  modelCaller: async () => {
    modelCallCount += 1;
    throw new Error('model should not be called after post-click verification confirms launched');
  },
  settings,
  sourceText,
  toolExecutor: async (command) => {
    toolCommands.push(command);
    assert.equal(command.toolCall?.name, 'execute_desktop_observation');
    assert.equal(command.toolCall.input.action, 'summarize_visual_snapshot');
    assert.match(String(command.toolCall.input.query), /Example Game/);
    assert.match(String(command.toolCall.input.question), /AgentRuntime post-action verification/u);
    return createLaunchedVerificationResult();
  },
  userGoal,
});

assert.equal(modelCallCount, 0);
assert.equal(result.status, 'completed');
assert.equal(toolCommands.length, 1);
assert.match(result.finalAnswer, /success|visible|running|鎵撳紑|鍚姩/u);
const history = result.continuation.historyLines.join('\n');
assert.match(history, /Approved tool result/u);
assert.match(history, /post-approval verification result/u);
assert.match(history, /ActionRuntime current action/u);
assert.match(history, /status=completed/u);
assert.match(history, /postActionState=launched/u);

console.log('agent session v2 in-app click verify completion smoke ok');
