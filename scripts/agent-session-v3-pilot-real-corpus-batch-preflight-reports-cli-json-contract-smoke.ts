import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  assertNumberRecordKeys,
  assertObjectRecord,
  assertSourceDoesNotUseRuntimeOrFixedDesktopChain,
  parseTrailingJsonObject,
} from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeTemplate } from './agent-session-v3-pilot-real-corpus-batch-intake-template.ts';
import { projectRoot, readProjectSources } from './smokeTestHarness.ts';

function runReportCli(scriptName: string, intakeDir: string) {
  const cliArgs = [
    'tsx',
    `.\\scripts\\${scriptName}`,
    '--dir',
    intakeDir,
    '--pretty',
  ];

  return process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/c', 'npx.cmd', ...cliArgs], {
      cwd: projectRoot,
      encoding: 'utf8',
    })
    : spawnSync('npx', cliArgs, {
      cwd: projectRoot,
      encoding: 'utf8',
    });
}

function runReportJson(scriptName: string, intakeDir: string) {
  const result = runReportCli(scriptName, intakeDir);

  assert.equal(
    result.status,
    0,
    result.stderr || result.stdout || result.error?.message,
  );

  return parseTrailingJsonObject(result.stdout);
}

function assertStringValue(value: unknown, label: string) {
  assert.equal(typeof value, 'string', `${label} should be a string.`);
}

function assertNullableStringValue(value: unknown, label: string) {
  assert.ok(value === null || typeof value === 'string', `${label} should be a string or null.`);
}

function assertArrayValue(value: unknown, label: string) {
  assert.ok(Array.isArray(value), `${label} should be an array.`);

  return value;
}

function assertBaseReportContract(options: {
  allowedStatuses: readonly string[];
  kind: string;
  report: Record<string, unknown>;
}) {
  assert.equal(options.report.kind, options.kind);
  assert.equal(options.report.version, 1);
  assertStringValue(options.report.status, 'status');
  assert.ok(options.allowedStatuses.includes(String(options.report.status)));
  assertStringValue(options.report.intakeDir, 'intakeDir');
  assertStringValue(options.report.summaryText, 'summaryText');
  assertStringValue(options.report.reportText, 'reportText');
  assertNumberRecordKeys(options.report, ['issueCount'], options.kind);
}

function assertSchemaIssueShape(issue: unknown) {
  const issueRecord = assertObjectRecord(issue, 'schema issue');

  assertStringValue(issueRecord.code, 'schema issue code');
  assertStringValue(issueRecord.label, 'schema issue label');
  assertStringValue(issueRecord.message, 'schema issue message');
  assertStringValue(issueRecord.path, 'schema issue path');
  assertStringValue(issueRecord.scope, 'schema issue scope');
}

function assertPathHealthEntryShape(entry: unknown) {
  const entryRecord = assertObjectRecord(entry, 'path-health entry');

  assertStringValue(entryRecord.declaredPath, 'path-health declaredPath');
  assertNullableStringValue(entryRecord.errorMessage, 'path-health errorMessage');
  assertStringValue(entryRecord.label, 'path-health label');
  assertStringValue(entryRecord.resolvedPath, 'path-health resolvedPath');
  assertStringValue(entryRecord.scope, 'path-health scope');
  assertStringValue(entryRecord.status, 'path-health status');
}

function assertConsistencyIssueShape(issue: unknown) {
  const issueRecord = assertObjectRecord(issue, 'consistency issue');

  assertStringValue(issueRecord.code, 'consistency issue code');
  assertStringValue(issueRecord.label, 'consistency issue label');
  assertNullableStringValue(issueRecord.manifestPath, 'consistency issue manifestPath');
  assertStringValue(issueRecord.message, 'consistency issue message');
  assertStringValue(issueRecord.scope, 'consistency issue scope');
}

function assertSourceKindSummaryShape(summary: unknown) {
  const summaryRecord = assertObjectRecord(summary, 'consistency source kind summary');

  assert.equal(typeof summaryRecord.count, 'number');
  assertStringValue(summaryRecord.sourceKind, 'consistency sourceKind');
}

