import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  createAgentSessionV3PilotDebugSampleCorpusExport,
  createAgentSessionV3PilotShadowAgreementReport,
  createAgentSessionV3PilotShadowAgreementReportExport,
  createAgentSessionV3PilotShadowDebugExport,
  runAgentSessionV3PilotShadowMode,
  type AgentSessionV3PilotShadowAgreement,
} from '../src/agent/legacy/index.ts';
import {
  assertNumberRecordKeys,
  assertObjectRecord,
  assertSourceDoesNotUseRuntimeOrFixedDesktopChain,
  parseTrailingJsonObject,
} from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { runAgentSessionV3PilotExternalSampleCorpusManifestTemplate } from './agent-session-v3-pilot-external-sample-corpus-manifest-template.ts';
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

function assertPhaseCoverageReadinessShape(value: unknown, label: string) {
  const phaseCoverageReadiness = assertObjectRecord(value, label);

  assert.equal(phaseCoverageReadiness.kind, 'agent-session-v3-pilot-phase-coverage-readiness');
  assert.equal(phaseCoverageReadiness.version, 1);
  assertStringValue(phaseCoverageReadiness.status, `${label}.status`);
  assert.ok(['clean', 'needs-review'].includes(String(phaseCoverageReadiness.status)));
  assert.equal(typeof phaseCoverageReadiness.failedCheckCount, 'number');
  assertArrayValue(phaseCoverageReadiness.affectedSampleLabels, `${label}.affectedSampleLabels`);
  assertArrayValue(phaseCoverageReadiness.checkSummaries, `${label}.checkSummaries`);

  return phaseCoverageReadiness;
}

function assertMultiManifestPhaseCoverageReadinessShape(value: unknown, label: string) {
  const phaseCoverageReadiness = assertObjectRecord(value, label);

  assertStringValue(phaseCoverageReadiness.status, `${label}.status`);
  assert.ok(['clean', 'needs-review'].includes(String(phaseCoverageReadiness.status)));
  assert.equal(typeof phaseCoverageReadiness.failedCheckCount, 'number');
  assert.equal(typeof phaseCoverageReadiness.failedManifestCount, 'number');
  assertArrayValue(phaseCoverageReadiness.failedCheckKeys, `${label}.failedCheckKeys`);
  assertArrayValue(phaseCoverageReadiness.manifestLabels, `${label}.manifestLabels`);
  assertStringValue(phaseCoverageReadiness.summaryText, `${label}.summaryText`);

  return phaseCoverageReadiness;
}

function assertManifestLoaderContract(loader: Record<string, unknown>) {
  assert.equal(loader.kind, 'agent-session-v3-pilot-external-sample-corpus-manifest-loader');
  assert.equal(loader.version, 1);
  assertStringValue(loader.manifestPath, 'loader.manifestPath');
  assertNullableStringValue(loader.fixturePath, 'loader.fixturePath');
  assertStringValue(loader.status, 'loader.status');
  assert.ok(['ready', 'mixed', 'not-ready', 'empty'].includes(String(loader.status)));
  assert.equal(typeof loader.sourceCount, 'number');
  assertStringValue(loader.summaryText, 'loader.summaryText');
  assert.ok(loader.reportText === null || typeof loader.reportText === 'string');

  const fixtureExport = assertObjectRecord(loader.fixtureExport, 'loader.fixtureExport');
  assertNumberRecordKeys(fixtureExport, ['batchCount', 'issueCount'], 'loader.fixtureExport');
  assertArrayValue(fixtureExport.issues, 'loader.fixtureExport.issues');

  const fixtureBatch = assertObjectRecord(loader.fixtureBatch, 'loader.fixtureBatch');
  assertStringValue(fixtureBatch.status, 'loader.fixtureBatch.status');
  assertNumberRecordKeys(fixtureBatch, ['intakeCount', 'issueCount'], 'loader.fixtureBatch');
  assertArrayValue(fixtureBatch.entries, 'loader.fixtureBatch.entries');
  const calibration = assertObjectRecord(fixtureBatch.calibration, 'loader.fixtureBatch.calibration');
  assertStatusCounts(calibration.counts, 'loader.fixtureBatch.calibration.counts');

  const diagnostics = assertObjectRecord(loader.diagnostics, 'loader.diagnostics');
  assertStringValue(diagnostics.status, 'loader.diagnostics.status');
  assertNumberRecordKeys(diagnostics, ['failedEntryCount', 'failedCheckCount'], 'loader.diagnostics');
  assertArrayValue(diagnostics.checkSummaries, 'loader.diagnostics.checkSummaries');
  assertPhaseCoverageReadinessShape(loader.phaseCoverageReadiness, 'loader.phaseCoverageReadiness');

  const profileComparison = assertObjectRecord(loader.profileComparison, 'loader.profileComparison');
  assertStringValue(profileComparison.status, 'loader.profileComparison.status');
  assertNumberRecordKeys(profileComparison, ['profileCount'], 'loader.profileComparison');
  assertArrayValue(profileComparison.entries, 'loader.profileComparison.entries');
}

