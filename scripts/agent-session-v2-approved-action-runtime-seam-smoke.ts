import {
  assertSourceMatches,
  readProjectSources,
} from './smokeTestHarness.ts';

const {
  approvedOutcome: approvedOutcomeSource,
  index: indexSource,
  runtime: runtimeSource,
  session: sessionEntrySource,
  approvedResult: sessionSource,
} = readProjectSources({
  approvedOutcome: 'src/agent/runtime/agentApprovedActionOutcomeRuntime.ts',
  index: 'src/agent/index.ts',
  runtime: 'src/agent/agentActionRuntime.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
  approvedResult: 'src/agent/productionSession/approvedResultContinuation.ts',
});

assertSourceMatches(
  runtimeSource,
  /export function evaluateAgentActionRuntime/u,
  'ActionRuntime should expose one lifecycle decision interface.',
);
assertSourceMatches(
  runtimeSource,
  /post-action-loading[\s\S]*status: 'waiting'/u,
  'ActionRuntime should own loading/updating wait decisions.',
);
assertSourceMatches(
  runtimeSource,
  /missing-requested-coverage[\s\S]*status: 'needs-recovery'/u,
  'ActionRuntime should own missing coverage recovery decisions.',
);
assertSourceMatches(
  sessionSource,
  /const approvedActionRuntimeDecision = evaluateAgentActionRuntime\(/u,
  'Approved continuation should evaluate the approved result through ActionRuntime.',
);
assertSourceMatches(
  sessionSource,
  /Approved tool lifecycle decision:[\s\S]*approvedActionRuntimeDecision\.status[\s\S]*approvedActionRuntimeDecision\.reason[\s\S]*approvedActionRuntimeDecision\.postActionState/u,
  'Approved continuation should record the lifecycle decision in history.',
);
assertSourceMatches(
  sessionSource,
  /taskFlow=continuation-required/u,
  'Missing requested coverage should be logged as task continuation, not just generic recovery.',
);
assertSourceMatches(
  approvedOutcomeSource,
  /recoveryDecision\.action === 'failed-action'[\s\S]*recoveryDecision\.action === 'wait'[\s\S]*kind: 'recovery'/u,
  'Approved Action Outcome Runtime should map failed and waiting actions to one recovery transition.',
);
assertSourceMatches(
  sessionSource,
  /recovery: async \(\{ latestEntry, stepIndex, transition \}\)[\s\S]*transition\.recoveryDecision\?\.action === 'failed-action'[\s\S]*executeFailedDesktopActionRecoveryObservation[\s\S]*executeAutoRecoveryLoop/u,
  'The approved-result recovery Adapter should execute the Runtime-selected failed-action or waiting recovery.',
);
assertSourceMatches(
  indexSource,
  /export \* from '\.\/agentActionRuntime';/u,
  'ActionRuntime should be exported through the agent barrel.',
);

assertSourceMatches(sessionEntrySource, /from '\.\/productionSession\/approvedResultContinuation'/u);
assertSourceMatches(sessionEntrySource, /createAgentProductionApprovedResultContinuation\(\{/u);
assertSourceMatches(sessionEntrySource, /await executeApprovedResultContinuation\(approvedToolResult\)/u);

console.log('agent session v2 approved action runtime seam smoke ok');
