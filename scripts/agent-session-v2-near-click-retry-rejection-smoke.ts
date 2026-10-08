import { strict as assert } from 'node:assert';

import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];
const sourceText = '/agent Open League of Legends inside WeGame';
const userGoal = 'Open League of Legends inside WeGame';

function createClickCommand(action: 'click' | 'double_click', x: number, y: number): AgentChatCommand {
  return {
    capabilityId: 'desktop-input',
    instruction: userGoal,
    kind: 'tool-call',
    sourceText,
    toolCall: {
      goal: userGoal,
      input: {
        action,
        coordinateSpace: 'native-screen',
        x,
        y,
      },
      name: 'execute_desktop_input',
    },
  };
}

const unchangedClickResult: AgentChatCommandResult = {
  ok: true,
  receipt: {
    evidenceLines: [
      'Input replay visual delta: changed=false changedRatio=0 meanDiff=0',
      'UI changed: false',
    ],
    status: 'unverified',
    summaryLines: ['Call: execute_desktop_input click'],
    title: 'Click',
    toolName: 'execute_desktop_input',
    verification: 'Click was sent, but the UI stayed unchanged.',
  },
  responseText: 'Click sent, but the UI was unchanged.',
  stateSummary: {
    missingEvidence: ['No launched target window was observed.'],
    recommendedRecovery: ['Do not retry the same click unchanged; re-locate or diagnose no effect first.'],
    structuredEvidence: {
      inputReplayPreview: {
        uiChanged: false,
      },
      postActionRecovery: {
        nextTool: 'locate_screen_elements',
        reason: 'Need fresher target/action relation evidence before another click.',
        strategy: 're-locate-target',
      },
      postActionState: 'unchanged',
      status: 'unverified',
    },
    verificationEvidence: ['UI changed: false'],
  },
  verification: 'Click was sent, but the UI stayed unchanged.',
};

let modelCalls = 0;
const result = await runAgentProductionSession({
  maxSteps: 3,
  modelCaller: async () => {
    modelCalls += 1;
    return JSON.stringify({
      action: 'tool_call',
      // Same primitive a few pixels from the unchanged click: a near-repeat
      // that must be rejected. (Changing the primitive, e.g. to double_click,
      // is an allowed escalation.)
      args: {
        action: 'click',
        coordinateSpace: 'native-screen',
        x: 1206,
        y: 820,
      },
      reason: 'Try clicking the same visible start button again.',
      tool: 'execute_desktop_input',
    });
  },
  settings,
  sourceText,
  toolExecutor: async () => {
    throw new Error('near repeated click should be rejected before approval/execution');
  },
  userGoal,
  continuation: {
    historyLines: [],
    sourceText,
    steps: [],
    toolResults: [{
      command: createClickCommand('click', 1200, 817),
      result: unchangedClickResult,
    }],
    traceEvents: [],
    userGoal,
  },
});

assert.ok(modelCalls <= 2, `expected loop guard to stop repeated near-click quickly, got ${modelCalls} model calls`);
assert.notEqual(result.status, 'needs-approval');
const historyText = result.continuation.historyLines.join('\n');
assert.match(historyText, /rejected repeated unverified action retry|loop guard/u);
assert.match(historyText, /Do not ask the user to approve the exact same primitive again/u);

console.log('agent session v2 near-click retry rejection smoke ok');