function assertIndexEntryShape(entry: unknown) {
  const entryRecord = assertObjectRecord(entry, 'index entry');

  assertStringValue(entryRecord.diagnosticsStatus, 'index entry diagnosticsStatus');
  assertNullableStringValue(entryRecord.generatedAt, 'index entry generatedAt');
  assertStringValue(entryRecord.label, 'index entry label');
  assertStringValue(entryRecord.manifestPath, 'index entry manifestPath');
  assertNullableStringValue(entryRecord.notes, 'index entry notes');
  assert.equal(typeof entryRecord.phaseCoverageReadinessFailedCheckCount, 'number');
  assertArrayValue(entryRecord.phaseCoverageReadinessFailedCheckKeys, 'index entry phaseCoverageReadinessFailedCheckKeys');
  assertStringValue(entryRecord.phaseCoverageReadinessStatus, 'index entry phaseCoverageReadinessStatus');
  assert.ok(
    ['clean', 'needs-review'].includes(String(entryRecord.phaseCoverageReadinessStatus)),
    'index entry phaseCoverageReadinessStatus should be a known status.',
  );
  assert.equal(typeof entryRecord.sourceCount, 'number');
  assertStringValue(entryRecord.sourceKind, 'index entry sourceKind');
  assertStringValue(entryRecord.status, 'index entry status');
}

function assertSourceKindSummaryShape(summary: unknown) {
  const summaryRecord = assertObjectRecord(summary, 'source-kind summary');

  assert.equal(typeof summaryRecord.manifestCount, 'number');
  assert.equal(typeof summaryRecord.phaseCoverageFailedCheckCount, 'number');
  assertArrayValue(summaryRecord.phaseCoverageFailedCheckKeys, 'source-kind summary phaseCoverageFailedCheckKeys');
  assertArrayValue(summaryRecord.phaseCoverageManifestLabels, 'source-kind summary phaseCoverageManifestLabels');
  assertNumberRecordKeys(
    summaryRecord.phaseCoverageReadinessCounts,
    ['clean', 'needsReview'],
    'source-kind summary phaseCoverageReadinessCounts',
  );
  assertStringValue(summaryRecord.sourceKind, 'source-kind summary sourceKind');
  assertStatusCounts(summaryRecord.statusCounts, 'source-kind summary statusCounts');
}

function assertIndexReportContract(indexReport: Record<string, unknown>) {
  assert.equal(indexReport.kind, 'agent-session-v3-pilot-corpus-batch-index-report');
  assert.equal(indexReport.version, 1);
  assertStringValue(indexReport.indexPath, 'indexReport.indexPath');
  assert.equal(typeof indexReport.manifestCount, 'number');
  assertStringValue(indexReport.summaryText, 'indexReport.summaryText');
  assertStringValue(indexReport.reportText, 'indexReport.reportText');

  for (const entry of assertArrayValue(indexReport.entries, 'indexReport.entries')) {
    assertIndexEntryShape(entry);
  }
  for (const summary of assertArrayValue(indexReport.sourceKindSummaries, 'indexReport.sourceKindSummaries')) {
    assertSourceKindSummaryShape(summary);
  }

  const multiReport = assertObjectRecord(indexReport.multiReport, 'indexReport.multiReport');
  assert.equal(multiReport.kind, 'agent-session-v3-pilot-multi-corpus-manifest-report');
  assert.equal(multiReport.version, 1);
  assert.equal(typeof multiReport.manifestCount, 'number');
  assertStatusCounts(multiReport.statusCounts, 'indexReport.multiReport.statusCounts');
  assertArrayValue(multiReport.entries, 'indexReport.multiReport.entries');
  assertArrayValue(multiReport.failedCheckSummaries, 'indexReport.multiReport.failedCheckSummaries');
  assertMultiManifestPhaseCoverageReadinessShape(
    indexReport.phaseCoverageCalibration,
    'indexReport.phaseCoverageCalibration',
  );
  assertMultiManifestPhaseCoverageReadinessShape(
    multiReport.phaseCoverageReadiness,
    'indexReport.multiReport.phaseCoverageReadiness',
  );
  assertArrayValue(multiReport.profileSummaries, 'indexReport.multiReport.profileSummaries');
}

