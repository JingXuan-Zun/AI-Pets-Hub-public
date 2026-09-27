import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommandResult,
  type AgentSessionV2ModelCaller,
  type AgentSessionV2ProgressEvent,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

const observationProgressEvents: AgentSessionV2ProgressEvent[] = [];
let observationModelCalls = 0;
let observationToolCalls = 0;
const observationModelCaller: AgentSessionV2ModelCaller = async ({ userInput }) => {
  observationModelCalls += 1;

  if (observationModelCalls === 1) {
    return JSON.stringify({
      action: 'tool_call',
      args: {
        includeActiveWindow: true,
        limit: '1',
        query: 'Chrome',
      },
      reason: 'Read current window state.',
      tool: 'observe_windows_and_apps',
      understanding: {
        remainingGoals: ['observe Chrome'],
        successCriteria: 'Chrome window evidence is available',
        userNeed: 'inspect Chrome',
        verificationStatus: 'unknown',
      },
    });
  }

  assert.match(userInput, /Observed Chrome active window/u);
  return JSON.stringify({
    action: 'final_answer',
    message: 'observed Chrome',
    understanding: {
      completedGoals: ['observe Chrome'],
      remainingGoals: [],
      successCriteria: 'Chrome window evidence is available',
      userNeed: 'inspect Chrome',
      verificationEvidence: ['Observed Chrome active window'],
      verificationGaps: [],
      verificationStatus: 'satisfied',
    },
  });
};

const observationResult = await runAgentProductionSession({
  maxSteps: 3,
  modelCaller: observationModelCaller,
  onProgress: (event) => {
    observationProgressEvents.push(event);
  },
  settings,
  sourceText: '/agent inspect Chrome',
  toolExecutor: async (command) => {
    observationToolCalls += 1;
    assert.equal(command.toolCall?.name, 'observe_windows_and_apps');
    assert.equal(command.toolCall?.input.limit, 1);
    return {
      observations: ['Observed Chrome active window'],
      ok: true,
      responseText: 'Observed Chrome active window',
      verification: 'Chrome evidence available',
    };
  },
  userGoal: 'inspect Chrome',
});

assert.equal(observationResult.status, 'completed');
assert.equal(observationToolCalls, 1);
assert.equal(observationResult.continuation.traceEvents.length, observationResult.traceEvents.length);
assert.ok(observationProgressEvents.some((event) => event.continuation.traceEvents.length > 0));
assert.ok(observationResult.traceEvents.some((event) => (
  event.type === 'permission_routed'
  && event.tool === 'observe_windows_and_apps'
  && event.status === 'silent'
)));
assert.ok(observationResult.traceEvents.some((event) => (
  event.type === 'tool_started'
  && event.tool === 'observe_windows_and_apps'
)));
assert.ok(observationResult.traceEvents.some((event) => (
  event.type === 'tool_finished'
  && event.tool === 'observe_windows_and_apps'
  && event.status === 'success'
  && event.details?.responseText === 'Observed Chrome active window'
)));
assert.ok(observationResult.traceEvents.some((event) => (
  event.type === 'final_answer'
  && event.status === 'completed'
)));

let approvalModelCalls = 0;
const approvalResult = await runAgentProductionSession({
  maxSteps: 3,
  modelCaller: async ({ userInput }) => {
    approvalModelCalls += 1;

    if (approvalModelCalls === 1) {
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
          successCriteria: 'target is clicked',
          userNeed: 'click target',
          verificationStatus: 'unknown',
        },
      });
    }

    assert.match(userInput, /rejected invalid tool input/u);
    return JSON.stringify({
      action: 'tool_call',
      args: {
        action: 'click',
        button: 'left',
        x: '120',
        y: '240',
      },
      reason: 'Use valid click input.',
      tool: 'execute_desktop_input',
      understanding: {
        remainingGoals: ['click target'],
        successCriteria: 'target is clicked',
        userNeed: 'click target',
        verificationStatus: 'unknown',
      },
    });
  },
  settings,
  sourceText: '/agent click target',
  toolExecutor: async () => {
    throw new Error('approval-required input should not execute inside the session');
  },
  userGoal: 'click target',
});

