import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
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

function assertStringArray(value: unknown, expected: readonly string[], label: string) {
  assert.ok(Array.isArray(value), `${label} should be an array.`);
  assert.deepEqual(value, expected, `${label} should match expected issue codes.`);
}

function getEntryByLabel(result: Record<string, unknown>, label: string) {
  assert.ok(Array.isArray(result.entries), 'entries should be an array.');
  const entry = result.entries
    .map((value) => assertObjectRecord(value, 'entry'))
    .find((value) => value.label === label);

  assert.ok(entry, `Expected entry ${label}.`);

  return entry;
}

function assertCleanPhaseCoverage(entry: Record<string, unknown>, label: string) {
  assert.deepEqual(
    entry.reviewSummaryPhaseCoverage,
    {
      entryCount: 1,
      statusCounts: {
        clean: 1,
      },
      statuses: [
        'clean',
      ],
    },
    `${label} should preserve review summary phase coverage.`,
  );
  assert.deepEqual(
    entry.readinessRollupPhaseCoverage,
    {
      entryCount: 1,
      statusCounts: {
        clean: 1,
      },
      statuses: [
        'clean',
      ],
    },
    `${label} should preserve readiness rollup phase coverage.`,
  );
}

const { source } = readProjectSources({
  source: 'scripts/agent-session-v3-pilot-real-corpus-batch-handoff-source-preflight-rollup.ts',
});

assertSourceDoesNotUseRuntimeOrFixedDesktopChain(
  source,
  'agent-session-v3-pilot-real-corpus-batch-handoff-source-preflight-rollup.ts degraded CLI rehearsal',
);

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-handoff-source-preflight-rollup-degraded-cli-'));
try {
  const example = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample({
    outDir: path.join(tempDir, 'example'),
    prettyJson: true,
  });
  const consistentBundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'consistent-handoff'),
    prettyJson: true,
    sampleSource: 'rehearsal',
  });
  const mismatchedBundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'mismatched-handoff'),
    prettyJson: true,
    sampleSource: 'real-exported',
  });
  const unknownBundle = await runAgentSessionV3PilotRealCorpusBatchHandoffBundle({
    intakeDirs: [
      example.intakeDirs.ready,
    ],
    outDir: path.join(tempDir, 'unknown-handoff'),
    prettyJson: true,
    sampleSource: 'unknown',
  });
  const cliResult = runCli([
    '.\\scripts\\agent-session-v3-pilot-real-corpus-batch-handoff-source-preflight-rollup.ts',
    '--case',
    'consistent-rehearsal',
    '--dir',
    example.intakeDirs.ready,
    '--handoff-dir',
    consistentBundle.outDir,
    '--expected-source',
    'rehearsal',
    '--case',
    'mismatched-real-exported',
    '--dir',
    example.intakeDirs.ready,
    '--handoff-dir',
    mismatchedBundle.outDir,
    '--expected-source',
    'rehearsal',
    '--case',
    'unknown-handoff',
    '--dir',
    example.intakeDirs.ready,
    '--handoff-dir',
    unknownBundle.outDir,
    '--pretty',
  ]);

  assert.equal(
    cliResult.status,
    0,
    cliResult.stderr || cliResult.stdout || cliResult.error?.message,
  );
  assert.match(cliResult.stdout, /AgentSessionV3PilotRealCorpusBatchHandoffSourcePreflightRollup status=blocked/u);
  assert.match(cliResult.stdout, /entries=3/u);
  assert.match(cliResult.stdout, /consistent=1/u);
  assert.match(cliResult.stdout, /reviewNeeded=0/u);
  assert.match(cliResult.stdout, /blocked=2/u);
  assert.match(cliResult.stdout, /handoffSourcePreflightEntries:/u);
  assert.match(cliResult.stdout, /label=consistent-rehearsal status=consistent/u);
  assert.match(cliResult.stdout, /reviewSummaryPhaseCoverage=clean:1/u);
  assert.match(cliResult.stdout, /readinessRollupPhaseCoverage=clean:1/u);
  assert.match(cliResult.stdout, /label=mismatched-real-exported status=blocked/u);
  assert.match(cliResult.stdout, /label=unknown-handoff status=blocked/u);
  assert.match(cliResult.stdout, /guardrail=caller-owned handoff source preflight rollup only/u);

  const result = parseTrailingJsonObject(cliResult.stdout);
  const statusCounts = assertObjectRecord(result.statusCounts, 'statusCounts');
  const consistentEntry = getEntryByLabel(result, 'consistent-rehearsal');
  const mismatchedEntry = getEntryByLabel(result, 'mismatched-real-exported');
  const unknownEntry = getEntryByLabel(result, 'unknown-handoff');

  assert.equal(result.kind, 'agent-session-v3-pilot-real-corpus-batch-handoff-source-preflight-rollup');
  assert.equal(result.version, 1);
  assert.equal(result.readyForProductionRuntime, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.entryCount, 3);
  assert.equal(statusCounts.consistent, 1);
  assert.equal(statusCounts.blocked, 2);
  assert.equal(statusCounts['review-needed'], 0);
  assert.equal(consistentEntry.status, 'consistent');
  assert.equal(consistentEntry.sourcePreflightStatus, 'consistent');
  assert.equal(consistentEntry.sampleSourceConsistencyStatus, 'consistent');
  assert.equal(consistentEntry.reviewerPacketStatus, 'ready-for-reviewer');
  assertCleanPhaseCoverage(consistentEntry, 'consistent');
  assertStringArray(consistentEntry.sourcePreflightIssueCodes, [], 'consistent.sourcePreflightIssueCodes');
  assertStringArray(consistentEntry.sampleSourceConsistencyIssueCodes, [], 'consistent.sampleSourceConsistencyIssueCodes');
  assertStringArray(consistentEntry.reviewerPacketIssueCodes, [], 'consistent.reviewerPacketIssueCodes');
  assert.equal(mismatchedEntry.status, 'blocked');
  assertCleanPhaseCoverage(mismatchedEntry, 'mismatched');
  assertStringArray(
    mismatchedEntry.sourcePreflightIssueCodes,
    [
      'handoff-status-blocked',
      'handoff-source-mismatch',
      'handoff-status-mismatch',
    ],
    'mismatched.sourcePreflightIssueCodes',
  );
  assertStringArray(
    mismatchedEntry.sampleSourceConsistencyIssueCodes,
    ['expected-source-mismatch'],
    'mismatched.sampleSourceConsistencyIssueCodes',
  );
  assertStringArray(
    mismatchedEntry.reviewerPacketIssueCodes,
    ['sample-source-blocked'],
    'mismatched.reviewerPacketIssueCodes',
  );
  assert.equal(unknownEntry.status, 'blocked');
  assertCleanPhaseCoverage(unknownEntry, 'unknown');
  assertStringArray(
    unknownEntry.sourcePreflightIssueCodes,
    [
      'handoff-status-review-needed',
      'handoff-source-mismatch',
      'handoff-status-mismatch',
    ],
    'unknown.sourcePreflightIssueCodes',
  );
  assertStringArray(
    unknownEntry.sampleSourceConsistencyIssueCodes,
    ['unknown-sample-source'],
    'unknown.sampleSourceConsistencyIssueCodes',
  );
  assertStringArray(
    unknownEntry.reviewerPacketIssueCodes,
    ['sample-source-review-needed'],
    'unknown.reviewerPacketIssueCodes',
  );
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

console.log('agent session v3 pilot real corpus batch handoff source preflight rollup degraded CLI rehearsal smoke ok');
