import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommandResult,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];
const sourceText = '/agent 打开 WeGame 里的英雄联盟';
const userGoal = '打开 WeGame 里的英雄联盟';

let modelCallCount = 0;
const executedTools: string[] = [];

function focusWindowResult(): AgentChatCommandResult {
  return {
    observations: [
      'Desktop action: focus_window',
      'Focus window query: WeGame',
      'Requested hwnd: 1576648',
    ],
    ok: true,
    receipt: {
      evidenceLines: [
        'Desktop action: focus_window',
        'Focus window query: WeGame',
        'Requested hwnd: 1576648',
      ],
      status: 'success',
      summaryLines: ['Call: execute_desktop_action focus_window'],
      title: 'Focus window',
      toolName: 'execute_desktop_action',
      verification: 'Window focused: WeGame',
    },
    responseText: 'Focus window succeeded: WeGame',
    stateSummary: {
      observedState: ['Focused window: browser title="WeGame"'],
      structuredEvidence: {
        finalWindow: {
          hwnd: 1576648,
          processName: 'browser',
          title: 'WeGame',
        },
        status: 'success',
        targetMatched: 'WeGame',
      },
      verificationEvidence: ['Window focused: browser title="WeGame"'],
    },
    verification: 'Window focused: WeGame',
  };
}

const result = await runAgentProductionSession({
  approvedToolResult: {
    command: {
      capabilityId: 'app-launcher',
      instruction: userGoal,
      kind: 'tool-call',
      sourceText,
      toolCall: {
        goal: userGoal,
        input: {
          action: 'focus_window',
          fallbackToActiveWindow: false,
          hwnd: 1576648,
          target: 'WeGame',
        },
        name: 'execute_desktop_action',
      },
    },
    result: focusWindowResult(),
  },
  maxSteps: 4,
  modelCaller: async () => {
    modelCallCount += 1;
    return JSON.stringify({
      action: 'final_answer',
      message: 'The runtime should have prepared approval before this model call.',
    });
  },
  settings,
  sourceText,
  toolExecutor: async (command) => {
    const toolName = command.toolCall?.name ?? command.kind;
    executedTools.push(toolName);

    if (command.toolCall?.name === 'observe_windows_and_apps') {
      assert.equal(command.toolCall.input.query, 'WeGame');
      return {
        observations: [
          'Windows/apps query: WeGame',
          'Observed apps/windows: running=1.',
          'Running sample: 1. browser pid=2516 hwnd=1576648 title="WeGame"',
        ],
        ok: true,
        responseText: 'Observed apps/windows: running=1. Running sample: 1. browser pid=2516 hwnd=1576648 title="WeGame"',
        stateSummary: {
          observedState: ['Running sample: browser hwnd=1576648 title="WeGame"'],
          structuredEvidence: {
            finalWindow: {
              hwnd: 1576648,
              processName: 'browser',
              title: 'WeGame',
            },
            status: 'success',
            targetMatched: 'WeGame',
          },
          verificationEvidence: ['WeGame outer launcher window is visible.'],
        },
        verification: 'Window/app observation returned current running windows.',
      };
    }

    if (command.toolCall?.name === 'locate_screen_elements') {
      assert.equal(command.toolCall.input.sourceQuery, 'WeGame');
      assert.equal(command.toolCall.input.hwnd, 1576648);
      assert.equal(command.toolCall.input.targetText, '英雄联盟');
      assert.match(String(command.toolCall.input.question), /exact source HWND 1576648/u);
      assert.match(String(command.toolCall.input.question), /AgentRuntime target resolution/u);
      return {
        observations: ['Visual target matched: 英雄联盟', 'Visual primary action: 启动 button'],
        ok: true,
        responseText: 'Located 英雄联盟 inside WeGame.',
        stateSummary: {
          observedState: ['Visual target matched: 英雄联盟', 'Visual primary action: 启动 button'],
          structuredEvidence: {
            confidence: 'high',
            coordinateConfidence: 'high',
            // Declared bounds let the actionable-area gate accept the point.
            elementBounds: {
              coordinateSpace: 'native-screen',
              height: 44,
              source: 'test',
              width: 150,
              x: 45,
              y: 338,
            },
            elementCenter: {
              coordinateSpace: 'native-screen',
              source: 'test',
              x: 120,
              y: 360,
            },
            launcherVerification: {
              detailMatchesTarget: true,
              primaryActionMatchesTarget: true,
              status: 'ready',
              targetSelected: true,
              targetVisible: true,
            },
            primaryAction: '启动 button',
            relation: '启动 button belongs to 英雄联盟 current detail page',
            selectionVerificationStatus: 'selected',
            status: 'success',
            targetMatched: '英雄联盟',
            visualActionReadiness: 'ready',
          },
          verificationEvidence: ['英雄联盟 internal target is visible.'],
        },
        verification: 'Internal target located.',
      };
    }

    throw new Error(`Unexpected tool: ${toolName}`);
  },
  userGoal,
});

assert.equal(modelCallCount, 0);
assert.deepEqual(executedTools, [
  'locate_screen_elements',
]);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.match(result.continuation.historyLines.join('\n'), /in-app target locate result/u);
assert.doesNotMatch(result.finalAnswer, /ready for character reply|opened|launched|completed|success/u);

console.log('agent session v2 in-app focus window model path smoke ok');
