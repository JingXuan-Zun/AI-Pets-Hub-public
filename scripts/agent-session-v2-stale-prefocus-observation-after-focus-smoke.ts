import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentSessionV2ContinuationState,
  type AgentSessionV2ToolResultEntry,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];
const sourceText = '/agent retry opening League of Legends inside WeGame';
const userGoal = 'retry opening League of Legends inside WeGame';

const staleObservation: AgentSessionV2ToolResultEntry = {
  command: {
    capabilityId: 'desktop-observation',
    instruction: userGoal,
    kind: 'tool-call',
    sourceText,
    toolCall: {
      goal: userGoal,
      input: { includeActiveWindow: true, includeRunningApps: true, query: 'WeGame' },
      name: 'observe_windows_and_apps',
    },
  },
  result: {
    ok: true,
    responseText: 'Active window: ChatGPT. Running sample: wegame hwnd=3541984 title="WeGame".',
    stateSummary: {
      structuredEvidence: {
        finalWindow: { hwnd: 3541984, processName: 'wegame', title: 'WeGame' },
        status: 'success',
        targetMatched: 'WeGame',
      },
    },
    verification: 'Window/app observation returned current running windows.',
  },
};

const continuation: AgentSessionV2ContinuationState = {
  historyLines: ['Observed WeGame before focus; active window was ChatGPT.'],
  sourceText,
  steps: [],
  timing: null,
  traceEvents: [],
  toolResults: [staleObservation],
  userGoal,
};

let modelCalled = false;
let locateCalled = false;
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
          hwnd: 3541984,
          includeWindows: true,
          pid: 38092,
          target: 'WeGame',
        },
        name: 'execute_desktop_action',
      },
    },
    result: {
      ok: true,
      receipt: {
        evidenceLines: ['Call: focus_window', 'Focused HWND: 3541984'],
        status: 'success',
        summaryLines: ['Call: focus_window'],
        title: 'Focus window',
        toolName: 'execute_desktop_action',
        verification: 'Window focused: wegame',
      },
      responseText: 'Focused matching window: WeGame.',
      stateSummary: {
        structuredEvidence: {
          finalWindow: { hwnd: 3541984, pid: 38092, processName: 'wegame', title: 'WeGame' },
          status: 'success',
          targetMatched: 'WeGame',
        },
      },
      verification: 'Window focused: wegame',
    },
  },
  continuation,
  maxSteps: 4,
  modelCaller: async () => {
    modelCalled = true;
    return JSON.stringify({ action: 'final_answer', message: 'incorrect premature final' });
  },
  settings,
  sourceText,
  toolExecutor: async (command) => {
    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    assert.equal(command.toolCall.input.hwnd, 3541984);
    assert.equal(command.toolCall.input.sourceId, 'window:3541984:');
    assert.equal(command.toolCall.input.sourceQuery, 'WeGame');
    assert.equal(command.toolCall.input.sourceType, 'window');
    assert.equal(command.toolCall.input.allowScreenFallback, false);
    locateCalled = true;
    return {
      ok: true,
      responseText: 'Located League of Legends Start button.',
      stateSummary: {
        structuredEvidence: {
          confidence: 'high',
          coordinateAuditStatus: 'coordinate_ok',
          coordinateConfidence: 'high',
          elementCenter: { coordinateSpace: 'native-screen', x: 1200, y: 700 },
          finalWindow: { hwnd: 3541984, processName: 'wegame', title: 'WeGame' },
          primaryAction: 'Start',
          relation: 'Start button belongs to League of Legends.',
          targetMatched: 'League of Legends',
          visualActionReadiness: 'ready',
        },
      },
      verification: 'League of Legends Start button is actionable.',
    };
  },
  userGoal,
});

assert.equal(modelCalled, false);
assert.equal(locateCalled, true);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /1200/u);

console.log('agent session v2 stale pre-focus observation after focus smoke ok');
