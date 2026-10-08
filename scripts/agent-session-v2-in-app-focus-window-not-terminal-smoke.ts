import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];
const sourceText = '/agent open League of Legends in WeGame';
const userGoal = 'open League of Legends in WeGame';

const approvedFocusCommand: AgentChatCommand = {
  capabilityId: 'app-launcher',
  instruction: userGoal,
  kind: 'tool-call',
  sourceText,
  toolCall: {
    goal: userGoal,
    input: {
      action: 'focus_window',
      fallbackToActiveWindow: false,
      hwnd: 5116050,
      target: 'WeGame',
    },
    name: 'execute_desktop_action',
  },
};

const approvedFocusResult: AgentChatCommandResult = {
  observations: [
    'Desktop action: focus_window',
    'Focus window query: WeGame',
    'Requested hwnd: 5116050',
  ],
  ok: true,
  receipt: {
    evidenceLines: [
      'Desktop action: focus_window',
      'Focus window query: WeGame',
      'Requested hwnd: 5116050',
    ],
    status: 'success',
    summaryLines: ['Call: execute_desktop_action focus_window'],
    title: 'Focus window',
    toolName: 'execute_desktop_action',
    verification: 'Window focused: browser',
  },
  responseText: 'Focus window succeeded: WeGame',
  stateSummary: {
    observedState: ['Focused window: browser title="WeGame"'],
    structuredEvidence: {
      finalWindow: {
        hwnd: 5116050,
        processName: 'browser',
        title: 'WeGame',
      },
      status: 'success',
      targetMatched: 'WeGame',
    },
    verificationEvidence: ['Window focused: browser title="WeGame"'],
  },
  verification: 'Window focused: browser',
};

let modelCallCount = 0;
const result = await runAgentProductionSession({
  approvedToolResult: {
    command: approvedFocusCommand,
    result: approvedFocusResult,
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
    if (command.toolCall?.name === 'observe_windows_and_apps') {
      assert.equal(command.toolCall.input.query, 'WeGame');
      return {
        observations: [
          'Windows/apps query: WeGame',
          'Observed apps/windows: installed=4, taskbarPinned=0, running=1.',
          'Active window: QQ - QQ @ Redmi 27 NQ',
          'Running sample: 1. browser pid=39488 hwnd=5116050 display="Redmi 27 NQ" title="WeGame"',
        ],
        ok: true,
        responseText: 'Observed apps/windows: installed=4, taskbarPinned=0, running=1. Active window: QQ - QQ @ Redmi 27 NQ Running sample: 1. browser pid=39488 hwnd=5116050 display="Redmi 27 NQ" title="WeGame"',
        stateSummary: {
          observedState: [
            'Running sample: 1. browser pid=39488 hwnd=5116050 display="Redmi 27 NQ" title="WeGame"',
          ],
          structuredEvidence: {
            finalWindow: {
              hwnd: 5116050,
              processName: 'browser',
              title: 'WeGame',
            },
            status: 'success',
            targetMatched: 'WeGame',
          },
          verificationEvidence: ['WeGame outer launcher window is visible.'],
        },
        verification: 'Window/app observation returned current installed entries, taskbar pins, windows, active window, and displays when requested.',
      };
    }

    if (command.toolCall?.name === 'locate_screen_elements') {
      assert.equal(command.toolCall.input.sourceQuery, 'WeGame');
      assert.equal(command.toolCall.input.hwnd, 5116050);
      assert.equal(command.toolCall.input.targetText, 'League of Legends');
      assert.match(String(command.toolCall.input.question), /exact source HWND 5116050/u);
      assert.match(String(command.toolCall.input.question), /AgentRuntime target resolution/u);
      return {
        observations: ['Visual target matched: League of Legends', 'Visual primary action: Start button'],
        ok: true,
        responseText: 'Located League of Legends inside WeGame.',
        stateSummary: {
          observedState: ['Visual target matched: League of Legends', 'Visual primary action: Start button'],
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
            primaryAction: 'Start button',
            relation: 'Start button belongs to League of Legends current detail page',
            selectionVerificationStatus: 'selected',
            status: 'success',
            targetMatched: 'League of Legends',
            visualActionReadiness: 'ready',
          },
          verificationEvidence: ['League of Legends internal target is visible.'],
        },
        verification: 'Internal target located.',
      };
    }

    throw new Error(`Unexpected tool: ${command.toolCall?.name ?? command.kind}`);
  },
  userGoal,
});

assert.equal(modelCallCount, 0);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.match(result.continuation.historyLines.join('\n'), /in-app target locate result/u);
assert.doesNotMatch(result.finalAnswer, /opened|launched|started|completed|success/u);

console.log('agent session v2 in-app focus window not terminal smoke ok');
