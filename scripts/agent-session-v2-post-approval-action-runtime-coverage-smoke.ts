import {
  assertSourceDoesNotMatch,
  assertSourceMatches,
  readProjectSources,
} from './smokeTestHarness.ts';

const {
  continuationDispatcher: continuationDispatcherSource,
  outcomeRuntime: outcomeRuntimeSource,
  session: sessionSource,
} = readProjectSources({
  continuationDispatcher: 'src/agent/runtime/agentRuntimeContinuationDispatcher.ts',
  outcomeRuntime: 'src/agent/runtime/agentVerificationOutcomeRuntime.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
});

assertSourceMatches(
  outcomeRuntimeSource,
  /transitionAgentVerificationOutcome[\s\S]*evaluateAgentActionRuntime\(/u,
  'Verification Outcome Runtime should route the verification result through ActionRuntime.',
);
assertSourceMatches(
  sessionSource,
  /runAgentVerificationContinuation<AgentRuntimeResult>\(/u,
  'Legacy Session should enter the combined Runtime verification transition-and-dispatch interface.',
);
assertSourceMatches(
  sessionSource,
  /post-approval lifecycle decision:[\s\S]*postApprovalActionRuntimeDecision\.status[\s\S]*postApprovalActionRuntimeDecision\.reason[\s\S]*postApprovalActionRuntimeDecision\.postActionState/u,
  'Post-approval verification should record the lifecycle decision in history.',
);
assertSourceMatches(
  sessionSource,
  /postApprovalActionRuntimeDecision\.missingCoverage[\s\S]*createAgentUnattemptedRequestedActionFinalRejection/u,
  'Missing action coverage should be derived from the lifecycle decision.',
);
assertSourceMatches(
  outcomeRuntimeSource,
  /recoveryDecision\.action === 'automatic-observation'[\s\S]*kind: 'target-resolution'/u,
  'Verification Outcome Runtime should map missing coverage recovery to target resolution.',
);
assertSourceMatches(
  sessionSource,
  /runAgentVerificationContinuation<AgentRuntimeResult>\([\s\S]*recovery:[\s\S]*executeAutoRecoveryLoop[\s\S]*targetResolution:[\s\S]*executeInAppTargetLocateObservation/u,
  'Legacy Session should provide target-resolution and recovery adapters to the combined Runtime verification interface.',
);
assertSourceMatches(
  continuationDispatcherSource,
  /runAgentVerificationContinuation[\s\S]*transitionAgentVerificationOutcome\(options\)[\s\S]*dispatchAgentRuntimeContinuation\(/u,
  'Runtime should select and immediately dispatch the verification continuation.',
);
assertSourceMatches(
  continuationDispatcherSource,
  /case 'target-resolution':[\s\S]*return 'targetResolution'[\s\S]*case 'recovery':[\s\S]*return 'recovery'/u,
  'Runtime continuation dispatcher should select target-resolution and bounded recovery adapters.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /transitionAgentVerificationOutcome\(|verificationOutcomeTransition\.kind\s*===/u,
  'Legacy Session should not select or branch on verification continuation kinds.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /const missingPostApprovalActionCoverage = findAgentSessionV2MissingRequestedActionCoverage/u,
  'Post-approval verification should not keep a separate missing coverage decision path.',
);


assertSourceMatches(sessionSource, /from '\.\/productionSession\/postApprovalVerification'/u);
assertSourceMatches(sessionSource, /createAgentProductionPostApprovalVerification\(\{/u);

console.log('agent session v2 post approval action runtime coverage smoke ok');
