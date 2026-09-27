import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

const previousStepsJson = JSON.stringify([
  {
    args: {
      action: 'click',
      x: 1440,
      y: 920,
    },
    reason: 'First click at the visible Start control.',
    tool: 'execute_desktop_input',
  },
]);

function createSequenceCommand(stepsJson: string): AgentChatCommand {
  return {
    capabilityId: 'app-launcher',
    instruction: 'start the visible app from the launcher',
    kind: 'tool-call',
    sourceText: '/agent start the visible app from the launcher',
    toolCall: {
      goal: 'start the visible app from the launcher',
      input: {
        postVerifyVisualQuery: 'Example Game launched',
        stepsJson,
      },
      name: 'execute_desktop_sequence',
    },
  };
}

function createBlockedSequenceResult(): AgentChatCommandResult {
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
    responseText: 'Clicked the Start control, but the target was not confirmed launched.',
    stateSummary: {
      missingEvidence: ['The previous click did not confirm the app launched.'],
      observedState: ['Post-action visual state: blocked'],
      recommendedRecovery: ['postActionRecoveryStrategy=read-blocker | nextTool=locate_screen_elements'],
      structuredEvidence: {
        postActionRecovery: {
          nextArgs: {
            action: 'describe_elements',
            forceRefresh: true,
            question: 'Read the visible blocker and actionable controls.',
            targetDescription: 'visible blocker and actionable controls',
          },
          nextTool: 'locate_screen_elements',
          reason: 'Read blocker before retrying.',
          strategy: 'read-blocker',
        },
        postActionState: 'blocked',
        status: 'unverified',
      },
    },
    verification: 'Post-sequence visual state is blocked.',
  };
}

let modelCallCount = 0;
let recoveryToolCount = 0;

const result = await runAgentProductionSession({
  approvedToolResult: {
    command: createSequenceCommand(previousStepsJson),
    result: createBlockedSequenceResult(),
  },
  maxSteps: 5,
  modelCaller: async ({ userInput }) => {
    modelCallCount += 1;

    assert.match(userInput, /rejected repeated unverified action retry/u);
    assert.match(userInput, /previousPostActionState=blocked/u);
    assert.match(userInput, /same action primitive already ran/u);

    return JSON.stringify({
      action: 'tool_call',
      args: {
        postVerifyVisualQuery: 'Example Game launched',
        stepsJson: JSON.stringify([
          {
            args: {
              action: 'click',
              x: 1460,
              y: 930,
            },
            reason: 'Retry with adjusted coordinates from recovery evidence.',
            tool: 'execute_desktop_input',
          },
        ]),
      },
      reason: 'The repeated primitive was rejected, so retry with adjusted coordinates.',
      tool: 'execute_desktop_sequence',
      understanding: {
        blockedGoals: [],
        completedGoals: ['read post-action recovery evidence', 'changed retry coordinates'],
        remainingGoals: ['launch Example Game'],
        successCriteria: 'Example Game is launched',
        userNeed: 'start Example Game from launcher',
        verificationEvidence: ['The retry coordinates differ from the unverified attempt.'],
        verificationGaps: ['Needs user approval before executing adjusted retry.'],
        verificationStatus: 'partial',
      },
    });
  },
  settings,
  sourceText: '/agent start the visible app from the launcher',
  toolExecutor: async (command) => {
    recoveryToolCount += 1;
    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    return {
      observations: [
        'Visible blocker text: first click did not activate.',
        'Visual target matched: Example Game',
        'Visual primary action: Start',
        'Visual element center: x=1440 y=920',
      ],
      ok: true,
      receipt: {
        evidenceLines: ['Recovery evidence confirms the first click target was still visible.'],
        status: 'success',
        summaryLines: ['Call: locate_screen_elements', 'Result: blocker read'],
        title: 'Post-action recovery observation',
        toolName: 'locate_screen_elements',
        verification: 'Start control is visible but launch is not confirmed.',
      },
      responseText: 'Recovery evidence read.',
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
          primaryAction: 'Start',
          status: 'success',
          targetMatched: 'Example Game',
          visualActionReadiness: 'ready',
        },
        verificationEvidence: ['Recovery evidence confirms the first click target was still visible.'],
      },
      verification: 'Start control is visible but launch is not confirmed.',
    };
  },
  userGoal: 'start Example Game from launcher',
});

assert.equal(recoveryToolCount, 1);
assert.equal(modelCallCount, 1);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /1460/u);
assert.doesNotMatch(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /1440[^]*920/u);
assert.match(result.continuation.historyLines.join('\n'), /rejected repeated unverified action retry/u);

console.log('agent session v2 post-action retry memory smoke ok');
