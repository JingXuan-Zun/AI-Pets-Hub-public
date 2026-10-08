import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentStructuredToolRecoveryEvidence,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

function createToolCommand(name: AgentChatCommand['toolCall']['name'], input: Record<string, unknown>): AgentChatCommand {
  return {
    capabilityId: name === 'locate_screen_elements' ? 'desktop-observation' : 'app-launcher',
    instruction: 'click a visible launch control and continue after recovery evidence',
    kind: 'tool-call',
    sourceText: '/agent start the visible app from the launcher',
    toolCall: {
      goal: 'start the visible app from the launcher',
      input,
      name,
    },
  };
}

function createPostActionResult(recovery: AgentStructuredToolRecoveryEvidence): AgentChatCommandResult {
  return {
    ok: true,
    receipt: {
      evidenceLines: ['Post-action visual state: blocked'],
      status: 'unverified',
      summaryLines: ['Call: execute_desktop_sequence', 'Post-action visual state: blocked'],
      title: 'Sequence result',
      toolName: 'execute_desktop_sequence',
      verification: 'Post-sequence visual state is blocked.',
    },
    responseText: 'Clicked the launcher area, but the visible UI is blocked.',
    stateSummary: {
      missingEvidence: ['The click did not confirm the requested app was launched.'],
      observedState: ['Post-action visual state: blocked'],
      recommendedRecovery: ['postActionRecoveryStrategy=read-blocker | nextTool=locate_screen_elements'],
      structuredEvidence: {
        postActionRecovery: recovery,
        postActionState: 'blocked',
        status: 'unverified',
      },
    },
    verification: 'Post-sequence visual state is blocked.',
  };
}

let modelCallCount = 0;
const executedRecoveryCommands: AgentChatCommand[] = [];

const result = await runAgentProductionSession({
  approvedToolResult: {
    command: createToolCommand('execute_desktop_sequence', {
      postVerifyVisualQuery: 'Example Game',
      stepsJson: '[]',
    }),
    result: createPostActionResult({
      nextArgs: {
        action: 'describe_elements',
        forceRefresh: true,
        question: 'Read the visible blocker and any actionable controls.',
        targetDescription: 'visible blocker and actionable controls',
      },
      nextTool: 'locate_screen_elements',
      reason: 'Read the visible blocker before retrying.',
      strategy: 'read-blocker',
    }),
  },
  maxSteps: 4,
  modelCaller: async ({ systemInstruction, userInput }) => {
    modelCallCount += 1;
    assert.match(systemInstruction, /Current post-action recovery follow-up signal/u);
    assert.match(userInput, /Current post-action recovery follow-up signal/u);
    assert.match(userInput, /reason=post_action_recovery_observed/u);
    assert.match(userInput, /sourcePostActionState=blocked/u);
    assert.match(userInput, /target=Example Game/u);
    assert.match(userInput, /primaryAction=Start/u);
    assert.match(userInput, /visualActionReadiness=ready/u);
    assert.match(userInput, /nextStepRule=/u);
    assert.match(userInput, /approval-required execute_desktop_sequence/u);

    // The model gets the approval-ready recovery evidence and selects the
    // retry click, which pauses for approval.
    assert.equal(modelCallCount, 1);
    return JSON.stringify({
      action: 'tool_call',
      args: {
        stepsJson: JSON.stringify([
          {
            args: { action: 'click', x: 1440, y: 920 },
            reason: 'Retry on the Start control found by recovery.',
            tool: 'execute_desktop_input',
          },
        ]),
      },
      reason: 'Recovery found a clear Start control; request approval for the retry click.',
      tool: 'execute_desktop_sequence',
    });
  },
  settings,
  sourceText: '/agent start the visible app from the launcher',
  toolExecutor: async (command) => {
    executedRecoveryCommands.push(command);
    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    assert.equal(command.toolCall.input.forceRefresh, true);
    if (executedRecoveryCommands.length === 1) {
      assert.equal(command.toolCall.input.action, 'describe_elements');
      assert.match(String(command.toolCall.input.question), /AgentSessionV2 auto recovery observation/u);
    } else {
      // Bounded read-only focused refinement of the ready Start control.
      assert.equal(executedRecoveryCommands.length, 2);
      assert.match(String(command.toolCall.input.targetDescription), /; focused candidate: /u);
    }

    return {
      observations: [
        'Visible blocker text: The first click missed the Start control.',
        'Visual target matched: Example Game',
        'Visual primary action: Start',
        'Visual element center: x=1440 y=920',
      ],
      ok: true,
      receipt: {
        evidenceLines: ['Recovery observation found Start at screen coordinate 1440,920.'],
        status: 'success',
        summaryLines: ['Call: locate_screen_elements', 'Result: clear retry target found'],
        title: 'Post-action recovery observation',
        toolName: 'locate_screen_elements',
        verification: 'Start control is visible and actionable.',
      },
      responseText: 'Recovery observation found a clear Start control for Example Game.',
      stateSummary: {
        observedState: [
          'Visual target matched: Example Game',
          'Visual primary action: Start',
          'Visual element center: x=1440 y=920',
        ],
        structuredEvidence: {
          confidence: 'high',
          coordinateConfidence: 'high',
          elementCenter: {
            coordinateSpace: 'native-screen',
            source: 'test',
            x: 1440,
            y: 920,
          },
          elementRegion: 'lower-right launcher panel',
          primaryAction: 'Start',
          relation: 'Start control belongs to Example Game',
          status: 'success',
          targetMatched: 'Example Game',
          visualActionReadiness: 'ready',
        },
        verificationEvidence: ['Recovery observation found Start at screen coordinate 1440,920.'],
      },
      verification: 'Start control is visible and actionable.',
    };
  },
  userGoal: 'start the visible app from the launcher',
});

assert.equal(modelCallCount, 1);
assert.equal(executedRecoveryCommands.length, 2);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /execute_desktop_input/u);
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /1440/u);
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /920/u);
assert.match(result.continuation.historyLines.join('\n'), /selected approval-required tool:/u);
assert.match(result.continuation.historyLines.join('\n'), /automatic recovery observation result/u);

console.log('agent session v2 post-action replan smoke ok');
