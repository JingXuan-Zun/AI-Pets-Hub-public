import assert from 'node:assert/strict';
import {
  createAgentIncompleteTaskProgressFinalRejection,
  type AgentSessionV2Decision,
} from '../src/agent/legacy/index.ts';
import {
  assertSourceDoesNotMatch,
  assertSourceMatches,
  readProjectSources,
} from './smokeTestHarness.ts';

const {
  index: indexSource,
  runtimeSignal: runtimeSignalSource,
  session: sessionSource,
  finalResponse: finalResponseSource,
  guards: guardsSource,
  signal: signalSource,
} = readProjectSources({
  index: 'src/agent/legacy/index.ts',
  runtimeSignal: 'src/agent/runtime/agentFinalAnswerRejectionSignals.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
  finalResponse: 'src/agent/productionSession/finalResponse.ts',
  guards: 'src/agent/productionSession/finalEvidenceGuards.ts',
  signal: 'src/agent/runtime/agentFinalAnswerRejectionSignals.ts',
});

assertSourceMatches(sessionSource, /from '\.\/productionSession\/finalResponse'/u, 'The root must import the checked final response module.');
assertSourceMatches(sessionSource, /const \{ prepareFinalResponse \} = createAgentProductionFinalResponse\(\{/u, 'The root must instantiate the checked final response module.');
assertSourceMatches(sessionSource, /prepareFinalResponse\(decision, stepIndex/u, 'The root must dispatch responses through the checked module.');

assertSourceMatches(
  runtimeSignalSource,
  /export function createAgentIncompleteTaskProgressFinalRejection/u,
  'Incomplete task progress final rejection should live in Runtime.',
);
assertSourceMatches(
  runtimeSignalSource,
  /incompleteTaskProgressFinalRejectionPolicy=This rejection is advisory\/evidence-driven/u,
  'Incomplete task progress final rejection signal should explicitly remain advisory and evidence-driven.',
);
assertSourceMatches(
  finalResponseSource,
  /from '\.\.\/runtime\/agentFinalAnswerRejectionSignals'/u,
  'AgentSessionV2 should consume Runtime final-answer rejection signals.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /function createAgentSessionV2IncompleteTaskProgressFinalRejection/u,
  'AgentSessionV2 should not own incomplete task progress final rejection signal implementation.',
);
assertSourceMatches(
  sessionSource,
  /shouldRejectAgentProductionIncompleteTaskProgressFinal: shouldRejectAgentSessionV2IncompleteTaskProgressFinal/u,
  'Production session should bind the existing evidence guard from its module.',
);

assertSourceMatches(sessionSource, /from '\.\/productionSession\/finalEvidenceGuards'/u, 'The root must import the checked implementation.');
assertSourceMatches(sessionSource, /createAgentProductionFinalEvidenceGuards\(\{/u, 'The root must instantiate the reachable evidence guard module.');
assertSourceMatches(guardsSource, /function shouldRejectAgentProductionIncompleteTaskProgressFinal/u, 'The predicate implementation must remain in the bound production module.');

const decision: AgentSessionV2Decision = {
  action: 'final_answer',
  message: 'The display part is done.',
  understanding: {
    blockedGoals: ['system info command requires permission'],
    completedGoals: ['observed display information'],
    remainingGoals: ['observe system information'],
    successCriteria: 'answer display and system information from fresh local evidence',
    userNeed: 'tell the user current display and system information',
  },
};

const rejectionText = createAgentIncompleteTaskProgressFinalRejection(decision);

assert.match(
  rejectionText,
  /The model produced a rejected final_answer while its own task progress board still has remaining goals/u,
);
assert.match(rejectionText, /userNeed=tell the user current display and system information/u);
assert.match(rejectionText, /successCriteria=answer display and system information from fresh local evidence/u);
assert.match(rejectionText, /completedGoals=observed display information/u);
assert.match(rejectionText, /remainingGoals=observe system information/u);
assert.match(rejectionText, /blockedGoals=system info command requires permission/u);
assert.match(rejectionText, /incompleteTaskProgressFinalRejectionPolicy=This rejection is advisory\/evidence-driven/u);
assert.match(rejectionText, /Next action must address the remaining goals/u);
assert.match(rejectionText, /rejectedMessage=The display part is done/u);
assert.doesNotMatch(
  rejectionText,
  /open_app\s*->\s*wait_ui\s*->\s*locate\s*->\s*click\s*->\s*verify/iu,
  'Incomplete task progress final rejection signal should not encode a fixed tool chain.',
);

const noCompletedGoalsText = createAgentIncompleteTaskProgressFinalRejection({
  action: 'final_answer',
  message: 'Done.',
  understanding: {
    remainingGoals: ['collect one more observation'],
  },
});

assert.match(noCompletedGoalsText, /completedGoals=none yet/u);
assert.match(noCompletedGoalsText, /remainingGoals=collect one more observation/u);

console.log('agent session v2 incomplete task progress final rejection signal smoke ok');
