import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  assertNumberRecordKeys,
  assertObjectRecord,
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

  return {
    json: parseTrailingJsonObject(result.stdout),
    stdout: result.stdout,
  };
}

function assertStringValue(value: unknown, label: string) {
  assert.equal(typeof value, 'string', `${label} should be a string.`);
}

function assertNullableStringValue(value: unknown, label: string) {
  assert.ok(value === null || typeof value === 'string', `${label} should be a string or null.`);
}

function assertNullableNumberValue(value: unknown, label: string) {
  assert.ok(value === null || typeof value === 'number', `${label} should be a number or null.`);
}

function assertArrayValue(value: unknown, label: string) {
  assert.ok(Array.isArray(value), `${label} should be an array.`);

  return value;
}

function assertStatusCounts(value: unknown, label: string) {
  return assertNumberRecordKeys(value, [
    'aligned',
    'inconclusive',
    'mismatch',
    'unavailable',
  ], label);
}

function assertV2StatusCounts(value: unknown, label: string) {
  return assertNumberRecordKeys(value, [
    'budget-exceeded',
    'cancelled',
    'completed',
    'failed',
    'max-steps',
    'needs-approval',
    'needs-user',
  ], label);
}

function assertShadowModeStatusCounts(value: unknown, label: string) {
  return assertNumberRecordKeys(value, ['disabled', 'observed', 'omitted'], label);
}

function assertRunnerStatusCounts(value: unknown, label: string) {
  return assertNumberRecordKeys(value, [
    'driver-failed',
    'invalid-transition',
    'none',
    'terminal',
    'transition-limit',
    'waiting-for-event',
  ], label);
}

function assertObservedShape(value: unknown, label: string) {
  const observed = assertObjectRecord(value, label);

  assertNullableStringValue(observed.lastEvent, `${label}.lastEvent`);
  assertNullableStringValue(observed.phase, `${label}.phase`);
  assertNullableStringValue(observed.runnerStatus, `${label}.runnerStatus`);
  assertNullableStringValue(observed.shadowStatus, `${label}.shadowStatus`);
  assertNullableStringValue(observed.terminalStatus, `${label}.terminalStatus`);
  assertNullableNumberValue(observed.transitionCount, `${label}.transitionCount`);
}

function assertAgreementSampleShape(value: unknown, label: string) {
  const sample = assertObjectRecord(value, label);

  assert.ok(sample.label === null || typeof sample.label === 'string', `${label}.label should be a string or null.`);
  assertArrayValue(sample.expectations, `${label}.expectations`);
  assertObservedShape(sample.observed, `${label}.observed`);
  assertStringValue(sample.reason, `${label}.reason`);
  assertStringValue(sample.status, `${label}.status`);
  assertStringValue(sample.v2Status, `${label}.v2Status`);
}

function assertAgreementReportContract(value: unknown) {
  const report = assertObjectRecord(value, 'corpus agreementReport');

  assert.equal(report.kind, 'agent-session-v3-pilot-shadow-agreement-report');
  assert.equal(report.version, 1);
  assertStatusCounts(report.counts, 'corpus agreementReport counts');
  assertV2StatusCounts(report.v2StatusCounts, 'corpus agreementReport v2StatusCounts');
  assert.equal(typeof report.sampleCount, 'number');
  assertStringValue(report.summaryText, 'corpus agreementReport summaryText');

  for (const sample of assertArrayValue(report.samples, 'corpus agreementReport samples')) {
    assertAgreementSampleShape(sample, 'corpus agreementReport sample');
  }
  for (const sample of assertArrayValue(report.mismatchSamples, 'corpus agreementReport mismatchSamples')) {
    assertAgreementSampleShape(sample, 'corpus agreementReport mismatch sample');
  }

  return report;
}

function assertShadowTransitionShape(value: unknown, label: string) {
  const transition = assertObjectRecord(value, label);

  assert.equal(typeof transition.accepted, 'boolean');
  assertStringValue(transition.eventType, `${label}.eventType`);
  assertStringValue(transition.from, `${label}.from`);
  assertNullableStringValue(transition.reason, `${label}.reason`);
  assertNullableStringValue(transition.to, `${label}.to`);
}

function assertShadowPhaseCoverageShape(value: unknown, label: string) {
  const coverage = assertObjectRecord(value, label);

  assert.equal(typeof coverage.acceptedTransitionCount, 'number');
  assert.equal(typeof coverage.rejectedTransitionCount, 'number');
  assertStringValue(coverage.status, `${label}.status`);
  assert.equal(typeof coverage.terminalObserved, 'boolean');

  for (const eventType of assertArrayValue(coverage.eventTypes, `${label}.eventTypes`)) {
    assertStringValue(eventType, `${label}.eventType`);
  }
  for (const phase of assertArrayValue(coverage.knownPhases, `${label}.knownPhases`)) {
    assertStringValue(phase, `${label}.knownPhase`);
  }
  for (const phase of assertArrayValue(coverage.unvisitedPhases, `${label}.unvisitedPhases`)) {
    assertStringValue(phase, `${label}.unvisitedPhase`);
  }
  for (const phase of assertArrayValue(coverage.visitedPhases, `${label}.visitedPhases`)) {
    assertStringValue(phase, `${label}.visitedPhase`);
  }
}

