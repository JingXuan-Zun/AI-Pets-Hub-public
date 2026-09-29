import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  assertNumberRecordKeys,
  assertObjectRecord,
  assertSourceDoesNotUseRuntimeOrFixedDesktopChain,
  parseTrailingJsonObject,
} from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample } from './agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts';
import { projectRoot, readProjectFile } from './smokeTestHarness.ts';

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

function assertEntryContract(value: unknown) {
  const entry = assertObjectRecord(value, 'P0 intake target entry');

  assert.deepEqual(Object.keys(entry).sort(), [
    'blockerReasons',
    'hasProductionLikeSourceKind',
    'indexManifestCount',
    'intakeDir',
    'manifestSourceCount',
    'noteOpenItemCount',
    'noteStatus',
    'reviewReasons',
    'sourceDeclarationStatus',
    'sourceSampleSource',
    'sourceSampleSourceStatus',
    'status',
    'validatorStatus',
  ]);
  assert.equal(typeof entry.hasProductionLikeSourceKind, 'boolean');
  assert.equal(typeof entry.indexManifestCount, 'number');
  assert.equal(typeof entry.intakeDir, 'string');
  assert.equal(typeof entry.manifestSourceCount, 'number');
  assert.equal(typeof entry.noteOpenItemCount, 'number');
  assert.equal(typeof entry.noteStatus, 'string');
  assert.equal(typeof entry.sourceDeclarationStatus, 'string');
  assert.ok(entry.sourceSampleSource === null || typeof entry.sourceSampleSource === 'string');
  assert.ok(entry.sourceSampleSourceStatus === null || typeof entry.sourceSampleSourceStatus === 'string');
  assert.match(String(entry.status), /^(blocked|ready-for-manual-review|review-needed)$/u);
  assert.equal(typeof entry.validatorStatus, 'string');
  assert.ok(Array.isArray(entry.blockerReasons), 'blockerReasons should be an array.');
  assert.ok(Array.isArray(entry.reviewReasons), 'reviewReasons should be an array.');
}

function assertTargetSignalContract(value: unknown) {
  const signal = assertObjectRecord(value, 'P0 target signal');

  assert.deepEqual(Object.keys(signal).sort(), [
    'blockedIntakeCount',
    'evidenceReasons',
    'gapKind',
    'intakeCount',
    'missingReason',
    'readyForManualReviewIntakeCount',
    'reviewNeededIntakeCount',
    'status',
  ]);
  assert.equal(typeof signal.blockedIntakeCount, 'number');
  assert.ok(Array.isArray(signal.evidenceReasons), 'evidenceReasons should be an array.');
  assert.equal(typeof signal.gapKind, 'string');
  assert.equal(typeof signal.intakeCount, 'number');
  assert.ok(signal.missingReason === null || typeof signal.missingReason === 'string');
  assert.equal(typeof signal.readyForManualReviewIntakeCount, 'number');
  assert.equal(typeof signal.reviewNeededIntakeCount, 'number');
  assert.match(String(signal.status), /^(blocked|missing|ready-for-manual-review|review-needed)$/u);
}

function assertReportContract(result: Record<string, unknown>) {
  assert.equal(result.kind, 'agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report');
  assert.equal(result.version, 1);
  assert.equal(result.readyForProductionRuntime, false);
  assert.match(String(result.status), /^(blocked|no-intake-dirs|ready-for-manual-review|review-needed)$/u);
  assert.equal(typeof result.guardrail, 'string');
  assert.equal(typeof result.nextEvidenceTargetSummaryText, 'string');
  assert.equal(typeof result.reportText, 'string');
  assert.equal(typeof result.summaryText, 'string');
  assert.ok(result.nextPriority === null || typeof result.nextPriority === 'string');
  assertNumberRecordKeys(
    result,
    [
      'blockedCount',
      'intakeCount',
      'p0TargetCount',
      'readyForManualReviewCount',
      'reviewNeededCount',
    ],
    'P0 intake target status report',
  );
  assert.ok(Array.isArray(result.entries), 'entries should be an array.');
  assert.ok(Array.isArray(result.p0TargetGapKinds), 'p0TargetGapKinds should be an array.');
  assert.ok(Array.isArray(result.p0TargetSignals), 'p0TargetSignals should be an array.');
  for (const entry of result.entries) {
    assertEntryContract(entry);
  }
  for (const signal of result.p0TargetSignals) {
    assertTargetSignalContract(signal);
  }
}

