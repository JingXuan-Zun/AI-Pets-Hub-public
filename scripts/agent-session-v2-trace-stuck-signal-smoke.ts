import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentSessionV2ContinuationState,
  type AgentSessionV2ModelCaller,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

function createToolCommand(toolName: string, input: Record<string, unknown>): AgentChatCommand {
  return {
    capabilityId: 'desktop-observation',
    instruction: 'trace stuck signal smoke',
    kind: 'tool-call',
    sourceText: '/agent trace stuck signal smoke',
    toolCall: {
      goal: 'trace stuck signal smoke',
      input,
      name: toolName as AgentChatCommand['toolCall']['name'],
    },
  };
}

const noOpCommand = createToolCommand('execute_desktop_input', {
  action: 'click',
  x: 120,
  y: 240,
});
const typeCommand = createToolCommand('execute_desktop_input', {
  action: 'type_text',
  text: 'abc',
});
const noOpResult: AgentChatCommandResult = {
  ok: true,
  receipt: {
    evidenceLines: ['actionEvidence outcome no-op'],
    status: 'success',
    stateSummary: {
      actionEvidence: {
        action: 'click',
        confidence: 0.42,
        diff: {
          changed: false,
          signals: ['cursor returned to target', 'screen hash unchanged'],
          summary: 'Click was sent, but no state change was detected.',
        },
        outcome: 'no-op',
        targetRef: {
          confidence: 'medium',
          kind: 'pixel',
          label: 'target button',
        },
        timestamp: Date.now(),
        tool: 'execute_desktop_input',
      },
    },
    summaryLines: ['Click sent'],
    title: 'execute_desktop_input',
    toolName: 'execute_desktop_input',
  },
  responseText: 'Click was sent, but no visible state changed.',
  stateSummary: {
    actionEvidence: {
      action: 'click',
      confidence: 0.42,
      diff: {
        changed: false,
        signals: ['cursor returned to target', 'screen hash unchanged'],
        summary: 'Click was sent, but no state change was detected.',
      },
      outcome: 'no-op',
      targetRef: {
        confidence: 'medium',
        kind: 'pixel',
        label: 'target button',
      },
      timestamp: Date.now(),
      tool: 'execute_desktop_input',
    },
  },
  verification: 'No visible state change after click.',
};
const uncertainTypeResult: AgentChatCommandResult = {
  ok: true,
  responseText: 'Text input sent, but completion is not proven.',
  stateSummary: {
    actionEvidence: {
      action: 'type_text',
      confidence: 0.45,
      diff: {
        changed: true,
        signals: ['visibleTextMaybeChanged=true'],
        summary: 'Text input was sent, but user-level completion is not proven.',
      },
      outcome: 'uncertain',
      snapshotProfile: 'light',
      targetRef: {
        confidence: 'medium',
        kind: 'uia',
        label: 'target input',
      },
      timestamp: Date.now(),
      tool: 'execute_desktop_input',
    },
  },
};

let noOpModelCalls = 0;
const noOpResultSession = await runAgentProductionSession({
  approvedToolResult: {
    command: noOpCommand,
    result: noOpResult,
  },
  continuation: {
    historyLines: [],
    sourceText: '/agent click the target button',
    steps: [],
    traceEvents: [],
    toolResults: [],
    userGoal: 'click the target button',
  } satisfies AgentSessionV2ContinuationState,
  maxSteps: 3,
  modelCaller: async ({ systemInstruction, userInput }) => {
    noOpModelCalls += 1;
    assert.match(systemInstruction, /Current trace stuck signal/u);
    assert.match(systemInstruction, /passive observability feedback/u);
    assert.match(userInput, /Current trace stuck signal:/u);
    assert.match(userInput, /reason=recent_action_evidence_not_completed/u);
    assert.match(userInput, /actionOutcome=no-op/u);
    assert.match(userInput, /changed=false/u);
    assert.match(userInput, /stuckSignalPrimaryReason=recent_action_evidence_not_completed/u);
    assert.match(userInput, /stuckSignalSeverity=medium/u);
    assert.match(userInput, /stuckSignalThresholdGuard=maxSignals=5/u);
    assert.match(userInput, /requiredReplan=The last action evidence does not prove user-level success/u);
    assert.match(userInput, /stuckSignalPolicy=This signal is advisory/u);
    return JSON.stringify({
      action: 'final_answer',
      message: 'action did not produce enough evidence',
      understanding: {
        blockedGoals: ['target button state did not change'],
        completedGoals: ['click primitive was sent'],
        remainingGoals: [],
        successCriteria: 'target state changes after click',
        userNeed: 'click the target button',
        verificationEvidence: ['actionEvidence outcome=no-op'],
        verificationGaps: ['state change evidence is missing'],
        verificationStatus: 'blocked',
      },
    });
  },
  settings,
  sourceText: '/agent click the target button',
  userGoal: 'click the target button',
});

