import assert from 'node:assert/strict';
import {
  createAgentAttemptedActionCoverage,
  createAgentRequestedActionCoverage,
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  actionCoverage: actionCoverageSource,
  actionCoverageCompatibility: actionCoverageCompatibilitySource,
  actionCoverageRejectionSignal: actionCoverageRejectionSignalSource,
  session: sessionSource,
} = readProjectSources({
  actionCoverage: 'src/agent/runtime/agentActionCoverage.ts',
  actionCoverageCompatibility: 'src/agent/runtime/agentActionCoverage.ts',
  actionCoverageRejectionSignal: 'src/agent/runtime/agentFinalAnswerRejectionSignals.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
});

assert.match(
  actionCoverageSource,
  /export type AgentRequestedActionKind/u,
  'Action coverage kinds should live in the Runtime action coverage module',
);

assert.match(
  actionCoverageSource,
  /export function createAgentRequestedActionCoverage/u,
  'Requested action coverage classification should live in the Runtime action coverage module',
);

assert.match(
  actionCoverageSource,
  /export function createAgentAttemptedActionCoverage/u,
  'Attempted action coverage classification should live in the Runtime action coverage module',
);

assert.doesNotMatch(
  sessionSource,
  /export type AgentSessionV2RequestedActionKind/u,
  'AgentSessionV2 should consume action coverage kinds instead of defining them inline',
);

assert.match(
  sessionSource,
  /rejected incomplete action coverage final answer/u,
  'AgentSessionV2 should reject final answers that skip requested action types',
);

const chineseInAppCoverage = createAgentRequestedActionCoverage({
  dependencies: {
    hasDesktopOrganizationRequest: () => false,
    hasWindowMoveToDisplayRequest: () => false,
  },
  sourceText: '/agent 打开 WeGame 里的英雄联盟',
  userGoal: '打开 WeGame 里的英雄联盟',
});
assert.equal(
  chineseInAppCoverage.has('in-app-action'),
  true,
  'Chinese "open B inside A" requests should be classified as in-app actions',
);
// Opening the outer app is tracked as its own requested step; the in-app
// action stays required alongside it (see focusOnlyCoverage below).
assert.equal(
  chineseInAppCoverage.has('open-or-launch'),
  true,
  'Chinese in-app requests should also track opening the outer app',
);

const chineseSequentialInAppCoverage = createAgentRequestedActionCoverage({
  dependencies: {
    hasDesktopOrganizationRequest: () => false,
    hasWindowMoveToDisplayRequest: () => false,
  },
  sourceText: '/agent 打开 WeGame 并启动英雄联盟',
  userGoal: '打开 WeGame 并启动英雄联盟',
});
assert.equal(
  chineseSequentialInAppCoverage.has('in-app-action'),
  true,
  'Chinese "open A and launch B" requests should require an in-app action, not only outer app launch',
);

const englishLauncherInAppCoverage = createAgentRequestedActionCoverage({
  dependencies: {
    hasDesktopOrganizationRequest: () => false,
    hasWindowMoveToDisplayRequest: () => false,
  },
  sourceText: '/agent Open League of Legends using WeGame launcher',
  userGoal: 'Open League of Legends using WeGame launcher',
});
assert.equal(
  englishLauncherInAppCoverage.has('in-app-action'),
  true,
  'English "open B using A launcher/client" requests should require an in-app action, not only outer app launch',
);

const englishViaAppInAppCoverage = createAgentRequestedActionCoverage({
  dependencies: {
    hasDesktopOrganizationRequest: () => false,
    hasWindowMoveToDisplayRequest: () => false,
  },
  sourceText: '/agent Open League of Legends via WeGame',
  userGoal: 'Open League of Legends via WeGame',
});
assert.equal(
  englishViaAppInAppCoverage.has('in-app-action'),
  true,
  'English "open B via A" requests should require an in-app action even when A is not suffixed with launcher/client',
);

const focusOnlyCoverage = createAgentAttemptedActionCoverage({
  dependencies: {
    getPostActionState: () => '',
    isAutoRecoveryReadCommand: () => false,
    isAutoRecoveryWaitCommand: () => false,
    isPostApprovalVerificationCommand: () => false,
    isVerifiedTargetWindowObservation: () => false,
  },
  toolResults: [
    {
      command: {
        capabilityId: 'app-launcher',
        instruction: 'open Launcher and start Game',
        kind: 'tool-call',
        sourceText: '/agent open Launcher and start Game',
        toolCall: {
          goal: 'open Launcher and start Game',
          input: {
            action: 'focus_window',
            target: 'Launcher',
          },
          name: 'execute_desktop_action',
        },
      },
      result: {
        ok: true,
        responseText: 'Window focused: Launcher',
        verification: 'Window focused: Launcher',
      },
    },
  ],
});
assert.equal(focusOnlyCoverage.has('open-or-launch'), true);
assert.equal(
  focusOnlyCoverage.has('in-app-action'),
  false,
  'Focusing the outer app window must not count as the requested in-app action.',
);

