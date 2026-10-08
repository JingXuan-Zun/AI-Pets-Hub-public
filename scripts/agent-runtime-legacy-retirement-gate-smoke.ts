import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createAgentRuntimeSourceRevision } from './agentRuntimeSourceRevisionCore.mjs';

import {
  AGENT_RUNTIME_RETIREMENT_REQUIRED_OBSERVATIONS,
  evaluateAgentRuntimeLegacyRetirementGate,
  inspectAgentRuntimeLegacyRetirementStaticCoverage,
} from './agentRuntimeLegacyRetirementGateCore.mjs';

const staticChecks = inspectAgentRuntimeLegacyRetirementStaticCoverage(process.cwd());
const projectRoot = process.cwd();
try {
  process.chdir(tmpdir());
  assert.deepEqual(inspectAgentRuntimeLegacyRetirementStaticCoverage(projectRoot), staticChecks,
    'explicit project root must resolve reachable controller modules independently of process cwd');
} finally {
  process.chdir(projectRoot);
}
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
  currentSourceRevision: sourceRevision,
  observationManifest: completeObservationManifest,
  staticChecks: staticChecks.map((check) => ({ ...check, passed: true })),
});
assert.equal(ready.ready, true);
assert.equal(ready.status, 'ready-for-legacy-deletion');

const staleObservation = structuredClone(completeObservationManifest);
staleObservation.observations[0].sourceRevision = 'older-revision';
const stale = evaluateAgentRuntimeLegacyRetirementGate({
  currentSourceRevision: sourceRevision,
  observationManifest: staleObservation,
  staticChecks: staticChecks.map((check) => ({ ...check, passed: true })),
});
assert.equal(stale.ready, false);
assert.equal(stale.status, 'blocked-observation');
assert.match(stale.observations.failures.join('\n'), /does not match sourceRevision/u);

// A self-consistent historical manifest cannot validate a newer checkout.
const historical = evaluateAgentRuntimeLegacyRetirementGate({
  currentSourceRevision: 'newer-checkout-revision',
  observationManifest: completeObservationManifest,
  staticChecks,
});
assert.equal(historical.ready, false);
assert.equal(historical.status, 'blocked-observation');
assert.match(historical.observations.failures.join('\n'), /does not match current source revision/u);

for (const currentSourceRevision of [undefined, '', '   ']) {
  const unbound = evaluateAgentRuntimeLegacyRetirementGate({
    currentSourceRevision,
    observationManifest: completeObservationManifest,
    staticChecks,
  });
  assert.equal(unbound.ready, false, 'Observation evidence must be bound to a supplied current source revision.');
  assert.match(unbound.observations.failures.join('\n'), /Current source revision is required/u);
}

// Contradictory duplicate observations and malformed regression ledgers fail closed.
const duplicateManifest = structuredClone(completeObservationManifest);
duplicateManifest.observations.push({ ...duplicateManifest.observations[0], status: 'failed' });
const duplicate = evaluateAgentRuntimeLegacyRetirementGate({
  currentSourceRevision: sourceRevision,
  observationManifest: duplicateManifest,
  staticChecks,
});
assert.equal(duplicate.ready, false);
assert.match(duplicate.observations.failures.join('\n'), /Duplicate observation/u);

for (const unresolvedRegressions of [{}, '', null, undefined]) {
  const malformed = evaluateAgentRuntimeLegacyRetirementGate({
    currentSourceRevision: sourceRevision,
    observationManifest: { ...completeObservationManifest, unresolvedRegressions },
    staticChecks,
  });
  assert.equal(malformed.ready, false, 'An invalid regression ledger cannot prove there are no regressions.');
  assert.match(malformed.observations.failures.join('\n'), /unresolvedRegressions must be an array/u);
}

for (const firstStatus of ['passed', 'failed']) {
  const conflicting = structuredClone(completeObservationManifest);
  conflicting.observations[0].status = firstStatus;
  conflicting.observations.push({ ...conflicting.observations[0], status: firstStatus === 'passed' ? 'failed' : 'passed' });
  const conflict = evaluateAgentRuntimeLegacyRetirementGate({
    currentSourceRevision: sourceRevision, observationManifest: conflicting, staticChecks,
  });
  assert.equal(conflict.ready, false, 'Conflicting evidence must not depend on array order.');
  assert.match(conflict.observations.failures.join('\n'), /Duplicate observation/u);
}
const outstanding = evaluateAgentRuntimeLegacyRetirementGate({
  currentSourceRevision: sourceRevision,
  observationManifest: { ...completeObservationManifest, unresolvedRegressions: ['known-failure'] },
  staticChecks,
});
assert.equal(outstanding.ready, false);
assert.match(outstanding.observations.failures.join('\n'), /unresolvedRegressions must be empty/u);

// Exercise the CLI boundary too: it must compute the checkout fingerprint.
// This temporary synthetic fixture is a test input, not production evidence.
const fixturePath = join(tmpdir(), 'agent-retirement-gate-' + randomUUID() + '.json');
const currentRevision = createAgentRuntimeSourceRevision(projectRoot).revision;
try {
  for (const [revision, reportOnly, expectedReady, fixtureCase] of [
    [currentRevision, false, true, 'normal'],
    ['older-checkout-revision', false, false, 'stale'],
    ['older-checkout-revision', true, false, 'stale'],
    [currentRevision, false, false, 'duplicate'],
    [currentRevision, false, false, 'invalid-ledger'],
  ] as const) {
    const fixture = structuredClone(completeObservationManifest);
    fixture.sourceRevision = revision;
    for (const observation of fixture.observations) observation.sourceRevision = revision;
    if (fixtureCase === 'duplicate') {
      fixture.observations.push({ ...fixture.observations[0], status: 'failed' });
    } else if (fixtureCase === 'invalid-ledger') {
      Reflect.set(fixture, 'unresolvedRegressions', {});
    }
    writeFileSync(fixturePath, JSON.stringify(fixture), 'utf8');
    const cli = spawnSync(process.execPath, [
      join(projectRoot, 'scripts', 'agent-runtime-legacy-retirement-gate.mjs'),
      '--evidence', fixturePath, '--json', ...(reportOnly ? ['--report-only'] : []),
    ], { cwd: projectRoot, encoding: 'utf8', timeout: 30_000 });
    assert.ifError(cli.error);
    assert.equal(cli.status, expectedReady || reportOnly ? 0 : 1, cli.stderr);
    const report = JSON.parse(cli.stdout);
    assert.equal(report.ready, expectedReady);
    assert.equal(report.status, expectedReady ? 'ready-for-legacy-deletion' : 'blocked-observation');
    if (!expectedReady) {
      const expectedFailure = fixtureCase === 'duplicate' ? /Duplicate observation/u
        : fixtureCase === 'invalid-ledger' ? /unresolvedRegressions must be an array/u
          : /does not match current source revision/u;
      assert.match(report.observations.failures.join('\n'), expectedFailure);
    }
  }
} finally {
  unlinkSync(fixturePath);
}

console.log('agent runtime legacy retirement gate smoke ok');
