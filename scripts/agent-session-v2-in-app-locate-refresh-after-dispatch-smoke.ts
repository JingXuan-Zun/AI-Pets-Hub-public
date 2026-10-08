import assert from 'node:assert/strict';

import {
  buildAgentPermissionRoute,
  createAgentRuntimeWaitingApprovalSnapshot,
  runAgentApprovedActionLifecycle,
  runAgentProductionSession,
  type AgentSessionV2ContinuationState,
  type AgentSessionV2ModelCaller,
  type AgentSessionV2ToolResultEntry,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

const previousLocateCommand = {
  capabilityId: 'desktop-observation',
  instruction: 'Locate in-app target',
  kind: 'tool-call' as const,
  sourceText: '/agent 打开 WeGame 里的英雄联盟',
  toolCall: {
    goal: 'Locate a safe login continuation button.',
    input: {
      action: 'locate_element',
      question: 'AgentSessionV2 in-app target locate The outer app/window is available, but login is required.',
      sourceQuery: 'WeGame',
      sourceType: 'window',
      targetDescription: '登录 inside WeGame',
      targetText: '登录',
    },
    name: 'locate_screen_elements' as const,
  },
  userGoal: '打开 WeGame 里的英雄联盟',
};

const approvedSequenceCommand = {
  capabilityId: 'desktop-sequence',
  instruction: 'Click safe login continuation',
  kind: 'tool-call' as const,
  sourceText: '/agent 打开 WeGame 里的英雄联盟',
  toolCall: {
    actionScope: {
      completion: 'intermediate' as const,
      subgoalId: 'intermediate:login',
      targetRef: '登录',
      taskGoalId: 'goal:打开-wegame-里的英雄联盟',
    },
    goal: 'Click safe login continuation.',
    input: {
      stepsJson: JSON.stringify([
        {
          args: {
            action: 'click',
            button: 'left',
            forceMouseEventFallback: true,
            x: 826,
            y: 446,
          },
          reason: 'Click the safe login continuation button.',
          tool: 'execute_desktop_input',
        },
      ]),
    },
    name: 'execute_desktop_sequence' as const,
  },
  userGoal: '打开 WeGame 里的英雄联盟',
};

const continuation: AgentSessionV2ContinuationState = {
  historyLines: [
    'Step 1 in-app target locate result: login continuation was located.',
  ],
  sourceText: '/agent 打开 WeGame 里的英雄联盟',
  steps: [],
  timing: null,
  traceEvents: [],
  toolResults: [
    {
      command: previousLocateCommand,
      result: {
        ok: true,
        responseText: 'Located 登录 at x=826 y=446.',
        stateSummary: {
          structuredEvidence: {
            confidence: 'high',
            coordinateConfidence: 'high',
            elementCenter: {
              coordinateSpace: 'native-screen',
              source: 'test',
              x: 826,
              y: 446,
            },
            finalWindow: {
              hwnd: 1001,
              processName: 'WeGame',
              title: 'WeGame',
            },
            postActionState: 'login_required',
            targetMatched: '登录',
            visualActionReadiness: 'ready',
          },
        },
      },
    } satisfies AgentSessionV2ToolResultEntry,
  ],
  userGoal: '打开 WeGame 里的英雄联盟',
};

let modelCallCount = 0;
const modelCaller: AgentSessionV2ModelCaller = async ({ userInput }) => {
  modelCallCount += 1;
  // The Runtime must refresh the in-app locate (plus its focused refinement)
  // after the approved dispatch before the model plans the next click.
  assert.equal(locateCallCount, 2, 'Runtime should refresh in-app locate after approved input dispatch before asking the model again.');
  assert.match(userInput, /in-app target locate result:/u);
  assert.match(userInput, /elementCenter=1200,700/u);
  return JSON.stringify({
    action: 'tool_call',
    args: {
      stepsJson: JSON.stringify([
        {
          args: { action: 'click', x: 1200, y: 700 },
          reason: 'Click the located League of Legends start button.',
          tool: 'execute_desktop_input',
        },
      ]),
    },
    reason: 'The refreshed in-app locate found the start button; request approval for the click.',
    tool: 'execute_desktop_sequence',
  });
};

let locateCallCount = 0;
const approvedCommandResult = {
  ok: true,
  responseText: 'Desktop sequence completed 1/1 step(s).',
  stateSummary: {
    actionEvidence: {
      outcome: 'changed' as const,
    },
  },
};
const approvedRoute = buildAgentPermissionRoute(approvedSequenceCommand);
assert.ok(approvedRoute.plan);
const approvedLifecycle = await runAgentApprovedActionLifecycle({
  command: approvedSequenceCommand,
  execute: async () => approvedCommandResult,
  waitingResult: createAgentRuntimeWaitingApprovalSnapshot({
    command: approvedSequenceCommand,
    continuation,
    plan: approvedRoute.plan,
  }),
});
const result = await runAgentProductionSession({
  approvedToolResult: {
    command: approvedSequenceCommand,
    result: approvedCommandResult,
  },
  continuation: approvedLifecycle.runtimeResult.continuation,
  maxSteps: 4,
  modelCaller,
  settings,
  sourceText: '/agent 打开 WeGame 里的英雄联盟',
  toolExecutor: async (command) => {
    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    locateCallCount += 1;
    return {
      ok: true,
      responseText: 'Located League of Legends launch button at x=1200 y=700.',
      stateSummary: {
        structuredEvidence: {
          confidence: 'high',
          coordinateConfidence: 'high',
          elementCenter: {
            coordinateSpace: 'native-screen',
            source: 'test',
            x: 1200,
            y: 700,
          },
          primaryAction: 'Start',
          relation: 'Start button belongs to League of Legends.',
          targetMatched: 'League of Legends',
          visualActionReadiness: 'ready',
        },
      },
      verification: 'League of Legends start button is visible.',
    };
  },
  userGoal: '打开 WeGame 里的英雄联盟',
});

assert.equal(modelCallCount, 1);
assert.equal(locateCallCount, 2);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /1200/u);
assert.match(result.continuation.historyLines.join('\n'), /in-app target locate result:[\s\S]*selected approval-required tool:/u);

console.log('agent session v2 in-app locate refresh after dispatch smoke ok');
