import assert from 'node:assert/strict';
import { runAgentProductionSession, type AgentSessionV2ModelCaller } from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

let modelCallCount = 0;
const userInputs: string[] = [];
const modelCaller: AgentSessionV2ModelCaller = async ({ userInput }) => {
  modelCallCount += 1;
  userInputs.push(userInput);

  if (modelCallCount === 1) {
    return JSON.stringify({
      action: 'tool_call',
      args: {
        action: 'locate_element',
        sourceQuery: 'WeGame',
        sourceType: 'window',
        targetDescription: 'login button inside WeGame',
        targetText: '登录',
      },
      reason: 'Locate the WeGame login button before clicking.',
      tool: 'locate_screen_elements',
      understanding: {
        completedGoals: [],
        remainingGoals: ['click the WeGame login button'],
        successCriteria: 'WeGame login click is dispatched and verified, or a concrete blocker is found',
        userNeed: 'log in to WeGame',
        verificationEvidence: [],
        verificationGaps: ['Login button coordinate is not known yet.'],
        verificationStatus: 'partial',
      },
    });
  }

  // After the bounded focused refinements confirm the ready login button, the
  // model selects the click, which must pause for approval.
  assert.equal(modelCallCount, 2);
  assert.match(userInput, /elementCenter=1280,806/u);
  return JSON.stringify({
    action: 'tool_call',
    args: {
      stepsJson: JSON.stringify([
        {
          args: {
            action: 'click',
            button: 'left',
            x: 1280,
            y: 806,
          },
          reason: 'Click the located WeGame login button.',
          tool: 'execute_desktop_input',
        },
      ]),
      postVerify: true,
      postVerifyVisualQuery: 'WeGame login state changed or login blocker is visible',
    },
    reason: 'The login button is located and actionable; request approval for the click dispatch.',
    tool: 'execute_desktop_sequence',
    understanding: {
      completedGoals: ['found WeGame login button'],
      remainingGoals: ['click WeGame login button and verify result'],
      successCriteria: 'WeGame login click is dispatched and verified, or a concrete blocker is found',
      userNeed: 'log in to WeGame',
      verificationEvidence: ['Login button coordinate is available.'],
      verificationGaps: ['Click has not been dispatched yet.'],
      verificationStatus: 'partial',
    },
  });
};

const result = await runAgentProductionSession({
  maxSteps: 4,
  modelCaller,
  settings,
  sourceText: '/agent click the WeGame login button',
  toolExecutor: async (command) => {
    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    return {
      observations: [
        'Visual target matched: WeGame login button',
        'Visual primary action: login button',
        'Visual element center: x=1280 y=806',
        'Visual action readiness: ready',
      ],
      ok: true,
      responseText: 'Located WeGame login button at x=1280 y=806.',
      stateSummary: {
        observedState: [
          'Visual target matched: WeGame login button',
          'Visual element center: x=1280 y=806',
        ],
        structuredEvidence: {
          confidence: 'high',
          coordinateConfidence: 'high',
          elementCenter: {
            coordinateSpace: 'native-screen',
            source: 'test',
            x: 1280,
            y: 806,
          },
          relation: 'Login button belongs to WeGame login panel',
          status: 'success',
          targetMatched: 'WeGame login button',
          visualActionReadiness: 'ready',
        },
        verificationEvidence: [
          'WeGame login button is visible and actionable at x=1280 y=806.',
        ],
      },
      verification: 'The WeGame login button is visible and actionable.',
    };
  },
  userGoal: 'click the WeGame login button',
});

assert.equal(modelCallCount, 2);
assert.equal(result.status, 'needs-approval');
assert.match(
  String(result.pendingApproval?.command.toolCall?.name),
  /execute_desktop_input|execute_desktop_sequence/u,
);
assert.match(JSON.stringify(result.pendingApproval?.command.toolCall?.input ?? {}), /1280/u);
assert.match(result.continuation.historyLines.join('\n'), /selected approval-required tool:/u);
assert.equal(result.debug?.v4TaskShadow?.classification, 'approval_pending');
assert.equal(result.debug.v4TaskShadow.context.currentState, 'waiting_approval');
assert.equal(
  result.debug.v4TaskShadow.events.some((event) => event.kind === 'approval-required'),
  true,
);
assert.equal(
  userInputs.some((input) => /v4TaskShadow|AgentTaskRuntimeV4/u.test(input)),
  false,
);

console.log('agent session v2 locate-ready final to dispatch smoke ok');
