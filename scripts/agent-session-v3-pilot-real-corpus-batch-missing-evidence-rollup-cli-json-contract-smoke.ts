import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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

function assertMissingEvidenceEntryContract(entry: unknown) {
  const entryRecord = assertObjectRecord(entry, 'missing evidence entry');
  assert.deepEqual(Object.keys(entryRecord).sort(), [
    'boundary',
    'gapCount',
    'gapKind',
    'manualEvidence',
    'markerSourceCounts',
    'priority',
    'title',
  ]);
  assert.equal(typeof entryRecord.boundary, 'string');
  assert.equal(typeof entryRecord.gapCount, 'number');
  assert.equal(typeof entryRecord.gapKind, 'string');
  assert.equal(typeof entryRecord.manualEvidence, 'string');
  assert.equal(typeof entryRecord.priority, 'string');
  assert.equal(typeof entryRecord.title, 'string');
  assertNumberRecordKeys(
    entryRecord.markerSourceCounts,
    [
      'explicit-marker',
      'legacy-wording',
    ],
    'missing evidence markerSourceCounts',
  );
}

function assertMissingEvidenceRollupContract(result: Record<string, unknown>) {
  assert.equal(result.kind, 'agent-session-v3-pilot-real-corpus-batch-missing-evidence-rollup');
  assert.equal(result.version, 1);
  assert.equal(result.readyForProductionRuntime, false);
  assert.equal(typeof result.summaryText, 'string');
  assert.equal(typeof result.reportText, 'string');
  assert.equal(typeof result.guardrail, 'string');
  assert.equal(typeof result.dashboardSummaryText, 'string');
  assert.equal(typeof result.gapActionSummaryText, 'string');
  assert.equal(typeof result.missingEvidenceStatus, 'string');
  assert.equal(typeof result.markerStatus, 'string');
  assertNumberRecordKeys(
    result,
    [
      'actionCount',
      'dashboardGapCount',
      'dashboardSmokeIndexEntryCount',
      'dashboardSmokeIndexMissingCount',
      'dashboardSmokeIndexUnindexedCount',
      'gapKindEntryCount',
    ],
    'missing evidence rollup',
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
  assertNumberRecordKeys(
    result.dashboardGapSourceCounts,
    [
      'explicit-marker',
      'legacy-wording',
    ],
    'dashboardGapSourceCounts',
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
  assert.ok(Array.isArray(result.missingEvidenceEntries), 'missingEvidenceEntries should be an array.');
  assert.ok(Array.isArray(result.unprioritizedGapKinds), 'unprioritizedGapKinds should be an array.');
  for (const entry of result.missingEvidenceEntries) {
    assertMissingEvidenceEntryContract(entry);
  }
  for (const kind of result.unprioritizedGapKinds) {
    assert.equal(typeof kind, 'string');
  }
}

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-missing-evidence-rollup.ts',
});

assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-missing-evidence-rollup.ts CLI JSON contract',
);

const cliResult = runCli([
  '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-missing-evidence-rollup.ts',
  '--pretty',
]);

assert.equal(
  cliResult.status,
  0,
  cliResult.stderr || cliResult.stdout || cliResult.error?.message,
);
assert.match(cliResult.stdout, /AgentSessionV3PilotRealCorpusBatchMissingEvidenceRollup status=missing-real-evidence/u);
assert.match(cliResult.stdout, /missingEvidenceByKind:/u);
assert.match(cliResult.stdout, /readyForProductionRuntime=no/u);

const result = parseTrailingJsonObject(cliResult.stdout);
assertMissingEvidenceRollupContract(result);
assert.equal(result.missingEvidenceStatus, 'missing-real-evidence');
assert.equal(result.markerStatus, 'explicit-marker-covered');
assert.match(String(result.dashboardSummaryText), new RegExp(`smokes=${String(result.dashboardSmokeIndexEntryCount)}`, 'u'));
assert.ok(Number(result.dashboardSmokeIndexEntryCount) > 0);
assert.equal(result.actionCount, 6);
assert.equal(result.gapKindEntryCount, 6);
assert.equal(assertObjectRecord(result.priorityCounts, 'priorityCounts').P0, 2);
assert.equal(assertObjectRecord(result.priorityCounts, 'priorityCounts').P1, 2);
assert.equal(assertObjectRecord(result.priorityCounts, 'priorityCounts').P2, 2);
assert.equal(assertObjectRecord(result.dashboardGapSourceCounts, 'dashboardGapSourceCounts')['explicit-marker'], result.dashboardGapCount);
assert.equal(assertObjectRecord(result.dashboardGapSourceCounts, 'dashboardGapSourceCounts')['legacy-wording'], 0);
assert.deepEqual(result.unprioritizedGapKinds, []);
assert.match(String(result.reportText), /priority=P0 gapKind=real-production-like-sample/u);
assert.match(String(result.guardrail), /does not collect samples/u);
assert.match(String(result.guardrail), /define runtime action order/u);

console.log('agent session v3 pilot real corpus batch missing evidence rollup CLI JSON contract smoke ok');
