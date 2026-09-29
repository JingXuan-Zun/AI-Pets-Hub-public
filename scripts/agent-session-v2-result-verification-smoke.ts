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
    instruction: 'start the requested item inside the launcher',
    kind: 'tool-call',
    sourceText: '/agent start the requested item inside the launcher',
    toolCall: {
      goal: 'start the requested item inside the launcher',
      input: {
        stepsJson: JSON.stringify([
          {
            args: {
              action: 'click',
              button: 'left',
              x: 600,
              y: 420,
            },
            reason: 'Click the visible launcher start button.',
            tool: 'execute_desktop_input',
          },
        ]),
      },
      name: 'execute_desktop_sequence',
    },
  };
}

function createPostApprovalUnknownVerificationResult(): AgentChatCommandResult {
  return {
    observations: [
      'Game Launcher remained the focused window after the click.',
      'No target game/app window is visible yet.',
    ],
    ok: true,
    receipt: {
      evidenceLines: [
        'Visual post-action state: unknown',
        'Game Launcher remained focused.',
      ],
      status: 'unverified',
      summaryLines: [
        'Call: execute_desktop_observation summarize_visual_snapshot',
      ],
      title: 'Post approval visual verification',
      toolName: 'execute_desktop_observation',
      verification: 'The clicked launcher stayed visible; target launch is not confirmed.',
    },
    responseText: 'The launcher is still visible; target launch is not confirmed.',
    stateSummary: {
      missingEvidence: [
        'No evidence that the requested inner app/game opened.',
      ],
      observedState: [
        'Game Launcher remained the focused window after the click.',
      ],
      structuredEvidence: {
        status: 'unverified',
      },
      verificationEvidence: [
        'The clicked launcher stayed visible; target launch is not confirmed.',
      ],
    },
    verification: 'The clicked launcher stayed visible; target launch is not confirmed.',
  };
}

let modelCallCount = 0;
const toolCommands: AgentChatCommand[] = [];

