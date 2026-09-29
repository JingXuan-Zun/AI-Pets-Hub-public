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

function assertGateEntry(value: unknown) {
  const entry = assertObjectRecord(value, 'gate entry');

  assert.equal(typeof entry.intakeDir, 'string');
  assert.equal(typeof entry.readinessStatus, 'string');
  assert.equal(typeof entry.validatorStatus, 'string');
  assert.equal(typeof entry.summaryText, 'string');
  assert.ok(Array.isArray(entry.blockerItems), 'gate entry blockerItems should be an array.');
  assert.ok(Array.isArray(entry.p0SignalAttributions), 'gate entry p0SignalAttributions should be an array.');
  assert.ok(Array.isArray(entry.reviewItems), 'gate entry reviewItems should be an array.');
  for (const item of entry.blockerItems) {
    assertGateItem(item);
  }
  for (const item of entry.reviewItems) {
    assertGateItem(item);
  }
  for (const attribution of entry.p0SignalAttributions) {
    assertP0Attribution(attribution);
  }
}

function assertUnblockItem(value: unknown) {
  const item = assertObjectRecord(value, 'unblock item');

  assert.equal(typeof item.category, 'string');
  assert.equal(typeof item.detail, 'string');
  assert.ok(Array.isArray(item.evidence), 'unblock item evidence should be an array.');
  assert.ok(
    item.evidence.every((entry) => typeof entry === 'string'),
    'unblock item evidence should contain strings.',
  );
  assert.equal(typeof item.intakeDir, 'string');
  assert.ok(Array.isArray(item.issueCodes), 'unblock item issueCodes should be an array.');
  assert.ok(
    item.issueCodes.every((issueCode) => typeof issueCode === 'string'),
    'unblock item issueCodes should contain strings.',
  );
  assert.equal(typeof item.severity, 'string');
  assert.ok(Array.isArray(item.sourceReports), 'unblock item sourceReports should be an array.');
  assert.ok(
    item.sourceReports.every((sourceReport) => typeof sourceReport === 'string'),
    'unblock item sourceReports should contain strings.',
  );
}

function assertUnblockRollupEntry(value: unknown) {
  const entry = assertObjectRecord(value, 'unblock rollup entry');

  assert.equal(typeof entry.affectedIntakeCount, 'number');
  assert.equal(typeof entry.category, 'string');
  assert.ok(Array.isArray(entry.intakeDirs), 'unblock rollup intakeDirs should be an array.');
  assert.ok(
    entry.intakeDirs.every((intakeDir) => typeof intakeDir === 'string'),
    'unblock rollup intakeDirs should contain string paths.',
  );
  assert.equal(typeof entry.itemCount, 'number');
  assert.equal(typeof entry.severity, 'string');
}

function assertGateItem(value: unknown) {
  const item = assertObjectRecord(value, 'gate item');

  assert.equal(typeof item.detail, 'string');
  assert.equal(typeof item.issueCode, 'string');
  assert.equal(typeof item.kind, 'string');
  assert.equal(typeof item.severity, 'string');
  assert.ok(Array.isArray(item.sourceReports), 'gate item sourceReports should be an array.');
  assert.ok(
    item.sourceReports.every((sourceReport) => typeof sourceReport === 'string'),
    'gate item sourceReports should contain string paths.',
  );
}

function assertIssueCodeRollupEntry(value: unknown) {
  const entry = assertObjectRecord(value, 'issueCode rollup entry');

  assert.equal(typeof entry.affectedIntakeCount, 'number');
  assert.ok(Array.isArray(entry.intakeDirs), 'issueCode rollup intakeDirs should be an array.');
  assert.ok(
    entry.intakeDirs.every((intakeDir) => typeof intakeDir === 'string'),
    'issueCode rollup intakeDirs should contain string paths.',
  );
  assert.equal(typeof entry.issueCode, 'string');
  assert.equal(typeof entry.itemCount, 'number');
  assert.equal(typeof entry.kind, 'string');
  assert.equal(typeof entry.severity, 'string');
}

function assertP0Attribution(value: unknown) {
  const attribution = assertObjectRecord(value, 'P0 signal attribution');

  assert.equal(typeof attribution.aggregateSignalStatus, 'string');
  assert.equal(typeof attribution.entryStatus === 'string' || attribution.entryStatus === null, true);
  assert.equal(typeof attribution.gapKind, 'string');
  assert.ok(Array.isArray(attribution.reasons), 'P0 signal attribution reasons should be an array.');
  assert.equal(typeof attribution.status, 'string');
  assert.equal(typeof attribution.supportsTarget, 'boolean');
}

function assertP0Signal(value: unknown) {
  const signal = assertObjectRecord(value, 'P0 target signal');

  assert.equal(typeof signal.gapKind, 'string');
  assert.equal(typeof signal.status, 'string');
  assert.equal(typeof signal.intakeCount, 'number');
}

