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

function assertFinalGapItemContract(value: unknown) {
  const item = assertObjectRecord(value, 'final gap item');

  assert.deepEqual(Object.keys(item).sort(), [
    'boundary',
    'gapCount',
    'gapKind',
    'manualEvidence',
    'priority',
    'sourceReports',
    'title',
  ]);
  assert.equal(typeof item.boundary, 'string');
  assert.equal(typeof item.gapCount, 'number');
  assert.equal(typeof item.gapKind, 'string');
  assert.equal(typeof item.manualEvidence, 'string');
  assert.match(String(item.priority), /^(P0|P1|P2|unprioritized)$/u);
  assert.ok(Array.isArray(item.sourceReports), 'final gap sourceReports should be an array.');
  assert.equal(typeof item.title, 'string');
  for (const report of item.sourceReports) {
    assert.equal(typeof report, 'string');
  }
}

function assertFinalGapReportContract(result: Record<string, unknown>) {
  assert.equal(result.kind, 'agent-session-v3-pilot-real-corpus-batch-final-gap-report');
  assert.equal(result.version, 1);
  assert.equal(result.readyForProductionRuntime, false);
  assert.match(String(result.status), /^(missing-real-evidence|no-final-gaps)$/u);
  assert.equal(typeof result.guardrail, 'string');
  assert.equal(typeof result.missingEvidenceSummaryText, 'string');
  assert.equal(typeof result.reportText, 'string');
  assert.equal(typeof result.summaryText, 'string');
  assertNumberRecordKeys(
    result,
    [
      'dashboardGapCount',
      'finalGapCount',
    ],
    'final gap report',
  );
  assertNumberRecordKeys(
    result.priorityCounts,
    [
      'P0',
      'P1',
      'P2',
      'unprioritized',
    ],
    'priorityCounts',
  );
  assert.ok(Array.isArray(result.finalGaps), 'finalGaps should be an array.');
  for (const gap of result.finalGaps) {
    assertFinalGapItemContract(gap);
  }
}

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-final-gap-report.ts',
});

assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-final-gap-report.ts CLI JSON contract',
);

const cliResult = runCli([
  '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-final-gap-report.ts',
  '--pretty',
]);

assert.equal(
  cliResult.status,
  0,
  cliResult.stderr || cliResult.stdout || cliResult.error?.message,
);
assert.match(cliResult.stdout, /AgentSessionV3PilotRealCorpusBatchFinalGapReport status=missing-real-evidence/u);
assert.match(cliResult.stdout, /finalManualGapList:/u);
assert.match(cliResult.stdout, /readyForProductionRuntime=no/u);

const result = parseTrailingJsonObject(cliResult.stdout);
const priorityCounts = assertObjectRecord(result.priorityCounts, 'priorityCounts');

assertFinalGapReportContract(result);
assert.equal(result.status, 'missing-real-evidence');
assert.equal(result.finalGapCount, 6);
assert.equal(priorityCounts.P0, 2);
assert.equal(priorityCounts.P1, 2);
assert.equal(priorityCounts.P2, 2);
assert.equal(priorityCounts.unprioritized, 0);
assert.match(String(result.missingEvidenceSummaryText), /status=missing-real-evidence/u);
assert.match(String(result.reportText), /priority=P0 gapKind=real-exported-corpus/u);
assert.match(String(result.reportText), /priority=P2 gapKind=real-threshold-profile/u);
assert.match(String(result.guardrail), /does not discover directories/u);
assert.match(String(result.guardrail), /define runtime action order/u);
assert.match(String(result.guardrail), /grant runtime authority/u);

console.log('agent session v3 pilot real corpus batch final gap report CLI JSON contract smoke ok');
