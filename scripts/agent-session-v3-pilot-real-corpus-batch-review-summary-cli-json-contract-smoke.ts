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

function assertStringValue(value: unknown, label: string) {
  assert.equal(typeof value, 'string', `${label} should be a string.`);
}

function assertStringArray(value: unknown, label: string) {
  assert.ok(Array.isArray(value), `${label} should be an array.`);
  for (const entry of value) {
    assert.equal(typeof entry, 'string', `${label} entries should be strings.`);
  }
}

function assertPhaseCoverageCountsShape(value: unknown, label: string) {
  const record = assertObjectRecord(value, label);
  assert.match(String(record.status), /^(clean|needs-review|unavailable)$/u);
  assertNumberRecordKeys(
    record,
    [
      'failedCheckCount',
      'failedManifestCount',
      'sourceKindCleanCount',
      'sourceKindCount',
      'sourceKindNeedsReviewCount',
    ],
    label,
  );
}

function assertReviewSummaryContract(report: Record<string, unknown>) {
  assert.equal(report.kind, 'agent-session-v3-pilot-real-corpus-batch-review-summary');
  assert.equal(report.version, 1);
  assertStringValue(report.status, 'status');
  assertStringValue(report.summaryText, 'summaryText');
  assertStringValue(report.reportText, 'reportText');
  assertNumberRecordKeys(
    report,
    [
      'intakeCount',
      'totalBlockerItems',
      'totalReviewItems',
    ],
    'batch review summary',
  );
  assertNumberRecordKeys(
    report.statusCounts,
    [
      'blocked',
      'readyForManualReview',
      'reviewNeeded',
    ],
    'statusCounts',
  );
  assert.ok(Array.isArray(report.intakeEntries), 'intakeEntries should be an array.');
  assert.ok(Array.isArray(report.focusItems), 'focusItems should be an array.');
  assert.ok(Array.isArray(report.optionalEvidenceReports), 'optionalEvidenceReports should be an array.');
  const rollup = assertObjectRecord(report.rollup, 'rollup');
  assert.equal(rollup.kind, 'agent-session-v3-pilot-real-corpus-batch-readiness-rollup-report');

  for (const entry of report.intakeEntries as Record<string, unknown>[]) {
    assertStringValue(entry.intakeDir, 'intakeEntries.intakeDir');
    assertStringValue(entry.status, 'intakeEntries.status');
    assertStringValue(entry.validatorStatus, 'intakeEntries.validatorStatus');
    assertStringValue(entry.evidenceSummaryStatus, 'intakeEntries.evidenceSummaryStatus');
    assertStringValue(entry.metadataStatus, 'intakeEntries.metadataStatus');
    assertNumberRecordKeys(entry, ['blockerCount', 'reviewCount'], 'intake entry');
    assertPhaseCoverageCountsShape(entry.phaseCoverageCounts, 'intake entry phaseCoverageCounts');
    assertNumberRecordKeys(
      entry.readinessCounts,
      [
        'manifestSources',
        'indexManifests',
        'indexReady',
        'indexMixed',
        'indexNotReady',
      ],
      'intake entry readinessCounts',
    );
  }

  for (const item of report.focusItems as Record<string, unknown>[]) {
    assertStringValue(item.id, 'focus item id');
    assertStringValue(item.severity, 'focus item severity');
    assertStringValue(item.title, 'focus item title');
    assert.equal(typeof item.count, 'number');
    assertStringArray(item.intakeDirs, 'focus item intakeDirs');
  }

  for (const item of report.optionalEvidenceReports as Record<string, unknown>[]) {
    assert.deepEqual(Object.keys(item).sort(), [
      'boundary',
      'path',
      'purpose',
    ]);
    assertStringValue(item.boundary, 'optional evidence report boundary');
    assertStringValue(item.path, 'optional evidence report path');
    assertStringValue(item.purpose, 'optional evidence report purpose');
  }
}

const { summarySource } = readProjectSources({
  summarySource: 'scripts/agent-session-v3-pilot-real-corpus-batch-review-summary.ts',
});

assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  summarySource,
  'agent-session-v3-pilot-real-corpus-batch-review-summary.ts CLI JSON contract',
);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-batch-review-summary-json-contract-'));
try {
  const example = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample({
    outDir: path.join(tempDir, 'example'),
    prettyJson: true,
  });
  const cliResult = runCli([
    '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-review-summary.ts',
    '--dir',
    example.intakeDirs.missing,
    '--dir',
    example.intakeDirs.mixed,
    '--dir',
    example.intakeDirs.ready,
    '--pretty',
  ]);

  assert.equal(
    cliResult.status,
    0,
    cliResult.stderr || cliResult.stdout || cliResult.error?.message,
  );
  assert.match(cliResult.stdout, /AgentSessionV3PilotRealCorpusBatchReviewSummary status=blocked/u);
  assert.match(cliResult.stdout, /reviewIntakes:/u);
  assert.match(cliResult.stdout, /phaseCoverage=unavailable/u);
  assert.match(cliResult.stdout, /phaseCoverage=clean/u);
  assert.match(cliResult.stdout, /reviewFocusItems:/u);
  assert.match(cliResult.stdout, /optionalEvidenceReports:/u);
  assert.match(cliResult.stdout, /agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit\.ts/u);
  assert.match(cliResult.stdout, /reviewBoundary: summary-only evidence view/u);

  const report = parseTrailingJsonObject(cliResult.stdout);
  assertReviewSummaryContract(report);
  assert.equal(report.status, 'blocked');
  assert.equal(report.intakeCount, 3);
  assert.deepEqual(report.statusCounts, {
    blocked: 1,
    readyForManualReview: 1,
    reviewNeeded: 1,
  });
  assert.ok(
    (report.intakeEntries as Record<string, unknown>[]).some((entry) => (
      entry.validatorStatus === 'missing'
        && (entry.phaseCoverageCounts as Record<string, unknown>).status === 'unavailable'
    )),
  );
  assert.ok(
    (report.intakeEntries as Record<string, unknown>[]).some((entry) => (
      entry.status === 'ready-for-manual-review'
        && (entry.phaseCoverageCounts as Record<string, unknown>).status === 'clean'
    )),
  );
  assert.ok(
    (report.optionalEvidenceReports as Record<string, unknown>[]).some((entry) => (
      entry.path === 'scripts/agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts'
        && String(entry.boundary).includes('no readiness decision')
    )),
  );
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch review summary CLI JSON contract smoke ok');
