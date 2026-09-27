import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  assertNumberRecordKeys,
  assertObjectRecord,
  assertSourceDoesNotUseRuntimeOrFixedDesktopChain,
  parseTrailingJsonObject,
} from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

function runCli(args: readonly string[]) {
  return process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/c', 'npx.cmd', 'tsx', ...args], {
      cwd: projectRoot,
      encoding: 'utf8',
    })
    : spawnSync('npx', ['tsx', ...args], {
      cwd: projectRoot,
      encoding: 'utf8',
    });
}

function assertNextEvidenceTargetContract(target: unknown) {
  const targetRecord = assertObjectRecord(target, 'next evidence target');

  assert.deepEqual(Object.keys(targetRecord).sort(), [
    'boundary',
    'gapCount',
    'gapKind',
    'manualEvidence',
    'markerSourceCounts',
    'priority',
    'title',
  ]);
  assert.equal(typeof targetRecord.boundary, 'string');
  assert.equal(typeof targetRecord.gapCount, 'number');
  assert.equal(typeof targetRecord.gapKind, 'string');
  assert.equal(typeof targetRecord.manualEvidence, 'string');
  assert.equal(typeof targetRecord.priority, 'string');
  assert.equal(typeof targetRecord.title, 'string');
  assertNumberRecordKeys(
    targetRecord.markerSourceCounts,
    [
      'explicit-marker',
      'legacy-wording',
    ],
    'next evidence target markerSourceCounts',
  );
}

function assertNextEvidenceTargetReportContract(result: Record<string, unknown>) {
  assert.equal(result.kind, 'agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report');
  assert.equal(result.version, 1);
  assert.equal(result.readyForProductionRuntime, false);
  assert.match(String(result.status), /^(no-target-needed|package-attention-needed|target-needed)$/u);
  assert.equal(typeof result.guardrail, 'string');
  assert.equal(typeof result.missingEvidenceStatus, 'string');
  assert.equal(typeof result.missingEvidenceSummaryText, 'string');
  assert.equal(typeof result.packageHealthStatus, 'string');
  assert.equal(typeof result.packageHealthSummaryText, 'string');
  assert.equal(typeof result.reportText, 'string');
  assert.equal(typeof result.summaryText, 'string');
  assertNumberRecordKeys(
    result,
    [
      'gapKindEntryCount',
      'missingPackageEntryCount',
      'packageEntryCount',
      'realSampleGapCount',
      'targetCount',
    ],
    'next evidence target report',
  );
  assertNumberRecordKeys(
    result.priorityCounts,
    [
      'P0',
      'P1',
      'P2',
    ],
    'priorityCounts',
  );
  assert.ok(Array.isArray(result.missingPackageEntryPaths), 'missingPackageEntryPaths should be an array.');
  assert.ok(Array.isArray(result.targets), 'targets should be an array.');
  for (const target of result.targets) {
    assertNextEvidenceTargetContract(target);
  }
}

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report.ts',
});

assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report.ts CLI JSON contract',
);

const cliResult = runCli([
  '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report.ts',
  '--pretty',
]);

assert.equal(
  cliResult.status,
  0,
  cliResult.stderr || cliResult.stdout || cliResult.error?.message,
);
assert.match(cliResult.stdout, /AgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReport status=target-needed/u);
assert.match(cliResult.stdout, /packageHealth=missing-real-evidence/u);
assert.match(cliResult.stdout, /nextEvidenceTargets:/u);
assert.match(cliResult.stdout, /nextPriority=P0/u);
assert.match(cliResult.stdout, /readyForProductionRuntime=no/u);

const result = parseTrailingJsonObject(cliResult.stdout);
const priorityCounts = assertObjectRecord(result.priorityCounts, 'priorityCounts');

assertNextEvidenceTargetReportContract(result);
assert.equal(result.status, 'target-needed');
assert.equal(result.packageHealthStatus, 'missing-real-evidence');
assert.equal(result.missingEvidenceStatus, 'missing-real-evidence');
assert.equal(result.packageEntryCount, 28);
assert.equal(result.missingPackageEntryCount, 0);
assert.equal(result.gapKindEntryCount, 6);
assert.equal(result.targetCount, 6);
assert.equal(result.nextPriority, 'P0');
assert.equal(priorityCounts.P0, 2);
assert.equal(priorityCounts.P1, 2);
assert.equal(priorityCounts.P2, 2);
assert.deepEqual(
  (result.targets as Record<string, unknown>[]).map((target) => `${String(target.priority)}:${String(target.gapKind)}`),
  [
    'P0:real-production-like-sample',
    'P0:real-exported-corpus',
    'P1:broader-real-corpus',
    'P1:manifest-distribution',
    'P2:real-exported-fixture',
    'P2:real-threshold-profile',
  ],
);
assert.match(String(result.packageHealthSummaryText), /status=missing-real-evidence/u);
assert.match(String(result.packageHealthSummaryText), /p0IntakeTargetStatusLink=linked/u);
assert.match(String(result.packageHealthSummaryText), /p0IntakeTargetStatusLinkMissingSignals=0/u);
assert.match(String(result.missingEvidenceSummaryText), /status=missing-real-evidence/u);
assert.match(String(result.reportText), /priority=P0 gapKind=real-production-like-sample/u);
assert.match(String(result.guardrail), /does not collect samples/u);
assert.match(String(result.guardrail), /create task queues/u);
assert.match(String(result.guardrail), /define runtime action order/u);
assert.match(String(result.guardrail), /grant runtime authority/u);

console.log('agent session v3 pilot real corpus batch next evidence target report CLI JSON contract smoke ok');
