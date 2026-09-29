import {
  assertSourceDoesNotMatch,
  assertSourceMatches,
  readProjectSources,
} from './smokeTestHarness.ts';

const {
  runtime: runtimeSource,
  session: sessionSource,
} = readProjectSources({
  runtime: 'src/agent/agentActionRuntime.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
});

assertSourceMatches(
  runtimeSource,
  /postActionState === 'loading' \|\| postActionState === 'updating'[\s\S]*status: 'waiting'/u,
  'ActionRuntime should be the owner of loading/updating wait decisions.',
);
assertSourceMatches(
  sessionSource,
  /const inAppLocateRuntimeDecision = evaluateAgentActionRuntime\(/u,
  'In-app locate should ask ActionRuntime before locating an internal target.',
);
assertSourceMatches(
  sessionSource,
  /inAppLocateRuntimeDecision\.status === 'waiting'[\s\S]*deferred in-app target locate/u,
  'In-app locate should defer through ActionRuntime waiting decisions.',
);
assertSourceMatches(
  sessionSource,
  /runtimeReason=\$\{inAppLocateRuntimeDecision\.reason\}/u,
  'Deferred in-app locate history should record the ActionRuntime reason.',
);
assertSourceMatches(
  sessionSource,
  /const latestVerificationRuntimeDecision = evaluateAgentActionRuntime\(/u,
  'Post-recovery verification should ask ActionRuntime before waiting again.',
);
assertSourceMatches(
  sessionSource,
  /latestVerificationRuntimeDecision\.status === 'waiting'[\s\S]*executeAutoRecoveryLoop/u,
  'Post-recovery verification should use ActionRuntime waiting decisions for wait loops.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /latestPostActionState === 'loading'[\s\S]{0,120}latestPostActionState === 'updating'/u,
  'In-app locate should not keep a direct loading/updating branch.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /latestVerificationPostActionState === 'loading'[\s\S]{0,120}latestVerificationPostActionState === 'updating'/u,
  'Post-recovery verification should not keep a direct loading/updating branch.',
);

console.log('agent session v2 action runtime wait gate smoke ok');