assert.equal(approvalResult.status, 'needs-approval');
assert.equal(approvalModelCalls, 2);
assert.equal(approvalResult.pendingApproval?.command.toolCall?.name, 'execute_desktop_input');
assert.ok(approvalResult.traceEvents.some((event) => (
  event.type === 'decision_rejected'
  && event.status === 'invalid-tool-input'
  && event.tool === 'execute_desktop_input'
)));
assert.ok(approvalResult.traceEvents.some((event) => (
  event.type === 'permission_routed'
  && event.status === 'needs-approval'
  && event.tool === 'execute_desktop_input'
)));
assert.ok(approvalResult.traceEvents.some((event) => (
  event.type === 'approval_required'
  && event.status === 'needs-approval'
  && event.tool === 'execute_desktop_input'
)));

const approvedCommand = approvalResult.pendingApproval?.command;
assert.ok(approvedCommand);

const approvedToolResult: AgentChatCommandResult = {
  ok: true,
  receipt: {
    evidenceLines: ['actionEvidence outcome changed'],
    status: 'success',
    stateSummary: {
      actionEvidence: {
        action: 'click',
        after: {
          cursor: {
            label: 'cursor',
            x: 120,
            y: 240,
          },
          observedState: ['target clicked'],
        },
        before: {
          cursor: {
            label: 'cursor',
            x: 120,
            y: 240,
          },
          observedState: ['target visible'],
        },
        confidence: 0.88,
        diff: {
          changed: true,
          signals: ['target clicked'],
          summary: 'Target click changed the UI state.',
        },
        outcome: 'changed',
        targetRef: {
          bounds: {
            height: 10,
            width: 10,
            x: 115,
            y: 235,
          },
          confidence: 'high',
          kind: 'pixel',
          label: 'target',
        },
        timestamp: Date.now(),
        tool: 'execute_desktop_input',
      },
    },
    summaryLines: ['Clicked target'],
    title: 'execute_desktop_input',
    toolName: 'execute_desktop_input',
    verification: 'Target clicked',
  },
  responseText: 'Clicked target',
  stateSummary: {
    actionEvidence: {
      action: 'click',
      confidence: 0.88,
      diff: {
        changed: true,
        signals: ['target clicked'],
        summary: 'Target click changed the UI state.',
      },
      outcome: 'changed',
      targetRef: {
        confidence: 'high',
        kind: 'pixel',
        label: 'target',
      },
      timestamp: Date.now(),
      tool: 'execute_desktop_input',
    },
  },
  verification: 'Target clicked',
};

let resumeModelCalls = 0;
const resumeResult = await runAgentProductionSession({
  approvedToolResult: {
    command: approvedCommand,
    result: approvedToolResult,
  },
  continuation: approvalResult.continuation,
  maxSteps: 4,
  modelCaller: async ({ userInput }) => {
    resumeModelCalls += 1;
    assert.match(userInput, /actionOutcome=changed/u);
    return JSON.stringify({
      action: 'final_answer',
      message: 'click completed',
      understanding: {
        completedGoals: ['click target'],
        remainingGoals: [],
        successCriteria: 'target is clicked',
        userNeed: 'click target',
        verificationEvidence: ['actionOutcome=changed'],
        verificationGaps: [],
        verificationStatus: 'satisfied',
      },
    });
  },
  settings,
  sourceText: '/agent click target',
  userGoal: 'click target',
});

assert.equal(resumeModelCalls, 1);
assert.equal(resumeResult.status, 'completed');
assert.ok(resumeResult.traceEvents.length > approvalResult.traceEvents.length);
assert.ok(resumeResult.traceEvents.some((event) => (
  event.type === 'tool_finished'
  && event.tool === 'execute_desktop_input'
  && event.details?.source === 'approved-tool-result'
  && event.details?.actionOutcome === 'changed'
)));

console.log('agent session v2 trace smoke ok');
