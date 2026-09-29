import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

function createInputFieldResult() {
  return {
    observations: [
      'Desktop observation: inspect_window_ui',
      'Matched controls: Search type=Edit center=520,96 actions=value matchScore=100',
    ],
    ok: true,
    responseText: 'Inspected UI controls in Launcher. controls=5, matched=1, actionable=1',
    stateSummary: {
      observedState: ['Window UI query: Launcher', 'Target text: Search'],
      structuredEvidence: {
        actionCandidates: [
          {
            actions: ['value'],
            automationId: 'search-box',
            center: {
              coordinateSpace: 'native-screen',
              source: 'ui-automation',
              x: 520,
              y: 96,
            },
            confidence: 'high',
            controlType: 'Edit',
            description: 'Search id=search-box type=Edit actions=value depth=3',
            label: 'Search id=search-box type=Edit',
            name: 'Search',
            region: 'Edit',
            relation: 'UI Automation reports this text field supports ValuePattern.',
            source: 'ui-automation',
            window: {
              hwnd: 3003,
              processName: 'Launcher.exe',
              title: 'Launcher',
            },
          },
        ],
        confidence: 'high',
        coordinateConfidence: 'high',
        primaryAction: 'set value in Search input',
        relation: 'The target text matched an editable UI Automation control.',
        status: 'success',
        targetMatched: 'Search',
        visualActionReadiness: 'ready',
      },
      verificationEvidence: ['UI Automation returned a matched editable input.'],
    },
    verification: 'Window UI inspection returned an editable control.',
  };
}

const fillResult = await runAgentProductionSession({
  maxSteps: 3,
  modelCaller: async () => JSON.stringify({
    action: 'tool_call',
    args: {
      action: 'inspect_window_ui',
      query: 'Launcher',
      targetText: 'Search',
    },
    reason: 'Read UI Automation controls before filling the search field.',
    tool: 'execute_desktop_observation',
  }),
  settings,
  sourceText: '/agent �?Launcher 的搜索框输入 "Example Game"',
  toolExecutor: async (command: AgentChatCommand) => {
    assert.equal(command.toolCall?.name, 'execute_desktop_observation');
    assert.equal(command.toolCall.input.action, 'inspect_window_ui');
    return createInputFieldResult();
  },
  userGoal: '�?Launcher 的搜索框输入 "Example Game"',
});

assert.equal(fillResult.status, 'needs-approval');
assert.equal(fillResult.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
const fillStepsJson = String(fillResult.pendingApproval?.command.toolCall?.input.stepsJson);
assert.match(fillStepsJson, /interact_window_ui/u);
assert.match(fillStepsJson, /"uiAction":"set_value"/u);
assert.match(fillStepsJson, /"automationId":"search-box"/u);
assert.match(fillStepsJson, /"value":"Example Game"/u);
assert.doesNotMatch(fillStepsJson, /execute_desktop_input/u);

let missingValueModelCalls = 0;
let missingValueToolCalls = 0;
const missingValueResult = await runAgentProductionSession({
  maxSteps: 3,
  modelCaller: async ({ userInput }) => {
    missingValueModelCalls += 1;
    if (missingValueModelCalls === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: {
          action: 'inspect_window_ui',
          query: 'Launcher',
          targetText: 'Search',
        },
        reason: 'Read UI Automation controls before filling the search field.',
        tool: 'execute_desktop_observation',
      });
    }

    assert.match(userInput, /visualActionReadiness=ready/u);
    return JSON.stringify({
      action: 'ask_user',
      message: '要填进搜索框的内容还不明确，你想输入什么？',
      understanding: {
        blockedGoals: ['missing input value'],
        completedGoals: ['found editable search field'],
        remainingGoals: ['get the text to enter'],
        successCriteria: 'Fill the search field with the user-provided value.',
        userNeed: 'fill Launcher search field',
        verificationEvidence: ['UI Automation found an editable Search field.'],
        verificationGaps: ['Text value to enter is missing.'],
        verificationStatus: 'blocked',
      },
    });
  },
  settings,
  sourceText: '/agent �?Launcher 的搜索框输入',
  toolExecutor: async () => {
    missingValueToolCalls += 1;
    return createInputFieldResult();
  },
  userGoal: '�?Launcher 的搜索框输入',
});

assert.equal(missingValueToolCalls, 1);
assert.equal(missingValueModelCalls, 2);
assert.equal(missingValueResult.status, 'needs-user');
assert.equal(missingValueResult.pendingApproval, null);

function createDualActionInputFieldResult() {
  const result = createInputFieldResult();
  const candidate = result.stateSummary.structuredEvidence.actionCandidates[0];
  return {
    ...result,
    observations: [
      'Desktop observation: inspect_window_ui',
      'Matched controls: Search type=Edit center=520,96 actions=invoke,value matchScore=100',
    ],
    stateSummary: {
      ...result.stateSummary,
      structuredEvidence: {
        ...result.stateSummary.structuredEvidence,
        actionCandidates: [
          {
            ...candidate,
            actions: ['invoke', 'value'],
            description: 'Search id=search-box type=Edit actions=invoke,value depth=3',
          },
        ],
      },
    },
  };
}

const dualActionFillResult = await runAgentProductionSession({
  maxSteps: 3,
  modelCaller: async () => JSON.stringify({
    action: 'tool_call',
    args: {
      action: 'inspect_window_ui',
      query: 'Launcher',
      targetText: 'Search',
    },
    reason: 'Read UI Automation controls before filling the search field.',
    tool: 'execute_desktop_observation',
  }),
  settings,
  sourceText: '/agent �?Launcher 的搜索框输入 "Another Game"',
  toolExecutor: async (command: AgentChatCommand) => {
    assert.equal(command.toolCall?.name, 'execute_desktop_observation');
    assert.equal(command.toolCall.input.action, 'inspect_window_ui');
    return createDualActionInputFieldResult();
  },
  userGoal: '�?Launcher 的搜索框输入 "Another Game"',
});

assert.equal(dualActionFillResult.status, 'needs-approval');
const dualActionStepsJson = String(dualActionFillResult.pendingApproval?.command.toolCall?.input.stepsJson);
assert.match(dualActionStepsJson, /"uiAction":"set_value"/u);
assert.match(dualActionStepsJson, /"value":"Another Game"/u);
assert.doesNotMatch(dualActionStepsJson, /"uiAction":"invoke"/u);

console.log('agent session v2 window ui set value approval smoke ok');
