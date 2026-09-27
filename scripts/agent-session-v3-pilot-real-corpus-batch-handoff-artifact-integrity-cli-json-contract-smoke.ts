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

function assertStringArrayOrNull(value: unknown, label: string) {
  if (value === null) {
    return;
  }

  assert.ok(Array.isArray(value), `${label} should be an array or null.`);
  for (const entry of value) {
    assertStringValue(entry, `${label} entry`);
  }
}

function assertPhaseCoverageObservationShape(value: unknown, label: string) {
  if (value === null) {
    return;
  }

  const phaseCoverage = assertObjectRecord(value, label);
  assertNumberValue(phaseCoverage.entryCount, `${label}.entryCount`);
  assertStringArrayOrNull(phaseCoverage.statuses, `${label}.statuses`);
  assertObjectRecord(phaseCoverage.statusCounts, `${label}.statusCounts`);
}

function assertObservationShape(value: unknown) {
  const observation = assertObjectRecord(value, 'observation');

  assertStringValue(observation.label, 'observation.label');
  assertStringValue(observation.path, 'observation.path');
  assert.equal(typeof observation.present, 'boolean');
  assertStringValue(observation.role, 'observation.role');
  assert.ok(
    observation.expectedKind === null || typeof observation.expectedKind === 'string',
    'observation.expectedKind should be string or null.',
  );
  assert.ok(
    observation.expectedStatus === null || typeof observation.expectedStatus === 'string',
    'observation.expectedStatus should be string or null.',
  );
  assert.ok(
    observation.jsonKind === null || typeof observation.jsonKind === 'string',
    'observation.jsonKind should be string or null.',
  );
  assert.ok(
    observation.jsonStatus === null || typeof observation.jsonStatus === 'string',
    'observation.jsonStatus should be string or null.',
  );
  assert.ok(
    observation.optionalEvidenceReportCount === null || typeof observation.optionalEvidenceReportCount === 'number',
    'observation.optionalEvidenceReportCount should be number or null.',
  );
  assertStringArrayOrNull(
    observation.optionalEvidenceReportPaths,
    'observation.optionalEvidenceReportPaths',
  );
  assertPhaseCoverageObservationShape(
    observation.phaseCoverage,
    'observation.phaseCoverage',
  );
}

function assertIssueShape(value: unknown) {
  const issue = assertObjectRecord(value, 'issue');

  assertStringValue(issue.code, 'issue.code');
  assertStringValue(issue.detail, 'issue.detail');
  assertStringValue(issue.path, 'issue.path');
  assert.equal(issue.severity, 'blocker');
  assertStringValue(issue.role, 'issue.role');
}

function assertIntegrityContract(result: Record<string, unknown>) {
  assert.equal(result.kind, 'agent-session-v3-pilot-real-corpus-batch-handoff-artifact-integrity-report');
  assert.equal(result.version, 1);
  assert.match(String(result.status), /^(blocked|valid)$/u);
  assertStringValue(result.bundleDir, 'bundleDir');
  assertStringValue(result.handoffIndexPath, 'handoffIndexPath');
  assertStringValue(result.reportText, 'reportText');
  assertStringValue(result.summaryText, 'summaryText');
  assertNumberValue(result.artifactCount, 'artifactCount');
  assertNumberValue(result.presentArtifactCount, 'presentArtifactCount');
  assertNumberValue(result.missingArtifactCount, 'missingArtifactCount');
  assertNumberValue(result.issueCount, 'issueCount');
  assertNumberValue(result.blockerCount, 'blockerCount');
  assert.ok(Array.isArray(result.observations), 'observations should be an array.');
  for (const observation of result.observations) {
    assertObservationShape(observation);
  }
  assert.ok(Array.isArray(result.issues), 'issues should be an array.');
  for (const issue of result.issues) {
    assertIssueShape(issue);
  }
}

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-artifact-integrity-report.ts',
});

assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-handoff-artifact-integrity-report.ts CLI JSON contract',
);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-handoff-artifact-integrity-json-'));
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
    '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-handoff-artifact-integrity-report.ts',
    '--dir',
    bundle.outDir,
    '--pretty',
  ]);

  assert.equal(
    cliResult.status,
    0,
    cliResult.stderr || cliResult.stdout || cliResult.error?.message,
  );
  assert.match(cliResult.stdout, /AgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReport status=valid/u);
  assert.match(cliResult.stdout, /handoffArtifactIntegrityIssues: none/u);
  assert.match(cliResult.stdout, /role=review-summary-json/u);
  assert.match(cliResult.stdout, /optionalEvidenceReports=1/u);
  assert.match(cliResult.stdout, /optionalEvidenceReportPaths=scripts\/agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit\.ts/u);
  assert.match(cliResult.stdout, /phaseCoverageEntries=1/u);
  assert.match(cliResult.stdout, /phaseCoverageStatuses=clean:1/u);
  assert.match(cliResult.stdout, /role=operator-checklist-json/u);

  const result = parseTrailingJsonObject(cliResult.stdout);
  assertIntegrityContract(result);
  assert.equal(result.status, 'valid');
  assert.equal(result.issueCount, 0);
  assert.equal(result.blockerCount, 0);
  assert.equal(result.artifactCount, 9);
  assert.equal(result.presentArtifactCount, 9);
  assert.equal(result.missingArtifactCount, 0);
  const observations = result.observations as Record<string, unknown>[];
  const reviewSummaryObservation = observations.find((observation) => (
    observation.role === 'review-summary-json'
  ));
  assert.ok(reviewSummaryObservation, 'CLI JSON should include review summary artifact observation.');
  assert.equal(reviewSummaryObservation.optionalEvidenceReportCount, 1);
  assert.deepEqual(reviewSummaryObservation.optionalEvidenceReportPaths, [
    'scripts/agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts',
  ]);
  assert.deepEqual(reviewSummaryObservation.phaseCoverage, {
    entryCount: 1,
    statusCounts: {
      clean: 1,
    },
    statuses: [
      'clean',
    ],
  });
  const readinessRollupObservation = observations.find((observation) => (
    observation.role === 'readiness-rollup-json'
  ));
  assert.ok(readinessRollupObservation, 'CLI JSON should include readiness rollup artifact observation.');
  assert.deepEqual(readinessRollupObservation.phaseCoverage, {
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
    '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-handoff-artifact-integrity-report.ts',
    '--dir',
    degradedBundle.outDir,
    '--pretty',
  ]);
  assert.equal(
    degradedCliResult.status,
    0,
    degradedCliResult.stderr || degradedCliResult.stdout || degradedCliResult.error?.message,
  );
  assert.match(degradedCliResult.stdout, /AgentSessionV3PilotRealCorpusBatchHandoffArtifactIntegrityReport status=valid/u);
  assert.match(degradedCliResult.stdout, /handoffArtifactIntegrityIssues: none/u);
  assert.match(degradedCliResult.stdout, /optionalEvidenceReports=0/u);
  assert.match(degradedCliResult.stdout, /phaseCoverageStatuses=clean:1/u);

  const degradedResult = parseTrailingJsonObject(degradedCliResult.stdout);
  assertIntegrityContract(degradedResult);
  assert.equal(degradedResult.status, 'valid');
  assert.equal(degradedResult.issueCount, 0);
  assert.equal(degradedResult.blockerCount, 0);
  const degradedObservations = degradedResult.observations as Record<string, unknown>[];
  const degradedReviewSummaryObservation = degradedObservations.find((observation) => (
    observation.role === 'review-summary-json'
  ));
  assert.ok(degradedReviewSummaryObservation, 'degraded CLI JSON should include review summary artifact observation.');
  assert.equal(degradedReviewSummaryObservation.optionalEvidenceReportCount, 0);
  assert.deepEqual(degradedReviewSummaryObservation.optionalEvidenceReportPaths, []);
  assert.deepEqual(degradedReviewSummaryObservation.phaseCoverage, {
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

console.log('agent session v3 pilot real corpus batch handoff artifact integrity CLI JSON contract smoke ok');
