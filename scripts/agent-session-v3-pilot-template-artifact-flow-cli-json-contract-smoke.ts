import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
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

function runJsonCli(args: readonly string[]) {
  const result = runCli(args);

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

function assertStatusCounts(value: unknown, label: string) {
  return assertNumberRecordKeys(value, ['ready', 'mixed', 'notReady', 'empty'], label);
}

function assertManifestSourceShape(source: unknown) {
  const sourceRecord = assertObjectRecord(source, 'manifest source');

  assertStringValue(sourceRecord.label, 'manifest source label');
  assertStringValue(sourceRecord.path, 'manifest source path');
}

function assertManifestTemplateShape(manifest: unknown) {
  const manifestRecord = assertObjectRecord(manifest, 'template manifest');

  for (const source of assertArrayValue(manifestRecord.sources, 'template manifest sources')) {
    assertManifestSourceShape(source);
  }
  assertArrayValue(manifestRecord.thresholdProfiles, 'template manifest thresholdProfiles');
}

function assertIndexBatchShape(batch: unknown) {
  const batchRecord = assertObjectRecord(batch, 'index batch');

  assertNullableStringValue(batchRecord.generatedAt, 'index batch generatedAt');
  assertStringValue(batchRecord.label, 'index batch label');
  assertStringValue(batchRecord.manifestPath, 'index batch manifestPath');
  assertNullableStringValue(batchRecord.notes, 'index batch notes');
  assertStringValue(batchRecord.sourceKind, 'index batch sourceKind');
}

function assertIndexTemplateShape(index: unknown) {
  const indexRecord = assertObjectRecord(index, 'template index');

  assert.equal(indexRecord.version, 1);
  for (const batch of assertArrayValue(indexRecord.batches, 'template index batches')) {
    assertIndexBatchShape(batch);
  }
}

function assertIntakeTemplateContract(template: Record<string, unknown>) {
  assert.equal(template.kind, 'agent-session-v3-pilot-real-corpus-batch-intake-template');
  assert.equal(template.version, 1);
  assertStringValue(template.summaryText, 'intake template summaryText');
  assertStringValue(template.manifestPath, 'intake template manifestPath');
  assertStringValue(template.indexPath, 'intake template indexPath');
  assertStringValue(template.notePath, 'intake template notePath');
  assertStringValue(template.readmePath, 'intake template readmePath');
  assertStringValue(template.noteText, 'intake template noteText');
  assertStringValue(template.readmeText, 'intake template readmeText');
  assertManifestTemplateShape(template.manifest);
  assertIndexTemplateShape(template.index);
}

function assertBaselineManifestReportContract(report: unknown) {
  const reportRecord = assertObjectRecord(report, 'baseline manifest report');

  assert.equal(reportRecord.kind, 'agent-session-v3-pilot-baseline-corpus-manifest-report');
  assert.equal(reportRecord.version, 1);
  assertStringValue(reportRecord.corpusPath, 'baseline manifest report corpusPath');
  assertStringValue(reportRecord.manifestPath, 'baseline manifest report manifestPath');
  assertStringValue(reportRecord.status, 'baseline manifest report status');
  assert.equal(typeof reportRecord.scenarioCount, 'number');
  assertStringValue(reportRecord.summaryText, 'baseline manifest report summaryText');
  assert.ok(
    reportRecord.reportText === null || typeof reportRecord.reportText === 'string',
    'baseline manifest report reportText should be a string or null.',
  );

  const corpusExport = assertObjectRecord(reportRecord.corpusExport, 'baseline manifest report corpusExport');
  assert.equal(corpusExport.kind, 'agent-session-v3-pilot-explicit-debug-corpus-exporter');
  assert.equal(corpusExport.version, 1);
  assert.equal(typeof corpusExport.scenarioCount, 'number');

  const manifestLoader = assertObjectRecord(reportRecord.manifestLoader, 'baseline manifest report manifestLoader');
  assert.equal(manifestLoader.kind, 'agent-session-v3-pilot-external-sample-corpus-manifest-loader');
  assert.equal(manifestLoader.version, 1);
  assertStringValue(manifestLoader.status, 'baseline manifest report manifestLoader status');
  assert.equal(typeof manifestLoader.sourceCount, 'number');
}

function assertIndexReportEntryShape(entry: unknown) {
  const entryRecord = assertObjectRecord(entry, 'artifact index report entry');

  assertStringValue(entryRecord.diagnosticsStatus, 'artifact index report entry diagnosticsStatus');
  assertNullableStringValue(entryRecord.generatedAt, 'artifact index report entry generatedAt');
  assertStringValue(entryRecord.label, 'artifact index report entry label');
  assertStringValue(entryRecord.manifestPath, 'artifact index report entry manifestPath');
  assertNullableStringValue(entryRecord.notes, 'artifact index report entry notes');
  assert.equal(typeof entryRecord.sourceCount, 'number');
  assertStringValue(entryRecord.sourceKind, 'artifact index report entry sourceKind');
  assertStringValue(entryRecord.status, 'artifact index report entry status');
}

function assertSourceKindSummaryShape(summary: unknown) {
  const summaryRecord = assertObjectRecord(summary, 'artifact source-kind summary');

  assert.equal(typeof summaryRecord.manifestCount, 'number');
  assertStringValue(summaryRecord.sourceKind, 'artifact source-kind summary sourceKind');
  assertStatusCounts(summaryRecord.statusCounts, 'artifact source-kind summary statusCounts');
}

function assertIndexReportContract(report: unknown) {
  const reportRecord = assertObjectRecord(report, 'artifact index report');

  assert.equal(reportRecord.kind, 'agent-session-v3-pilot-corpus-batch-index-report');
  assert.equal(reportRecord.version, 1);
  assertStringValue(reportRecord.indexPath, 'artifact index report indexPath');
  assert.equal(typeof reportRecord.manifestCount, 'number');
  assertStringValue(reportRecord.summaryText, 'artifact index report summaryText');
  assertStringValue(reportRecord.reportText, 'artifact index report reportText');

  for (const entry of assertArrayValue(reportRecord.entries, 'artifact index report entries')) {
    assertIndexReportEntryShape(entry);
  }
  for (const summary of assertArrayValue(reportRecord.sourceKindSummaries, 'artifact index report sourceKindSummaries')) {
    assertSourceKindSummaryShape(summary);
  }

  const multiReport = assertObjectRecord(reportRecord.multiReport, 'artifact index report multiReport');
  assert.equal(multiReport.kind, 'agent-session-v3-pilot-multi-corpus-manifest-report');
  assert.equal(multiReport.version, 1);
  assertStatusCounts(multiReport.statusCounts, 'artifact index report multiReport statusCounts');
}

function assertArtifactFlowContract(flow: Record<string, unknown>) {
  assert.equal(flow.kind, 'agent-session-v3-pilot-baseline-evidence-artifact-flow');
  assert.equal(flow.version, 1);
  assertStringValue(flow.corpusPath, 'artifact flow corpusPath');
  assertStringValue(flow.manifestPath, 'artifact flow manifestPath');
  assertStringValue(flow.indexPath, 'artifact flow indexPath');
  assertStringValue(flow.summaryText, 'artifact flow summaryText');
  assertStringValue(flow.reportText, 'artifact flow reportText');
  assertBaselineManifestReportContract(flow.baselineReport);
  assertIndexReportContract(flow.indexReport);
}

for (const scriptName of [
  'agent-session-v3-pilot-real-corpus-batch-intake-template.ts',
  'agent-session-v3-pilot-baseline-evidence-artifact-flow.ts',
]) {
  const { scriptSource } = readProjectSources({
    scriptSource: `scripts/${scriptName}`,
  });

  assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
    scriptSource,
    `${scriptName} CLI JSON contract`,
  );
}

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-template-artifact-json-contract-'));
try {
  const intakeDir = path.join(tempDir, 'intake');
  const artifactDir = path.join(tempDir, 'artifact');

  const intakeTemplate = runJsonCli([
    '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-intake-template.ts',
    '--out-dir',
    intakeDir,
    '--pretty',
  ]);
  assertIntakeTemplateContract(intakeTemplate);
  assert.match(String(intakeTemplate.summaryText), /sources=1/u);
  assert.match(String(intakeTemplate.summaryText), /batches=2/u);
  assert.equal(
    assertArrayValue(assertObjectRecord(intakeTemplate.manifest, 'intake manifest').sources, 'intake manifest sources').length,
    1,
  );
  assert.equal(
    assertArrayValue(assertObjectRecord(intakeTemplate.index, 'intake index').batches, 'intake index batches').length,
    2,
  );
  assert.match(String(intakeTemplate.noteText), /Batch label: replace-with-real-batch-label/u);
  assert.match(String(intakeTemplate.readmeText), /Preferred report-only validation/u);

  const intakeFiles = (await readdir(intakeDir)).sort();
  assert.deepEqual(intakeFiles, [
    'README.md',
    'corpus-batch-index.json',
    'real-corpus-manifest.json',
    'sample-note-template.md',
  ]);
  const writtenManifest = JSON.parse(await readFile(String(intakeTemplate.manifestPath), 'utf8')) as Record<string, unknown>;
  const writtenIndex = JSON.parse(await readFile(String(intakeTemplate.indexPath), 'utf8')) as Record<string, unknown>;
  assert.equal(assertArrayValue(writtenManifest.sources, 'written manifest sources').length, 1);
  assert.equal(assertArrayValue(writtenIndex.batches, 'written index batches').length, 2);

  const artifactFlow = runJsonCli([
    '.\\scripts\\agent-session-v3-pilot-baseline-evidence-artifact-flow.ts',
    '--out-dir',
    artifactDir,
    '--max-shadow',
    '3',
    '--pretty',
  ]);
  assertArtifactFlowContract(artifactFlow);
  assert.match(String(artifactFlow.summaryText), /status=ready/u);
  assert.match(String(artifactFlow.reportText), /AgentSessionV3PilotCorpusBatchIndexReport/u);
  assert.equal(
    (assertObjectRecord(artifactFlow.baselineReport, 'artifact baselineReport')).status,
    'ready',
  );

  const indexReport = assertObjectRecord(artifactFlow.indexReport, 'artifact indexReport');
  assert.equal(indexReport.manifestCount, 1);
  assert.equal((indexReport.entries as unknown[]).length, 1);
  assert.equal((indexReport.sourceKindSummaries as unknown[]).length, 1);
  const artifactStatusCounts = assertObjectRecord(
    assertObjectRecord(indexReport.multiReport, 'artifact indexReport multiReport').statusCounts,
    'artifact multiReport statusCounts',
  );
  assert.equal(artifactStatusCounts.ready, 1);
  assert.equal(artifactStatusCounts.notReady, 0);

  const artifactFiles = (await readdir(artifactDir)).sort();
  assert.deepEqual(artifactFiles, [
    'corpus-batch-index.json',
    'explicit-debug-corpus-manifest.json',
    'explicit-debug-corpus.json',
  ]);
  const corpus = JSON.parse(await readFile(String(artifactFlow.corpusPath), 'utf8')) as Record<string, unknown>;
  const manifest = JSON.parse(await readFile(String(artifactFlow.manifestPath), 'utf8')) as Record<string, unknown>;
  const index = JSON.parse(await readFile(String(artifactFlow.indexPath), 'utf8')) as Record<string, unknown>;
  assert.equal(corpus.kind, 'agent-session-v3-pilot-debug-sample-corpus');
  assert.equal(assertArrayValue(manifest.sources, 'artifact manifest sources').length, 1);
  assert.equal(assertArrayValue(index.batches, 'artifact index batches').length, 1);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot template and artifact flow CLI JSON contract smoke ok');