const unverifiedSequenceCoverage = createAgentAttemptedActionCoverage({
  dependencies: {
    getPostActionState: () => '',
    isAutoRecoveryReadCommand: () => false,
    isAutoRecoveryWaitCommand: () => false,
    isPostApprovalVerificationCommand: () => false,
    isVerifiedTargetWindowObservation: () => false,
  },
  toolResults: [
    {
      command: {
        capabilityId: 'desktop',
        instruction: 'open League of Legends inside WeGame',
        kind: 'tool-call',
        sourceText: '/agent open League of Legends inside WeGame',
        toolCall: {
          goal: 'open League of Legends inside WeGame',
          input: {
            postVerifyQuery: 'open League of Legends inside WeGame',
            stepsJson: JSON.stringify([
              {
                args: {
                  action: 'click',
                  x: 2202,
                  y: 1339,
                },
                tool: 'execute_desktop_input',
              },
            ]),
          },
          name: 'execute_desktop_sequence',
        },
      },
      result: {
        ok: true,
        receipt: {
          evidenceLines: [
            'Desktop sequence completed all steps in order.',
            'Post-sequence verification: Tool returned, but user-level verification evidence is insufficient.',
          ],
          status: 'unverified',
          summaryLines: ['Call: execute_desktop_sequence'],
          title: 'Agent desktop sequence',
          toolName: 'execute_desktop_sequence',
          verification: 'Post-sequence verification did not confirm League of Legends launched.',
        },
        responseText: 'Desktop sequence completed 1/1 step(s). Post-sequence desktop state observation was inconclusive.',
        stateSummary: {
          missingEvidence: [
            'Post-sequence observation did not verify the requested final desktop state.',
          ],
          structuredEvidence: {
            confidence: 'low',
            launcherVerification: {
              detailMatchesTarget: null,
              primaryActionMatchesTarget: null,
              reason: 'Primary action ownership is not confirmed for the requested target.',
              status: 'needs-relation',
              targetSelected: null,
              targetVisible: true,
            },
            status: 'unverified',
            targetMatched: 'WeGame',
            visualActionReadiness: 'ready',
          },
          verificationEvidence: [
            'Tool returned, but user-level verification evidence is insufficient.',
          ],
        },
        verification: 'Tool returned, but user-level verification evidence is insufficient.',
      },
    },
  ],
});
assert.equal(unverifiedSequenceCoverage.has('desktop-input'), true);
assert.equal(
  unverifiedSequenceCoverage.has('in-app-action'),
  false,
  'A completed click sequence with needs-relation/postVerify gaps must not count as completing the requested in-app action.',
);

const settings = {} as PetConfig['settings'];
const sourceText = '/agent open League of Legends inside Riot Client';
const userGoal = 'open League of Legends inside Riot Client';

const approvedOpenCommand: AgentChatCommand = {
  capabilityId: 'app-launcher',
  instruction: userGoal,
  kind: 'tool-call',
  sourceText,
  toolCall: {
    goal: userGoal,
    input: {
      action: 'launch_local_app',
      target: 'Riot Client',
    },
    name: 'execute_desktop_action',
  },
};

const approvedOpenResult: AgentChatCommandResult = {
  ok: true,
  receipt: {
    evidenceLines: [
      'Window opened: Riot Client',
    ],
    status: 'success',
    summaryLines: [
      'Call: execute_desktop_action launch_local_app',
    ],
    title: 'Open app',
    toolName: 'execute_desktop_action',
    verification: 'Riot Client window is open.',
  },
  responseText: 'Opened Riot Client.',
  stateSummary: {
    observedState: [
      'Window opened: Riot Client',
    ],
    structuredEvidence: {
      status: 'success',
      targetMatched: 'Riot Client',
    },
    verificationEvidence: [
      'Riot Client window is open.',
    ],
  },
  verification: 'Riot Client window is open.',
};

function createPostApprovalOuterAppVerificationResult(): AgentChatCommandResult {
  return {
    observations: [
      'Visual target matched: Riot Client',
      'Riot Client launcher window is visible.',
      'No League of Legends launch/play/start confirmation is visible yet.',
    ],
    ok: true,
    responseText: 'Riot Client is visible, but the internal League of Legends launch action is not confirmed.',
    stateSummary: {
      missingEvidence: [
        'The internal League of Legends launch control has not been identified or clicked.',
      ],
      observedState: [
        'Visual target matched: Riot Client',
        'Riot Client launcher window is visible.',
      ],
      structuredEvidence: {
        status: 'success',
        targetMatched: 'Riot Client',
      },
      verificationEvidence: [
        'Riot Client launcher window is visible.',
      ],
    },
    verification: 'Only the launcher window is confirmed; the internal app action is still unverified.',
  };
}