function assertCorpusShadowPhaseCoverageShape(value: unknown, label: string) {
  const coverage = assertObjectRecord(value, label);

  assert.equal(typeof coverage.acceptedTransitionCount, 'number');
  assert.equal(typeof coverage.coveredSampleCount, 'number');
  assert.equal(typeof coverage.missingCoverageSampleCount, 'number');
  assert.equal(typeof coverage.rejectedTransitionCount, 'number');
  assert.equal(typeof coverage.terminalObservedSampleCount, 'number');

  const eventTypeCounts = assertObjectRecord(coverage.eventTypeCounts, `${label}.eventTypeCounts`);
  for (const count of Object.values(eventTypeCounts)) {
    assert.equal(typeof count, 'number');
  }

  const phaseVisitCounts = assertObjectRecord(coverage.phaseVisitCounts, `${label}.phaseVisitCounts`);
  for (const count of Object.values(phaseVisitCounts)) {
    assert.equal(typeof count, 'number');
  }

  const statusCounts = assertObjectRecord(coverage.statusCounts, `${label}.statusCounts`);
  for (const status of ['invalid', 'limited', 'missing', 'partial', 'terminal', 'unavailable']) {
    assert.equal(typeof statusCounts[status], 'number', `${label}.statusCounts.${status} should be numeric.`);
  }

  for (const phase of assertArrayValue(coverage.unvisitedPhasesAcrossCorpus, `${label}.unvisitedPhasesAcrossCorpus`)) {
    assertStringValue(phase, `${label}.unvisitedPhase`);
  }
}

function assertShadowDebugShape(value: unknown, label: string) {
  const shadow = assertObjectRecord(value, label);

  assert.equal(shadow.kind, 'agent-session-v3-pilot-shadow-debug');
  assert.equal(shadow.version, 1);
  assert.equal(typeof shadow.consumedEventCount, 'number');
  assertNullableStringValue(shadow.debugSummaryText, `${label}.debugSummaryText`);
  assertNullableStringValue(shadow.errorText, `${label}.errorText`);
  assertNullableNumberValue(shadow.eventCount, `${label}.eventCount`);
  assertNullableStringValue(shadow.lastEvent, `${label}.lastEvent`);
  assertNullableStringValue(shadow.phase, `${label}.phase`);
  assertShadowPhaseCoverageShape(shadow.phaseCoverage, `${label}.phaseCoverage`);
  assertNullableStringValue(shadow.reason, `${label}.reason`);
  assertNullableStringValue(shadow.runnerStatus, `${label}.runnerStatus`);
  assertStringValue(shadow.status, `${label}.status`);
  assertNullableStringValue(shadow.terminalStatus, `${label}.terminalStatus`);
  assert.equal(typeof shadow.transitionCount, 'number');

  for (const transition of assertArrayValue(shadow.transitions, `${label}.transitions`)) {
    assertShadowTransitionShape(transition, `${label}.transition`);
  }
}

function assertShadowSampleShape(value: unknown, label: string) {
  const sample = assertObjectRecord(value, label);

  assert.ok(sample.label === null || typeof sample.label === 'string', `${label}.label should be a string or null.`);
  assertShadowDebugShape(sample.shadow, `${label}.shadow`);
}

function assertDebugSampleCorpusContract(corpus: Record<string, unknown>) {
  assert.equal(corpus.kind, 'agent-session-v3-pilot-debug-sample-corpus');
  assert.equal(corpus.version, 1);
  assertStringValue(corpus.summaryText, 'corpus summaryText');

  const counts = assertObjectRecord(corpus.counts, 'corpus counts');
  assert.equal(typeof counts.agreementSampleCount, 'number');
  assert.equal(typeof counts.shadowAnomalySampleCount, 'number');
  assert.equal(typeof counts.shadowDebugSampleCount, 'number');
  assertShadowModeStatusCounts(counts.shadowModeStatusCounts, 'corpus shadowModeStatusCounts');
  assertCorpusShadowPhaseCoverageShape(counts.shadowPhaseCoverage, 'corpus shadowPhaseCoverage');
  assertRunnerStatusCounts(counts.shadowRunnerStatusCounts, 'corpus shadowRunnerStatusCounts');

  const agreementReport = assertAgreementReportContract(corpus.agreementReport);
  for (const sample of assertArrayValue(corpus.shadowDebugSamples, 'corpus shadowDebugSamples')) {
    assertShadowSampleShape(sample, 'corpus shadowDebugSample');
  }

  return {
    agreementReport,
    counts,
    shadowDebugSamples: corpus.shadowDebugSamples as unknown[],
  };
}

const {
  exporterSource,
  sessionSource,
} = readProjectSources({
  exporterSource: 'scripts/agent-session-v3-pilot-explicit-debug-corpus-exporter.ts',
  sessionSource: 'src/agent/agentProductionSessionImplementation.ts',
});

