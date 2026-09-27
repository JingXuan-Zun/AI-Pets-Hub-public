import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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

function assertFixtureSetContract(fixtureSet: Record<string, unknown>) {
  const batches = assertArrayValue(fixtureSet.batches, 'fixture set batches');
  assert.ok(
    fixtureSet.corpusOptions === undefined || typeof fixtureSet.corpusOptions === 'object',
    'fixture set corpusOptions should be an object or omitted.',
  );
  assert.ok(
    fixtureSet.thresholds === undefined || typeof fixtureSet.thresholds === 'object',
    'fixture set thresholds should be an object or omitted.',
  );

  for (const batch of batches) {
    const batchRecord = assertObjectRecord(batch, 'fixture set batch');
    assertStringValue(batchRecord.label, 'fixture set batch label');
    assertArrayValue(batchRecord.agreementReports, 'fixture set batch agreementReports');
    assertArrayValue(batchRecord.shadowDebugSamples, 'fixture set batch shadowDebugSamples');
  }
}

function assertFixtureBatchResultContract(batch: Record<string, unknown>) {
  assert.equal(batch.kind, 'agent-session-v3-pilot-external-sample-fixture-batch');
  assert.equal(batch.version, 1);
  assertStringValue(batch.status, 'fixture batch status');
  assert.ok(['ready', 'mixed', 'not-ready', 'empty'].includes(String(batch.status)));
  assert.equal(typeof batch.intakeCount, 'number');
  assert.equal(typeof batch.issueCount, 'number');
  assertStringValue(batch.summaryText, 'fixture batch summaryText');
  assertArrayValue(batch.entries, 'fixture batch entries');

  const calibration = assertObjectRecord(batch.calibration, 'fixture batch calibration');
  assertStringValue(calibration.status, 'fixture batch calibration status');
  assertStatusCounts(calibration.counts, 'fixture batch calibration counts');
}

function assertBaselineReportContract(report: Record<string, unknown>) {
  assert.equal(report.kind, 'agent-session-v3-pilot-baseline-corpus-manifest-report');
  assert.equal(report.version, 1);
  assertStringValue(report.corpusPath, 'baseline report corpusPath');
  assertStringValue(report.manifestPath, 'baseline report manifestPath');
  assert.equal(typeof report.scenarioCount, 'number');
  assertStringValue(report.status, 'baseline report status');
  assertStringValue(report.summaryText, 'baseline report summaryText');
  assert.ok(
    report.reportText === null || typeof report.reportText === 'string',
    'baseline report reportText should be a string or null.',
  );

  const corpusExport = assertObjectRecord(report.corpusExport, 'baseline report corpusExport');
  assert.equal(corpusExport.kind, 'agent-session-v3-pilot-explicit-debug-corpus-exporter');
  assert.equal(corpusExport.version, 1);
  assertStringValue(corpusExport.corpusPath, 'baseline report corpusExport corpusPath');
  assert.equal(typeof corpusExport.scenarioCount, 'number');

  const manifestLoader = assertObjectRecord(report.manifestLoader, 'baseline report manifestLoader');
  assert.equal(manifestLoader.kind, 'agent-session-v3-pilot-external-sample-corpus-manifest-loader');
  assert.equal(manifestLoader.version, 1);
  assertStringValue(manifestLoader.status, 'baseline report manifestLoader status');
  assert.equal(typeof manifestLoader.sourceCount, 'number');
  assertNullableStringValue(manifestLoader.fixturePath, 'baseline report manifestLoader fixturePath');

  const profileComparison = assertObjectRecord(
    manifestLoader.profileComparison,
    'baseline report manifestLoader profileComparison',
  );
  assert.equal(typeof profileComparison.profileCount, 'number');
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
    reason: `${options.status} fixture/baseline JSON contract sample`,
    status: options.status,
    v2Status: options.v2Status,
  };
}

for (const scriptName of [
  'agent-session-v3-pilot-external-sample-fixture-set-exporter.ts',
  'agent-session-v3-pilot-external-sample-fixture-batch-loader.ts',
  'agent-session-v3-pilot-baseline-corpus-manifest-report.ts',
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
      reason: 'begin fixture/baseline JSON contract sample',
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

const agreementReport = createAgentSessionV3PilotShadowAgreementReportExport(
  createAgentSessionV3PilotShadowAgreementReport([
    createAgreement({
      status: 'aligned',
      v2Status: 'completed',
    }),
    createAgreement({
      status: 'aligned',
      v2Status: 'needs-user',
    }),
  ]),
  {
    includeSamples: true,
  },
);

const corpusExport = createAgentSessionV3PilotDebugSampleCorpusExport({
  agreementReport,
  shadowDebugSamples: [{
    label: 'completed-shadow',
    shadow: shadowExport,
  }],
});

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-fixture-baseline-json-contract-'));
try {
  const corpusPath = path.join(tempDir, 'completed-corpus.json');
  const fixturePath = path.join(tempDir, 'fixture-set.json');
  const baselineDir = path.join(tempDir, 'baseline');

  await writeFile(corpusPath, JSON.stringify(corpusExport), 'utf8');

  const fixtureSet = runJsonCli([
    '.\\scripts\\agent-session-v3-pilot-external-sample-fixture-set-exporter.ts',
    corpusPath,
    '--out',
    fixturePath,
    '--pretty',
  ]);
  assertFixtureSetContract(fixtureSet);
  assert.equal((fixtureSet.batches as unknown[]).length, 1);
  assert.equal((assertObjectRecord((fixtureSet.batches as unknown[])[0], 'fixture batch')).label, path.basename(corpusPath));
  assert.deepEqual(
    JSON.parse(await readFile(fixturePath, 'utf8')),
    fixtureSet,
  );

  const fixtureBatch = runJsonCli([
    '.\\scripts\\agent-session-v3-pilot-external-sample-fixture-batch-loader.ts',
    fixturePath,
    '--pretty',
  ]);
  assertFixtureBatchResultContract(fixtureBatch);
  assert.equal(fixtureBatch.status, 'ready');
  assert.equal(fixtureBatch.intakeCount, 1);
  assert.equal(fixtureBatch.issueCount, 0);
  assert.equal(assertObjectRecord(fixtureBatch.calibration, 'fixture batch calibration').status, 'ready');

  const baselineReport = runJsonCli([
    '.\\scripts\\agent-session-v3-pilot-baseline-corpus-manifest-report.ts',
    '--out-dir',
    baselineDir,
    '--max-shadow',
    '3',
    '--pretty',
  ]);
  assertBaselineReportContract(baselineReport);
  assert.equal(baselineReport.status, 'ready');
  assert.equal(baselineReport.scenarioCount, 6);
  assert.equal(
    assertObjectRecord(baselineReport.manifestLoader, 'baseline manifestLoader').status,
    'ready',
  );
  assert.equal(
    assertObjectRecord(
      assertObjectRecord(baselineReport.manifestLoader, 'baseline manifestLoader').profileComparison,
      'baseline profileComparison',
    ).profileCount,
    3,
  );

  const writtenCorpus = JSON.parse(await readFile(String(baselineReport.corpusPath), 'utf8')) as Record<string, unknown>;
  const writtenManifest = JSON.parse(await readFile(String(baselineReport.manifestPath), 'utf8')) as Record<string, unknown>;
  assert.equal(writtenCorpus.kind, 'agent-session-v3-pilot-debug-sample-corpus');
  assert.equal((writtenManifest.sources as unknown[]).length, 1);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot fixture and baseline CLI JSON contract smoke ok');
