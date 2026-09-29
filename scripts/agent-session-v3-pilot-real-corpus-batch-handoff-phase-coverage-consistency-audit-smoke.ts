import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertSourceDoesNotUseRuntimeOrFixedDesktopChain } from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { runAgentSessionV3PilotRealCorpusBatchHandoffBundle } from './agent-session-v3-pilot-real-corpus-batch-handoff-bundle.ts';
import {
  createAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAuditEntryIssues,
  runAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAudit,
  type AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAuditResult,
} from './agent-session-v3-pilot-real-corpus-batch-handoff-phase-coverage-consistency-audit.ts';
import { runAgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollup } from './agent-session-v3-pilot-real-corpus-batch-handoff-source-preflight-rollup.ts';
import { runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample } from './agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts';
import { readProjectSources } from './smokeTestHarness.ts';

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function assertReportTextContainsIssueCodes(
  audit: AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAuditResult,
) {
  for (const issue of audit.issues) {
    assert.match(
      audit.reportText,
      new RegExp(`(?:^|\\s)code=${escapeRegExp(issue.code)}(?:\\s|$)`, 'u'),
      `reportText should include emitted issue code: ${issue.code}`,
    );
  }
}

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-phase-coverage-consistency-audit.ts',
});

assert.match(
  source,
  /export async function runAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAudit/u,
  'handoff phase coverage consistency audit should expose a caller-owned runner.',
);
assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-handoff-phase-coverage-consistency-audit.ts',
);
assert.doesNotMatch(
  source,
  /spawnSync|execSync|npm\.cmd/u,
  'handoff phase coverage consistency audit should not execute shell commands.',
);

const mismatchIssues = createAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAuditEntryIssues({
  artifactIntegrityPhaseCoverage: {
    entryCount: 1,
    statusCounts: {
      'needs-review': 1,
    },
    statuses: [
      'needs-review',
    ],
  },
  bundlePhaseCoverage: {
    entryCount: 1,
    statusCounts: {
      clean: 1,
    },
    statuses: [
      'clean',
    ],
  },
  label: 'defensive-entry',
  reviewerPacketPhaseCoverage: {
    entryCount: 1,
    statusCounts: {
      blocked: 1,
    },
    statuses: [
      'blocked',
    ],
  },
  sourcePreflightRollupPhaseCoverage: {
    entryCount: 0,
    statusCounts: {},
    statuses: [],
  },
});

assert.deepEqual(
  mismatchIssues.map((issue) => issue.code),
  [
    'artifact-integrity-phase-coverage-mismatch',
    'reviewer-packet-phase-coverage-mismatch',
    'source-preflight-rollup-phase-coverage-mismatch',
  ],
  'entry issue builder should cover all phase-coverage mismatch evidence codes without file-race fixtures.',
);
assert.ok(
  mismatchIssues.every((issue) => issue.severity === 'review'),
  'entry issue builder should emit review-only issues.',
);