assert.match(
  exporterSource,
  /export async function runAgentSessionV3PilotExplicitDebugCorpusExporter/u,
  'explicit-debug corpus exporter should expose a caller-owned runner.',
);
assert.doesNotMatch(
  exporterSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'explicit-debug corpus exporter should not encode a fixed desktop tool chain.',
);
assert.doesNotMatch(
  sessionSource,
  /historyLines\.push\([^)]*v3PilotShadow|createAgentSessionV2ModelInput\([^)]*v3PilotShadow/isu,
  'v3 pilot shadow output should stay out of history and model input.',
);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-explicit-debug-corpus-json-contract-'));
try {
  const corpusPath = path.join(tempDir, 'explicit-debug-corpus.json');

  const { json: corpus, stdout } = runJsonCli([
    '.\\scripts\\agent-session-v3-pilot-explicit-debug-corpus-exporter.ts',
    '--out',
    corpusPath,
    '--max-shadow',
    '3',
    '--pretty',
  ]);
  const contract = assertDebugSampleCorpusContract(corpus);

  assert.match(stdout, /AgentSessionV3PilotDebugSampleCorpus agreementSamples=6/u);
  assert.match(stdout, new RegExp(`corpusPath=${corpusPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'u'));
  assert.equal(contract.counts.agreementSampleCount, 6);
  assert.equal(contract.counts.shadowDebugSampleCount, 6);
  assert.equal(contract.counts.shadowAnomalySampleCount, 2);
  assert.equal(assertObjectRecord(contract.counts.shadowModeStatusCounts, 'shadow mode counts').observed, 6);
  assert.equal(assertObjectRecord(contract.counts.shadowRunnerStatusCounts, 'runner counts').terminal, 4);
  assert.equal(assertObjectRecord(contract.counts.shadowRunnerStatusCounts, 'runner counts')['waiting-for-event'], 2);
  const phaseCoverage = assertObjectRecord(contract.counts.shadowPhaseCoverage, 'shadow phase coverage');
  assert.equal(phaseCoverage.coveredSampleCount, 6);
  assert.equal(phaseCoverage.missingCoverageSampleCount, 0);
  assert.equal(assertObjectRecord(phaseCoverage.statusCounts, 'shadow phase coverage status counts').terminal, 4);
  assert.equal(assertObjectRecord(phaseCoverage.statusCounts, 'shadow phase coverage status counts').partial, 2);
  const phaseVisitCounts = assertObjectRecord(phaseCoverage.phaseVisitCounts, 'shadow phase coverage phase counts');
  assert.equal(phaseVisitCounts.init, 6);
  assert.equal(phaseVisitCounts.model_decision, 6);
  assert.equal(phaseVisitCounts.prepare_command, 3);
  assert.equal(phaseVisitCounts.needs_approval, 1);
  assert.equal(phaseVisitCounts.execute_transaction, 2);
  assert.equal(phaseVisitCounts.evaluate, 1);
  assert.equal(phaseVisitCounts.recover, 1);
  assert.equal(phaseVisitCounts.done, 3);
  assert.equal(phaseVisitCounts.failed, 1);
  assert.deepEqual(
    assertArrayValue(phaseCoverage.unvisitedPhasesAcrossCorpus, 'shadow phase coverage unvisited phases'),
    [],
    'baseline explicit-debug corpus should cover every v3 pilot phase at least once.',
  );
  assert.equal(contract.shadowDebugSamples.length, 3);

  assert.equal(contract.agreementReport.sampleCount, 6);
  assert.equal(assertObjectRecord(contract.agreementReport.counts, 'agreement counts').aligned, 5);
  assert.equal(assertObjectRecord(contract.agreementReport.counts, 'agreement counts').inconclusive, 1);
  assert.equal(assertObjectRecord(contract.agreementReport.counts, 'agreement counts').mismatch, 0);
  assert.equal(assertObjectRecord(contract.agreementReport.v2StatusCounts, 'agreement v2 counts').completed, 2);
  assert.equal(assertObjectRecord(contract.agreementReport.v2StatusCounts, 'agreement v2 counts')['needs-approval'], 1);
  assert.equal(assertObjectRecord(contract.agreementReport.v2StatusCounts, 'agreement v2 counts')['needs-user'], 1);
  assert.equal(assertObjectRecord(contract.agreementReport.v2StatusCounts, 'agreement v2 counts').failed, 1);
  assert.equal(assertObjectRecord(contract.agreementReport.v2StatusCounts, 'agreement v2 counts')['budget-exceeded'], 1);
  assert.equal((contract.agreementReport.samples as unknown[]).length, 6);
  assert.equal((contract.agreementReport.mismatchSamples as unknown[]).length, 0);

  assert.deepEqual(
    JSON.parse(await readFile(corpusPath, 'utf8')),
    corpus,
  );
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot explicit debug corpus exporter CLI JSON contract smoke ok');
