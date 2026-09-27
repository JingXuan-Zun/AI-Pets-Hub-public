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
import { runAgentSessionV3PilotRealCorpusBatchHandoffBundle } from './agent-session-v3-pilot-real-corpus-batch-handoff-bundle.ts';
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

function assertNumberValue(value: unknown, label: string) {
  assert.equal(typeof value, 'number', `${label} should be a number.`);
}

function assertStringArray(value: unknown, label: string) {
  assert.ok(Array.isArray(value), `${label} should be an array.`);
  for (const entry of value) {
    assert.equal(typeof entry, 'string', `${label} entries should be strings.`);
  }
}

function assertPhaseCoverageObservationShape(value: unknown, label: string) {
  if (value === null) {
    return;
  }

  const phaseCoverage = assertObjectRecord(value, label);
  assertNumberValue(phaseCoverage.entryCount, `${label}.entryCount`);
  assertObjectRecord(phaseCoverage.statusCounts, `${label}.statusCounts`);
  assertStringArray(phaseCoverage.statuses, `${label}.statuses`);
}

function assertEntryShape(value: unknown) {
  const entry = assertObjectRecord(value, 'entry');

  assertStringValue(entry.label, 'entry.label');
  assert.match(String(entry.status), /^(blocked|consistent|review-needed)$/u);
  assertStringValue(entry.intakeDir, 'entry.intakeDir');
  assertStringValue(entry.handoffBundleDir, 'entry.handoffBundleDir');
  assertNumberValue(entry.issueCount, 'entry.issueCount');
  assertNumberValue(entry.blockerCount, 'entry.blockerCount');
  assertNumberValue(entry.reviewCount, 'entry.reviewCount');
  assertStringValue(entry.sourcePreflightStatus, 'entry.sourcePreflightStatus');
  assertStringValue(entry.sampleSourceConsistencyStatus, 'entry.sampleSourceConsistencyStatus');
  assertStringValue(entry.reviewerPacketStatus, 'entry.reviewerPacketStatus');
  assertStringValue(entry.summaryText, 'entry.summaryText');
  assertPhaseCoverageObservationShape(entry.reviewSummaryPhaseCoverage, 'entry.reviewSummaryPhaseCoverage');
  assertPhaseCoverageObservationShape(entry.readinessRollupPhaseCoverage, 'entry.readinessRollupPhaseCoverage');
  assert.ok(Array.isArray(entry.sourcePreflightIssueCodes), 'entry.sourcePreflightIssueCodes should be an array.');
  assert.ok(Array.isArray(entry.sampleSourceConsistencyIssueCodes), 'entry.sampleSourceConsistencyIssueCodes should be an array.');
  assert.ok(Array.isArray(entry.reviewerPacketIssueCodes), 'entry.reviewerPacketIssueCodes should be an array.');
}

function assertRollupContract(result: Record<string, unknown>) {
  assert.equal(result.kind, 'agent-session-v3-pilot-real-corpus-batch-handoff-source-preflight-rollup');
  assert.equal(result.version, 1);
  assert.equal(result.readyForProductionRuntime, false);
  assert.match(String(result.status), /^(blocked|consistent|review-needed)$/u);
  assertNumberValue(result.entryCount, 'entryCount');
  assertNumberValue(result.issueCount, 'issueCount');
  assertNumberValue(result.blockerCount, 'blockerCount');
  assertNumberValue(result.reviewCount, 'reviewCount');
  assertStringValue(result.guardrail, 'guardrail');
  assertStringValue(result.reportText, 'reportText');
  assertStringValue(result.summaryText, 'summaryText');
  assertNumberRecordKeys(
    result.statusCounts,
    [
      'blocked',
      'consistent',
      'review-needed',
    ],
    'statusCounts',
  );
  assert.ok(Array.isArray(result.entries), 'entries should be an array.');
  for (const entry of result.entries) {
    assertEntryShape(entry);
  }
}

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-source-preflight-rollup.ts',
});

assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-handoff-source-preflight-rollup.ts CLI JSON contract',
);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-handoff-source-preflight-rollup-json-'));
try {
  const example = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample({
    outDir: path.join(tempDir, 'example'),
    prettyJson: true,
  });
  const bundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'handoff'),
    prettyJson: true,
    sampleSource: 'rehearsal',
  });
  const cliResult = runCli([
    '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-handoff-source-preflight-rollup.ts',
    '--case',
    'consistent-rehearsal',
    '--dir',
    example.intakeDirs.ready,
    '--handoff-dir',
    bundle.outDir,
    '--expected-source',
    'rehearsal',
    '--pretty',
  ]);

  assert.equal(
    cliResult.status,
    0,
    cliResult.stderr || cliResult.stdout || cliResult.error?.message,
  );
  assert.match(cliResult.stdout, /AgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollup status=consistent/u);
  assert.match(cliResult.stdout, /handoffSourcePreflightEntries:/u);
  assert.match(cliResult.stdout, /label=consistent-rehearsal status=consistent/u);
  assert.match(cliResult.stdout, /reviewSummaryPhaseCoverage=clean:1/u);
  assert.match(cliResult.stdout, /readinessRollupPhaseCoverage=clean:1/u);

  const result = parseTrailingJsonObject(cliResult.stdout);
  assertRollupContract(result);
  assert.equal(result.status, 'consistent');
  assert.equal(result.entryCount, 1);
  assert.equal(result.issueCount, 0);
  assert.equal(assertObjectRecord(result.statusCounts, 'statusCounts').consistent, 1);
  const entry = assertObjectRecord((result.entries as unknown[])[0], 'entry');
  assert.deepEqual(entry.reviewSummaryPhaseCoverage, {
    entryCount: 1,
    statusCounts: {
      clean: 1,
    },
    statuses: [
      'clean',
    ],
  });
  assert.deepEqual(entry.readinessRollupPhaseCoverage, {
    entryCount: 1,
    statusCounts: {
      clean: 1,
    },
    statuses: [
      'clean',
    ],
  });
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch handoff source preflight rollup CLI JSON contract smoke ok');
