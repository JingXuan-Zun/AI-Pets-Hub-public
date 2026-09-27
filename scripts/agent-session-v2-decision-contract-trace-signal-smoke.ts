import assert from 'node:assert/strict';
import {
  createAgentDecisionAcceptedTraceSummary,
  createAgentDecisionRejectedTraceSummary,
  createAgentFinalAnswerAcceptedTraceSummary,
  createAgentModelOutputFailedTraceSummary,
  createAgentModelOutputTraceSummary,
  createAgentUnavailableToolRejectedTraceSummary,
} from '../src/agent/legacy/index.ts';
import {
  assertSourceExportsFunction,
  readProjectSources,
} from './smokeTestHarness.ts';

const {
  runtime: runtimeSource,
  session: sessionSource,
} = readProjectSources({
  runtime: 'src/agent/runtime/agentDecisionTraceSummary.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
});

const traceSummaryFunctionNames = [
  'createAgentSessionV2ModelOutputTraceSummary',
  'createAgentSessionV2ModelOutputFailedTraceSummary',
  'createAgentSessionV2DecisionRejectedTraceSummary',
  'createAgentSessionV2DecisionAcceptedTraceSummary',
  'createAgentSessionV2FinalAnswerAcceptedTraceSummary',
  'createAgentSessionV2UnavailableToolRejectedTraceSummary',
] as const;

for (const functionName of traceSummaryFunctionNames) {
}

for (const functionName of [
  'createAgentFinalAnswerAcceptedTraceSummary',
  'createAgentUnavailableToolRejectedTraceSummary',
]) {
  assert.match(
    sessionSource,
    new RegExp(functionName, 'u'),
    `AgentSessionV2 should consume Runtime-owned ${functionName}.`,
  );
}

for (const functionName of [
  'createAgentModelOutputTraceSummary',
  'createAgentModelOutputFailedTraceSummary',
  'createAgentDecisionRejectedTraceSummary',
  'createAgentDecisionAcceptedTraceSummary',
  'createAgentFinalAnswerAcceptedTraceSummary',
  'createAgentUnavailableToolRejectedTraceSummary',
]) {
  assert.match(runtimeSource, new RegExp(`export function ${functionName}`, 'u'));
}

for (const functionName of traceSummaryFunctionNames) {
  assert.doesNotMatch(
    sessionSource,
    new RegExp(`function ${functionName}`, 'u'),
    `AgentSessionV2 should not own ${functionName} implementation.`,
  );
}

for (const inlineSummary of [
  'Model returned a decision payload.',
  'Model call failed before producing a decision payload.',
  'Decision contract rejected the model output.',
  'Agent accepted final_answer.',
  'Decision contract rejected an unavailable tool selection.',
]) {
  assert.doesNotMatch(
    sessionSource,
    new RegExp(`summary: '${inlineSummary.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}'`, 'u'),
    `AgentSessionV2 should not inline trace summary "${inlineSummary}".`,
  );
}
assert.doesNotMatch(
  sessionSource,
  /const postModelBudgetStopReason = timingTracker\.getBudgetStopReason\(\)[\s\S]*modelDecisionTurn\.type === 'invalid-output'/u,
  'AgentSessionV2 should not drop an accepted model decision on a post-model budget check before committing approval or dispatch state.',
);

assert.equal(
  createAgentModelOutputTraceSummary(),
  'Model returned a decision payload.',
);
assert.equal(
  createAgentModelOutputFailedTraceSummary(),
  'Model call failed before producing a decision payload.',
);
assert.equal(
  createAgentDecisionRejectedTraceSummary(),
  'Decision contract rejected the model output.',
);
assert.equal(
  createAgentDecisionAcceptedTraceSummary('tool_call'),
  'Decision contract accepted action tool_call.',
);
assert.equal(
  createAgentFinalAnswerAcceptedTraceSummary(),
  'Agent accepted final_answer.',
);
assert.equal(
  createAgentUnavailableToolRejectedTraceSummary(),
  'Decision contract rejected an unavailable tool selection.',
);

console.log('agent session v2 decision contract trace signal smoke ok');