assert.equal(noOpModelCalls, 1);
assert.equal(noOpResultSession.status, 'completed');

let repeatedWindowModelCalls = 0;
const repeatedWindowResultSession = await runAgentProductionSession({
  approvedToolResult: {
    command: typeCommand,
    result: uncertainTypeResult,
  },
  continuation: {
    historyLines: [],
    sourceText: '/agent click target then type abc',
    steps: [],
    traceEvents: [],
    toolResults: [
      {
        command: noOpCommand,
        result: noOpResult,
      },
      {
        command: typeCommand,
        result: uncertainTypeResult,
      },
      {
        command: noOpCommand,
        result: noOpResult,
      },
    ],
    userGoal: 'click target then type abc',
  } satisfies AgentSessionV2ContinuationState,
  maxSteps: 3,
  modelCaller: async ({ userInput }) => {
    repeatedWindowModelCalls += 1;
    assert.match(userInput, /Current trace stuck signal:/u);
    assert.match(userInput, /reason=repeated_action_outcome_window/u);
    assert.match(userInput, /windowSize=2/u);
    assert.match(userInput, /repeatCount=2/u);
    assert.match(userInput, /stuckSignalPrimaryReason=repeated_action_outcome_window/u);
    assert.match(userInput, /stuckSignalConfidence=0\.88/u);
    assert.match(userInput, /Treat this as advisory/u);
    assert.match(userInput, /stuckSignalPolicy=This signal is advisory/u);
    if (repeatedWindowModelCalls > 1) {
      assert.match(userInput, /rejected final answer without Evidence Engine authorization/u);
      return JSON.stringify({
        action: 'ask_user',
        message: 'The repeated action pattern has not verified completion. Please confirm the current target state.',
        understanding: {
          blockedGoals: ['repeated action/outcome pattern has not proven completion'],
          completedGoals: [],
          remainingGoals: ['confirm the current target state'],
          successCriteria: 'target state changes and text input is verified',
          userNeed: 'click target then type abc',
          verificationEvidence: ['trace stuck signal reason=repeated_action_outcome_window'],
          verificationGaps: ['need user confirmation or different evidence'],
          verificationStatus: 'blocked',
        },
      });
    }
    return JSON.stringify({
      action: 'final_answer',
      message: 'recent action/outcome pattern repeated',
      understanding: {
        blockedGoals: ['repeated action/outcome pattern has not proven completion'],
        completedGoals: [],
        remainingGoals: [],
        successCriteria: 'target state changes and text input is verified',
        userNeed: 'click target then type abc',
        verificationEvidence: ['trace stuck signal reason=repeated_action_outcome_window'],
        verificationGaps: ['need different evidence or a changed action'],
        verificationStatus: 'blocked',
      },
    });
  },
  settings,
  sourceText: '/agent click target then type abc',
  userGoal: 'click target then type abc',
});

assert.equal(repeatedWindowModelCalls, 2);
assert.equal(repeatedWindowResultSession.status, 'needs-user');

let repairModelCalls = 0;
const repairModelCaller: AgentSessionV2ModelCaller = async ({ userInput }) => {
  repairModelCalls += 1;

  if (repairModelCalls === 1) {
    return JSON.stringify({
      action: 'tool_call',
      args: {
        x: 120,
        y: 240,
      },
      reason: 'Click the target.',
      tool: 'execute_desktop_input',
      understanding: {
        remainingGoals: ['click target'],
        successCriteria: 'target clicked',
        userNeed: 'click target',
        verificationStatus: 'unknown',
      },
    });
  }

  assert.match(userInput, /Current trace stuck signal:/u);
  assert.match(userInput, /reason=recent_trace_rejection/u);
  assert.match(userInput, /status=invalid-tool-input/u);
  assert.match(userInput, /stuckSignalPrimaryReason=recent_trace_rejection/u);
  assert.match(userInput, /stuckSignalThresholdGuard=maxSignals=5/u);
  assert.match(userInput, /requiredReplan=Use the rejection as feedback/u);
  return JSON.stringify({
    action: 'tool_call',
    args: {
      action: 'click',
      x: 120,
      y: 240,
    },
    reason: 'Correct the rejected args.',
    tool: 'execute_desktop_input',
    understanding: {
      remainingGoals: ['click target'],
      successCriteria: 'target clicked',
      userNeed: 'click target',
      verificationStatus: 'unknown',
    },
  });
};

const repairResult = await runAgentProductionSession({
  maxSteps: 3,
  modelCaller: repairModelCaller,
  settings,
  sourceText: '/agent click target',
  toolExecutor: async () => {
    throw new Error('approval-required tool should pause before execution');
  },
  userGoal: 'click target',
});

assert.equal(repairModelCalls, 2);
assert.equal(repairResult.status, 'needs-approval');
assert.equal(repairResult.pendingApproval?.command.toolCall?.name, 'execute_desktop_input');

console.log('agent session v2 trace stuck signal smoke ok');