function assertSchemaReportContract(report: Record<string, unknown>) {
  assertBaseReportContract({
    allowedStatuses: ['issues', 'missing', 'valid'],
    kind: 'agent-session-v3-pilot-real-corpus-batch-schema-shape-report',
    report,
  });
  assertNumberRecordKeys(report, ['manifestSourceCount', 'indexBatchCount'], 'schema report');

  for (const issue of assertArrayValue(report.issues, 'schema issues')) {
    assertSchemaIssueShape(issue);
  }
}

function assertPathHealthReportContract(report: Record<string, unknown>) {
  assertBaseReportContract({
    allowedStatuses: ['healthy', 'issues', 'missing'],
    kind: 'agent-session-v3-pilot-real-corpus-batch-path-health-report',
    report,
  });
  assertNumberRecordKeys(report, ['manifestSourceCount', 'indexManifestCount'], 'path-health report');

  for (const entry of assertArrayValue(report.entries, 'path-health entries')) {
    assertPathHealthEntryShape(entry);
  }
  for (const issue of assertArrayValue(report.issues, 'path-health issues')) {
    assertPathHealthEntryShape(issue);
  }
}

function assertConsistencyReportContract(report: Record<string, unknown>) {
  assertBaseReportContract({
    allowedStatuses: ['consistent', 'issues', 'missing'],
    kind: 'agent-session-v3-pilot-real-corpus-batch-consistency-report',
    report,
  });
  assert.equal(typeof report.baselineEntryPresent, 'boolean');
  assert.equal(typeof report.currentManifestReferenced, 'boolean');
  assertNumberRecordKeys(report, ['manifestSourceCount', 'indexBatchCount'], 'consistency report');

  for (const issue of assertArrayValue(report.issues, 'consistency issues')) {
    assertConsistencyIssueShape(issue);
  }
  for (const summary of assertArrayValue(report.sourceKindSummaries, 'consistency source kind summaries')) {
    assertSourceKindSummaryShape(summary);
  }
}

const reportScripts = [
  'agent-session-v3-pilot-real-corpus-batch-schema-shape-report.ts',
  'agent-session-v3-pilot-real-corpus-batch-path-health-report.ts',
  'agent-session-v3-pilot-real-corpus-batch-consistency-report.ts',
];
const reportSources = readProjectSources({
  'agent-session-v3-pilot-real-corpus-batch-consistency-report.ts':
    'scripts/agent-session-v3-pilot-real-corpus-batch-consistency-report.ts',
  'agent-session-v3-pilot-real-corpus-batch-path-health-report.ts':
    'scripts/agent-session-v3-pilot-real-corpus-batch-path-health-report.ts',
  'agent-session-v3-pilot-real-corpus-batch-schema-shape-report.ts':
    'scripts/agent-session-v3-pilot-real-corpus-batch-schema-shape-report.ts',
});

for (const scriptName of reportScripts) {
  const source = reportSources[scriptName];
  assert.match(
    source,
    /--dir/u,
    `${scriptName} should expose an intake directory argument.`,
  );
  assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
    source,
    `${scriptName} CLI JSON contract`,
  );
}

const missingTempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-preflight-json-contract-missing-'));
try {
  const missingSchema = runReportJson(reportScripts[0], missingTempDir);
  assertSchemaReportContract(missingSchema);
  assert.equal(missingSchema.status, 'missing');
  assert.equal(missingSchema.issueCount, 2);
  assert.equal(missingSchema.manifestSourceCount, 0);
  assert.equal(missingSchema.indexBatchCount, 0);
  assert.ok((missingSchema.issues as unknown[]).some((issue) => (
    (issue as Record<string, unknown>).scope === 'manifest'
      && (issue as Record<string, unknown>).code === 'missing-required-file'
  )));
  assert.ok((missingSchema.issues as unknown[]).some((issue) => (
    (issue as Record<string, unknown>).scope === 'index'
      && (issue as Record<string, unknown>).code === 'missing-required-file'
  )));

  const missingPathHealth = runReportJson(reportScripts[1], missingTempDir);
  assertPathHealthReportContract(missingPathHealth);
  assert.equal(missingPathHealth.status, 'missing');
  assert.equal(missingPathHealth.issueCount, 2);
  assert.equal(missingPathHealth.manifestSourceCount, 0);
  assert.equal(missingPathHealth.indexManifestCount, 0);
  assert.equal((missingPathHealth.entries as unknown[]).length, 2);
  assert.ok((missingPathHealth.issues as unknown[]).every((issue) => (
    (issue as Record<string, unknown>).scope === 'required'
      && (issue as Record<string, unknown>).status === 'missing'
  )));

  const missingConsistency = runReportJson(reportScripts[2], missingTempDir);
  assertConsistencyReportContract(missingConsistency);
  assert.equal(missingConsistency.status, 'missing');
  assert.equal(missingConsistency.issueCount, 2);
  assert.equal(missingConsistency.baselineEntryPresent, false);
  assert.equal(missingConsistency.currentManifestReferenced, false);
  assert.equal(missingConsistency.manifestSourceCount, 0);
  assert.equal(missingConsistency.indexBatchCount, 0);
  assert.ok((missingConsistency.issues as unknown[]).every((issue) => (
    (issue as Record<string, unknown>).code === 'missing-required-file'
  )));
} finally {
  await rm(missingTempDir, {
    force: true,
    recursive: true,
  });
}

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-real-corpus-preflight-json-contract-'));
try {
  await runAgentSessionV3PilotRealCorpusBatchIntakeTemplate({
    outDir: tempDir,
    prettyJson: true,
  });
  await mkdir(path.join(tempDir, 'corpora'), {
    recursive: true,
  });
  await mkdir(path.join(tempDir, 'baseline'), {
    recursive: true,
  });
  await writeFile(
    path.join(tempDir, 'corpora', 'replace-with-debug-corpus.json'),
    JSON.stringify({ placeholder: true }),
    'utf8',
  );
  await writeFile(
    path.join(tempDir, 'baseline', 'explicit-debug-corpus-manifest.json'),
    JSON.stringify({ placeholder: true }),
    'utf8',
  );

  const schema = runReportJson(reportScripts[0], tempDir);
  assertSchemaReportContract(schema);
  assert.equal(schema.status, 'valid');
  assert.equal(schema.issueCount, 0);
  assert.equal(schema.manifestSourceCount, 1);
  assert.equal(schema.indexBatchCount, 2);
  assert.deepEqual(schema.issues, []);

  const pathHealth = runReportJson(reportScripts[1], tempDir);
  assertPathHealthReportContract(pathHealth);
  assert.equal(pathHealth.status, 'healthy');
  assert.equal(pathHealth.issueCount, 0);
  assert.equal(pathHealth.manifestSourceCount, 1);
  assert.equal(pathHealth.indexManifestCount, 2);
  assert.equal((pathHealth.entries as unknown[]).length, 5);
  assert.deepEqual(pathHealth.issues, []);

  const consistency = runReportJson(reportScripts[2], tempDir);
  assertConsistencyReportContract(consistency);
  assert.equal(consistency.status, 'consistent');
  assert.equal(consistency.issueCount, 0);
  assert.equal(consistency.manifestSourceCount, 1);
  assert.equal(consistency.indexBatchCount, 2);
  assert.equal(consistency.baselineEntryPresent, true);
  assert.equal(consistency.currentManifestReferenced, true);
  assert.deepEqual(consistency.issues, []);
  assert.ok((consistency.sourceKindSummaries as unknown[]).some((summary) => (
    (summary as Record<string, unknown>).sourceKind === 'baseline'
      && (summary as Record<string, unknown>).count === 1
  )));
  assert.ok((consistency.sourceKindSummaries as unknown[]).some((summary) => (
    (summary as Record<string, unknown>).sourceKind === 'production-like'
      && (summary as Record<string, unknown>).count === 1
  )));
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch preflight reports CLI JSON contract smoke ok');
