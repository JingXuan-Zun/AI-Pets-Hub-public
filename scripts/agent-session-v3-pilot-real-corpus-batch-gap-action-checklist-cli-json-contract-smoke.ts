import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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

function assertActionContract(action: unknown) {
  const actionRecord = assertObjectRecord(action, 'gap action');
  const keys = Object.keys(actionRecord).sort();

  assert.deepEqual(keys, [
    'boundary',
    'gapCount',
    'gapKind',
    'manualAction',
    'priority',
    'rationale',
    'title',
  ]);
  assert.equal(typeof actionRecord.boundary, 'string');
  assert.equal(typeof actionRecord.gapCount, 'number');
  assert.equal(typeof actionRecord.gapKind, 'string');
  assert.equal(typeof actionRecord.manualAction, 'string');
  assert.match(String(actionRecord.priority), /^P[0-2]$/u);
  assert.equal(typeof actionRecord.rationale, 'string');
  assert.equal(typeof actionRecord.title, 'string');
}

function assertGapActionChecklistContract(result: Record<string, unknown>) {
  assert.equal(result.kind, 'agent-session-v3-pilot-real-corpus-batch-gap-action-checklist');
  assert.equal(result.version, 1);
  assert.equal(result.readyForProductionRuntime, false);
  assert.equal(typeof result.summaryText, 'string');
  assert.equal(typeof result.reportText, 'string');
  assert.equal(typeof result.guardrail, 'string');
  assert.equal(typeof result.dashboardSummaryText, 'string');
  assertNumberRecordKeys(
    result,
    [
      'actionCount',
      'dashboardGapCount',
      'dashboardSmokeIndexEntryCount',
      'dashboardSmokeIndexMissingCount',
      'dashboardSmokeIndexUnindexedCount',
    ],
    'gap action checklist',
  );
  assertNumberRecordKeys(
    result.priorityCounts,
    [
      'P0',
      'P1',
      'P2',
    ],
    'priorityCounts',
  );
  assertNumberRecordKeys(
    result.dashboardGapCounts,
    [
      'broader-real-corpus',
      'manifest-distribution',
      'real-exported-corpus',
      'real-exported-fixture',
      'real-production-like-sample',
      'real-threshold-profile',
    ],
    'dashboardGapCounts',
  );
  assert.ok(Array.isArray(result.actions), 'actions should be an array.');
  assert.ok(result.actions.length > 0, 'actions should preserve manual gap priorities.');
  const dashboardGapCounts = assertObjectRecord(result.dashboardGapCounts, 'dashboardGapCounts');
  const dashboardGapCountSum = Object.values(dashboardGapCounts)
    .reduce((sum, count) => sum + Number(count), 0);

  assert.equal(result.dashboardGapCount, dashboardGapCountSum);
  for (const action of result.actions) {
    assertActionContract(action);
    const actionRecord = action as Record<string, unknown>;
    assert.equal(
      actionRecord.gapCount,
      dashboardGapCounts[String(actionRecord.gapKind)],
      `${String(actionRecord.gapKind)} action count should mirror dashboard gap count.`,
    );
  }
}

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-gap-action-checklist.ts',
});

assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-gap-action-checklist.ts CLI JSON contract',
);

const cliResult = runCli([
  '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-gap-action-checklist.ts',
  '--pretty',
]);

assert.equal(
  cliResult.status,
  0,
  cliResult.stderr || cliResult.stdout || cliResult.error?.message,
);
assert.match(cliResult.stdout, /AgentSessionV3PilotRealCorpusBatchGapActionChecklist/u);
assert.match(cliResult.stdout, /manualActionChecklist:/u);
assert.match(cliResult.stdout, /readyForProductionRuntime=no/u);

const result = parseTrailingJsonObject(cliResult.stdout);
assertGapActionChecklistContract(result);
assert.equal(result.actionCount, 6);
assert.match(String(result.dashboardSummaryText), new RegExp(`smokes=${String(result.dashboardSmokeIndexEntryCount)}`, 'u'));
assert.ok(Number(result.dashboardSmokeIndexEntryCount) > 0);
assert.equal(assertObjectRecord(result.priorityCounts, 'priorityCounts').P0, 2);
assert.equal(assertObjectRecord(result.priorityCounts, 'priorityCounts').P1, 2);
assert.equal(assertObjectRecord(result.priorityCounts, 'priorityCounts').P2, 2);
assert.match(String(result.reportText), /priority=P0 gapKind=real-production-like-sample/u);
assert.match(String(result.guardrail), /does not collect samples/u);
assert.match(String(result.guardrail), /not runtime action order/u);

console.log('agent session v3 pilot real corpus batch gap action checklist CLI JSON contract smoke ok');
