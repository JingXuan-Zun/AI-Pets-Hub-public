import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

function createSequenceCommand(): AgentChatCommand {
  return {
    capabilityId: 'app-launcher',
    instruction: 'start Example Game from the launcher',
    kind: 'tool-call',
    sourceText: '/agent start Example Game from the launcher',
    toolCall: {
      goal: 'start Example Game from the launcher',
      input: {
        postVerifyVisualQuery: 'Example Game',
        stepsJson: JSON.stringify([
          {
            args: {
              action: 'click',
              button: 'left',
              x: 840,
              y: 560,
            },
            reason: 'Click the visible Start button for Example Game.',
            tool: 'execute_desktop_input',
          },
        ]),
      },
      name: 'execute_desktop_sequence',
    },
  };
}

function createApprovedClickResult(): AgentChatCommandResult {
  return {
    observations: ['Clicked the Start button for Example Game.'],
    ok: true,
    receipt: {
      evidenceLines: ['Step 1/1 tool=execute_desktop_input status=ok'],
      status: 'success',
      summaryLines: ['Call: execute_desktop_sequence'],
      title: 'Agent desktop sequence',
      toolName: 'execute_desktop_sequence',
      verification: 'The click primitive completed, but the launched target is not verified yet.',
    },
    responseText: 'Desktop sequence completed 1/1 step(s).',
    verification: 'The click primitive completed.',
  };
}

function createImplicitLoadingResult(): AgentChatCommandResult {
  return {
    observations: [
      'Example Game is still loading inside the launcher.',
      'No target game window is visible yet.',
    ],
    ok: true,
    receipt: {
      evidenceLines: [
        'Visual text: launching Example Game...',
        'No target game window is visible yet.',
      ],
      status: 'unverified',
      summaryLines: ['Call: execute_desktop_observation summarize_visual_snapshot'],
      title: 'Post approval visual verification',
      toolName: 'execute_desktop_observation',
      verification: 'The target is launching but not confirmed open.',
    },
    responseText: 'Example Game is still loading; launch is not confirmed.',
    verification: 'The target is launching but not confirmed open.',
  };
}

function createImplicitUnchangedResult(): AgentChatCommandResult {
  return {
    observations: [
      'The same launcher screen remained visible after waiting.',
      'No visible change happened.',
      'The Start button is still visible.',
    ],
    ok: true,
    receipt: {
      evidenceLines: [
        'The same launcher screen remained visible after waiting.',
        'The Start button is still visible.',
      ],
      status: 'unverified',
      summaryLines: ['Call: execute_desktop_observation wait_and_observe'],
      title: 'Agent wait and observe',
      toolName: 'execute_desktop_observation',
      verification: 'No target game window launched after waiting.',
    },
    responseText: 'The launcher stayed unchanged after waiting.',
    verification: 'No target game window launched after waiting.',
  };
}

function createRecoveryReadResult(): AgentChatCommandResult {
  return {
    observations: [
      'The same launcher screen is unchanged.',
      'The Example Game tile and Start button are still visible.',
      'No target game window launched.',
      'No visible error text is present.',
    ],
    ok: true,
    receipt: {
      evidenceLines: [
        'The same launcher screen is unchanged.',
        'The Example Game tile and Start button are still visible.',
        'No target game window launched.',
      ],
      status: 'unverified',
      summaryLines: ['Call: locate_screen_elements'],
      title: 'Agent visual recovery read',
      toolName: 'locate_screen_elements',
      verification: 'The UI stayed on the launcher after the click and wait.',
    },
    responseText: 'The Start button is still visible and the target game window did not launch.',
    verification: 'The UI stayed on the launcher after the click and wait.',
  };
}

let modelCallCount = 0;
const toolCommands: AgentChatCommand[] = [];

const result = await runAgentProductionSession({
  approvedToolResult: {
    command: createSequenceCommand(),
    result: createApprovedClickResult(),
  },
  maxSteps: 4,
  modelCaller: async ({ userInput }) => {
    modelCallCount += 1;
    assert.equal(modelCallCount, 1);
    // Older loop history is compacted out of the model input; the planning
    // signals keep the post-approval verification evidence.
    assert.match(userInput, /Example Game is still loading inside the launcher/u);
    assert.match(userInput, /automatic recovery observation result/u);
    assert.match(userInput, /postActionState=unchanged/u);
    assert.match(userInput, /The Start button is still visible/u);
    assert.doesNotMatch(userInput, /rejected unverified result final answer/u);

    return JSON.stringify({
      action: 'final_answer',
      message: '我看了一轮，启动器页面没有推进，目标窗口也没有出现；现在先停在这里，避免重复点同一个按钮。',
      understanding: {
        blockedGoals: ['Example Game did not launch after click and wait'],
        completedGoals: ['clicked the Start button', 'waited and re-read the unchanged launcher state'],
        remainingGoals: [],
        successCriteria: 'Example Game window is visible or a concrete blocker is identified',
        userNeed: 'start Example Game from the launcher',
        verificationEvidence: [
          'The same launcher screen remained visible after waiting.',
          'The Example Game tile and Start button are still visible.',
          'No target game window launched.',
        ],
        verificationGaps: [],
        verificationStatus: 'blocked',
      },
    });
  },
  settings,
  sourceText: '/agent start Example Game from the launcher',
  toolExecutor: async (command) => {
    toolCommands.push(command);

    if (toolCommands.length === 1) {
      assert.equal(command.toolCall?.name, 'execute_desktop_observation');
      assert.equal(command.toolCall.input.action, 'summarize_visual_snapshot');
      return createImplicitLoadingResult();
    }

    if (toolCommands.length === 2) {
      assert.equal(command.toolCall?.name, 'execute_desktop_observation');
      assert.equal(command.toolCall.input.action, 'wait_and_observe');
      assert.equal(command.toolCall.input.recoveryPostActionState, 'loading');
      assert.equal(command.toolCall.input.query, 'Example Game');
      return createImplicitUnchangedResult();
    }

    assert.equal(toolCommands.length, 3);
    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    assert.equal(command.toolCall.input.action, 'locate_element');
    assert.equal(command.toolCall.input.recoveryPostActionState, 'unchanged');
    assert.equal(command.toolCall.input.query, 'Example Game');
    return createRecoveryReadResult();
  },
  userGoal: 'start Example Game from the launcher',
});

// A verified blocker after bounded recovery hands control back to the user.
assert.equal(result.status, 'needs-user');
assert.match(result.finalAnswer ?? '', /启动器页面没有推进/u);
assert.equal(modelCallCount, 1);
assert.equal(toolCommands.length, 3);
assert.match(result.continuation.historyLines.join('\n'), /postActionState=loading/u);
assert.match(result.continuation.historyLines.join('\n'), /postActionState=unchanged/u);

console.log('agent session v2 inferred post action recovery smoke ok');