const source = readProjectFile(
  'scripts/agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts',
);

assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts CLI JSON contract',
);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-p0-intake-target-status-cli-'));
try {
  const example = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample({
    includeJsonText: true,
    outDir: tempDir,
    prettyJson: true,
  });

  const cliResult = runCli([
    '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts',
    '--dir',
    example.intakeDirs.ready,
    '--pretty',
  ]);

  assert.equal(
    cliResult.status,
    0,
    cliResult.stderr || cliResult.stdout || cliResult.error?.message,
  );
  assert.match(cliResult.stdout, /AgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport status=blocked/u);
  assert.match(cliResult.stdout, /p0Targets=2/u);
  assert.match(cliResult.stdout, /nextPriority=P0/u);
  assert.match(cliResult.stdout, /p0IntakeTargets:/u);
  assert.match(cliResult.stdout, /p0TargetSignals:/u);
  assert.match(cliResult.stdout, /gapKind=real-production-like-sample status=blocked/u);
  assert.match(cliResult.stdout, /gapKind=real-exported-corpus status=missing/u);
  assert.match(cliResult.stdout, /sampleSource=rehearsal/u);
  assert.match(cliResult.stdout, /readyForProductionRuntime=no/u);

  const result = parseTrailingJsonObject(cliResult.stdout);
  assertReportContract(result);
  assert.equal(result.status, 'blocked');
  assert.equal(result.intakeCount, 1);
  assert.equal(result.blockedCount, 1);
  assert.equal(result.reviewNeededCount, 0);
  assert.equal(result.readyForManualReviewCount, 0);
  assert.equal(result.p0TargetCount, 2);
  assert.deepEqual(result.p0TargetGapKinds, [
    'real-production-like-sample',
    'real-exported-corpus',
  ]);
  assert.equal((result.p0TargetSignals as unknown[]).length, 2);
  const productionLikeSignal = assertObjectRecord(
    (result.p0TargetSignals as unknown[]).find((signal) => (
      assertObjectRecord(signal, 'P0 target signal').gapKind === 'real-production-like-sample'
    )),
    'production-like P0 target signal',
  );
  assert.equal(productionLikeSignal.status, 'blocked');
  assert.equal(productionLikeSignal.blockedIntakeCount, 1);
  assert.equal(productionLikeSignal.readyForManualReviewIntakeCount, 0);
  assert.equal(productionLikeSignal.missingReason, null);
  const realExportedSignal = assertObjectRecord(
    (result.p0TargetSignals as unknown[]).find((signal) => (
      assertObjectRecord(signal, 'P0 target signal').gapKind === 'real-exported-corpus'
    )),
    'real-exported P0 target signal',
  );
  assert.equal(realExportedSignal.status, 'missing');
  assert.equal(realExportedSignal.readyForManualReviewIntakeCount, 0);
  assert.equal(realExportedSignal.missingReason, 'no supplied intake has real-exported sample source evidence');
  const entry = assertObjectRecord((result.entries as unknown[])[0], 'first P0 intake target entry');
  assert.equal(entry.validatorStatus, 'ready');
  assert.equal(entry.sourceDeclarationStatus, 'blocked');
  assert.equal(entry.sourceSampleSource, 'rehearsal');
  assert.equal(entry.sourceSampleSourceStatus, 'synthetic-rehearsal');
  assert.equal(entry.hasProductionLikeSourceKind, true);
  assert.match(String(result.guardrail), /does not discover directories/u);
  assert.match(String(result.guardrail), /collect samples/u);
  assert.match(String(result.guardrail), /define runtime action order/u);
  assert.match(String(result.guardrail), /grant runtime authority/u);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch P0 intake target status report CLI JSON contract smoke ok');