const cleanPhaseCoverage = {
  entryCount: 1,
  statusCounts: {
    clean: 1,
  },
  statuses: [
    'clean',
  ],
};

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-handoff-phase-coverage-audit-'));
try {
  const example = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample({
    outDir: path.join(tempDir, 'example'),
    prettyJson: true,
  });
  const bundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'handoff'),
    prettyJson: true,
    sampleSource: 'rehearsal',
  });
  const audit = await runAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAudit({
    bundleDir: bundle.outDir,
    expectedSampleSource: 'rehearsal',
    includeJsonText: true,
    prettyJson: true,
  });

  assert.equal(audit.kind, 'agent-session-v3-pilot-real-corpus-batch-handoff-phase-coverage-consistency-audit');
  assert.equal(audit.version, 1);
  assert.equal(audit.readyForProductionRuntime, false);
  assert.equal(audit.status, 'consistent');
  assert.equal(audit.issueCount, 0);
  assert.deepEqual(
    audit.entries.map((entry) => entry.status),
    ['consistent', 'consistent'],
  );
  assert.deepEqual(audit.entries[0]?.bundlePhaseCoverage, cleanPhaseCoverage);
  assert.deepEqual(audit.entries[0]?.artifactIntegrityPhaseCoverage, cleanPhaseCoverage);
  assert.deepEqual(audit.entries[0]?.reviewerPacketPhaseCoverage, cleanPhaseCoverage);
  assert.equal(audit.entries[0]?.sourcePreflightRollupPhaseCoverage, null);
  assert.match(audit.summaryText, /status=consistent/u);
  assert.match(audit.reportText, /phaseCoverageConsistencyEntries:/u);
  assert.match(audit.reportText, /role=review-summary-json/u);
  assert.match(audit.reportText, /bundle=clean:1/u);
  assert.match(audit.reportText, /phaseCoverageConsistencyIssues: none/u);
  assertReportTextContainsIssueCodes(audit);
  assert.ok(audit.jsonText);
  assert.deepEqual(JSON.parse(audit.jsonText), {
    ...audit,
    jsonText: null,
  });

  const sourcePreflightRollup = await runAgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollup({
    entries: [
      {
        expectedSampleSource: 'rehearsal',
        handoffBundleDir: bundle.outDir,
        intakeDir: example.intakeDirs.ready,
        label: 'consistent-rehearsal',
      },
    ],
    prettyJson: true,
  });
  const sourcePreflightRollupJsonPath = path.join(tempDir, 'source-preflight-rollup.json');
  await writeFile(
    sourcePreflightRollupJsonPath,
    JSON.stringify(sourcePreflightRollup, null, 2),
    'utf8',
  );
  const rollupAudit = await runAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAudit({
    bundleDir: bundle.outDir,
    expectedSampleSource: 'rehearsal',
    prettyJson: true,
    sourcePreflightRollupJsonPath,
  });

  assert.equal(rollupAudit.status, 'consistent');
  assert.deepEqual(rollupAudit.entries[0]?.sourcePreflightRollupPhaseCoverage, cleanPhaseCoverage);
  assert.deepEqual(rollupAudit.entries[1]?.sourcePreflightRollupPhaseCoverage, cleanPhaseCoverage);
  assert.match(rollupAudit.reportText, /sourcePreflightRollup=clean:1/u);
  assertReportTextContainsIssueCodes(rollupAudit);

  const driftBundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'drift-handoff'),
    prettyJson: true,
    sampleSource: 'rehearsal',
  });
  const reviewSummaryJson = JSON.parse(await readFile(driftBundle.reviewSummaryJsonPath, 'utf8'));
  await writeFile(
    driftBundle.reviewSummaryJsonPath,
    JSON.stringify({
      ...reviewSummaryJson,
      intakeEntries: reviewSummaryJson.intakeEntries.map((entry: Record<string, unknown>) => ({
        ...entry,
        phaseCoverageCounts: {
          ...(entry.phaseCoverageCounts as Record<string, unknown>),
          status: 'needs-review',
        },
      })),
    }, null, 2),
    'utf8',
  );
  const driftAudit = await runAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAudit({
    bundleDir: driftBundle.outDir,
    expectedSampleSource: 'rehearsal',
    prettyJson: true,
  });

  assert.equal(driftAudit.status, 'consistent');
  assert.equal(driftAudit.issueCount, 0);
  assertReportTextContainsIssueCodes(driftAudit);
  assert.deepEqual(driftAudit.entries[0]?.bundlePhaseCoverage, {
    entryCount: 1,
    statusCounts: {
      'needs-review': 1,
    },
    statuses: [
      'needs-review',
    ],
  });

  const staleSourcePreflightRollupJsonPath = path.join(tempDir, 'stale-source-preflight-rollup.json');
  await writeFile(
    staleSourcePreflightRollupJsonPath,
    JSON.stringify({
      ...sourcePreflightRollup,
      entries: sourcePreflightRollup.entries.map((entry) => ({
        ...entry,
        handoffBundleDir: driftBundle.outDir,
      })),
    }, null, 2),
    'utf8',
  );
  const staleRollupAudit = await runAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAudit({
    bundleDir: driftBundle.outDir,
    expectedSampleSource: 'rehearsal',
    prettyJson: true,
    sourcePreflightRollupJsonPath: staleSourcePreflightRollupJsonPath,
  });

  assert.equal(staleRollupAudit.status, 'review-needed');
  assert.ok(staleRollupAudit.issues.some((issue) => (
    issue.code === 'source-preflight-rollup-phase-coverage-mismatch'
  )));
  assert.match(staleRollupAudit.reportText, /phaseCoverageConsistencyIssues:/u);
  assertReportTextContainsIssueCodes(staleRollupAudit);

  const missingJsonBundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'missing-json-handoff'),
    prettyJson: true,
    sampleSource: 'rehearsal',
  });
  await rm(missingJsonBundle.reviewSummaryJsonPath, {
    force: true,
  });
  const missingJsonAudit = await runAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAudit({
    bundleDir: missingJsonBundle.outDir,
    expectedSampleSource: 'rehearsal',
    prettyJson: true,
  });

  assert.equal(missingJsonAudit.status, 'review-needed');
  assert.ok(missingJsonAudit.issues.some((issue) => (
    issue.code === 'missing-artifact-json'
    && issue.detail.includes('review-summary')
  )));
  assert.ok(!missingJsonAudit.issues.some((issue) => (
    issue.code === 'invalid-artifact-json'
    && issue.detail.includes('review-summary')
  )));
  assertReportTextContainsIssueCodes(missingJsonAudit);

  const invalidJsonBundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'invalid-json-handoff'),
    prettyJson: true,
    sampleSource: 'rehearsal',
  });
  await writeFile(
    invalidJsonBundle.rollupJsonPath,
    '{ invalid json',
    'utf8',
  );
  const invalidJsonAudit = await runAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAudit({
    bundleDir: invalidJsonBundle.outDir,
    expectedSampleSource: 'rehearsal',
    prettyJson: true,
  });

  assert.equal(invalidJsonAudit.status, 'review-needed');
  assert.ok(invalidJsonAudit.issues.some((issue) => (
    issue.code === 'invalid-artifact-json'
    && issue.detail.includes('readiness-rollup')
  )));
  assert.ok(!invalidJsonAudit.issues.some((issue) => (
    issue.code === 'missing-artifact-json'
    && issue.detail.includes('readiness-rollup')
  )));
  assertReportTextContainsIssueCodes(invalidJsonAudit);

  const missingSourceRollupAudit = await runAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAudit({
    bundleDir: bundle.outDir,
    expectedSampleSource: 'rehearsal',
    prettyJson: true,
    sourcePreflightRollupJsonPath: path.join(tempDir, 'missing-source-preflight-rollup.json'),
  });

  assert.equal(missingSourceRollupAudit.status, 'review-needed');
  assert.ok(missingSourceRollupAudit.issues.some((issue) => (
    issue.code === 'missing-source-preflight-rollup-json'
  )));
  assert.ok(!missingSourceRollupAudit.issues.some((issue) => (
    issue.code === 'missing-artifact-json'
  )));
  assert.match(missingSourceRollupAudit.reportText, /missing-source-preflight-rollup-json/u);
  assertReportTextContainsIssueCodes(missingSourceRollupAudit);

  const invalidSourceRollupJsonPath = path.join(tempDir, 'invalid-source-preflight-rollup.json');
  await writeFile(
    invalidSourceRollupJsonPath,
    '{ invalid source rollup json',
    'utf8',
  );
  const invalidSourceRollupAudit = await runAgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAudit({
    bundleDir: bundle.outDir,
    expectedSampleSource: 'rehearsal',
    prettyJson: true,
    sourcePreflightRollupJsonPath: invalidSourceRollupJsonPath,
  });

  assert.equal(invalidSourceRollupAudit.status, 'review-needed');
  assert.ok(invalidSourceRollupAudit.issues.some((issue) => (
    issue.code === 'invalid-source-preflight-rollup-json'
  )));
  assert.ok(!invalidSourceRollupAudit.issues.some((issue) => (
    issue.code === 'invalid-artifact-json'
  )));
  assert.match(invalidSourceRollupAudit.reportText, /invalid-source-preflight-rollup-json/u);
  assertReportTextContainsIssueCodes(invalidSourceRollupAudit);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch handoff phase coverage consistency audit smoke ok');