function createAgreement(
  options: Pick<AgentSessionV3PilotShadowAgreement, 'status' | 'v2Status'>,
): AgentSessionV3PilotShadowAgreement {
  return {
    expectations: [],
    observed: {
      lastEvent: null,
      phase: null,
      runnerStatus: null,
      shadowStatus: null,
      terminalStatus: null,
      transitionCount: null,
    },
    reason: `${options.status} manifest/index JSON contract sample`,
    status: options.status,
    v2Status: options.v2Status,
  };
}

for (const scriptName of [
  'agent-session-v3-pilot-external-sample-corpus-manifest-loader.ts',
  'agent-session-v3-pilot-corpus-batch-index-report.ts',
]) {
  const { scriptSource } = readProjectSources({
    scriptSource: `scripts/${scriptName}`,
  });

  assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
    scriptSource,
    `${scriptName} CLI JSON contract`,
  );
}

const shadowResult = await runAgentSessionV3PilotShadowMode({
  enabled: true,
  events: [
    {
      reason: 'begin manifest/index JSON contract sample',
      type: 'start',
    },
    {
      reason: 'terminal answer',
      route: 'terminal',
      terminalStatus: 'completed',
      type: 'model-decision-accepted',
    },
  ],
});
const shadowExport = createAgentSessionV3PilotShadowDebugExport(shadowResult);

