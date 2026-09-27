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

function createLoadingVisualVerificationResult(): AgentChatCommandResult {
  return {
    ok: true,
    receipt: {
      evidenceLines: ['Visual post-action state: loading'],
      status: 'unverified',
      summaryLines: ['Call: summarize_visual_snapshot', 'State: loading'],
      title: 'Post approval visual verification',
      toolName: 'summarize_visual_snapshot',
      verification: 'The requested target appears to be loading.',
    },
    responseText: 'The launcher shows Example Game loading.',
    stateSummary: {
      missingEvidence: ['Example Game is not fully launched yet.'],
      observedState: ['Visual post-action state: loading'],
      recommendedRecovery: ['tool:execute_desktop_observation action=wait_and_observe'],
      structuredEvidence: {
        postActionRecovery: {
          nextArgs: {
            action: 'wait_and_observe',
            forceRefresh: true,
            includeVisual: true,
            query: 'Example Game',
            waitMs: 2500,
          },
          nextTool: 'execute_desktop_observation',
          reason: 'The approved action produced a loading screen.',
          strategy: 'wait-and-observe',
        },
        postActionState: 'loading',
        status: 'unverified',
      },
      verificationEvidence: ['The requested target appears to be loading.'],
    },
    verification: 'The requested target appears to be loading.',
  };
}

function createLaunchedWaitResult(): AgentChatCommandResult {
  return {
    ok: true,
    receipt: {
      evidenceLines: ['Waited 2500ms before observing.', 'Post-action visual state: launched'],
      status: 'success',
      summaryLines: ['Call: execute_desktop_observation wait_and_observe'],
      title: 'Agent wait and observe',
      toolName: 'execute_desktop_observation',
      verification: 'Example Game is visible after waiting.',
    },
    responseText: 'Waited 2500ms, then observed that Example Game is visible.',
    stateSummary: {
      observedState: ['Post-action visual state: launched'],
      structuredEvidence: {
        postActionState: 'launched',
        status: 'success',
        targetMatched: 'Example Game',
      },
      verificationEvidence: ['Example Game is visible after waiting.'],
    },
    verification: 'Example Game is visible after waiting.',
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
  maxSteps: 4,
  modelCaller: async () => {
    modelCallCount += 1;
    throw new Error('model should not be called after auto recovery confirms launched');
  },
  settings,
  sourceText: '/agent start Example Game from launcher',
  toolExecutor: async (command) => {
    executedCommands.push(command);
    if (executedCommands.length === 1) {
      assert.equal(command.toolCall?.name, 'execute_desktop_observation');
      assert.equal(command.toolCall?.input.action, 'summarize_visual_snapshot');
      assert.equal(command.toolCall?.input.forceRefresh, true);
      assert.equal(command.toolCall?.input.query, 'Example Game');
      assert.match(String(command.toolCall?.input.question), /AgentRuntime post-action verification/u);
      return createLoadingVisualVerificationResult();
    }

    assert.equal(command.toolCall?.name, 'execute_desktop_observation');
    assert.equal(command.toolCall?.input.action, 'wait_and_observe');
    assert.equal(command.toolCall?.input.waitMs, 2500);
    assert.match(String(command.toolCall?.input.question), /AgentSessionV2 auto recovery observation/u);
    return createLaunchedWaitResult();
  },
  userGoal: 'start Example Game from launcher',
});

assert.equal(result.status, 'completed');
assert.equal(modelCallCount, 0);
assert.equal(executedCommands.length, 2);
assert.match(result.finalAnswer, /打开\/启动成功/u);
assert.match(result.continuation.historyLines.join('\n'), /post-approval verification result/u);
assert.match(result.continuation.historyLines.join('\n'), /automatic recovery observation result/u);
assert.match(result.continuation.historyLines.join('\n'), /post-action state machine stopped/u);

const authenticationCommand: AgentChatCommand = {
  capabilityId: 'app-launcher',
  instruction: '打开 Example App 并登录',
  kind: 'tool-call',
  sourceText: '/agent 打开 Example App 并登录',
  toolCall: {
    actionScope: {
      completion: 'intermediate',
      subgoalId: 'intermediate:login',
      targetRef: '登录',
    },
    goal: '打开 Example App 并登录',
    input: {
      postVerifyQuery: 'Example App',
      stepsJson: JSON.stringify([
        {
          args: { action: 'launch_local_app', target: 'Example App' },
          reason: '打开目标应用。',
          tool: 'execute_desktop_action',
        },
        {
          args: { action: 'click', x: 400, y: 300 },
          reason: '点击已定位的登录按钮。',
          tool: 'execute_desktop_input',
        },
      ]),
    },
    name: 'execute_desktop_sequence',
  },
};
let authenticationVerificationCalls = 0;
const authenticationResult = await runAgentProductionSession({
  approvedToolResult: {
    command: authenticationCommand,
    result: createApprovedSequenceResult(),
  },
  maxSteps: 3,
  modelCaller: async () => {
    throw new Error('model should not run after verified authentication completion');
  },
  settings,
  sourceText: authenticationCommand.sourceText,
  toolExecutor: async (command) => {
    authenticationVerificationCalls += 1;
    assert.equal(command.toolCall?.name, 'execute_desktop_observation');
    return {
      ok: true,
      responseText: '主界面已显示，未出现登录浮层。',
      stateSummary: {
        observedState: ['主界面已显示', '未出现登录浮层'],
        structuredEvidence: {
          postActionState: 'launched',
          selectionVerificationStatus: 'mismatch',
          status: 'success',
        },
        verificationEvidence: ['登录浮层已消失，主界面可见。'],
      },
      verification: '主界面已显示，未出现登录浮层。',
    };
  },
  userGoal: '打开 Example App 并登录',
});
assert.equal(authenticationVerificationCalls, 1);
assert.equal(authenticationResult.status, 'completed');

console.log('agent session v2 post approval verification smoke ok');
