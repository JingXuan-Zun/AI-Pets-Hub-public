import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertSourceDoesNotUseRuntimeOrFixedDesktopChain } from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport } from './agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample } from './agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts',
});

assert.match(
  source,
  /export async function runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport/u,
  'P0 real evidence closeout report should expose a caller-owned report builder.',
);
assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts',
);
assert.doesNotMatch(
  source,
  /spawnSync|execSync|npm\.cmd/u,
  'P0 real evidence closeout report should not execute smoke tests or shell commands.',
);
assert.doesNotMatch(
  source,
  /mkdtemp|writeFile|mkdir|createTaskQueue|enqueue/u,
  'P0 real evidence closeout report should not create fixtures, directories, task queues, or samples.',
);

const noInput = await runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport({
  projectRoot,
});

assert.equal(noInput.kind, 'agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report');
assert.equal(noInput.version, 1);
assert.equal(noInput.readyForProductionRuntime, false);
assert.equal(noInput.status, 'no-intake-dirs');
assert.equal(noInput.intakeCount, 0);
assert.equal(noInput.packageHealthStatus, 'missing-real-evidence');
assert.equal(noInput.nextEvidenceTargetStatus, 'target-needed');
assert.equal(noInput.nextPriority, 'P0');
assert.equal(noInput.p0IntakeTargetStatus, 'no-intake-dirs');
assert.equal(noInput.readinessRollupStatus, 'not-run');
assert.equal(noInput.readinessStatusCounts, null);
assert.equal(noInput.p0TargetCount, 2);
assert.deepEqual(noInput.p0TargetSignals.map((signal) => signal.status), [
  'missing',
  'missing',
]);
assert.ok(noInput.closeoutReasons.some((reason) => reason.includes('no explicit intake directories')));
assert.match(noInput.summaryText, /status=no-intake-dirs/u);
assert.match(noInput.summaryText, /packageHealth=missing-real-evidence/u);
assert.match(noInput.summaryText, /readinessRollup=not-run/u);
assert.match(noInput.reportText, /p0TargetSignals:/u);
assert.match(noInput.reportText, /readinessRollupSummary=not-run/u);
assert.match(noInput.reportText, /readyForProductionRuntime=no/u);
assert.match(noInput.reportText, /does not discover directories, collect samples, run smoke tests, create task queues, create handoff bundles, choose thresholds, route permissions, execute tools, decide recovery, define workflows, change readiness, define runtime action order, or grant runtime authority/u);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-p0-real-evidence-closeout-'));
try {
  const example = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample({
    includeJsonText: true,
    outDir: tempDir,
    prettyJson: true,
  });

  const readyOnly = await runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    projectRoot,
    prettyJson: true,
  });

  assert.equal(readyOnly.status, 'blocked');
  assert.equal(readyOnly.p0IntakeTargetStatus, 'blocked');
  assert.equal(readyOnly.readinessRollupStatus, 'ready-for-manual-review');
  assert.equal(readyOnly.p0ReadyForManualReviewCount, 0);
  assert.equal(readyOnly.p0BlockedCount, 1);
  assert.equal(readyOnly.p0ReviewNeededCount, 0);
  assert.deepEqual(readyOnly.readinessStatusCounts, {
    blocked: 0,
    readyForManualReview: 1,
    reviewNeeded: 0,
  });
  assert.deepEqual(readyOnly.p0TargetSignals.map((signal) => signal.status), [
    'blocked',
    'missing',
  ]);
  assert.ok(
    readyOnly.closeoutReasons.some((reason) => reason.includes('P0 target real-production-like-sample is blocked')),
    'rehearsal closeout should preserve the P0 production-like blocker.',
  );
  assert.ok(
    readyOnly.closeoutReasons.some((reason) => reason.includes('P0 target real-exported-corpus is missing')),
    'rehearsal closeout should not count synthetic rehearsal as real exported corpus evidence.',
  );
  assert.match(readyOnly.summaryText, /status=blocked/u);
  assert.match(readyOnly.reportText, /readinessRollupSummary=AgentSessionV3PilotRealCorpusBatchReadinessRollupReport status=ready-for-manual-review/u);

  const mixedOnly = await runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport({
    intakeDirs: [
      example.intakeDirs.mixed,
    ],
    projectRoot,
    prettyJson: true,
  });

  assert.equal(mixedOnly.status, 'blocked');
  assert.equal(mixedOnly.p0IntakeTargetStatus, 'blocked');
  assert.equal(mixedOnly.readinessRollupStatus, 'review-needed');
  assert.ok(mixedOnly.closeoutReasons.some((reason) => reason.includes('P0 target real-production-like-sample is blocked')));
  assert.match(mixedOnly.reportText, /readiness rollup needs review/u);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch P0 real evidence closeout report smoke ok');
