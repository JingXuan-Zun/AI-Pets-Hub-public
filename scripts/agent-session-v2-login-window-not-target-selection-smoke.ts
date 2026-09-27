import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';
import assert from 'node:assert/strict';

const settings = {} as PetConfig['settings'];
const sourceText = '/agent open League of Legends inside WeGame';
const userGoal = 'open League of Legends inside WeGame';

function createLocateCommand(): AgentChatCommand {
  return {
    capabilityId: 'desktop-observation',
    instruction: sourceText,
    kind: 'tool-call',
    sourceText,
    toolCall: {
      goal: userGoal,
      input: {
        action: 'describe_elements',
        forceRefresh: true,
        query: 'League of Legends',
        targetText: 'Login Sign in',
      },
      name: 'locate_screen_elements',
    },
  };
}

function createLoginWindowLocateResult(): AgentChatCommandResult {
  return {
    ok: true,
    receipt: {
      evidenceLines: [
        'Visual target matched: League of Legends login window',
        'Visual post-action state: login_required',
        'Visual action readiness: ready',
      ],
      status: 'unverified',
      summaryLines: ['Call: locate_screen_elements describe_elements'],
      title: 'Screen element observation',
      toolName: 'locate_screen_elements',
      verification: 'Login window is visible, but saved credentials are not confirmed filled.',
    },
    responseText: [
      'Visual summary: League of Legends login window is centered.',
      'Visual target matched: League of Legends login window',
      'Visual target candidate 1: League of Legends login window | confidence=high | centerRatio=0.500,0.470',
      'Visual primary action: click login button, but credentials are not confirmed filled, do not click yet',
      'Visual action candidate 1: orange login button | confidence=high | centerRatio=0.500,0.570',
      'Visual element center: x=1280 y=821 source=elementCenterRatio',
      'Visual target/action relation: login button belongs to the League of Legends login window',
      'Launcher verification: status=needs-relation targetVisible=true selected=unknown detailMatches=unknown actionMatches=false',
      'Visual post-action state: login_required',
      'Visual action readiness: ready',
      'Visual confidence: 0.8',
    ].join('\n'),
    stateSummary: {
      missingEvidence: ['Saved credentials are not confirmed filled.'],
      observedState: [
        'League of Legends login window is visible.',
        'Orange login button is visible.',
      ],
      recommendedRecovery: ['Locate safe login continuation control.'],
      structuredEvidence: {
        confidence: 'medium',
        coordinateConfidence: 'high',
        elementCenter: {
          coordinateSpace: 'native-screen',
          source: 'visual',
          x: 1280,
          y: 821,
        },
        launcherVerification: {
          detailMatchesTarget: null,
          primaryActionMatchesTarget: false,
          status: 'needs-relation',
          targetMatched: 'League of Legends login window',
          targetSelected: null,
          targetVisible: true,
        },
        postActionState: 'login_required',
        primaryAction: 'click login button, but credentials are not confirmed filled, do not click yet',
        relation: 'login button belongs to the League of Legends login window',
        status: 'unverified',
        targetCandidates: [
          {
            center: {
              coordinateSpace: 'native-screen',
              source: 'visual',
              x: 1280,
              y: 677,
            },
            confidence: 'high',
            label: 'League of Legends login window',
            selected: false,
            source: 'visual',
          },
        ],
        targetMatched: 'League of Legends login window',
        visualActionReadiness: 'ready',
      },
      verificationEvidence: [
        'Login window and login button are visible.',
      ],
    },
    verification: 'Login window is visible, but saved credentials are not confirmed filled.',
  };
}

let modelCallCount = 0;

const result = await runAgentProductionSession({
  maxSteps: 2,
  modelCaller: async () => {
    modelCallCount += 1;
    if (modelCallCount === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: createLocateCommand().toolCall.input,
        reason: 'Inspect the visible login state.',
        tool: 'locate_screen_elements',
      });
    }

    return JSON.stringify({
      action: 'ask_user',
      message: 'Login is visible, but saved credentials are not confirmed filled.',
      reason: 'Do not click the login window itself as a target-selection recovery.',
      understanding: {
        blockedGoals: ['credentials are not confirmed filled'],
        completedGoals: ['located League of Legends login window'],
        remainingGoals: ['complete login', 'launch League of Legends'],
        successCriteria: 'League of Legends launches through WeGame',
        userNeed: userGoal,
        verificationEvidence: ['login_required state is visible'],
        verificationGaps: ['saved credential state is unknown'],
        verificationStatus: 'blocked',
      },
    });
  },
  settings,
  sourceText,
  toolExecutor: async (command: AgentChatCommand) => {
    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    return createLoginWindowLocateResult();
  },
  userGoal,
});

const history = result.continuation.historyLines.join('\n');

assert.notEqual(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.doesNotMatch(String(result.pendingApproval?.command.toolCall?.input.stepsJson ?? ''), /League of Legends login window/u);
assert.doesNotMatch(history, /select the target item first/i);
assert.doesNotMatch(history, /Click the visually located target item/u);
assert.match(history, /postActionState=login_required/u);

console.log('agent session v2 login window not target selection smoke ok');
