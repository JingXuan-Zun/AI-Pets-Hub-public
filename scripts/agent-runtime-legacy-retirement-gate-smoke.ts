import assert from 'node:assert/strict';

import {
  AGENT_RUNTIME_RETIREMENT_REQUIRED_OBSERVATIONS,
  evaluateAgentRuntimeLegacyRetirementGate,
  inspectAgentRuntimeLegacyRetirementStaticCoverage,
} from './agentRuntimeLegacyRetirementGateCore.mjs';

const staticChecks = inspectAgentRuntimeLegacyRetirementStaticCoverage(process.cwd());
assert.equal(staticChecks.some((check) => check.id === 'runtime-capability-version-neutral'), true);
assert.equal(staticChecks.some((check) => check.id === 'production-session-version-neutral'), true);
assert.equal(
  staticChecks.find((check) => check.id === 'legacy-session-wrapper-retired')?.passed,
  true,
);
assert.equal(staticChecks.some((check) => check.id === 'production-barrel-version-neutral'), true);
assert.equal(
  staticChecks.find((check) => check.id === 'working-memory-bias-runtime-owned')?.passed,
  true,
);
assert.equal(
  staticChecks.find((check) => check.id === 'working-memory-conflict-runtime-owned')?.passed,
  true,
);
assert.equal(
  staticChecks.find((check) => check.id === 'task-progress-signal-runtime-owned')?.passed,
  true,
);
assert.equal(
  staticChecks.find((check) => check.id === 'visual-planning-signals-runtime-owned')?.passed,
  true,
);
assert.equal(
  staticChecks.find((check) => check.id === 'result-verification-signal-runtime-owned')?.passed,
  true,
);
assert.equal(
  staticChecks.find((check) => check.id === 'replan-signal-runtime-owned')?.passed,
  true,
);
assert.equal(
  staticChecks.find((check) => check.id === 'post-action-recovery-followup-runtime-owned')?.passed,
  true,
);
assert.equal(
  staticChecks.find((check) => check.id === 'trace-stuck-guard-runtime-owned')?.passed,
  true,
);
assert.equal(
  staticChecks.find((check) => check.id === 'trace-stuck-signal-runtime-owned')?.passed,
  true,
);
assert.equal(
  staticChecks.find((check) => check.id === 'trace-events-runtime-owned')?.passed,
  true,
);
assert.equal(
  staticChecks.find((check) => check.id === 'trace-summary-runtime-owned')?.passed,
  true,
);
assert.equal(
  staticChecks.find((check) => check.id === 'tool-result-cache-evidence-runtime-owned')?.passed,
  true,
);
assert.equal(
  staticChecks.find((check) => check.id === 'tool-result-summary-runtime-owned')?.passed,
  true,
);
assert.equal(
  staticChecks.find((check) => check.id === 'decision-repair-signal-runtime-owned')?.passed,
  true,
);
assert.equal(
  staticChecks.find((check) => check.id === 'compatibility-tool-rejection-runtime-owned')?.passed,
  true,
);
assert.equal(
  staticChecks.find((check) => check.id === 'final-answer-rejection-signals-runtime-owned')?.passed,
  true,
);
assert.equal(
  staticChecks.find((check) => check.id === 'decision-rejection-signals-runtime-owned')?.passed,
  true,
);
assert.equal(
  staticChecks.find((check) => check.id === 'post-action-recovery-guidance-runtime-owned')?.passed,
  true,
);
assert.equal(
  staticChecks.find((check) => check.id === 'approval-reason-signals-runtime-owned')?.passed,
  true,
);
assert.equal(
  staticChecks.find((check) => check.id === 'execution-progress-signals-runtime-owned')?.passed,
  true,
);
assert.equal(
  staticChecks.find((check) => check.id === 'command-evidence-predicates-runtime-owned')?.passed,
  true,
);
assert.equal(
  staticChecks.find((check) => check.id === 'session-helper-modules-runtime-owned')?.passed,
  true,
);
assert.equal(
  staticChecks.find((check) => check.id === 'planning-signal-evidence-runtime-owned')?.passed,
  true,
);
assert.equal(
  staticChecks.find((check) => check.id === 'session-command-builders-version-neutral')?.passed,
  true,
);
assert.equal(
  staticChecks.find((check) => check.id === 'stuck-signature-metrics-runtime-owned')?.passed,
  true,
);
assert.equal(
  staticChecks.find((check) => check.id === 'recovery-strategy-ranking-runtime-owned')?.passed,
  true,
);

const blocked = evaluateAgentRuntimeLegacyRetirementGate({
  observationManifest: null,
  staticChecks,
});
assert.equal(blocked.ready, false);
assert.equal(blocked.status, 'blocked-observation');
assert.equal(blocked.failedStaticChecks.length, 0);
assert.equal(
  staticChecks.find((check) => check.id === 'production-barrel-version-neutral')?.passed,
  true,
  'The production barrel should keep versioned Session APIs isolated in the Legacy barrel.',
);

const sourceRevision = 'test-revision';
const completeObservationManifest = {
  observations: AGENT_RUNTIME_RETIREMENT_REQUIRED_OBSERVATIONS.map(({ id }) => ({
    evidenceRef: `trace://${id}`,
    id,
    observedAt: '2026-07-13T00:00:00.000Z',
    sourceRevision,
    status: 'passed',
  })),
  reviewedBy: 'runtime-maintainer',
  schemaVersion: 1,
  sourceRevision,
  unresolvedRegressions: [],
};

const ready = evaluateAgentRuntimeLegacyRetirementGate({
  observationManifest: completeObservationManifest,
  staticChecks: staticChecks.map((check) => ({ ...check, passed: true })),
});
assert.equal(ready.ready, true);
assert.equal(ready.status, 'ready-for-legacy-deletion');

const staleObservation = structuredClone(completeObservationManifest);
staleObservation.observations[0].sourceRevision = 'older-revision';
const stale = evaluateAgentRuntimeLegacyRetirementGate({
  observationManifest: staleObservation,
  staticChecks: staticChecks.map((check) => ({ ...check, passed: true })),
});
assert.equal(stale.ready, false);
assert.equal(stale.status, 'blocked-observation');
assert.match(stale.observations.failures.join('\n'), /does not match sourceRevision/u);

console.log('agent runtime legacy retirement gate smoke ok');
