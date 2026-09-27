import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  assertNumberRecordKeys,
  assertObjectRecord,
  assertSourceDoesNotUseRuntimeOrFixedDesktopChain,
  parseTrailingJsonObject,
} from './agent-session-v3-pilot-cli-json-contract-helpers.ts';
import { createAgentSessionV3PilotRealCorpusBatchSmokeIndex } from './agent-session-v3-pilot-real-corpus-batch-smoke-index.ts';
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

function assertDashboardContract(result: Record<string, unknown>) {
  assert.equal(result.kind, 'agent-session-v3-pilot-real-corpus-batch-status-dashboard-report');
  assert.equal(result.version, 1);
  assert.equal(result.readyForProductionRuntime, false);
  assert.equal(typeof result.summaryText, 'string');
  assert.equal(typeof result.reportText, 'string');
  assert.equal(typeof result.guardrail, 'string');
  assert.equal(typeof result.gapCount, 'number');
  assertNumberRecordKeys(
    result.gapSourceCounts,
    [
      'explicit-marker',
      'legacy-wording',
    ],
    'gapSourceCounts',
  );
  assert.equal(typeof result.smokeIndexEntryCount, 'number');
  assert.equal(typeof result.smokeIndexMissingCount, 'number');
  assert.equal(typeof result.smokeIndexUnindexedCount, 'number');
  assert.equal(result.smokeIndexMissingCount, 0);
  assert.equal(result.smokeIndexUnindexedCount, 0);
  assertNumberRecordKeys(
    result.gapCounts,
    [
      'broader-real-corpus',
      'manifest-distribution',
      'real-exported-corpus',
      'real-exported-fixture',
      'real-production-like-sample',
      'real-threshold-profile',
    ],
    'gapCounts',
  );
  assertNumberRecordKeys(
    result.smokeGroupCounts,
    [
      'cli-contract',
      'coverage-index',
      'gap-action-checklist',
      'intake-readiness-gate',
      'intake-template',
      'status-dashboard',
    ],
    'smokeGroupCounts',
  );
  assert.ok(Array.isArray(result.gaps), 'gaps should be an array.');
  assert.ok(result.gaps.length > 0, 'gaps should preserve real sample gaps.');
  for (const gap of result.gaps) {
    const gapRecord = assertObjectRecord(gap, 'gap');
    assert.equal(typeof gapRecord.kind, 'string');
    assert.equal(typeof gapRecord.line, 'string');
    assert.equal(typeof gapRecord.source, 'string');
  }
}

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-status-dashboard-report.ts',
});

assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-status-dashboard-report.ts CLI JSON contract',
);

const cliResult = runCli([
  '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-status-dashboard-report.ts',
  '--pretty',
]);

assert.equal(
  cliResult.status,
  0,
  cliResult.stderr || cliResult.stdout || cliResult.error?.message,
);
assert.match(cliResult.stdout, /AgentSessionV3PilotRealCorpusBatchStatusDashboard/u);
assert.match(cliResult.stdout, /realSampleGaps=/u);
assert.match(cliResult.stdout, /readyForProductionRuntime=no/u);

const result = parseTrailingJsonObject(cliResult.stdout);
const smokeIndex = createAgentSessionV3PilotRealCorpusBatchSmokeIndex({
  projectRoot,
});
assertDashboardContract(result);
assert.equal(result.smokeIndexEntryCount, smokeIndex.entryCount);
assert.equal(
  assertObjectRecord(result.smokeGroupCounts, 'smokeGroupCounts')['intake-readiness-gate'],
  smokeIndex.groupCounts['intake-readiness-gate'],
);
assert.equal(
  assertObjectRecord(result.smokeGroupCounts, 'smokeGroupCounts')['intake-template'],
  smokeIndex.groupCounts['intake-template'],
);
assert.ok(Number(assertObjectRecord(result.gapCounts, 'gapCounts')['real-exported-corpus']) > 0);
assert.equal(assertObjectRecord(result.gapSourceCounts, 'gapSourceCounts')['explicit-marker'], result.gapCount);
assert.equal(assertObjectRecord(result.gapSourceCounts, 'gapSourceCounts')['legacy-wording'], 0);
assert.match(String(result.summaryText), /legacyWordingGaps=0/u);
assert.match(String(result.reportText), /realSampleGapSources:/u);
assert.match(String(result.reportText), /Real exported corpus batches are still needed/u);
assert.match(String(result.guardrail), /does not run smoke tests/u);

console.log('agent session v3 pilot real corpus batch status dashboard CLI JSON contract smoke ok');
