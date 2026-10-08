import assert from 'node:assert/strict';
import {
  parseAgentDecisionContract,
  prepareAgentDecisionToolInput,
  runAgentProductionSession,
  type AgentSessionV2ModelCaller,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';
import {
  assertSourceMatches,
  readProjectSources,
} from './smokeTestHarness.ts';

const {
  contract: contractSource,
  modelTurn: modelTurnSource,
  runtimeContract: runtimeContractSource,
  session: sessionSource,
  planning: planningSource,
} = readProjectSources({
  contract: 'src/agent/runtime/agentDecisionContract.ts',
  modelTurn: 'src/agent/runtime/agentModelDecisionRuntime.ts',
  runtimeContract: 'src/agent/runtime/agentDecisionContract.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
  planning: 'src/agent/productionSession/modelPlanningTurn.ts',
});
assertSourceMatches(sessionSource, /from '\.\/productionSession\/modelPlanningTurn'/u);
assertSourceMatches(sessionSource, /const \{ executeModelPlanningTurn \} = createAgentProductionModelPlanningTurn\(\{/u);
assertSourceMatches(sessionSource, /await executeModelPlanningTurn\(\{/u);

assertSourceMatches(runtimeContractSource, /export function parseAgentDecisionContract/u);
assertSourceMatches(runtimeContractSource, /export function prepareAgentDecisionToolInput/u);
assertSourceMatches(runtimeContractSource, /prepareAgentToolInput/u);
assertSourceMatches(planningSource, /runAgentModelDecisionTurn<AgentModelDecision>/u);
assertSourceMatches(sessionSource, /parseDecision: parseAgentDecisionContract/u);
assertSourceMatches(sessionSource, /prepareToolInput: prepareAgentDecisionToolInput/u);
assertSourceMatches(modelTurnSource, /options\.parseDecision\(modelResponse\)/u);
assertSourceMatches(sessionSource, /rejected invalid tool input/u);
assertSourceMatches(sessionSource, /Tool args are schema-validated before permission routing or execution/u);

const parsed = parseAgentDecisionContract(`
Here is the decision:
{
  "action": "tool_call",
  "tool": "observe_windows_and_apps",
  "args": { "query": "Chrome", "limit": "2" },
  "understanding": {
    "userNeed": "inspect Chrome",
    "verificationStatus": "unverified",
    "remainingGoals": "inspect current window"
  }
}
`);

assert.equal(parsed?.action, 'tool_call');
assert.equal(parsed?.tool, 'observe_windows_and_apps');
assert.equal(parsed?.understanding?.verificationStatus, 'unknown');
assert.deepEqual(parsed?.understanding?.remainingGoals, ['inspect current window']);

const preparedAliasInput = prepareAgentDecisionToolInput({
  args: {
    desktopAction: 'control_window',
    h: '600',
    target: 'Chrome',
    w: '800',
  },
  toolName: 'execute_desktop_action',
});
assert.equal(preparedAliasInput.ok, true);
assert.equal(preparedAliasInput.ok && preparedAliasInput.args.action, 'control_window');
assert.equal(preparedAliasInput.ok && preparedAliasInput.args.width, 800);
assert.equal(preparedAliasInput.ok && preparedAliasInput.args.height, 600);

const invalidInput = prepareAgentDecisionToolInput({
  args: {
    x: 120,
    y: 240,
  },
  toolName: 'execute_desktop_input',
});
assert.equal(invalidInput.ok, false);
assert.equal(invalidInput.ok === false && invalidInput.issue, 'invalid-args');
assert.match(invalidInput.ok === false ? invalidInput.error : '', /missing required parameter "action"/u);

const invalidSequenceInput = prepareAgentDecisionToolInput({
  args: {
    stepsJson: '[{"tool":"execute_desktop_action","args":{"action":"launch_local_app","target":"C:\\temp\\wegame.exe"}}]',
  },
  toolName: 'execute_desktop_sequence',
});
assert.equal(invalidSequenceInput.ok, false);
assert.equal(invalidSequenceInput.ok === false && invalidSequenceInput.issue, 'invalid-args');
assert.match(invalidSequenceInput.ok === false ? invalidSequenceInput.error : '', /stepsJson is not valid JSON/u);

let repairModelCalls = 0;
const repairModelCaller: AgentSessionV2ModelCaller = async ({ systemInstruction, userInput }) => {
  repairModelCalls += 1;
  assert.match(systemInstruction, /schema-validated/u);

  if (repairModelCalls === 1) {
    return JSON.stringify({
      action: 'tool_call',
      args: {
        x: 120,
        y: 240,
      },
      reason: 'Click the known target.',
      tool: 'execute_desktop_input',
      understanding: {
        remainingGoals: ['click the known target'],
        successCriteria: 'target is clicked after approval',
        userNeed: 'click the known target',
        verificationStatus: 'unknown',
      },
    });
  }

  assert.match(userInput, /rejected invalid tool input/u);
  assert.match(userInput, /missing required parameter "action"/u);
  return JSON.stringify({
    action: 'tool_call',
    args: {
      action: 'click',
      button: 'left',
      x: '120',
      y: '240',
    },
    reason: 'Corrected the tool args with the required action and numeric coordinates.',
    tool: 'execute_desktop_input',
    understanding: {
      remainingGoals: ['click the known target'],
      successCriteria: 'target is clicked after approval',
      userNeed: 'click the known target',
      verificationStatus: 'unknown',
    },
  });
};

const repairResult = await runAgentProductionSession({
  maxSteps: 3,
  modelCaller: repairModelCaller,
  settings: {} as PetConfig['settings'],
  sourceText: '/agent click the known target',
  toolExecutor: async () => {
    throw new Error('execute_desktop_input should stop for approval before execution');
  },
  userGoal: 'click the known target',
});

assert.equal(repairModelCalls >= 1 && repairModelCalls <= 2, true);
assert.equal(repairResult.status, 'needs-approval');
assert.equal(repairResult.taskState?.modelIterationCount, 2);
assert.equal(repairResult.taskState?.modelIterationLimit, 3);
assert.equal(repairResult.pendingApproval?.command.toolCall?.name, 'execute_desktop_input');
assert.equal(repairResult.pendingApproval?.command.toolCall?.input.action, 'click');
assert.equal(repairResult.pendingApproval?.command.toolCall?.input.x, 120);
assert.equal(repairResult.pendingApproval?.command.toolCall?.input.y, 240);

let parallelModelCalls = 0;
const parallelResult = await runAgentProductionSession({
  maxSteps: 3,
  modelCaller: async () => {
    parallelModelCalls += 1;
    if (parallelModelCalls === 1) {
      return JSON.stringify({
        action: 'tool_calls',
        reason: 'Gather current safe read-only state.',
        tools: [
          {
            args: {
              includeActiveWindow: true,
              limit: '2',
              query: 'Chrome',
            },
            reason: 'Read current Chrome window state.',
            tool: 'observe_windows_and_apps',
          },
        ],
        understanding: {
          remainingGoals: ['read current window'],
          userNeed: 'inspect Chrome',
          verificationStatus: 'unknown',
        },
      });
    }

    return JSON.stringify({
      action: 'final_answer',
      message: 'Current window state was read.',
      understanding: {
        completedGoals: ['read current window'],
        remainingGoals: [],
        successCriteria: 'window state was observed',
        userNeed: 'inspect Chrome',
        verificationEvidence: ['Observed apps/windows'],
        verificationGaps: [],
        verificationStatus: 'satisfied',
      },
    });
  },
  settings: {} as PetConfig['settings'],
  sourceText: '/agent inspect Chrome',
  toolExecutor: async (command) => {
    assert.equal(command.toolCall?.name, 'observe_windows_and_apps');
    assert.equal(command.toolCall?.input.limit, 2);
    return {
      observations: ['Observed apps/windows: Chrome active window found.'],
      ok: true,
      responseText: 'Observed apps/windows: Chrome active window found.',
      verification: 'Observed current window state.',
    };
  },
  userGoal: 'inspect Chrome',
});

assert.equal(parallelModelCalls >= 1 && parallelModelCalls <= 2, true);
assert.equal(parallelResult.status, 'completed');
assert.equal(parallelResult.toolResults[0]?.command.toolCall?.input.limit, 2);

console.log('agent session v2 decision contract smoke ok');