function createCorpus(status: AgentSessionV3PilotShadowAgreement['status']) {
  return createAgentSessionV3PilotDebugSampleCorpusExport({
    agreementReport: createAgentSessionV3PilotShadowAgreementReportExport(
      createAgentSessionV3PilotShadowAgreementReport([
        createAgreement({
          status,
          v2Status: status === 'aligned' ? 'completed' : 'failed',
        }),
      ]),
      {
        includeSamples: true,
      },
    ),
    shadowDebugSamples: [{
      label: `${status}-shadow`,
      shadow: shadowExport,
    }],
  });
}

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-manifest-index-json-contract-'));
try {
  const readyCorpusPath = path.join(tempDir, 'ready-corpus.json');
  const mismatchCorpusPath = path.join(tempDir, 'mismatch-corpus.json');
  const readyManifestPath = path.join(tempDir, 'ready-manifest.json');
  const mismatchManifestPath = path.join(tempDir, 'mismatch-manifest.json');
  const indexPath = path.join(tempDir, 'corpus-batch-index.json');
  const template = await runAgentSessionV3PilotExternalSampleCorpusManifestTemplate();

  await writeFile(readyCorpusPath, JSON.stringify(createCorpus('aligned')), 'utf8');
  await writeFile(mismatchCorpusPath, JSON.stringify(createCorpus('mismatch')), 'utf8');
  await writeFile(readyManifestPath, JSON.stringify({
    ...template.manifest,
    sources: [
      {
        label: 'ready-batch',
        path: path.basename(readyCorpusPath),
      },
    ],
  }), 'utf8');
  await writeFile(mismatchManifestPath, JSON.stringify({
    ...template.manifest,
    sources: [
      {
        label: 'mismatch-batch',
        path: path.basename(mismatchCorpusPath),
      },
    ],
  }), 'utf8');
  await writeFile(indexPath, JSON.stringify({
    batches: [
      {
        generatedAt: '2026-06-22T00:00:00.000Z',
        label: 'baseline-ready',
        manifestPath: path.basename(readyManifestPath),
        notes: 'baseline ready batch',
        sourceKind: 'baseline',
      },
      {
        generatedAt: '2026-06-22T00:05:00.000Z',
        label: 'manual-mismatch',
        manifestPath: path.basename(mismatchManifestPath),
        notes: null,
        sourceKind: 'manual',
      },
    ],
    version: 1,
  }), 'utf8');

  const readyLoader = runJsonCli([
    '.\\scripts\\agent-session-v3-pilot-external-sample-corpus-manifest-loader.ts',
    readyManifestPath,
    '--report',
    '--pretty',
  ]);
  assertManifestLoaderContract(readyLoader);
  assert.equal(readyLoader.status, 'ready');
  assert.equal(readyLoader.sourceCount, 1);
  assert.equal((assertObjectRecord(readyLoader.fixtureExport, 'ready fixtureExport')).batchCount, 1);
  assert.equal((assertObjectRecord(readyLoader.diagnostics, 'ready diagnostics')).failedEntryCount, 0);
  assert.equal((assertObjectRecord(readyLoader.profileComparison, 'ready profileComparison')).profileCount, 3);
  assertStringValue(readyLoader.reportText, 'ready loader reportText');

  const mismatchLoader = runJsonCli([
    '.\\scripts\\agent-session-v3-pilot-external-sample-corpus-manifest-loader.ts',
    mismatchManifestPath,
    '--report',
    '--pretty',
  ]);
  assertManifestLoaderContract(mismatchLoader);
  assert.equal(mismatchLoader.status, 'not-ready');
  assert.equal(mismatchLoader.sourceCount, 1);
  const mismatchDiagnostics = assertObjectRecord(mismatchLoader.diagnostics, 'mismatch diagnostics');
  assert.equal(mismatchDiagnostics.status, 'has-failures');
  assert.equal(mismatchDiagnostics.failedEntryCount, 1);
  assert.ok((mismatchDiagnostics.checkSummaries as unknown[]).some((check) => (
    (check as Record<string, unknown>).key === 'max-mismatches'
  )));

  const indexReport = runJsonCli([
    '.\\scripts\\agent-session-v3-pilot-corpus-batch-index-report.ts',
    indexPath,
    '--pretty',
  ]);
  assertIndexReportContract(indexReport);
  assert.equal(indexReport.manifestCount, 2);
  assert.equal((indexReport.entries as unknown[]).length, 2);
  assert.ok((indexReport.entries as unknown[]).some((entry) => (
    (entry as Record<string, unknown>).label === 'baseline-ready'
      && (entry as Record<string, unknown>).sourceKind === 'baseline'
      && (entry as Record<string, unknown>).status === 'ready'
  )));
  assert.ok((indexReport.entries as unknown[]).some((entry) => (
    (entry as Record<string, unknown>).label === 'manual-mismatch'
      && (entry as Record<string, unknown>).sourceKind === 'manual'
      && (entry as Record<string, unknown>).status === 'not-ready'
  )));
  const multiReport = assertObjectRecord(indexReport.multiReport, 'index multiReport');
  const statusCounts = assertObjectRecord(multiReport.statusCounts, 'index multiReport.statusCounts');
  assert.equal(statusCounts.ready, 1);
  assert.equal(statusCounts.notReady, 1);
  assert.equal(statusCounts.mixed, 0);
  assert.equal(statusCounts.empty, 0);
  assert.ok((multiReport.failedCheckSummaries as unknown[]).some((check) => (
    (check as Record<string, unknown>).key === 'max-mismatches'
  )));
  assert.ok((indexReport.sourceKindSummaries as unknown[]).some((summary) => {
    const summaryRecord = summary as Record<string, unknown>;
    const counts = summaryRecord.statusCounts as Record<string, unknown>;
    return summaryRecord.sourceKind === 'baseline'
      && counts.ready === 1
      && counts.notReady === 0;
  }));
  assert.ok((indexReport.sourceKindSummaries as unknown[]).some((summary) => {
    const summaryRecord = summary as Record<string, unknown>;
    const counts = summaryRecord.statusCounts as Record<string, unknown>;
    return summaryRecord.sourceKind === 'manual'
      && counts.ready === 0
      && counts.notReady === 1;
  }));
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot manifest loader and batch index CLI JSON contract smoke ok');
