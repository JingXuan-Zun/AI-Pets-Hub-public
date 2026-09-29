import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentSessionV2ModelCaller,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';
import {
  assertSourceDoesNotMatch,
  assertSourceMatches,
  readProjectSources,
} from './smokeTestHarness.ts';

const {
  sessionSource,
  shadowAdapterSource,
} = readProjectSources({
  sessionSource: 'src/agent/agentProductionSessionImplementation.ts',
  shadowAdapterSource: 'src/agent/agentTaskRuntimeV4SessionV2ShadowAdapter.ts',
});

assertSourceMatches(
  sessionSource,
  /v4TaskShadow\?: AgentTaskRuntimeV4SessionV2ShadowResult/u,
  'AgentSessionV2 debug info should expose V4 task shadow.',
);
assertSourceMatches(
  sessionSource,
  /createAgentTaskRuntimeV4SessionV2Shadow\(/u,
  'AgentSessionV2 should create V4 task shadow debug info.',
);
assertSourceMatches(
  shadowAdapterSource,
  /target_resolved_without_dispatch/u,
  'V4 shadow should classify target-resolved runs that never dispatched input.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /historyLines\.push\([^)]*v4TaskShadow|createAgentSessionV2ModelInput\([^)]*v4TaskShadow/isu,
  'V4 task shadow output should not be written into history or model input.',
);

const settings = {} as PetConfig['settings'];
const latestRuntimeShadow = (diagnostics: Array<{
  category: string;
  payload: { details?: Record<string, unknown> | null; status?: string | null; summary: string };
}> | null | undefined) => (
  [...(diagnostics ?? [])].reverse().find((diagnostic) => diagnostic.category === 'runtime-shadow')
);

const finalOnly = await runAgentProductionSession({
  modelCaller: async () => JSON.stringify({
    action: 'final_answer',
    message: 'final only',
  }),
  settings,
  sourceText: '/agent final only',
  userGoal: 'final only',
});
assert.equal(finalOnly.status, 'completed');
assert.equal(finalOnly.debug?.v4TaskShadow?.classification, 'no_tool_evidence');
assert.equal(finalOnly.debug.v4TaskShadow.context.currentState, 'initialized');
assert.equal(latestRuntimeShadow(finalOnly.diagnostics)?.payload.status, 'no_tool_evidence');
assert.equal(finalOnly.traceEvents.some((event) => event.type === 'runtime_shadow'), false);
assert.equal('debug' in finalOnly.continuation, false);
assert.doesNotMatch(JSON.stringify(finalOnly.continuation), /v4TaskShadow|AgentTaskRuntimeV4/u);

let locateOnlyCallCount = 0;
const locateOnlyModel: AgentSessionV2ModelCaller = async ({ userInput }) => {
  locateOnlyCallCount += 1;
  assert.doesNotMatch(userInput, /v4TaskShadow|AgentTaskRuntimeV4/u);
  if (locateOnlyCallCount === 1) {
    return JSON.stringify({
      action: 'tool_call',
      args: {
        action: 'locate_element',
        question: 'Find login button',
        sourceQuery: 'WeGame',
        sourceType: 'window',
        targetText: '登录',
      },
      reason: 'Locate login button before action.',
      tool: 'locate_screen_elements',
    });
  }

  return JSON.stringify({
    action: 'final_answer',
    message: 'located login only',
  });
};

const locateOnly = await runAgentProductionSession({
  maxSteps: 2,
  modelCaller: locateOnlyModel,
  settings,
  sourceText: '/agent locate login button',
  toolExecutor: async () => ({
    ok: true,
    receipt: {
      status: 'success',
    },
    stateSummary: {
      structuredEvidence: {
        targetMatched: '登录',
        visualActionReadiness: 'ready',
      },
    },
    verification: 'Visual action readiness: ready',
  }),
  userGoal: 'Locate login button in WeGame',
});

assert.equal(locateOnly.debug?.v4TaskShadow?.classification, 'target_resolved_without_dispatch');
assert.equal(locateOnly.debug.v4TaskShadow.context.currentState, 'target_resolved');
assert.equal(locateOnly.debug.v4TaskShadow.events.some((event) => event.kind === 'target-resolved'), true);
assert.equal(locateOnly.debug.v4TaskShadow.events.some((event) => event.kind === 'action-dispatched'), false);
assert.equal(latestRuntimeShadow(locateOnly.diagnostics)?.payload.status, 'target_resolved_without_dispatch');
assert.match(latestRuntimeShadow(locateOnly.diagnostics)?.payload.summary ?? '', /target was found, but no in-app dispatch\/click was executed/u);
assert.equal(locateOnly.traceEvents.filter((event) => event.type === 'runtime_shadow').length, 0);
assert.equal('debug' in locateOnly.continuation, false);
assert.doesNotMatch(JSON.stringify(locateOnly.continuation), /v4TaskShadow|AgentTaskRuntimeV4/u);

let dispatchCallCount = 0;
const dispatchModel: AgentSessionV2ModelCaller = async ({ userInput }) => {
  dispatchCallCount += 1;
  assert.doesNotMatch(userInput, /v4TaskShadow|AgentTaskRuntimeV4/u);
  if (dispatchCallCount === 1) {
    return JSON.stringify({
      action: 'tool_call',
      args: {
        stepsJson: JSON.stringify([
          {
            args: {
              stepsJson: JSON.stringify([{ action: 'click', x: 1200, y: 700 }]),
            },
            tool: 'execute_desktop_input',
          },
        ]),
      },
      reason: 'Click login button.',
      tool: 'execute_desktop_sequence',
    });
  }

  return JSON.stringify({
    action: 'final_answer',
    message: 'clicked login',
  });
};

const approvalPending = await runAgentProductionSession({
  maxSteps: 2,
  modelCaller: dispatchModel,
  settings,
  sourceText: '/agent click login button',
  toolExecutor: async () => ({
    assessment: {
      evidence: [],
      status: 'unverified',
      summary: 'Mouse click dispatched but UI unchanged',
    },
    ok: true,
    stateSummary: {
      structuredEvidence: {
        postActionState: 'unchanged',
      },
    },
    verification: 'Mouse click dispatched but UI unchanged',
  }),
  userGoal: 'Click login button in WeGame',
});

assert.equal(approvalPending.debug?.v4TaskShadow?.classification, 'approval_pending');
assert.equal(approvalPending.debug.v4TaskShadow.context.currentState, 'waiting_approval');
assert.equal(latestRuntimeShadow(approvalPending.diagnostics)?.payload.status, 'approval_pending');

const approvedSequenceCommand = {
  instruction: 'Click login button.',
  kind: 'tool-call' as const,
  sourceText: '/agent click login button',
  toolCall: {
    input: {
      stepsJson: JSON.stringify([
        {
          args: {
            action: 'click',
            x: 1200,
            y: 700,
          },
          tool: 'execute_desktop_input',
        },
      ]),
    },
    name: 'execute_desktop_sequence' as const,
  },
};

const dispatched = await runAgentProductionSession({
  approvedToolResult: {
    command: approvedSequenceCommand,
    result: {
      assessment: {
        evidence: [],
        status: 'unverified',
        summary: 'Mouse click dispatched but UI unchanged',
      },
      ok: true,
      stateSummary: {
        structuredEvidence: {
          postActionState: 'unchanged',
        },
      },
      verification: 'Mouse click dispatched but UI unchanged',
    },
  },
  maxSteps: 1,
  modelCaller: async ({ userInput }) => {
    assert.doesNotMatch(userInput, /v4TaskShadow|AgentTaskRuntimeV4/u);
    return JSON.stringify({
      action: 'final_answer',
      message: 'click result observed',
    });
  },
  settings,
  sourceText: '/agent click login button',
  userGoal: 'Click login button in WeGame',
});

assert.equal(dispatched.debug?.v4TaskShadow?.classification, 'input_dispatched_unverified');
assert.equal(dispatched.debug.v4TaskShadow.context.currentState, 'collecting_evidence');
assert.equal(dispatched.debug.v4TaskShadow.events.some((event) => event.kind === 'action-dispatched'), true);
assert.equal(latestRuntimeShadow(dispatched.diagnostics)?.payload.status, 'input_dispatched_unverified');
assert.equal(latestRuntimeShadow(dispatched.diagnostics)?.payload.details?.state, 'collecting_evidence');
assert.match(latestRuntimeShadow(dispatched.diagnostics)?.payload.summary ?? '', /input was dispatched, but the outcome was not verified/u);

console.log('agent session v2 v4 task shadow debug smoke ok');