let modelCallCount = 0;
const toolCommands: AgentChatCommand[] = [];

const result = await runAgentProductionSession({
  approvedToolResult: {
    command: approvedOpenCommand,
    result: approvedOpenResult,
  },
  maxSteps: 5,
  modelCaller: async ({ userInput }) => {
    modelCallCount += 1;

    // The Runtime has already located the in-app control (plus a read-only
    // focused refinement); the model only selects the approval-gated click.
    assert.match(userInput, /in-app target locate result:/u);
    assert.match(userInput, /target=League of Legends/u);
    assert.match(userInput, /elementCenter=1440,920/u);
    return JSON.stringify({
      action: 'tool_call',
      args: {
        stepsJson: JSON.stringify([
          {
            args: {
              action: 'click',
              x: 1440,
              y: 920,
            },
            reason: 'Click the located League of Legends Play button.',
            tool: 'execute_desktop_input',
          },
        ]),
      },
      reason: 'Opening the launcher alone did not satisfy the in-app action; click the located launch control.',
      tool: 'execute_desktop_sequence',
      understanding: {
        completedGoals: [
          'open Riot Client',
        ],
        remainingGoals: [
          'launch League of Legends inside Riot Client',
        ],
        successCriteria: 'League of Legends is launched or a concrete blocker is proven',
        userNeed: 'open League of Legends inside Riot Client',
        verificationEvidence: [
          'Riot Client window is open.',
        ],
        verificationGaps: [
          'The internal League of Legends launch control has not been clicked yet.',
        ],
        verificationStatus: 'partial',
      },
    });
  },
  settings,
  sourceText,
  toolExecutor: async (command) => {
    toolCommands.push(command);
    if (toolCommands.length === 1) {
      if (command.toolCall?.name === 'execute_desktop_observation') {
        assert.equal(command.toolCall.input.action, 'summarize_visual_snapshot');
        assert.equal(command.toolCall.input.query, 'Riot Client');
        assert.match(String(command.toolCall.input.question), /AgentRuntime post-action verification/u);

        return createPostApprovalOuterAppVerificationResult();
      }

      assert.equal(command.toolCall?.name, 'locate_screen_elements');
      assert.match(String(command.toolCall.input.query ?? command.toolCall.input.sourceQuery), /Riot Client/u);
      assert.match(String(command.toolCall.input.targetDescription), /League of Legends|Riot Client/u);
    }

    if (toolCommands.length > 1) {
      assert.equal(command.toolCall?.name, 'locate_screen_elements');
      assert.match(String(command.toolCall.input.query ?? command.toolCall.input.sourceQuery), /Riot Client/u);
      assert.match(String(command.toolCall.input.targetDescription), /League of Legends|Riot Client/u);
    }

    return {
      observations: [
        'Visual target matched: League of Legends',
        'Visual primary action: Play button',
        'Visual element center: x=1440 y=920',
        'Visual action readiness: ready',
      ],
      ok: true,
      responseText: 'Located League of Legends and its Play button inside Riot Client.',
      stateSummary: {
        observedState: [
          'Visual target matched: League of Legends',
          'Visual primary action: Play button',
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
          primaryAction: 'Play button',
          relation: 'Play button belongs to League of Legends',
          status: 'success',
          targetMatched: 'League of Legends',
          visualActionReadiness: 'ready',
        },
        verificationEvidence: [
          'League of Legends Play button is visible at x=1440 y=920.',
        ],
      },
      verification: 'The in-app launch control is visible and actionable.',
    };
  },
  userGoal,
});

assert.equal(
  modelCallCount,
  1,
  'approved outer-app launch with missing in-app coverage should locate through ActionRuntime before the model selects the click',
);
assert.deepEqual(toolCommands.map((command) => command.toolCall?.name), [
  'locate_screen_elements',
  'locate_screen_elements',
]);
assert.match(String(toolCommands[1]?.toolCall?.input.targetDescription), /; focused candidate: /u);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /execute_desktop_input/u);
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /1440/u);
assert.match(result.continuation.historyLines.join('\n'), /Approved tool lifecycle decision:[\s\S]*status=needs-recovery[\s\S]*reason=missing-requested-coverage/u);
assert.match(result.continuation.historyLines.join('\n'), /in-app target locate/u);
assert.match(result.continuation.historyLines.join('\n'), /selected approval-required tool:\ntool=execute_desktop_sequence/u);
assert.doesNotMatch(result.continuation.historyLines.join('\n'), /target-stale/u);

console.log('agent session v2 continuous action coverage smoke ok');
