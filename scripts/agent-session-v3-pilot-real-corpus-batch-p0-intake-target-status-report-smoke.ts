import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertSourceDoesNotUseRuntimeOrFixedDesktopChain } from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport } from './agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample } from './agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts',
});

assert.match(
  source,
  /export async function runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport/u,
  'real corpus batch P0 intake target status report should expose a caller-owned report builder.',
);
assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts',
);
assert.doesNotMatch(
  source,
  /spawnSync|execSync|npm\.cmd/u,
  'P0 intake target status report should not execute smoke tests or shell commands.',
);
assert.doesNotMatch(
  source,
  /mkdtemp|writeFile|mkdir|createTaskQueue|enqueue/u,
  'P0 intake target status report should not create fixtures, directories, task queues, or samples.',
);

const noInput = await runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport({
  projectRoot,
});

assert.equal(noInput.kind, 'agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report');
assert.equal(noInput.version, 1);
assert.equal(noInput.readyForProductionRuntime, false);
assert.equal(noInput.status, 'no-intake-dirs');
assert.equal(noInput.intakeCount, 0);
assert.equal(noInput.p0TargetCount, 2);
assert.deepEqual(noInput.p0TargetGapKinds, [
  'real-production-like-sample',
  'real-exported-corpus',
]);
assert.equal(noInput.p0TargetSignals.length, 2);
assert.deepEqual(noInput.p0TargetSignals.map((signal) => signal.status), [
  'missing',
  'missing',
]);
assert.ok(
  noInput.p0TargetSignals.every((signal) => signal.missingReason === 'no explicit intake directories supplied'),
  'no-input P0 target signals should explain that no explicit intake directories were supplied.',
);
assert.equal(noInput.nextPriority, 'P0');
assert.match(noInput.summaryText, /status=no-intake-dirs/u);
assert.match(noInput.reportText, /p0TargetSignals:/u);
assert.match(noInput.reportText, /gapKind=real-production-like-sample status=missing/u);
assert.match(noInput.reportText, /gapKind=real-exported-corpus status=missing/u);
assert.match(noInput.reportText, /p0IntakeTargets: none/u);
assert.match(noInput.reportText, /does not discover directories, collect samples, run smoke tests, create task queues, create handoff bundles, choose thresholds, route permissions, execute tools, decide recovery, define workflows, change readiness, define runtime action order, or grant runtime authority/u);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-p0-intake-target-status-'));
try {
  const example = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample({
    includeJsonText: true,
    outDir: tempDir,
    prettyJson: true,
  });

  const readyOnly = await runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    projectRoot,
    prettyJson: true,
  });
  assert.equal(readyOnly.status, 'blocked');
  assert.equal(readyOnly.intakeCount, 1);
  assert.equal(readyOnly.readyForManualReviewCount, 0);
  assert.equal(readyOnly.blockedCount, 1);
  assert.equal(readyOnly.reviewNeededCount, 0);
  assert.equal(readyOnly.entries[0]?.validatorStatus, 'ready');
  assert.equal(readyOnly.entries[0]?.sourceDeclarationStatus, 'blocked');
  assert.equal(readyOnly.entries[0]?.sourceSampleSource, 'rehearsal');
  assert.equal(readyOnly.entries[0]?.sourceSampleSourceStatus, 'synthetic-rehearsal');
  assert.equal(readyOnly.entries[0]?.hasProductionLikeSourceKind, true);
  assert.equal(readyOnly.entries[0]?.manifestSourceCount, 1);
  assert.equal(readyOnly.entries[0]?.indexManifestCount, 2);
  assert.equal(readyOnly.entries[0]?.noteStatus, 'complete');
  assert.deepEqual(readyOnly.entries[0]?.blockerReasons, [
    'source declaration preflight is blocked',
  ]);
  assert.deepEqual(readyOnly.entries[0]?.reviewReasons, []);
  assert.deepEqual(readyOnly.p0TargetSignals.map((signal) => signal.status), [
    'blocked',
    'missing',
  ]);
  assert.equal(
    readyOnly.p0TargetSignals.find((signal) => signal.gapKind === 'real-production-like-sample')?.blockedIntakeCount,
    1,
  );
  assert.equal(
    readyOnly.p0TargetSignals.find((signal) => signal.gapKind === 'real-exported-corpus')?.missingReason,
    'no supplied intake has real-exported sample source evidence',
  );
  assert.match(readyOnly.reportText, /status=blocked/u);
  assert.match(readyOnly.reportText, /productionLike=yes/u);
  assert.match(readyOnly.reportText, /sampleSource=rehearsal/u);
  assert.match(readyOnly.reportText, /sampleSourceStatus=synthetic-rehearsal/u);

  const mixedOnly = await runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport({
    intakeDirs: [
      example.intakeDirs.mixed,
    ],
    projectRoot,
    prettyJson: true,
  });
  assert.equal(mixedOnly.status, 'blocked');
  assert.equal(mixedOnly.intakeCount, 1);
  assert.equal(mixedOnly.blockedCount, 1);
  assert.equal(mixedOnly.entries[0]?.validatorStatus, 'mixed');
  assert.equal(mixedOnly.entries[0]?.sourceDeclarationStatus, 'blocked');
  assert.equal(mixedOnly.entries[0]?.hasProductionLikeSourceKind, true);
  assert.ok(
    mixedOnly.entries[0]?.blockerReasons.some((reason) => reason.includes('source declaration preflight')),
    'mixed generated intake should be blocked by unresolved source declaration.',
  );
  assert.equal(
    mixedOnly.p0TargetSignals.find((signal) => signal.gapKind === 'real-production-like-sample')?.status,
    'blocked',
  );
  assert.equal(
    mixedOnly.p0TargetSignals.find((signal) => signal.gapKind === 'real-exported-corpus')?.status,
    'missing',
  );

  const combined = await runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport({
    includeJsonText: true,
    intakeDirs: [
      example.intakeDirs.ready,
      example.intakeDirs.mixed,
    ],
    projectRoot,
    prettyJson: true,
  });
  assert.equal(combined.status, 'blocked');
  assert.equal(combined.intakeCount, 2);
  assert.equal(combined.blockedCount, 2);
  assert.equal(combined.readyForManualReviewCount, 0);
  assert.equal(combined.reviewNeededCount, 0);
  assert.match(combined.summaryText, /intakes=2/u);
  assert.match(combined.reportText, /p0IntakeTargets:/u);
  assert.match(combined.reportText, /validator=ready/u);
  assert.match(combined.reportText, /validator=mixed/u);
  assert.deepEqual(combined.p0TargetSignals.map((signal) => signal.status), [
    'blocked',
    'missing',
  ]);
  assert.ok(combined.jsonText);
  assert.match(combined.jsonText, /agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report/u);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch P0 intake target status report smoke ok');