const result = await runAgentProductionSession({
  approvedToolResult: {
    command: createSequenceCommand(),
    result: {
      observations: [
        'Launcher window was clicked.',
      ],
      ok: true,
      receipt: {
        evidenceLines: [
          'Step 1/1 tool=execute_desktop_input status=ok',
          'Focused window after click: Game Launcher',
        ],
        status: 'success',
        summaryLines: [
          'Call: execute_desktop_sequence',
          'Steps completed: 1',
        ],
        title: 'Agent desktop sequence',
        toolName: 'execute_desktop_sequence',
        verification: 'The click sequence completed, but the requested inner app launch was not confirmed.',
      },
      responseText: 'Desktop sequence completed 1/1 step(s).',
      stateSummary: {
        observedState: [
          'Game Launcher remained the focused window after the click.',
        ],
        verificationEvidence: [
          'The click primitive completed.',
        ],
      },
      verification: 'The desktop input primitive completed, but no target app/window evidence was observed.',
    },
  },
  maxSteps: 5,
  modelCaller: async ({ userInput }) => {
    modelCallCount += 1;

    if (modelCallCount === 1 && /Target app window observed: League of Legends/u.test(userInput)) {
      assert.match(userInput, /Current result verification signal:/u);
      assert.match(userInput, /post-approval verification result/u);
      assert.match(userInput, /latestToolKind=observation/u);
      assert.match(userInput, /No evidence that the requested inner app\/game opened/u);
      assert.match(userInput, /automatic recovery observation result/u);
      assert.doesNotMatch(userInput, /rejected unverified result final answer/u);
      return JSON.stringify({
        action: 'final_answer',
        message: 'The requested target application is now verified as launched.',
        understanding: {
          completedGoals: [
            'clicked the launcher start button',
            'verified the requested inner app/game launched',
          ],
          remainingGoals: [],
          successCriteria: 'the requested inner app/game is visibly launched or a matching app/window is observed',
          userNeed: 'start the requested item inside the launcher',
          verificationEvidence: [
            'Target app window observed: League of Legends',
          ],
          verificationGaps: [],
          verificationStatus: 'satisfied',
        },
      });
    }

    if (modelCallCount === 1) {
      assert.match(userInput, /Current result verification signal:/u);
      assert.match(userInput, /post-approval verification result/u);
      assert.match(userInput, /latestToolKind=observation/u);
      assert.match(userInput, /No evidence that the requested inner app\/game opened/u);
      return JSON.stringify({
        action: 'final_answer',
        message: 'The requested target application has launched.',
        understanding: {
          completedGoals: [
            'clicked the launcher start button',
          ],
          remainingGoals: [],
          successCriteria: 'the requested inner app/game is visibly launched or a matching app/window is observed',
          userNeed: 'start the requested item inside the launcher',
          verificationEvidence: [
            'The click primitive completed.',
          ],
          verificationGaps: [
            'No evidence that the requested inner app/game opened.',
          ],
          verificationStatus: 'unknown',
        },
      });
    }

    if (modelCallCount === 2) {
      assert.match(userInput, /rejected unverified result final answer/u);
      assert.match(userInput, /verificationStatus=unknown/u);
      assert.match(userInput, /verificationGaps=No evidence/u);
      return JSON.stringify({
        action: 'tool_call',
        args: {
          action: 'wait_and_observe',
          forceRefresh: true,
          includeVisual: true,
          query: 'requested game or app launched',
          waitMs: 2500,
        },
        reason: 'Need fresh evidence that the user-level requested app/game actually launched.',
        tool: 'execute_desktop_observation',
        understanding: {
          completedGoals: [
            'clicked the launcher start button',
          ],
          remainingGoals: [
            'verify the requested inner app/game launched',
          ],
          successCriteria: 'the requested inner app/game is visibly launched or a matching app/window is observed',
          userNeed: 'start the requested item inside the launcher',
          verificationEvidence: [
            'The click primitive completed.',
          ],
          verificationGaps: [
            'Need live post-click window or visual evidence.',
          ],
          verificationStatus: 'partial',
        },
      });
    }

    assert.match(userInput, /Target app window observed: League of Legends/u);
    return JSON.stringify({
      action: 'final_answer',
      message: 'The requested target application is now verified as launched.',
      understanding: {
        completedGoals: [
          'clicked the launcher start button',
          'verified the requested inner app/game launched',
        ],
        remainingGoals: [],
        successCriteria: 'the requested inner app/game is visibly launched or a matching app/window is observed',
        userNeed: 'start the requested item inside the launcher',
        verificationEvidence: [
          'Target app window observed: League of Legends',
        ],
        verificationGaps: [],
        verificationStatus: 'satisfied',
      },
    });
  },
  settings,
  sourceText: '/agent start the target application inside the launcher',
  toolExecutor: async (command) => {
    toolCommands.push(command);
    assert.equal(command.toolCall?.name, 'execute_desktop_observation');
    if (toolCommands.length === 1) {
      assert.equal(command.toolCall?.input.action, 'summarize_visual_snapshot');
      assert.match(String(command.toolCall?.input.question), /AgentRuntime post-action verification/u);

      return createPostApprovalUnknownVerificationResult();
    }

    assert.equal(command.toolCall?.input.action, 'wait_and_observe');

    return {
      observations: [
        'Target app window observed: League of Legends',
      ],
      ok: true,
      receipt: {
        evidenceLines: [
          'Target app window observed: League of Legends',
        ],
        status: 'success',
        summaryLines: [
          'Call: execute_desktop_observation wait_and_observe',
        ],
        title: 'Agent wait and observe',
        toolName: 'execute_desktop_observation',
        verification: 'Observed the requested target app window after waiting.',
      },
      responseText: 'Target app window observed: League of Legends',
      stateSummary: {
        observedState: [
          'Target app window observed: League of Legends',
        ],
        structuredEvidence: {
          finalWindow: {
            hwnd: 302,
            processName: 'league-client',
            title: 'League of Legends',
          },
          postActionState: 'launched',
          status: 'success',
          targetMatched: 'League of Legends',
        },
        verificationEvidence: [
          'Target app window observed: League of Legends',
        ],
      },
      verification: 'Observed the requested target app window after waiting.',
    };
  },
  userGoal: 'start the target application inside the launcher',
});

assert.equal(result.status, 'completed');
assert.equal(modelCallCount, 0);
assert.equal(toolCommands.length, 2);
assert.ok(result.finalAnswer.length > 0);
assert.match(result.continuation.historyLines.join('\n'), /automatic recovery observation/u);
assert.doesNotMatch(result.continuation.historyLines.join('\n'), /rejected unverified result final answer/u);

console.log('agent session v2 result verification smoke ok');