function assertGateContract(result: Record<string, unknown>) {
  assert.equal(result.kind, 'agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report');
  assert.equal(result.version, 1);
  assert.equal(result.readyForProductionRuntime, false);
  assert.equal(typeof result.status, 'string');
  assert.equal(typeof result.summaryText, 'string');
  assert.equal(typeof result.reportText, 'string');
  assert.equal(typeof result.guardrail, 'string');
  assert.equal(typeof result.fieldCompletenessSummaryText, 'string');
  assert.equal(typeof result.p0IntakeTargetStatusSummaryText, 'string');
  assert.equal(typeof result.runbookCompletionSummaryText, 'string');
  assertNumberRecordKeys(
    result,
    [
      'blockedCount',
      'intakeCount',
      'readyForManualReviewCount',
      'reviewNeededCount',
    ],
    'intake readiness gate',
  );
  assertNumberRecordKeys(
    result.statusCounts,
    [
      'blocked',
      'ready-for-manual-review',
      'review-needed',
    ],
    'statusCounts',
  );
  assert.ok(Array.isArray(result.entries), 'entries should be an array.');
  assert.ok(Array.isArray(result.issueCodeRollup), 'issueCodeRollup should be an array.');
  assert.ok(Array.isArray(result.p0TargetSignals), 'p0TargetSignals should be an array.');
  assert.ok(Array.isArray(result.unblockItems), 'unblockItems should be an array.');
  assert.ok(Array.isArray(result.unblockRollup), 'unblockRollup should be an array.');
  for (const entry of result.entries) {
    assertGateEntry(entry);
  }
  for (const entry of result.issueCodeRollup) {
    assertIssueCodeRollupEntry(entry);
  }
  for (const signal of result.p0TargetSignals) {
    assertP0Signal(signal);
  }
  for (const item of result.unblockItems) {
    assertUnblockItem(item);
  }
  for (const entry of result.unblockRollup) {
    assertUnblockRollupEntry(entry);
  }
}

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report.ts',
});

assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report.ts CLI JSON contract',
);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-intake-readiness-gate-cli-'));
try {
  const example = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample({
    outDir: tempDir,
    prettyJson: true,
  });
  const cliResult = runCli([
    '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report.ts',
    '--dir',
    example.intakeDirs.ready,
    '--pretty',
  ]);

  assert.equal(
    cliResult.status,
    0,
    cliResult.stderr || cliResult.stdout || cliResult.error?.message,
  );
  assert.match(cliResult.stdout, /AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReport status=blocked/u);
  assert.match(cliResult.stdout, /readyForProductionRuntime=no/u);
  assert.match(cliResult.stdout, /issueCodeRollup:/u);
  assert.match(cliResult.stdout, /unblockRollup:/u);
  assert.match(cliResult.stdout, /unblockItems:/u);
  assert.match(cliResult.stdout, /category=review-p0-targets/u);
  assert.match(cliResult.stdout, /intakeReadinessGateEntries:/u);

  const result = parseTrailingJsonObject(cliResult.stdout);
  assertGateContract(result);
  assert.equal(result.status, 'blocked');
  assert.equal(result.intakeCount, 1);
  assert.equal(result.blockedCount, 1);
  assert.equal(result.reviewNeededCount, 0);
  assert.equal(result.readyForManualReviewCount, 0);
  assert.equal(assertObjectRecord(result.statusCounts, 'statusCounts').blocked, 1);
  assert.ok(Array.isArray(result.issueCodeRollup) && result.issueCodeRollup.length > 0);
  assert.ok(Array.isArray(result.unblockItems) && result.unblockItems.length > 0);
  assert.ok(Array.isArray(result.unblockRollup) && result.unblockRollup.length > 0);
  const firstEntry = assertObjectRecord((result.entries as unknown[])[0], 'first gate entry');
  assert.ok(Array.isArray(firstEntry.p0SignalAttributions), 'first gate entry should expose P0 attributions.');
  assert.equal(firstEntry.p0SignalAttributions.length, 2);
  assert.ok(Array.isArray(firstEntry.blockerItems), 'first gate entry blockerItems should be an array.');
  assert.ok(firstEntry.blockerItems.length > 0, 'rehearsal ready gate entry should expose P0 blocker items.');
  assert.match(String(result.reportText), /p0Attribution gapKind=real-exported-corpus/u);
  assert.match(String(result.guardrail), /explicitly supplied --dir/u);
  assert.match(String(result.guardrail), /does not discover directories/u);
  assert.match(String(result.guardrail), /grant runtime authority/u);
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch intake readiness gate report CLI JSON contract smoke ok');
