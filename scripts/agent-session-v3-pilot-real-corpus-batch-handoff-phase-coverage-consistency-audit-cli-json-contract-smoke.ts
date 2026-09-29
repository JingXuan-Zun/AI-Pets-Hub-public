import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  assertObjectRecord,
  assertSourceDoesNotUseRuntimeOrFixedDesktopChain,
  parseTrailingJsonObject,
} from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import {
  AGENT_SESSION_V3_PILOT_REAL_CORPUS_BATCH_HANDOFF_PHASE_COVERAGE_CONSISTENCY_AUDIT_ISSUE_CODES,
} from './agent-session-v3-pilot-real-corpus-batch-handoff-phase-coverage-consistency-audit.ts';
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

const expectedIssueCodeSet = new Set<string>(
  AGENT_SESSION_V3_PILOT_REAL_CORPUS_BATCH_HANDOFF_PHASE_COVERAGE_CONSISTENCY_AUDIT_ISSUE_CODES,
);

function assertIssueCode(value: unknown) {
  assertStringValue(value, 'issue.code');
  assert.ok(
    expectedIssueCodeSet.has(value),
    `issue.code should be one of ${AGENT_SESSION_V3_PILOT_REAL_CORPUS_BATCH_HANDOFF_PHASE_COVERAGE_CONSISTENCY_AUDIT_ISSUE_CODES.join(', ')}.`,
  );
}

function assertPhaseCoverageObservationShape(value: unknown, label: string) {
  if (value === null) {
    return;
  }

  const observation = assertObjectRecord(value, label);
  assertNumberValue(observation.entryCount, `${label}.entryCount`);
  assertObjectRecord(observation.statusCounts, `${label}.statusCounts`);
  assert.ok(Array.isArray(observation.statuses), `${label}.statuses should be an array.`);
}

function assertEntryShape(value: unknown) {
  const entry = assertObjectRecord(value, 'entry');

  assertStringValue(entry.label, 'entry.label');
  assert.match(String(entry.role), /^(readiness-rollup-json|review-summary-json)$/u);
  assert.match(String(entry.status), /^(consistent|review-needed)$/u);
  assertPhaseCoverageObservationShape(entry.bundlePhaseCoverage, 'entry.bundlePhaseCoverage');
  assertPhaseCoverageObservationShape(entry.artifactIntegrityPhaseCoverage, 'entry.artifactIntegrityPhaseCoverage');
  assertPhaseCoverageObservationShape(entry.reviewerPacketPhaseCoverage, 'entry.reviewerPacketPhaseCoverage');
  assertPhaseCoverageObservationShape(entry.sourcePreflightRollupPhaseCoverage, 'entry.sourcePreflightRollupPhaseCoverage');
}

function assertAuditContract(result: Record<string, unknown>) {
  assert.equal(result.kind, 'agent-session-v3-pilot-real-corpus-batch-handoff-phase-coverage-consistency-audit');
  assert.equal(result.version, 1);
  assert.equal(result.readyForProductionRuntime, false);
  assert.match(String(result.status), /^(consistent|review-needed)$/u);
  assertStringValue(result.bundleDir, 'bundleDir');
  assertStringValue(result.reportText, 'reportText');
  assertStringValue(result.summaryText, 'summaryText');
  assertNumberValue(result.issueCount, 'issueCount');
  assert.ok(Array.isArray(result.entries), 'entries should be an array.');
  for (const entry of result.entries) {
    assertEntryShape(entry);
  }
  assert.ok(Array.isArray(result.issues), 'issues should be an array.');
  for (const issue of result.issues) {
    const issueRecord = assertObjectRecord(issue, 'issue');
    assertIssueCode(issueRecord.code);
    assertStringValue(issueRecord.detail, 'issue.detail');
    assert.equal(issueRecord.severity, 'review');
  }
}

const { planText, source } = readProjectSources({
  planText: 'PROJECT_AGENT_V3_PILOT_PLAN.md',
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-phase-coverage-consistency-audit.ts',
});

assert.match(
  source,
  /AGENT_SESSION_V3_PILOT_REAL_CORPUS_BATCH_HANDOFF_PHASE_COVERAGE_CONSISTENCY_AUDIT_ISSUE_CODES/u,
  'handoff phase coverage consistency audit should export issue-code source of truth.',
);
for (const issueCode of AGENT_SESSION_V3_PILOT_REAL_CORPUS_BATCH_HANDOFF_PHASE_COVERAGE_CONSISTENCY_AUDIT_ISSUE_CODES) {
  assert.ok(
    planText.includes(`\`${issueCode}\``),
    `v3 pilot plan should document handoff phase coverage issue code: ${issueCode}`,
  );
}
assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-handoff-phase-coverage-consistency-audit.ts CLI JSON contract',
);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-handoff-phase-coverage-audit-json-'));
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
    '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-handoff-phase-coverage-consistency-audit.ts',
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
  assert.match(cliResult.stdout, /AgentSessionV3PilotRealCorpusBatchHandoffPhaseCoverageConsistencyAudit status=consistent/u);
  assert.match(cliResult.stdout, /phaseCoverageConsistencyEntries:/u);
  assert.match(cliResult.stdout, /role=review-summary-json/u);
  assert.match(cliResult.stdout, /bundle=clean:1/u);
  assert.match(cliResult.stdout, /phaseCoverageConsistencyIssues: none/u);

  const result = parseTrailingJsonObject(cliResult.stdout);
  assertAuditContract(result);
  assert.equal(result.status, 'consistent');
  assert.equal(result.issueCount, 0);
  assert.equal((result.entries as unknown[]).length, 2);

  const invalidSourceRollupJsonPath = path.join(tempDir, 'invalid-source-preflight-rollup.json');
  await writeFile(
    invalidSourceRollupJsonPath,
    '{ invalid source rollup json',
    'utf8',
  );
  const invalidRollupCliResult = runCli([
    '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-handoff-phase-coverage-consistency-audit.ts',
    '--dir',
    bundle.outDir,
    '--expected-source',
    'rehearsal',
    '--source-rollup-json',
    invalidSourceRollupJsonPath,
    '--pretty',
  ]);

  assert.equal(
    invalidRollupCliResult.status,
    0,
    invalidRollupCliResult.stderr || invalidRollupCliResult.stdout || invalidRollupCliResult.error?.message,
  );
  assert.match(invalidRollupCliResult.stdout, /status=review-needed/u);
  assert.match(invalidRollupCliResult.stdout, /code=invalid-source-preflight-rollup-json/u);

  const invalidRollupResult = parseTrailingJsonObject(invalidRollupCliResult.stdout);
  assertAuditContract(invalidRollupResult);
  assert.equal(invalidRollupResult.status, 'review-needed');
  assert.ok((invalidRollupResult.issues as unknown[]).some((issue) => {
    const issueRecord = assertObjectRecord(issue, 'issue');

    return issueRecord.code === 'invalid-source-preflight-rollup-json';
  }));
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch handoff phase coverage consistency audit CLI JSON contract smoke ok');
