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

function assertSampleNoteFieldContract(value: unknown) {
  const field = assertObjectRecord(value, 'intake filling sample note field');

  assert.deepEqual(Object.keys(field).sort(), [
    'id',
    'label',
    'placeholder',
    'reason',
  ]);
  assert.equal(typeof field.id, 'string');
  assert.equal(typeof field.label, 'string');
  assert.equal(typeof field.placeholder, 'string');
  assert.equal(typeof field.reason, 'string');
}

function assertStringArray(value: unknown, label: string) {
  assert.ok(Array.isArray(value), `${label} should be an array.`);
  for (const item of value) {
    assert.equal(typeof item, 'string');
  }
}

function assertFillingItemContract(value: unknown) {
  const item = assertObjectRecord(value, 'intake filling item');

  assert.deepEqual(Object.keys(item).sort(), [
    'boundary',
    'gapCount',
    'gapKind',
    'indexFields',
    'manifestFields',
    'manualEvidence',
    'priority',
    'sampleNoteFields',
    'sourceReports',
    'title',
  ]);
  assert.equal(typeof item.boundary, 'string');
  assert.equal(typeof item.gapCount, 'number');
  assert.equal(typeof item.gapKind, 'string');
  assert.equal(typeof item.manualEvidence, 'string');
  assert.match(String(item.priority), /^(P0|P1|P2|unprioritized)$/u);
  assert.equal(typeof item.title, 'string');
  assertStringArray(item.indexFields, 'indexFields');
  assertStringArray(item.manifestFields, 'manifestFields');
  assertStringArray(item.sourceReports, 'sourceReports');
  assert.ok(Array.isArray(item.sampleNoteFields), 'sampleNoteFields should be an array.');
  for (const field of item.sampleNoteFields) {
    assertSampleNoteFieldContract(field);
  }
}

function assertIntakeFillingSupportReportContract(result: Record<string, unknown>) {
  assert.equal(result.kind, 'agent-session-v3-pilot-real-corpus-batch-intake-filling-support-report');
  assert.equal(result.version, 1);
  assert.equal(result.readyForProductionRuntime, false);
  assert.match(String(result.status), /^(needs-intake-filling|no-final-gaps)$/u);
  assert.equal(typeof result.finalGapSummaryText, 'string');
  assert.equal(typeof result.guardrail, 'string');
  assert.equal(typeof result.reportText, 'string');
  assert.equal(typeof result.summaryText, 'string');
  assertNumberRecordKeys(
    result,
    [
      'finalGapCount',
    'fillingItemCount',
    ],
    'intake filling support report',
  );
  assertStringArray(result.followUpReportPaths, 'followUpReportPaths');
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
  assert.ok(Array.isArray(result.fillingItems), 'fillingItems should be an array.');
  for (const item of result.fillingItems) {
    assertFillingItemContract(item);
  }
}

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-intake-filling-support-report.ts',
});

assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-intake-filling-support-report.ts CLI JSON contract',
);

const cliResult = runCli([
  '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-intake-filling-support-report.ts',
  '--pretty',
]);

assert.equal(
  cliResult.status,
  0,
  cliResult.stderr || cliResult.stdout || cliResult.error?.message,
);
assert.match(cliResult.stdout, /AgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReport status=needs-intake-filling/u);
assert.match(cliResult.stdout, /manualIntakeFillingItems:/u);
assert.match(cliResult.stdout, /followUpReports:/u);
assert.match(cliResult.stdout, /fillingItems=6/u);
assert.match(cliResult.stdout, /readyForProductionRuntime=no/u);

const result = parseTrailingJsonObject(cliResult.stdout);
const priorityCounts = assertObjectRecord(result.priorityCounts, 'priorityCounts');

assertIntakeFillingSupportReportContract(result);
assert.equal(result.status, 'needs-intake-filling');
assert.equal(result.finalGapCount, 6);
assert.equal(result.fillingItemCount, 6);
assert.ok(
  (result.followUpReportPaths as string[]).includes('scripts/agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts'),
);
assert.equal(priorityCounts.P0, 2);
assert.equal(priorityCounts.P1, 2);
assert.equal(priorityCounts.P2, 2);
assert.equal(priorityCounts.unprioritized, 0);
assert.deepEqual(
  (result.fillingItems as Record<string, unknown>[]).map((item) => `${String(item.priority)}:${String(item.gapKind)}`),
  [
    'P0:real-exported-corpus',
    'P0:real-production-like-sample',
    'P1:broader-real-corpus',
    'P1:manifest-distribution',
    'P2:real-exported-fixture',
    'P2:real-threshold-profile',
  ],
);
assert.match(String(result.finalGapSummaryText), /status=missing-real-evidence/u);
assert.match(String(result.reportText), /gapKind=real-exported-corpus/u);
assert.match(String(result.reportText), /sampleNoteFields=.*p0-real-exported-signal/u);
assert.match(String(result.reportText), /gapKind=real-threshold-profile/u);
assert.match(String(result.reportText), /sampleNoteFields=.*threshold-action/u);
assert.match(String(result.reportText), /agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit\.ts/u);
assert.match(String(result.guardrail), /does not discover directories/u);
assert.match(String(result.guardrail), /auto-fill files/u);
assert.match(String(result.guardrail), /write manifests/u);
assert.match(String(result.guardrail), /define runtime action order/u);
assert.match(String(result.guardrail), /grant runtime authority/u);

console.log('agent session v3 pilot real corpus batch intake filling support report CLI JSON contract smoke ok');
