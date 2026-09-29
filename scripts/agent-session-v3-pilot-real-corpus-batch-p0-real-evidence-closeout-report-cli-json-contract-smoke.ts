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
  assert.equal(result.kind, 'agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report');
  assert.equal(result.version, 1);
  assert.equal(result.readyForProductionRuntime, false);
  assert.match(String(result.status), /^(blocked|no-intake-dirs|package-attention-needed|ready-for-manual-review|review-needed)$/u);
  assert.equal(typeof result.guardrail, 'string');
  assert.equal(typeof result.nextEvidenceTargetStatus, 'string');
  assert.equal(typeof result.nextEvidenceTargetSummaryText, 'string');
  assert.equal(typeof result.p0IntakeTargetStatus, 'string');
  assert.equal(typeof result.p0IntakeTargetStatusSummaryText, 'string');
  assert.equal(typeof result.packageHealthStatus, 'string');
  assert.equal(typeof result.packageHealthSummaryText, 'string');
  assert.equal(typeof result.readinessRollupStatus, 'string');
  assert.ok(result.readinessSummaryText === null || typeof result.readinessSummaryText === 'string');
  assert.equal(typeof result.reportText, 'string');
  assert.equal(typeof result.summaryText, 'string');
  assert.ok(result.nextPriority === null || typeof result.nextPriority === 'string');
  assertNumberRecordKeys(
    result,
    [
      'intakeCount',
      'p0BlockedCount',
      'p0ReadyForManualReviewCount',
      'p0ReviewNeededCount',
      'p0TargetCount',
      'readinessTotalBlockerItems',
      'readinessTotalReviewItems',
    ],
    'P0 real evidence closeout report',
  );
  assert.ok(Array.isArray(result.closeoutReasons), 'closeoutReasons should be an array.');
  assert.ok(Array.isArray(result.p0TargetSignals), 'p0TargetSignals should be an array.');
  for (const signal of result.p0TargetSignals) {
    assertTargetSignalContract(signal);
  }
}

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts',
});

assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts CLI JSON contract',
);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-p0-real-evidence-closeout-cli-'));
try {
  const example = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample({
    includeJsonText: true,
    outDir: tempDir,
    prettyJson: true,
  });

  const cliResult = runCli([
    '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts',
    '--dir',
    example.intakeDirs.ready,
    '--pretty',
  ]);

  assert.equal(
    cliResult.status,
    0,
    cliResult.stderr || cliResult.stdout || cliResult.error?.message,
  );
  assert.match(cliResult.stdout, /AgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport status=blocked/u);
  assert.match(cliResult.stdout, /packageHealth=missing-real-evidence/u);
  assert.match(cliResult.stdout, /p0Status=blocked/u);
  assert.match(cliResult.stdout, /readinessRollup=ready-for-manual-review/u);
  assert.match(cliResult.stdout, /p0TargetSignals:/u);
  assert.match(cliResult.stdout, /gapKind=real-production-like-sample status=blocked/u);
  assert.match(cliResult.stdout, /gapKind=real-exported-corpus status=missing/u);
  assert.match(cliResult.stdout, /readyForProductionRuntime=no/u);

  const result = parseTrailingJsonObject(cliResult.stdout);

  assertReportContract(result);
  assert.equal(result.status, 'blocked');
  assert.equal(result.intakeCount, 1);
  assert.equal(result.p0IntakeTargetStatus, 'blocked');
  assert.equal(result.readinessRollupStatus, 'ready-for-manual-review');
  assert.equal(result.packageHealthStatus, 'missing-real-evidence');
  assert.equal(result.nextPriority, 'P0');
  assert.equal(result.p0TargetCount, 2);
  assert.equal(result.p0ReadyForManualReviewCount, 0);
  assert.equal(result.p0BlockedCount, 1);
  assert.equal(result.p0ReviewNeededCount, 0);
  assert.equal(result.readinessTotalBlockerItems, 0);
  assert.equal(result.readinessTotalReviewItems, 0);
  assert.deepEqual(result.readinessStatusCounts, {
    blocked: 0,
    readyForManualReview: 1,
    reviewNeeded: 0,
  });
  assert.equal((result.p0TargetSignals as unknown[]).length, 2);
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

console.log('agent session v3 pilot real corpus batch P0 real evidence closeout report CLI JSON contract smoke ok');
