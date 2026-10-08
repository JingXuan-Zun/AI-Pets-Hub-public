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
  session: sessionSource,
  shadowMode: shadowModeSource,
} = readProjectSources({
  session: 'src/agent/agentProductionSessionImplementation.ts',
  shadowMode: 'src/agent/agentSessionV3PilotShadowMode.ts',
});

assertSourceMatches(sessionSource, /v3PilotShadow\?: AgentSessionV2V3PilotShadowOptions/u, 'AgentSessionV2 should accept v3 pilot shadow options.');
assertSourceMatches(sessionSource, /debug\?: AgentSessionV2DebugInfo/u, 'AgentSessionV2 should expose debug info.');
assertSourceMatches(sessionSource, /runAgentSessionV3PilotShadowEventList/u, 'AgentSessionV2 should run v3 pilot shadow event list when enabled.');
assertSourceMatches(shadowModeSource, /export function runAgentSessionV3PilotShadowEventList/u, 'V3 pilot shadow mode should export event-list runner.');
assertSourceDoesNotMatch(
  sessionSource,
  /historyLines\.push\([^)]*v3PilotShadow|createAgentSessionV2ModelInput\([^)]*v3PilotShadow/isu,
  'v3 pilot shadow output should not be written into history or model input.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'AgentSessionV2 v3 shadow wiring should not encode a fixed tool chain.',
);

const settings = {} as PetConfig['settings'];

const defaultOffResult = await runAgentProductionSession({
  modelCaller: async () => JSON.stringify({
    action: 'final_answer',
    message: 'shadow disabled final',
  }),
  settings,
  sourceText: '/agent answer without shadow',
  userGoal: 'answer without shadow',
});

assert.equal(defaultOffResult.status, 'completed');
assert.equal(defaultOffResult.debug?.v3PilotShadow, undefined);
assert.equal(defaultOffResult.debug?.v4TaskShadow?.classification, 'no_tool_evidence');
assert.equal('debug' in defaultOffResult.continuation, false);

const finalShadowResult = await runAgentProductionSession({
  modelCaller: async () => JSON.stringify({
    action: 'final_answer',
    message: 'shadow enabled final',
    reason: 'The answer is already known.',
  }),
  settings,
  sourceText: '/agent answer with shadow',
  userGoal: 'answer with shadow',
  v3PilotShadow: {
    debugSummary: {
      enabled: true,
      includeReasons: true,
    },
    enabled: true,
  },
});

assert.equal(finalShadowResult.status, 'completed');
assert.equal(finalShadowResult.finalAnswer, 'shadow enabled final');
assert.equal(finalShadowResult.debug?.v3PilotShadow?.status, 'observed');
assert.equal(finalShadowResult.debug.v3PilotShadow.result?.status, 'terminal');
assert.equal(finalShadowResult.debug.v3PilotShadow.result.state.terminal?.status, 'completed');
assert.deepEqual(finalShadowResult.debug.v3PilotShadow.result.transitions.map((transition) => transition.event.type), [
  'start',
  'model-decision-accepted',
]);
assert.match(
  finalShadowResult.debug.v3PilotShadow.debugSummaryText ?? '',
  /^AgentSessionV3Pilot status=terminal phase=done terminal=completed recoveries=0 transitions=2/mu,
);
assert.equal('debug' in finalShadowResult.continuation, false);
assert.equal(
  finalShadowResult.continuation.diagnostics?.some((diagnostic) => (
    diagnostic.authority === 'diagnostic-only'
    && diagnostic.category === 'runtime-pilot'
  )),
  true,
);
assert.doesNotMatch(JSON.stringify({
  historyLines: finalShadowResult.continuation.historyLines,
  steps: finalShadowResult.continuation.steps,
  toolResults: finalShadowResult.continuation.toolResults,
  traceEvents: finalShadowResult.continuation.traceEvents,
}), /AgentSessionV3Pilot|v3PilotShadow/u);
assert.doesNotMatch(finalShadowResult.continuation.historyLines.join('\n'), /AgentSessionV3Pilot|v3PilotShadow/u);

let toolModelCallCount = 0;
const toolModelInputs: string[] = [];
const toolModelCaller: AgentSessionV2ModelCaller = async ({ userInput }) => {
  toolModelCallCount += 1;
  toolModelInputs.push(userInput);
  if (toolModelCallCount === 1) {
    return JSON.stringify({
      action: 'tool_call',
      args: {
        includeActiveWindow: true,
        query: 'current window',
      },
      reason: 'Need current window evidence.',
      tool: 'observe_windows_and_apps',
    });
  }

  assert.match(userInput, /tool result/u);
  assert.doesNotMatch(userInput, /AgentSessionV3Pilot|v3PilotShadow/u);
  return JSON.stringify({
    action: 'final_answer',
    message: 'active window observed',
    reason: 'The tool evidence is enough.',
    understanding: {
      completedGoals: ['read active window'],
      remainingGoals: [],
      successCriteria: 'active window evidence was observed',
      userNeed: 'read active window with shadow',
      verificationEvidence: ['Active window observed.'],
      verificationGaps: [],
      verificationStatus: 'satisfied',
    },
  });
};

const toolShadowResult = await runAgentProductionSession({
  modelCaller: toolModelCaller,
  settings,
  sourceText: '/agent what is the current active window with shadow',
  toolExecutor: async () => ({
    ok: true,
    responseText: 'Active window result',
    verification: 'Active window observed.',
  }),
  userGoal: 'what is the current active window with shadow',
  v3PilotShadow: {
    debugSummary: {
      enabled: true,
      includeReasons: true,
    },
    enabled: true,
  },
});

// The successful read-only observation ends the run without another model
// turn; the shadow should still reach a completed terminal from it.
assert.equal(toolShadowResult.status, 'completed');
assert.equal(toolShadowResult.finalAnswer, 'Active window result');
assert.equal(toolModelCallCount, 1);
assert.equal(toolShadowResult.debug?.v3PilotShadow?.status, 'observed');
assert.equal(toolShadowResult.debug.v3PilotShadow.result?.status, 'terminal');
assert.equal(toolShadowResult.debug.v3PilotShadow.result.state.terminal?.status, 'completed');
assert.deepEqual(toolShadowResult.debug.v3PilotShadow.result.transitions.map((transition) => transition.event.type), [
  'start',
  'model-decision-accepted',
  'command-prepared',
  'transaction-finished',
  'evaluation-completed',
]);
assert.match(
  toolShadowResult.debug.v3PilotShadow.debugSummaryText ?? '',
  /4\. execute_transaction --transaction-finished--> evaluate reason=Active window observed\./u,
);
assert.match(
  toolShadowResult.debug.v3PilotShadow.debugSummaryText ?? '',
  /5\. evaluate --evaluation-completed--> done/u,
);
assert.equal('debug' in toolShadowResult.continuation, false);
assert.equal(
  toolShadowResult.continuation.diagnostics?.some((diagnostic) => (
    diagnostic.authority === 'diagnostic-only'
    && diagnostic.category === 'runtime-pilot'
  )),
  true,
);
assert.doesNotMatch(JSON.stringify({
  historyLines: toolShadowResult.continuation.historyLines,
  steps: toolShadowResult.continuation.steps,
  toolResults: toolShadowResult.continuation.toolResults,
  traceEvents: toolShadowResult.continuation.traceEvents,
}), /AgentSessionV3Pilot|v3PilotShadow/u);
assert.equal(toolModelInputs.some((input) => /AgentSessionV3Pilot|v3PilotShadow/u.test(input)), false);

console.log('agent session v2 v3 shadow debug smoke ok');
