import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  assertObjectRecord,
  assertSourceDoesNotUseRuntimeOrFixedDesktopChain,
  parseTrailingJsonObject,
} from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { runAgentSessionV3PilotRealCorpusBatchHandoffBundle } from './agent-session-v3-pilot-real-corpus-batch-handoff-bundle.ts';
import { runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample } from './agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts';
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

function assertStringValue(value: unknown, label: string) {
  assert.equal(typeof value, 'string', `${label} should be a string.`);
}

function assertNumberValue(value: unknown, label: string) {
  assert.equal(typeof value, 'number', `${label} should be a number.`);
}

function assertStringArray(value: unknown, label: string) {
  assert.ok(Array.isArray(value), `${label} should be an array.`);
  for (const entry of value) {
    assert.equal(typeof entry, 'string', `${label} entries should be strings.`);
  }
}

function assertPhaseCoverageObservationShape(value: unknown, label: string) {
  if (value === null) {
    return;
  }

  const phaseCoverage = assertObjectRecord(value, label);
  assertNumberValue(phaseCoverage.entryCount, `${label}.entryCount`);
  assertStringArray(phaseCoverage.statuses, `${label}.statuses`);
  assertObjectRecord(phaseCoverage.statusCounts, `${label}.statusCounts`);
}

function assertIssueShape(value: unknown) {
  const issue = assertObjectRecord(value, 'issue');

  assertStringValue(issue.code, 'issue.code');
  assertStringValue(issue.detail, 'issue.detail');
  assert.match(String(issue.severity), /^(blocker|review)$/u);
}

function assertReviewerPacketContract(result: Record<string, unknown>) {
  assert.equal(result.kind, 'agent-session-v3-pilot-real-corpus-batch-handoff-reviewer-packet-summary');
  assert.equal(result.version, 1);
  assert.match(String(result.status), /^(blocked|ready-for-reviewer|review-needed)$/u);
  assertStringValue(result.bundleDir, 'bundleDir');
  assertNumberValue(result.issueCount, 'issueCount');
  assertNumberValue(result.blockerCount, 'blockerCount');
  assertNumberValue(result.reviewCount, 'reviewCount');
  assertNumberValue(result.optionalEvidenceReportCount, 'optionalEvidenceReportCount');
  assertStringArray(result.optionalEvidenceReportPaths, 'optionalEvidenceReportPaths');
  assertStringValue(result.reportText, 'reportText');
  assertStringValue(result.summaryText, 'summaryText');
  assert.ok(
    result.expectedSampleSource === null || typeof result.expectedSampleSource === 'string',
    'expectedSampleSource should be string or null.',
  );
  assert.ok(
    result.reviewSummaryStatus === null || typeof result.reviewSummaryStatus === 'string',
    'reviewSummaryStatus should be string or null.',
  );
  assert.ok(
    result.readinessRollupStatus === null || typeof result.readinessRollupStatus === 'string',
    'readinessRollupStatus should be string or null.',
  );
  assertPhaseCoverageObservationShape(
    result.reviewSummaryPhaseCoverage,
    'reviewSummaryPhaseCoverage',
  );
  assertPhaseCoverageObservationShape(
    result.readinessRollupPhaseCoverage,
    'readinessRollupPhaseCoverage',
  );
  assert.ok(
    result.sampleSourceStatus === null || typeof result.sampleSourceStatus === 'string',
    'sampleSourceStatus should be string or null.',
  );
  assertObjectRecord(result.artifactIntegrity, 'artifactIntegrity');
  assertObjectRecord(result.sampleSourceConsistency, 'sampleSourceConsistency');
  assert.ok(
    result.statusCounts === null || typeof result.statusCounts === 'object',
    'statusCounts should be object or null.',
  );
  assert.ok(Array.isArray(result.issues), 'issues should be an array.');
  for (const issue of result.issues) {
    assertIssueShape(issue);
  }
}

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-reviewer-packet-summary.ts',
});

assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-handoff-reviewer-packet-summary.ts CLI JSON contract',
);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-handoff-reviewer-packet-json-'));
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
  const cliResult = runCli([
    '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-handoff-reviewer-packet-summary.ts',
    '--dir',
    bundle.outDir,
    '--expected-source',
    'rehearsal',
    '--pretty',
  ]);

  assert.equal(
    cliResult.status,
    0,
    cliResult.stderr || cliResult.stdout || cliResult.error?.message,
  );
  assert.match(cliResult.stdout, /AgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummary status=ready-for-reviewer/u);
  assert.match(cliResult.stdout, /artifactIntegrityStatus: valid/u);
  assert.match(cliResult.stdout, /sampleSourceConsistencyStatus: consistent/u);
  assert.match(cliResult.stdout, /reviewSummaryPhaseCoverage: clean:1/u);
  assert.match(cliResult.stdout, /readinessRollupPhaseCoverage: clean:1/u);
  assert.match(cliResult.stdout, /optionalEvidenceReports: scripts\/agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit\.ts/u);
  assert.match(cliResult.stdout, /reviewerPacketIssues: none/u);

  const result = parseTrailingJsonObject(cliResult.stdout);
  assertReviewerPacketContract(result);
  assert.equal(result.status, 'ready-for-reviewer');
  assert.equal(result.issueCount, 0);
  assert.equal(result.blockerCount, 0);
  assert.equal(result.reviewCount, 0);
  assert.equal(result.optionalEvidenceReportCount, 1);
  assert.deepEqual(result.optionalEvidenceReportPaths, [
    'scripts/agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts',
  ]);
  assert.equal(result.reviewSummaryStatus, 'ready-for-manual-review');
  assert.equal(result.readinessRollupStatus, 'ready-for-manual-review');
  assert.equal(result.sampleSourceStatus, 'synthetic-rehearsal');
  assert.deepEqual(result.reviewSummaryPhaseCoverage, {
    entryCount: 1,
    statusCounts: {
      clean: 1,
    },
    statuses: [
      'clean',
    ],
  });
  assert.deepEqual(result.readinessRollupPhaseCoverage, {
    entryCount: 1,
    statusCounts: {
      clean: 1,
    },
    statuses: [
      'clean',
    ],
  });

  const degradedBundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'degraded-handoff'),
    prettyJson: true,
    sampleSource: 'rehearsal',
  });
  const degradedReviewSummaryJson = JSON.parse(await readFile(degradedBundle.reviewSummaryJsonPath, 'utf8'));
  delete degradedReviewSummaryJson.optionalEvidenceReports;
  await writeFile(
    degradedBundle.reviewSummaryJsonPath,
    JSON.stringify(degradedReviewSummaryJson, null, 2),
    'utf8',
  );
  const degradedCliResult = runCli([
    '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-handoff-reviewer-packet-summary.ts',
    '--dir',
    degradedBundle.outDir,
    '--expected-source',
    'rehearsal',
    '--pretty',
  ]);
  assert.equal(
    degradedCliResult.status,
    0,
    degradedCliResult.stderr || degradedCliResult.stdout || degradedCliResult.error?.message,
  );
  assert.match(degradedCliResult.stdout, /AgentSessionV3PilotRealCorpusBatchHandoffReviewerPacketSummary status=ready-for-reviewer/u);
  assert.match(degradedCliResult.stdout, /optionalEvidenceReports=0/u);
  assert.match(degradedCliResult.stdout, /reviewSummaryPhaseCoverage=clean:1/u);
  assert.match(degradedCliResult.stdout, /optionalEvidenceReports: none/u);
  assert.match(degradedCliResult.stdout, /reviewerPacketIssues: none/u);

  const degradedResult = parseTrailingJsonObject(degradedCliResult.stdout);
  assertReviewerPacketContract(degradedResult);
  assert.equal(degradedResult.status, 'ready-for-reviewer');
  assert.equal(degradedResult.issueCount, 0);
  assert.equal(degradedResult.blockerCount, 0);
  assert.equal(degradedResult.reviewCount, 0);
  assert.equal(degradedResult.optionalEvidenceReportCount, 0);
  assert.deepEqual(degradedResult.optionalEvidenceReportPaths, []);
  assert.deepEqual(degradedResult.reviewSummaryPhaseCoverage, {
    entryCount: 1,
    statusCounts: {
      clean: 1,
    },
    statuses: [
      'clean',
    ],
  });
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch handoff reviewer packet summary CLI JSON contract smoke ok');
